import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, Copy, Download, MoreHorizontal, Puzzle, Settings2, Table2, Trash2 } from 'lucide-react';
import type { PluginEntry, WidgetConfig, WidgetDisplay, TimeRangePreset } from '@/core/contracts';
import { widgetRegistry } from '@/widgets/registry';
import type { WidgetContext } from '@/widgets/types';
import { Menu } from '@/ui/overlays';
import { Button } from '@/ui/primitives';
import { Empty } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { ErrorBoundary } from './ErrorBoundary';
import { useApi } from '@/app/ApiContext';
import { resultToCsv } from '@/widgets/charts/TableWidget';
import { buildQuery } from '@/widgets/shared';
import { toast } from '@/app/stores';

export interface FrameProps {
  config: WidgetConfig;
  plugins: PluginEntry[] | undefined;
  range: TimeRangePreset;
  refreshSec: number;
  editing: boolean;
  selected?: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onDisplay: (patch: Partial<WidgetDisplay>) => void;
  onReplaceType: (type: string) => void;
}

function download(name: string, text: string, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Wraps every widget: resolves its type through the registry, checks that the source plugin
 * and metric still exist, isolates crashes, and offers recovery for each failure mode.
 */
export const WidgetFrame = memo(function WidgetFrame(p: FrameProps) {
  const { config, plugins, editing } = p;
  const api = useApi();
  const nav = useNavigate();
  const resolution = useMemo(() => widgetRegistry.resolve(config), [config]);
  const src = config.source;
  const plugin = src.kind === 'metric' ? plugins?.find((x) => x.manifest.id === src.pluginId) : undefined;
  const metric = src.kind === 'metric' ? plugin?.manifest.metrics.find((m) => m.id === src.metricId) : undefined;
  const def = resolution.status === 'ok' || resolution.status === 'migrated' || resolution.status === 'incompatible' ? resolution.def : undefined;
  const title = config.title ?? (metric ? metric.label : def?.label ?? config.type);
  const meta = src.kind === 'metric' ? `${plugin?.manifest.name ?? src.pluginId}${src.groupBy ? ` · по ${metric?.dimensions.find((d) => d.id === src.groupBy)?.label.toLowerCase() ?? src.groupBy}` : ''}${config.display.rangeOverride ? ` · ${config.display.rangeOverride}` : ''}` : '';

  const ctx: WidgetContext = { range: p.range, refreshSec: p.refreshSec, plugin, metric, editing, onDisplayChange: p.onDisplay };

  let body: React.ReactNode;
  if (resolution.status === 'unknown') {
    const suggestions = metric ? widgetRegistry.rank(metric).filter((r) => r.score > 0).slice(0, 3) : [];
    body = (
      <Empty compact title={`Неизвестный тип «${config.type}»`}>
        Этот виджет создан более новой версией консоли или пакетом, который не загружен.
        {suggestions.length > 0 && <span className="row wrap" style={{ justifyContent: 'center', marginTop: 8 }}>{suggestions.map((s) => <Button key={s.def.type} size="sm" onClick={() => p.onReplaceType(s.def.type)}>→ {s.def.label}</Button>)}</span>}
      </Empty>
    );
  } else if (resolution.status === 'incompatible') {
    body = <Empty compact title="Несовместимая конфигурация">{resolution.reason}<span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={p.onEdit}>Перенастроить</Button></span></Empty>;
  } else if (src.kind === 'metric' && plugins && !plugin) {
    body = <Empty compact title="Источник удалён">Плагин <code>{src.pluginId}</code> не найден в ядре.<span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={() => nav('/plugins?tab=available')}>Каталог</Button><Button size="sm" variant="ghost" onClick={p.onRemove}>Убрать виджет</Button></span></Empty>;
  } else if (src.kind === 'metric' && plugin && !plugin.instance.installedVersion) {
    body = <Empty compact title="Плагин не установлен"><span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={() => nav(`/plugins/${plugin.manifest.id}`)}>Установить {plugin.manifest.name}</Button></span></Empty>;
  } else if (src.kind === 'metric' && plugin?.instance.status === 'disabled') {
    body = <Empty compact title="Плагин отключён">Данные не поступают, пока {plugin.manifest.name} выключен.<span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={() => nav(`/plugins/${plugin.manifest.id}`)}>Открыть плагин</Button></span></Empty>;
  } else if (src.kind === 'metric' && plugin && !metric) {
    body = <Empty compact title="Метрика больше не объявлена">В {plugin.manifest.name} {plugin.manifest.version} нет метрики <code>{src.metricId}</code>.<span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={p.onEdit}>Выбрать другую</Button></span></Empty>;
  } else if (!plugins && src.kind === 'metric') {
    body = null;
  } else if (def && src.kind === 'metric' && metric && def.accepts && def.accepts(metric).score === 0) {
    body = <Empty compact title={`«${def.label}» не подходит для ${metric.label}`}>{def.accepts(metric).reason}<span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={() => p.onReplaceType(widgetRegistry.best(metric)!.type)}>Заменить на «{widgetRegistry.best(metric)!.label}»</Button></span></Empty>;
  } else {
    const C = def!.component;
    body = (
      <ErrorBoundary resetKey={JSON.stringify(config)} fallback={(e, reset) => <Empty compact icon={<Bug size={16} />} title="Виджет упал">{e.message}<span className="row" style={{ justifyContent: 'center', marginTop: 8 }}><Button size="sm" onClick={reset}>Перезапустить</Button></span></Empty>}>
        <C config={resolution.config} ctx={ctx} />
      </ErrorBoundary>
    );
  }

  const exportCsv = async () => {
    const q = buildQuery(config, ctx);
    if (!q) return;
    try { download(`${config.source.kind === 'metric' ? config.source.metricId : 'widget'}.csv`, resultToCsv(await api.queryMetric(q))); }
    catch (e) { toast({ severity: 'error', title: 'Экспорт не удался', body: (e as Error).message }); }
  };

  return (
    <div className={`widget ${p.selected ? 'selected' : ''}`}>
      <div className="widget-head drag-handle">
        {def && <Icon name={def.icon} size={13} className="faint" />}
        <span className="widget-title truncate">{title}</span>
        {meta && <span className="widget-meta truncate desktop-only">{meta}</span>}
        <span className="spacer" />
        {resolution.status === 'migrated' && <span className="badge mono" title={`Конфигурация мигрирована с v${resolution.from}`}>migrated</span>}
        <Menu trigger={(t) => <Button {...t} variant="ghost" size="sm" iconOnly aria-label="Действия" onMouseDown={(e) => e.stopPropagation()}><MoreHorizontal size={14} /></Button>} items={[
          { label: 'Настроить', icon: <Settings2 size={14} />, onSelect: p.onEdit },
          { label: 'Дублировать', icon: <Copy size={14} />, onSelect: p.onDuplicate },
          ...(src.kind === 'metric' ? [
            { label: 'Показать как таблицу', icon: <Table2 size={14} />, onSelect: () => p.onReplaceType('table'), disabled: config.type === 'table' },
            { label: 'Экспорт CSV', icon: <Download size={14} />, onSelect: exportCsv },
            { label: 'Открыть плагин', icon: <Puzzle size={14} />, onSelect: () => nav(`/plugins/${src.pluginId}`) },
          ] : []),
          { separator: true },
          { label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: p.onRemove },
        ]} />
      </div>
      <div className="widget-body">{body}</div>
    </div>
  );
});
