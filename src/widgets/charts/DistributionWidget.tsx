import { tr } from '@/i18n';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WidgetProps } from '../types';
import { MetricData } from '../shared';
import { useChartColors } from '@/app/theme';
import { fmtNumber, fmtValue } from '@/core/lib/format';

export function DistributionWidget({ config, ctx }: WidgetProps) {
  const c = useChartColors(config.display.palette);
  return (
    <MetricData cfg={config} ctx={ctx} isEmpty={(r) => !r.buckets?.length}>
      {(r, m) => {
        const data = (r.buckets ?? []).map((b) => ({ x: Math.round((b.lo + b.hi) / 2), count: b.count, range: `${Math.round(b.lo)}–${Math.round(b.hi)}` }));
        const total = data.reduce((s, d) => s + d.count, 0);
        let acc = 0; let p95 = data[data.length - 1]?.x; let p50 = data[0]?.x;
        for (const d of data) { acc += d.count; if (acc >= total * 0.5 && p50 === data[0]?.x) p50 = d.x; if (acc >= total * 0.95) { p95 = d.x; break; } }
        return (
          <>
            <div className="row" style={{ gap: 16, fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
              <span>{tr("widgets.charts.DistributionWidget.s_8615946584")}<b style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmtValue(p50, m.unit)}</b></span>
              <span>{tr("widgets.charts.DistributionWidget.s_cd79344568")}<b style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmtValue(p95, m.unit)}</b></span>
              <span>{tr("widgets.charts.DistributionWidget.s_3fd6d3dd96")}{fmtNumber(total, 0)}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={1}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="x" tickLine={false} stroke={c.grid} minTickGap={20} />
                  <YAxis width={40} tickLine={false} stroke="transparent" tickFormatter={(v) => fmtNumber(v, 0)} />
                  <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} formatter={(v: number) => [fmtNumber(v, 0), tr("widgets.charts.DistributionWidget.s_20da6c6c9c")]} labelFormatter={(x) => `${x} ${m.unit}`} contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, fontSize: 12 }} />
                  <Bar dataKey="count" fill={config.display.colors?.value ?? c.series[0]} isAnimationActive={false} />
                  <ReferenceLine x={p50} stroke={c.ink} strokeDasharray="3 3" />
                  <ReferenceLine x={p95} stroke={c.warn} strokeDasharray="3 3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        );
      }}
    </MetricData>
  );
}
