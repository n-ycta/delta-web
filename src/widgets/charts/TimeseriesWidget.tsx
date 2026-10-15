import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WidgetProps } from '../types';
import { axisTick, ChartTooltip, Legend, MetricData, toRows, useSeriesColors, valueTick } from '../shared';
import { useChartColors } from '@/app/theme';
import type { MetricResult, MetricDescriptor, WidgetConfig } from '@/core/contracts';
import type { WidgetContext } from '../types';

export function TimeseriesWidget({ config, ctx }: WidgetProps) {
  return <MetricData cfg={config} ctx={ctx}>{(r, m) => <TimeseriesChart r={r} m={m} cfg={config} ctx={ctx} />}</MetricData>;
}

function TimeseriesChart({ r, m, cfg, ctx }: { r: MetricResult; m: MetricDescriptor; cfg: WidgetConfig; ctx: WidgetContext }) {
  const c = useChartColors(cfg.display.palette);
  const all = [...r.series, ...(r.compare ?? [])];
  const colors = useSeriesColors(all, cfg);
  const hidden = (cfg.display.hidden as string[] | undefined) ?? [];
  const rows = toRows(all);
  const span = r.to - r.from;
  const kind = cfg.display.chart ?? (m.kind === 'counter' || m.kind === 'duration' ? 'bar' : 'line');
  const connected = cfg.display.connectNulls ?? true;
  const stacked = !!cfg.display.stacked && r.series.length > 1;
  const labels = Object.fromEntries(all.map((s) => [s.key, s.label]));
  const decimals = cfg.display.decimals ?? m.precision;
  const showLegend = cfg.display.showLegend ?? all.length > 1;
  const yDomain: [any, any] = [cfg.display.yMin ?? (m.kind === 'ratio' ? 'auto' : m.range ? 'auto' : 0), cfg.display.yMax ?? 'auto'];
  const toggle = (k: string) => ctx.onDisplayChange({ hidden: hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k] });

  return (
    <>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            {(cfg.display.showGrid ?? true) && <CartesianGrid stroke={c.grid} vertical={false} />}
            <XAxis dataKey="t" type="number" scale="time" domain={[r.from, r.to]} tickFormatter={axisTick(span)} stroke={c.grid} tickLine={false} minTickGap={36} />
            <YAxis width={48} tickFormatter={valueTick(m.unit)} stroke="transparent" tickLine={false} domain={yDomain} allowDataOverflow={cfg.display.yMin !== undefined && cfg.display.yMin !== null} />
            <Tooltip content={<ChartTooltip unit={m.unit} decimals={decimals} span={span} labels={labels} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
            {(cfg.display.showThresholds ?? true) && m.thresholds?.map((t, i) => (
              <ReferenceLine key={i} y={t.value} stroke={t.severity === 'error' ? c.err : c.warn} strokeDasharray="4 3" ifOverflow="extendDomain" label={{ value: t.label ?? String(t.value), position: 'insideTopRight', fill: t.severity === 'error' ? c.err : c.warn, fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
            ))}
            {all.filter((s) => !hidden.includes(s.key)).map((s) => {
              const previous = (r.compare ?? []).includes(s);
              const common = { key: s.key, dataKey: s.key, name: s.label, isAnimationActive: false } as const;
              const dot = { r: 2.5, strokeWidth: 0, fill: colors[s.key], fillOpacity: previous ? 0.55 : 1 };
              if (kind === 'bar') return <Bar {...common} fill={colors[s.key]} fillOpacity={previous ? 0.4 : 1} stackId={stacked ? (previous ? 'previous' : 'current') : undefined} radius={0} maxBarSize={28} />;
              if (kind === 'area') return <Area {...common} type="linear" stroke={colors[s.key]} fill={colors[s.key]} fillOpacity={previous ? 0.06 : stacked ? 0.55 : 0.12} strokeOpacity={previous ? 0.55 : 1} strokeWidth={1.5} stackId={stacked ? (previous ? 'previous' : 'current') : undefined} connectNulls={connected} dot={dot} />;
              return <Line {...common} type={kind === 'step' ? 'stepAfter' : 'linear'} stroke={colors[s.key]} strokeOpacity={kind === 'dots' ? 0 : previous ? 0.55 : 1} strokeWidth={1.7} dot={dot} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={connected} />;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {showLegend && <Legend items={all.map((s) => ({ key: s.key, label: s.label, color: colors[s.key], dashed: s.key.endsWith('__prev') }))} hidden={hidden} onToggle={toggle} />}
    </>
  );
}
