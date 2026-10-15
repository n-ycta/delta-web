import { tr } from '@/i18n';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { WidgetProps } from '../types';
import { MetricData } from '../shared';
import { useChartColors } from '@/app/theme';
import { fmtValue } from '@/core/lib/format';
import type { CategoryValue, MetricResult } from '@/core/contracts';

function toCategories(r: MetricResult): CategoryValue[] {
  if (r.categories) return r.categories;
  return r.series.map((s) => ({ key: s.key, label: s.label, value: s.points.reduce((a, p) => a + (p.v ?? 0), 0) })).sort((a, b) => b.value - a.value);
}

/** Share of total — donut + ranked list. Works for categorical metrics or any metric grouped by a dimension. */
export function BreakdownWidget({ config, ctx }: WidgetProps) {
  const c = useChartColors(config.display.palette);
  const groupBy = config.source.kind === 'metric' ? config.source.groupBy ?? ctx.metric?.dimensions[0]?.id : undefined;
  return (
    <MetricData cfg={config} ctx={ctx} overrides={{ groupBy, compare: 'none' }}>
      {(r, m) => {
        const all=toCategories(r).filter(d=>Number.isFinite(d.value)&&d.value>0).sort((a,b)=>b.value-a.value);const top=all.slice(0, config.display.limit ?? 8);const rest=all.slice(top.length).reduce((s,d)=>s+d.value,0);const cats=rest?[...top,{key:'__other',label:tr('analytics.other'),value:rest}]:top;
        const total = cats.reduce((s, x) => s + x.value, 0) || 1;
        const color = (k: string, i: number) => config.display.colors?.[k] ?? c.series[i % c.series.length];
        return (
          <div className="row" style={{ height: '100%', alignItems: 'stretch', gap: 14 }}>
            <div style={{ width: '40%', minWidth: 90, maxWidth: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="95%" paddingAngle={1} stroke="none" isAnimationActive={false}>
                    {cats.map((d, i) => <Cell key={d.key} fill={color(d.key, i)} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="col grow" style={{ gap: 5, justifyContent: 'center', overflow: 'auto' }}>
              {cats.map((d, i) => (
                <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0,1fr) auto 44px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color(d.key, i) }} />
                  <span className="truncate">{d.label.trim() || <span className="faint">{tr("widgets.charts.BreakdownWidget.s_9a3a4f5516")}</span>}</span>
                  <span className="num muted" style={{ fontSize: 11 }}>{fmtValue(d.value, m.unit, 0)}</span>
                  <span className="num" style={{ textAlign: 'right', fontSize: 11.5 }}>{((d.value / total) * 100).toFixed(1)}{tr("widgets.charts.BreakdownWidget.s_4345cb1fa2")}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </MetricData>
  );
}
