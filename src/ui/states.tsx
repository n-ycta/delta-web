import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RotateCcw, WifiOff } from 'lucide-react';
import type { CoreApiError } from '@/api';
import { Button } from './primitives';

export function Empty({ icon, title, children, action, compact }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`state ${compact ? 'compact' : ''}`}>
      {!compact && <div className="state-icon">{icon ?? <Inbox size={18} strokeWidth={1.6} />}</div>}
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action && <div className="row" style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

/** Error state with a concrete recovery path: retry + hint from the core. */
export function ErrorState({ error, onRetry, compact, extra }: { error: CoreApiError | Error; onRetry?: () => void; compact?: boolean; extra?: ReactNode }) {
  const e = error as CoreApiError;
  const network = e.code === 'NETWORK' || e.code === 'TIMEOUT';
  return (
    <div className={`state err ${compact ? 'compact' : ''}`} role="alert">
      {!compact && <div className="state-icon">{network ? <WifiOff size={18} strokeWidth={1.6} /> : <AlertTriangle size={18} strokeWidth={1.6} />}</div>}
      <h4>{network ? 'Нет связи с ядром' : 'Не удалось загрузить'}</h4>
      <p>{e.message}{e.hint && <><br /><span className="muted">{e.hint}</span></>}</p>
      {e.code && <span className="code">{e.code}{e.status ? ` · ${e.status}` : ''}</span>}
      <div className="row" style={{ marginTop: 6 }}>
        {onRetry && (e.retryable ?? true) && <Button size="sm" icon={<RotateCcw size={13} />} onClick={onRetry}>Повторить</Button>}
        {extra}
      </div>
    </div>
  );
}

export function Skeleton({ h = 14, w = '100%', style }: { h?: number | string; w?: number | string; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} />;
}

export function SkeletonRows({ rows = 5, h = 18 }: { rows?: number; h?: number }) {
  return <div className="col" style={{ gap: 10, padding: 14 }}>{Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={h} w={`${92 - ((i * 17) % 30)}%`} />)}</div>;
}

export function ChartSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', padding: '8px 0' }}>
      {Array.from({ length: 24 }, (_, i) => <div key={i} className="skel" style={{ flex: 1, height: `${25 + ((i * 37) % 60)}%` }} />)}
    </div>
  );
}
