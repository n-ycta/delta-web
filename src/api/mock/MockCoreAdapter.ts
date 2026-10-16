import { tr } from '@/i18n';
import type {
  AuditEntry, ConnectionConfig, CoreEvent, DashboardConfig, EventQuery, MetricDescriptor, MetricQuery, MetricResult,
  NodeCommandId, NodeInfo, Notification, PluginInstance, Principal, RealtimeMessage, Role, UptimeCell,
} from '@/core/contracts';
import { NODE_COMMANDS } from '@/core/contracts';
import { hashString, mulberry32, uid } from '@/core/lib/random';
import type { CommandResult, CoreApi, CoreInfo, InstallRequest, LogLine, NodeHistory, PairingTicket, RawPluginRecord } from '../types';
import { CoreApiError } from '../types';
import { generateMetric, nodeSeries } from './generate';
import { makeEvent, pluginLogs, REGISTRY, seedAudit, seedEvents, seedInstances, seedNodes, seedNotifications, seedPrincipals } from './seed';

const STORE_KEY = 'delta.mock.db.v4';
const CONTROL_KEY = 'delta.mock.control';

export interface MockControl { latencyMin: number; latencyMax: number; errorRate: number; offline: boolean; liveEvents: boolean }
export const DEFAULT_CONTROL: MockControl = { latencyMin: 120, latencyMax: 450, errorRate: 0, offline: false, liveEvents: true };

export function readMockControl(): MockControl {
  try { return { ...DEFAULT_CONTROL, ...JSON.parse(localStorage.getItem(CONTROL_KEY) ?? '{}') }; } catch { return DEFAULT_CONTROL; }
}
export function writeMockControl(c: MockControl) { localStorage.setItem(CONTROL_KEY, JSON.stringify(c)); }
export function resetMockDatabase() { localStorage.removeItem(STORE_KEY); }

interface Db {
  instances: Record<string, PluginInstance>;
  nodes: NodeInfo[];
  events: CoreEvent[];
  notifications: Notification[];
  dashboards: DashboardConfig[];
  principals: Principal[];
  audit: AuditEntry[];
  /** pluginId → id of manifest in REGISTRY to serve as "installed" (index 0 = manifest, 1 = latest) */
  installedFromLatest: Record<string, boolean>;
}

function freshDb(): Db {
  return { instances: seedInstances(), nodes: seedNodes(), events: seedEvents(), notifications: seedNotifications(), dashboards: [], principals: seedPrincipals(), audit: seedAudit(), installedFromLatest: {} };
}

const rawId = (m: unknown) => (m && typeof m === 'object' && 'id' in m ? String((m as { id: unknown }).id) : '');

/**
 * In-browser simulation of the Delta core. Implements the full CoreApi contract, persists
 * state to localStorage and pushes realtime messages, so every UI scenario works offline.
 */
export class MockCoreAdapter implements CoreApi {
  async updateStatus():Promise<import('../updates').UpdateStatus>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async checkUpdates(){return this.updateStatus()}
  async configureUpdates(_values:import('../updates').UpdateSettings):Promise<import('../updates').UpdateSettings>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async installUpdates(_target:string):Promise<{accepted:boolean;jobId:string}>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async sshPreflight():Promise<import('../types').SSHPreflight>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async probeSSH(_target:import('../types').SSHTarget):Promise<import('../types').SSHProbe>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async installSSH(_input:import('../types').SSHInstall):Promise<{jobId:string}>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async sshJob(_id:string):Promise<import('../types').SSHJob>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  async setNodeTrust(_id:string,_admin:boolean):Promise<unknown>{throw new CoreApiError('UNSUPPORTED',tr('updates.liveOnly'))}
  readonly mode = 'mock' as const;
  readonly endpoint = 'mock://in-browser';
  private db: Db;
  private listeners = new Set<(m: RealtimeMessage) => void>();
  private timers: number[] = [];
  private control = readMockControl();
  private startedAt = Date.now() - 41 * 86400e3;

  constructor() {
    this.db = this.load();
    // keep node "liveness" fresh relative to now after reload
    const t = Date.now();
    this.db.nodes.forEach((n) => { if (n.status !== 'offline') n.lastSeen = Math.max(n.lastSeen, t - 10e3 - (n.id === 'pixel-8' ? 85e3 : 0)); });
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === CONTROL_KEY) this.control = readMockControl(); });
  }

  setControl(c: MockControl) { this.control = c; writeMockControl(c); this.emit({ type: 'connection', state: c.offline ? 'closed' : 'open', latencyMs: c.latencyMin }); }
  getControl() { return this.control; }

  private load(): Db {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const db = JSON.parse(raw) as Db;
        // events/notifications are regenerated relative to now for a believable demo timeline
        return { ...freshDb(), ...db, events: [...db.events.filter((e) => e.source.type === 'console'), ...seedEvents()].sort((a, b) => b.ts - a.ts).slice(0, 400) };
      }
    } catch { /* corrupt store → reset */ }
    return freshDb();
  }
  private persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...this.db, events: this.db.events.slice(0, 400) })); } catch { /* quota */ }
  }

  private async net<T>(fn: () => T | Promise<T>, opts: { noFail?: boolean } = {}): Promise<T> {
    const { latencyMin, latencyMax, errorRate, offline } = this.control;
    await new Promise((r) => setTimeout(r, latencyMin + Math.random() * Math.max(0, latencyMax - latencyMin)));
    if (offline) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_6845c6d905"), tr("api.mock.MockCoreAdapter.s_f7d74d6f18"), 0, true, tr("api.mock.MockCoreAdapter.s_4f8f6402d8"));
    if (!opts.noFail && errorRate > 0 && Math.random() < errorRate) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_895e9c001a"), tr("api.mock.MockCoreAdapter.s_c168b45b2e"), 503, true, tr("api.mock.MockCoreAdapter.s_3241673724"));
    return structuredClone(await fn());
  }

  private emit(msg: RealtimeMessage) { this.listeners.forEach((l) => l(msg)); }
  private pushEvent(e: Omit<CoreEvent, 'id' | 'ts'>) {
    const ev = makeEvent(e);
    this.db.events.unshift(ev);
    this.emit({ type: 'event', event: ev });
    if (e.severity === 'error' || e.severity === 'critical' || (e.severity === 'warn' && e.source.type !== 'console')) {
      const n: Notification = { id: uid('n'), ts: ev.ts, severity: e.severity, title: e.message, read: false, eventId: ev.id, link: e.source.type === 'node' ? `/nodes/${e.source.id}` : e.source.type === 'plugin' ? `/plugins/${e.source.id}` : undefined };
      this.db.notifications.unshift(n);
      this.emit({ type: 'notification', notification: n });
    }
    this.persist();
    return ev;
  }
  private audit(action: string, target: string) {
    this.db.audit.unshift({ id: uid('a'), ts: Date.now(), actor: tr("api.mock.MockCoreAdapter.s_adb4032a9d"), action, target, ip: '10.0.0.31' });
  }

  private manifestFor(id: string) {
    const r = REGISTRY.find((x) => rawId(x.manifest) === id);
    if (!r) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a9e9f6901a"), tr("api.mock.MockCoreAdapter.s_7c48ad3565", { p0: (id) }), 404, false);
    return r;
  }
  private inst(id: string) {
    const i = this.db.instances[id];
    if (!i) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a9e9f6901a"), tr("api.mock.MockCoreAdapter.s_7c48ad3565", { p0: (id) }), 404, false);
    return i;
  }

  info(): Promise<CoreInfo> {
    return this.net(() => ({ name: 'delta@fra-01', coreVersion: '2.3.1', apiVersion: '2.1.0', startedAt: this.startedAt, region: 'eu-central', features: ['realtime.ws', 'metrics.v2', 'dashboards.sync', 'audit'] }), { noFail: true });
  }

  listPlugins(): Promise<RawPluginRecord[]> {
    return this.net(() => REGISTRY.map((r) => {
      const id = rawId(r.manifest);
      const inst = this.db.instances[id];
      return { manifest: this.db.installedFromLatest[id] ? r.latest : r.manifest, latest: r.latest, instance: inst };
    }));
  }
  getPluginLogs(pluginId: string, limit = 80): Promise<LogLine[]> {
    return this.net(() => {
      const i = this.inst(pluginId);
      if (!i.installedVersion) return [];
      return pluginLogs(pluginId, limit).map((l, k) => ({ ...l, nodeId: i.nodeIds[k % Math.max(1, i.nodeIds.length)] }));
    });
  }

  private later(ms: number, fn: () => void) { this.timers.push(window.setTimeout(fn, ms)); }

  installPlugin(pluginId: string, req: InstallRequest): Promise<PluginInstance> {
    return this.net(() => {
      const r = this.manifestFor(pluginId);
      const m = r.latest as { name: string; version: string };
      const i = this.inst(pluginId);
      if (i.installedVersion) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_716a4859cb"), tr("api.mock.MockCoreAdapter.s_d9a59344c1"), 409, false);
      if (!req.nodeIds.length) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_3b3e9155f6"), tr("api.mock.MockCoreAdapter.s_5809ce4998"), 422, false);
      Object.assign(i, { status: 'installing', nodeIds: req.nodeIds, grantedPermissions: req.permissions, settings: req.settings ?? {} });
      this.db.installedFromLatest[pluginId] = true;
      this.audit('plugin.install', `${pluginId}@${m.version}`);
      this.persist();
      this.later(2600, () => {
        Object.assign(i, { status: 'active', installedVersion: m.version, installedAt: Date.now(), lastSyncAt: Date.now(), eventsPerMin: 3 });
        this.db.nodes.forEach((n) => { if (req.nodeIds.includes(n.id) && !n.pluginIds.includes(pluginId)) n.pluginIds.push(pluginId); });
        this.pushEvent({ severity: 'info', source: { type: 'plugin', id: pluginId, label: m.name }, code: 'INSTALLED', message: tr("api.mock.MockCoreAdapter.s_428d96144a", { p0: (m.name), p1: (m.version), p2: (req.nodeIds.length) }) });
        this.emit({ type: 'plugin.update', pluginId });
      });
      return i;
    });
  }
  updatePlugin(pluginId: string): Promise<PluginInstance> {
    return this.net(() => {
      const i = this.inst(pluginId);
      const r = this.manifestFor(pluginId);
      const latest = r.latest as { version: string; name: string };
      const from = i.installedVersion;
      i.status = 'updating';
      this.persist();
      this.later(3000, () => {
        i.status = i.error ? 'degraded' : 'active';
        i.installedVersion = latest.version;
        this.db.installedFromLatest[pluginId] = true;
        this.audit('plugin.update', `${pluginId} ${from} → ${latest.version}`);
        this.pushEvent({ severity: 'info', source: { type: 'plugin', id: pluginId, label: latest.name }, code: 'UPDATED', message: tr("api.mock.MockCoreAdapter.s_5c05dec272", { p0: (latest.name), p1: (from), p2: (latest.version) }) });
        this.emit({ type: 'plugin.update', pluginId });
      });
      return i;
    });
  }
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<PluginInstance> {
    return this.net(() => {
      const i = this.inst(pluginId);
      i.status = enabled ? (i.error ? 'error' : 'active') : 'disabled';
      this.audit(enabled ? 'plugin.enable' : 'plugin.disable', pluginId);
      this.pushEvent({ severity: 'info', source: { type: 'console', id: 'console' }, code: enabled ? 'PLUGIN_ENABLED' : 'PLUGIN_DISABLED', message: tr("api.mock.MockCoreAdapter.s_b993dfceca", { p0: (pluginId), p1: (enabled ? tr("api.mock.MockCoreAdapter.s_bbbf38509d") : tr("api.mock.MockCoreAdapter.s_b15760925d")) }) });
      return i;
    });
  }
  uninstallPlugin(pluginId: string, opts: { purgeData: boolean }): Promise<void> {
    return this.net(() => {
      const i = this.inst(pluginId);
      Object.assign(i, { status: 'available', installedVersion: undefined, nodeIds: [], grantedPermissions: [], settings: {}, error: undefined, lastSyncAt: undefined, eventsPerMin: undefined });
      delete this.db.installedFromLatest[pluginId];
      this.db.nodes.forEach((n) => { n.pluginIds = n.pluginIds.filter((p) => p !== pluginId); n.processes = n.processes.filter((p) => p.component !== pluginId); });
      this.audit('plugin.uninstall', tr("api.mock.MockCoreAdapter.s_7c8702c04b", { p0: (pluginId), p1: (opts.purgeData ? tr("api.mock.MockCoreAdapter.s_ea390311f7") : '') }));
      this.pushEvent({ severity: 'warn', source: { type: 'console', id: 'console' }, code: 'PLUGIN_REMOVED', message: tr("api.mock.MockCoreAdapter.s_b527972312", { p0: (pluginId), p1: (opts.purgeData ? tr("api.mock.MockCoreAdapter.s_57e535d098") : tr("api.mock.MockCoreAdapter.s_60598a48ca")) }) });
    });
  }
  updatePluginSettings(pluginId: string, values: Record<string, unknown>): Promise<PluginInstance> {
    return this.net(() => {
      const i = this.inst(pluginId);
      const secrets = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '__unchanged__'));
      i.settings = { ...i.settings, ...secrets };
      if (pluginId === 'dev.delta.browser' && typeof values.syncToken === 'string' && values.syncToken.length > 3 && values.syncToken !== '__unchanged__') {
        i.error = undefined; i.status = 'active'; i.lastSyncAt = Date.now(); i.eventsPerMin = 2;
        this.db.nodes.forEach((n) => n.processes.forEach((p) => { if (p.component === pluginId) { p.status = 'running'; p.cpu = 0.3; p.memMb = 61; } }));
        this.db.nodes.forEach((n) => { n.errors = n.errors.filter((e) => e.component !== pluginId); });
        this.later(800, () => this.pushEvent({ severity: 'info', source: { type: 'plugin', id: pluginId, label: tr("api.mock.MockCoreAdapter.s_98bb6af6fe") }, code: 'AUTH_OK', message: tr("api.mock.MockCoreAdapter.s_3b46e99939") }));
      }
      this.audit('plugin.settings.update', pluginId);
      this.persist();
      return i;
    });
  }
  setPluginPermissions(pluginId: string, scopes: string[]): Promise<PluginInstance> {
    return this.net(() => { const i = this.inst(pluginId); i.grantedPermissions = scopes; this.audit('permission.set', `${pluginId}: ${scopes.length}`); this.persist(); return i; });
  }
  setPluginNodes(pluginId: string, nodeIds: string[]): Promise<PluginInstance> {
    return this.net(() => {
      const i = this.inst(pluginId); i.nodeIds = nodeIds;
      this.db.nodes.forEach((n) => { n.pluginIds = n.pluginIds.filter((p) => p !== pluginId); if (nodeIds.includes(n.id)) n.pluginIds.push(pluginId); });
      this.persist(); return i;
    });
  }
  runPluginAction(pluginId: string, actionId: string): Promise<CommandResult> {
    return this.net(() => {
      const i = this.inst(pluginId);
      if (i.status === 'disabled') throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_4be40b090a"), tr("api.mock.MockCoreAdapter.s_01abca4746"), 409, false, tr("api.mock.MockCoreAdapter.s_d97e974862"));
      if (pluginId === 'dev.delta.home' && actionId === 'reconnect') {
        this.later(1500, () => { i.error = undefined; i.status = 'active'; this.persist(); this.pushEvent({ severity: 'info', source: { type: 'plugin', id: pluginId, label: tr("api.mock.MockCoreAdapter.s_92f3f459ec") }, code: 'SENSOR_BACK', message: tr("api.mock.MockCoreAdapter.s_2850448f04") }); this.emit({ type: 'plugin.update', pluginId }); });
      }
      this.audit(`plugin.action.${actionId}`, pluginId);
      return { ok: true, durationMs: 300 + Math.round(Math.random() * 900), output: [`→ ${actionId}`, 'accepted by core', 'dispatched to ' + i.nodeIds.join(', '), 'done'] };
    });
  }

  queryPluginView(_id:string,_viewId:string,_args:Record<string,unknown>={},_nodeId?:string):Promise<{rows:Record<string,unknown>[];total:number}>{return this.net(()=>({rows:[],total:0}))}

  queryMetric(q: MetricQuery): Promise<MetricResult> {
    return this.net(() => {
      const r = REGISTRY.find((x) => rawId(x.manifest) === q.pluginId);
      const i = this.db.instances[q.pluginId];
      if (!r || !i?.installedVersion) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_f3699e1c6f"), tr("api.mock.MockCoreAdapter.s_d786e2478a", { p0: (q.pluginId) }), 404, false);
      const m = ((this.db.installedFromLatest[q.pluginId] ? r.latest : r.manifest) as { metrics: MetricDescriptor[] }).metrics.find((x) => x.id === q.metricId);
      if (!m) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_c57887a726"), tr("api.mock.MockCoreAdapter.s_02e26dd76c", { p0: (q.metricId) }), 404, false);
      const full = { unit: '', precision: 1, better: 'neutral', dimensions: [], aggregations: ['avg'], visualizations: [], tags: [], ...(m as Partial<MetricDescriptor>) } as MetricDescriptor;
      const res = generateMetric(q, full);
      if (i.status === 'error' && q.pluginId === 'dev.delta.browser') {
        // data stopped arriving when auth expired
        const cutoff = i.lastSyncAt ?? Date.now();
        res.series = res.series.map((s) => ({ ...s, points: s.points.map((p) => (p.t > cutoff ? { ...p, v: null } : p)) }));
      }
      return res;
    });
  }

  listNodes(): Promise<NodeInfo[]> { return this.net(() => this.db.nodes); }
  getNodeHistory(nodeId: string, rangeMs: number): Promise<NodeHistory> {
    return this.net(() => {
      const n = this.db.nodes.find((x) => x.id === nodeId);
      if (!n) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a9e9f6901a"), tr("api.mock.MockCoreAdapter.s_43ec565be2"), 404, false);
      const memPct = n.memTotal ? (n.memUsed / n.memTotal) * 100 : 40;
      const h = { cpu: nodeSeries(nodeId, 'cpu', rangeMs, Math.max(n.cpu, 8)), mem: nodeSeries(nodeId, 'mem', rangeMs, Math.max(memPct, 20)), latency: nodeSeries(nodeId, 'latency', rangeMs, n.latencyMs ?? 30) };
      if (n.status === 'offline') {
        const cut = n.lastSeen;
        for (const s of [h.cpu, h.mem, h.latency]) s.points = s.points.map((p) => (p.t > cut ? { ...p, v: null } : p));
      }
      return h;
    });
  }
  getNodeUptime(nodeId: string, days: number): Promise<UptimeCell[]> {
    return this.net(() => {
      const rnd = mulberry32(hashString(nodeId));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const flaky = nodeId === 'pixel-8' || nodeId === 'tab-s9' ? 0.25 : nodeId === 'hel-02' ? 0.12 : 0.04;
      return Array.from({ length: days }, (_, i) => {
        const day = today.getTime() - (days - 1 - i) * 86400e3;
        const r = rnd();
        if (nodeId === 'mba' && i < 20) return { day, state: 'nodata' as const, availability: 0 };
        if (nodeId === 'tab-s9' && i === days - 1) return { day, state: 'down' as const, availability: 0.42 };
        const state = r < flaky * 0.2 ? 'down' : r < flaky ? 'partial' : 'up';
        return { day, state, availability: state === 'up' ? 0.995 + rnd() * 0.005 : state === 'partial' ? 0.85 + rnd() * 0.12 : 0.3 + rnd() * 0.4 };
      });
    });
  }
  runNodeCommand(nodeId: string, command: NodeCommandId, args: Record<string, string> = {}): Promise<CommandResult> {
    return this.net(async () => {
      const n = this.db.nodes.find((x) => x.id === nodeId);
      if (!n) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a9e9f6901a"), tr("api.mock.MockCoreAdapter.s_43ec565be2"), 404, false);
      const spec = NODE_COMMANDS.find((c) => c.id === command)!;
      if (!n.allowedCommands.includes(command)) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a4cfd65190"), tr("api.mock.MockCoreAdapter.s_ffd8f89cfb", { p0: (n.name), p1: (spec.label) }), 403, false, tr("api.mock.MockCoreAdapter.s_91401bd74a"));
      if (n.status === 'offline') throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_d6a9c64e8b"), tr("api.mock.MockCoreAdapter.s_4497a910ca", { p0: (n.name) }), 504, true, tr("api.mock.MockCoreAdapter.s_1c3bd5b712"));
      this.audit(`node.command.${command}`, `${n.name}${args.component ? ' / ' + args.component : ''}`);
      const out: string[] = [`$ delta-agent ${command}${Object.values(args).length ? ' ' + Object.values(args).join(' ') : ''}`];
      const dur = 200 + Math.round(Math.random() * 1200);
      await new Promise((r) => setTimeout(r, dur));
      switch (command) {
        case 'ping': out.push(`pong from ${n.address}: rtt=${n.latencyMs ?? 20}ms agent=${n.agentVersion}`); break;
        case 'sync-now': out.push('flushing 4 plugin buffers…', `uploaded ${Math.round(Math.random() * 1800 + 200)} records`, 'ok'); n.lastSeen = Date.now(); break;
        case 'collect-logs': out.push('collecting journal (24h)…', `archive: logs-${n.id}-${new Date().toISOString().slice(0, 10)}.tar.zst (3.4 MB)`, 'uploaded to core:/artifacts'); break;
        case 'clear-cache': out.push('removed 214 MB from /var/cache/delta'); break;
        case 'update-agent': {
          const latest = '1.8.2';
          if (n.agentVersion === latest) { out.push(`already at ${latest}`); break; }
          out.push(`downloading delta-agent ${latest}…`, 'verifying signature (minisign)… ok', 'restarting agent…');
          n.agentVersion = latest; n.components.forEach((c) => { if (c.id === 'delta-agent') { c.version = latest; c.status = 'ok'; } });
          break;
        }
        case 'restart-component': {
          const c = n.components.find((x) => x.id === args.component);
          if (!c) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_3b3e9155f6"), tr("api.mock.MockCoreAdapter.s_90f7c53b2e"), 422, false);
          if (!c.restartable) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a4cfd65190"), tr("api.mock.MockCoreAdapter.s_6b33b04790", { p0: (c.name) }), 403, false);
          n.processes.forEach((p) => { if (p.component === c.id) { p.status = 'restarting'; } });
          out.push(`stopping ${c.name}… ok`, `starting ${c.name}…`);
          this.later(2200, () => {
            n.processes.forEach((p) => { if (p.component === c.id) { p.status = c.id === 'dev.delta.browser' && this.db.instances['dev.delta.browser']?.status === 'error' ? 'crashed' : 'running'; p.restarts++; p.startedAt = Date.now(); p.pid += 17; if (p.status === 'running' && p.memMb === 0) { p.memMb = 210; p.cpu = 2; } } });
            if (c.status === 'error' || c.status === 'stopped') {
              if (c.id === 'replica' && n.diskUsed / n.diskTotal > 0.9) {
                n.processes.forEach((p) => { if (p.component === 'replica') p.status = 'crashed'; });
                this.pushEvent({ severity: 'error', source: { type: 'node', id: n.id, label: n.name }, code: 'REPL_START_FAILED', message: tr("api.mock.MockCoreAdapter.s_e0d0bc97e9") });
              } else { c.status = 'ok'; }
            }
            this.pushEvent({ severity: 'info', source: { type: 'node', id: n.id, label: n.name }, code: 'COMPONENT_RESTARTED', message: tr("api.mock.MockCoreAdapter.s_bc25e0e572", { p0: (c.name) }) });
            this.emit({ type: 'node.update', nodeId: n.id, patch: { processes: n.processes, components: n.components } });
          });
          break;
        }
        case 'reboot':
          out.push('scheduling reboot in 3s…', 'connection will drop');
          this.later(1500, () => { n.status = 'connecting'; this.emit({ type: 'node.update', nodeId: n.id, patch: { status: 'connecting' } }); this.persist(); });
          this.later(9000, () => { n.status = 'online'; n.uptimeSec = 9; n.lastSeen = Date.now(); this.pushEvent({ severity: 'info', source: { type: 'node', id: n.id, label: n.name }, code: 'NODE_BACK', message: tr("api.mock.MockCoreAdapter.s_94b510b47e", { p0: (n.name) }) }); this.emit({ type: 'node.update', nodeId: n.id, patch: { status: 'online' } }); });
          break;
        case 'exec': {
          const cmd = (args.cmd ?? '').trim();
          const allow: Record<string, string[]> = {
            'df -h': ['Filesystem  Size  Used Avail Use% Mounted on', `/dev/sda1   ${Math.round(n.diskTotal / 1024 ** 3)}G  ${Math.round(n.diskUsed / 1024 ** 3)}G  ${Math.round((n.diskTotal - n.diskUsed) / 1024 ** 3)}G  ${Math.round((n.diskUsed / n.diskTotal) * 100)}% /`],
            'uptime': [` up ${Math.floor(n.uptimeSec / 86400)} days, load average: 0.42, 0.51, 0.47`],
            'systemctl status delta-agent': ['● delta-agent.service - Delta node agent', '   Active: active (running)', `   Version: ${n.agentVersion}`],
            'journalctl -u delta-agent -n 5': ['… heartbeat ok', '… flush 128 records', '… rollup 5m', '… heartbeat ok', '… settings reloaded'],
          };
          if (!allow[cmd]) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a4cfd65190"), tr("api.mock.MockCoreAdapter.s_d11db8a9be", { p0: (cmd || tr("api.mock.MockCoreAdapter.s_9a3a4f5516")) }), 403, false, tr("api.mock.MockCoreAdapter.s_bd42564049", { p0: (Object.keys(allow).join(' · ')) }));
          out.push(...allow[cmd]);
          break;
        }
      }
      if (command === 'clear-cache' && n.id === 'hel-02') { n.diskUsed = n.diskTotal * 0.71; n.status = 'online'; n.errors = n.errors.filter((e) => e.code !== 'DISK_PRESSURE'); out.push('freed 18.4 GB of restic cache'); this.pushEvent({ severity: 'info', source: { type: 'node', id: n.id, label: n.name }, code: 'DISK_OK', message: tr("api.mock.MockCoreAdapter.s_46a2bc07d7") }); }
      this.pushEvent({ severity: 'info', source: { type: 'console', id: 'console' }, code: 'NODE_COMMAND', message: `${spec.label} → ${n.name}` });
      this.persist();
      this.emit({ type: 'node.update', nodeId: n.id, patch: {} });
      return { ok: true, durationMs: dur, output: out, exitCode: 0 };
    });
  }
  updateNodeConnection(nodeId: string, cfg: ConnectionConfig): Promise<NodeInfo> {
    return this.net(() => {
      const n = this.db.nodes.find((x) => x.id === nodeId);
      if (!n) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a9e9f6901a"), tr("api.mock.MockCoreAdapter.s_43ec565be2"), 404, false);
      if (!/^(wss|mqtts?|grpc|https?):\/\/|^[\w.-]+:\d+$/.test(cfg.endpoint)) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_3b3e9155f6"), tr("api.mock.MockCoreAdapter.s_d991daafc9"), 422, false, tr("api.mock.MockCoreAdapter.s_1ed4208773"));
      n.connection = cfg; this.audit('node.connection.update', n.name); this.persist();
      this.pushEvent({ severity: 'info', source: { type: 'node', id: n.id, label: n.name }, code: 'CONN_RECONFIGURED', message: tr("api.mock.MockCoreAdapter.s_af6582f6e4", { p0: (cfg.transport), p1: (cfg.heartbeatSec) }) });
      return n;
    });
  }
  createPairingTicket(kind: string, name: string): Promise<PairingTicket> {
    return this.net(() => {
      const code = Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      this.audit('node.pairing.create', `${name} (${kind})`);
      const cmd = kind === 'android' ? tr("api.mock.MockCoreAdapter.s_33fc0c2317", { p0: (code) }) : `curl -fsSL https://core.delta.lan/install.sh | sh -s -- --pair ${code} --name ${name}`;
      return { code, expiresAt: Date.now() + 10 * 60e3, command: cmd };
    });
  }
  removeNode(nodeId: string): Promise<void> {
    return this.net(() => { this.db.nodes = this.db.nodes.filter((n) => n.id !== nodeId); this.audit('node.remove', nodeId); this.persist(); });
  }

  listEvents(q: EventQuery): Promise<CoreEvent[]> {
    return this.net(() => {
      let ev = this.db.events;
      if (q.severities?.length) ev = ev.filter((e) => q.severities!.includes(e.severity));
      if (q.sourceTypes?.length) ev = ev.filter((e) => q.sourceTypes!.includes(e.source.type));
      if (q.sourceId) ev = ev.filter((e) => e.source.id === q.sourceId);
      if (q.text) { const t = q.text.toLowerCase(); ev = ev.filter((e) => (e.message + e.code + e.source.id).toLowerCase().includes(t)); }
      if (q.before) ev = ev.filter((e) => e.ts < q.before!);
      return ev.slice(0, q.limit ?? 100);
    });
  }
  listNotifications(): Promise<Notification[]> { return this.net(() => this.db.notifications.slice(0, 60), { noFail: true }); }
  markNotifications(ids: string[] | 'all', read: boolean): Promise<void> {
    return this.net(() => { this.db.notifications.forEach((n) => { if (ids === 'all' || ids.includes(n.id)) n.read = read; }); this.persist(); }, { noFail: true });
  }

  listDashboards(): Promise<DashboardConfig[]> { return this.net(() => this.db.dashboards, { noFail: true }); }
  saveDashboard(d: DashboardConfig): Promise<DashboardConfig> {
    return this.net(() => {
      const saved = { ...d, updatedAt: Date.now() };
      const idx = this.db.dashboards.findIndex((x) => x.id === d.id);
      if (idx >= 0) this.db.dashboards[idx] = saved; else this.db.dashboards.push(saved);
      this.audit('dashboard.save', d.name); this.persist();
      return saved;
    });
  }
  deleteDashboard(id: string): Promise<void> {
    return this.net(() => { this.db.dashboards = this.db.dashboards.filter((d) => d.id !== id); this.audit('dashboard.delete', id); this.persist(); });
  }

  listPrincipals(): Promise<Principal[]> { return this.net(() => this.db.principals); }
  createToken(input: { name: string; role: Role; scopes: string[]; ttlDays: number | null }) {
    return this.net(() => {
      const secret = 'delta_pat_' + Array.from(crypto.getRandomValues(new Uint8Array(18))).map((b) => b.toString(16).padStart(2, '0')).join('');
      const p: Principal = { id: uid('t'), name: input.name, kind: 'token', role: input.role, scopes: input.scopes, createdAt: Date.now(), tokenPreview: 'delta_pat_…' + secret.slice(-4), expiresAt: input.ttlDays ? Date.now() + input.ttlDays * 86400e3 : undefined };
      this.db.principals.push(p); this.audit('token.create', p.name); this.persist();
      return { principal: p, secret };
    });
  }
  revokePrincipal(id: string): Promise<void> {
    return this.net(() => {
      const p = this.db.principals.find((x) => x.id === id);
      if (p?.role === 'owner') throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a4cfd65190"), tr("api.mock.MockCoreAdapter.s_9f8ec7fd57"), 403, false);
      this.db.principals = this.db.principals.filter((x) => x.id !== id); this.audit('principal.revoke', p?.name ?? id); this.persist();
    });
  }
  updatePrincipalRole(id: string, role: Role): Promise<Principal> {
    return this.net(() => {
      const p = this.db.principals.find((x) => x.id === id);
      if (!p) throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a9e9f6901a"), tr("api.mock.MockCoreAdapter.s_def2045842"), 404, false);
      if (p.role === 'owner') throw new CoreApiError(tr("api.mock.MockCoreAdapter.s_a4cfd65190"), tr("api.mock.MockCoreAdapter.s_3bb62a5600"), 403, false);
      p.role = role; this.audit('principal.role', `${p.name} → ${role}`); this.persist(); return p;
    });
  }
  listAudit(limit = 50): Promise<AuditEntry[]> { return this.net(() => this.db.audit.slice(0, limit)); }

  subscribe(handler: (msg: RealtimeMessage) => void): () => void {
    this.listeners.add(handler);
    if (this.listeners.size === 1) this.startLive();
    queueMicrotask(() => handler({ type: 'connection', state: this.control.offline ? 'closed' : 'open', latencyMs: this.control.latencyMin }));
    return () => { this.listeners.delete(handler); if (!this.listeners.size) this.stopLive(); };
  }

  private startLive() {
    // node telemetry tick
    this.timers.push(window.setInterval(() => {
      if (this.control.offline) return;
      const t = Date.now();
      this.db.nodes.forEach((n) => {
        if (n.status === 'offline' || n.status === 'connecting') return;
        n.cpu = Math.max(1, Math.min(99, n.cpu + (Math.random() - 0.5) * 6));
        n.memUsed = Math.max(n.memTotal * 0.1, Math.min(n.memTotal * 0.97, n.memUsed * (1 + (Math.random() - 0.5) * 0.01)));
        if (n.id !== 'pixel-8' || Math.random() > 0.7) n.lastSeen = t;
        n.uptimeSec += 3;
        n.processes.forEach((p) => { if (p.status === 'running') p.cpu = Math.max(0, +(p.cpu + (Math.random() - 0.5) * 0.6).toFixed(1)); });
        this.emit({ type: 'node.update', nodeId: n.id, patch: { cpu: n.cpu, memUsed: n.memUsed, lastSeen: n.lastSeen, uptimeSec: n.uptimeSec, processes: n.processes } });
      });
      this.emit({ type: 'connection', state: 'open', latencyMs: Math.round(this.control.latencyMin * (0.8 + Math.random() * 0.4)) });
    }, 3000));
    // event stream
    const scheduleEvent = () => {
      this.timers.push(window.setTimeout(() => {
        if (this.control.liveEvents && !this.control.offline) {
          const ev = makeEvent();
          if (ev.source.id === 'dev.delta.browser' && this.db.instances['dev.delta.browser']?.status !== 'error') ev.severity = 'info', ev.message = tr("api.mock.MockCoreAdapter.s_f6e99b9c23");
          if (ev.source.id === 'hel-02' && this.db.nodes.find((n) => n.id === 'hel-02')?.status === 'online') ev.severity = 'info', ev.message = tr("api.mock.MockCoreAdapter.s_22589660b7");
          this.db.events.unshift(ev);
          this.emit({ type: 'event', event: ev });
        }
        scheduleEvent();
      }, 4000 + Math.random() * 7000));
    };
    scheduleEvent();
  }
  private stopLive() { this.timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); this.timers = []; }
}
