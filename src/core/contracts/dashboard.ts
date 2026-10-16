import { z } from 'zod';
import { Aggregation } from './plugin';
import { TimeRangePreset } from './common';

export const MetricSource = z.object({
  kind: z.literal('metric'),
  pluginId: z.string(),
  metricId: z.string(),
  aggregation: Aggregation.optional(),
  groupBy: z.string().optional(),
  filters: z.record(z.array(z.string())).optional(),
});
export const SystemSource = z.object({
  kind: z.literal('system'),
  feed: z.enum(['nodes', 'events', 'alerts', 'plugins', 'note']),
  params: z.record(z.unknown()).optional(),
});
export const PluginViewSource = z.object({
  kind: z.literal('plugin-view'),
  pluginId: z.string(),
  viewId: z.string(),
  nodeId: z.string().optional(),
  args: z.record(z.unknown()).optional(),
});
export const WidgetSource = z.discriminatedUnion('kind', [
  MetricSource,
  SystemSource,
  PluginViewSource,
]);
export type WidgetSource = z.infer<typeof WidgetSource>;
export type MetricSource = z.infer<typeof MetricSource>;

export const WidgetDisplay = z
  .object({
    chart: z.enum(['dots', 'line', 'area', 'bar', 'step']).optional(),
    connectNulls: z.boolean().optional(),
    stepMs: z.number().int().min(1000).max(604800000).nullable().optional(),
    stacked: z.boolean().optional(),
    showLegend: z.boolean().optional(),
    showGrid: z.boolean().optional(),
    compare: z.boolean().optional(),
    colors: z.record(z.string()).optional(),
    palette: z.string().optional(),
    decimals: z.number().int().min(0).max(4).optional(),
    yMin: z.number().nullable().optional(),
    yMax: z.number().nullable().optional(),
    showThresholds: z.boolean().optional(),
    rangeOverride: TimeRangePreset.nullable().optional(),
    limit: z.number().int().min(1).max(50).optional(),
    text: z.string().optional(),
  })
  .passthrough();
export type WidgetDisplay = z.infer<typeof WidgetDisplay>;

export const WidgetLayout = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});
export type WidgetLayout = z.infer<typeof WidgetLayout>;

export const WidgetConfig = z.object({
  id: z.string(),
  type: z.string(),
  typeVersion: z.string().default('1.0.0'),
  title: z.string().optional(),
  source: WidgetSource,
  display: WidgetDisplay.default({}),
  layout: WidgetLayout,
});
export type WidgetConfig = z.infer<typeof WidgetConfig>;

export const DashboardConfig = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  icon: z.string().optional(),
  origin: z.enum(['user', 'generated', 'home']).default('user'),
  generatedFrom: z.string().optional(),
  range: TimeRangePreset.default('24h'),
  refreshSec: z.number().int().min(0).default(30),
  widgets: z.array(WidgetConfig),
  pinned: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type DashboardConfig = z.infer<typeof DashboardConfig>;

export const CONFIG_EXPORT_FORMAT = 'delta.console.config';
export const ConfigBundle = z.object({
  format: z.literal(CONFIG_EXPORT_FORMAT),
  formatVersion: z.number().int().min(1).max(2),
  exportedAt: z.string(),
  dashboards: z.array(DashboardConfig).default([]),
  pluginSettings: z.record(z.record(z.unknown())).default({}),
  preferences: z.record(z.unknown()).default({}),
});
export type ConfigBundle = z.infer<typeof ConfigBundle>;
