import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SSHOnboarding,
  sshHandlers,
  tunnelArgs,
} from "../server/ssh-onboarding.mjs";
const owner = { kind: "token", scopes: ["admin"] },
  target = { host: "server.example", port: 22, username: "root" },
  pause = () => new Promise((r) => setTimeout(r, 10));
async function fixture(deps = {}) {
  const home = await mkdtemp(join(tmpdir(), "delta-ssh-unit-"));
  const service = await new SSHOnboarding(
    home,
    {},
    {
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
