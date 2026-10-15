import { Link } from 'react-router-dom';
import type { WidgetProps } from '../types';
import { useNodes } from '@/app/data';
import { Dot, Meter } from '@/ui/primitives';
import { Icon } from '@/ui/Icon';
import { NODE_STATUS } from '@/ui/status';
import { ago } from '@/core/lib/format';
import { ErrorState, SkeletonRows } from '@/ui/states';

export const NODE_ICON: Record<string, string> = { vps: 'server', android: 'smartphone', desktop: 'monitor', sbc: 'cpu', container: 'container' };

export function NodeGridWidget(_: WidgetProps) {
  const { data, error, loading, refetch } = useNodes();
  if (loading) return <SkeletonRows rows={4} />;
  if (error && !data) return <ErrorState compact error={error} onRetry={refetch} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, overflow: 'auto' }}>
      {data!.map((n) => {
        const st = NODE_STATUS[n.status];
        return (
          <Link key={n.id} to={`/nodes/${n.id}`} className="col" style={{ gap: 6, padding: '9px 10px', border: '1px solid var(--rule)', borderRadius: 6, background: 'var(--surface-2)' }}>
            <div className="row" style={{ gap: 7 }}>
              <Icon name={NODE_ICON[n.kind]} size={14} className="muted" />
              <span className="truncate" style={{ fontWeight: 500 }}>{n.name}</span>
              <span className="spacer" /><Dot tone={st.tone} pulse={n.status === 'online'} />
            </div>
            {n.status === 'offline' ? (
              <div className="muted" style={{ fontSize: 11.5 }}>нет связи · {ago(n.lastSeen)}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 34px', gap: '3px 6px', alignItems: 'center', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                <span>CPU</span><Meter value={n.cpu / 100} /><span style={{ textAlign: 'right' }}>{Math.round(n.cpu)}%</span>
                <span>MEM</span><Meter value={n.memUsed / n.memTotal} /><span style={{ textAlign: 'right' }}>{Math.round((n.memUsed / n.memTotal) * 100)}%</span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
