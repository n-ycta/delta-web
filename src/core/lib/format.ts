import { tr } from '@/i18n';
export const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto', style: 'short' });

export function ago(ts: number | string | undefined, now = Date.now()): string {
  if (ts === undefined) return '—';
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  const d = t - now;
  const a = Math.abs(d);
  if (a < 10_000) return tr("core.lib.format.s_c47cbe7f58");
  if (a < MIN) return rtf.format(Math.round(d / 1000), 'second');
  if (a < HOUR) return rtf.format(Math.round(d / MIN), 'minute');
  if (a < DAY) return rtf.format(Math.round(d / HOUR), 'hour');
  return rtf.format(Math.round(d / DAY), 'day');
}

export function fmtTime(ts: number | string, withSeconds = false): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: withSeconds ? '2-digit' : undefined });
}
export function fmtDateTime(ts: number | string): string {
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function fmtDate(ts: number | string): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}
export function fmtAxisTime(ts: number, spanMs: number): string {
  const d = new Date(ts);
  if (spanMs <= 2 * DAY) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function fmtNumber(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  const short = (x: number, s: string) => x.toFixed(1).replace(/\.0$/, '') + s;
  if (abs >= 1e9) return short(v / 1e9, 'G');
  if (abs >= 1e6) return short(v / 1e6, 'M');
  if (abs >= 1e4) return short(v / 1e3, 'k');
  return v.toLocaleString('ru-RU', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

export function fmtBytes(b: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtDuration(sec: number): string {
  if (sec < 60) return tr("core.lib.format.s_b4fa0a0422", { p0: (Math.round(sec)) });
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return tr("core.lib.format.s_4277fc4482", { p0: (d), p1: (h) });
  if (h) return tr("core.lib.format.s_637d8f185b", { p0: (h), p1: (m) });
  return tr("core.lib.format.s_fb2046057d", { p0: (m) });
}

/** Formats a metric value with its unit. */
export function fmtValue(v: number | null | undefined, unit?: string, decimals = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  switch (unit) {
    case '%': return `${fmtNumber(v, decimals)}%`;
    case 'ratio': return `${fmtNumber(v * 100, decimals)}%`;
    case 'bytes': return fmtBytes(v);
    case 's': return fmtDuration(v);
    case 'ms': return tr("core.lib.format.s_15d4eb7208", { p0: (fmtNumber(v, 0)) });
    case 'min': return v >= 60 ? fmtDuration(v * 60) : tr("core.lib.format.s_b0a667e324", { p0: (fmtNumber(v, 0)) });
    case 'h': return tr("core.lib.format.s_41e0f62522", { p0: (fmtNumber(v, decimals)) });
    case '': case undefined: case 'count': return fmtNumber(v, decimals);
    default: return `${fmtNumber(v, decimals)} ${unit}`;
  }
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
