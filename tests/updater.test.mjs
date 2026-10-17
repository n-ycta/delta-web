import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Updater,
  UpdateError,
  compareVersions,
  parseSettings,
  officialDownload,
  unpackCore,
} from 'delta-updater/server/updater.mjs';
import { updateHandlers } from 'delta-updater/server/update-service.mjs';
const settings = {
  automaticCheck: true,
  intervalMinutes: 60,
  notify: true,
  autoInstall: false,
  autoCore: true,
  autoPlugins: true,
};
test('stable semantic versions never treat 0.10 as older than 0.9, reject pre-release/invalid versions; auto install requires check consent', () => {
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('0.3.4', '0.3.4'), 0);
  assert.throws(() => compareVersions('0.3.5-beta.1', '0.3.4'));
  assert.throws(() => parseSettings({ autoInstall: true, automaticCheck: false }));
  assert.throws(() => parseSettings({ intervalMinutes: 1 }));
  assert.throws(() => parseSettings({ command: 'rm' }));
  assert.equal(parseSettings({ autoInstall: true }).autoInstall, true);
  assert.equal(parseSettings({ autoCore: true }).autoRemote, false);
  assert.equal(parseSettings({ autoRemote: true }).autoRemote, true);
});
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'delta-updates-'));
  await mkdir(join(home, 'bin'));
  await writeFile(
    join(home, 'bin', process.platform === 'win32' ? 'delta.exe' : 'delta'),
    'fixture',
  );
  let core = '0.3.3';
  const installed = new Map([
    ['storage', '0.3.1'],
    ['typing', '0.4.3'],
    ['web', '0.3.4'],
  ]);
  const entries = [
    ['storage', 'dev.delta.db', '0.4.0'],
    ['typing', 'dev.delta.type', '0.4.3'],
    ['web', 'dev.delta.web', '0.4.0'],
  ].map(([component, id, version]) => ({
    component,
    id,
    version,
    sha256: 'a'.repeat(64),
    manifest: { name: id },
  }));
  const calls = [];
  const call = async (cap, args) => {
    calls.push([cap, args]);
    if (cap === 'core.info') return { version: core, node_id: 'node' };
    if (cap === 'core.components')
      return [...installed]
        .filter(([c]) => c !== 'typing')
        .map(([id, version]) => ({ id, version }));
    if (cap === 'supervisor.list')
      return [...installed].map(([id]) => ({
        id,
        enabled: id !== 'typing',
        command: ['node', join(home, 'plugins', id, 'launch.mjs')],
      }));
    if (cap === 'packages.catalog') return { plugins: entries };
    if (cap === 'packages.install') {
      assert.equal(args.expectedVersion, entries.find((e) => e.id === args.id).version);
      assert.equal(args.expectedSha256, 'a'.repeat(64));
      return { jobId: args.id };
    }
    if (cap === 'packages.jobs')
      return entries.map((e) => ({ id: e.id, status: 'complete', result: { version: e.version } }));
    throw Error(cap);
  };
  for (const [id, version] of installed) {
    await mkdir(join(home, 'plugins', id), { recursive: true });
    await writeFile(
      join(home, 'plugins', id, 'manifest.json'),
      JSON.stringify({
        version,
        metadata: { ui: { id: entries.find((e) => e.component === id).id } },
      }),
    );
  }
  const download = async () =>
    Buffer.from(
      JSON.stringify({
        tag_name: 'v0.3.4',
        assets: [
          {
            name:
              'delta-' +
              (process.platform === 'win32' ? 'windows-x64' : 'linux-' + process.arch) +
              '.tar.gz',
            browser_download_url: 'official',
          },
        ],
      }),
    );
  const u = await new Updater(home, {
    call,
    download,
    launch: async () => {},
    coreInstall: async () => {
      core = '0.3.4';
    },
  }).init();
  return {
    home,
    u,
    calls,
    entries,
    installed,
    cleanup: () => rm(home, { recursive: true, force: true }),
  };
}
test('checks only installed plugins including disabled, no downgrades, notification dedupe/read and settings persist', async () => {
  const f = await fixture();
  try {
    await f.u.performCheck();
    const s = await f.u.status();
    assert.equal(s.settings.autoInstall, false);
    assert.equal(s.items.length, 4);
    assert.equal(s.items.find((i) => i.component === 'typing').enabled, false);
    assert.equal(s.items.find((i) => i.component === 'typing').available, false);
    const notes = await f.u.notes('ru');
    assert.equal(notes.length, 1);
    assert.match(notes[0].title, /Доступны/);
    await f.u.mark([notes[0].id], true);
    await f.u.performCheck();
    assert.equal((await f.u.notes())[0].read, true);
    f.entries[0].version = '0.4.1';
    await f.u.performCheck();
    assert.equal((await f.u.notes())[0].read, false);
    await f.u.settings({ ...settings, notify: false });
    assert.equal((await f.u.notes()).length, 0);
    assert.equal((await new Updater(f.home).settings()).notify, false);
  } finally {
    await f.cleanup();
  }
});
test('update owner boundary rejects scoped users before privileged service operations', async () => {
  let touched = false;
  const h = updateHandlers({
    status: () => {
      touched = true;
    },
  });
  await assert.rejects(
    h['updater.status']({ _locale: 'ru' }, { scopes: ['call:updater.status'] }),
    (e) => e.code === 'forbidden' && /владелец/.test(e.message),
  );
  assert.equal(touched, false);
});
test('single job orders core → ordinary plugins → Web and pins package versions/checksums', async () => {
  const f = await fixture();
  try {
    await f.u.apply();
    await assert.rejects(f.u.apply(), (e) => e.code === 'busy');
    const queued = (await f.u.status()).job;
    assert.deepEqual(
      queued.items.map((i) => i.kind),
      ['core', 'plugin', 'web'],
    );
    const result = await f.u.runJob(queued.id);
    assert.equal(result.status, 'complete');
    assert.equal(f.calls.filter(([cap]) => cap === 'packages.install').length, 2);
    assert.equal((await f.u.status()).job.status, 'complete');
  } finally {
    await f.cleanup();
  }
});
test('plugin-only update on old core is blocked, and corrupt/unsafe archive or untrusted URL never executes', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.u.apply('dev.delta.db'), (e) => e.code === 'core_first');
    assert.throws(() => unpackCore(Buffer.from('invalid')));
    await assert.rejects(
      officialDownload('https://evil.invalid/release'),
      (e) => e.code === 'untrusted_release',
    );
    await assert.rejects(
      officialDownload('http://github.com/n-ycta/delta'),
      (e) => e.code === 'untrusted_release',
    );
    const redirect = async () =>
      new Response(null, { status: 302, headers: { location: 'https://evil.invalid/archive' } });
    await assert.rejects(
      officialDownload('https://github.com/n-ycta/delta', 100, redirect),
      (e) => e.code === 'untrusted_release',
    );
  } finally {
    await f.cleanup();
  }
});
test('failed component stops the sequence and terminalizes the Web update as skipped', async () => {
  const f = await fixture();
  try {
    const original = f.u.call;
    f.u.call = async (cap, args) =>
      cap === 'packages.install'
        ? Promise.reject(new UpdateError('plugin_failed'))
        : original(cap, args);
    await f.u.apply();
    const q = (await f.u.status()).job;
    const result = await f.u.runJob(q.id);
    assert.equal(result.status, 'failed');
    assert.equal(result.items.at(-1).status, 'skipped');
    assert.equal(result.items[1].status, 'failed');
  } finally {
    await f.cleanup();
  }
});
test('background checks run without a browser, default never installs; explicit auto-update respects categories and retry cooldown', async () => {
  const f = await fixture();
  try {
    await f.u.tick();
    assert((await f.u.status()).lastCheckedAt);
    assert.equal((await f.u.status()).job, undefined);
    let applied = 0;
    f.u.apply = async (target, automatic) => {
      assert.equal(automatic, true);
      applied++;
    };
    await f.u.settings({ autoInstall: true });
    await writeFile(join(f.u.dir, 'check.json'), JSON.stringify({ items: [], lastAttemptAt: 0 }));
    await f.u.tick();
    assert.equal(applied, 1);
    await writeFile(join(f.u.dir, 'check.json'), JSON.stringify({ items: [], lastAttemptAt: 0 }));
    await writeFile(
      join(f.u.dir, 'job.json'),
      JSON.stringify({ id: 'failed', status: 'failed', finishedAt: Date.now() }),
    );
    await f.u.tick();
    assert.equal(applied, 1);
    await f.u.settings({ automaticCheck: false, autoInstall: false });
    await writeFile(join(f.u.dir, 'check.json'), JSON.stringify({ items: [], lastAttemptAt: 0 }));
    await f.u.tick();
    assert.equal((await f.u.status()).lastAttemptAt, 0);
  } finally {
    await f.cleanup();
  }
});
test('source-only cores cannot be overwritten; automatic category selection never silently updates the core', async () => {
  const f = await fixture();
  try {
    await rm(join(f.home, 'bin', process.platform === 'win32' ? 'delta.exe' : 'delta'));
    await f.u.performCheck();
    assert.equal((await f.u.status()).items[0].blocked, 'managed_install_required');
    await assert.rejects(f.u.apply(), (e) => e.code === 'managed_install_required');
    await writeFile(
      join(f.home, 'bin', process.platform === 'win32' ? 'delta.exe' : 'delta'),
      'fixture',
    );
    await f.u.settings({ autoInstall: true, autoCore: false });
    await assert.rejects(f.u.apply('all', true), (e) => e.code === 'core_first');
  } finally {
    await f.cleanup();
  }
});
test('generic per-node inventory includes arbitrary plugins, disabled unknown versions and offline cached rows; routes jobs to the selected node', async () => {
  const f = await fixture();
  try {
    const local = f.u.call,
      calls = [];
    let offline = false;
    const entry = {
      component: 'leads',
      id: 'dev.delta.leads',
      version: '0.1.3',
      sha256: 'b'.repeat(64),
      repository: 'https://github.com/n-ycta/delta-leads',
      manifest: { name: 'Leads' },
    };
    f.u.call = async (cap, args, node) => {
      calls.push({ cap, args, node });
      if (!node && cap === 'peers.list') return [{ node_id: 'vps', name: 'VPS', online: !offline }];
      if (node === 'vps') {
        if (offline) throw new UpdateError('core_unavailable');
        if (cap === 'core.info') return { node_id: 'vps', version: '0.4.1' };
        if (cap === 'core.components')
          return [
            {
              id: 'leads',
              version: '0.1.2',
              metadata: { ui: { id: 'dev.delta.leads', name: 'Leads' } },
            },
          ];
        if (cap === 'supervisor.list')
          return [
            { id: 'leads', enabled: true },
            { id: 'arbitrary', enabled: false },
            { id: 'ssh-fixture', enabled: true },
          ];
        if (cap === 'packages.catalog')
          return {
            plugins: [entry, { ...entry, component: 'arbitrary', id: 'dev.example.arbitrary' }],
          };
        if (cap === 'packages.install') return { jobId: 'remote-job' };
        if (cap === 'packages.jobs')
          return [{ id: 'remote-job', status: 'complete', result: { version: '0.1.3' } }];
        throw Error(cap);
      }
      return local(cap, args, node);
    };
    const check = await f.u.performCheck(),
      lead = check.items.find((i) => i.id === entry.id);
    assert.equal(lead.nodeId, 'vps');
    assert(!check.items.some((i) => i.component === 'ssh-fixture'));
    assert.equal(lead.release, 'https://github.com/n-ycta/delta-leads/releases/tag/v0.1.3');
    assert.equal(check.items.find((i) => i.component === 'arbitrary').blocked, 'version_unknown');
    assert.equal(
      check.items.find((i) => i.nodeId === 'vps' && i.kind === 'core').blocked,
      undefined,
    );
    await f.u.apply(lead.target);
    const job = (await f.u.status()).job;
    assert.equal((await f.u.runJob(job.id)).status, 'complete');
    assert(calls.filter((c) => c.cap === 'packages.install').every((c) => c.node === 'vps'));
    offline = true;
    const stale = await f.u.performCheck();
    assert.equal(stale.items.find((i) => i.id === entry.id).blocked, 'node_offline');
    assert(stale.issues.some((i) => i.nodeId === 'vps' && i.code === 'node_offline'));
  } finally {
    await f.cleanup();
  }
});
test('connected service root is discovered separately from the local profile; duplicate plugin IDs need a node target', async () => {
  const f = await fixture();
  try {
    const serviceCalls = [];
    f.u.connectedCall = async (cap, args, node) => {
      serviceCalls.push({ cap, args, node });
      if (cap === 'core.info') return { node_id: 'connected-vps', version: '0.4.1' };
      if (cap === 'peers.list') return [];
      if (cap === 'core.components')
        return [
          {
            id: 'storage',
            version: '0.3.1',
            metadata: { ui: { id: 'dev.delta.db', name: 'Storage' } },
          },
        ];
      if (cap === 'supervisor.list') return [{ id: 'storage', enabled: true }];
      if (cap === 'packages.catalog') return { plugins: f.entries };
      if (cap === 'packages.jobs') return [];
      throw Error(cap);
    };
    const checked = await f.u.performCheck(),
      copies = checked.items.filter((i) => i.id === 'dev.delta.db');
    assert.equal(copies.length, 2);
    assert.notEqual(copies[0].target, copies[1].target);
    await assert.rejects(f.u.apply('dev.delta.db'), (e) => e.code === 'invalid_target');
    const remote = copies.find((i) => i.nodeId === 'connected-vps');
    await f.u.apply(remote.target);
    const job = (await f.u.status()).job;
    assert.equal(job.items[0].routing, 'connected');
    assert.equal(job.items[0].targetNode, undefined);
    assert(serviceCalls.some((c) => c.cap === 'packages.jobs' && !c.node));
    assert(!JSON.stringify(job).includes('Bearer'));
  } finally {
    await f.cleanup();
  }
});
