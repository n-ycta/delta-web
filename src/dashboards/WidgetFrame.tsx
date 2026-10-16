import { queryClient } from '@/app/query';
import { tr } from '@/i18n';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bug,
  Copy,
  Download,
  MoreHorizontal,
  RefreshCw,
  Puzzle,
  Settings2,
  Table2,
  Trash2,
} from 'lucide-react';
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
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Wraps every widget: resolves its type through the registry, checks that the source plugin
 * and metric still exist, isolates crashes, and offers recovery for each failure mode.
 */
export const WidgetFrame = memo(function WidgetFrame(p: FrameProps) {
  const { config, plugins, editing } = p;
  const api = useApi();
  const [refreshing, setRefreshing] = useState(false);
  const nav = useNavigate();
  const resolution = useMemo(() => widgetRegistry.resolve(config), [config]);
  const src = config.source;
  const plugin =
    src.kind !== 'system' ? plugins?.find((x) => x.manifest.id === src.pluginId) : undefined;
  const metric =
    src.kind === 'metric' ? plugin?.manifest.metrics.find((m) => m.id === src.metricId) : undefined;
  const def =
    resolution.status === 'ok' ||
    resolution.status === 'migrated' ||
    resolution.status === 'incompatible'
      ? resolution.def
      : undefined;
  const title =
    config.title ??
    (src.kind === 'plugin-view'
      ? plugin?.manifest.views.find((v) => v.id === src.viewId)?.label
      : undefined) ??
    (metric ? metric.label : (def?.label ?? config.type));
  const meta =
    src.kind === 'metric'
      ? tr('dashboards.WidgetFrame.s_dd3c8a278c', {
          p0: plugin?.manifest.name ?? src.pluginId,
          p1: src.groupBy
            ? tr('dashboards.WidgetFrame.s_840820b60c', {
                p0:
                  metric?.dimensions.find((d) => d.id === src.groupBy)?.label.toLowerCase() ??
                  src.groupBy,
              })
            : '',
          p2: config.display.rangeOverride ? ` · ${config.display.rangeOverride}` : '',
        })
      : '';

  const ctx: WidgetContext = {
    range: p.range,
    refreshSec: p.refreshSec,
    plugin,
    metric,
    editing,
    onDisplayChange: p.onDisplay,
  };

  let body: React.ReactNode;
  if (resolution.status === 'unknown') {
    const suggestions = metric
      ? widgetRegistry
          .rank(metric)
          .filter((r) => r.score > 0)
          .slice(0, 3)
      : [];
    body = (
      <Empty compact title={tr('dashboards.WidgetFrame.s_2c2af13255', { p0: config.type })}>
        {tr('dashboards.WidgetFrame.s_0cb3010192')}
        {suggestions.length > 0 && (
          <span className="row wrap" style={{ justifyContent: 'center', marginTop: 8 }}>
            {suggestions.map((s) => (
              <Button key={s.def.type} size="sm" onClick={() => p.onReplaceType(s.def.type)}>
                {tr('dashboards.WidgetFrame.s_1d1d39b42c')}
                {s.def.label}
              </Button>
            ))}
          </span>
        )}
      </Empty>
    );
  } else if (resolution.status === 'incompatible') {
    body = (
      <Empty compact title={tr('dashboards.WidgetFrame.s_a06ba31cc2')}>
        {resolution.reason}
        <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" onClick={p.onEdit}>
            {tr('dashboards.WidgetFrame.s_23a7943f69')}
          </Button>
        </span>
      </Empty>
    );
  } else if (src.kind !== 'system' && plugins && !plugin) {
    body = (
      <Empty compact title={tr('dashboards.WidgetFrame.s_33919e9edf')}>
        {tr('dashboards.WidgetFrame.s_9ab603d6a2')}
        <code>{src.pluginId}</code> {tr('dashboards.WidgetFrame.s_b24124e9a5')}
        <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" onClick={() => nav('/plugins?tab=available')}>
            {tr('dashboards.WidgetFrame.s_46e27e2f0a')}
          </Button>
          <Button size="sm" variant="ghost" onClick={p.onRemove}>
            {tr('dashboards.WidgetFrame.s_86253d1273')}
          </Button>
        </span>
      </Empty>
    );
  } else if (src.kind !== 'system' && plugin && !plugin.instance.installedVersion) {
    body = (
      <Empty compact title={tr('dashboards.WidgetFrame.s_bb1b88f624')}>
        <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" onClick={() => nav(`/plugins/${plugin.manifest.id}`)}>
            {tr('dashboards.WidgetFrame.s_02059d443f')}
            {plugin.manifest.name}
          </Button>
        </span>
      </Empty>
    );
  } else if (src.kind !== 'system' && plugin?.instance.status === 'disabled') {
    body = (
      <Empty compact title={tr('dashboards.WidgetFrame.s_01abca4746')}>
        {tr('dashboards.WidgetFrame.s_a35299d33c')}
        {plugin.manifest.name} {tr('dashboards.WidgetFrame.s_0a01c4558f')}
        <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" onClick={() => nav(`/plugins/${plugin.manifest.id}`)}>
            {tr('dashboards.WidgetFrame.s_468651bc6d')}
          </Button>
        </span>
      </Empty>
    );
  } else if (src.kind === 'metric' && plugin && !metric) {
    body = (
      <Empty compact title={tr('dashboards.WidgetFrame.s_138448ffc0')}>
        {tr('dashboards.WidgetFrame.s_3bfbed6fb0')}
        {plugin.manifest.name} {plugin.manifest.version} {tr('dashboards.WidgetFrame.s_aedf11c967')}
        <code>{src.metricId}</code>
        {tr('dashboards.WidgetFrame.s_3a52ce7809')}
        <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" onClick={p.onEdit}>
            {tr('dashboards.WidgetFrame.s_88caca10d3')}
          </Button>
        </span>
      </Empty>
    );
  } else if (!plugins && src.kind !== 'system') {
    body = null;
  } else if (
    def &&
    src.kind === 'metric' &&
    metric &&
    def.accepts &&
    def.accepts(metric).score === 0
  ) {
    body = (
      <Empty
        compact
        title={tr('dashboards.WidgetFrame.s_efbfb8bc2d', { p0: def.label, p1: metric.label })}
      >
        {def.accepts(metric).reason}
        <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" onClick={() => p.onReplaceType(widgetRegistry.best(metric)!.type)}>
            {tr('dashboards.WidgetFrame.s_d159880770')}
            {widgetRegistry.best(metric)!.label}
            {tr('dashboards.WidgetFrame.s_f21045a640')}
          </Button>
        </span>
      </Empty>
    );
  } else {
    const C = def!.component;
    body = (
      <ErrorBoundary
        resetKey={JSON.stringify(config)}
        fallback={(e, reset) => (
          <Empty compact icon={<Bug size={16} />} title={tr('dashboards.WidgetFrame.s_58eb564e7a')}>
            {e.message}
            <span className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <Button size="sm" onClick={reset}>
                {tr('dashboards.WidgetFrame.s_7ff2b51c23')}
              </Button>
            </span>
          </Empty>
        )}
      >
        <C config={resolution.config} ctx={ctx} />
      </ErrorBoundary>
    );
  }

  const exportCsv = async () => {
    const q = buildQuery(config, ctx);
    if (!q) return;
    try {
      download(
        `${config.source.kind === 'metric' ? config.source.metricId : 'widget'}.csv`,
        resultToCsv(await api.queryMetric(q)),
      );
    } catch (e) {
      toast({
        severity: 'error',
        title: tr('dashboards.WidgetFrame.s_074e8851d2'),
        body: (e as Error).message,
      });
    }
  };

  return (
    <div className={`widget ${p.selected ? 'selected' : ''}`}>
      <div className="widget-head drag-handle">
        {def && <Icon name={def.icon} size={13} className="faint" />}
        <span className="widget-title truncate">{title}</span>
        {meta && <span className="widget-meta truncate desktop-only">{meta}</span>}
        <span className="spacer" />
        {src.kind === 'plugin-view' && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            title={tr('pluginData.refresh')}
            aria-label={tr('pluginData.refresh')}
            disabled={refreshing}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={async () => {
              setRefreshing(true);
              try {
                await queryClient.refetchPrefix(`plugins/${src.pluginId}/view/${src.viewId}`);
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw size={14} />
          </Button>
        )}

        {resolution.status === 'migrated' && (
          <span
            className="badge mono"
            title={tr('dashboards.WidgetFrame.s_840541b11f', { p0: resolution.from })}
          >
            {tr('dashboards.WidgetFrame.s_cf199422dc')}
          </span>
        )}
        <Menu
          trigger={(t) => (
            <Button
              {...t}
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={tr('dashboards.WidgetFrame.s_9978ac34b2')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={14} />
            </Button>
          )}
          items={[
            {
              label: tr('dashboards.WidgetFrame.s_8960ddc30e'),
              icon: <Settings2 size={14} />,
              onSelect: p.onEdit,
            },
            {
              label: tr('dashboards.WidgetFrame.s_c9a3458cb5'),
              icon: <Copy size={14} />,
              onSelect: p.onDuplicate,
            },
            ...(src.kind === 'metric'
              ? [
                  {
                    label: tr('dashboards.WidgetFrame.s_80e915ce99'),
                    icon: <Table2 size={14} />,
                    onSelect: () => p.onReplaceType('table'),
                    disabled: config.type === 'table',
                  },
                  {
                    label: tr('dashboards.WidgetFrame.s_8ef2fb6d35'),
                    icon: <Download size={14} />,
                    onSelect: exportCsv,
                  },
                  {
                    label: tr('dashboards.WidgetFrame.s_468651bc6d'),
                    icon: <Puzzle size={14} />,
                    onSelect: () => nav(`/plugins/${src.pluginId}`),
                  },
                ]
              : []),
            { separator: true },
            {
              label: tr('dashboards.WidgetFrame.s_86ea33aef5'),
              icon: <Trash2 size={14} />,
              danger: true,
              onSelect: p.onRemove,
            },
          ]}
        />
      </div>
      <div className="widget-body">{body}</div>
    </div>
  );
});
