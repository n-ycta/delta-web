import { tr, language } from '@/i18n';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowUpCircle, ChevronLeft, Download, LayoutDashboard, Play, Power, RotateCcw, Trash2, Zap } from 'lucide-react';
import { useNodes, usePlugin } from '@/app/data';
import { useMutation, useQuery } from '@/app/query';
import { toast, useCan } from '@/app/stores';
import { hasUpdate, isInstalled } from '@/core/registry/plugins';
import { widgetRegistry } from '@/widgets/registry';
import { KNOWN_CAPABILITIES, NODE_KIND_LABEL, type PluginEntry } from '@/core/contracts';
import { diffKind } from '@/core/lib/semver';
import { ago, fmtTime } from '@/core/lib/format';
import { Badge, Button, Dot, PageHead, Panel, Segmented, StatusBadge, Switch, Tabs } from '@/ui/primitives';
import { Confirm, Menu } from '@/ui/overlays';
import { Empty, ErrorState, Skeleton, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { NODE_STATUS, PLUGIN_STATUS } from '@/ui/status';
import { SettingsForm } from './SettingsForm';
import { InstallDialog } from './InstallDialog';
import { CATEGORY_LABEL } from './PluginsPage';
import { ValidationIssues } from '../contracts/ValidationIssues';

type Tab = 'overview' | 'settings' | 'permissions' | 'nodes' | 'logs' | 'contract';

export function PluginDetail() {
  const { id = '' } = useParams();
  const pid = decodeURIComponent(id);
  const p = usePlugin(pid);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const [installOpen, setInstallOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [purge, setPurge] = useState(false);
  const [actionConfirm, setActionConfirm] = useState<string | null>(null);
  const nav = useNavigate();
  const canManage = useCan('plugins.manage');

  const toggle = useMutation((api, en: boolean) => api.setPluginEnabled(pid, en), { invalidate: ['plugins'], onSuccess: (_r, en) => toast({ severity: 'success', title: en ? tr("pages.plugins.PluginDetail.s_891aa7aba1") : tr("pages.plugins.PluginDetail.s_01abca4746") }), onError: (e) => toast({ severity: 'error', title: tr("pages.plugins.PluginDetail.s_7c3f2ca256"), body: e.message }) });
  const update = useMutation((api) => api.updatePlugin(pid), { invalidate: ['plugins'], onSuccess: () => toast({ severity: 'info', title: tr("pages.plugins.PluginDetail.s_2c3417789a") }), onError: (e) => toast({ severity: 'error', title: tr("pages.plugins.PluginDetail.s_b653539cd4"), body: e.message }) });
  const remove = useMutation((api) => api.uninstallPlugin(pid, { purgeData: purge }), { invalidate: ['plugins', 'nodes'], onSuccess: () => { setRemoveOpen(false); toast({ severity: 'info', title: tr("pages.plugins.PluginDetail.s_f433903ca1") }); } });
  const action = useMutation((api, a: string) => api.runPluginAction(pid, a), { onSuccess: (r) => toast({ severity: 'success', title: tr("pages.plugins.PluginDetail.s_068de1f047"), body: tr("pages.plugins.PluginDetail.s_15d4eb7208", { p0: (r.durationMs) }) }), onError: (e) => toast({ severity: 'error', title: tr("pages.plugins.PluginDetail.s_b5d97a28d9"), body: e.message + (e.hint ? ` — ${e.hint}` : '') }) });

  if (p.loading) return <div className="page"><Skeleton h={48} w={360} /><div style={{ height: 20 }} /><SkeletonRows rows={8} /></div>;
  if (p.error && !p.data) return <div className="page"><ErrorState error={p.error} onRetry={p.refetch} /></div>;
  if (!p.data) return <div className="page"><div className="panel"><Empty title={tr("pages.plugins.PluginDetail.s_f962c0c31d")} action={<Link className="btn" to="/plugins">{tr("pages.plugins.PluginDetail.s_09137efc4e")}</Link>}><code>{pid}</code> {tr("pages.plugins.PluginDetail.s_2b716cc97b")}</Empty></div></div>;

  const e = p.data;
  const m = e.manifest;
  const inst = e.instance;
  const installed = isInstalled(e);
  const st = PLUGIN_STATUS[inst.status];
  const busy = inst.status === 'installing' || inst.status === 'updating';
  const issueCount = e.validation.issues.filter((i) => i.severity !== 'info').length;

  return (
    <div className="page">
      <Link to="/plugins" className="row muted" style={{ fontSize: 12, marginBottom: 10, gap: 4 }}><ChevronLeft size={13} />{tr("pages.plugins.PluginDetail.s_ff13ef845f")}</Link>
      <PageHead
        title={<span className="row" style={{ gap: 14 }}><span className="plug-icon lg"><Icon name={m.icon} size={22} /></span><span className="col" style={{ gap: 2 }}><span>{m.name}</span><span className="mono muted" style={{ fontSize: 12, fontWeight: 400, letterSpacing: 0 }}>{m.id} {tr("pages.plugins.PluginDetail.s_d3dacf895c")}{installed ? inst.installedVersion : m.version} {tr("pages.plugins.PluginDetail.s_d3dacf895c")}{m.publisher}</span></span></span>}
        actions={<>
          <StatusBadge tone={st.tone} label={st.label} pulse={busy} />
          {installed && e.validation.compatible && m.metrics.length > 0 && <Button icon={<LayoutDashboard size={14} />} onClick={() => nav(`/dashboards/gen_${m.id}`)}>{tr("pages.plugins.PluginDetail.s_6760a79b03")}</Button>}
          {!installed && <Button variant="primary" icon={<Download size={14} />} perm="plugins.manage" disabled={!e.validation.compatible || busy} title={!e.validation.compatible ? tr("pages.plugins.PluginDetail.s_fde5999285") : undefined} onClick={() => setInstallOpen(true)}>{tr("pages.plugins.PluginDetail.s_ce88d35b18")}</Button>}
          {hasUpdate(e) && <Button variant="accent" icon={<ArrowUpCircle size={14} />} perm="plugins.manage" loading={update.pending} onClick={() => update.run()}>{tr("pages.plugins.PluginDetail.s_b8f622e9ad")}{inst.latestVersion}</Button>}
          {installed && <Button icon={<Power size={14} />} perm="plugins.manage" disabled={busy} loading={toggle.pending} onClick={() => toggle.run(inst.status === 'disabled')}>{inst.status === 'disabled' ? tr("pages.plugins.PluginDetail.s_66be7e0c9a") : tr("pages.plugins.PluginDetail.s_94d07a2171")}</Button>}
          {installed && (m.actions.length > 0 || true) && <Menu trigger={(t) => <Button {...t} iconOnly aria-label={tr("pages.plugins.PluginDetail.s_19f25d5784")}><Zap size={14} /></Button>} items={[
            ...(m.actions.length ? [{ header: tr("pages.plugins.PluginDetail.s_890b0fbca5") }] : []),
            ...m.actions.map((a) => ({ label: a.label, icon: <Play size={14} />, danger: a.dangerous, disabled: !canManage || inst.status === 'disabled', title: a.description, onSelect: () => (a.dangerous ? setActionConfirm(a.id) : action.run(a.id)) })),
            ...(m.actions.length ? [{ separator: true }] : []),
            { label: tr("pages.plugins.PluginDetail.s_6331bf2798"), icon: <Trash2 size={14} />, danger: true, disabled: !canManage, onSelect: () => setRemoveOpen(true) },
          ]} />}
        </>}
      />

      {inst.error && (
        <div className={`banner ${inst.status === 'degraded' ? 'warn' : 'err'}`} style={{ borderRadius: 6, border: 0, marginBottom: 16, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} style={{ marginTop: 2 }} />
          <div className="grow"><div style={{ fontWeight: 600 }}>{inst.error.code}{tr("pages.plugins.PluginDetail.s_ceca32e904")}{inst.error.message}</div>{inst.error.hint && <div style={{ opacity: 0.85 }}>{inst.error.hint}</div>}</div>
          {inst.error.code === 'AUTH_EXPIRED' && <Button size="sm" onClick={() => setParams({ tab: 'settings' })}>{tr("pages.plugins.PluginDetail.s_090fad991e")}</Button>}
          {inst.error.code === 'CONTRACT_INVALID' && <Button size="sm" onClick={() => setParams({ tab: 'contract' })}>{tr("pages.plugins.PluginDetail.s_7e427795b5")}</Button>}
          {m.actions.some((a) => a.id === 'reconnect') && <Button size="sm" icon={<RotateCcw size={13} />} loading={action.pending} onClick={() => action.run('reconnect')}>{tr("pages.plugins.PluginDetail.s_91c2406a9f")}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setParams({ tab: 'logs' })}>{tr("pages.plugins.PluginDetail.s_67ade741ae")}</Button>
        </div>
      )}
      {!e.validation.compatible && !installed && (
        <div className="banner err" style={{ borderRadius: 6, border: 0, marginBottom: 16 }}><AlertTriangle size={15} /><span className="grow">{tr("pages.plugins.PluginDetail.s_8410e6fe3e")}{e.validation.issues.find((i) => i.severity === 'error')?.message}</span><Button size="sm" onClick={() => setParams({ tab: 'contract' })}>{tr("pages.plugins.PluginDetail.s_a8d745fa66")}</Button></div>
      )}

      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'overview', label: tr("pages.plugins.PluginDetail.s_39c6387206") },
        { id: 'settings', label: tr("pages.plugins.PluginDetail.s_7f17c7c62a"), count: m.settings.length || undefined },
        { id: 'permissions', label: tr("pages.plugins.PluginDetail.s_f4470c5797"), count: m.permissions.length || undefined },
        { id: 'nodes', label: tr("pages.plugins.PluginDetail.s_3293ac18db"), count: installed ? inst.nodeIds.length : undefined },
        { id: 'logs', label: tr("pages.plugins.PluginDetail.s_67ade741ae") },
        { id: 'contract', label: tr("pages.plugins.PluginDetail.s_2ff930d7e7"), count: issueCount || undefined, alert: !e.validation.ok },
      ]} />

      {tab === 'overview' && <Overview e={e} />}
      {tab === 'settings' && (installed ? <SettingsTab e={e} /> : <NotInstalled onInstall={() => setInstallOpen(true)} />)}
      {tab === 'permissions' && <PermissionsTab e={e} />}
      {tab === 'nodes' && (installed ? <NodesTab e={e} /> : <NotInstalled onInstall={() => setInstallOpen(true)} />)}
      {tab === 'logs' && (installed ? <LogsTab id={m.id} /> : <NotInstalled onInstall={() => setInstallOpen(true)} />)}
      {tab === 'contract' && <ContractTab e={e} />}

      <InstallDialog entry={e} open={installOpen} onClose={() => setInstallOpen(false)} />
      <Confirm open={removeOpen} onClose={() => setRemoveOpen(false)} danger title={tr("pages.plugins.PluginDetail.s_7c4c578b44", { p0: (m.name) })} confirmLabel={tr("pages.plugins.PluginDetail.s_86ea33aef5")} requireText={m.id} loading={remove.pending} onConfirm={() => remove.run()}
        body={tr("pages.plugins.PluginDetail.s_7c9db4c1ba")}>
        <label className="check"><input type="checkbox" checked={purge} onChange={(ev) => setPurge(ev.target.checked)} /><span>{tr("pages.plugins.PluginDetail.s_eca26d0685")}<span className="muted">{tr("pages.plugins.PluginDetail.s_c4815d8fd8")}</span></span></label>
      </Confirm>
      <Confirm open={!!actionConfirm} onClose={() => setActionConfirm(null)} danger title={tr("pages.plugins.PluginDetail.s_18c108aa70")} confirmLabel={tr("pages.plugins.PluginDetail.s_224c8e93c8")} body={m.actions.find((a) => a.id === actionConfirm)?.label} onConfirm={() => { action.run(actionConfirm!); setActionConfirm(null); }} />
    </div>
  );
}

function NotInstalled({ onInstall }: { onInstall: () => void }) {
  return <div className="panel"><Empty title={tr("pages.plugins.PluginDetail.s_bb1b88f624")} action={<Button variant="primary" perm="plugins.manage" onClick={onInstall}>{tr("pages.plugins.PluginDetail.s_ce88d35b18")}</Button>}>{tr("pages.plugins.PluginDetail.s_62e6382936")}</Empty></div>;
}

function Overview({ e }: { e: PluginEntry }) {
  const m = e.manifest;
  const nodes = useNodes();
  return (
    <div className="grid-aside">
      <div className="col gap-4">
        <Screenshots screenshots={m.screenshots} name={m.name} />
        <p className="ink2" style={{ fontSize: 14, maxWidth: 720 }}>{m.description}</p>
        <Panel title={tr("pages.plugins.PluginDetail.s_3aeb33af51")} meta={`${m.metrics.length}`} flush>
          {m.metrics.length === 0 ? <Empty compact title={tr("pages.plugins.PluginDetail.s_b0657eba8b")} /> : (
            <div className="table-wrap"><table className="t">
              <thead><tr><th>{tr("pages.plugins.PluginDetail.s_4102160a4d")}</th><th>{tr("pages.plugins.PluginDetail.s_d25691ca40")}</th><th>{tr("pages.plugins.PluginDetail.s_e082d142ce")}</th><th>{tr("pages.plugins.PluginDetail.s_5f559b126f")}</th><th>{tr("pages.plugins.PluginDetail.s_5d8e57335f")}</th></tr></thead>
              <tbody>{m.metrics.map((x) => {
                const ranked = widgetRegistry.rank(x).filter((r) => r.score > 0).slice(0, 3);
                const unknown = x.visualizations.filter((v) => !widgetRegistry.get(v));
                return (
                  <tr key={x.id}>
                    <td><div style={{ fontWeight: 500 }}>{x.label}</div><div className="mono faint" style={{ fontSize: 11 }}>{x.id}</div></td>
                    <td className="mono">{x.kind}</td>
                    <td className="mono">{x.unit || '—'}</td>
                    <td className="mono muted">{x.dimensions.map((d) => `${d.id}${d.values ? `(${d.values.length})` : ''}`).join(', ') || '—'}</td>
                    <td><span className="row wrap gap-1">{ranked.map((r, i) => <Badge key={r.def.type} tone={i === 0 ? 'info' : undefined}>{r.def.label}</Badge>)}{unknown.map((u) => <Badge key={u} tone="warn" title={tr("pages.plugins.PluginDetail.s_8c674d46bc")}>{u}{tr("pages.plugins.PluginDetail.s_5bab61eb53")}</Badge>)}</span></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Panel>
        {e.latest.changelog && (
          <Panel title={tr("pages.plugins.PluginDetail.s_adc32cb9dc")}>
            <div className="col gap-3">
              {e.latest.changelog.map((c) => (
                <div key={c.version} className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <span className="mono" style={{ width: 54 }}>{c.version}</span>
                  <span className="muted mono" style={{ width: 84, fontSize: 11.5 }}>{c.date}</span>
                  <ul style={{ margin: 0, paddingLeft: 16 }} className="ink2">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                  {e.instance.installedVersion === c.version && <Badge>{tr("pages.plugins.PluginDetail.s_eebb073219")}</Badge>}
                  {e.instance.installedVersion && e.instance.installedVersion !== c.version && c.version === e.instance.latestVersion && <Badge tone="accent">{diffKind(e.instance.installedVersion, c.version)}</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
      <div className="col gap-4">
        <Panel title={tr("pages.plugins.PluginDetail.s_99bf044d04")}>
          <dl className="kv">
            <dt>{tr("pages.plugins.PluginDetail.s_19c85838e6")}</dt><dd>{CATEGORY_LABEL[m.category]}</dd>
            <dt>{tr("pages.plugins.PluginDetail.s_b3c5598da6")}</dt><dd className="mono">{e.instance.installedVersion ?? '—'}</dd>
            <dt>{tr("pages.plugins.PluginDetail.s_235d449bfc")}</dt><dd className="mono">{e.instance.latestVersion}</dd>
            <dt>{tr("pages.plugins.PluginDetail.s_2ff930d7e7")}</dt><dd className="mono">{m.contract}</dd>
            <dt>{tr("pages.plugins.PluginDetail.s_301f7fd6c0")}</dt><dd>{m.runtime.targets.map((t) => NODE_KIND_LABEL[t]).join(', ')}</dd>
            {m.runtime.minAgent && <><dt>{tr("pages.plugins.PluginDetail.s_8634e35e72")}</dt><dd className="mono">{tr("pages.plugins.PluginDetail.s_de860458d9")}{m.runtime.minAgent}</dd></>}
            <dt>{tr("pages.plugins.PluginDetail.s_7cedddad2b")}</dt><dd>{e.instance.lastSyncAt ? ago(e.instance.lastSyncAt) : '—'}</dd>
            <dt>{tr("pages.plugins.PluginDetail.s_60fd510ded")}</dt><dd className="mono">{e.instance.eventsPerMin !== undefined ? tr("pages.plugins.PluginDetail.s_c77633669d", { p0: (e.instance.eventsPerMin) }) : '—'}</dd>
            <dt>{tr("pages.plugins.PluginDetail.s_3293ac18db")}</dt><dd>{e.instance.nodeIds.map((id) => nodes.data?.find((n) => n.id === id)?.name ?? id).join(', ') || '—'}</dd>
          </dl>
        </Panel>
        <Panel title={tr("pages.plugins.PluginDetail.s_ba8e15f90c")}>
          <div className="col" style={{ gap: 6 }}>
            {m.capabilities.map((c) => (
              <div key={c} className="row" style={{ fontSize: 12.5 }}>
                <Dot tone={c in KNOWN_CAPABILITIES ? 'ok' : c.startsWith('x-') ? 'off' : 'warn'} />
                <code>{c}</code><span className="muted truncate">{KNOWN_CAPABILITIES[c] ?? (c.startsWith('x-') ? tr("pages.plugins.PluginDetail.s_2167bc3329") : tr("pages.plugins.PluginDetail.s_d6cc547bd3"))}</span>
              </div>
            ))}
            {!m.capabilities.length && <span className="muted">{tr("pages.plugins.PluginDetail.s_1b93795b97")}</span>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SettingsTab({ e }: { e: PluginEntry }) {
  const save = useMutation((api, v: Record<string, unknown>) => api.updatePluginSettings(e.manifest.id, v), {
    invalidate: ['plugins'],
    onSuccess: () => toast({ severity: 'success', title: tr("pages.plugins.PluginDetail.s_0c39426c5e"), body: e.manifest.capabilities.includes('settings.live') ? tr("pages.plugins.PluginDetail.s_131423fd41") : tr("pages.plugins.PluginDetail.s_238bcc2230") }),
    onError: (err) => toast({ severity: 'error', title: tr("pages.plugins.PluginDetail.s_8976fe0108"), body: err.message }),
  });
  const canManage = useCan('plugins.manage');
  return <div style={{ maxWidth: 920 }}><SettingsForm fields={e.manifest.settings} values={e.instance.settings} saving={save.pending} disabled={!canManage} onSubmit={(v) => save.run(v)} /></div>;
}

function PermissionsTab({ e }: { e: PluginEntry }) {
  const canManage = useCan('plugins.manage');
  const set = useMutation((api, scopes: string[]) => api.setPluginPermissions(e.manifest.id, scopes), { invalidate: ['plugins'], onSuccess: () => toast({ severity: 'success', title: tr("pages.plugins.PluginDetail.s_6ef77681f9") }) });
  const granted = e.instance.grantedPermissions;
  const installed = isInstalled(e);
  return (
    <Panel flush title={tr("pages.plugins.PluginDetail.s_e49a85bb61")} meta={installed ? tr("pages.plugins.PluginDetail.s_26feeed5c1", { p0: (granted.length) }) : tr("pages.plugins.PluginDetail.s_4f7be1383e")}>
      {e.manifest.permissions.map((p) => {
        const on = granted.includes(p.scope);
        return (
          <div key={p.scope} className="row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--rule)', alignItems: 'flex-start' }}>
            <div className="col grow" style={{ gap: 3 }}>
              <span className="row"><code style={{ fontWeight: 500 }}>{p.scope}</code>{p.optional ? <Badge>{tr("pages.plugins.PluginDetail.s_8bf2ee2944")}</Badge> : <Badge tone="info">{tr("pages.plugins.PluginDetail.s_3adffd9fc9")}</Badge>}{p.scope.endsWith('*') && <Badge tone="warn">{tr("pages.plugins.PluginDetail.s_a2ed5933dc")}</Badge>}</span>
              <span className="muted">{p.reason}</span>
            </div>
            {installed && <Switch checked={on} disabled={!canManage || !p.optional || set.pending} label={p.scope} onChange={(v) => set.run(v ? [...granted, p.scope] : granted.filter((x) => x !== p.scope))} />}
          </div>
        );
      })}
      {!e.manifest.permissions.length && <Empty compact title={tr("pages.plugins.PluginDetail.s_89575a5de6")} />}
      {installed && <div className="panel-body muted" style={{ fontSize: 12 }}>{tr("pages.plugins.PluginDetail.s_ad18b06c91")}</div>}
    </Panel>
  );
}

function NodesTab({ e }: { e: PluginEntry }) {
  const nodes = useNodes();
  const canManage = useCan('plugins.manage');
  const set = useMutation((api, ids: string[]) => api.setPluginNodes(e.manifest.id, ids), { invalidate: ['plugins', 'nodes'], onSuccess: () => toast({ severity: 'success', title: tr("pages.plugins.PluginDetail.s_a062f4cc14") }) });
  const ids = e.instance.nodeIds;
  return (
    <Panel flush title={tr("pages.plugins.PluginDetail.s_d0ebf9a7b6")} meta={tr("pages.plugins.PluginDetail.s_f94731afe6", { p0: (e.manifest.runtime.targets.map((t) => NODE_KIND_LABEL[t]).join(', ')) })}>
      {nodes.loading ? <SkeletonRows /> : (
        <table className="t"><thead><tr><th>{tr("pages.plugins.PluginDetail.s_564eba1527")}</th><th>{tr("pages.plugins.PluginDetail.s_d25691ca40")}</th><th>{tr("pages.plugins.PluginDetail.s_f7f293b5c5")}</th><th>{tr("pages.plugins.PluginDetail.s_2988c59c8b")}</th><th className="r">{tr("pages.plugins.PluginDetail.s_3feee4e549")}</th></tr></thead><tbody>
          {(nodes.data ?? []).map((n) => {
            const supported = e.manifest.runtime.targets.includes(n.kind);
            const proc = n.processes.find((x) => x.component === e.manifest.id);
            return (
              <tr key={n.id} style={{ opacity: supported ? 1 : 0.45 }}>
                <td><Link to={`/nodes/${n.id}`} style={{ fontWeight: 500 }}>{n.name}</Link></td>
                <td>{NODE_KIND_LABEL[n.kind]}</td>
                <td><StatusBadge {...NODE_STATUS[n.status]} /></td>
                <td className="mono muted">{proc ? `${proc.name} · ${proc.status}${proc.restarts ? ` · ↻${proc.restarts}` : ''}` : ids.includes(n.id) ? tr("pages.plugins.PluginDetail.s_737e045899") : '—'}</td>
                <td className="r"><Switch checked={ids.includes(n.id)} disabled={!supported || !canManage || set.pending} onChange={(v) => set.run(v ? [...ids, n.id] : ids.filter((x) => x !== n.id))} /></td>
              </tr>
            );
          })}
        </tbody></table>
      )}
    </Panel>
  );
}

function LogsTab({ id }: { id: string }) {
  const [level, setLevel] = useState<'all' | 'warn' | 'error'>('all');
  const q = useQuery(`plugins/${id}/logs`, (api) => api.getPluginLogs(id, 120), { refetchMs: 10000 });
  const list = (q.data ?? []).filter((l) => level === 'all' || (level === 'warn' ? l.level === 'warn' || l.level === 'error' : l.level === 'error'));
  return (
    <Panel flush title={tr("pages.plugins.PluginDetail.s_7a8a0ce131")} meta={tr("pages.plugins.PluginDetail.s_97ad5d75d3")} actions={<Segmented value={level} onChange={setLevel} options={[{ value: 'all', label: tr("pages.plugins.PluginDetail.s_ef8ff20785") }, { value: 'warn', label: tr("pages.plugins.PluginDetail.s_1e864c6741") }, { value: 'error', label: tr("pages.plugins.PluginDetail.s_11f9578d05") }]} />}>
      {q.loading && <SkeletonRows rows={8} h={12} />}
      {q.error && !q.data && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && !list.length && <Empty compact title={tr("pages.plugins.PluginDetail.s_4a09e3512f")} />}
      <div style={{ maxHeight: 520, overflow: 'auto' }}>
        {list.map((l, i) => (
          <div key={i} className="logline"><span className="muted">{fmtTime(l.ts, true)}</span><span className={`sev ${l.level}`}>{l.level}</span><span className="faint truncate">{l.nodeId ?? 'core'}</span><span style={{ overflowWrap: 'anywhere' }}>{l.message}</span></div>
        ))}
      </div>
    </Panel>
  );
}

function ContractTab({ e }: { e: PluginEntry }) {
  return (
    <div className="grid-2">
      <Panel title={tr("pages.plugins.PluginDetail.s_a8d745fa66")} flush meta={e.validation.compatible ? tr("pages.plugins.PluginDetail.s_c1299c21a1") : tr("pages.plugins.PluginDetail.s_f0af95fb80")}><ValidationIssues report={e.validation} /></Panel>
      <Panel title={tr("pages.plugins.PluginDetail.s_79042410f0")} meta={tr("pages.plugins.PluginDetail.s_9c354f26f3")} flush><pre className="code" style={{ border: 0, borderRadius: 0, maxHeight: 640 }}>{JSON.stringify(e.manifest, null, 2)}</pre></Panel>
    </div>
  );
}

function Screenshots({ screenshots, name }: { screenshots: {url:string;alt?:string;locale?:string}[]; name:string }) {
  const [index,setIndex] = useState(0);
  const images = screenshots.filter(s => !s.locale || s.locale === language);
  if (!images.length) return null;
  const current = images[index % images.length];
  return <section className="panel" aria-label={tr('polish.screenshots')}>
    <img src={current.url} alt={current.alt || name} loading="lazy" referrerPolicy="no-referrer" style={{width:'100%',height:'auto',maxHeight:420,objectFit:'contain',borderRadius:4}} />
    <div className="row" style={{justifyContent:'space-between',marginTop:12}}>
      <Button onClick={() => setIndex((index+images.length-1)%images.length)} aria-label={tr('polish.previous')}>{'←'}</Button>
      <span className="muted">{index%images.length+1}{' / '}{images.length}</span>
      <Button onClick={() => setIndex((index+1)%images.length)} aria-label={tr('polish.next')}>{'→'}</Button>
    </div>
  </section>;
}
