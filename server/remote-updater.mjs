// Owner-only maintenance endpoint. Runs on the target node, never replaces another node's files.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Updater, UpdateError } from './updater.mjs';
export const REMOTE_COMPONENT = 'delta-updater';
export function remoteHandlers(updater, nodeId) {
  const guard = (caller) => {
    if (!caller?.scopes?.includes('admin')) throw new UpdateError('forbidden');
  };
  return {
    'delta-updater.info': async (_args, caller) => {
      guard(caller);
      const info = await updater.call('core.info');
      if (info.node_id !== nodeId) throw new UpdateError('node_changed');
      const status = await updater.performCheck();
      return { nodeId, core: status.items.find((i) => i.kind === 'core' && i.local) };
    },
    'delta-updater.apply': async (args, caller) => {
      guard(caller);
      if (args.nodeId !== nodeId || !/^\d+\.\d+\.\d+$/.test(args.version || ''))
        throw new UpdateError('invalid_target');
      const state = await updater.status();
      if (state.job && ['queued', 'running'].includes(state.job.status)) {
        if (
          state.job.items.length === 1 &&
          state.job.items[0].nodeId === nodeId &&
          state.job.items[0].latest === args.version
        )
          return { accepted: true, jobId: state.job.id };
        throw new UpdateError('busy');
      }
      const info = await updater.call('core.info');
      if (info.node_id !== nodeId) throw new UpdateError('node_changed');
      const check = await updater.performCheck(),
        core = check.items.find((i) => i.local && i.kind === 'core');
      if (!core || core.nodeId !== nodeId || core.latest !== args.version)
        throw new UpdateError('invalid_release');
      return updater.apply(core.target);
    },
    'delta-updater.status': async (args, caller) => {
      guard(caller);
      const state = await updater.status();
      if (state.job?.id !== args.jobId) throw new UpdateError('invalid_job');
      return { nodeId, job: state.job };
    },
  };
}
export async function serveRemoteUpdater() {
  const home = resolve(process.env.DELTA_HOME || dirname(dirname(process.env.DELTA_DATA || '')));
  const updater = await new Updater(home).init(),
    info = await updater.call('core.info'),
    handlers = remoteHandlers(updater, info.node_id);
  const root = (process.env.DELTA_URL || '').replace(/\/$/, '').replace(/\/v1$/, '');
  const request = async (method, path, body) => {
    const r = await fetch(root + '/v1' + path, {
      method,
      headers: {
        authorization: 'Bearer ' + process.env.DELTA_TOKEN,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
    const d = await r.json();
    if (!d.ok) throw new UpdateError(d.error?.code || 'core_unavailable');
    return d.result;
  };
  const manifest = {
    id: REMOTE_COMPONENT,
    version: '0.6.4',
    description: 'Target-node update maintenance',
    capabilities: Object.keys(handlers).map((name) => ({
      name,
      admin: true,
      params: name.endsWith('.apply')
        ? {
            nodeId: { type: 'string', required: true },
            version: { type: 'string', required: true },
          }
        : name.endsWith('.status')
          ? { jobId: { type: 'string', required: true } }
          : {},
    })),
  };
  let session;
  while (true) {
    try {
      if (!session) session = (await request('POST', '/components', manifest)).session;
      const { invocation } = await request(
        'GET',
        `/components/${REMOTE_COMPONENT}/next?session=${encodeURIComponent(session)}&timeout=20`,
      );
      if (!invocation) continue;
      let result;
      try {
        const handler = handlers[invocation.capability];
        if (!handler) throw new UpdateError('not_found');
        result = { ok: true, result: await handler(invocation.args || {}, invocation.caller) };
      } catch (e) {
        result = {
          ok: false,
          error: {
            code: ['forbidden', 'not_found'].includes(e.code)
              ? e.code
              : ['busy', 'another_install'].includes(e.code)
                ? 'conflict'
                : 'bad_request',
            message: e.code || 'operation_failed',
          },
        };
      }
      await request('POST', `/components/${REMOTE_COMPONENT}/result`, {
        session,
        id: invocation.id,
        ...result,
      });
    } catch {
      session = undefined;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await serveRemoteUpdater();
