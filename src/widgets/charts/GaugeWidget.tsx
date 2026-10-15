import type { WidgetProps } from '../types';
import { Delta, MetricData } from '../shared';
import { fmtValue } from '@/core/lib/format';
import { useChartColors } from '@/app/theme';
import type { MetricDescriptor } from '@/core/contracts';

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

function Dial({ value, m, color, label, prev }: { value: number | null; m: MetricDescriptor; color: string; label?: string; prev: number | null }) {
  const c = useChartColors();
  const lo = m.range?.min ?? (m.kind === 'ratio' ? 0 : 0), hi = m.range?.max ?? (m.kind === 'ratio' ? 1 : (value ?? 1) * 1.5);
  const t = value === null ? 0 : Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const A0 = Math.PI * 0.8, A1 = Math.PI * 2.2;
  const a = A0 + (A1 - A0) * t;
  return (
    <div className="col" style={{ alignItems: 'center', gap: 0, flex: 1, minWidth: 0 }}>
      <svg viewBox="0 0 120 92" style={{ width: '100%', maxWidth: 220, maxHeight: '100%' }}>
        <path d={arc(60, 56, 44, A0, A1)} stroke={c.sunken} strokeWidth={9} fill="none" strokeLinecap="round" />
        {value !== null && <path d={arc(60, 56, 44, A0, Math.max(A0 + 0.01, a))} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round" />}
        {m.thresholds?.map((th, i) => {
          const tt = Math.max(0, Math.min(1, (th.value - lo) / (hi - lo)));
          const aa = A0 + (A1 - A0) * tt;
          return <line key={i} x1={60 + 37 * Math.cos(aa)} y1={56 + 37 * Math.sin(aa)} x2={60 + 51 * Math.cos(aa)} y2={56 + 51 * Math.sin(aa)} stroke={th.severity === 'error' ? c.err : c.warn} strokeWidth={1.5} />;
        })}
        <text x="60" y="58" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="17" fill={c.ink}>{fmtValue(value, m.unit, m.precision)}</text>
        <text x="60" y="88" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="8" fill={c.axis}>{label ?? `${fmtValue(lo, m.unit, 0)} – ${fmtValue(hi, m.unit, 0)}`}</text>
      </svg>
      <Delta cur={value} prev={prev} better={m.better} />
    </div>
  );
}

export function GaugeWidget({ config, ctx }: WidgetProps) {
  const c = useChartColors(config.display.palette);
  return (
    <MetricData cfg={config} ctx={ctx} isEmpty={(r) => r.summary.current === null}>
      {(r, m) => {
        if (r.series.length > 1) {
          return (
            <div className="row" style={{ height: '100%', alignItems: 'stretch' }}>
              {r.series.map((s, i) => {
                const vs = s.points.map((p) => p.v).filter((v): v is number => v !== null);
                const avg = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
                return <Dial key={s.key} value={avg} m={m} color={config.display.colors?.[s.key] ?? c.series[i % c.series.length]} label={s.label} prev={null} />;
              })}
            </div>
          );
        }
        return <div className="row" style={{ height: '100%' }}><Dial value={r.summary.current} prev={r.summary.previous} m={m} color={config.display.colors?.value ?? c.series[0]} /></div>;
      }}
    </MetricData>
  );
}
