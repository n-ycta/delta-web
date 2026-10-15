import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { WidgetProps } from '../types';
import { useNodes, usePlugins } from '@/app/data';
import { hasUpdate } from '@/core/registry/plugins';
import { Dot } from '@/ui/primitives';
import { ago } from '@/core/lib/format';
import { Empty, SkeletonRows } from '@/ui/states';
import type { Tone } from '@/ui/status';

export interface Alert { id: string; tone: Tone; title: string; detail: string; to: string; ts?: number }

/** Derives actionable alerts from current system state (not just from events). */
export function useAlerts(): { alerts: Alert[]; loading: boolean } {
  const nodes = useNodes();
  const plugins = usePlugins();
  const alerts: Alert[] = [];
  nodes.data?.forEach((n) => {
    if (n.status === 'offline') alerts.push({ id: `n-${n.id}`, tone: 'err', title: `${n.name} не в сети`, detail: `последний контакт ${ago(n.lastSeen)}`, to: `/nodes/${n.id}`, ts: n.lastSeen });
    else if (n.status === 'degraded') alerts.push({ id: `n-${n.id}`, tone: 'warn', title: `${n.name}: деградация`, detail: n.errors[0]?.message ?? 'проверьте узел', to: `/nodes/${n.id}`, ts: n.errors[0]?.ts });
    if (n.diskTotal && n.diskUsed / n.diskTotal > 0.9) alerts.push({ id: `d-${n.id}`, tone: 'warn', title: `${n.name}: диск ${Math.round((n.diskUsed / n.diskTotal) * 100)}%`, detail: 'мало свободного места', to: `/nodes/${n.id}` });
    if (n.battery && n.battery.level < 0.15 && !n.battery.charging) alerts.push({ id: `b-${n.id}`, tone: 'warn', title: `${n.name}: заряд ${Math.round(n.battery.level * 100)}%`, detail: 'агент может быть остановлен системой', to: `/nodes/${n.id}` });
  });
  plugins.data?.forEach((p) => {
    if (p.instance.status === 'error') alerts.push({ id: `p-${p.manifest.id}`, tone: 'err', title: `${p.manifest.name}: ошибка`, detail: p.instance.error?.message ?? '', to: `/plugins/${p.manifest.id}` });
    if (p.instance.status === 'degraded') alerts.push({ id: `p-${p.manifest.id}`, tone: 'warn', title: `${p.manifest.name}: деградация`, detail: p.instance.error?.message ?? '', to: `/plugins/${p.manifest.id}` });
  });
  const updates = plugins.data?.filter(hasUpdate) ?? [];
  if (updates.length) alerts.push({ id: 'updates', tone: 'info', title: `Обновления: ${updates.length}`, detail: updates.map((u) => `${u.manifest.name} → ${u.instance.latestVersion}`).join(', '), to: `/plugins?tab=updates` });
  const order: Tone[] = ['crit', 'err', 'warn', 'info', 'ok', 'off', 'accent'];
  alerts.sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone));
  return { alerts, loading: nodes.loading || plugins.loading };
}

export function AlertsWidget(_: WidgetProps) {
  const { alerts, loading } = useAlerts();
  if (loading) return <SkeletonRows rows={4} />;
  if (!alerts.length) return <Empty compact icon={<CheckCircle2 size={18} />} title="Всё в порядке">Нет активных проблем.</Empty>;
  return (
    <div style={{ overflow: 'auto', flex: 1, margin: '0 -12px' }}>
      {alerts.map((a) => (
        <Link key={a.id} to={a.to} style={{ display: 'flex', gap: 10, padding: '7px 12px', borderTop: '1px solid var(--rule)', alignItems: 'flex-start' }}>
          <span style={{ paddingTop: 6 }}><Dot tone={a.tone} /></span>
          <span className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 12.5 }}>{a.title}</div>
            <div className="muted truncate" style={{ fontSize: 11.5 }}>{a.detail}</div>
          </span>
        </Link>
      ))}
    </div>
  );
}
