import { useState } from 'react';
import type { WidgetProps } from '../types';
import { MetricData } from '../shared';
import { useChartColors } from '@/app/theme';
import { fmtValue } from '@/core/lib/format';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Day-of-week × hour-of-day activity matrix. Always uses hourly buckets over ≥ 7 days. */
export function HeatmapWidget({ config, ctx }: WidgetProps) {
  const c = useChartColors(config.display.palette);
  const [hover, setHover] = useState<{ d: number; h: number; v: number } | null>(null);
  const range = ['24h', '6h', '1h', '15m'].includes(config.display.rangeOverride ?? ctx.range) ? '7d' : (config.display.rangeOverride ?? ctx.range);
  return (
    <MetricData cfg={{ ...config, display: { ...config.display, rangeOverride: range as any, compare: false } }} ctx={ctx} overrides={{ stepMs: 3600e3, groupBy: undefined }}>
      {(r, m) => {
        const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
        const counts = Array.from({ length: 7 }, () => new Array(24).fill(0));
        r.series.forEach((s) => s.points.forEach((p) => {
          if (p.v === null) return;
          const d = new Date(p.t); const dow = (d.getDay() + 6) % 7;
          grid[dow][d.getHours()] += p.v; counts[dow][d.getHours()]++;
        }));
        const avg = grid.map((row, d) => row.map((v, h) => (counts[d][h] ? v / counts[d][h] : 0)));
        const max = Math.max(...avg.flat(), 1e-9);
        const color = config.display.colors?.value ?? c.series[0];
        return (
          <div className="col" style={{ height: '100%', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 6, flex: 1, minHeight: 0 }}>
              <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', alignItems: 'center' }}>{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
              <div className="heat" style={{ gridTemplateColumns: 'repeat(24, 1fr)', gridTemplateRows: 'repeat(7, 1fr)' }} onMouseLeave={() => setHover(null)}>
                {avg.flatMap((row, d) => row.map((v, h) => (
                  <div key={`${d}-${h}`} onMouseEnter={() => setHover({ d, h, v })}
                    style={{ background: v === 0 ? c.sunken : color, opacity: v === 0 ? 1 : 0.12 + 0.88 * (v / max), outline: hover?.d === d && hover?.h === h ? `1px solid ${c.ink}` : undefined }} />
                )))}
              </div>
            </div>
            <div className="row" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', paddingLeft: 28 }}>
              {hover ? <span>{DAYS[hover.d]} {String(hover.h).padStart(2, '0')}:00 · ср. {fmtValue(hover.v, m.unit, m.precision)}</span> : <span>00 · · · 06 · · · 12 · · · 18 · · · 23</span>}
              <span className="spacer" />
              <span>{range} · по часам</span>
            </div>
          </div>
        );
      }}
    </MetricData>
  );
}
