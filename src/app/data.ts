import { useEffect, useMemo, useRef } from 'react';
import type { DashboardConfig, MetricQuery, MetricResult, NodeInfo, Notification, PluginEntry } from '@/core/contracts';
import { normalizePlugins } from '@/core/registry/plugins';
import { defaultHomeDashboard } from '@/core/registry/autodash';
import { widgetRegistry } from '@/widgets/registry';
import { queryClient, useQuery } from './query';
import { useApi } from './ApiContext';

export function usePlugins() {
  const q = useQuery('plugins', (api) => api.listPlugins(), {refetchMs:10000});
  const entries = useMemo(() => (q.data ? normalizePlugins(q.data, widgetRegistry.knownVisualizations()) : undefined), [q.data]);
  return { ...q, data: entries };
}

export function usePlugin(id: string | undefined) {
  const q = usePlugins();
  return { ...q, data: q.data?.find((p) => p.manifest.id === id) };
}

export function useNodes() {
  return useQuery<NodeInfo[]>('nodes', (api) => api.listNodes(), { refetchMs: 30000 });
}

export function useNotifications() {
  return useQuery<Notification[]>('notifications', (api) => api.listNotifications(), { refetchMs: 60000 });
}

export function useMetric(q: MetricQuery | null, refreshSec = 0) {
  const key = q ? `metric/${JSON.stringify(q)}` : null;
  return useQuery<MetricResult>(key, (api) => api.queryMetric(q!), { refetchMs: refreshSec ? refreshSec * 1000 : undefined });
}

/** Dashboards come from the core. If the user has no home dashboard yet we derive one from installed plugins. */
export function useDashboards() {
  const api = useApi();
  const q = useQuery<DashboardConfig[]>('dashboards', (a) => a.listDashboards());
  const plugins = usePlugins();
  const creating = useRef(false);
  useEffect(() => {
    if (!q.data || !plugins.data || creating.current) return;
    if (!q.data.some((d) => d.origin === 'home')) {
      creating.current = true;
      const home = defaultHomeDashboard(plugins.data, widgetRegistry);
      queryClient.setData<DashboardConfig[]>('dashboards', (prev) => [...(prev ?? []), home]);
      api.saveDashboard(home).catch(() => { /* will retry on next load */ }).finally(() => { creating.current = false; });
    }
  }, [q.data, plugins.data, api]);
  return q;
}

export function pluginLabel(entries: PluginEntry[] | undefined, id: string) {
  return entries?.find((e) => e.manifest.id === id)?.manifest.name ?? id;
}
