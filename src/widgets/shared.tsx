import { tr } from '@/i18n';
import { queryStep } from './intervals';
import { useMemo, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { MetricDescriptor, MetricQuery, MetricResult, Series, WidgetConfig } from '@/core/contracts';
import { fmtAxisTime, fmtDateTime, fmtValue } from '@/core/lib/format';
import { useMetric } from '@/app/data';
import { useChartColors } from '@/app/theme';
import { ChartSkeleton, Empty, ErrorState } from '@/ui/states';
import type { WidgetContext } from './types';

export function buildQuery(cfg: WidgetConfig, ctx: WidgetContext, overrides: Partial<MetricQuery> = {}): MetricQuery | null {
  if (cfg.source.kind !== 'metric') return null;
  const s = cfg.source;
  return {
    pluginId: s.pluginId, metricId: s.metricId,
    range: { preset: cfg.display.rangeOverride ?? ctx.range },
    stepMs: queryStep(cfg.display.stepMs, cfg.display.rangeOverride ?? ctx.range),
    aggregation: s.aggregation, groupBy: s.groupBy, filters: s.filters,
    compare: cfg.display.compare ? 'previous' : 'none',
    ...overrides,
  };
}

/** Fetches the widget's metric and renders loading / error / empty states uniformly. */
export function MetricData({ cfg, ctx, overrides, children, isEmpty }: {
  cfg: WidgetConfig; ctx: WidgetContext; overrides?: Partial<MetricQuery>;
  children: (r: MetricResult, m: MetricDescriptor) => ReactNode;
  isEmpty?: (r: MetricResult) => boolean;
}) {
  const q = buildQuery(cfg, ctx, overrides);
  const res = useMetric(q, ctx.refreshSec);
  if (!ctx.metric) return null;
  if (res.loading && !res.data) return <ChartSkeleton />;
  if (res.error && !res.data) return <ErrorState compact error={res.error} onRetry={res.refetch} />;
  const r = res.data!;
  const empty = isEmpty ? isEmpty(r) : !r.series.some((s) => s.points.some((p) => p.v !== null)) && !r.categories?.length && !r.buckets?.length;
  if (empty) return <Empty compact title={r.emptyState?.title ?? tr("widgets.shared.s_8c7349e9ee")}>{r.emptyState?.description ?? tr("widgets.shared.s_dc798432ac")}</Empty>;
  return <>{children(r, ctx.metric)}</>;
}

export function useSeriesColors(series: Series[], cfg: WidgetConfig) {
  const c = useChartColors(cfg.display.palette);
  return useMemo(() => {
    const map: Record<string, string> = {};
    series.forEach((s, i) => {
      const base = s.key.replace(/__prev$/, '');
      const idx = series.findIndex((x) => x.key === base);
      map[s.key] = cfg.display.colors?.[base] ?? s.color ?? c.series[(idx >= 0 ? idx : i) % c.series.length];
    });
    return map;
  }, [series, cfg.display.colors, c.series]);
}

export function toRows(series: Series[]) {
  const map = new Map<number, Record<string, number | null>>();
  series.forEach((s) => s.points.forEach((p) => {
    let row = map.get(p.t); if (!row) map.set(p.t, (row = { t: p.t }));
    row[s.key] = p.v;
  }));
  return [...map.values()].sort((a, b) => (a.t as number) - (b.t as number));
}

export function Delta({ cur, prev, better }: { cur: number | null; prev: number | null; better: 'higher' | 'lower' | 'neutral' }) {
  if (cur === null || prev === null || prev === 0) return <span className="delta neutral">{tr("widgets.shared.s_1b93795b97")}</span>;
  const d = (cur - prev) / Math.abs(prev);
  const up = d > 0.005, down = d < -0.005;
  const good = better === 'neutral' ? 'neutral' : (better === 'higher' ? up : down) ? 'good' : (better === 'higher' ? down : up) ? 'bad' : 'neutral';
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return <span className={`delta ${good}`} title={tr("widgets.shared.s_d59a35c97b")}><Icon size={12} />{(Math.abs(d) * 100).toFixed(1)}{tr("widgets.shared.s_4345cb1fa2")}</span>;
}

export function ChartTooltip({ active, payload, label, unit, decimals, span, labels }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="tt">{span !== undefined ? fmtDateTime(label) : label}</div>
      {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => (
        <div key={p.dataKey} className="tr">
          <span className="dot" style={{ background: p.color ?? p.stroke ?? p.fill }} />
          <span className="truncate" style={{ maxWidth: 160 }}>{labels?.[p.dataKey] ?? p.name}</span>
          <span className="v">{fmtValue(p.value, unit, decimals)}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items, hidden, onToggle }: { items: { key: string; label: string; color: string; dashed?: boolean }[]; hidden: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <button key={it.key} aria-pressed={!hidden.includes(it.key)} onClick={() => onToggle(it.key)} title={tr("widgets.shared.s_5b3c9febb0")}>
          <span className={`sw ${it.dashed ? 'dash' : ''}`} style={{ background: it.color, color: it.color }} />{it.label}
        </button>
      ))}
    </div>
  );
}

export const axisTick = (span: number) => (t: number) => fmtAxisTime(t, span);
export const valueTick = (unit?: string) => (v: number) => fmtValue(v, unit === 'ratio' ? 'ratio' : unit === 's' ? 's' : '', 0);
