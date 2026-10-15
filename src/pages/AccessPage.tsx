import { tr } from '@/i18n';
import { useState } from 'react';
import { Copy, Eye, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@/app/query';
import { toast, useCan, usePrefs, useRole } from '@/app/stores';
import { CONSOLE_PERMISSIONS, ROLE_LABEL, ROLE_PERMISSIONS, type Principal, type Role } from '@/core/contracts';
import { ago, fmtDate, fmtDateTime } from '@/core/lib/format';
import { Badge, Button, Field, PageHead, Panel, Segmented, Tabs } from '@/ui/primitives';
import { Confirm, Modal } from '@/ui/overlays';
import { Empty, ErrorState, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';

const ROLES: Role[] = ['owner', 'operator', 'analyst', 'viewer'];
const ROLE_DESC: Record<Role, string> = {
  owner: tr("pages.AccessPage.s_704b28a3bc"),
  operator: tr("pages.AccessPage.s_bb425e8ac5"),
  analyst: tr("pages.AccessPage.s_d0775e5b55"),
  viewer: tr("pages.AccessPage.s_628f756da2"),
};
const KIND_ICON = { user: 'user-round', token: 'key-round', node: 'server' } as const;
type Tab = 'principals' | 'roles' | 'audit';

export function AccessPage() {
  const [tab, setTab] = useState<Tab>('principals');
  const principals = useQuery('access/principals', (a) => a.listPrincipals());
  const audit = useQuery(tab === 'audit' ? 'access/audit' : null, (a) => a.listAudit(200));
  const canManage = useCan('access.manage');
  const role = useRole();
  const viewAs = usePrefs((s) => s.viewAs);
  const setPrefs = usePrefs((s) => s.set);
  const [create, setCreate] = useState(false);
  const [revoke, setRevoke] = useState<Principal | null>(null);
  const changeRole = useMutation((api, id: string, r: Role) => api.updatePrincipalRole(id, r), { invalidate: ['access'], onSuccess: (p) => toast({ severity: 'success', title: tr("pages.AccessPage.s_bcad7392e7", { p0: (p.name), p1: (ROLE_LABEL[p.role]) }) }), onError: (e) => toast({ severity: 'error', title: tr("pages.AccessPage.s_f914aeab30"), body: e.message }) });
  const doRevoke = useMutation((api, id: string) => api.revokePrincipal(id), { invalidate: ['access'], onSuccess: () => { setRevoke(null); toast({ severity: 'info', title: tr("pages.AccessPage.s_9374312ab4") }); }, onError: (e) => toast({ severity: 'error', title: tr("pages.AccessPage.s_b0fac569dc"), body: e.message }) });
  const owners = principals.data?.filter((p) => p.role === 'owner').length ?? 0;

  return (
    <div className="page">
      <PageHead title={tr("pages.AccessPage.s_fefc535f60")} sub={tr("pages.AccessPage.s_c3132562c5")}
        actions={<Button variant="primary" icon={<Plus size={14} />} perm="access.manage" onClick={() => setCreate(true)}>{tr("pages.AccessPage.s_5c441a3b37")}</Button>} />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body row wrap gap-3">
          <Eye size={15} className="muted" />
          <div className="grow"><div style={{ fontWeight: 500 }}>{tr("pages.AccessPage.s_7734e1b0a9")}</div><div className="muted" style={{ fontSize: 12.5 }}>{tr("pages.AccessPage.s_a44a2956f5")}</div></div>
          <Segmented sans value={(viewAs ?? 'owner') as Role} onChange={(r) => setPrefs({ viewAs: r === 'owner' ? null : r })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'principals', label: tr("pages.AccessPage.s_b44ec758dd"), count: principals.data?.length }, { id: 'roles', label: tr("pages.AccessPage.s_c7bb01b325") }, { id: 'audit', label: tr("pages.AccessPage.s_39846e7f3e") }]} />

      {tab === 'principals' && <>
        {principals.loading && <SkeletonRows rows={6} h={28} />}
        {principals.error && !principals.data && <ErrorState error={principals.error} onRetry={principals.refetch} />}
        {principals.data && principals.data.length === 0 && <div className="panel"><Empty title={tr("pages.AccessPage.s_46be4db6ec")} /></div>}
        {principals.data && principals.data.length > 0 && (
          <div className="panel table-wrap"><table className="t">
            <thead><tr><th>{tr("pages.AccessPage.s_aee78fe860")}</th><th>{tr("pages.AccessPage.s_d25691ca40")}</th><th style={{ width: 170 }}>{tr("pages.AccessPage.s_ab51a3ace2")}</th><th>{tr("pages.AccessPage.s_bc32f88e3b")}</th><th>{tr("pages.AccessPage.s_30ba26d2e7")}</th><th>{tr("pages.AccessPage.s_793c3c0c97")}</th><th className="r" /></tr></thead>
            <tbody>{principals.data.map((p) => {
              const lastOwner = p.role === 'owner' && owners <= 1;
              const self = p.id === 'u_owner' || p.email === 'me@delta.local';
              return (
                <tr key={p.id}>
                  <td><span className="row"><Icon name={KIND_ICON[p.kind]} size={15} className="muted" /><span className="col" style={{ gap: 0 }}><span style={{ fontWeight: 500 }}>{p.name}</span><span className="mono faint" style={{ fontSize: 11 }}>{p.email ?? p.tokenPreview ?? p.id}</span></span>{p.mfa && <span title={tr("pages.AccessPage.s_dba50a9524")}><ShieldCheck size={13} color="var(--ok)" /></span>}</span></td>
                  <td className="muted">{p.kind === 'user' ? tr("pages.AccessPage.s_51aff18539") : p.kind === 'token' ? tr("pages.AccessPage.s_78f3cc4d4c") : tr("pages.AccessPage.s_564eba1527")}</td>
                  <td><select className="select" style={{ height: 26 }} value={p.role} disabled={!canManage || lastOwner || changeRole.pending} title={lastOwner ? tr("pages.AccessPage.s_db09f46f56") : undefined} onChange={(e) => changeRole.run(p.id, e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                  <td>{p.scopes?.length ? <span className="row wrap gap-1">{p.scopes.slice(0, 3).map((s) => <Badge key={s} mono outline>{s}</Badge>)}{p.scopes.length > 3 && <span className="faint">{tr("pages.AccessPage.s_a979ef10cc")}{p.scopes.length - 3}</span>}</span> : <span className="faint">{tr("pages.AccessPage.s_9df9c8cc1a")}</span>}</td>
                  <td className="muted">{p.lastActive ? ago(p.lastActive) : tr("pages.AccessPage.s_8ceadba8d8")}</td>
                  <td>{p.expiresAt ? <span style={{ color: p.expiresAt < Date.now() + 7 * 86400000 ? 'var(--warn)' : undefined }}>{fmtDate(p.expiresAt)}</span> : <span className="faint">{tr("pages.AccessPage.s_1b93795b97")}</span>}</td>
                  <td className="r"><Button size="sm" variant="ghost" iconOnly aria-label={tr("pages.AccessPage.s_9b16ca539e")} disabled={!canManage || lastOwner || self} title={self ? tr("pages.AccessPage.s_a0e72fbeab") : tr("pages.AccessPage.s_0ff0310376")} onClick={() => setRevoke(p)}><Trash2 size={13} /></Button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </>}

      {tab === 'roles' && (
        <div className="panel table-wrap"><table className="t">
          <thead><tr><th>{tr("pages.AccessPage.s_12436e103d")}</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center', color: r === role ? 'var(--ink)' : undefined }}>{ROLE_LABEL[r]}{r === role && ' ●'}</th>)}</tr></thead>
          <tbody>
            <tr><td className="muted" style={{ fontSize: 12 }}>{tr("pages.AccessPage.s_f5441f6aee")}</td>{ROLES.map((r) => <td key={r} className="muted" style={{ fontSize: 11.5, whiteSpace: 'normal', maxWidth: 200, textAlign: 'center' }}>{ROLE_DESC[r]}</td>)}</tr>
            {CONSOLE_PERMISSIONS.map((perm) => (
              <tr key={perm.id}><td><div>{perm.label}</div><div className="mono faint" style={{ fontSize: 11 }}>{perm.id}</div></td>
                {ROLES.map((r) => <td key={r} style={{ textAlign: 'center' }}>{ROLE_PERMISSIONS[r].includes(perm.id) ? <Icon name="check" size={14} /> : <span className="faint">{tr("pages.AccessPage.s_1b93795b97")}</span>}</td>)}</tr>
            ))}
          </tbody>
        </table></div>
      )}

      {tab === 'audit' && (
        <Panel flush>
          {audit.loading && <div className="panel-body"><SkeletonRows rows={10} /></div>}
          {audit.error && !audit.data && <ErrorState error={audit.error} onRetry={audit.refetch} />}
          {audit.data?.length === 0 && <Empty title={tr("pages.AccessPage.s_cf751e2e19")} />}
          {audit.data?.map((a) => (
            <div key={a.id} className="logline" style={{ gridTemplateColumns: '128px 140px 180px minmax(0,1fr) 110px' }}>
              <span className="muted">{fmtDateTime(a.ts)}</span><span className="truncate">{a.actor}</span><span className="truncate" style={{ color: a.action.includes('revoke') || a.action.includes('delete') ? 'var(--err)' : undefined }}>{a.action}</span><span className="truncate ink2">{a.target}</span><span className="faint">{a.ip ?? ''}</span>
            </div>
          ))}
        </Panel>
      )}

      <CreateToken open={create} onClose={() => setCreate(false)} />
      <Confirm open={!!revoke} onClose={() => setRevoke(null)} danger title={tr("pages.AccessPage.s_2b956aa12d", { p0: (revoke?.name) })}
        body={revoke?.kind === 'node' ? tr("pages.AccessPage.s_fae256f1a5") : revoke?.kind === 'token' ? tr("pages.AccessPage.s_9f80c864cc") : tr("pages.AccessPage.s_0a637fc78a")}
        confirmLabel={tr("pages.AccessPage.s_9b16ca539e")} loading={doRevoke.pending} onConfirm={() => revoke && doRevoke.run(revoke.id)} />
    </div>
  );
}

const SCOPE_PRESETS = ['metrics.read', 'events.read', 'dashboards.read', 'plugins.read', 'nodes.read', 'nodes.command', 'ingest.write'];

function CreateToken({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [scopes, setScopes] = useState<string[]>(['metrics.read']);
  const [ttl, setTtl] = useState<'30' | '90' | '365' | 'never'>('90');
  const [secret, setSecret] = useState<string | null>(null);
  const create = useMutation((api) => api.createToken({ name: name.trim(), role, scopes, ttlDays: ttl === 'never' ? null : Number(ttl) }), { invalidate: ['access'], onSuccess: (r) => setSecret(r.secret) });
  const reset = () => { setName(''); setRole('viewer'); setScopes(['metrics.read']); setTtl('90'); setSecret(null); create.reset(); onClose(); };
  const nameErr = name && !/^[\p{L}\d][\p{L}\d _.-]{1,47}$/u.test(name.trim()) ? tr("pages.AccessPage.s_aee543b196") : undefined;
  return (
    <Modal open={open} onClose={reset} title={secret ? tr("pages.AccessPage.s_ea23873a5d") : tr("pages.AccessPage.s_2c184055f4")} icon={<KeyRound size={16} />}
      footer={secret ? <Button variant="primary" onClick={reset}>{tr("pages.AccessPage.s_c15738d65b")}</Button> : <>
        <Button variant="ghost" onClick={reset}>{tr("pages.AccessPage.s_0ec753be8d")}</Button>
        <Button variant="primary" disabled={!name.trim() || !!nameErr || !scopes.length} loading={create.pending} onClick={() => create.run()}>{tr("pages.AccessPage.s_84370a2097")}</Button>
      </>}>
      {secret ? (
        <div className="col gap-3">
          <div className="banner warn" style={{ borderRadius: 6, border: 0, padding: '8px 12px' }}>{tr("pages.AccessPage.s_c224316c53")}</div>
          <div className="row"><code className="code grow" style={{ whiteSpace: 'nowrap' }}>{secret}</code><Button iconOnly aria-label={tr("pages.AccessPage.s_4a05d8619d")} onClick={() => { navigator.clipboard?.writeText(secret).then(() => toast({ severity: 'success', title: tr("pages.AccessPage.s_8922542f90") }), () => toast({ severity: 'warn', title: tr("pages.AccessPage.s_18a04f6f0a") })); }}><Copy size={14} /></Button></div>
          <div className="muted" style={{ fontSize: 12 }}>{tr("pages.AccessPage.s_9c053d420e")}<code>{tr("pages.AccessPage.s_4f26074efc")}{secret.slice(0, 10)}{tr("pages.AccessPage.s_df316e17de")}</code></div>
        </div>
      ) : (
        <div className="col gap-4">
          <Field label={tr("pages.AccessPage.s_3de49828e8")} error={nameErr} help={tr("pages.AccessPage.s_e8a7ee2653")}><input className={`input ${nameErr ? 'invalid' : ''}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={tr("pages.AccessPage.s_ab51a3ace2")}><Segmented sans value={role} onChange={setRole} options={ROLES.filter((r) => r !== 'owner').map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></Field>
          <Field label={tr("pages.AccessPage.s_f75d1bd211")} help={tr("pages.AccessPage.s_884f22a836")} error={!scopes.length ? tr("pages.AccessPage.s_44a2e702f0") : undefined}>
            <div className="row wrap gap-1">{SCOPE_PRESETS.map((s) => <button key={s} className="chip mono" aria-pressed={scopes.includes(s)} onClick={() => setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s])}>{s}</button>)}</div>
          </Field>
          <Field label={tr("pages.AccessPage.s_87e7a85d59")}><Segmented sans value={ttl} onChange={setTtl} options={[{ value: '30', label: tr("pages.AccessPage.s_9b80c8a9bc") }, { value: '90', label: tr("pages.AccessPage.s_8470ddc559") }, { value: '365', label: tr("pages.AccessPage.s_ef8b8666df") }, { value: 'never', label: tr("pages.AccessPage.s_519bb302e9") }]} /></Field>
          {ttl === 'never' && <div className="field-help" style={{ color: 'var(--warn)' }}>{tr("pages.AccessPage.s_2912273252")}</div>}
          {create.error && <div className="field-error">{create.error.message}</div>}
        </div>
      )}
    </Modal>
  );
}
