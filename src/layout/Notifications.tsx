import { tr } from '@/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/app/data';
import { useUi } from '@/app/stores';
import { useMutation } from '@/app/query';
import { Drawer } from '@/ui/overlays';
import { Button, Dot, Segmented } from '@/ui/primitives';
import { Empty, ErrorState, SkeletonRows } from '@/ui/states';
import { SEVERITY_TONE } from '@/ui/status';
import { ago } from '@/core/lib/format';

export function NotificationsPanel() {
  const open = useUi((s) => s.notificationsOpen);
  const set = useUi((s) => s.set);
  const nav = useNavigate();
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const q = useNotifications();
  const mark = useMutation((api, ids: string[] | 'all', read: boolean) => api.markNotifications(ids, read), { invalidate: ['notifications'] });
  const list = (q.data ?? []).filter((n) => filter === 'all' || !n.read);
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  return (
    <Drawer open={open} onClose={() => set({ notificationsOpen: false })} title={tr("layout.Notifications.s_ee3c35f311")} sub={tr("layout.Notifications.s_3ad97ce395", { p0: (unread) })}>
      <div className="row" style={{ marginBottom: 12 }}>
        <Segmented sans value={filter} onChange={setFilter} options={[{ value: 'unread', label: tr("layout.Notifications.s_cf3ac2d46f") }, { value: 'all', label: tr("layout.Notifications.s_fd08da7a63") }]} />
        <span className="spacer" />
        <Button size="sm" variant="ghost" icon={<CheckCheck size={13} />} disabled={!unread} loading={mark.pending} onClick={() => mark.run('all', true)}>{tr("layout.Notifications.s_d9aa2d74e0")}</Button>
      </div>
      <div style={{ margin: '0 -18px' }}>
        {q.loading && <SkeletonRows rows={5} />}
        {q.error && !q.data && <ErrorState error={q.error} onRetry={q.refetch} />}
        {q.data && list.length === 0 && <Empty icon={<BellOff size={18} />} title={filter === 'unread' ? tr("layout.Notifications.s_bd6a159296") : tr("layout.Notifications.s_84dcc23a34")}>{tr("layout.Notifications.s_3c12a2a2b9")}</Empty>}
        {list.map((n) => (
          <div key={n.id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => { if (!n.read) mark.run([n.id], true); if (n.link) { nav(n.link); set({ notificationsOpen: false }); } }}>
            <Dot tone={SEVERITY_TONE[n.severity]} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
              {n.body && <div className="muted" style={{ fontSize: 12 }}>{n.body}</div>}
              <div className="faint mono" style={{ fontSize: 11, marginTop: 2 }}>{ago(n.ts)}{n.link ? ` · ${n.link}` : ''}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); mark.run([n.id], !n.read); }}>{n.read ? tr("layout.Notifications.s_af12440e0c") : tr("layout.Notifications.s_901ab2e263")}</Button>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
