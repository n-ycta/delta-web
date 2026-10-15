import { tr } from '@/i18n';
import { z } from 'zod';
import { Id, ReverseDnsId, SemverStr } from './common';

/**
 * Plugin manifest — what a plugin publishes through the core.
 * The console never hardcodes plugin UIs: everything is derived from this contract.
 */

export const MetricKind = z.enum([
  'gauge',        // instantaneous value (temperature, wpm)
  'counter',      // monotonically accumulated per bucket (keystrokes, steps)
  'ratio',        // 0..1 (accuracy, battery)
  'duration',     // seconds (sleep, focus time)
  'distribution', // value histogram (key latency)
  'categorical',  // counts per category (top apps, error keys)
  'event',        // discrete occurrences
]);
export type MetricKind = z.infer<typeof MetricKind>;

export const Aggregation = z.enum(['avg', 'sum', 'min', 'max', 'last', 'p95', 'count']);
export type Aggregation = z.infer<typeof Aggregation>;

export const Dimension = z.object({
  id: Id,
  label: z.string(),
  values: z.array(z.object({ id: z.string(), label: z.string(), color: z.string().optional() })).optional(),
});
export type Dimension = z.infer<typeof Dimension>;

export const MetricDescriptor = z.object({
  id: Id,
  label: z.string().min(1),
  description: z.string().optional(),
  kind: MetricKind,
  unit: z.string().default(''),
  precision: z.number().int().min(0).max(6).default(1),
  better: z.enum(['higher', 'lower', 'neutral']).default('neutral'),
  range: z.object({ min: z.number(), max: z.number() }).optional(),
  dimensions: z.array(Dimension).default([]),
  aggregations: z.array(Aggregation).min(1).default(['avg']),
  defaultAggregation: Aggregation.optional(),
  defaultFilters: z.record(z.array(z.string())).optional(),
  /** Visualization hints, may contain ids this console does not know (they are reported, not fatal). */
  visualizations: z.array(z.string()).default([]),
  thresholds: z.array(z.object({ value: z.number(), severity: z.enum(['warn', 'error']), label: z.string().optional() })).optional(),
  tags: z.array(z.string()).default([]),
});
export type MetricDescriptor = z.infer<typeof MetricDescriptor>;

const SettingBase = z.object({
  key: Id,
  label: z.string(),
  help: z.string().optional(),
  group: z.string().optional(),
  requiresRestart: z.boolean().optional(),
  confirmation: z.object({ id: z.string(), title: z.string(), body: z.string(), acceptLabel: z.string() }).optional(),
});

export const SettingField = z.discriminatedUnion('type', [
  SettingBase.extend({ type: z.literal('string'), default: z.string().optional(), placeholder: z.string().optional(), pattern: z.string().optional() }),
  SettingBase.extend({ type: z.literal('secret'), placeholder: z.string().optional() }),
  SettingBase.extend({ type: z.literal('number'), default: z.number().optional(), min: z.number().optional(), max: z.number().optional(), step: z.number().optional(), unit: z.string().optional() }),
  SettingBase.extend({ type: z.literal('boolean'), default: z.boolean().optional() }),
  SettingBase.extend({ type: z.literal('select'), default: z.string().optional(), options: z.array(z.object({ value: z.string(), label: z.string() })).min(1) }),
  SettingBase.extend({ type: z.literal('multiselect'), default: z.array(z.string()).optional(), options: z.array(z.object({ value: z.string(), label: z.string() })).min(1) }),
]);
export type SettingField = z.infer<typeof SettingField>;

export const PermissionScope = z.string().regex(/^(admin|(?:call|admin|register):[a-zA-Z0-9_.*-]+|[a-z]+(?:\.[a-z_*]+)+)$/, tr("core.contracts.plugin.s_944430b656"));
export const PermissionRequest = z.object({
  scope: PermissionScope,
  reason: z.string(),
  optional: z.boolean().default(false),
});
export type PermissionRequest = z.infer<typeof PermissionRequest>;

export const PluginAction = z.object({
  id: Id,
  label: z.string(),
  description: z.string().optional(),
  dangerous: z.boolean().default(false),
});

export const NodeKind = z.enum(['vps', 'android', 'desktop', 'sbc', 'container']);
export type NodeKind = z.infer<typeof NodeKind>;

export const PluginCategory = z.enum(['input', 'health', 'finance', 'dev', 'media', 'home', 'system', 'location', 'productivity', 'other']);
export type PluginCategory = z.infer<typeof PluginCategory>;

export const PluginManifest = z.object({
  id: ReverseDnsId,
  name: z.string().min(1).max(64),
  version: SemverStr,
  /** semver range of panel contract this plugin was built against */
  contract: z.string().min(1),
  publisher: z.string(),
  description: z.string(),
  icon: z.string().default('box'),
  category: PluginCategory.default('other'),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  defaultLocale: z.enum(['en','ru']).default('en'),
  localizations: z.record(z.record(z.unknown())).optional(),
  endpoints: z.object({status:z.string().optional(),settings:z.string().optional()}).optional(),
  screenshots: z.array(z.object({ url: z.string().url(), alt: z.string().default(''), locale: z.enum(['en','ru']).optional() })).default([]),
  permissions: z.array(PermissionRequest).default([]),
  settings: z.array(SettingField).default([]),
  metrics: z.array(MetricDescriptor).default([]),
  actions: z.array(PluginAction).default([]),
  capabilities: z.array(z.string()).default([]),
  runtime: z.object({
    targets: z.array(NodeKind).min(1),
    minAgent: SemverStr.optional(),
  }),
  changelog: z.array(z.object({ version: SemverStr, date: z.string(), notes: z.array(z.string()) })).optional(),
});
export type PluginManifest = z.infer<typeof PluginManifest>;
export type PluginManifestInput = z.input<typeof PluginManifest>;

export const PluginStatus = z.enum(['active', 'disabled', 'error', 'degraded', 'installing', 'updating', 'available', 'incompatible']);
export type PluginStatus = z.infer<typeof PluginStatus>;

export const PluginNotice = z.object({id:z.string(),severity:z.enum(['info','warn','err']),message:z.string(),localizations:z.record(z.string()).optional()});
export const PluginInstance = z.object({
  notices: z.array(PluginNotice).optional(),
  pluginId: ReverseDnsId,
  status: PluginStatus,
  installedVersion: SemverStr.optional(),
  latestVersion: SemverStr,
  nodeIds: z.array(z.string()).default([]),
  settings: z.record(z.unknown()).default({}),
  grantedPermissions: z.array(z.string()).default([]),
  installedAt: z.number().optional(),
  lastSyncAt: z.number().optional(),
  eventsPerMin: z.number().optional(),
  error: z.object({ code: z.string(), message: z.string(), hint: z.string().optional() }).optional(),
});
export type PluginInstance = z.infer<typeof PluginInstance>;

export interface PluginEntry {
  manifest: PluginManifest;
  /** Latest manifest available in the registry (may differ from installed). */
  latest: PluginManifest;
  instance: PluginInstance;
  validation: import('./validate').ValidationReport;
}

/** Capabilities the console understands. Anything else is reported as "unknown" but tolerated. */
export const KNOWN_CAPABILITIES: Record<string, string> = {
  'metrics.timeseries': tr("core.contracts.plugin.s_944f01fb2d"),
  'metrics.realtime': tr("core.contracts.plugin.s_ddf80a0661"),
  'events.stream': tr("core.contracts.plugin.s_9ad64a41fa"),
  'actions': tr("core.contracts.plugin.s_82abc91d7b"),
  'status.read': tr('pluginContract.status'),
  'settings.read': tr('pluginContract.settings'),
  'settings.live': tr("core.contracts.plugin.s_c52a75b7a8"),
  'export.csv': tr("core.contracts.plugin.s_4dc23635b8"),
  'storage.local': tr("core.contracts.plugin.s_3befbc9a45"),
};
