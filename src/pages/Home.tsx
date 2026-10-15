import { Link } from 'react-router-dom';
import { useDashboards, useNodes, usePlugins } from '@/app/data';
import { useQuery } from '@/app/query';
import { usePrefs } from '@/app/stores';
import { isInstalled, isLive } from '@/core/registry/plugins';
import { DashboardView } from '@/dashboards/DashboardView';
import { useDashboardActions } from '@/dashboards/useDashboardActions';
import { useAlerts } from '@/widgets/system/AlertsWidget';
import { PageHead } from '@/ui/primitives';
import { ErrorState, Skeleton } from '@/ui/states';
import { fmtDuration, fmtNumber } from '@/core/lib/format';

function Strip() {
  const info = useQuery('info', (api) => api.info());
  const nodes = useNodes();
  const plugins = usePlugins();
  const { alerts } = useAlerts();
  const n = nodes.data ?? [];
  const p = plugins.data?.filter(isInstalled) ?? [];
  const rate = p.filter(isLive).reduce((s, x) => s + (x.instance.eventsPerMin ?? 0), 0);
  const crit = alerts.filter((a) => a.tone === 'err' || a.tone === 'crit').length;
  return (
    <div className="strip">
      <Link to="/settings?tab=connection"><div className="label">Ядро</div><div className="v">{info.data ? info.data.coreVersion : '—'}<small>{info.data ? `up ${fmtDuration((Date.now() - info.data.startedAt) / 1000)}` : ''}</small></div></Link>
      <Link to="/nodes"><div className="label">Узлы в сети</div><div className="v">{n.filter((x) => x.status !== 'offline').length}<small>/ {n.length}</small></div></Link>
      <Link to="/plugins"><div className="label">Плагины активны</div><div className="v">{p.filter(isLive).length}<small>/ {p.length}</small></div></Link>
      <Link to="/events"><div className="label">Поток данных</div><div className="v">{fmtNumber(rate, 0)}<small>соб/мин</small></div></Link>
      <Link to="/events?sev=error"><div className="label">Проблемы</div><div className="v" style={{ color: crit ? 'var(--err)' : undefined }}>{crit}<small>{alerts.length - crit ? `+${alerts.length - crit} предупр.` : ''}</small></div></Link>
    </div>
  );
}

export function HomePage() {
  const dashboards = useDashboards();
  const { save } = useDashboardActions();
  const showStrip = usePrefs((s) => s.homeStrip);
  const home = dashboards.data?.find((d) => d.origin === 'home');
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  return (
    <div className="page">
      <PageHead eyebrow={new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} title={greet} sub="Сводка экосистемы. Состав и раскладка этой страницы настраиваются — это ваш личный дашборд." />
      {showStrip && <Strip />}
      {dashboards.error && !dashboards.data && <ErrorState error={dashboards.error} onRetry={dashboards.refetch} />}
      {!home && !dashboards.error && <div className="grid-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={180} />)}</div>}
      {home && <DashboardView dashboard={home} onSave={(d) => save(d, { silent: true })} />}
    </div>
  );
}
