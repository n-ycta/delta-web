import { tr } from '@/i18n';
import { NavLink, useLocation } from 'react-router-dom';
import { FileCheck2, Gauge, KeyRound, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Puzzle, ScrollText, Server, Settings } from 'lucide-react';
import { useDashboards, useNodes, usePlugins } from '@/app/data';
import { usePrefs, useRole, useUi, useRuntimeAccess } from '@/app/stores';
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
  const userName = useRuntimeAccess(s => s.name);
  const loc = useLocation();
  const pluginIssues = plugins.data?.filter((p) => ['error', 'degraded'].includes(p.instance.status)).length ?? 0;
  const updates = plugins.data?.filter(hasUpdate).length ?? 0;
  const nodeIssues = nodes.data?.filter((n) => n.status !== 'online').length ?? 0;
  const online = nodes.data?.filter((n) => n.status !== 'offline').length;
  const pinned = (dashboards.data ?? []).filter((d) => d.origin !== 'home' && d.pinned);
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="delta-logo" src="./delta-logo.svg" alt={tr("layout.Sidebar.s_a4cbd21f4a")} />
        <span className="brand-text col" style={{ gap: 0 }}><span className="brand-name">{tr("layout.Sidebar.s_a4cbd21f4a")}</span><span className="brand-sub">{tr("layout.Sidebar.s_12062dd4e9")}</span></span>
      </div>
      <nav className="nav">
        <Item to="/" end icon={<Gauge size={16} />} label={tr("layout.Sidebar.s_39c6387206")} />
        <Item to="/dashboards" icon={<LayoutDashboard size={16} />} label={tr("layout.Sidebar.s_292999fc23")} count={(dashboards.data ?? []).filter((d) => d.origin !== 'home').length || undefined} />
        {pinned.length > 0 && (loc.pathname.startsWith('/dashboards') || true) && (
          <div className="nav-sub">
            {pinned.map((d) => <Item key={d.id} to={`/dashboards/${d.id}`} icon={<Icon name={d.icon ?? 'layout-dashboard'} size={13} />} label={d.name} />)}
          </div>
        )}
        <div className="nav-section label">{tr("layout.Sidebar.s_1991e69ece")}</div>
        <Item to="/plugins" icon={<Puzzle size={16} />} label={tr("layout.Sidebar.s_ff13ef845f")} count={pluginIssues || updates || undefined} alert={pluginIssues > 0} />
        <Item to="/nodes" icon={<Server size={16} />} label={tr("layout.Sidebar.s_3293ac18db")} count={nodes.data ? `${online}/${nodes.data.length}` : undefined} alert={nodeIssues > 0} />
        <Item to="/events" icon={<ScrollText size={16} />} label={tr("layout.Sidebar.s_bb9ac87531")} />
        <Item to="/contracts" icon={<FileCheck2 size={16} />} label={tr("layout.Sidebar.s_ae73060f94")} />
        <div className="nav-section label">{tr("layout.Sidebar.s_3ac98f278c")}</div>
        <Item to="/access" icon={<KeyRound size={16} />} label={tr("layout.Sidebar.s_fefc535f60")} />
        <Item to="/identity" icon={<KeyRound size={16} />} label={tr("polish.keys")} />
        <Item to="/mcp" icon={<Puzzle size={16} />} label={tr("polish.mcp")} />
        <Item to="/settings" icon={<Settings size={16} />} label={tr("layout.Sidebar.s_7f17c7c62a")} />
      </nav>
      <div className="sidebar-foot">
        <span className="plug-icon" style={{ width: 26, height: 26, borderRadius: 13, fontSize: 11, fontWeight: 600 }}>{tr("layout.Sidebar.s_7e201b31a4")}</span>
        <span className="sidebar-foot-text col grow" style={{ gap: 0, minWidth: 0 }}>
          <span className="truncate" style={{ fontWeight: 500 }}>{userName || tr("runtime.noUser")}</span>
          <span className="muted" style={{ fontSize: 11 }}>{ROLE_LABEL[role]}{role !== 'owner' && tr("layout.Sidebar.s_64fc2b8469")}</span>
        </span>
        <button className="btn ghost icon sm desktop-only" onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })} title={sidebarCollapsed ? tr("layout.Sidebar.s_fd3ae0eaeb") : tr("layout.Sidebar.s_4faa82f560")}>
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </aside>
  );
}
