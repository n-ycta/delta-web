// SSH bootstrap is Web-owned; the persistent encrypted channel is a core-supervised
// OpenSSH process. User authentication material is never written to disk.
import ssh2 from "ssh2";
const { Client: SSH, utils } = ssh2;
import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  rm,
  readdir,
} from "node:fs/promises";
import { resolve, join, win32, posix } from "node:path";
import { createServer } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { DeltaError } from "./delta-sdk.mjs";
const exec = promisify(execFile),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const target = z.object({
  host: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9:.[\]-]+$/)
    .refine((s) => !s.startsWith("-")),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/),
});
const input = target.extend({
  ticket: z.string().uuid(),
  fingerprint: z.string().max(100),
  auth: z.enum(["password", "key"]),
  password: z.string().max(4096).optional(),
  privateKey: z.string().max(65536).optional(),
  passphrase: z.string().max(4096).optional(),
  trust: z.enum(["calls", "manage", "mutual"]),
  acknowledgeAdmin: z.boolean().default(false),
});
export const messages = {
  invalid: [
    "Check the SSH address, port, user and authentication fields.",
    "Проверьте SSH-адрес, порт, пользователя и данные входа.",
  ],
  owner: [
    "Only the node owner can install devices or change trust.",
    "Только владелец узла может устанавливать устройства и менять доверие.",
  ],
  host_key: [
    "The server identity changed or was not confirmed. Check its fingerprint through a trusted channel.",
    "Ключ сервера изменился или не подтверждён. Сверьте отпечаток через доверенный канал.",
  ],
  ssh_failed: [
    "SSH connection failed. Check the address, credentials and server SSH policy.",
    "Не удалось подключиться по SSH. Проверьте адрес, данные входа и политику SSH сервера.",
  ],
  prerequisite: [
    "Install the OpenSSH client on this computer, and update Delta Core on both devices to a version supporting explicit peer trust.",
    "Установите клиент OpenSSH на этом компьютере и обновите Delta Core на обоих устройствах до версии с настройкой доверия узлов.",
  ],
  ssh_missing: [
    "OpenSSH is not installed or is not visible to the Web service on this computer. Install the OpenSSH client here, not on the VPS.",
    "На этом компьютере не найден клиент OpenSSH. Установите его на ПК, где работает Web, а не на VPS.",
  ],
  ssh_unusable: [
    "The local SSH executable could not be run as an OpenSSH client. Check its permissions and the service environment.",
    "Локальный SSH-клиент не удалось запустить. Проверьте его права и окружение службы Web.",
  ],
  local_core_old: [
    "The running core on this computer does not support peer trust. Use Update core below to install a compatible version (0.4.0 or newer).",
    "Работающее ядро на этом ПК не поддерживает доверие узлов. Нажмите «Обновить ядро» ниже, чтобы установить совместимую версию (0.4.0 или новее).",
  ],
  local_core_unavailable: [
    "Cannot verify the running local core. Check the Web-to-core connection before connecting a server.",
    "Не удалось проверить работающее ядро на ПК. Сначала восстановите соединение Web с ядром.",
  ],
  remote_core_old: [
    "The running core on the VPS still lacks peer trust after setup. The local computer passed its checks. Check the server service and update its core to 0.4.0 or newer.",
    "После установки ядро на VPS всё ещё не поддерживает доверие узлов. Проверки ПК пройдены. Проверьте службу сервера и обновите его ядро до 0.4.0 или новее.",
  ],
  busy: [
    "Another device installation is in progress.",
    "Уже выполняется установка устройства.",
  ],
  remote_setup: [
    "Server setup failed. Linux with curl, tar, xz and a working systemd user service is required. Non-root installation requires user lingering. Existing data is not deleted.",
    "Не удалось подготовить сервер. Нужен Linux с curl, tar, xz и рабочей пользовательской службой systemd. Для установки без root нужен lingering. Существующие данные не удалены.",
  ],
  tunnel: [
    "The SSH server did not allow the protected bidirectional tunnel. Check SSH forwarding policy.",
    "SSH-сервер не разрешил защищённый двусторонний туннель. Проверьте политику перенаправления портов SSH.",
  ],
  pairing: [
    "Pairing or bidirectional verification failed. Granted peer access is rolled back where reachable.",
    "Не удалось выполнить сопряжение или двустороннюю проверку. Выданный доступ отозван на доступных узлах.",
  ],
  interrupted: [
    "Setup was interrupted. Retry the connection.",
    "Настройка была прервана. Повторите подключение.",
  ],
  missing: ["Connection job not found.", "Задание подключения не найдено."],
};
class SetupError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code) => {
  throw new SetupError(code);
};
const fingerprint = (key) =>
  "SHA256:" +
  createHash("sha256").update(key).digest("base64").replace(/=+$/, "");
const quote = (s) => "'" + String(s).replaceAll("'", "'\"'\"'") + "'";
const atomic = async (file, value) => {
  await mkdir(resolve(file, ".."), { recursive: true, mode: 0o700 });
  await writeFile(file + ".tmp", JSON.stringify(value), { mode: 0o600 });
  await rename(file + ".tmp", file);
};
function connect(a, expected) {
  return new Promise((yes, no) => {
    const c = new SSH();
    c.once("ready", () => yes(c));
    c.once("error", () => no(new SetupError("ssh_failed")));
    c.connect({
      host: a.host,
      port: a.port,
      username: a.username,
      readyTimeout: 20000,
      keepaliveInterval: 15000,
      hostVerifier: (key) => {
        if (fingerprint(key) !== expected) {
          no(new SetupError("host_key"));
          return false;
        }
        return true;
      },
      ...(a.auth === "password"
        ? { password: a.password }
        : { privateKey: a.privateKey, passphrase: a.passphrase }),
    });
  });
}
export function probeHost(a) {
  return new Promise((yes, no) => {
    const c = new SSH();
    let found = false;
    c.on("error", () => {
      if (!found) no(new SetupError("ssh_failed"));
    });
    c.connect({
      host: a.host,
      port: a.port,
      username: a.username,
      readyTimeout: 15000,
      hostVerifier: (key) => {
        found = true;
        yes({
          fingerprint: fingerprint(key),
          hostKey: key.toString("base64"),
          algorithm: key.subarray(4, 4 + key.readUInt32BE(0)).toString(),
        });
        return false;
      },
    });
  });
}
export function runSSH(
  c,
  command,
  stdin = "",
  limit = 65536,
  timeout = 300000,
) {
  return new Promise((yes, no) => {
    let out = "",
      bytes = 0;
    const t = setTimeout(() => {
      c.destroy();
      no(new SetupError("remote_setup"));
    }, timeout);
    c.exec(command, (e, s) => {
      if (e) {
        clearTimeout(t);
        no(new SetupError("ssh_failed"));
        return;
      }
      s.on("data", (b) => {
        bytes += b.length;
        if (bytes > limit) {
          s.close();
          clearTimeout(t);
          no(new SetupError("remote_setup"));
          return;
        }
        out += b.toString();
      });
      s.stderr.on("data", () => {});
      s.on("error", () => {
        clearTimeout(t);
        no(new SetupError("ssh_failed"));
      });
      s.on("close", (code) => {
        clearTimeout(t);
        code === 0 ? yes(out) : no(new SetupError("remote_setup"));
      });
      s.end(stdin);
    });
  });
}
async function freeLocalPort() {
  return new Promise((yes, no) => {
    const s = createServer();
    s.on("error", no);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => yes(p));
    });
  });
}
async function freeRemotePort(c) {
  return new Promise((yes, no) =>
    c.forwardIn("127.0.0.1", 0, (e, p) => {
      if (e) {
        no(new SetupError("tunnel"));
        return;
      }
      c.unforwardIn("127.0.0.1", p, (e) =>
        e ? no(new SetupError("tunnel")) : yes(p),
      );
    }),
  );
}
export async function findOpenSSH({
  run = exec,
  os = process.platform,
  env = process.env,
} = {}) {
  const paths = os === "win32" ? win32 : posix;
  const executable = os === "win32" ? "ssh.exe" : "ssh";
  const fromPath = (env.PATH || "")
    .split(paths.delimiter)
    .filter((p) => p && paths.isAbsolute(p))
    .map((p) => paths.join(p, executable));
  const candidates = [
    ...fromPath,
    ...(os === "win32"
      ? env.SystemRoot || env.WINDIR
        ? [
            win32.join(
              env.SystemRoot || env.WINDIR,
              "System32",
              "OpenSSH",
              "ssh.exe",
            ),
          ]
        : []
      : ["/usr/bin/ssh", "/bin/ssh", "/usr/local/bin/ssh"]),
  ];
  let unusable = false;
  for (const path of [...new Set(candidates)]) {
    try {
      const result = await run(path, ["-V"], {
        timeout: 5000,
        windowsHide: true,
        maxBuffer: 16384,
      });
      const version = (
        String(result.stderr || "") +
        " " +
        String(result.stdout || "")
      ).match(/OpenSSH(?:_for_Windows)?_[0-9][0-9A-Za-z._-]*/)?.[0];
      if (version) return { available: true, path, version };
      unusable = true;
    } catch (e) {
      if (e.code !== "ENOENT") unusable = true;
    }
  }
  return { available: false, error: unusable ? "ssh_unusable" : "ssh_missing" };
}

export function tunnelArgs(
  a,
  dir,
  localPort,
  remotePort,
  remoteCorePort,
  localCorePort,
) {
  return [
    "-F",
    join(dir, "ssh_config"),
    "-N",
    "-T",
    "-o",
    "ForwardAgent=no",
    "-o",
    "ForwardX11=no",
    "-o",
    "PermitLocalCommand=no",
    "-o",
    "IdentityAgent=none",
    "-o",
    "PasswordAuthentication=no",
    "-o",
    "KbdInteractiveAuthentication=no",
    "-o",
    "ProxyCommand=none",
    "-o",
    "ProxyJump=none",
    "-p",
    String(a.port),
    "-i",
    join(dir, "id_ed25519"),
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    "UserKnownHostsFile=" + join(dir, "known_hosts"),
    "-o",
    "GlobalKnownHostsFile=" + join(dir, "known_hosts"),
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "ConnectTimeout=15",
    "-o",
    "ControlMaster=no",
    "-o",
    "ClearAllForwardings=no",
    "-o",
    "GatewayPorts=no",
    "-L",
    `127.0.0.1:${localPort}:127.0.0.1:${remoteCorePort}`,
    "-R",
    `127.0.0.1:${remotePort}:127.0.0.1:${localCorePort}`,
    a.username + "@" + a.host,
  ];
}
// Static program, no user-controlled shell fragments. Existing profiles are reused.
const provision = `set -eu
umask 077
[ "$(uname -s)" = Linux ]
command -v curl >/dev/null; command -v python3 >/dev/null
if [ "$(id -u)" = 0 ]; then
  if ! id delta >/dev/null 2>&1; then useradd --system --create-home --home-dir /var/lib/delta --shell /usr/sbin/nologin delta; fi
  U=delta; H=$(getent passwd delta | cut -d: -f6)
  loginctl enable-linger "$U"
else U=$(id -un); H=$HOME; [ "$(loginctl show-user "$U" -p Linger --value)" = yes ]; fi
UIDN=$(id -u "$U")
if [ "$(id -u)" = 0 ]; then systemctl start "user@$UIDN.service"; fi
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
curl --connect-timeout 20 --max-time 120 -fsSL https://raw.githubusercontent.com/n-ycta/delta/main/install.sh -o "$TMP"
if [ "$(id -u)" = 0 ]; then
  chown "$U" "$TMP"; chmod 600 "$TMP"
  runuser -u "$U" -- env HOME="$H" XDG_RUNTIME_DIR="/run/user/$UIDN" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$UIDN/bus" sh "$TMP" --plugins none --kind vps --name delta-vps >&2
else sh "$TMP" --plugins none --kind vps --name delta-vps >&2; fi
python3 - "$H" "$U" <<'PY'
import json,sys
h,u=sys.argv[1:]
c=json.load(open(h+'/.delta/config.json'))
assert c['listen'] in ('127.0.0.1','::1'), 'Refusing an existing publicly exposed core'
print(json.dumps({'home':h,'user':u,'port':c['port'],'nodeId':c['node_id']}))
PY
`;
const rpcCode = `import {readFile} from 'node:fs/promises';let text='';for await(const b of process.stdin)text+=b;const a=JSON.parse(text);const home=process.env.HOME+'/.delta';const cfg=JSON.parse(await readFile(home+'/config.json','utf8'));const token=(await readFile(home+'/admin.token','utf8')).trim();const r=await fetch('http://127.0.0.1:'+cfg.port+'/v1/call',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(a),signal:AbortSignal.timeout(20000)});console.log(JSON.stringify(await r.json()));`;
async function remoteRPC(c, remote, capability, args = {}) {
  if (
    !/^\/[a-zA-Z0-9_./-]+$/.test(remote.home) ||
    !target.shape.username.safeParse(remote.user).success
  )
    fail("remote_setup");
  const cmd = `env HOME=${quote(remote.home)} ${quote(remote.home + "/.delta/runtime/bin/node")} --input-type=module -e ${quote(rpcCode)}`;
  const full = `if [ "$(id -u)" = 0 ]; then runuser -u ${quote(remote.user)} -- ${cmd}; else ${cmd}; fi`;
  const result = JSON.parse(
    await runSSH(c, full, JSON.stringify({ capability, args })),
  );
  if (!result.ok)
    fail(result.error?.code === "not_found" ? "remote_core_old" : "pairing");
  return result.result;
}
export class SSHOnboarding {
  constructor(home, client, dependencies = {}) {
    this.home = resolve(home);
    this.dir = join(this.home, "data", "connections");
    this.client = client;
    this.probe = dependencies.probe || probeHost;
    this.connect = dependencies.connect || connect;
    this.install = dependencies.install || this.perform.bind(this);
    this.findSSH = dependencies.findSSH || findOpenSSH;
    this.tickets = new Map();
    this.active = false;
  }
  async init() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    for (const f of await readdir(this.dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(await readFile(join(this.dir, f), "utf8"));
        if (j.status === "running") {
          if (j.peerId)
            await this.client
              .call("peers.remove", { node: j.peerId })
              .catch(() => {});
          if (j.component && /^ssh-[0-9a-f-]{36}$/.test(j.component))
            await this.client
              .call("supervisor.remove", { id: j.component })
              .catch(() => {});
          if (z.string().uuid().safeParse(j.id).success)
            await rm(join(this.dir, j.id), { recursive: true, force: true });
          j.status = "failed";
          j.error = "interrupted";
          await atomic(join(this.dir, f), j);
        }
      } catch {}
    }
    return this;
  }
  async preflight() {
    const [ssh, core] = await Promise.all([
      this.findSSH(),
      Promise.all([
        this.client.call("core.info"),
        this.client.request("GET", "/capabilities"),
      ])
        .then(([info, caps]) => ({
          version: String(info.version || "unknown").slice(0, 64),
          supported:
            Array.isArray(caps) && caps.some((c) => c.name === "peers.trust"),
        }))
        .catch(() => ({ supported: false, error: "local_core_unavailable" })),
    ]);
    const errors = [
      ...(core.supported ? [] : [core.error || "local_core_old"]),
      ...(ssh.available ? [] : [ssh.error]),
    ];
    return {
      ready: errors.length === 0,
      core,
      ssh,
      errors,
      platform: process.platform,
      checkedAt: Date.now(),
    };
  }
  async requireLocalReady() {
    const report = await this.preflight();
    if (!report.ready) fail(report.errors[0]);
    return report;
  }
  async inspect(raw) {
    const a = target.safeParse(raw);
    if (!a.success) fail("invalid");
    await this.requireLocalReady();
    const p = await this.probe(a.data);
    for (const [k, v] of this.tickets)
      if (v.expires < Date.now()) this.tickets.delete(k);
    if (this.tickets.size >= 32)
      this.tickets.delete(this.tickets.keys().next().value);
    const ticket = randomUUID();
    this.tickets.set(ticket, { ...a.data, ...p, expires: Date.now() + 300000 });
    return {
      ticket,
      fingerprint: p.fingerprint,
      algorithm: p.algorithm,
      expiresAt: Date.now() + 300000,
    };
  }
  async start(raw) {
    const parsed = input.safeParse(raw);
    if (!parsed.success) fail("invalid");
    const a = parsed.data;
    if (a.trust !== "calls" && !a.acknowledgeAdmin) fail("invalid");
    if (
      (a.auth === "password" && !a.password) ||
      (a.auth === "key" && !a.privateKey)
    )
      fail("invalid");
    if (this.active) fail("busy");
    await this.requireLocalReady();
    if (this.active) fail("busy");
    const t = this.tickets.get(a.ticket);
    this.tickets.delete(a.ticket);
    if (
      !t ||
      t.expires < Date.now() ||
      t.host !== a.host ||
      t.port !== a.port ||
      t.username !== a.username ||
      t.fingerprint !== a.fingerprint
    )
      fail("host_key");
    this.active = true;
    const id = randomUUID(),
      job = {
        id,
        host: a.host,
        username: a.username,
        status: "running",
        phase: "connecting",
        trust: a.trust,
        startedAt: Date.now(),
      };
    try {
      await atomic(join(this.dir, id + ".json"), job);
    } catch (e) {
      this.active = false;
      throw e;
    }
    setImmediate(async () => {
      const save = async (patch) => {
        Object.assign(job, patch, { updatedAt: Date.now() });
        await atomic(join(this.dir, id + ".json"), job);
      };
      try {
        await this.install(a, t, job, save);
        await save({ status: "complete", phase: "complete" });
      } catch (e) {
        await save({
          status: "failed",
          error: messages[e.code] ? e.code : "ssh_failed",
        });
      } finally {
        delete a.password;
        delete a.privateKey;
        delete a.passphrase;
        this.active = false;
      }
    });
    return { jobId: id };
  }
  async status(id) {
    if (!z.string().uuid().safeParse(id).success) fail("missing");
    try {
      return JSON.parse(await readFile(join(this.dir, id + ".json"), "utf8"));
    } catch {
      fail("missing");
    }
  }
  async perform(a, t, job, save) {
    let c,
      remote,
      peerId,
      managed = false,
      keyAdded = false,
      pairingAttempted = false;
    const dir = join(this.dir, job.id),
      component = "ssh-" + job.id;
    try {
      const readiness = await this.requireLocalReady();
      const local = await this.client.call("core.info"),
        cfg = JSON.parse(
          await readFile(join(this.home, "config.json"), "utf8"),
        );
      c = await this.connect(a, t.fingerprint);
      delete a.password;
      delete a.privateKey;
      delete a.passphrase;
      await save({ phase: "installing" });
      remote = JSON.parse(await runSSH(c, "sh -s", provision));
      if (remote.nodeId === local.node_id) fail("pairing");
      // Never silently replace an existing relationship or rotate its key.
      if (
        (await this.client.call("peers.list")).some(
          (p) => p.node_id === remote.nodeId,
        )
      )
        fail("pairing");
      const remoteCaps = await remoteRPC(c, remote, "core.capabilities");
      if (
        !remoteCaps.some(
          (x) =>
            x.name === "peers.trust" && (!x.node || x.node === remote.nodeId),
        )
      )
        fail("remote_core_old");
      if (
        (await remoteRPC(c, remote, "peers.list")).some(
          (p) => p.node_id === local.node_id,
        )
      )
        fail("pairing");
      const localPort = await freeLocalPort(),
        remotePort = await freeRemotePort(c);
      await save({ phase: "tunnel", component, localPort, remotePort });
      await mkdir(dir, { mode: 0o700 });
      if (process.platform === "win32") {
        const { stdout } = await exec("whoami", [], { windowsHide: true });
        await exec(
          "icacls",
          [
            dir,
            "/inheritance:r",
            "/grant:r",
            stdout.trim() + ":(OI)(CI)F",
            "SYSTEM:(OI)(CI)F",
          ],
          { windowsHide: true },
        );
      }
      await writeFile(join(dir, "ssh_config"), "", { mode: 0o600 });
      const keys = utils.generateKeyPairSync("ed25519", {
        comment: "delta-link-" + job.id,
      });
      await writeFile(join(dir, "id_ed25519"), keys.private, { mode: 0o600 });
      await writeFile(
        join(dir, "known_hosts"),
        `[${a.host}]:${a.port} ${t.algorithm} ${t.hostKey}\n${a.host} ${t.algorithm} ${t.hostKey}\n`,
        { mode: 0o600 },
      );
      const pub = keys.public.trim().split(/\s+/).slice(0, 2).join(" "),
        line = `restrict,port-forwarding,command="/bin/false",permitopen="127.0.0.1:${remote.port}",permitlisten="127.0.0.1:${remotePort}" ${pub} delta-link-${job.id}`;
      await runSSH(
        c,
        `umask 077; test ! -L "$HOME/.ssh" && test ! -L "$HOME/.ssh/authorized_keys" && mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh" && cat >> "$HOME/.ssh/authorized_keys" && chmod 600 "$HOME/.ssh/authorized_keys"`,
        "\n" + line + "\n",
      );
      keyAdded = true;
      await this.client.call("supervisor.add", {
        id: component,
        command: [
          readiness.ssh.path,
          ...tunnelArgs(a, dir, localPort, remotePort, remote.port, cfg.port),
        ],
        scopes: [],
      });
      managed = true;
      let ready = false;
      for (let i = 0; i < 40; i++) {
        try {
          const r = await fetch(`http://127.0.0.1:${localPort}/v1/health`, {
            signal: AbortSignal.timeout(1000),
          });
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await sleep(500);
      }
      if (!ready) fail("tunnel");
      // sshd GatewayPorts=yes can override a requested loopback bind. Never pair
      // until the server's actual listener is confirmed private.
      await runSSH(
        c,
        `python3 - ${remotePort} <<'PY'
import sys
port=int(sys.argv[1]); found=False
for path in ['/proc/net/tcp','/proc/net/tcp6']:
 try:
  lines=open(path).readlines()[1:]
 except FileNotFoundError:
  continue
 for line in lines:
  cols=line.split(); addr,p=cols[1].split(':')
  if cols[3]=='0A' and int(p,16)==port:
   assert addr in ('0100007F','00000000000000000000000001000000'), 'SSH reverse listener is not private'
   found=True
assert found, 'SSH reverse listener not found'
PY`,
      ).catch(() => fail("tunnel"));

      await save({ phase: "pairing", peerId: remote.nodeId });
      const inv = await this.client.call("peers.invite", {
        trust_admin: a.trust === "mutual",
      });
      pairingAttempted = true;
      peerId = remote.nodeId;
      await remoteRPC(c, remote, "peers.join", {
        url: `http://127.0.0.1:${remotePort}`,
        code: inv.code,
        trust_admin: a.trust !== "calls",
        local_url: `http://127.0.0.1:${localPort}`,
      });
      peerId = remote.nodeId;
      await this.client.call("system.ping", {}, peerId);
      // node is an envelope field, not an argument: verify the reverse routed call.
      const reverse = JSON.parse(
        await runSSH(
          c,
          `if [ "$(id -u)" = 0 ]; then runuser -u ${quote(remote.user)} -- env HOME=${quote(remote.home)} ${quote(remote.home + "/.delta/bin/delta")} call system.ping --node ${quote(local.node_id)}; else env HOME=${quote(remote.home)} ${quote(remote.home + "/.delta/bin/delta")} call system.ping --node ${quote(local.node_id)}; fi`,
        ),
      );
      if (reverse.node !== local.name) fail("pairing");
      await save({ peerId, phase: "verifying" });
      const peers = await this.client.call("peers.list");
      if (
        peers.find((p) => p.node_id === peerId)?.trusted_admin !==
        (a.trust === "mutual")
      )
        fail("pairing");
      await atomic(join(dir, "connection.json"), {
        id: job.id,
        peerId,
        component,
        host: a.host,
        port: a.port,
        username: a.username,
        trust: a.trust,
        fingerprint: t.fingerprint,
      });
    } catch (e) {
      if (pairingAttempted && remote && c) {
        await remoteRPC(c, remote, "peers.remove", {
          node: (await this.client.call("core.info")).node_id,
        }).catch(() => {});
      }
      if (peerId)
        await this.client
          .call("peers.remove", { node: peerId })
          .catch(() => {});
      if (managed)
        await this.client
          .call("supervisor.remove", { id: component })
          .catch(() => {});
      if (keyAdded && c)
        await runSSH(
          c,
          `sed -i '/ delta-link-${job.id}$/d' "$HOME/.ssh/authorized_keys"`,
        ).catch(() => {});
      await rm(dir, { recursive: true, force: true });
      throw e;
    } finally {
      c?.end();
    }
  }
  async connections() {
    const out = [];
    for (const e of await readdir(this.dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      try {
        const d = JSON.parse(
          await readFile(join(this.dir, e.name, "connection.json"), "utf8"),
        );
        out.push({
          peerId: d.peerId,
          host: d.host,
          port: d.port,
          fingerprint: d.fingerprint,
          component: d.component,
        });
      } catch {}
    }
    return out;
  }
  async remove(peerId) {
    for (const entry of await readdir(this.dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join(this.dir, entry.name);
      try {
        const link = JSON.parse(
          await readFile(join(dir, "connection.json"), "utf8"),
        );
        if (link.peerId !== peerId) continue;
        await this.client.call("supervisor.remove", { id: link.component });
        await rm(dir, { recursive: true, force: true });
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
}
export function sshHandlers(service) {
  const wrap =
    (fn) =>
    async (a = {}, c) => {
      const locale = a._locale === "ru" ? 1 : 0;
      if (!c?.scopes?.includes("admin") || c.kind === "peer")
        throw new DeltaError("forbidden", messages.owner[locale]);
      try {
        return await fn(a);
      } catch (e) {
        throw new DeltaError(
          e.code === "busy" ? "conflict" : "bad_request",
          (messages[e.code] || messages.ssh_failed)[locale],
        );
      }
    };
  return {
    "web.nodes_ssh_preflight": wrap(() => service.preflight()),
    "web.nodes_ssh_probe": wrap((a) => service.inspect(a)),
    "web.nodes_ssh_install": wrap((a) => service.start(a)),
    "web.nodes_ssh_status": wrap((a) => service.status(a.id)),
  };
}
