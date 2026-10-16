// Official-release update service. No shell commands, caller URLs, or credentials in job files/argv.
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  copyFile,
  chmod,
  realpath,
  readdir,
  readlink,
  unlink,
  open,
  stat,
} from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { homedir, platform, arch } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const defaults = {
  automaticCheck: true,
  intervalMinutes: 60,
  notify: true,
  autoInstall: false,
  autoCore: true,
  autoPlugins: true,
};
export class UpdateError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const read = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return structuredClone(fallback);
    throw e;
  }
};
async function privateDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (platform() === 'win32') {
    const { stdout } = await exec('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
      windowsHide: true,
    });
    const sid = stdout.match(/S-1-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new UpdateError('permissions');
    await exec(
      'icacls.exe',
      [dir, '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'],
      { windowsHide: true },
    );
  } else await chmod(dir, 0o700);
}
async function atomic(file, value) {
  await privateDir(dirname(file));
  const tmp = file + '.' + randomUUID();
  await writeFile(tmp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  await rename(tmp, file);
}
export function compareVersions(a, b) {
  const parse = (v) => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v)?.slice(1).map(Number);
  const A = parse(a),
    B = parse(b);
  if (!A || !B) throw new UpdateError('invalid_release');
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return Math.sign(A[i] - B[i]);
  return 0;
}
export function parseSettings(values, current = defaults) {
  const next = { ...current, ...values };
  if (
    Object.keys(values).some((k) => !Object.hasOwn(defaults, k)) ||
    Object.entries(next).some(([k, v]) =>
      k === 'intervalMinutes' ? !Number.isInteger(v) || v < 15 || v > 1440 : typeof v !== 'boolean',
    ) ||
    (next.autoInstall && !next.automaticCheck)
  )
    throw new UpdateError('invalid_settings');
  return next;
}
export async function officialDownload(url, limit = 2000000, fetcher = fetch) {
  let u = new URL(url);
  const hosts = [
    'github.com',
    'api.github.com',
    'raw.githubusercontent.com',
    'release-assets.githubusercontent.com',
    'objects.githubusercontent.com',
  ];
  for (let i = 0; i < 6; i++) {
    if (u.protocol !== 'https:' || !hosts.includes(u.hostname) || u.username || u.password)
      throw new UpdateError('untrusted_release');
    const r = await fetcher(u, {
      headers: { 'user-agent': 'Delta-updater/0.4', accept: 'application/vnd.github+json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      u = new URL(r.headers.get('location'), u);
      continue;
    }
    if (!r.ok)
      throw new UpdateError(
        r.status === 403 || r.status === 429 ? 'rate_limit' : 'download_failed',
      );
    let size = 0,
      parts = [];
    for await (const part of r.body) {
      size += part.length;
      if (size > limit) throw new UpdateError('archive_size');
      parts.push(part);
    }
    return Buffer.concat(parts);
  }
  throw new UpdateError('untrusted_release');
}
export function unpackCore(body) {
  const tar = gunzipSync(body, { maxOutputLength: 150000000 }),
    files = new Map();
  for (let pos = 0; pos + 512 <= tar.length; ) {
    const h = tar.subarray(pos, pos + 512);
    if (h.every((n) => n === 0)) break;
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
    const expected = parseInt(h.subarray(148, 156).toString().replace(/\0/g, '').trim(), 8);
    if (sum !== expected) throw new UpdateError('invalid_archive');
    const prefix = h.subarray(345, 500).toString().split('\0')[0];
    const name = (
      (prefix ? prefix + '/' : '') + h.subarray(0, 100).toString().split('\0')[0]
    ).replace(/^(\.\/)+/, '');
    const type = String.fromCharCode(h[156] || 48),
      size = parseInt(h.subarray(124, 136).toString().replace(/\0/g, '').trim() || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0 || pos + 512 + size > tar.length)
      throw new UpdateError('invalid_archive');
    if (name.split('/').includes('..') || name.includes('\\') || name.startsWith('/'))
      throw new UpdateError('invalid_archive');
    if (!['0', '5', 'x', 'g'].includes(type)) throw new UpdateError('invalid_archive');
    if (type === '0') {
      if (
        !['delta', 'delta.exe', 'bootstrap.mjs', 'upgrade.mjs', 'LICENSE', 'NOTICE'].includes(
          name,
        ) ||
        files.has(name)
      )
        throw new UpdateError('invalid_archive');
      files.set(name, tar.subarray(pos + 512, pos + 512 + size));
    }
    pos += 512 + Math.ceil(size / 512) * 512;
  }
  if (!files.has(platform() === 'win32' ? 'delta.exe' : 'delta'))
    throw new UpdateError('invalid_archive');
  return files;
}
export function errorCode(e) {
  return e instanceof UpdateError ? e.code : 'operation_failed';
}
export class Updater {
  constructor(
    home,
    {
      call,
      connectedCall,
      download = officialDownload,
      launch,
      coreInstall,
      healthAttempts = 90,
    } = {},
  ) {
    this.healthAttempts = healthAttempts;
    this.home = resolve(home);
    this.dir = join(this.home, 'data', 'updates');
    this.call = call || this.rpc.bind(this);
    this.connectedCall =
      connectedCall ||
      (!call && process.env.DELTA_URL && process.env.DELTA_TOKEN
        ? this.serviceRpc.bind(this)
        : null);
    this.download = download;
    this.launch = launch || this.launchWorker.bind(this);
    this.coreInstall = coreInstall || this.installCore.bind(this);
    this.checking = null;
    this.timer = null;
  }
  async init() {
    await privateDir(this.dir);
    return this;
  }
  async rpc(capability, args = {}, node) {
    const cfg = await read(join(this.home, 'config.json'), null),
      token = (await readFile(join(this.home, 'admin.token'), 'utf8')).trim();
    const r = await fetch('http://127.0.0.1:' + cfg.port + '/v1/call', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ capability, args, ...(node ? { node } : {}) }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    if (!data.ok)
      throw new UpdateError(
        data.error?.code === 'conflict'
          ? 'another_install'
          : data.error?.code === 'forbidden'
            ? 'forbidden'
            : 'core_unavailable',
      );
    return data.result;
  }
  async settings(values) {
    const old = { ...defaults, ...(await read(join(this.dir, 'settings.json'), {})) };
    if (values === undefined) return old;
    const next = parseSettings(values, old);
    await atomic(join(this.dir, 'settings.json'), next);
    return next;
  }
  async status() {
    const job = await read(join(this.dir, 'job.json'), null);
    if (job && ['queued', 'running'].includes(job.status) && Date.now() - job.updatedAt > 30000) {
      let alive = false;
      try {
        const lock = await read(join(this.dir, 'lock.json'), {});
        process.kill(lock.pid, 0);
        alive = true;
      } catch {}
      if (!alive) {
        job.status = 'failed';
        job.error = 'interrupted';
        job.finishedAt = Date.now();
        await atomic(join(this.dir, 'job.json'), job);
      }
    }
    return {
      settings: await this.settings(),
      ...(await read(join(this.dir, 'check.json'), { items: [], lastCheckedAt: null })),
      checking: !!this.checking,
      job: job || undefined,
    };
  }
  async check() {
    if (this.checking) return this.status();
    this.checking = this.performCheck()
      .catch(async (e) => {
        const old = await read(join(this.dir, 'check.json'), { items: [] });
        await atomic(join(this.dir, 'check.json'), {
          ...old,
          lastAttemptAt: Date.now(),
          error: errorCode(e),
        });
      })
      .finally(() => {
        this.checking = null;
      });
    return this.status();
  }
  async serviceRpc(capability, args = {}, node) {
    const url = (process.env.DELTA_URL || '').replace(/\/$/, '').replace(/\/v1$/, '');
    if (!url || !process.env.DELTA_TOKEN) throw new UpdateError('core_unavailable');
    const r = await fetch(url + '/v1/call', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + process.env.DELTA_TOKEN,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ capability, args, ...(node ? { node } : {}) }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    if (!r.ok || !data.ok)
      throw new UpdateError(
        data.error?.code === 'forbidden'
          ? 'forbidden'
          : data.error?.code === 'conflict'
            ? 'another_install'
            : 'core_unavailable',
      );
    return data.result;
  }
  route(item, cap, args = {}) {
    const call = item.routing === 'connected' ? this.connectedCall : this.call;
    if (!call) throw new UpdateError('core_unavailable');
    return call(cap, args, item.targetNode || undefined);
  }
  async performCheck() {
    const old = await read(join(this.dir, 'check.json'), {}),
      issues = [],
      roots = [],
      nodes = new Map();
    for (const [routing, call] of [
      ['profile', this.call],
      ['connected', this.connectedCall],
    ]) {
      if (!call) continue;
      try {
        const info = await call('core.info');
        const id = info.node_id || routing;
        if (nodes.has(id)) continue;
        const root = {
          nodeId: id,
          nodeName: info.name || info.node_name || id,
          routing,
          local: routing === 'profile',
          info,
          call,
        };
        nodes.set(id, root);
        roots.push(root);
      } catch (e) {
        issues.push({ nodeId: routing, code: errorCode(e) });
      }
    }
    // Direct connections take precedence over a peer route. Never add/change peer trust.
    for (const root of roots) {
      let peers = [];
      try {
        peers = await root.call('peers.list');
      } catch (e) {
        issues.push({ nodeId: root.nodeId, code: errorCode(e) });
      }
      for (const peer of peers) {
        if (!peer.node_id || nodes.has(peer.node_id)) continue;
        nodes.set(peer.node_id, {
          nodeId: peer.node_id,
          nodeName: peer.name || peer.node_id,
          routing: root.routing,
          targetNode: peer.node_id,
          local: false,
          offline: !peer.online,
          call: (cap, args = {}) => root.call(cap, args, peer.node_id),
        });
      }
    }
    if (!nodes.size) throw new UpdateError('core_unavailable');
    let release;
    try {
      release = JSON.parse(
        await this.download('https://api.github.com/repos/n-ycta/delta/releases/latest'),
      );
      if (release.draft || release.prerelease) throw new UpdateError('invalid_release');
      compareVersions(String(release.tag_name || '').replace(/^v/, ''), '0.0.0');
    } catch (e) {
      issues.push({ nodeId: 'releases', code: errorCode(e) });
    }
    const items = [];
    const remember = (node, code) => {
      issues.push({ nodeId: node.nodeId, code });
      for (const previous of old.items || [])
        if (previous.nodeId === node.nodeId)
          items.push({ ...previous, available: false, blocked: code, stale: true });
    };
    for (const node of nodes.values()) {
      if (node.offline) {
        remember(node, 'node_offline');
        continue;
      }
      let info = node.info;
      try {
        info ||= await node.call('core.info');
        if (info.node_id && info.node_id !== node.nodeId) throw new UpdateError('node_changed');
      } catch (e) {
        remember(node, errorCode(e));
        continue;
      }
      const meta = {
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        routing: node.routing,
        ...(node.targetNode ? { targetNode: node.targetNode } : {}),
        local: node.local,
        coreVersion: info.version,
      };
      const version = release ? String(release.tag_name).replace(/^v/, '') : undefined;
      const target =
        platform() === 'win32' && arch() === 'x64'
          ? 'windows-x64'
          : platform() === 'linux' && ['x64', 'arm64'].includes(arch())
            ? 'linux-' + arch()
            : null;
      const asset = release?.assets?.find((a) => a.name === 'delta-' + target + '.tar.gz');
      let managedCore = false;
      if (node.local)
        try {
          await realpath(join(this.home, 'bin', platform() === 'win32' ? 'delta.exe' : 'delta'));
          managedCore = true;
        } catch {}
      items.push({
        ...meta,
        id: 'core',
        target: node.nodeId + '::core',
        kind: 'core',
        name: 'Delta Core',
        installed: info.version,
        latest: version,
        available: !!version && compareVersions(version, info.version) > 0,
        enabled: true,
        ...(!node.local
          ? { blocked: 'remote_core' }
          : !target
            ? { blocked: 'unsupported_platform' }
            : !managedCore
              ? { blocked: 'managed_install_required' }
              : {}),
        ...(asset ? { asset: asset.browser_download_url } : {}),
        ...(version
          ? { release: 'https://github.com/n-ycta/delta/releases/tag/v' + version }
          : { blocked: 'release_unavailable' }),
      });
      const values = await Promise.allSettled(
        ['core.components', 'supervisor.list', 'packages.catalog'].map((cap) => node.call(cap)),
      );
      values.forEach((v) => {
        if (v.status === 'rejected')
          issues.push({ nodeId: node.nodeId, code: errorCode(v.reason) });
      });
      const components = values[0].status === 'fulfilled' ? values[0].value : [],
        managed = values[1].status === 'fulfilled' ? values[1].value : [],
        catalog = values[2].status === 'fulfilled' ? values[2].value : { plugins: [] };
      const ids = new Set([
        ...managed.map((c) => c.id),
        ...components.filter((c) => c.metadata?.ui).map((c) => c.id),
      ]);
      for (const component of ids) {
        const spec = managed.find((c) => c.id === component),
          registered = components.find((c) => c.id === component),
          entry = catalog.plugins?.find((c) => c.component === component);
        let manifest = registered?.metadata?.ui,
          installed = registered?.version;
        if (!installed && node.local && spec) {
          const launcher = spec.command?.find(
            (x) => typeof x === 'string' && x.endsWith('launch.mjs'),
          );
          if (launcher) {
            const path = resolve(dirname(launcher), 'manifest.json');
            const base = join(this.home, 'plugins');
            if (
              path.startsWith(base + '/') ||
              (platform() === 'win32' && path.toLowerCase().startsWith((base + '\\').toLowerCase()))
            ) {
              const m = await read(path, null);
              if (m?.metadata?.ui?.id === (entry?.id || manifest?.id)) {
                installed = m.version;
                manifest ||= m.metadata.ui;
              }
            }
          }
        }
        const id = entry?.id || manifest?.id || component;
        let newer = false,
          blocked;
        if (!spec) blocked = 'unmanaged_plugin';
        else if (values[1].status === 'rejected' || values[2].status === 'rejected')
          blocked = 'forbidden';
        else if (!entry) blocked = 'not_in_catalog';
        else if (!installed) blocked = 'version_unknown';
        if (entry && installed)
          try {
            newer = compareVersions(entry.version, installed) > 0;
          } catch {
            blocked = 'invalid_release';
          }
        if (entry && !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) blocked = 'invalid_release';
        if (!node.local && compareVersions(info.version, '0.3.4') < 0) blocked = 'core_first';
        let releaseUrl;
        try {
          const repo = new URL(
            entry?.repository || entry?.manifest?.repository || manifest?.repository,
          );
          if (
            repo.protocol === 'https:' &&
            repo.hostname === 'github.com' &&
            !repo.username &&
            !repo.password &&
            /^\/[^/]+\/[^/]+\/?$/.test(repo.pathname) &&
            entry?.version
          )
            releaseUrl =
              repo.origin +
              repo.pathname.replace(/\/$/, '').replace(/\.git$/, '') +
              '/releases/tag/v' +
              entry.version;
        } catch {}
        items.push({
          ...meta,
          id,
          target: node.nodeId + '::' + id,
          component,
          kind: component === 'web' ? 'web' : 'plugin',
          name: manifest?.name || entry?.manifest?.name || id,
          installed,
          latest: entry?.version,
          available: newer,
          enabled: spec ? spec.enabled !== false : true,
          sha256: entry?.sha256,
          ...(blocked ? { blocked } : {}),
          ...(releaseUrl ? { release: releaseUrl } : {}),
        });
      }
    }
    const signature = createHash('sha256')
      .update(JSON.stringify(items.filter((i) => i.available).map((i) => [i.target, i.latest])))
      .digest('hex');
    const result = {
      items,
      issues,
      lastCheckedAt: Date.now(),
      lastAttemptAt: Date.now(),
      signature,
      noticedAt: signature === old.signature ? old.noticedAt || Date.now() : Date.now(),
    };
    await atomic(join(this.dir, 'check.json'), result);
    return result;
  }

  async notes(locale = 'en') {
    const s = await this.status();
    if (!s.settings.notify) return [];
    const seen = await read(join(this.dir, 'read-notices.json'), {});
    const items = s.items.filter((i) => i.available);
    const notes = [];
    if (items.length) {
      const id = 'updates.available.' + s.signature;
      notes.push({
        id,
        ts: s.noticedAt,
        severity: 'info',
        title: locale === 'ru' ? 'Доступны обновления' : 'Updates available',
        body: items.map((i) => i.name + ': ' + i.installed + ' → ' + i.latest).join('; '),
        read: !!seen[id],
        link: '/settings?tab=updates',
      });
    }
    if (s.job && ['complete', 'failed', 'rolled_back'].includes(s.job.status)) {
      const id = 'updates.job.' + s.job.id;
      notes.push({
        id,
        ts: s.job.finishedAt || s.job.updatedAt,
        severity: s.job.status === 'complete' ? 'info' : 'warn',
        title:
          locale === 'ru'
            ? s.job.status === 'complete'
              ? 'Обновление завершено'
              : s.job.status === 'rolled_back'
                ? 'Обновление отменено, прежнее ядро восстановлено'
                : 'Не удалось завершить обновление'
            : s.job.status === 'complete'
              ? 'Update complete'
              : 'Update needs attention',
        read: !!seen[id],
        link: '/settings?tab=updates',
      });
    }
    return notes;
  }
  async mark(ids, readValue) {
    const seen = await read(join(this.dir, 'read-notices.json'), {});
    const notes = await this.notes();
    for (const n of notes) if (ids === 'all' || ids.includes(n.id)) seen[n.id] = readValue;
    await atomic(
      join(this.dir, 'read-notices.json'),
      Object.fromEntries(Object.entries(seen).slice(-100)),
    );
  }
  async acquire() {
    const file = join(this.dir, 'lock.json');
    let fd;
    try {
      fd = await open(file, 'wx', 0o600);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const prior = await read(file, {});
      let alive = false;
      try {
        process.kill(prior.pid, 0);
        alive = true;
      } catch {}
      if (alive) throw new UpdateError('busy');
      await unlink(file);
      fd = await open(file, 'wx', 0o600);
    }
    await fd.writeFile(JSON.stringify({ pid: process.pid }));
    await fd.close();
  }
  async apply(target = 'all', automatic = false) {
    if (typeof target !== 'string' || target.length > 256) throw new UpdateError('invalid_target');
    await this.acquire();
    try {
      const checked = await this.performCheck(),
        settings = await this.settings();
      const matches = checked.items.filter((i) => i.target === target || i.id === target);
      if (target !== 'all' && matches.length !== 1) throw new UpdateError('invalid_target');
      if (target !== 'all' && matches[0].blocked) throw new UpdateError(matches[0].blocked);
      let items = (target === 'all' ? checked.items : matches).filter(
        (i) =>
          i.available &&
          (!automatic || (i.kind === 'core' ? settings.autoCore : settings.autoPlugins)),
      );
      // Remote/read-only rows never block an unrelated node update. Keep the local source-only guard explicit.
      if (
        items.some((i) => i.local && i.kind === 'core' && i.blocked === 'managed_install_required')
      )
        throw new UpdateError('managed_install_required');
      items = items.filter((i) => !i.blocked);
      if (!items.length) throw new UpdateError('nothing_to_update');
      for (const item of items) {
        if ((await this.route(item, 'packages.jobs')).some((j) => j.status === 'installing'))
          throw new UpdateError('another_install');
        if (
          item.kind !== 'core' &&
          compareVersions(item.coreVersion, '0.3.4') < 0 &&
          !items.some((i) => i.kind === 'core' && i.nodeId === item.nodeId)
        )
          throw new UpdateError('core_first');
      }
      const rank = (i) => (i.kind === 'core' ? 0 : i.kind === 'web' ? (i.local ? 3 : 2) : 1);
      items.sort((a, b) => rank(a) - rank(b));
      const id = randomUUID(),
        job = {
          id,
          status: 'queued',
          items: items.map((i) => ({ ...i, status: 'pending' })),
          automatic,
          startedAt: Date.now(),
          updatedAt: Date.now(),
        };
      await atomic(join(this.dir, 'job.json'), job);
      const worker = join(this.dir, 'worker-' + id + '.mjs');
      await copyFile(fileURLToPath(import.meta.url), worker);
      await this.launch(worker, id);
      return { accepted: true, jobId: id };
    } catch (e) {
      await unlink(join(this.dir, 'lock.json')).catch(() => {});
      throw e;
    }
  }

  async launchWorker(worker, id) {
    const args = [worker, 'run-job', this.home, id];
    const binary = join(this.home, 'bin', platform() === 'win32' ? 'delta.exe' : 'delta');
    let service = false;
    if (platform() === 'linux') {
      try {
        const { stdout } = await exec('systemctl', [
          '--user',
          'show',
          'delta.service',
          '--property=MainPID',
          '--value',
        ]);
        const pid = Number(stdout.trim());
        if (pid > 0) {
          const exe = (await readlink('/proc/' + pid + '/exe')).replace(/ \(deleted\)$/, '');
          service = (await realpath(binary)) === exe;
        }
      } catch {}
    }
    if (service) {
      try {
        await exec(
          'systemd-run',
          [
            '--user',
            '--quiet',
            '--collect',
            '--unit=delta-update-' + id,
            ...['DELTA_URL', 'DELTA_TOKEN']
              .filter((k) => process.env[k])
              .map((k) => '--setenv=' + k),
            process.execPath,
            ...args,
          ],
          { timeout: 15000 },
        );
        await this.workerStarted(id);
        return;
      } catch {
        throw new UpdateError('independent_worker');
      }
    }
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, DELTA_HOME: this.home },
    });
    await new Promise((yes, no) => {
      child.once('spawn', yes);
      child.once('error', no);
    });
    child.unref();
    await this.workerStarted(id);
  }
  async workerStarted(id) {
    for (let i = 0; i < 100; i++) {
      const job = await read(join(this.dir, 'job.json'), null),
        lock = await read(join(this.dir, 'lock.json'), {});
      if (
        job?.id === id &&
        (job.status !== 'queued' || (lock.id === id && lock.pid !== process.pid))
      )
        return;
      await sleep(100);
    }
    const job = await read(join(this.dir, 'job.json'), null);
    if (job?.id === id) {
      job.status = 'failed';
      job.error = 'independent_worker';
      job.finishedAt = Date.now();
      job.updatedAt = Date.now();
      await atomic(join(this.dir, 'job.json'), job);
    }
    throw new UpdateError('independent_worker');
  }
  async runJob(id) {
    const job = await read(join(this.dir, 'job.json'), null);
    if (!job || job.id !== id || job.status !== 'queued') throw new UpdateError('invalid_job');
    await atomic(join(this.dir, 'lock.json'), { pid: process.pid, id });
    const save = async () => {
      job.updatedAt = Date.now();
      await atomic(join(this.dir, 'job.json'), job);
    };
    job.status = 'running';
    await save();
    try {
      for (const item of job.items) {
        item.status = 'installing';
        await save();
        if (item.nodeId) {
          const identity = await this.route(item, 'core.info');
          if (identity.node_id !== item.nodeId) throw new UpdateError('node_changed');
        }
        if (item.kind === 'core' && !item.local && item.nodeId)
          throw new UpdateError('remote_core');
        if (item.kind === 'core')
          await this.coreInstall(item, async (phase) => {
            item.phase = phase;
            await save();
          });
        else {
          const before = await this.route(item, 'core.info');
          if (compareVersions(before.version, '0.3.4') < 0) throw new UpdateError('core_first');
          const j = await this.route(item, 'packages.install', {
            id: item.id,
            expectedVersion: item.latest,
            expectedSha256: item.sha256,
          });
          let result;
          for (let i = 0; i < 600; i++) {
            await sleep(1000);
            const jobs = await this.route(item, 'packages.jobs'),
              current = jobs.find((x) => x.id === j.jobId);
            if (current?.status === 'failed') throw new UpdateError('plugin_failed');
            if (current?.status === 'complete') {
              result = current.result;
              break;
            }
            if (i % 5 === 0) await save();
          }
          if (result?.version !== item.latest) throw new UpdateError('plugin_timeout');
        }
        item.status = 'complete';
        item.finishedAt = Date.now();
        await save();
      }
      job.status = 'complete';
    } catch (e) {
      job.status = e.code === 'rolled_back' ? 'rolled_back' : 'failed';
      job.error = errorCode(e);
      const current = job.items.find((i) => i.status === 'installing');
      if (current) {
        current.status = 'failed';
        current.error = job.error;
      }
    } finally {
      job.finishedAt = Date.now();
      await save();
      await unlink(join(this.dir, 'lock.json')).catch(() => {});
      await this.performCheck().catch(() => {});
      await unlink(join(this.dir, 'worker-' + id + '.mjs')).catch(() => {});
    }
    return job;
  }
  async findCore(binary) {
    const expected = await realpath(binary);
    if (platform() === 'linux') {
      const found = [];
      for (const p of await readdir('/proc'))
        if (/^\d+$/.test(p)) {
          try {
            const exe = (await readlink('/proc/' + p + '/exe')).replace(/ \(deleted\)$/, '');
            if (exe !== expected) continue;
            const env = (await readFile('/proc/' + p + '/environ', 'utf8')).split('\0');
            const home = resolve(
              env.find((e) => e.startsWith('DELTA_HOME='))?.slice(11) || join(homedir(), '.delta'),
            );
            if (home !== this.home) continue;
            const args = (await readFile('/proc/' + p + '/cmdline', 'utf8')).split('\0');
            if (!args.includes('run')) continue;
            found.push({
              pid: Number(p),
              stamp: (await readFile('/proc/' + p + '/stat', 'utf8'))
                .slice((await readFile('/proc/' + p + '/stat', 'utf8')).lastIndexOf(')') + 2)
                .split(' ')[19],
            });
          } catch {}
        }
      if (found.length !== 1) throw new UpdateError('identify_core');
      return found[0];
    }
    if (platform() === 'win32') {
      const { stdout } = await exec(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_Process -Filter "Name = \'delta.exe\'" | Select-Object ProcessId,ExecutablePath,CommandLine,CreationDate | ConvertTo-Json -Compress',
        ],
        { windowsHide: true },
      );
      const data = stdout.trim() ? JSON.parse(stdout) : [];
      const list = [];
      const binaryStat = await stat(expected);
      for (const p of Array.isArray(data) ? data : [data]) {
        if (!p.ExecutablePath || !/\brun\b/.test(p.CommandLine || '')) continue;
        try {
          const path = await realpath(p.ExecutablePath),
            candidate = await stat(path);
          if (
            path.toLowerCase() === expected.toLowerCase() ||
            (binaryStat.ino && candidate.ino === binaryStat.ino && candidate.dev === binaryStat.dev)
          )
            list.push(p);
        } catch {}
      }
      if (list.length !== 1) throw new UpdateError('identify_core');
      return { pid: list[0].ProcessId, stamp: list[0].CreationDate };
    }
    throw new UpdateError('unsupported_platform');
  }
  async stopCore(binary, identity, service) {
    const now = await this.findCore(binary);
    if (now.pid !== identity.pid || now.stamp !== identity.stamp)
      throw new UpdateError('identify_core');
    if (service) await exec('systemctl', ['--user', 'stop', 'delta.service'], { timeout: 30000 });
    else if (platform() === 'win32')
      await exec(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Stop-Process -Id ' + identity.pid + ' -ErrorAction Stop',
        ],
        { windowsHide: true },
      );
    else process.kill(identity.pid, 'SIGTERM');
    for (let i = 0; i < 150; i++) {
      try {
        process.kill(identity.pid, 0);
        if (platform() === 'linux') {
          const state = await readFile('/proc/' + identity.pid + '/stat', 'utf8');
          if (state.slice(state.lastIndexOf(')') + 2).startsWith('Z ')) return;
        }
      } catch {
        return;
      }
      await sleep(200);
    }
    throw new UpdateError('stop_timeout');
  }
  async startCore(binary, service) {
    if (service) {
      await exec('systemctl', ['--user', 'start', 'delta.service'], { timeout: 30000 });
      return;
    }
    const fd = await open(join(this.home, 'node.log'), 'a', 0o600);
    const child = spawn(binary, ['run'], {
      detached: true,
      stdio: ['ignore', fd.fd, fd.fd],
      windowsHide: true,
      env: { ...process.env, DELTA_HOME: this.home },
    });
    await new Promise((yes, no) => {
      child.once('spawn', yes);
      child.once('error', no);
    });
    child.unref();
    await fd.close();
  }
  async waitCore(version, nodeId) {
    for (let i = 0; i < this.healthAttempts; i++) {
      try {
        const info = await this.call('core.info');
        if (info.version === version && info.node_id === nodeId) return;
      } catch {}
      await sleep(1000);
    }
    throw new UpdateError('core_health');
  }
  async installCore(item, progress) {
    const latest = item.latest;
    if (!/^\d+\.\d+\.\d+$/.test(latest)) throw new UpdateError('invalid_release');
    const target = platform() === 'win32' ? 'windows-x64' : 'linux-' + arch(),
      base = 'https://github.com/n-ycta/delta/releases/download/v' + latest + '/';
    const asset = 'delta-' + target + '.tar.gz';
    if (item.asset !== base + asset) throw new UpdateError('untrusted_release');
    const binary = join(this.home, 'bin', platform() === 'win32' ? 'delta.exe' : 'delta');
    const identity = await this.findCore(binary),
      old = await this.call('core.info');
    if (compareVersions(latest, old.version) <= 0) throw new UpdateError('nothing_to_update');
    await progress('downloading');
    const [body, sums] = await Promise.all([
      this.download(base + asset, 50000000),
      this.download(base + 'SHA256SUMS'),
    ]);
    const hash = createHash('sha256').update(body).digest('hex');
    if (
      !sums
        .toString()
        .split('\n')
        .some((l) => {
          const [h, n] = l.trim().split(/\s+/);
          return h === hash && n === asset;
        })
    )
      throw new UpdateError('checksum');
    const files = unpackCore(body);
    const stage = join(this.dir, 'core-' + randomUUID());
    await privateDir(stage);
    const executable = platform() === 'win32' ? 'delta.exe' : 'delta';
    for (const [name, data] of files) await writeFile(join(stage, name), data, { mode: 0o700 });
    const output = await exec(join(stage, executable), ['--version'], {
      timeout: 10000,
      windowsHide: true,
    });
    if (!output.stdout.trim().endsWith(' ' + latest)) throw new UpdateError('invalid_release');
    let service = false;
    try {
      const { stdout } = await exec('systemctl', [
        '--user',
        'show',
        'delta.service',
        '--property=MainPID',
        '--value',
      ]);
      service = Number(stdout.trim()) === identity.pid;
    } catch {}
    const prepared = binary + '.next-' + randomUUID();
    await copyFile(join(stage, executable), prepared);
    await chmod(prepared, 0o700);
    const backup = binary + '.backup-' + randomUUID();
    await copyFile(join(this.home, 'config.json'), join(stage, 'config.before.json'));
    await chmod(join(stage, 'config.before.json'), 0o600);
    const config = await read(join(this.home, 'config.json'), null);
    const previouslyEnabled = config.components.filter((c) => c.enabled !== false).map((c) => c.id);
    await progress('restarting');
    if (platform() === 'win32') {
      for (const id of previouslyEnabled) await this.call('supervisor.stop', { id });
    }
    await this.stopCore(binary, identity, service);
    if (platform() === 'win32') {
      const current = await read(join(this.home, 'config.json'), null);
      for (const c of current.components) if (previouslyEnabled.includes(c.id)) c.enabled = true;
      await atomic(join(this.home, 'config.json'), current);
    }
    let switched = false;
    try {
      await rename(binary, backup);
      try {
        await rename(prepared, binary);
        switched = true;
      } catch (e) {
        await rename(backup, binary);
        throw e;
      }
      await this.startCore(binary, service);
      await this.waitCore(latest, old.node_id);
      // Install bootstrap helpers only after health succeeds. Runtime, identity and plugin data are untouched.
      for (const name of ['bootstrap.mjs', 'upgrade.mjs'])
        if (files.has(name)) {
          const tmp = join(this.home, 'bin', name + '.next');
          await writeFile(tmp, files.get(name), { mode: 0o700 });
          await rename(tmp, join(this.home, 'bin', name));
        }
      await writeFile(join(this.home, 'bin', 'release-version'), 'v' + latest + '\n', {
        mode: 0o600,
      });
      await progress('ready');
    } catch (e) {
      await progress('rolling_back');
      try {
        if (switched) {
          const current = await this.findCore(binary).catch(() => null);
          if (current) await this.stopCore(binary, current, service);
          await unlink(binary).catch(() => {});
          await rename(backup, binary);
        }
        await this.startCore(binary, service);
        await this.waitCore(old.version, old.node_id);
      } catch {
        throw new UpdateError('rollback_failed');
      }
      throw new UpdateError('rolled_back');
    }
  }
  async tick() {
    try {
      const settings = await this.settings(),
        state = await this.status();
      if (!settings.automaticCheck) return;
      const checkedAt = state.lastAttemptAt || 0;
      if (Date.now() - checkedAt < settings.intervalMinutes * 60000) return;
      await this.check();
      await this.checking;
      if (settings.autoInstall) {
        const status = await this.status();
        if (
          status.items.some((i) => i.available) &&
          (!['failed', 'rolled_back'].includes(status.job?.status) ||
            Date.now() - (status.job?.finishedAt || 0) > 3600000)
        )
          await this.apply('all', true);
      }
    } catch {}
  }
  start() {
    const tick = () => this.tick();
    const first = setTimeout(tick, 10000);
    first.unref();
    this.timer = setInterval(tick, 60000);
    this.timer.unref();
    return () => {
      clearTimeout(first);
      clearInterval(this.timer);
    };
  }
}
if (process.argv[2] === 'run-job' && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const updater = await new Updater(process.argv[3]).init();
  try {
    await updater.runJob(process.argv[4]);
  } catch {
    process.exitCode = 1;
  }
}
