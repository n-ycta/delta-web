import { useEffect } from 'react';
import { useApi } from '@/app/ApiContext';
import { queryClient } from '@/app/query';
import { toast, useUi } from '@/app/stores';
import type { NodeInfo } from '@/core/contracts';

/** Bridges the core's realtime channel into caches and UI state. Mounted once in the shell. */
export function RealtimeBridge() {
  const api = useApi();
  useEffect(() => {
    let debounce: number | undefined;
    const soon = (key: string) => { window.clearTimeout(debounce); debounce = window.setTimeout(() => queryClient.invalidate(key), 400); };
    return api.subscribe((m) => {
      const ui = useUi.getState();
      switch (m.type) {
        case 'connection': ui.setConnection({ state: m.state, latencyMs: m.latencyMs, since: Date.now() }); break;
        case 'event': ui.pushLive(m.event); break;
        case 'node.update':
          queryClient.setData<NodeInfo[]>('nodes', (prev) => prev?.map((n) => (n.id === m.nodeId ? { ...n, ...m.patch } : n)) ?? prev!);
          if (!Object.keys(m.patch).length || 'status' in m.patch || 'components' in m.patch) soon('nodes');
          break;
        case 'plugin.update': queryClient.invalidate('plugins'); queryClient.invalidate('nodes'); break;
        case 'notification':
          queryClient.setData('notifications', (prev: any[] | undefined) => [m.notification, ...(prev ?? [])]);
          if (m.notification.severity === 'error' || m.notification.severity === 'critical') toast({ severity: m.notification.severity, title: m.notification.title, body: m.notification.body });
          break;
      }
    });
  }, [api]);
  return null;
}
