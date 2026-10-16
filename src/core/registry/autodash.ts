import { tr } from '@/i18n';
import type { DashboardConfig, MetricDescriptor, PluginEntry, WidgetConfig } from '../contracts';
import type { WidgetRegistry } from './WidgetRegistry';
import { uid } from '../lib/random';

const COLS = 12;

/**
 * Row packer for a 12-column grid: fills rows left-to-right, then stretches the row
 * so it spans the full width and equalises heights — generated dashboards look deliberate, not jagged.
 */
export function pack(
  items: { w: number; h: number }[],
): { x: number; y: number; w: number; h: number }[] {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  let row: number[] = [];
  let used = 0,
    y = 0;
  const flush = () => {
    if (!row.length) return;
    const extra = COLS - used;
    const h = Math.max(...row.map((i) => items[i].h));
    let x = 0;
    row.forEach((i, k) => {
      const w = Math.min(COLS, items[i].w) + (k === row.length - 1 ? extra : 0);
      out[i] = { x, y, w, h };
      x += w;
    });
    y += h;
    row = [];
    used = 0;
  };
  items.forEach((it, i) => {
    const w = Math.min(it.w, COLS);
    if (used + w > COLS) flush();
    row.push(i);
    used += w;
  });
  flush();
  return out;
}

export function nextFreeY(widgets: WidgetConfig[]) {
  return widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0);
}

export function widgetForMetric(
  reg: WidgetRegistry,
  pluginId: string,
  m: MetricDescriptor,
  type?: string,
): Omit<WidgetConfig, 'layout'> & { size: { w: number; h: number } } {
  const def = (type && reg.get(type)) || reg.best(m)!;
  const groupBy =
    m.kind === 'categorical'
      ? m.dimensions[0]?.id
      : m.dimensions[0] &&
          (def.type === 'timeseries' || def.type === 'comparison' || def.type === 'bar') &&
          m.dimensions[0].values?.length
        ? m.dimensions[0].id
        : undefined;
  return {
    id: uid('w'),
    type: def.type,
    typeVersion: def.version,
    source: {
      kind: 'metric',
      pluginId,
      metricId: m.id,
      aggregation: m.defaultAggregation ?? m.aggregations[0],
      groupBy,
      filters: m.defaultFilters,
    },
    display: def.defaultDisplay?.(m) ?? {},
    size: def.defaultSize,
  };
}

/** Builds a dashboard for any plugin purely from its contract. */
export function generatePluginDashboard(entry: PluginEntry, reg: WidgetRegistry): DashboardConfig {
  const { manifest } = entry;
  const ws: (Omit<WidgetConfig, 'layout'> & { size: { w: number; h: number } })[] = [];
  const statable = manifest.metrics
    .filter((m) => ['gauge', 'counter', 'ratio', 'duration'].includes(m.kind))
    .slice(0, 4);
  statable.forEach((m) =>
    ws.push({ ...widgetForMetric(reg, manifest.id, m, 'stat'), size: { w: 3, h: 4 } }),
  );
  manifest.metrics.forEach((m) => {
    const ranked = reg
      .rank(m)
      .filter((r) => r.score > 0 && r.def.type !== 'stat' && r.def.type !== 'table');
    const pick = ranked[0];
    if (pick) ws.push(widgetForMetric(reg, manifest.id, m, pick.def.type));
  });
  ws.forEach((w, i) => {
    w.id = `gen_${manifest.id}_${i}_${w.type}`;
  });
  const tables = manifest.views
    .filter((v) => v.dashboard)
    .map((v) => ({
      id: `gen_${manifest.id}_view_${v.id}`,
      type: 'table',
      typeVersion: reg.get('table')!.version,
      source: { kind: 'plugin-view' as const, pluginId: manifest.id, viewId: v.id },
      display: { limit: v.dashboard!.limit },
      size: { w: 12, h: 9 },
    }));
  ws.unshift(...tables);
  const layout = pack(ws.map((w) => w.size));
  const t = Date.now();
  return {
    id: `gen_${manifest.id}`,
    name: manifest.name,
    icon: manifest.icon,
    origin: 'generated',
    generatedFrom: manifest.id,
    range: '7d',
    refreshSec: 15,
    pinned: false,
    widgets: ws.map(({ size: _s, ...w }, i) => ({ ...w, id: w.id, layout: layout[i] })),
    createdAt: t,
    updatedAt: t,
  };
}

export function defaultHomeDashboard(entries: PluginEntry[], reg: WidgetRegistry): DashboardConfig {
  const t = Date.now();
  const sys = (
    feed: 'nodes' | 'events' | 'alerts' | 'plugins',
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): WidgetConfig => {
    const type = {
      nodes: 'node-grid',
      events: 'event-feed',
      alerts: 'alerts',
      plugins: 'plugin-activity',
    }[feed];
    return {
      id: uid('w'),
      type,
      typeVersion: reg.get(type)?.version ?? '1.0.0',
      title,
      source: { kind: 'system', feed },
      display: {},
      layout: { x, y, w, h },
    };
  };
  const metric = (
    pluginId: string,
    metricId: string,
    type: string,
    layout: WidgetConfig['layout'],
    extra: Partial<WidgetConfig> = {},
  ): WidgetConfig | null => {
    const e = entries.find((p) => p.manifest.id === pluginId);
    const m = e?.manifest.metrics.find((x) => x.id === metricId);
    if (!e || !m || !e.instance.installedVersion) return null;
    const w = widgetForMetric(reg, pluginId, m, type);
    const { size: _s, ...rest } = w;
    return { ...rest, ...extra, display: { ...rest.display, ...(extra.display ?? {}) }, layout };
  };
  const widgets = [
    sys('alerts', tr('core.registry.autodash.s_925c5165a9'), 0, 0, 4, 6),
    sys('nodes', tr('core.registry.autodash.s_3293ac18db'), 4, 0, 8, 6),
    metric('dev.delta.typing', 'wpm', 'stat', { x: 0, y: 6, w: 3, h: 4 }),
    metric('dev.delta.health', 'steps', 'stat', { x: 3, y: 6, w: 3, h: 4 }),
    metric('dev.delta.typing', 'accuracy', 'stat', { x: 6, y: 6, w: 3, h: 4 }),
    metric('dev.delta.finance', 'spend', 'stat', { x: 9, y: 6, w: 3, h: 4 }),
    metric(
      'dev.delta.typing',
      'wpm',
      'timeseries',
      { x: 0, y: 10, w: 8, h: 7 },
      {
        title: tr('core.registry.autodash.s_d39f5debb4'),
        display: { compare: false, chart: 'line' },
      },
    ),
    sys('plugins', tr('core.registry.autodash.s_b1b569eb07'), 8, 10, 4, 7),
    sys('events', tr('core.registry.autodash.s_2355a3badd'), 0, 17, 7, 8),
    metric(
      'dev.delta.home',
      'co2',
      'timeseries',
      { x: 7, y: 17, w: 5, h: 8 },
      { display: { chart: 'line', showThresholds: true } },
    ),
  ].filter(Boolean) as WidgetConfig[];
  return {
    id: 'home',
    name: tr('core.registry.autodash.s_39c6387206'),
    origin: 'home',
    range: '24h',
    refreshSec: 30,
    pinned: true,
    widgets,
    createdAt: t,
    updatedAt: t,
  };
}

export function mergeGeneratedDashboard(
  stored: DashboardConfig,
  fresh: DashboardConfig,
): DashboardConfig {
  const key = (w: WidgetConfig) =>
    w.source.kind === 'metric'
      ? `metric:${w.source.pluginId}:${w.source.metricId}`
      : w.source.kind === 'plugin-view'
        ? `view:${w.source.pluginId}:${w.source.viewId}`
        : `id:${w.id}`;
  const existing = new Set(stored.widgets.map(key));
  let y = nextFreeY(stored.widgets);
  const added = fresh.widgets
    .filter(
      (w) =>
        (w.source.kind === 'plugin-view' || (w.source.kind === 'metric' && w.type !== 'stat')) &&
        !existing.has(key(w)),
    )
    .map((w) => {
      existing.add(key(w));
      const next = { ...w, layout: { ...w.layout, x: 0, y, w: 12 } };
      y += w.layout.h;
      return next;
    });
  return { ...stored, widgets: [...stored.widgets, ...added] };
}
