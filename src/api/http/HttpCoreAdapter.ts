import type { UpdateSettings, UpdateStatus } from '../updates';
import { tr, language } from '@/i18n';
import type { ConnectionConfig, CoreEvent, DashboardConfig, EventQuery, MetricQuery, NodeCommandId, RealtimeMessage, Role } from '@/core/contracts';
import type { CoreApi } from '../types';
import { CoreApiError } from '../types';

export interface HttpAdapterOptions { baseUrl: string; token?: string; timeoutMs?: number }
/** Delta v1 adapter. All UI operations call the independent web component. */
export class HttpCoreAdapter implements CoreApi {
  readonly mode = 'http' as const;
  readonly endpoint: string;
  private listeners = new Set<(m: RealtimeMessage) => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private eventCursor=0;
  private eventIds=new Set<string>();
  constructor(private opts: HttpAdapterOptions) { this.endpoint = opts.baseUrl.replace(/\/$/, '').replace(/\/v1$/, ''); }
  private async call<T = any>(action: string, args: unknown = {}): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 35000);
    try {
      const res = await fetch(this.endpoint + '/v1/call', { method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', ...(this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {}) },
        body: JSON.stringify({ capability: `web.${action}`, args: {...(args as object), _locale: language} }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new CoreApiError(data.error?.code ?? `HTTP_${res.status}`, data.error?.message ?? res.statusText, res.status, res.status >= 500);
      return data.result as T;
    } catch (e) {
      if (e instanceof CoreApiError) throw e;
      throw new CoreApiError(ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK', ctrl.signal.aborted ? tr("api.http.HttpCoreAdapter.s_404bda430d") : tr("api.http.HttpCoreAdapter.s_6cbca9c05a", { p0: (this.endpoint) }), 0, true, tr("api.http.HttpCoreAdapter.s_cc8e04188d"));
    } finally { clearTimeout(timer); }
  }
  info() { return this.call('info'); }
  updateStatus(){return this.call<UpdateStatus>('updates_status')}
  checkUpdates(){return this.call<UpdateStatus>('updates_check')}
  configureUpdates(values:UpdateSettings){return this.call<UpdateSettings>('updates_settings',{values})}
  installUpdates(target:string){return this.call<{accepted:boolean;jobId:string}>('updates_install',{target})}
  listPlugins() { return this.call('plugins_list'); }
  getPluginLogs(id: string, limit = 80) { return this.call('plugins_logs', { id, limit }); }
  installPlugin(id: string, request: unknown) { return this.call('plugins_install', { id, request }); }
  updatePlugin(id: string) { return this.call('plugins_update', { id }); }
  setPluginEnabled(id: string, enabled: boolean) { return this.call('plugins_enable', { id, enabled }); }
  uninstallPlugin(id: string, opts: { purgeData: boolean }) { return this.call<void>('plugins_uninstall', { id, ...opts }); }
  updatePluginSettings(id: string, values: Record<string, unknown>, nodeId?: string) { return this.call('plugins_settings', { id, values, nodeId }); }
  setPluginPermissions(id: string, scopes: string[]) { return this.call('plugins_permissions', { id, scopes }); }
  setPluginNodes(id: string, nodeIds: string[]) { return this.call('plugins_nodes', { id, nodeIds }); }
  runPluginAction(id: string, actionId: string) { return this.call('plugins_action', { id, actionId }); }
  queryMetric(query: MetricQuery) { return this.call('metrics_query', { query }); }
  listNodes() { return this.call('nodes_list'); }
  getNodeHistory(id: string, rangeMs: number) { return this.call('nodes_history', { id, rangeMs }); }
  getNodeUptime(id: string, days: number) { return this.call('nodes_uptime', { id, days }); }
  runNodeCommand(id: string, command: NodeCommandId, args?: Record<string, string>) { return this.call('nodes_command', { id, command, args }); }
  updateNodeConnection(id: string, config: ConnectionConfig) { return this.call('nodes_connection', { id, config }); }
  createPairingTicket(kind: string, name: string) { return this.call('nodes_pair', { kind, name }); }
  removeNode(id: string) { return this.call<void>('nodes_remove', { id }); }
  listEvents(query: EventQuery) { return this.call<CoreEvent[]>('events_list', { query }); }
  listNotifications() { return this.call('notifications_list'); }
  markNotifications(ids: string[] | 'all', read: boolean) { return this.call<void>('notifications_mark', { ids, read }); }
  listDashboards() { return this.call('dashboards_list'); }
  saveDashboard(dashboard: DashboardConfig) { return this.call('dashboards_save', { dashboard }); }
  deleteDashboard(id: string) { return this.call<void>('dashboards_delete', { id }); }
  listPrincipals() { return this.call('access_list'); }
  createToken(input: { name: string; role: Role; scopes: string[]; ttlDays: number | null }) { return this.call('access_create', { input }); }
  revokePrincipal(id: string) { return this.call<void>('access_revoke', { id }); }
  updatePrincipalRole(id: string, role: Role) { return this.call('access_role', { id, role }); }
  listAudit(limit = 50) { return this.call('audit_list', { limit }); }
  subscribe(handler: (msg: RealtimeMessage) => void): () => void {
    const first = !this.listeners.size; this.listeners.add(handler); if (first) void this.poll();
    return () => { this.listeners.delete(handler); if (!this.listeners.size) clearTimeout(this.timer); };
  }
  private emit(m: RealtimeMessage) { this.listeners.forEach(l => l(m)); }
  private async poll() {
    if (!this.listeners.size) return;
    const start = Date.now();
    try {
      const nodes = await this.listNodes();
      this.emit({ type: 'connection', state: 'open', latencyMs: Date.now() - start });
      nodes.forEach((node: any) => this.emit({ type: 'node.update', nodeId: node.id, patch: node }));
      const plugins = await this.listPlugins(); plugins.forEach((p: any) => this.emit({ type: 'plugin.update', pluginId: p.instance.pluginId }));
    } catch { this.emit({ type: 'connection', state: 'reconnecting' }); }
    try {
      const events = await this.listEvents({limit:1000,...(this.eventCursor?{after:this.eventCursor-1}:{})});
      for(const event of [...events].reverse()){if(!this.eventIds.has(event.id)){this.eventIds.add(event.id);this.emit({type:'event',event})}this.eventCursor=Math.max(this.eventCursor,event.ts)}
      if(this.eventIds.size>5000)this.eventIds=new Set(events.map(e=>e.id));
    } catch { /* A token without events.read must still receive node/plugin updates. */ }
    if (this.listeners.size) this.timer = setTimeout(() => void this.poll(), 15000);
  }
}
