import { NavLink, useLocation } from 'react-router-dom';
import { FileCheck2, Gauge, KeyRound, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Puzzle, ScrollText, Server, Settings } from 'lucide-react';
import { useDashboards, useNodes, usePlugins } from '@/app/data';
import { usePrefs, useRole, useUi } from '@/app/stores';
import { ROLE_LABEL } from '@/core/contracts';
import { hasUpdate } from '@/core/registry/plugins';
import { Icon } from '@/ui/Icon';

function Item({ to, icon, label, count, alert, end }: { to: string; icon: React.ReactNode; label: string; count?: number | string; alert?: boolean; end?: boolean }) {
  const close = useUi((s) => s.set);
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={label} onClick={() => close({ mobileNav: false })}>
      {icon}<span className="nav-label truncate">{label}</span>{count !== undefined && <span className={`count ${alert ? 'alert' : ''}`}>{count}</span>}
    </NavLink>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, set } = usePrefs();
  const plugins = usePlugins();
  const nodes = useNodes();
  const dashboards = useDashboards();
  const role = useRole();
  const loc = useLocation();
  const pluginIssues = plugins.data?.filter((p) => ['error', 'degraded'].includes(p.instance.status)).length ?? 0;
  const updates = plugins.data?.filter(hasUpdate).length ?? 0;
  const nodeIssues = nodes.data?.filter((n) => n.status !== 'online').length ?? 0;
  const online = nodes.data?.filter((n) => n.status !== 'offline').length;
  const pinned = (dashboards.data ?? []).filter((d) => d.origin !== 'home' && d.pinned);
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="delta-logo" src="./delta-logo.svg" alt="Delta" />
        <span className="brand-text col" style={{ gap: 0 }}><span className="brand-name">Delta</span><span className="brand-sub">console 0.9</span></span>
      </div>
      <nav className="nav">
        <Item to="/" end icon={<Gauge size={16} />} label="Обзор" />
        <Item to="/dashboards" icon={<LayoutDashboard size={16} />} label="Дашборды" count={(dashboards.data ?? []).filter((d) => d.origin !== 'home').length || undefined} />
        {pinned.length > 0 && (loc.pathname.startsWith('/dashboards') || true) && (
          <div className="nav-sub">
            {pinned.map((d) => <Item key={d.id} to={`/dashboards/${d.id}`} icon={<Icon name={d.icon ?? 'layout-dashboard'} size={13} />} label={d.name} />)}
          </div>
        )}
        <div className="nav-section label">Экосистема</div>
        <Item to="/plugins" icon={<Puzzle size={16} />} label="Плагины" count={pluginIssues || updates || undefined} alert={pluginIssues > 0} />
        <Item to="/nodes" icon={<Server size={16} />} label="Узлы" count={nodes.data ? `${online}/${nodes.data.length}` : undefined} alert={nodeIssues > 0} />
        <Item to="/events" icon={<ScrollText size={16} />} label="События" />
        <Item to="/contracts" icon={<FileCheck2 size={16} />} label="Контракты" />
        <div className="nav-section label">Система</div>
        <Item to="/access" icon={<KeyRound size={16} />} label="Доступ" />
        <Item to="/settings" icon={<Settings size={16} />} label="Настройки" />
      </nav>
      <div className="sidebar-foot">
        <span className="plug-icon" style={{ width: 26, height: 26, borderRadius: 13, fontSize: 11, fontWeight: 600 }}>ВЫ</span>
        <span className="sidebar-foot-text col grow" style={{ gap: 0, minWidth: 0 }}>
          <span className="truncate" style={{ fontWeight: 500 }}>owner@delta.lan</span>
          <span className="muted" style={{ fontSize: 11 }}>{ROLE_LABEL[role]}{role !== 'owner' && ' (просмотр)'}</span>
        </span>
        <button className="btn ghost icon sm desktop-only" onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })} title={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}>
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </aside>
  );
}
