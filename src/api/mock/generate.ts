import type { Aggregation, CategoryValue, MetricDescriptor, MetricQuery, MetricResult, Series } from '@/core/contracts';
import { autoStep, resolveRange } from '@/core/contracts';
import { hashString, mulberry32 } from '@/core/lib/random';

type Activity = 'day' | 'work' | 'evening' | 'night' | 'flat' | 'sleep';
interface Profile {
  base: number; amp?: number; noise?: number; trendPerDay?: number;
  activity?: Activity; gaps?: boolean; min?: number; max?: number;
  dims?: Record<string, number>;
  categories?: [string, string, number][];
  dist?: { mu: number; sigma: number; lo: number; hi: number; bins: number };
}

/** Mock-only generation profiles. A real core computes these from plugin storage. */
const P: Record<string, Profile> = {
  'dev.delta.typing/wpm': { base: 62, amp: 6, noise: 9, trendPerDay: 0.05, activity: 'day', gaps: true, dims: { ru: 1.12, en: 0.86 }, min: 15 },
  'dev.delta.typing/accuracy': { base: 0.935, amp: 0.012, noise: 0.03, activity: 'day', gaps: true, dims: { ru: 1.01, en: 0.975 }, max: 0.995, min: 0.75 },
  'dev.delta.typing/keystrokes': { base: 2400, noise: 0.5, activity: 'work', dims: { ru: 0.58, en: 0.42 } },
  'dev.delta.typing/error_keys': { base: 1, categories: [['backspace', 'Backspace', 30], ['ы', 'ы', 9], ['щ', 'щ', 8], ['ж', 'ж', 7], ['th', 'th', 6], ['ъ', 'ъ', 5], ['q', 'q', 4], ['[', '[', 3], ['ё', 'ё', 3]] },
  'dev.delta.typing/key_latency': { base: 1, dist: { mu: Math.log(165), sigma: 0.42, lo: 40, hi: 640, bins: 24 } },
  'dev.delta.typing/session_time': { base: 1500, noise: 0.5, activity: 'work', dims: { code: 0.45, tg: 0.2, browser: 0.22, obsidian: 0.13 } },
  'dev.delta.typing/layout_switches': { base: 48, noise: 0.6, activity: 'work' },
  'dev.delta.health/steps': { base: 650, noise: 0.9, activity: 'day' },
  'dev.delta.health/heart_rate': { base: 68, amp: 9, noise: 10, activity: 'day', min: 48 },
  'dev.delta.health/sleep': { base: 1200, noise: 0.25, activity: 'sleep', dims: { deep: 0.22, light: 0.55, rem: 0.23 } },
  'dev.delta.health/hrv': { base: 52, amp: 6, noise: 8, activity: 'flat', trendPerDay: -0.04 },
  'dev.delta.finance/spend': { base: 260, noise: 1.6, activity: 'day', dims: { food: 0.32, cafe: 0.18, transport: 0.12, subs: 0.06, home: 0.2, other: 0.12 } },
  'dev.delta.finance/balance': { base: 184000, amp: 4000, noise: 1500, trendPerDay: -900, activity: 'flat' },
  'dev.delta.git/commits': { base: 1.3, noise: 1.2, activity: 'work', dims: { 'delta-core': 0.55, console: 0.35, dotfiles: 0.1 } },
  'dev.delta.git/churn': { base: 140, noise: 1.3, activity: 'work', dims: { add: 0.64, del: 0.36 } },
  'dev.delta.home/temperature': { base: 22.4, amp: 1.2, noise: 0.5, activity: 'flat', dims: { living: 1, bedroom: 0.92, office: 1.04 } },
  'dev.delta.home/co2': { base: 720, amp: 260, noise: 120, activity: 'evening', dims: { bedroom: 1.25, office: 0.95 }, min: 410 },
  'dev.delta.home/energy': { base: 0.42, noise: 0.4, activity: 'evening' },
  'dev.delta.screen/screen_time': { base: 1100, noise: 0.6, activity: 'day', dims: { pixel: 0.42, ws: 0.4, mac: 0.18 } },
  'dev.delta.screen/top_apps': { base: 1, categories: [['code', 'VS Code', 34], ['firefox', 'Firefox', 22], ['tg', 'Telegram', 15], ['yt', 'YouTube', 9], ['obsidian', 'Obsidian', 8], ['term', 'Terminal', 7], ['maps', 'Карты', 3]] },
  'dev.delta.screen/pickups': { base: 7, noise: 0.7, activity: 'day' },
  'dev.delta.browser/visits': { base: 40, noise: 0.8, activity: 'day' },
  'dev.delta.browser/domains': { base: 1, categories: [['gh', 'github.com', 30], ['hn', 'news.ycombinator.com', 14], ['habr', 'habr.com', 12], ['docs', 'docs.rs', 10], ['wiki', 'ru.wikipedia.org', 8]] },
  'dev.delta.weather/outdoor_temp': { base: 6, amp: 4, noise: 1.5, activity: 'day', trendPerDay: -0.15 },
  'dev.delta.weather/pressure': { base: 1012, amp: 3, noise: 4, activity: 'flat' },
  'dev.delta.weather/precip': { base: 0.15, noise: 2.5, activity: 'flat' },
  'org.community.scrobbler/plays': { base: 9, noise: 0.9, activity: 'evening' },
  'org.community.scrobbler/genres': { base: 1, categories: [['pr', 'Post-rock', 30], ['ambient', 'Ambient', 22], ['jazz', 'Jazz', 15], ['idm', 'IDM', 12]] },
  'dev.delta.location/distance': { base: 0.8, noise: 1, activity: 'day', dims: { walk: 0.4, transit: 0.45, car: 0.15 } },
  'dev.delta.location/places': { base: 1, categories: [['home', 'Дом', 60], ['office', 'Офис', 25], ['gym', 'Зал', 5], ['cafe', 'Кофейня', 4]] },
};

function weight(hour: number, a: Activity = 'flat'): number {
  const bell = (c: number, w: number) => Math.exp(-((hour - c) ** 2) / (2 * w * w));
  switch (a) {
    case 'day': return hour < 7 ? 0.03 : Math.min(1, 0.25 + bell(12, 3.5) * 0.6 + bell(20, 2.5) * 0.5);
    case 'work': return hour < 8 || hour > 23 ? 0.02 : bell(11.5, 2) * 0.9 + bell(16, 2) * 1 + bell(21.5, 1.2) * 0.4;
    case 'evening': return 0.2 + bell(20.5, 2.5) * 0.9 + bell(8, 1.2) * 0.3;
    case 'sleep': return hour >= 1 && hour <= 7 ? 1 : hour === 0 || hour === 8 ? 0.4 : 0;
    case 'night': return hour < 6 ? 1 : 0.1;
    default: return 0.5 + 0.5 * Math.sin(((hour - 9) / 24) * Math.PI * 2);
  }
}

const profileOf = (q: MetricQuery) => P[`${q.pluginId}/${q.metricId}`] ?? { base: 50, amp: 10, noise: 10, activity: 'flat' as Activity };

function pointValue(p: Profile, m: MetricDescriptor, t: number, step: number, dimScale: number, seed: string): number | null {
  const rnd = mulberry32(hashString(`${seed}:${Math.floor(t / step)}`));
  const r = rnd() - 0.5, r2 = rnd();
  const hour = new Date(t).getHours();
  const days = (t - Date.now()) / 86400e3;
  const w = step >= 86400e3 ? 0.6 : weight(hour, p.activity);
  const stepH = step / 3600e3;
  switch (m.kind) {
    case 'counter':
    case 'event': {
      const rate = p.base * dimScale * (step >= 86400e3 ? 24 * 0.45 : w) * stepH;
      const v = Math.max(0, rate * (1 + (p.noise ?? 0.3) * r * 1.6));
      return m.precision === 0 ? Math.round(v) : v;
    }
    case 'duration': {
      const v = p.base * dimScale * (step >= 86400e3 ? 24 * 0.4 : w) * stepH * (1 + (p.noise ?? 0.3) * r);
      return Math.min(step / 1000, Math.max(0, v));
    }
    case 'ratio':
    case 'gauge': {
      if (p.gaps && w < 0.12 && step < 86400e3 && r2 > 0.15) return null;
      let v = p.base * dimScale + (p.amp ?? 0) * Math.sin((hour / 24) * Math.PI * 2 - 1.2) + (p.noise ?? 0) * r + (p.trendPerDay ?? 0) * days;
      if (p.min !== undefined) v = Math.max(p.min, v);
      if (p.max !== undefined) v = Math.min(p.max, v);
      if (m.kind === 'ratio') v = Math.max(0, Math.min(1, v));
      return v;
    }
    default: return null;
  }
}

function aggregate(values: number[], agg: Aggregation, kind: MetricDescriptor['kind']): number | null {
  if (!values.length) return null;
  const a = agg ?? (kind === 'counter' || kind === 'duration' ? 'sum' : 'avg');
  switch (a) {
    case 'sum': case 'count': return values.reduce((s, v) => s + v, 0);
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'last': return values[values.length - 1];
    case 'p95': { const s = [...values].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] ?? s[s.length - 1]; }
    default: return values.reduce((s, v) => s + v, 0) / values.length;
  }
}

function buildSeries(q: MetricQuery, m: MetricDescriptor, from: number, to: number, step: number, keyPrefix = ''): Series[] {
  const p = profileOf(q);
  const dim = q.groupBy ? m.dimensions.find((d) => d.id === q.groupBy) : undefined;
  const firstDim = m.dimensions[0];
  const filterVals = firstDim && q.filters?.[firstDim.id];
  const start = Math.floor(from / step) * step;
  const times: number[] = [];
  for (let t = start; t <= to; t += step) times.push(t);
  const seedBase = `${q.pluginId}/${q.metricId}${keyPrefix}`;
  const dimValues = (d: typeof firstDim) => (d?.values ?? []).filter((v) => !q.filters?.[d!.id]?.length || q.filters[d!.id].includes(v.id));

  if (dim) {
    return dimValues(dim).map((v) => ({
      key: v.id, label: v.label, color: v.color,
      points: times.map((t) => ({ t, v: pointValue(p, m, t, step, p.dims?.[v.id] ?? 1, `${seedBase}:${v.id}`) })),
    }));
  }
  // no grouping: combine dimension values (respecting filters) or use raw profile
  const vals = firstDim?.values?.length ? dimValues(firstDim) : [];
  const isSum = m.kind === 'counter' || m.kind === 'duration' || m.kind === 'event';
  const points = times.map((t) => {
    if (!vals.length) return { t, v: pointValue(p, m, t, step, 1, seedBase) };
    const parts = vals.map((v) => pointValue(p, m, t, step, p.dims?.[v.id] ?? 1, `${seedBase}:${v.id}`)).filter((x): x is number => x !== null);
    if (!parts.length) return { t, v: null };
    const total = parts.reduce((s, x) => s + x, 0);
    return { t, v: isSum ? total : total / parts.length };
  });
  void filterVals;
  return [{ key: 'value', label: m.label, points }];
}

export function generateMetric(q: MetricQuery, m: MetricDescriptor): MetricResult {
  const now = Date.now();
  const { from, to } = resolveRange(q.range, now);
  const span = to - from;
  const step = q.stepMs ?? autoStep(span);
  const agg = (q.aggregation ?? m.defaultAggregation ?? m.aggregations[0]) as Aggregation;
  const p = profileOf(q);
  const result: MetricResult = { query: q, from, to, stepMs: step, series: [], summary: { current: null, previous: null, min: null, max: null }, generatedAt: now };

  if (m.kind === 'categorical') {
    const scale = span / 86400e3;
    const mk = (seed: string): CategoryValue[] => {
      const rnd = mulberry32(hashString(seed + Math.floor(from / 3600e3)));
      return (p.categories ?? [['a', 'A', 1]]).map(([key, label, w]) => ({ key, label, value: Math.round(w * scale * (m.unit === 's' ? 240 : 6) * (0.75 + rnd() * 0.5)) }))
        .sort((a, b) => b.value - a.value);
    };
    result.categories = mk(`${q.pluginId}/${q.metricId}`);
    const prev = mk(`${q.pluginId}/${q.metricId}:prev`);
    result.summary.current = result.categories.reduce((s, c) => s + c.value, 0);
    result.summary.previous = prev.reduce((s, c) => s + c.value, 0);
    return result;
  }

  if (m.kind === 'distribution' && p.dist) {
    const { mu, sigma, lo, hi, bins } = p.dist;
    const width = (hi - lo) / bins;
    const total = Math.round((span / 3600e3) * 900);
    const rnd = mulberry32(hashString(`${q.metricId}${Math.floor(from / 3600e3)}`));
    const pdf = (x: number) => Math.exp(-((Math.log(x) - mu) ** 2) / (2 * sigma * sigma)) / (x * sigma * Math.sqrt(2 * Math.PI));
    result.buckets = Array.from({ length: bins }, (_, i) => {
      const a = lo + i * width, b = a + width;
      return { lo: a, hi: b, count: Math.round(pdf((a + b) / 2) * width * total * (0.9 + rnd() * 0.2)) };
    });
    const mean = Math.exp(mu + sigma * sigma / 2);
    result.summary = { current: mean, previous: mean * 1.04, min: lo, max: hi };
    // also provide a series of the mean over time for timeseries fallbacks
    const fake: MetricDescriptor = { ...m, kind: 'gauge' };
    result.series = buildSeries(q, fake, from, to, step).map((s) => ({ ...s, points: s.points.map((pt) => ({ t: pt.t, v: mean * (0.9 + (hashString(String(pt.t)) % 100) / 500) })) }));
    return result;
  }

  result.series = buildSeries(q, m, from, to, step);
  const flat = (ss: Series[]) => {
    // aggregate per bucket over series then over time
    const isSum = agg === 'sum' || agg === 'count';
    const perBucket = ss[0]?.points.map((_, i) => {
      const vs = ss.map((s) => s.points[i]?.v).filter((v): v is number => v !== null && v !== undefined);
      if (!vs.length) return null;
      return isSum ? vs.reduce((a, b) => a + b, 0) : vs.reduce((a, b) => a + b, 0) / vs.length;
    }) ?? [];
    return perBucket.filter((v): v is number => v !== null);
  };
  const cur = flat(result.series);
  result.summary.current = aggregate(cur, agg, m.kind);
  result.summary.min = cur.length ? Math.min(...cur) : null;
  result.summary.max = cur.length ? Math.max(...cur) : null;
  const prevSeries = buildSeries(q, m, from - span, to - span, step, '');
  result.summary.previous = aggregate(flat(prevSeries), agg, m.kind);
  if (q.compare === 'previous') {
    result.compare = prevSeries.map((s) => ({ ...s, key: `${s.key}__prev`, label: `${s.label} (пред.)`, points: s.points.map((pt) => ({ t: pt.t + span, v: pt.v })) }));
  }
  return result;
}

/** node resource history */
export function nodeSeries(nodeId: string, kind: 'cpu' | 'mem' | 'latency', rangeMs: number, base: number): Series {
  const to = Date.now(); const from = to - rangeMs; const step = autoStep(rangeMs);
  const points = [];
  for (let t = Math.floor(from / step) * step; t <= to; t += step) {
    const rnd = mulberry32(hashString(`${nodeId}:${kind}:${Math.floor(t / step)}`));
    const hour = new Date(t).getHours();
    const daily = kind === 'mem' ? 0.06 * Math.sin(hour / 3.8) : 0.35 * weight(hour, 'work');
    let v = base * (1 + daily) + (rnd() - 0.5) * base * (kind === 'latency' ? 0.6 : 0.3);
    if (kind === 'cpu' && rnd() > 0.97) v += 35;
    if (kind !== 'latency') v = Math.max(1, Math.min(99, v));
    points.push({ t, v: Math.max(0, v) });
  }
  return { key: kind, label: kind, points };
}
