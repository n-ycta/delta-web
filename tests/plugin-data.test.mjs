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
