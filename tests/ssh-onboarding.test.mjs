import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SSHOnboarding,
  sshHandlers,
  tunnelArgs,
  findOpenSSH,
} from "../server/ssh-onboarding.mjs";
const owner = { kind: "token", scopes: ["admin"] },
  target = { host: "server.example", port: 22, username: "root" },
  pause = () => new Promise((r) => setTimeout(r, 10));
async function fixture(deps = {}) {
  const home = await mkdtemp(join(tmpdir(), "delta-ssh-unit-"));
  const service = await new SSHOnboarding(
    home,
    {
      call: async () => ({ version: "0.4.0" }),
      request: async () => [{ name: "peers.trust" }],
    },
    {
      findSSH: async () => ({
        available: true,
        path: "/usr/bin/ssh",
        version: "OpenSSH_9.9p1",
      }),
      probe: async () => ({
        fingerprint: "SHA256:test",
        algorithm: "ssh-ed25519",
        hostKey: "fake",
      }),
      install: async () => {},
      ...deps,
    },
  ).init();
  return {
    home,
    service,
    handlers: sshHandlers(service),
    close: () => rm(home, { recursive: true, force: true }),
  };
}
test("only local owner can probe or submit SSH credentials; peer-admin and narrow admin are denied", async () => {
  const f = await fixture();
  try {
    for (const caller of [
      { scopes: ["call:*"] },
      { scopes: ["admin:web.nodes_ssh_probe"] },
      { kind: "peer", scopes: ["admin"] },
    ])
      await assert.rejects(
        () => f.handlers["web.nodes_ssh_probe"](target, caller),
        (e) => e.code === "forbidden",
      );
    assert((await f.handlers["web.nodes_ssh_probe"](target, owner)).ticket);
  } finally {
    await f.close();
  }
});
test("host identity approval is target-bound, expiring, single use and shell-injection safe", async () => {
  const f = await fixture();
  try {
    for (const host of ["-oProxyCommand=x", "localhost;id", "a b", "$(id)"])
      await assert.rejects(() => f.service.inspect({ ...target, host }));
    const p = await f.service.inspect(target),
      base = {
        ...target,
        ...p,
        auth: "password",
        password: "secret",
        trust: "calls",
      };
    await assert.rejects(
      () => f.service.start({ ...base, host: "other.example" }),
      (e) => e.code === "host_key",
    );
    await assert.rejects(
      () => f.service.start(base),
      (e) => e.code === "host_key",
    );
    const p2 = await f.service.inspect(target);
    f.service.tickets.get(p2.ticket).expires = 0;
    await assert.rejects(
      () => f.service.start({ ...base, ...p2 }),
      (e) => e.code === "host_key",
    );
  } finally {
    await f.close();
  }
});
test("admin consent is enforced server-side and credential fields never reach persisted jobs", async () => {
  const f = await fixture({
    install: async () => {
      throw Error("private password secret");
    },
  });
  try {
    let p = await f.service.inspect(target);
    await assert.rejects(
      () =>
        f.service.start({
          ...target,
          ...p,
          auth: "password",
          password: "secret",
          trust: "mutual",
          acknowledgeAdmin: false,
        }),
      (e) => e.code === "invalid",
    );
    p = await f.service.inspect(target);
    const { jobId } = await f.service.start({
      ...target,
      ...p,
      auth: "key",
      privateKey: "PRIVATE KEY SECRET",
      passphrase: "secret",
      trust: "mutual",
      acknowledgeAdmin: true,
    });
    let job;
    for (let i = 0; i < 100; i++) {
      await pause();
      job = await f.service.status(jobId);
      if (job.status === "failed") break;
    }
    assert.equal(job.error, "ssh_failed");
    const text = await readFile(join(f.service.dir, jobId + ".json"), "utf8");
    assert(!/secret|PRIVATE KEY|passphrase|password/.test(text));
    await assert.rejects(() => f.service.status("../../config.json"));
  } finally {
    await f.close();
  }
});
test("persistent transport has strict pinning, restricted identities and loopback-only forwards", () => {
  const args = tunnelArgs(target, "/private/profile", 18000, 18001, 7700, 7700),
    str = args.join(" ");
  for (const s of [
    "BatchMode=yes",
    "StrictHostKeyChecking=yes",
    "IdentitiesOnly=yes",
    "ForwardAgent=no",
    "ProxyCommand=none",
    "127.0.0.1:18000:127.0.0.1:7700",
    "127.0.0.1:18001:127.0.0.1:7700",
  ])
    assert(str.includes(s));
  assert(!str.includes("password"));
  assert(!str.includes("0.0.0.0"));
  assert.equal(args.at(-1), "root@server.example");
});

test("service PATH fallback resolves an absolute OpenSSH binary for the core supervisor", async () => {
  const attempted = [];
  const result = await findOpenSSH({
    os: "linux",
    env: { PATH: "/private/node/bin" },
    run: async (path) => {
      attempted.push(path);
      if (path === "/usr/bin/ssh")
        return { stderr: "OpenSSH_9.9p1, OpenSSL 3.0" };
      throw Object.assign(Error(), { code: "ENOENT" });
    },
  });
  assert.equal(result.path, "/usr/bin/ssh");
  assert.equal(result.version, "OpenSSH_9.9p1");
  assert.deepEqual(attempted, ["/private/node/bin/ssh", "/usr/bin/ssh"]);
  const missing = await findOpenSSH({
    os: "linux",
    env: { PATH: "" },
    run: async () => {
      throw Object.assign(Error(), { code: "ENOENT" });
    },
  });
  assert.equal(missing.error, "ssh_missing");
  const denied = await findOpenSSH({
    os: "linux",
    env: { PATH: "" },
    run: async () => {
      throw Object.assign(Error(), { code: "EACCES" });
    },
  });
  assert.equal(denied.error, "ssh_unusable");
  const win = await findOpenSSH({
    os: "win32",
    env: { PATH: "C:\\private\\node", SystemRoot: "C:\\Windows" },
    run: async (path) => {
      if (path === "C:\\Windows\\System32\\OpenSSH\\ssh.exe")
        return { stderr: "OpenSSH_for_Windows_9.5p1" };
      throw Object.assign(Error(), { code: "ENOENT" });
    },
  });
  assert.equal(win.path, "C:\\Windows\\System32\\OpenSSH\\ssh.exe");
});

test("old running local core is detected before host probing, authentication or job creation", async () => {
  let probed = 0;
  const f = await fixture({
    probe: async () => {
      probed++;
      throw Error("must not probe");
    },
  });
  try {
    f.service.client = {
      call: async () => ({ version: "0.3.4" }),
      request: async () => [],
    };
    const r = await f.service.preflight();
    assert.equal(r.core.version, "0.3.4");
    assert.deepEqual(r.errors, ["local_core_old"]);
    await assert.rejects(
      () => f.service.inspect(target),
      (e) => e.code === "local_core_old",
    );
    assert.equal(probed, 0);
    assert.equal(f.service.active, false);
  } finally {
    await f.close();
  }
});

test("missing SSH and unavailable local core have separate simultaneous diagnostics", async () => {
  const f = await fixture({
    findSSH: async () => ({ available: false, error: "ssh_missing" }),
  });
  try {
    let r = await f.service.preflight();
    assert.deepEqual(r.errors, ["ssh_missing"]);
    f.service.client = {
      call: async () => {
        throw Error("offline");
      },
      request: async () => [],
    };
    r = await f.service.preflight();
    assert.deepEqual(r.errors, ["local_core_unavailable", "ssh_missing"]);
    await assert.rejects(
      () => f.handlers["web.nodes_ssh_preflight"]({}, { scopes: ["call:*"] }),
      (e) => e.code === "forbidden",
    );
  } finally {
    await f.close();
  }
});
