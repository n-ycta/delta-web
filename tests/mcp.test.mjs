import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMcp, constrain, toolSchema } from '../server/mcp.mjs';
const base = { nodes: [], plugins: ['dev.delta.type'], maxRangeDays: 7, maxRows: 12 };
test('MCP data policy rejects other sources and excessive ranges', () => {
  assert.throws(() => constrain(base, 'storage.query', { source: 'other', from: 1, to: 2 }));
  assert.throws(() =>
    constrain(base, 'web.metrics_query', {
      query: { pluginId: 'dev.delta.type', range: { preset: '30d' } },
    }),
  );
  assert.equal(
    constrain(base, 'storage.query', { source: 'dev.delta.type', from: 1, to: 2, limit: 999 }).args
      .limit,
    12,
  );
  assert.throws(() => constrain({ ...base, nodes: ['n1'] }, 'system.info', {}));
});
test('MCP profile creation uses explicit scopes, hides secrets and revokes', async () => {
  const d = await mkdtemp(join(tmpdir(), 'delta-mcp-')),
    calls = [];
  try {
    const service = {
        call: async (c, a) => {
          if (c === 'core.info') return { node_id: 'local' };
          if (c === 'core.catalog')
            return [{ name: 'supervisor.restart', admin: true }, { name: 'system.info' }];
          if (c === 'core.components') return [];
          calls.push([c, a]);
          return { token: 'secret', id: 'tid' };
        },
      },
      m = await createMcp(service, join(d, 'mcp.json')),
      owner = { scopes: ['admin'] };
    await assert.rejects(
      m.handlers['web.mcp_create'](
        { profile: { name: 'x', capabilities: ['tokens.create'] } },
        owner,
      ),
    );
    await assert.rejects(m.handlers['web.mcp_list']({}, { scopes: [] }));
    const r = await m.handlers['web.mcp_create'](
      { profile: { name: 'ops', capabilities: ['supervisor.restart', 'system.info'] } },
      owner,
    );
    assert.deepEqual(calls[0][1].scopes, ['admin:supervisor.restart', 'call:system.info']);
    assert.ok(r.secret.startsWith('dmc_'));
    const p = (await m.handlers['web.mcp_list']({}, owner))[0];
    assert.equal(p.token, undefined);
    assert.equal(p.secretHash, undefined);
    await m.handlers['web.mcp_revoke']({ id: r.profile.id }, owner);
    assert.equal(calls[1][0], 'tokens.revoke');
    assert.equal((await m.handlers['web.mcp_list']({}, owner)).length, 0);
  } finally {
    await rm(d, { recursive: true, force: true });
  }
});

test('MCP applies plugin restrictions to component tools', () => {
  assert.doesNotThrow(() => constrain(base, 'supervisor.restart', { id: 'typing' }));
  assert.throws(() => constrain(base, 'supervisor.logs', { id: 'storage' }));
  assert.throws(() => constrain({ ...base, plugins: ['dev.delta.db'] }, 'typing.status', {}));
});

test('MCP schemas describe nested metric queries and required node targets', () => {
  const schema = toolSchema('web.metrics_query', {}, { nodes: ['one'] });
  assert.ok(schema.required.includes('query'));
  assert.ok(schema.required.includes('_targetNode'));
  assert.deepEqual(schema.properties.query.required, ['pluginId', 'metricId', 'range']);
  assert.ok(toolSchema('storage.query').required.includes('source'));
});

test('MCP discovers plugin methods and structured params, grants only explicit admin scopes', async (t) => {
  const d = await mkdtemp(join(tmpdir(), 'mcp-dynamic-'));
  t.after(() => rm(d, { recursive: true, force: true }));
  const calls = [];
  const spec = {
    name: 'search.settings',
    component: 'search',
    node: 'vps',
    admin: true,
    params: { values: { type: 'object', properties: { enabled: { type: 'boolean' } } } },
  };
  const service = {
    request: async () => [],
    call: async (name, args) => {
      calls.push([name, args]);
      if (name === 'core.info') return { node_id: 'vps' };
      if (name === 'core.catalog')
        return [spec, { name: 'tokens.create', component: 'tokens', admin: true }];
      if (name === 'core.components')
        return [{ id: 'search', metadata: { ui: { id: 'dev.example.search' } } }];
      if (name === 'tokens.create') return { token: 'private', id: 'tid' };
      throw Error(name);
    },
  };
  const m = await createMcp(service, join(d, 'mcp.json')),
    owner = { scopes: ['admin'] };
  const catalog = await m.handlers['web.mcp_catalog']({}, owner);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].pluginId, 'dev.example.search');
  assert.equal(toolSchema(spec.name, spec).properties.values.properties.enabled.type, 'boolean');
  await m.handlers['web.mcp_create'](
    {
      profile: {
        name: 'search',
        capabilities: ['search.settings'],
        plugins: ['dev.example.search'],
      },
    },
    owner,
  );
  assert.deepEqual(calls.find((c) => c[0] === 'tokens.create')[1].scopes, [
    'admin:search.settings',
  ]);
  await assert.rejects(
    m.handlers['web.mcp_create'](
      {
        profile: {
          name: 'wrong',
          capabilities: ['search.settings'],
          plugins: ['dev.other.plugin'],
        },
      },
      owner,
    ),
    (e) => e.code === 'forbidden',
  );
  assert(!calls.find((c) => c[0] === 'tokens.create')[1].scopes.includes('admin'));
});
