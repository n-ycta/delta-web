import { tr } from '@/i18n';
import type { ReactNode } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorState } from '@/ui/states';
import { Button } from '@/ui/primitives';
import { Shell } from '@/layout/Shell';
import { ErrorBoundary } from '@/dashboards/ErrorBoundary';
import { HomePage } from '@/pages/Home';
import { DashboardsPage } from '@/pages/Dashboards';
import { DashboardPage } from '@/pages/DashboardPage';
import { PluginsPage } from '@/pages/plugins/PluginsPage';
import { PluginDetail } from '@/pages/plugins/PluginDetail';
import { NodesPage } from '@/pages/nodes/NodesPage';
import { NodeDetail } from '@/pages/nodes/NodeDetail';
import { EventsPage } from '@/pages/EventsPage';
import { ContractsPage } from '@/pages/contracts/ContractsPage';
import { AccessPage } from '@/pages/AccessPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFound } from '@/pages/NotFound';

export function App() {
  return (
    <HashRouter>
      <Shell>
        <RouteBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboards" element={<DashboardsPage />} />
            <Route path="/dashboards/:id" element={<DashboardPage />} />
            <Route path="/plugins" element={<PluginsPage />} />
            <Route path="/plugins/:id" element={<PluginDetail />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/nodes/:id" element={<NodeDetail />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/access" element={<AccessPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RouteBoundary>
      </Shell>
    </HashRouter>
  );
}

/** Page-level crash isolation: a broken page never takes down the shell; navigating away resets it. */
function RouteBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <ErrorBoundary resetKey={loc.pathname} fallback={(e, reset) => (
      <div className="page"><div className="panel"><ErrorState error={e} onRetry={reset} extra={<Button variant="ghost" onClick={() => { location.hash = '#/'; reset(); }}>{tr("App.s_ef1ad90b17")}</Button>} /></div></div>
    )}>{children}</ErrorBoundary>
  );
}
