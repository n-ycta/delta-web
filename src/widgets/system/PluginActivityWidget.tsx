import { tr } from '@/i18n';
import { Link } from 'react-router-dom';
import type { WidgetProps } from '../types';
import { usePlugins } from '@/app/data';
import { isInstalled } from '@/core/registry/plugins';
import { Icon } from '@/ui/Icon';
import { Dot } from '@/ui/primitives';
import { PLUGIN_STATUS } from '@/ui/status';
import { ago, fmtNumber } from '@/core/lib/format';
import { SkeletonRows, ErrorState } from '@/ui/states';

export function PluginActivityWidget(_: WidgetProps) {
  const { data, loading, error, refetch } = usePlugins();
  if (loading) return <SkeletonRows rows={5} />;
  if (error && !data) return <ErrorState compact error={error} onRetry={refetch} />;
  const list = data!.filter(isInstalled).sort((a, b) => (b.instance.eventsPerMin ?? 0) - (a.instance.eventsPerMin ?? 0));
  return (
    <div style={{ overflow: 'auto', flex: 1, margin: '0 -12px' }}>
      {list.map((p) => {
        const st = PLUGIN_STATUS[p.instance.status];
        const rate = p.instance.status === 'active' || p.instance.status === 'degraded' ? p.instance.eventsPerMin : 0;
        return (
          <Link key={p.manifest.id} to={`/plugins/${p.manifest.id}`} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr) minmax(100px,auto)', gap: 8, alignItems: 'center', padding: '6px 12px', borderTop: '1px solid var(--rule)', fontSize: 12 }}>
            <Icon name={p.manifest.icon} size={14} className="muted" />
            <span className="col" style={{ gap: 0, minWidth: 0 }}>
              <span className="row" style={{ gap: 6 }}><span className="truncate">{p.manifest.name}</span><Dot tone={st.tone} /></span>
              <span className="muted" style={{ fontSize: 10.5 }}>{p.instance.lastSyncAt ? tr("widgets.system.PluginActivityWidget.s_3cf538dc55", { p0: (ago(p.instance.lastSyncAt)) }) : st.label}</span>
            </span>
            <span className="num muted" style={{ fontSize: 11, textAlign: 'right' }}>{rate===undefined?tr('analytics.noRate'):`${fmtNumber(rate, 1)} ${p.instance.activityUnit||tr('analytics.eventsPerMinute')}`}</span>
          </Link>
        );
      })}
    </div>
  );
}
