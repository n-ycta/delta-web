import type { DashboardConfig, PluginEntry } from '../contracts';
import { isInstalled } from './plugins';
export const dashboardPlugins = (plugins: PluginEntry[]) =>
  plugins.filter(
    (p) =>
      isInstalled(p) &&
      p.validation.compatible &&
      (p.manifest.metrics.length > 0 || p.manifest.views.some((v) => v.dashboard)),
  );
export function dashboardCount(dashboards: DashboardConfig[], plugins: PluginEntry[]) {
  const keys = new Set(
    dashboards.filter((d) => d.origin === 'user').map((d) => `dashboard:${d.id}`),
  );
  for (const p of dashboardPlugins(plugins)) keys.add(`plugin:${p.manifest.id}`);
  return keys.size;
}
