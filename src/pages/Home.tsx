import { tr, locale } from '@/i18n';
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
  const rateKnown = p.filter(isLive).every(p => p.instance.eventsPerMin !== undefined);
  const rate = p.filter(isLive).reduce((s, x) => s + (x.instance.eventsPerMin ?? 0), 0);
  const crit = alerts.filter((a) => a.tone === 'err' || a.tone === 'crit').length;
  return (
    <div className="strip">
      <Link to="/settings?tab=connection"><div className="label">{tr("pages.Home.s_3609281642")}</div><div className="v">{info.data ? info.data.coreVersion : '—'}<small>{info.data ? tr('runtime.uptime', { duration: fmtDuration((Date.now() - info.data.startedAt) / 1000) }) : ''}</small></div></Link>
      <Link to="/nodes"><div className="label">{tr("pages.Home.s_4b54d244be")}</div><div className="v">{n.filter((x) => x.status !== 'offline').length}<small>{tr("pages.Home.s_fcbe5033ba")}{n.length}</small></div></Link>
      <Link to="/plugins"><div className="label">{tr("pages.Home.s_c94c451fb7")}</div><div className="v">{p.filter(isLive).length}<small>{tr("pages.Home.s_fcbe5033ba")}{p.length}</small></div></Link>
      <Link to="/events"><div className="label">{tr("pages.Home.s_6574bcdcf4")}</div><div className="v">{fmtNumber(rateKnown ? rate : undefined, 0)}<small>{tr("pages.Home.s_1771630f60")}</small></div></Link>
      <Link to="/events?sev=error"><div className="label">{tr("pages.Home.s_7c80872ccf")}</div><div className="v" style={{ color: crit ? 'var(--err)' : undefined }}>{crit}<small>{alerts.length - crit ? tr("pages.Home.s_0ac56e640c", { p0: (alerts.length - crit) }) : ''}</small></div></Link>
    </div>
  );
}

export function HomePage() {
  const dashboards = useDashboards();
  const { save } = useDashboardActions();
  const showStrip = usePrefs((s) => s.homeStrip);
  const home = dashboards.data?.find((d) => d.origin === 'home');
  const hour = new Date().getHours();
  const greet = hour < 6 ? tr("pages.Home.s_03f0b82037") : hour < 12 ? tr("pages.Home.s_d73c91bbc4") : hour < 18 ? tr("pages.Home.s_51d822d031") : tr("pages.Home.s_37f9f18bdc");
  return (
    <div className="page">
      <PageHead eyebrow={new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} title={greet} sub={tr("pages.Home.s_0a2cf963b9")} />
      {showStrip && <Strip />}
      {dashboards.error && !dashboards.data && <ErrorState error={dashboards.error} onRetry={dashboards.refetch} />}
      {!home && !dashboards.error && <div className="grid-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={180} />)}</div>}
      {home && <DashboardView dashboard={home} onSave={(d) => save(d, { silent: true })} />}
    </div>
  );
}
