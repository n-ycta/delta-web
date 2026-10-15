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
  transport: z.enum(['wss', 'grpc', 'mqtt', 'adb-relay']),
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
  { id: 'ping', label: 'Ping', description: 'Проверить задержку до агента', permission: 'nodes.read' },
  { id: 'sync-now', label: 'Синхронизировать', description: 'Принудительно выгрузить буферы плагинов в ядро', permission: 'nodes.command' },
  { id: 'collect-logs', label: 'Собрать журналы', description: 'Архив логов агента за 24 ч', permission: 'nodes.command' },
  { id: 'restart-component', label: 'Перезапустить компонент', description: 'Мягкий перезапуск процесса', permission: 'nodes.command', args: [{ key: 'component', label: 'Компонент', kind: 'component' }] },
  { id: 'clear-cache', label: 'Очистить кэш', description: 'Удалить локальный кэш агента', permission: 'nodes.command' },
  { id: 'update-agent', label: 'Обновить агент', description: 'Скачать и применить последнюю версию', permission: 'nodes.admin' },
  { id: 'reboot', label: 'Перезагрузить узел', description: 'Полная перезагрузка устройства', permission: 'nodes.admin', dangerous: true },
  { id: 'exec', label: 'Выполнить', description: 'Команда из allowlist агента', permission: 'nodes.admin', dangerous: true, args: [{ key: 'cmd', label: 'Команда', kind: 'text' }] },
];

export const NODE_KIND_LABEL: Record<string, string> = {
  vps: 'VPS', android: 'Android', desktop: 'Компьютер', sbc: 'Одноплатник', container: 'Контейнер',
};
