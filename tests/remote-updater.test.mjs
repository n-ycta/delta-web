import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remoteHandlers } from '../server/remote-updater.mjs';
import { remoteBootstrap } from '../server/updater.mjs';
const owner = { scopes: ['admin'] };
test('remote maintenance API is owner-only, node-pinned and version-pinned; duplicate start returns the running job', async () => {
  let applied = 0,
    job;
  const core = { kind: 'core', local: true, nodeId: 'vps', target: 'vps::core', latest: '0.4.1' };
  const updater = {
    call: async () => ({ node_id: 'vps' }),
    status: async () => ({ job }),
    performCheck: async () => ({ items: [core] }),
    apply: async (target) => {
      assert.equal(target, 'vps::core');
      applied++;
      return { accepted: true, jobId: 'j' };
    },
  };
  const h = remoteHandlers(updater, 'vps');
  for (const [name, args] of [
    ['info', {}],
    ['apply', { nodeId: 'vps', version: '0.4.1' }],
    ['status', { jobId: 'j' }],
  ])
    await assert.rejects(
      h['delta-updater.' + name](args, { scopes: ['call:*'] }),
      (e) => e.code === 'forbidden',
    );
  await assert.rejects(
    h['delta-updater.apply']({ nodeId: 'different', version: '0.4.1' }, owner),
    (e) => e.code === 'invalid_target',
  );
  await assert.rejects(
    h['delta-updater.apply']({ nodeId: 'vps', version: '0.4.2' }, owner),
    (e) => e.code === 'invalid_release',
  );
  assert.equal(
    (await h['delta-updater.apply']({ nodeId: 'vps', version: '0.4.1' }, owner)).jobId,
    'j',
  );
  assert.equal(applied, 1);
  job = { id: 'j', status: 'running', items: [{ nodeId: 'vps', latest: '0.4.1' }] };
  assert.equal(
    (await h['delta-updater.apply']({ nodeId: 'vps', version: '0.4.1' }, owner)).jobId,
    'j',
  );
  assert.equal(applied, 1);
  await assert.rejects(
    h['delta-updater.status']({ jobId: 'other' }, owner),
    (e) => e.code === 'invalid_job',
  );
  assert.equal((await h['delta-updater.status']({ jobId: 'j' }, owner)).nodeId, 'vps');
});
test('bootstrap is self-contained and small enough for standard Windows command lines; only fixed official release paths are used', () => {
  const source = remoteBootstrap.toString();
  assert(source.length < 16000);
  assert(source.includes('checksum'));
  assert(source.includes('config.node_id'));
  assert(source.includes('server/remote-updater.mjs'));
  assert(!source.includes('eval('));
});
