import { tr } from '@/i18n';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu as MenuIcon, Moon, Search, Sun } from 'lucide-react';
import { useNotifications } from '@/app/data';
import { usePrefs, useUi } from '@/app/stores';
import { useResolvedTheme } from '@/app/theme';
import { useApi } from '@/app/ApiContext';
import { Button, Dot, Kbd } from '@/ui/primitives';

const LABELS: Record<string, string> = { dashboards: tr('runtime.crumb_dashboards'), plugins: tr('runtime.crumb_plugins'), nodes: tr('runtime.crumb_nodes'), events: tr('runtime.crumb_events'), contracts: tr('runtime.crumb_contracts'), access: tr('runtime.crumb_access'), settings: tr('runtime.crumb_settings') };

export function Topbar() {
  const loc = useLocation();
  const ui = useUi();
  const api = useApi();
  const theme = useResolvedTheme();
  const setPrefs = usePrefs((s) => s.set);
  const notifs = useNotifications();
  const unread = notifs.data?.filter((n) => !n.read).length ?? 0;
  const parts = loc.pathname.split('/').filter(Boolean);
  const conn = ui.connection;
  const tone = conn.state === 'open' ? 'ok' : conn.state === 'reconnecting' || conn.state === 'unknown' ? 'warn' : 'err';
  return (
    <header className="topbar">
      <Button className="mobile-only" variant="ghost" iconOnly onClick={() => ui.set({ mobileNav: true })} aria-label={tr("layout.Topbar.s_dd904bebd6")}><MenuIcon size={16} /></Button>
      <nav className="crumbs" aria-label={tr("layout.Topbar.s_1b46c650da")}>
        <Link to="/">{tr("layout.Topbar.s_736fcab46d")}</Link>
        {parts.map((p, i) => (
          <span key={i} className="row" style={{ gap: 6 }}>
            <span className="sep">{tr("layout.Topbar.s_42099b4af0")}</span>
            {i === parts.length - 1 ? <span className="cur truncate">{decodeURIComponent(LABELS[p] ?? p)}</span> : <Link to={'/' + parts.slice(0, i + 1).join('/')}>{LABELS[p] ?? p}</Link>}
          </span>
        ))}
        {parts.length === 0 && <><span className="sep">{tr("layout.Topbar.s_42099b4af0")}</span><span className="cur">{tr("layout.Topbar.s_fed758b7a8")}</span></>}
      </nav>
      <span className="spacer" />
      <button className="search-trigger" onClick={() => ui.set({ paletteOpen: true })}>
        <Search size={14} /><span className="st-text grow" style={{ textAlign: 'left' }}>{tr("layout.Topbar.s_5c3f90fcba")}</span><Kbd>{tr("layout.Topbar.s_64d86f339a")}</Kbd>
      </button>
      <Link to="/settings?tab=connection" className="conn desktop-only" title={tr("layout.Topbar.s_a65090a30f", { p0: (api.mode), p1: (api.endpoint) })}>
        <Dot tone={tone} pulse={conn.state === 'open'} />
        <span>{api.mode === 'mock' ? 'mock' : 'core'}</span>
        {conn.latencyMs !== undefined && conn.state === 'open' && <span className="faint">{conn.latencyMs}{tr("layout.Topbar.s_26cc3217be")}</span>}
        {conn.state !== 'open' && <span>{conn.state === 'closed' ? tr("layout.Topbar.s_75a42acf9f") : tr("layout.Topbar.s_5838e4e9c6")}</span>}
      </Link>
      <Button variant="ghost" iconOnly onClick={() => setPrefs({ theme: theme === 'dark' ? 'light' : 'dark' })} title={tr("layout.Topbar.s_553c45f1b8")}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</Button>
      <Button variant="ghost" iconOnly onClick={() => ui.set({ notificationsOpen: true })} aria-label={tr("layout.Topbar.s_ee3c35f311")} style={{ position: 'relative' }}>
        <Bell size={15} />
        {unread > 0 && <span className="num" style={{ position: 'absolute', top: 2, right: 1, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 9.5, minWidth: 14, height: 14, borderRadius: 7, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{unread}</span>}
      </Button>
    </header>
  );
}
