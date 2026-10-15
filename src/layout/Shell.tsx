import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { usePrefs, useUi } from '@/app/stores';
import { useResolvedTheme } from '@/app/theme';
import { useApi } from '@/app/ApiContext';
import { queryClient } from '@/app/query';
import { Toasts } from '@/ui/Toasts';
import { Button } from '@/ui/primitives';
import { ROLE_LABEL } from '@/core/contracts';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { NotificationsPanel } from './Notifications';
import { RealtimeBridge } from './Realtime';

export function Shell({ children }: { children: ReactNode }) {
  const prefs = usePrefs();
  const theme = useResolvedTheme();
  const ui = useUi();
  const api = useApi();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = prefs.density;
  }, [theme, prefs.density]);
  const disconnected = ui.connection.state === 'closed' || ui.connection.state === 'reconnecting';
  return (
    <div className="shell" data-collapsed={prefs.sidebarCollapsed} data-mobile-nav={ui.mobileNav}>
      <RealtimeBridge />
      <Sidebar />
      {ui.mobileNav && <div className="overlay mobile-only" style={{ zIndex: 54 }} onClick={() => ui.set({ mobileNav: false })} />}
      <div className="main">
        <Topbar />
        {disconnected && (
          <div className="banner err" role="status">
            <WifiOff size={14} />
            <span className="grow">{ui.connection.state === 'reconnecting' ? 'Соединение с ядром потеряно, переподключаемся…' : `Нет связи с ядром (${api.endpoint}). Показаны последние полученные данные.`}</span>
            <Button size="sm" onClick={() => { queryClient.invalidate('plugins'); queryClient.invalidate('nodes'); queryClient.invalidate('metric'); queryClient.invalidate('dashboards'); }}>Повторить</Button>
            <Link to="/settings?tab=connection" className="btn sm ghost">Подключение</Link>
          </div>
        )}
        {prefs.viewAs && (
          <div className="banner info">
            <span className="grow">Просмотр с правами роли «{ROLE_LABEL[prefs.viewAs]}». Недоступные действия отключены.</span>
            <Button size="sm" onClick={() => prefs.set({ viewAs: null })}>Вернуть права владельца</Button>
          </div>
        )}
        <main className="content">{children}</main>
      </div>
      <CommandPalette />
      <NotificationsPanel />
      <Toasts />
    </div>
  );
}
