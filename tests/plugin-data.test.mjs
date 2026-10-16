import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBridge } from '../server/bridge.mjs';
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'web-views-'));
  process.env.DATA_DIR = dir;
  t.after(() => rm(dir, { recursive: true, force: true }));
  let calls = [],
    documents = [];
  const ui = {
    id: 'dev.example.search',
    name: 'Search',
    settings: [],
    actions: [{ id: 'preview' }],
    views: [
      { id: 'items', capability: 'search.items' },
      { id: 'escape', capability: 'tokens.create' },
    ],
    endpoints: { notifications: 'search.notifications' },
  };
  const client = {
    call: async (name, args, node) => {
      calls.push({ name, args, node });
      if (name === 'search.items') return { rows: [{ id: 'a', title: 'Example' }], total: 1 };
      if (name === 'search.preview') return { verdict: args.text, node };
      if (name === 'search.notifications')
        return [
          {
            id: 'post',
            ts: 1000,
            severity: 'info',
            title: 'Found a buyer',
            link: 'javascript:alert(1)',
          },
        ];
      if (name === 'storage.document_list') return documents.map((value) => ({ value }));
      if (name === 'storage.document_put') {
        documents = documents.filter((d) => d.id !== args.value.id);
        documents.push(args.value);
        return {};
      }
      const values = {
        'core.info': { node_id: 'local' },
        'core.components': [{ id: 'search', version: '1', metadata: { ui } }],
        'supervisor.list': [{ id: 'search', enabled: true, running: true }],
        'packages.catalog': { plugins: [] },
        'packages.jobs': [],
        'peers.list': [],
      };
      assert(name in values, name);
      return values[name];
    },
    request: async () => [{ name: 'search.items', admin: true }],
  };
  return { h: createBridge(client), calls, ui, client };
}
const owner = { name: 'owner', scopes: ['admin'] };
test('generic views delegate only declared namespaced endpoints and preserve inputs', async (t) => {
  const { h, calls } = await fixture(t);
  const r = await h['web.plugins_query'](
    { id: 'dev.example.search', viewId: 'items', args: { offset: 0, limit: 25, search: 'buyer' } },
    owner,
  );
  assert.equal(r.total, 1);
  assert.deepEqual(calls.find((c) => c.name === 'search.items').args, {
    offset: 0,
    limit: 25,
    search: 'buyer',
    _locale: 'en',
  });
  await assert.rejects(
    h['web.plugins_query']({ id: 'dev.example.search', viewId: 'escape' }, owner),
    (e) => e.code === 'bad_request',
  );
  await assert.rejects(
    h['web.plugins_query']({ id: 'dev.example.search', viewId: 'missing' }, owner),
    (e) => e.code === 'bad_request',
  );
});
test('service token does not elevate view callers; wrong node rejected', async (t) => {
  const { h, calls } = await fixture(t);
  await assert.rejects(
    h['web.plugins_query'](
      { id: 'dev.example.search', viewId: 'items' },
      { scopes: ['call:web.plugins_query'] },
    ),
    (e) => e.code === 'forbidden',
  );
  assert(!calls.some((c) => c.name === 'search.items'));
  await assert.rejects(
    h['web.plugins_query'](
      { id: 'dev.example.search', viewId: 'items', nodeId: 'attacker' },
      owner,
    ),
    (e) => e.code === 'bad_request',
  );
});
test('action inputs and result output are generic; locale cannot be spoofed by values', async (t) => {
  const { h, calls } = await fixture(t);
  const r = await h['web.plugins_action'](
    {
      id: 'dev.example.search',
      actionId: 'preview',
      values: { text: 'buyer', _locale: 'evil' },
      _locale: 'ru',
    },
    owner,
  );
  assert.equal(JSON.parse(r.output[0]).verdict, 'buyer');
  assert.equal(calls.find((c) => c.name === 'search.preview').args._locale, 'ru');
});
test('plugin notifications are scoped, safe-linked, and read state survives polling', async (t) => {
  const { h } = await fixture(t);
  let notes = await h['web.notifications_list']({}, owner);
  const n = notes.find((n) => n.title === 'Found a buyer');
  assert(n);
  assert.equal(n.read, false);
  assert.equal(n.link, '/plugins/dev.example.search');
  await h['web.notifications_mark']({ ids: [n.id], read: true }, owner);
  notes = await h['web.notifications_list']({}, owner);
  assert.equal(notes.find((x) => x.id === n.id).read, true);
  const viewer = await h['web.notifications_list'](
    {},
    { name: 'viewer', scopes: ['call:web.notifications_list'] },
  );
  assert(!viewer.some((n) => n.title === 'Found a buyer'));
});

test('invalid/oversized table outputs fail closed', async (t) => {
  const { h, client } = await fixture(t),
    original = client.call;
  client.call = async (name, ...args) =>
    name === 'search.items'
      ? { rows: Array.from({ length: 101 }, () => ({ id: 'x' })), total: 101 }
      : original(name, ...args);
  await assert.rejects(
    h['web.plugins_query']({ id: 'dev.example.search', viewId: 'items' }, owner),
    (e) => e.code === 'bad_request',
  );
});

test('custom metrics route to installed peer, never local core; reject arbitrary target', async (t) => {
  const { client, ui, calls } = await fixture(t);
  ui.metrics = [{ id: 'accepted', queryCapability: 'search.metrics', aggregations: ['sum'] }];
  const original = client.call;
  client.call = async (name, args, node) => {
    if (name === 'core.components')
      return node === 'desktop' ? [{ id: 'search', version: '1', metadata: { ui } }] : [];
    if (name === 'peers.list') return [{ online: true, node_id: 'desktop' }];
    if (name === 'core.catalog') return [{ name: 'search.metrics', admin: true, node: 'desktop' }];
    if (name === 'supervisor.list') return [];
    if (name === 'search.metrics') {
      calls.push({ name, args, node });
      return { series: [], summary: { current: 1 } };
    }
    return original(name, args, node);
  };
  const h = createBridge(client);
  await h['web.metrics_query'](
    { query: { pluginId: ui.id, metricId: 'accepted', range: { preset: '24h' } } },
    owner,
  );
  assert.equal(calls.find((c) => c.name === 'search.metrics').node, 'desktop');
  await assert.rejects(
    h['web.metrics_query'](
      {
        query: { pluginId: ui.id, metricId: 'accepted', nodeId: 'evil', range: { preset: '24h' } },
      },
      owner,
    ),
    (e) => e.code === 'bad_request',
  );
  await assert.rejects(
    h['web.metrics_query'](
      { query: { pluginId: ui.id, metricId: 'accepted', range: { preset: '24h' } } },
      { scopes: ['call:*'] },
    ),
    (e) => e.code === 'forbidden',
  );
});

test('active remote registration wins over cached manifest and disabled local install', async (t) => {
  const { client, ui } = await fixture(t);
  ui.version = '1.0.0';
  const base = client.call;
  let remote = false;
  client.call = async (name, args, node) => {
    if (name === 'core.components')
      return node === 'desktop'
        ? [
            {
              id: 'search',
              version: '1.0.1',
              metadata: {
                ui: {
                  ...ui,
                  version: '1.0.1',
                  settings: [{ key: 'newSetting', type: 'boolean', label: 'New setting' }],
                },
              },
            },
          ]
        : remote
          ? []
          : [{ id: 'search', version: '1.0.0', metadata: { ui } }];
    if (name === 'supervisor.list')
      return node === 'desktop' ? [] : [{ id: 'search', running: !remote, enabled: !remote }];
    if (name === 'peers.list') return remote ? [{ node_id: 'desktop', online: true }] : [];
    return base(name, args, node);
  };
  const h = createBridge(client);
  assert.equal((await h['web.plugins_list']())[0].manifest.version, '1.0.0');
  remote = true;
  const updated = (await h['web.plugins_list']())[0];
  assert.equal(updated.instance.status, 'active');
  assert.equal(updated.instance.nodeIds[0], 'desktop');
  assert.equal(updated.manifest.version, '1.0.1');
  assert.equal(updated.instance.installedVersion, '1.0.1');
  assert.equal(updated.manifest.settings[0].key, 'newSetting');
});
