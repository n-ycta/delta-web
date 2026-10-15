import { z } from 'zod';

export const Role = z.enum(['owner', 'operator', 'analyst', 'viewer']);
export type Role = z.infer<typeof Role>;

export const ROLE_LABEL: Record<Role, string> = { owner: 'Владелец', operator: 'Оператор', analyst: 'Аналитик', viewer: 'Наблюдатель' };

/** Console-level permissions. Plugins request their own data scopes separately. */
export const CONSOLE_PERMISSIONS = [
  { id: 'dashboards.read', label: 'Просмотр дашбордов' },
  { id: 'dashboards.write', label: 'Редактирование дашбордов' },
  { id: 'plugins.read', label: 'Просмотр плагинов' },
  { id: 'plugins.manage', label: 'Установка и настройка плагинов' },
  { id: 'nodes.read', label: 'Просмотр узлов' },
  { id: 'nodes.command', label: 'Команды узлам' },
  { id: 'nodes.admin', label: 'Администрирование узлов' },
  { id: 'events.read', label: 'Журнал событий' },
  { id: 'access.manage', label: 'Управление доступом' },
  { id: 'system.config', label: 'Конфигурация системы' },
] as const;
export type ConsolePermission = (typeof CONSOLE_PERMISSIONS)[number]['id'];

export const ROLE_PERMISSIONS: Record<Role, ConsolePermission[]> = {
  owner: CONSOLE_PERMISSIONS.map((p) => p.id),
  operator: ['dashboards.read', 'dashboards.write', 'plugins.read', 'plugins.manage', 'nodes.read', 'nodes.command', 'events.read'],
  analyst: ['dashboards.read', 'dashboards.write', 'plugins.read', 'nodes.read', 'events.read'],
  viewer: ['dashboards.read', 'plugins.read', 'nodes.read'],
};

export const Principal = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  kind: z.enum(['user', 'token', 'node']),
  role: Role,
  createdAt: z.number(),
  lastActive: z.number().optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.number().optional(),
  tokenPreview: z.string().optional(),
  mfa: z.boolean().optional(),
});
export type Principal = z.infer<typeof Principal>;

export const AuditEntry = z.object({ id: z.string(), ts: z.number(), actor: z.string(), action: z.string(), target: z.string(), ip: z.string().optional() });
export type AuditEntry = z.infer<typeof AuditEntry>;
