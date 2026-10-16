import { useState } from 'react';
import type { WidgetProps } from '../types';
import { useQuery } from '@/app/query';
import { tr } from '@/i18n';
import { Button } from '@/ui/primitives';
import { Empty, ErrorState } from '@/ui/states';
import { DataCell } from '@/pages/plugins/PluginDataViews';
import { defaultsOf } from '@/pages/plugins/SettingsForm';

/** Record-data mode of the existing table widget; all columns and endpoints come from the plugin. */
export function PluginRowsTable({ config, ctx }: WidgetProps) {
  const src = config.source;
  if (src.kind !== 'plugin-view') return null;
  const view = ctx.plugin?.manifest.views.find((v) => v.id === src.viewId);
  // Remount pagination when a source, target or page size changes.
  return view ? (
    <Rows key={JSON.stringify([src, config.display.limit])} config={config} ctx={ctx} />
  ) : (
    <Empty compact title={tr('pluginData.empty')} />
  );
}
function Rows({ config, ctx }: WidgetProps) {
  const src = config.source;
  if (src.kind !== 'plugin-view') return null;
  const entry = ctx.plugin!;
  const view = entry.manifest.views.find((v) => v.id === src.viewId)!;
  const [offset, setOffset] = useState(0);
  const [selectedNode, setNode] = useState(src.nodeId || '');
  const node = selectedNode || entry.instance.nodeIds[0] || '';
  const limit = config.display.limit ?? view.dashboard?.limit ?? 10;
  const args = { ...defaultsOf(view.inputs), ...view.dashboard?.args, ...src.args, offset, limit };
  const q = useQuery(
    `plugins/${src.pluginId}/view/${src.viewId}/${node}/${JSON.stringify(args)}`,
    (api) => api.queryPluginView(src.pluginId, src.viewId, args, node),
    { refetchMs: ctx.refreshSec > 0 ? ctx.refreshSec * 1000 : 0 },
  );
  return (
    <div className="col" style={{ flex: 1, minHeight: 0, minWidth: 0, gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        {entry.instance.nodeIds.length > 1 && (
          <select
            className="select"
            aria-label={tr('polish.targetNode')}
            style={{ width: 'auto', minWidth: 0 }}
            value={node}
            onChange={(e) => {
              setNode(e.target.value);
              setOffset(0);
            }}
          >
            {entry.instance.nodeIds.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        )}
        <span className="spacer" />
        <Button size="sm" onClick={q.refetch} disabled={q.fetching}>
          {tr('pluginData.refresh')}
        </Button>
      </div>
      {q.error && <ErrorState error={q.error} onRetry={q.refetch} />}
      {!q.error && q.data?.rows.length === 0 && <Empty compact title={tr('pluginData.empty')} />}
      <div className="table-wrap" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table className="t">
          <thead>
            <tr>
              {view.columns.map((c) => (
                <th key={c.key} style={{ minWidth: c.width ?? 120 }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.data?.rows.map((row, i) => (
              <tr key={String(row.id ?? i)}>
                {view.columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      minWidth: c.width ?? 120,
                      maxWidth: c.width ?? 420,
                      verticalAlign: 'top',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <DataCell row={row} column={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Button
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          {tr('pluginData.previous')}
        </Button>
        <span className="muted">
          {q.data?.rows.length ? offset + 1 : 0}
          {'–'}
          {offset + (q.data?.rows.length ?? 0)}
          {' / '}
          {q.data?.total ?? '…'}
        </span>
        <Button
          size="sm"
          disabled={!q.data || offset + limit >= q.data.total}
          onClick={() => setOffset(offset + limit)}
        >
          {tr('pluginData.next')}
        </Button>
      </div>
    </div>
  );
}
