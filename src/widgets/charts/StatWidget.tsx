import type { WidgetProps } from '../types';
import { Delta, MetricData } from '../shared';
import { fmtValue } from '@/core/lib/format';
import { Sparkline } from '@/ui/Sparkline';
import { useChartColors } from '@/app/theme';

export function StatWidget({ config, ctx }: WidgetProps) {
  const c = useChartColors(config.display.palette);
  return (
    <MetricData cfg={config} ctx={ctx} isEmpty={(r) => r.summary.current === null}>
      {(r, m) => {
        const pts = r.series[0]?.points ?? [];
        // collapse multi-series into one line
        const line = pts.map((_, i) => {
          const vs = r.series.map((s) => s.points[i]?.v).filter((v): v is number => v !== null && v !== undefined);
          if (!vs.length) return null;
          return m.kind === 'counter' || m.kind === 'duration' ? vs.reduce((a, b) => a + b, 0) : vs.reduce((a, b) => a + b, 0) / vs.length;
        });
        const decimals = config.display.decimals ?? m.precision;
        const v = fmtValue(r.summary.current, m.unit, decimals);
        const [num, ...unit] = v.split(' ');
        const color = config.display.colors?.value ?? c.series[0];
        const breach = m.thresholds?.find((t) => r.summary.current !== null && (m.better === 'lower' ? r.summary.current > t.value : r.summary.current < t.value));
        return (
          <div className="col" style={{ gap: 6, height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-v" style={breach ? { color: breach.severity === 'error' ? c.err : c.warn } : undefined}>{num}{unit.length > 0 && <span className="u">{unit.join(' ')}</span>}</div>
              <div className="row" style={{ marginTop: 4 }}>
                <Delta cur={r.summary.current} prev={r.summary.previous} better={m.better} />
                <span className="widget-meta">vs пред. · {r.query.aggregation ?? m.defaultAggregation ?? m.aggregations[0]}</span>
              </div>
            </div>
            <div style={{ height: 26, marginTop: 'auto' }}>
              <Sparkline values={line} width={260} height={26} color={color} />
            </div>
          </div>
        );
      }}
    </MetricData>
  );
}
