/** Dependency-free SVG sparkline for dense tables. */
export function Sparkline({ values, width = 90, height = 22, color = 'var(--ink-2)', fill = true, max }: { values: (number | null)[]; width?: number; height?: number; color?: string; fill?: boolean; max?: number }) {
  const vs = values.filter((v): v is number => v !== null);
  if (vs.length < 2) return <svg width={width} height={height}><line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="var(--rule-strong)" strokeDasharray="2 2" /></svg>;
  const hi = max ?? Math.max(...vs), lo = max !== undefined ? 0 : Math.min(...vs);
  const span = hi - lo || 1;
  const step = width / (values.length - 1);
  let d = ''; let started = false;
  values.forEach((v, i) => {
    if (v === null) { started = false; return; }
    const x = i * step, y = height - 2 - ((v - lo) / span) * (height - 4);
    d += `${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; started = true;
  });
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={`${d}L${width},${height}L0,${height}Z`} fill={color} opacity={0.08} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}
