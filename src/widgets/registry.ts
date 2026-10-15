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

const hasDims = (m: MetricDescriptor) => m.dimensions.some((d) => (d.values?.length ?? 0) > 1);
const no = (reason: string) => ({ score: 0, reason });

/**
 * Built-in widget types. Third-party widget packs can call widgetRegistry.register()
 * before the app mounts (see docs/extending.md).
 */
export const widgetRegistry = new WidgetRegistry()
  .register({
    type: 'timeseries', version: '1.2.0', label: 'Временной ряд', icon: 'chart-line', category: 'metric', aliases: ['line', 'area', 'timeline'],
    description: 'Линии, области или столбцы во времени; серии по измерению, сравнение с прошлым периодом',
    accepts: (m) => ({ gauge: { score: 90 }, ratio: { score: 80 }, counter: { score: 65 }, duration: { score: 60 }, event: { score: 50 }, distribution: no('Распределение не имеет временной оси'), categorical: no('Категории без временной оси') }[m.kind]),
    defaultSize: { w: 6, h: 7 }, minSize: { w: 3, h: 4 },
    defaultDisplay: (m) => ({ chart: m && (m.kind === 'counter' || m.kind === 'duration') ? 'bar' : 'line', showGrid: true }),
    options: ['chart', 'stacked', 'legend', 'grid', 'compare', 'colors', 'decimals', 'yRange', 'thresholds', 'range'],
    component: TimeseriesWidget,
  })
  .register({
    type: 'stat', version: '1.0.0', label: 'Показатель', icon: 'hash', category: 'metric', aliases: ['sparkline', 'kpi', 'number'],
    description: 'Итоговое значение, изменение к прошлому периоду и мини-тренд',
    accepts: (m) => (['categorical', 'distribution'].includes(m.kind) ? no('Нет скалярного итога') : { score: 60 }),
    defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 2 },
    options: ['colors', 'decimals', 'range'],
    component: StatWidget,
  })
  .register({
    type: 'gauge', version: '1.0.0', label: 'Шкала', icon: 'gauge', category: 'metric', aliases: ['dial', 'radial'],
    description: 'Положение значения в известном диапазоне, с порогами',
    accepts: (m) => (m.kind === 'ratio' ? { score: 85 } : m.kind === 'gauge' && m.range ? { score: 70 } : m.kind === 'gauge' ? { score: 25, reason: 'Диапазон не объявлен — шкала по данным' } : no('Нужна мгновенная величина с диапазоном')),
    defaultSize: { w: 4, h: 6 }, minSize: { w: 2, h: 3 },
    options: ['colors', 'range'],
    component: GaugeWidget,
  })
  .register({
    type: 'bar', version: '1.0.0', label: 'Столбцы', icon: 'chart-column', category: 'metric', aliases: ['column', 'histogram-time'],
    description: 'Суммы по интервалам времени (по дням для ≥7д) или по категориям',
    accepts: (m) => ({ counter: { score: 80 }, duration: { score: 75 }, categorical: { score: 80 }, event: { score: 70 }, gauge: { score: hasDims(m) ? 45 : 30 }, ratio: { score: 20 }, distribution: no('Используйте «Распределение»') }[m.kind]),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 3, h: 4 },
    options: ['stacked', 'legend', 'grid', 'colors', 'decimals', 'limit', 'range'],
    component: BarWidget,
  })
  .register({
    type: 'heatmap', version: '1.0.0', label: 'Тепловая карта', icon: 'grid-3x3', category: 'metric', aliases: ['calendar', 'punchcard'],
    description: 'Активность по дням недели и часам',
    accepts: (m) => ({ counter: { score: 70 }, event: { score: 75 }, duration: { score: 55 }, gauge: { score: 30 }, ratio: { score: 20 }, categorical: no('Нужна временная величина'), distribution: no('Нужна временная величина') }[m.kind]),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 4, h: 4 },
    options: ['colors', 'range'],
    component: HeatmapWidget,
  })
  .register({
    type: 'distribution', version: '1.0.0', label: 'Распределение', icon: 'chart-no-axes-column', category: 'metric', aliases: ['histogram'],
    description: 'Гистограмма значений с медианой и p95',
    accepts: (m) => (m.kind === 'distribution' ? { score: 95 } : no('Метрика не передаёт гистограмму')),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 3, h: 4 },
    options: ['colors', 'range'],
    component: DistributionWidget,
  })
  .register({
    type: 'breakdown', version: '1.0.0', label: 'Структура', icon: 'chart-pie', category: 'metric', aliases: ['pie', 'donut', 'share', 'treemap'],
    description: 'Доли категорий или значений измерения',
    accepts: (m) => (m.kind === 'categorical' ? { score: 90 } : (m.kind === 'counter' || m.kind === 'duration') && hasDims(m) ? { score: 62 } : no('Нужны категории или измерение со значениями')),
    defaultSize: { w: 5, h: 6 }, minSize: { w: 3, h: 4 },
    options: ['colors', 'limit', 'range'],
    component: BreakdownWidget,
  })
  .register({
    type: 'comparison', version: '1.0.0', label: 'Сравнение', icon: 'git-compare-arrows', category: 'metric', aliases: ['versus', 'compare'],
    description: 'Значения измерения рядом: разница, тренд и динамика к прошлому периоду',
    accepts: (m) => (hasDims(m) && ['gauge', 'ratio', 'counter', 'duration'].includes(m.kind) ? { score: m.kind === 'gauge' || m.kind === 'ratio' ? 78 : 55 } : no('Нужно измерение с несколькими значениями')),
    defaultSize: { w: 5, h: 5 }, minSize: { w: 3, h: 3 },
    options: ['colors', 'range'],
    component: ComparisonWidget,
  })
  .register({
    type: 'table', version: '1.0.0', label: 'Таблица', icon: 'table', category: 'metric', aliases: ['raw'],
    description: 'Сырые значения — универсальный запасной вариант',
    accepts: () => ({ score: 15 }),
    defaultSize: { w: 6, h: 6 }, minSize: { w: 3, h: 3 },
    options: ['decimals', 'range'],
    component: TableWidget,
  })
  .register({ type: 'node-grid', version: '1.0.0', label: 'Узлы', icon: 'server', category: 'system', description: 'Статус и нагрузка всех узлов', defaultSize: { w: 8, h: 6 }, minSize: { w: 3, h: 3 }, options: [], component: NodeGridWidget })
  .register({ type: 'event-feed', version: '1.0.0', label: 'Лента событий', icon: 'list', category: 'system', description: 'Последние события ядра в реальном времени', defaultSize: { w: 6, h: 8 }, minSize: { w: 3, h: 4 }, options: ['limit'], component: EventFeedWidget })
  .register({ type: 'alerts', version: '1.0.0', label: 'Требует внимания', icon: 'triangle-alert', category: 'system', description: 'Проблемы узлов и плагинов, обновления', defaultSize: { w: 4, h: 6 }, minSize: { w: 3, h: 3 }, options: [], component: AlertsWidget })
  .register({ type: 'plugin-activity', version: '1.0.0', label: 'Активность источников', icon: 'activity', category: 'system', description: 'Поток данных от установленных плагинов', defaultSize: { w: 4, h: 7 }, minSize: { w: 3, h: 4 }, options: [], component: PluginActivityWidget })
  .register({ type: 'note', version: '1.0.0', label: 'Заметка', icon: 'sticky-note', category: 'system', description: 'Текстовая пометка на дашборде', defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, options: ['text'], component: NoteWidget });

export const SYSTEM_FEEDS: Record<string, 'nodes' | 'events' | 'alerts' | 'plugins' | 'note'> = {
  'node-grid': 'nodes', 'event-feed': 'events', alerts: 'alerts', 'plugin-activity': 'plugins', note: 'note',
};
