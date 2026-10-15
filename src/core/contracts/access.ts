import { tr } from '@/i18n';
import { z } from 'zod';

export const Role = z.enum(['owner', 'operator', 'analyst', 'viewer']);
export type Role = z.infer<typeof Role>;

export const ROLE_LABEL: Record<Role, string> = { owner: tr("core.contracts.access.s_926e3b436e"), operator: tr("core.contracts.access.s_839e573793"), analyst: tr("core.contracts.access.s_a3d492a5f5"), viewer: tr("core.contracts.access.s_d7f45e99fa") };

/** Console-level permissions. Plugins request their own data scopes separately. */
export const CONSOLE_PERMISSIONS = [
  { id: 'dashboards.read', label: tr("core.contracts.access.s_6560629314") },
  { id: 'dashboards.write', label: tr("core.contracts.access.s_9371729f82") },
  { id: 'plugins.read', label: tr("core.contracts.access.s_d014a204ae") },
  { id: 'plugins.manage', label: tr("core.contracts.access.s_fd9ee22c01") },
  { id: 'nodes.read', label: tr("core.contracts.access.s_20f7774c48") },
  { id: 'nodes.command', label: tr("core.contracts.access.s_156bc8b353") },
  { id: 'nodes.admin', label: tr("core.contracts.access.s_2c96474b43") },
  { id: 'events.read', label: tr("core.contracts.access.s_f2ee635aaa") },
  { id: 'access.manage', label: tr("core.contracts.access.s_7d772b92e7") },
  { id: 'system.config', label: tr("core.contracts.access.s_63073b2b53") },
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
