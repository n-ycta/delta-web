import { z } from 'zod';
import { Aggregation } from './plugin';
import { TimeRange } from './common';

export const MetricQuery = z.object({
  nodeId: z.string().optional(),
  pluginId: z.string(),
  metricId: z.string(),
  range: TimeRange,
  stepMs: z.number().optional(),
  aggregation: Aggregation.optional(),
  groupBy: z.string().optional(),
  filters: z.record(z.array(z.string())).optional(),
  compare: z.enum(['none', 'previous']).default('none'),
});
export type MetricQuery = z.input<typeof MetricQuery>;

export interface SeriesPoint { t: number; v: number | null }
export interface Series { key: string; label: string; color?: string; points: SeriesPoint[] }
export interface CategoryValue { key: string; label: string; value: number; color?: string; flagged?: boolean }

export interface MetricResult {
  emptyState?: {title: string; description: string};
  query: MetricQuery;
  from: number;
  to: number;
  stepMs: number;
  series: Series[];
  /** same shape shifted onto the current window */
  compare?: Series[];
  categories?: CategoryValue[];
  /** histogram buckets for distribution metrics */
  buckets?: { lo: number; hi: number; count: number }[];
  summary: { current: number | null; previous: number | null; min: number | null; max: number | null };
  generatedAt: number;
}
