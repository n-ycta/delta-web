import { tr } from '@/i18n';
import { z } from 'zod';
import { NodeKind } from './plugin';

export const NodeStatus = z.enum(['online', 'degraded', 'offline', 'connecting']);
export type NodeStatus = z.infer<typeof NodeStatus>;

export const ProcessStatus = z.enum(['running', 'sleeping', 'stopped', 'crashed', 'restarting']);
export type ProcessStatus = z.infer<typeof ProcessStatus>;

export const NodeProcess = z.object({
  pid: z.number(),
  name: z.string(),
  component: z.string(),
  cpu: z.number(),
  memMb: z.number(),
  status: ProcessStatus,
  restarts: z.number(),
  startedAt: z.number(),
});
export type NodeProcess = z.infer<typeof NodeProcess>;

export const NodeComponent = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  latest: z.string().optional(),
  status: z.enum(['ok', 'outdated', 'error', 'stopped']),
  restartable: z.boolean().default(true),
});
export type NodeComponent = z.infer<typeof NodeComponent>;

export const ConnectionConfig = z.object({
  transport: z.enum(['ssh', 'http', 'wss', 'grpc', 'mqtt', 'adb-relay']),
  endpoint: z.string(),
  heartbeatSec: z.number().int().min(5).max(600),
  reconnect: z.enum(['exponential', 'linear', 'manual']),
  maxBackoffSec: z.number().int().min(5).max(3600),
  tls: z.boolean(),
  compression: z.boolean(),
  meteredPolicy: z.enum(['full', 'essential', 'paused']).optional(),
});
export type ConnectionConfig = z.infer<typeof ConnectionConfig>;

export const NodeCommandId = z.enum(['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache', 'update-agent', 'reboot', 'exec']);
export type NodeCommandId = z.infer<typeof NodeCommandId>;

export const NodeInfo = z.object({
  id: z.string(),
  name: z.string(),
  kind: NodeKind,
  os: z.string(),
  arch: z.string(),
  address: z.string(),
  location: z.string().optional(),
  status: NodeStatus,
  lastSeen: z.number(),
  uptimeSec: z.number(),
  agentVersion: z.string(),
  cpu: z.number(),
  telemetryUnavailable: z.array(z.string()).optional(),
  cores: z.number(),
  memUsed: z.number(),
  memTotal: z.number(),
  diskUsed: z.number(),
  diskTotal: z.number(),
  battery: z.object({ level: z.number(), charging: z.boolean() }).optional(),
  tempC: z.number().optional(),
  latencyMs: z.number().optional(),
  tags: z.array(z.string()),
  pluginIds: z.array(z.string()),
  components: z.array(NodeComponent),
  processes: z.array(NodeProcess),
  trustedAdmin:z.boolean().optional(),
  sshConnection:z.object({host:z.string(),port:z.number(),fingerprint:z.string(),component:z.string()}).optional(),
  connection: ConnectionConfig,
  allowedCommands: z.array(NodeCommandId),
  errors: z.array(z.object({ ts: z.number(), code: z.string(), message: z.string(), component: z.string(), count: z.number() })),
});
export type NodeInfo = z.infer<typeof NodeInfo>;

export type UptimeCell = { day: number; state: 'up' | 'partial' | 'down' | 'nodata'; availability: number };

export interface NodeCommandSpec {
  id: NodeCommandId;
  label: string;
  description: string;
  permission: string;
  dangerous?: boolean;
  args?: { key: string; label: string; kind: 'component' | 'text' }[];
}

export const NODE_COMMANDS: NodeCommandSpec[] = [
  { id: 'ping', label: tr("core.contracts.node.s_6b68e97973"), description: tr("core.contracts.node.s_774c6a8a7b"), permission: 'nodes.read' },
  { id: 'sync-now', label: tr("core.contracts.node.s_289c55ebed"), description: tr("core.contracts.node.s_4df9b00610"), permission: 'nodes.command' },
  { id: 'collect-logs', label: tr("core.contracts.node.s_ef2b215031"), description: tr("core.contracts.node.s_d58e4d4983"), permission: 'nodes.command' },
  { id: 'restart-component', label: tr("core.contracts.node.s_80630f7131"), description: tr("core.contracts.node.s_082be902ee"), permission: 'nodes.command', args: [{ key: 'component', label: tr("core.contracts.node.s_8879f45a65"), kind: 'component' }] },
  { id: 'clear-cache', label: tr("core.contracts.node.s_e98d5f8913"), description: tr("core.contracts.node.s_a233bae3c7"), permission: 'nodes.command' },
  { id: 'update-agent', label: tr("core.contracts.node.s_d6b3a32a3d"), description: tr("core.contracts.node.s_2a9e1579bd"), permission: 'nodes.admin' },
  { id: 'reboot', label: tr("core.contracts.node.s_b8c3fdd42f"), description: tr("core.contracts.node.s_5d7898f96e"), permission: 'nodes.admin', dangerous: true },
  { id: 'exec', label: tr("core.contracts.node.s_224c8e93c8"), description: tr("core.contracts.node.s_5bef52c804"), permission: 'nodes.admin', dangerous: true, args: [{ key: 'cmd', label: tr("core.contracts.node.s_0fe2342c2e"), kind: 'text' }] },
];

export const NODE_KIND_LABEL: Record<string, string> = {
  vps: 'VPS', android: 'Android', desktop: tr("core.contracts.node.s_1db1b7e7a7"), sbc: tr("core.contracts.node.s_181d62d2ec"), container: tr("core.contracts.node.s_575ce6aee1"),
};
