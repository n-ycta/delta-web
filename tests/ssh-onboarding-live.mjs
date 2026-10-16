// Real two-node routing through a real OpenSSH client and an isolated SSH test server.
// Provisioning uses a disposable preinstalled profile, never the operator's VPS.
import ssh2 from "ssh2";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  symlink,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { SSHOnboarding } from "delta-provision/server/ssh-onboarding.mjs";
import { DeltaClient } from "../server/delta-sdk.mjs";
const exec = promisify(execFile),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const binary =
  process.env.DELTA_TEST_BINARY || resolve("../delta/target/debug/delta");
const root = await mkdtemp(join(tmpdir(), "delta-ssh-live-")),
  children = [],
  connections = new Set();
async function port() {
  return new Promise((r) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });
}
async function node(name) {
  const h = join(root, name),
    home = join(h, ".delta");
  await mkdir(h);
  const p = await port();
  await exec(binary, ["init", "--name", name, "--port", String(p)], {
    env: { ...process.env, DELTA_HOME: home },
  });
  await mkdir(join(home, "runtime", "bin"), { recursive: true });
  await mkdir(join(home, "bin"));
  await symlink(process.execPath, join(home, "runtime", "bin", "node"));
  await symlink(binary, join(home, "bin", "delta"));
  const processNode = spawn(binary, ["run"], {
    env: { ...process.env, DELTA_HOME: home },
    stdio: "ignore",
  });
  children.push(processNode);
  const c = new DeltaClient(
    "http://127.0.0.1:" + p,
    (await readFile(join(home, "admin.token"), "utf8")).trim(),
  );
  for (let i = 0; i < 100; i++) {
    try {
      const info = await c.call("core.info");
      return { h, home, p, c, info };
    } catch {}
    await sleep(50);
  }
  throw Error("node timeout");
}
const a = await node("ssh-pc"),
  b = await node("ssh-vps");
const authHome = join(root, "ssh-login");
await mkdir(authHome);
const hostKey = ssh2.utils.generateKeyPairSync("ed25519");
const server = new ssh2.Server({ hostKeys: [hostKey.private] }, (conn) => {
  connections.add(conn);
  const forwards = new Map();
  conn.on("authentication", (ctx) => {
    if (
      (ctx.method === "password" &&
        ctx.username === "fixture" &&
        ctx.password === "fixture-password") ||
      (ctx.method === "publickey" && ctx.username === "fixture")
    )
      ctx.accept();
    else ctx.reject();
  });
  conn.on("ready", () => {
    conn.on("session", (accept) => {
      const session = accept();
      session.on("exec", (accept, _reject, info) => {
        const stream = accept();
        if (info.command === "sh -s") {
          stream.on("data", () => {});
          stream.on("end", () => {
            stream.write(
              JSON.stringify({
                home: b.h,
                user: process.env.USER || "vercel-sandbox",
                port: b.p,
                nodeId: b.info.node_id,
              }),
            );
            stream.exit(0);
            stream.end();
          });
          return;
        }
        const child = spawn("/bin/sh", ["-c", info.command], {
          env: { ...process.env, HOME: authHome },
        });
        stream.pipe(child.stdin);
        child.stdout.pipe(stream, { end: false });
        child.stderr.pipe(stream.stderr);
        child.on("exit", (code) => {
          stream.exit(code || 0);
          stream.end();
        });
      });
    });
    conn.on("tcpip", (accept, reject, info) => {
      const socket = net.connect(info.destPort, info.destIP, () => {
        const stream = accept();
        socket.pipe(stream).pipe(socket);
      });
      socket.on("error", () => reject());
    });
    conn.on("request", (accept, reject, name, info) => {
      if (name === "tcpip-forward") {
        const s = net.createServer((socket) => {
          conn.forwardOut(
            info.bindAddr,
            s.address().port,
            socket.remoteAddress,
            socket.remotePort,
            (err, stream) => {
              if (err) {
                socket.destroy();
                return;
              }
              socket.pipe(stream).pipe(socket);
            },
          );
        });
        s.listen(info.bindPort, info.bindAddr, () => {
          forwards.set(s.address().port, s);
          accept(s.address().port);
        });
      } else if (name === "cancel-tcpip-forward") {
        forwards.get(info.bindPort)?.close();
        forwards.delete(info.bindPort);
        accept();
      } else reject?.();
    });
  });
  conn.on("error", () => {});
  conn.on("close", () => {
    connections.delete(conn);
    for (const s of forwards.values()) s.close();
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const host = {
  host: "127.0.0.1",
  port: server.address().port,
  username: "fixture",
};
try {
  const svc = await new SSHOnboarding(a.home, a.c).init();
  const p = await svc.inspect(host);
  assert.match(p.fingerprint, /^SHA256:/);
  const { jobId } = await svc.start({
    ...host,
    ...p,
    auth: "password",
    password: "fixture-password",
    trust: "mutual",
    acknowledgeAdmin: true,
  });
  let job;
  for (let i = 0; i < 120; i++) {
    job = await svc.status(jobId);
    if (job.status !== "running") break;
    await sleep(500);
  }
  assert.equal(job.status, "complete", JSON.stringify(job));
  assert.equal(
    (await a.c.call("system.ping", { echo: "forward" }, b.info.node_id)).echo,
    "forward",
  );
  assert.equal(
    (await b.c.call("system.ping", { echo: "reverse" }, a.info.node_id)).echo,
    "reverse",
  );
  await a.c.call("tokens.list", {}, b.info.node_id);
  await b.c.call("tokens.list", {}, a.info.node_id);
  const persisted = await readFile(
    join(a.home, "data", "connections", jobId + ".json"),
    "utf8",
  );
  assert(!persisted.includes("fixture-password"));
  assert(!persisted.includes("PRIVATE KEY"));
  await a.c.call("peers.trust", { node: b.info.node_id, admin: false });
  await assert.rejects(() => b.c.call("tokens.list", {}, a.info.node_id));
  await a.c.call("tokens.list", {}, b.info.node_id);
  // Core restart restores the persisted tunnel without a Web process or login password.
  children[0].kill("SIGTERM");
  await new Promise((r) => children[0].once("exit", r));
  const restarted = spawn(binary, ["run"], {
    env: { ...process.env, DELTA_HOME: a.home },
    stdio: "ignore",
  });
  children.push(restarted);
  let restored = false;
  for (let i = 0; i < 60; i++) {
    try {
      await a.c.call("system.ping", {}, b.info.node_id);
      restored = true;
      break;
    } catch {}
    await sleep(500);
  }
  assert(restored, "tunnel did not survive core restart");
  await a.c.call("peers.remove", { node: b.info.node_id });
  await svc.remove(b.info.node_id);
  assert.equal((await a.c.call("supervisor.list")).length, 0);
  await assert.rejects(() => b.c.call("system.ping", {}, a.info.node_id));
  const loginKey = ssh2.utils.generateKeyPairSync("ed25519", {
    passphrase: "fixture-key-passphrase",
    cipher: "aes256-cbc",
  });
  const p2 = await svc.inspect(host);
  const { jobId: keyId } = await svc.start({
    ...host,
    ...p2,
    auth: "key",
    privateKey: loginKey.private,
    passphrase: "fixture-key-passphrase",
    trust: "manage",
    acknowledgeAdmin: true,
  });
  let keyJob;
  for (let i = 0; i < 120; i++) {
    keyJob = await svc.status(keyId);
    if (keyJob.status !== "running") break;
    await sleep(500);
  }
  assert.equal(keyJob.status, "complete", JSON.stringify(keyJob));
  await a.c.call("tokens.list", {}, b.info.node_id);
  await assert.rejects(() => b.c.call("tokens.list", {}, a.info.node_id));
  await a.c.call("peers.remove", { node: b.info.node_id });
  await svc.remove(b.info.node_id);
  console.log(
    "PASS: password and encrypted-key bootstrap, host pinning, real SSH bidirectional routing, mutual admin, downgrade, core restart without Web, removal; no login secrets in job state",
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const c of children) c.kill("SIGTERM");
  for (const c of connections) c.destroy();
  server.close();
  await sleep(300);
  await rm(root, { recursive: true, force: true });
}
