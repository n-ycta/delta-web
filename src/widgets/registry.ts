import {BubblesWidget} from './charts/BubblesWidget';
import { tr } from '@/i18n';
import type { MetricDescriptor } from '@/core/contracts';
import { WidgetRegistry } from '@/core/registry/WidgetRegistry';
import { TimeseriesWidget } from './charts/TimeseriesWidget';
import { StatWidget } from './charts/StatWidget';
import { GaugeWidget } from './charts/GaugeWidget';
import { BarWidget } from './charts/BarWidget';
import { HeatmapWidget } from './charts/HeatmapWidget';
import { DistributionWidget } from './charts/DistributionWidget';
import { BreakdownWidget } from './charts/BreakdownWidget';
import { ComparisonWidget } from './charts/ComparisonWidget';
import { TableWidget } from './charts/TableWidget';
import { NodeGridWidget } from './system/NodeGridWidget';
import { EventFeedWidget } from './system/EventFeedWidget';
import { AlertsWidget } from './system/AlertsWidget';
import { PluginActivityWidget } from './system/PluginActivityWidget';
import { NoteWidget } from './system/NoteWidget';

const hasDims = (m: MetricDescriptor) => m.dimensions.some((d) => !d.values || d.values.length > 1);
const no = (reason: string) => ({ score: 0, reason });

/**
 * Built-in widget types. Third-party widget packs can call widgetRegistry.register()
 * before the app mounts (see docs/extending.md).
 */
export const widgetRegistry = new WidgetRegistry()
 .register({type:'bubbles',version:'1.0.0',label:tr('analytics.bubbles'),description:tr('analytics.bubblesDescription'),icon:'circle',category:'metric',accepts:m=>m.kind==='categorical'?{score:95}:{score:0},defaultSize:{w:8,h:9},minSize:{w:3,h:6},defaultDisplay:()=>({limit:20}),options:['limit','colors','range'],component:BubblesWidget})
  .register({
    type: 'timeseries', version: '1.3.0', label: tr("widgets.registry.s_06f34f792c"), icon: 'chart-line', category: 'metric', aliases: ['line', 'area', 'timeline'],
    description: tr("widgets.registry.s_4bfbb533ae"),
    accepts: (m) => ({ gauge: { score: 90 }, ratio: { score: 80 }, counter: { score: 65 }, duration: { score: 60 }, event: { score: 50 }, distribution: no(tr("widgets.registry.s_ac5ccfbc8c")), categorical: no(tr("widgets.registry.s_bd71b4011d")) }[m.kind]),
    defaultSize: { w: 6, h: 7 }, minSize: { w: 3, h: 4 },
    defaultDisplay: (m) => ({ chart: m && (m.kind === 'counter' || m.kind === 'duration') ? 'bar' : 'line', showGrid: true }),
    options: ['chart', 'interval', 'stacked', 'legend', 'grid', 'compare', 'colors', 'decimals', 'yRange', 'thresholds', 'range'],
    component: TimeseriesWidget,
  })
  .register({
    type: 'stat', version: '1.0.0', label: tr("widgets.registry.s_5338f9a47e"), icon: 'hash', category: 'metric', aliases: ['sparkline', 'kpi', 'number'],
    description: tr("widgets.registry.s_78bc95f4da"),
    accepts: (m) => (['categorical', 'distribution'].includes(m.kind) ? no(tr("widgets.registry.s_439c5864a9")) : { score: 60 }),
    defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 2 },
    options: ['colors', 'decimals', 'range'],
    component: StatWidget,
  })
  .register({
    type: 'gauge', version: '1.0.0', label: tr("widgets.registry.s_a2a52d6200"), icon: 'gauge', category: 'metric', aliases: ['dial', 'radial'],
    description: tr("widgets.registry.s_52ea3d6949"),
    accepts: (m) => (m.kind === 'ratio' ? { score: 85 } : m.kind === 'gauge' && m.range ? { score: 70 } : m.kind === 'gauge' ? { score: 25, reason: tr("widgets.registry.s_07912941b8") } : no(tr("widgets.registry.s_2214a110cc"))),
    defaultSize: { w: 4, h: 6 }, minSize: { w: 2, h: 3 },
    options: ['colors', 'range'],
    component: GaugeWidget,
  })
  .register({
    type: 'bar', version: '1.0.0', label: tr("widgets.registry.s_d47f0a8a49"), icon: 'chart-column', category: 'metric', aliases: ['column', 'histogram-time'],
    description: tr("widgets.registry.s_bcba0e5b1d"),
    accepts: (m) => ({ counter: { score: 80 }, duration: { score: 75 }, categorical: { score: 80 }, event: { score: 70 }, gauge: { score: hasDims(m) ? 45 : 30 }, ratio: { score: 20 }, distribution: no(tr("widgets.registry.s_2203402225")) }[m.kind]),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 3, h: 4 },
    options: ['stacked', 'legend', 'grid', 'colors', 'decimals', 'limit', 'range'],
    component: BarWidget,
  })
  .register({
    type: 'heatmap', version: '1.0.0', label: tr("widgets.registry.s_5f30941aad"), icon: 'grid-3x3', category: 'metric', aliases: ['calendar', 'punchcard'],
    description: tr("widgets.registry.s_595af05781"),
    accepts: (m) => ({ counter: { score: 70 }, event: { score: 75 }, duration: { score: 55 }, gauge: { score: 30 }, ratio: { score: 20 }, categorical: no(tr("widgets.registry.s_ac3f9e9000")), distribution: no(tr("widgets.registry.s_ac3f9e9000")) }[m.kind]),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
    options: ['colors', 'range'],
    component: HeatmapWidget,
  })
  .register({
    type: 'distribution', version: '1.0.0', label: tr("widgets.registry.s_1aff9ed9b2"), icon: 'chart-no-axes-column', category: 'metric', aliases: ['histogram'],
    description: tr("widgets.registry.s_a02b94dfc4"),
    accepts: (m) => (m.kind === 'distribution' ? { score: 95 } : no(tr("widgets.registry.s_5fc9475ee3"))),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 3, h: 4 },
    options: ['colors', 'range'],
    component: DistributionWidget,
  })
  .register({
    type: 'breakdown', version: '1.0.0', label: tr("widgets.registry.s_c5130b71ff"), icon: 'chart-pie', category: 'metric', aliases: ['pie', 'donut', 'share', 'treemap'],
    description: tr("widgets.registry.s_7fee68c1df"),
    accepts: (m) => (m.kind === 'categorical' ? { score: 90 } : (m.kind === 'counter' || m.kind === 'duration') && hasDims(m) ? { score: 62 } : no(tr("widgets.registry.s_606e9d092c"))),
    defaultSize: { w: 5, h: 6 }, minSize: { w: 3, h: 4 },
    options: ['colors', 'limit', 'range'],
    component: BreakdownWidget,
  })
  .register({
    type: 'comparison', version: '1.0.0', label: tr("widgets.registry.s_189d15bc7e"), icon: 'git-compare-arrows', category: 'metric', aliases: ['versus', 'compare'],
    description: tr("widgets.registry.s_1f8f8fd642"),
    accepts: (m) => (hasDims(m) && ['gauge', 'ratio', 'counter', 'duration'].includes(m.kind) ? { score: m.kind === 'gauge' || m.kind === 'ratio' ? 78 : 55 } : no(tr("widgets.registry.s_6e0a468bf7"))),
    defaultSize: { w: 5, h: 5 }, minSize: { w: 3, h: 3 },
    options: ['colors', 'range'],
    component: ComparisonWidget,
  })
  .register({
    type: 'table', version: '1.0.0', label: tr("widgets.registry.s_f2729fd738"), icon: 'table', category: 'metric', aliases: ['raw'],
    description: tr("widgets.registry.s_0e98484d05"),
    accepts: () => ({ score: 15 }),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 3, h: 3 },
    options: ['decimals', 'limit', 'range'],
    component: TableWidget,
  })
  .register({ type: 'node-grid', version: '1.0.0', label: tr("widgets.registry.s_3293ac18db"), icon: 'server', category: 'system', description: tr("widgets.registry.s_814c2a5232"), defaultSize: { w: 8, h: 6 }, minSize: { w: 3, h: 3 }, options: [], component: NodeGridWidget })
  .register({ type: 'event-feed', version: '1.0.0', label: tr("widgets.registry.s_6710e64cad"), icon: 'list', category: 'system', description: tr("widgets.registry.s_24d3c6a75a"), defaultSize: { w: 6, h: 8 }, minSize: { w: 3, h: 4 }, options: ['limit'], component: EventFeedWidget })
  .register({ type: 'alerts', version: '1.0.0', label: tr("widgets.registry.s_925c5165a9"), icon: 'triangle-alert', category: 'system', description: tr("widgets.registry.s_49a9d02730"), defaultSize: { w: 4, h: 6 }, minSize: { w: 3, h: 3 }, options: [], component: AlertsWidget })
  .register({ type: 'plugin-activity', version: '1.0.0', label: tr("widgets.registry.s_b1b569eb07"), icon: 'activity', category: 'system', description: tr("widgets.registry.s_bbea526590"), defaultSize: { w: 4, h: 7 }, minSize: { w: 3, h: 4 }, options: [], component: PluginActivityWidget })
  .register({ type: 'note', version: '1.0.0', label: tr("widgets.registry.s_917b58362c"), icon: 'sticky-note', category: 'system', description: tr("widgets.registry.s_2457b654e7"), defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, options: ['text'], component: NoteWidget });

export const SYSTEM_FEEDS: Record<string, 'nodes' | 'events' | 'alerts' | 'plugins' | 'note'> = {
  'node-grid': 'nodes', 'event-feed': 'events', alerts: 'alerts', 'plugin-activity': 'plugins', note: 'note',
};
