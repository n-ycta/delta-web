import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WidgetProps } from '../types';
import { axisTick, ChartTooltip, Legend, MetricData, toRows, useSeriesColors, valueTick } from '../shared';
import { useChartColors } from '@/app/theme';
import { fmtValue } from '@/core/lib/format';
import type { MetricDescriptor, MetricResult, WidgetConfig } from '@/core/contracts';
import type { WidgetContext } from '../types';

/** Bars over time buckets (counter-like metrics) or over categories (categorical). */
export function BarWidget({ config, ctx }: WidgetProps) {
  const range = config.display.rangeOverride ?? ctx.range;
  const daily = ['7d', '30d', '90d'].includes(range);
  return (
    <MetricData cfg={config} ctx={ctx} overrides={daily ? { stepMs: 86400e3 } : {}}>
      {(r, m) => (r.categories ? <CategoryBars r={r} m={m} cfg={config} /> : <TimeBars r={r} m={m} cfg={config} ctx={ctx} />)}
    </MetricData>
  );
}

function TimeBars({ r, m, cfg, ctx }: { r: MetricResult; m: MetricDescriptor; cfg: WidgetConfig; ctx: WidgetContext }) {
  const c = useChartColors(cfg.display.palette);
  const colors = useSeriesColors(r.series, cfg);
  const hidden = (cfg.display.hidden as string[] | undefined) ?? [];
  const rows = toRows(r.series);
  const span = r.to - r.from;
  const stacked = cfg.display.stacked ?? true;
  const labels = Object.fromEntries(r.series.map((s) => [s.key, s.label]));
  return (
    <>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap="16%">
            {(cfg.display.showGrid ?? true) && <CartesianGrid stroke={c.grid} vertical={false} />}
            <XAxis dataKey="t" tickFormatter={axisTick(span)} stroke={c.grid} tickLine={false} minTickGap={28} />
            <YAxis width={48} tickFormatter={valueTick(m.unit)} stroke="transparent" tickLine={false} />
            <Tooltip content={<ChartTooltip unit={m.unit} decimals={cfg.display.decimals ?? m.precision} span={span} labels={labels} />} cursor={{ fill: c.grid, opacity: 0.6 }} />
            {r.series.filter((s) => !hidden.includes(s.key)).map((s, i, arr) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[s.key]} stackId={stacked ? 'a' : undefined} isAnimationActive={false} maxBarSize={36} radius={!stacked || i === arr.length - 1 ? [2, 2, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {r.series.length > 1 && (cfg.display.showLegend ?? true) && (
        <Legend items={r.series.map((s) => ({ key: s.key, label: s.label, color: colors[s.key] }))} hidden={hidden}
          onToggle={(k) => ctx.onDisplayChange({ hidden: hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k] })} />
      )}
    </>
  );
}

function CategoryBars({ r, m, cfg }: { r: MetricResult; m: MetricDescriptor; cfg: WidgetConfig }) {
  const c = useChartColors(cfg.display.palette);
  const data = (r.categories ?? []).slice(0, cfg.display.limit ?? 10);
  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap="22%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={90} tickLine={false} stroke="transparent" />
          <Tooltip formatter={(v: number) => fmtValue(v, m.unit, 0)} cursor={{ fill: c.grid, opacity: 0.5 }} contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, fontSize: 12 }} />
          <Bar dataKey="value" isAnimationActive={false} radius={[0, 2, 2, 0]} label={{ position: 'right', formatter: (v: number) => fmtValue(v, m.unit, 0), fontSize: 10.5, fontFamily: 'IBM Plex Mono', fill: c.axis }}>
            {data.map((d, i) => <Cell key={d.key} fill={cfg.display.colors?.[d.key] ?? (i === 0 ? c.series[1] : c.series[0])} fillOpacity={i === 0 ? 1 : 0.85 - i * 0.05} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
