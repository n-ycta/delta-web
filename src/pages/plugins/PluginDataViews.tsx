import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { tr, locale } from '@/i18n';
import type { PluginEntry, PluginDataView } from '@/core/contracts';
import { useQuery } from '@/app/query';
import { Button, Panel } from '@/ui/primitives';
import { ErrorState, Empty } from '@/ui/states';
import { SettingsForm, defaultsOf } from './SettingsForm';
export function safeDataLink(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function DataCell({
  row,
  column,
}: {
  row: Record<string, unknown>;
  column: PluginDataView['columns'][number];
}) {
  const value = row[column.key];
  if (value === null || value === undefined) return <>{'—'}</>;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (column.type === 'link') {
    const url = safeDataLink(row[column.urlKey || column.key]);
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        {text}
      </a>
    ) : (
      <>{text}</>
    );
  }
  if (column.type === 'datetime') {
    const date = new Date(Number(value));
    return (
      <>
        {Number(value) > 0 && Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : '—'}
      </>
    );
  }
  return <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</span>;
}
function DataView({ entry, view }: { entry: PluginEntry; view: PluginDataView }) {
  const [nodeId, setNodeId] = useState(entry.instance.nodeIds[0] || '');
  const [args, setArgs] = useState<Record<string, unknown>>(defaultsOf(view.inputs));
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const q = useQuery(
    `plugins/${entry.manifest.id}/view/${view.id}/${nodeId}/${offset}/${JSON.stringify(args)}`,
    (api) => api.queryPluginView(entry.manifest.id, view.id, { ...args, offset, limit }, nodeId),
    { refetchMs: view.refreshSec * 1000 },
  );
  return (
    <Panel
      title={view.label}
      actions={
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          title={tr('pluginData.refresh')}
          aria-label={tr('pluginData.refresh')}
          onClick={q.refetch}
          disabled={q.fetching}
        >
          <RefreshCw size={14} />
        </Button>
      }
    >
      <div className="col" style={{ gap: 16, minWidth: 0 }}>
        <label className="field">
          {tr('polish.targetNode')}
          <select
            className="select"
            value={nodeId}
            onChange={(e) => {
              setNodeId(e.target.value);
              setOffset(0);
            }}
          >
            {entry.instance.nodeIds.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        {view.inputs.length > 0 && (
          <SettingsForm
            fields={view.inputs}
            values={args}
            onSubmit={(values) => {
              setArgs(values);
              setOffset(0);
            }}
            submitLabel={tr('pluginData.apply')}
            allowPristine
          />
        )}
        {q.error && <ErrorState error={q.error} onRetry={q.refetch} />}
        {!q.error && q.data?.rows.length === 0 && <Empty compact title={tr('pluginData.empty')} />}
        {!!q.data?.rows.length && (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  {view.columns.map((c) => (
                    <th
                      key={c.key}
                      style={{ minWidth: c.width ?? (c.type === 'link' ? 260 : 140) }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((row, i) => (
                  <tr key={String(row.id ?? i)}>
                    {view.columns.map((c) => (
                      <td
                        key={c.key}
                        style={{
                          minWidth: c.width ?? (c.type === 'link' ? 260 : 140),
                          maxWidth: c.width ?? 420,
                          verticalAlign: 'top',
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
        )}
        <div className="row">
          <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            {tr('pluginData.previous')}
          </Button>
          <span>
            {q.data?.rows.length ? offset + 1 : 0}
            {'–'}
            {offset + (q.data?.rows.length || 0)}
            {' / '}
            {q.data?.total ?? '…'}
          </span>
          <Button
            disabled={!q.data || offset + limit >= q.data.total}
            onClick={() => setOffset(offset + limit)}
          >
            {tr('pluginData.next')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
export function PluginDataViews({ entry }: { entry: PluginEntry }) {
  return (
    <div className="col gap-4">
      {entry.manifest.views.map((view) => (
        <DataView key={view.id} entry={entry} view={view} />
      ))}
    </div>
  );
}
