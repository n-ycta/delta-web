import type { ConnectionConfig, DashboardConfig, EventQuery, MetricQuery, NodeCommandId, RealtimeMessage, Role } from '@/core/contracts';
import type { CoreApi } from '../types';
import { CoreApiError } from '../types';

export interface HttpAdapterOptions { baseUrl: string; token?: string; timeoutMs?: number }

/**
 * REST + WebSocket adapter for the real Delta core (API v2).
 * Endpoint map is documented in docs/core-api.md; responses share the CoreApi types,
 * plugin manifests are still validated by the console after loading.
 */
export class HttpCoreAdapter implements CoreApi {
  readonly mode = 'http' as const;
  readonly endpoint: string;
  private ws?: WebSocket;
  private listeners = new Set<(m: RealtimeMessage) => void>();
  private backoff = 1000;
  private closed = false;

  constructor(private opts: HttpAdapterOptions) {
    this.endpoint = opts.baseUrl.replace(/\/$/, '');
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 15000);
    let res: Response;
    try {
      res = await fetch(this.endpoint + path, {
        method,
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-delta-client': 'console/0.9', ...(this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new CoreApiError(ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK', ctrl.signal.aborted ? 'Ядро не ответило вовремя' : `Нет связи с ${this.endpoint}`, 0, true, 'Проверьте адрес ядра в «Настройки → Подключение»');
    } finally { clearTimeout(timer); }
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    try { data = await res.json(); } catch { /* non-json */ }
    if (!res.ok) {
      const err = (data ?? {}) as { code?: string; message?: string; hint?: string };
      throw new CoreApiError(err.code ?? `HTTP_${res.status}`, err.message ?? res.statusText, res.status, res.status >= 500 || res.status === 429, err.hint ?? (res.status === 401 ? 'Токен недействителен — обновите его в настройках подключения' : undefined));
    }
    return data as T;
  }

  info() { return this.req<any>('GET', '/info'); }
  listPlugins() { return this.req<any>('GET', '/plugins'); }
  getPluginLogs(id: string, limit = 80) { return this.req<any>('GET', `/plugins/${encodeURIComponent(id)}/logs?limit=${limit}`); }
  installPlugin(id: string, req: unknown) { return this.req<any>('POST', `/plugins/${encodeURIComponent(id)}/install`, req); }
  updatePlugin(id: string) { return this.req<any>('POST', `/plugins/${encodeURIComponent(id)}/update`); }
  setPluginEnabled(id: string, enabled: boolean) { return this.req<any>('POST', `/plugins/${encodeURIComponent(id)}/${enabled ? 'enable' : 'disable'}`); }
  uninstallPlugin(id: string, opts: { purgeData: boolean }) { return this.req<void>('DELETE', `/plugins/${encodeURIComponent(id)}?purge=${opts.purgeData}`); }
  updatePluginSettings(id: string, values: Record<string, unknown>) { return this.req<any>('PATCH', `/plugins/${encodeURIComponent(id)}/settings`, values); }
  setPluginPermissions(id: string, scopes: string[]) { return this.req<any>('PUT', `/plugins/${encodeURIComponent(id)}/permissions`, { scopes }); }
  setPluginNodes(id: string, nodeIds: string[]) { return this.req<any>('PUT', `/plugins/${encodeURIComponent(id)}/nodes`, { nodeIds }); }
  runPluginAction(id: string, actionId: string) { return this.req<any>('POST', `/plugins/${encodeURIComponent(id)}/actions/${encodeURIComponent(actionId)}`); }
  queryMetric(q: MetricQuery) { return this.req<any>('POST', '/metrics/query', q); }
  listNodes() { return this.req<any>('GET', '/nodes'); }
  getNodeHistory(id: string, rangeMs: number) { return this.req<any>('GET', `/nodes/${id}/history?range=${rangeMs}`); }
  getNodeUptime(id: string, days: number) { return this.req<any>('GET', `/nodes/${id}/uptime?days=${days}`); }
  runNodeCommand(id: string, command: NodeCommandId, args?: Record<string, string>) { return this.req<any>('POST', `/nodes/${id}/commands`, { command, args }); }
  updateNodeConnection(id: string, cfg: ConnectionConfig) { return this.req<any>('PUT', `/nodes/${id}/connection`, cfg); }
  createPairingTicket(kind: string, name: string) { return this.req<any>('POST', '/nodes/pairing', { kind, name }); }
  removeNode(id: string) { return this.req<void>('DELETE', `/nodes/${id}`); }
  listEvents(q: EventQuery) {
    const p = new URLSearchParams();
    q.severities?.forEach((s) => p.append('severity', s));
    q.sourceTypes?.forEach((s) => p.append('source', s));
    if (q.sourceId) p.set('sourceId', q.sourceId);
    if (q.text) p.set('q', q.text);
    if (q.limit) p.set('limit', String(q.limit));
    if (q.before) p.set('before', String(q.before));
    return this.req<any>('GET', `/events?${p}`);
  }
  listNotifications() { return this.req<any>('GET', '/notifications'); }
  markNotifications(ids: string[] | 'all', read: boolean) { return this.req<void>('POST', '/notifications/mark', { ids, read }); }
  listDashboards() { return this.req<any>('GET', '/console/dashboards'); }
  saveDashboard(d: DashboardConfig) { return this.req<any>('PUT', `/console/dashboards/${d.id}`, d); }
  deleteDashboard(id: string) { return this.req<void>('DELETE', `/console/dashboards/${id}`); }
  listPrincipals() { return this.req<any>('GET', '/access/principals'); }
  createToken(input: { name: string; role: Role; scopes: string[]; ttlDays: number | null }) { return this.req<any>('POST', '/access/tokens', input); }
  revokePrincipal(id: string) { return this.req<void>('DELETE', `/access/principals/${id}`); }
  updatePrincipalRole(id: string, role: Role) { return this.req<any>('PATCH', `/access/principals/${id}`, { role }); }
  listAudit(limit = 50) { return this.req<any>('GET', `/access/audit?limit=${limit}`); }

  subscribe(handler: (msg: RealtimeMessage) => void): () => void {
    this.listeners.add(handler);
    if (!this.ws) this.connect();
    return () => { this.listeners.delete(handler); if (!this.listeners.size) { this.closed = true; this.ws?.close(); this.ws = undefined; } };
  }

  private connect() {
    this.closed = false;
    const url = this.endpoint.replace(/^http/, 'ws') + '/stream' + (this.opts.token ? `?token=${encodeURIComponent(this.opts.token)}` : '');
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { this.scheduleReconnect(); return; }
    this.ws = ws;
    const sentAt = Date.now();
    ws.onopen = () => { this.backoff = 1000; this.emit({ type: 'connection', state: 'open', latencyMs: Date.now() - sentAt }); };
    ws.onmessage = (e) => { try { this.emit(JSON.parse(e.data) as RealtimeMessage); } catch { /* ignore malformed frames */ } };
    ws.onclose = () => { this.ws = undefined; if (!this.closed) { this.emit({ type: 'connection', state: 'reconnecting' }); this.scheduleReconnect(); } };
    ws.onerror = () => ws.close();
  }
  private scheduleReconnect() {
    setTimeout(() => { if (!this.closed && this.listeners.size) this.connect(); }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }
  private emit(m: RealtimeMessage) { this.listeners.forEach((l) => l(m)); }
}
