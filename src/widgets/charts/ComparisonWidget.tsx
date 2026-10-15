import type { WidgetProps } from '../types';
import { Delta, MetricData } from '../shared';
import { useChartColors } from '@/app/theme';
import { fmtValue } from '@/core/lib/format';
import { Sparkline } from '@/ui/Sparkline';

/** Side-by-side comparison of dimension values (e.g. typing speed RU vs EN) with gap and trend. */
export function ComparisonWidget({ config, ctx }: WidgetProps) {
  const c = useChartColors(config.display.palette);
  const groupBy = config.source.kind === 'metric' ? config.source.groupBy ?? ctx.metric?.dimensions[0]?.id : undefined;
  return (
    <MetricData cfg={config} ctx={ctx} overrides={{ groupBy, compare: 'previous' }}>
      {(r, m) => {
        const agg = (vals: (number | null)[]) => { const v = vals.filter((x): x is number => x !== null); if (!v.length) return null; return m.kind === 'counter' || m.kind === 'duration' ? v.reduce((a, b) => a + b, 0) : v.reduce((a, b) => a + b, 0) / v.length; };
        const rows = r.series.map((s, i) => ({
          key: s.key, label: s.label, color: config.display.colors?.[s.key] ?? c.series[i % c.series.length],
          cur: agg(s.points.map((p) => p.v)),
          prev: agg((r.compare?.find((x) => x.key === `${s.key}__prev`)?.points ?? []).map((p) => p.v)),
          line: s.points.map((p) => p.v),
        }));
        const [a, b] = rows;
        const gap = a?.cur !== null && b?.cur !== null && a && b ? (a.cur as number) - (b.cur as number) : null;
        const max = Math.max(...rows.map((x) => x.cur ?? 0));
        return (
          <div className="col" style={{ height: '100%', gap: 10 }}>
            {rows.map((x) => (
              <div key={x.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 110px) minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                <div>
                  <div className="row" style={{ gap: 6, fontSize: 12 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: x.color }} />{x.label}</div>
                  <div className="num" style={{ fontSize: 20, letterSpacing: '-0.02em' }}>{fmtValue(x.cur, m.unit, m.precision)}</div>
                </div>
                <div className="col" style={{ gap: 4 }}>
                  <div className="meter" style={{ height: 6 }}><span style={{ width: `${((x.cur ?? 0) / (max || 1)) * 100}%`, background: x.color }} /></div>
                  <Sparkline values={x.line} width={220} height={20} color={x.color} fill={false} />
                </div>
                <Delta cur={x.cur} prev={x.prev} better={m.better} />
              </div>
            ))}
            {gap !== null && rows.length >= 2 && (
              <div className="row" style={{ marginTop: 'auto', borderTop: '1px solid var(--rule)', paddingTop: 8, fontSize: 12 }}>
                <span className="muted">Разница {a.label} − {b.label}</span><span className="spacer" />
                <span className="num" style={{ fontWeight: 500 }}>{gap > 0 ? '+' : ''}{fmtValue(gap, m.unit, m.precision)}</span>
                <span className="muted num" style={{ fontSize: 11 }}>({b.cur ? ((gap / (b.cur as number)) * 100).toFixed(0) : '—'}%)</span>
              </div>
            )}
          </div>
        );
      }}
    </MetricData>
  );
}
