import { tr } from '@/i18n';
import { Link } from 'react-router-dom';
import type { WidgetProps } from '../types';
import { useQuery } from '@/app/query';
import { useUi } from '@/app/stores';
import { fmtTime } from '@/core/lib/format';
import { ErrorState, SkeletonRows, Empty } from '@/ui/states';
import type { CoreEvent, Severity } from '@/core/contracts';

const ORDER: Severity[] = ['debug', 'info', 'warn', 'error', 'critical'];

export function EventFeedWidget({ config }: WidgetProps) {
  const minSev = ((config.source.kind === 'system' ? config.source.params?.minSeverity : undefined) as Severity | undefined) ?? 'info';
  const q = useQuery<CoreEvent[]>('events/feed', (api) => api.listEvents({ limit: 60 }));
  const live = useUi((s) => s.live);
  if (q.loading) return <SkeletonRows rows={6} h={14} />;
  if (q.error && !q.data) return <ErrorState compact error={q.error} onRetry={q.refetch} />;
  const seen = new Set<string>();
  const items = [...live, ...(q.data ?? [])].filter((e) => !seen.has(e.id) && seen.add(e.id) && ORDER.indexOf(e.severity) >= ORDER.indexOf(minSev)).slice(0, config.display.limit ?? 40);
  if (!items.length) return <Empty compact title={tr("widgets.system.EventFeedWidget.s_b5ac581559")} />;
  return (
    <div style={{ overflow: 'auto', flex: 1, margin: '0 -12px' }}>
      {items.map((e) => (
        <Link key={e.id} to={`/events?focus=${e.id}`} style={{ display: 'grid', gridTemplateColumns: '56px 44px minmax(0,1fr)', gap: 8, padding: '5px 12px', borderTop: '1px solid var(--rule)', fontSize: 12, alignItems: 'baseline' }}>
          <span className="num muted" style={{ fontSize: 11 }}>{fmtTime(e.ts, true)}</span>
          <span className={`sev ${e.severity}`}>{e.severity === 'critical' ? 'crit' : e.severity}</span>
          <span className="truncate"><span className="muted mono" style={{ fontSize: 11 }}>{e.source.label ?? e.source.id}</span> {e.message}</span>
        </Link>
      ))}
    </div>
  );
}
