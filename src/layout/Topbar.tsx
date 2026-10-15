import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu as MenuIcon, Moon, Search, Sun } from 'lucide-react';
import { useNotifications } from '@/app/data';
import { usePrefs, useUi } from '@/app/stores';
import { useResolvedTheme } from '@/app/theme';
import { useApi } from '@/app/ApiContext';
import { Button, Dot, Kbd } from '@/ui/primitives';

const LABELS: Record<string, string> = { dashboards: 'dashboards', plugins: 'plugins', nodes: 'nodes', events: 'events', contracts: 'contracts', access: 'access', settings: 'settings' };

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
      <Button className="mobile-only" variant="ghost" iconOnly onClick={() => ui.set({ mobileNav: true })} aria-label="Меню"><MenuIcon size={16} /></Button>
      <nav className="crumbs" aria-label="Путь">
        <Link to="/">delta</Link>
        {parts.map((p, i) => (
          <span key={i} className="row" style={{ gap: 6 }}>
            <span className="sep">/</span>
            {i === parts.length - 1 ? <span className="cur truncate">{decodeURIComponent(LABELS[p] ?? p)}</span> : <Link to={'/' + parts.slice(0, i + 1).join('/')}>{LABELS[p] ?? p}</Link>}
          </span>
        ))}
        {parts.length === 0 && <><span className="sep">/</span><span className="cur">overview</span></>}
      </nav>
      <span className="spacer" />
      <button className="search-trigger" onClick={() => ui.set({ paletteOpen: true })}>
        <Search size={14} /><span className="st-text grow" style={{ textAlign: 'left' }}>Поиск и команды</span><Kbd>⌘K</Kbd>
      </button>
      <Link to="/settings?tab=connection" className="conn desktop-only" title={`Адаптер: ${api.mode} · ${api.endpoint}`}>
        <Dot tone={tone} pulse={conn.state === 'open'} />
        <span>{api.mode === 'mock' ? 'mock' : 'core'}</span>
        {conn.latencyMs !== undefined && conn.state === 'open' && <span className="faint">{conn.latencyMs}ms</span>}
        {conn.state !== 'open' && <span>{conn.state === 'closed' ? 'нет связи' : 'переподключение'}</span>}
      </Link>
      <Button variant="ghost" iconOnly onClick={() => setPrefs({ theme: theme === 'dark' ? 'light' : 'dark' })} title="Тема">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</Button>
      <Button variant="ghost" iconOnly onClick={() => ui.set({ notificationsOpen: true })} aria-label="Уведомления" style={{ position: 'relative' }}>
        <Bell size={15} />
        {unread > 0 && <span className="num" style={{ position: 'absolute', top: 2, right: 1, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 9.5, minWidth: 14, height: 14, borderRadius: 7, display: 'grid', placeItems: 'center', padding: '0 3px' }}>{unread}</span>}
      </Button>
    </header>
  );
}
