import type { UpdateSettings, UpdateStatus } from './updates';
import { tr } from '@/i18n';
import type {
  AuditEntry, ConnectionConfig, CoreEvent, DashboardConfig, EventQuery, MetricQuery, MetricResult, NodeCommandId,
  NodeInfo, Notification, PluginInstance, Principal, RealtimeMessage, Role, Series, UptimeCell,
} from '@/core/contracts';

/**
 * CoreApi — the only boundary between UI and the Delta core.
 * Components never import adapters directly; they receive an implementation via <ApiProvider>.
 * Plugin manifests arrive as `unknown` on purpose: the console validates every contract itself.
 */
export interface CoreInfo {
  name: string;
  coreVersion: string;
  apiVersion: string;
  startedAt: number;
  region?: string;
  features: string[];
  principal?: { name: string; role: Role; scopes: string[] };
}

export interface RawPluginRecord {
  manifest: unknown;
  latest: unknown;
  instance: PluginInstance;
}

export interface LogLine { ts: number; level: 'debug' | 'info' | 'warn' | 'error'; message: string; nodeId?: string }

export interface InstallRequest { nodeIds: string[]; permissions: string[]; settings?: Record<string, unknown> }

export interface CommandResult { ok: boolean; durationMs: number; output: string[]; exitCode?: number }

export interface NodeHistory { cpu: Series; mem: Series; latency: Series }

export interface PairingTicket { code: string; expiresAt: number; command: string }

export interface SSHPreflight { ready:boolean; core:{version?:string;supported:boolean;error?:string}; ssh:{available:boolean;path?:string;version?:string;error?:string}; errors:string[];platform:string;checkedAt:number }
export interface SSHTarget { host:string; port:number; username:string }
export interface SSHProbe { ticket:string; fingerprint:string; algorithm:string; expiresAt:number }
export interface SSHInstall extends SSHTarget { ticket:string; fingerprint:string; auth:'password'|'key'; password?:string; privateKey?:string; passphrase?:string; trust:'calls'|'manage'|'mutual'; acknowledgeAdmin:boolean }
export interface SSHJob { id:string; host:string; username:string; status:'running'|'complete'|'failed'; phase:string; trust:string; peerId?:string; error?:string }

export interface CoreApi {
  readonly mode: 'mock' | 'http';
  readonly endpoint: string;

  info(): Promise<CoreInfo>;
  updateStatus(): Promise<UpdateStatus>;
  checkUpdates(): Promise<UpdateStatus>;
  configureUpdates(values:UpdateSettings): Promise<UpdateSettings>;
  installUpdates(target:string): Promise<{accepted:boolean;jobId:string}>;

  // plugins
  listPlugins(): Promise<RawPluginRecord[]>;
  getPluginLogs(pluginId: string, limit?: number): Promise<LogLine[]>;
  installPlugin(pluginId: string, req: InstallRequest): Promise<PluginInstance>;
  updatePlugin(pluginId: string): Promise<PluginInstance>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<PluginInstance>;
  uninstallPlugin(pluginId: string, opts: { purgeData: boolean }): Promise<void>;
  updatePluginSettings(pluginId: string, values?: Record<string, unknown>, nodeId?: string): Promise<PluginInstance>;
  setPluginPermissions(pluginId: string, scopes: string[]): Promise<PluginInstance>;
  setPluginNodes(pluginId: string, nodeIds: string[]): Promise<PluginInstance>;
  runPluginAction(pluginId: string, actionId: string, values?: Record<string, unknown>, nodeId?: string): Promise<CommandResult>;
  queryPluginView(pluginId:string,viewId:string,args?:Record<string,unknown>,nodeId?:string):Promise<{rows:Record<string,unknown>[];total:number}>;

  // data
  queryMetric(q: MetricQuery): Promise<MetricResult>;

  sshPreflight():Promise<SSHPreflight>;
  probeSSH(target:SSHTarget):Promise<SSHProbe>;
  installSSH(input:SSHInstall):Promise<{jobId:string}>;
  sshJob(id:string):Promise<SSHJob>;
  setNodeTrust(id:string,admin:boolean):Promise<unknown>;
  // nodes
  listNodes(): Promise<NodeInfo[]>;
  getNodeHistory(nodeId: string, rangeMs: number): Promise<NodeHistory>;
  getNodeUptime(nodeId: string, days: number): Promise<UptimeCell[]>;
  runNodeCommand(nodeId: string, command: NodeCommandId, args?: Record<string, string>): Promise<CommandResult>;
  updateNodeConnection(nodeId: string, cfg: ConnectionConfig): Promise<NodeInfo>;
  createPairingTicket(kind: string, name: string): Promise<PairingTicket>;
  removeNode(nodeId: string): Promise<void>;

  // events & notifications
  listEvents(q: EventQuery): Promise<CoreEvent[]>;
  listNotifications(): Promise<Notification[]>;
  markNotifications(ids: string[] | 'all', read: boolean): Promise<void>;

  // dashboards (persisted by core so they follow the user across devices)
  listDashboards(): Promise<DashboardConfig[]>;
  saveDashboard(d: DashboardConfig): Promise<DashboardConfig>;
  deleteDashboard(id: string): Promise<void>;

  // access
  listPrincipals(): Promise<Principal[]>;
  createToken(input: { name: string; role: Role; scopes: string[]; ttlDays: number | null }): Promise<{ principal: Principal; secret: string }>;
  revokePrincipal(id: string): Promise<void>;
  updatePrincipalRole(id: string, role: Role): Promise<Principal>;
  listAudit(limit?: number): Promise<AuditEntry[]>;

  // realtime
  subscribe(handler: (msg: RealtimeMessage) => void): () => void;
}

export class CoreApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public retryable = true,
    public hint?: string,
  ) {
    super(message);
    this.name = 'CoreApiError';
  }
}

export function toApiError(e: unknown): CoreApiError {
  if (e instanceof CoreApiError) return e;
  if (e instanceof TypeError) return new CoreApiError(tr("api.types.s_6845c6d905"), tr("api.types.s_ab95737d3d"), 0, true, tr("api.types.s_8e91a06c8a"));
  return new CoreApiError(tr("api.types.s_25ba44ec3b"), e instanceof Error ? e.message : String(e));
}
