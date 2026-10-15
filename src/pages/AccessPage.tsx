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
  owner: 'Полный доступ, включая управление доступом и конфигурацию ядра',
  operator: 'Плагины, узлы и команды — без администрирования узлов и доступа',
  analyst: 'Данные и дашборды, без управления системой',
  viewer: 'Только просмотр дашбордов, плагинов и узлов',
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
  const changeRole = useMutation((api, id: string, r: Role) => api.updatePrincipalRole(id, r), { invalidate: ['access'], onSuccess: (p) => toast({ severity: 'success', title: `Роль изменена: ${p.name} → ${ROLE_LABEL[p.role]}` }), onError: (e) => toast({ severity: 'error', title: 'Не удалось изменить роль', body: e.message }) });
  const doRevoke = useMutation((api, id: string) => api.revokePrincipal(id), { invalidate: ['access'], onSuccess: () => { setRevoke(null); toast({ severity: 'info', title: 'Доступ отозван' }); }, onError: (e) => toast({ severity: 'error', title: 'Не удалось отозвать', body: e.message }) });
  const owners = principals.data?.filter((p) => p.role === 'owner').length ?? 0;

  return (
    <div className="page">
      <PageHead title="Доступ" sub="Пользователи, API-токены и учётные записи узлов. Роли определяют, что доступно в консоли; плагины запрашивают собственные области данных отдельно."
        actions={<Button variant="primary" icon={<Plus size={14} />} perm="access.manage" onClick={() => setCreate(true)}>Создать токен</Button>} />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body row wrap gap-3">
          <Eye size={15} className="muted" />
          <div className="grow"><div style={{ fontWeight: 500 }}>Просмотр от имени роли</div><div className="muted" style={{ fontSize: 12.5 }}>Проверьте, как консоль выглядит для участника с меньшими правами. Действия, требующие прав, будут заблокированы.</div></div>
          <Segmented sans value={(viewAs ?? 'owner') as Role} onChange={(r) => setPrefs({ viewAs: r === 'owner' ? null : r })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'principals', label: 'Участники и токены', count: principals.data?.length }, { id: 'roles', label: 'Роли и права' }, { id: 'audit', label: 'Аудит' }]} />

      {tab === 'principals' && <>
        {principals.loading && <SkeletonRows rows={6} h={28} />}
        {principals.error && !principals.data && <ErrorState error={principals.error} onRetry={principals.refetch} />}
        {principals.data && principals.data.length === 0 && <div className="panel"><Empty title="Нет участников" /></div>}
        {principals.data && principals.data.length > 0 && (
          <div className="panel table-wrap"><table className="t">
            <thead><tr><th>Имя</th><th>Тип</th><th style={{ width: 170 }}>Роль</th><th>Области</th><th>Активность</th><th>Истекает</th><th className="r" /></tr></thead>
            <tbody>{principals.data.map((p) => {
              const lastOwner = p.role === 'owner' && owners <= 1;
              const self = p.id === 'u_owner' || p.email === 'me@delta.local';
              return (
                <tr key={p.id}>
                  <td><span className="row"><Icon name={KIND_ICON[p.kind]} size={15} className="muted" /><span className="col" style={{ gap: 0 }}><span style={{ fontWeight: 500 }}>{p.name}</span><span className="mono faint" style={{ fontSize: 11 }}>{p.email ?? p.tokenPreview ?? p.id}</span></span>{p.mfa && <span title="2FA включена"><ShieldCheck size={13} color="var(--ok)" /></span>}</span></td>
                  <td className="muted">{p.kind === 'user' ? 'Пользователь' : p.kind === 'token' ? 'API-токен' : 'Узел'}</td>
                  <td><select className="select" style={{ height: 26 }} value={p.role} disabled={!canManage || lastOwner || changeRole.pending} title={lastOwner ? 'Нельзя понизить последнего владельца' : undefined} onChange={(e) => changeRole.run(p.id, e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                  <td>{p.scopes?.length ? <span className="row wrap gap-1">{p.scopes.slice(0, 3).map((s) => <Badge key={s} mono outline>{s}</Badge>)}{p.scopes.length > 3 && <span className="faint">+{p.scopes.length - 3}</span>}</span> : <span className="faint">по роли</span>}</td>
                  <td className="muted">{p.lastActive ? ago(p.lastActive) : 'никогда'}</td>
                  <td>{p.expiresAt ? <span style={{ color: p.expiresAt < Date.now() + 7 * 86400000 ? 'var(--warn)' : undefined }}>{fmtDate(p.expiresAt)}</span> : <span className="faint">—</span>}</td>
                  <td className="r"><Button size="sm" variant="ghost" iconOnly aria-label="Отозвать" disabled={!canManage || lastOwner || self} title={self ? 'Нельзя отозвать собственный доступ' : 'Отозвать доступ'} onClick={() => setRevoke(p)}><Trash2 size={13} /></Button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </>}

      {tab === 'roles' && (
        <div className="panel table-wrap"><table className="t">
          <thead><tr><th>Право</th>{ROLES.map((r) => <th key={r} style={{ textAlign: 'center', color: r === role ? 'var(--ink)' : undefined }}>{ROLE_LABEL[r]}{r === role && ' ●'}</th>)}</tr></thead>
          <tbody>
            <tr><td className="muted" style={{ fontSize: 12 }}>Описание</td>{ROLES.map((r) => <td key={r} className="muted" style={{ fontSize: 11.5, whiteSpace: 'normal', maxWidth: 200, textAlign: 'center' }}>{ROLE_DESC[r]}</td>)}</tr>
            {CONSOLE_PERMISSIONS.map((perm) => (
              <tr key={perm.id}><td><div>{perm.label}</div><div className="mono faint" style={{ fontSize: 11 }}>{perm.id}</div></td>
                {ROLES.map((r) => <td key={r} style={{ textAlign: 'center' }}>{ROLE_PERMISSIONS[r].includes(perm.id) ? <Icon name="check" size={14} /> : <span className="faint">—</span>}</td>)}</tr>
            ))}
          </tbody>
        </table></div>
      )}

      {tab === 'audit' && (
        <Panel flush>
          {audit.loading && <div className="panel-body"><SkeletonRows rows={10} /></div>}
          {audit.error && !audit.data && <ErrorState error={audit.error} onRetry={audit.refetch} />}
          {audit.data?.length === 0 && <Empty title="Журнал аудита пуст" />}
          {audit.data?.map((a) => (
            <div key={a.id} className="logline" style={{ gridTemplateColumns: '128px 140px 180px minmax(0,1fr) 110px' }}>
              <span className="muted">{fmtDateTime(a.ts)}</span><span className="truncate">{a.actor}</span><span className="truncate" style={{ color: a.action.includes('revoke') || a.action.includes('delete') ? 'var(--err)' : undefined }}>{a.action}</span><span className="truncate ink2">{a.target}</span><span className="faint">{a.ip ?? ''}</span>
            </div>
          ))}
        </Panel>
      )}

      <CreateToken open={create} onClose={() => setCreate(false)} />
      <Confirm open={!!revoke} onClose={() => setRevoke(null)} danger title={`Отозвать доступ «${revoke?.name}»?`}
        body={revoke?.kind === 'node' ? 'Агент узла потеряет связь с ядром и потребует повторного сопряжения.' : revoke?.kind === 'token' ? 'Все интеграции, использующие токен, немедленно получат 401.' : 'Пользователь будет разлогинен на всех устройствах.'}
        confirmLabel="Отозвать" loading={doRevoke.pending} onConfirm={() => revoke && doRevoke.run(revoke.id)} />
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
  const nameErr = name && !/^[\p{L}\d][\p{L}\d _.-]{1,47}$/u.test(name.trim()) ? '2–48 символов: буквы, цифры, пробел, . _ -' : undefined;
  return (
    <Modal open={open} onClose={reset} title={secret ? 'Токен создан' : 'Новый API-токен'} icon={<KeyRound size={16} />}
      footer={secret ? <Button variant="primary" onClick={reset}>Готово, я сохранил токен</Button> : <>
        <Button variant="ghost" onClick={reset}>Отмена</Button>
        <Button variant="primary" disabled={!name.trim() || !!nameErr || !scopes.length} loading={create.pending} onClick={() => create.run()}>Создать</Button>
      </>}>
      {secret ? (
        <div className="col gap-3">
          <div className="banner warn" style={{ borderRadius: 6, border: 0, padding: '8px 12px' }}>Секрет показывается один раз. Сохраните его в менеджере паролей.</div>
          <div className="row"><code className="code grow" style={{ whiteSpace: 'nowrap' }}>{secret}</code><Button iconOnly aria-label="Копировать" onClick={() => { navigator.clipboard?.writeText(secret).then(() => toast({ severity: 'success', title: 'Скопировано' }), () => toast({ severity: 'warn', title: 'Буфер обмена недоступен' })); }}><Copy size={14} /></Button></div>
          <div className="muted" style={{ fontSize: 12 }}>Использование: <code>Authorization: Bearer {secret.slice(0, 10)}…</code></div>
        </div>
      ) : (
        <div className="col gap-4">
          <Field label="Название" error={nameErr} help="Например: «Home Assistant» или «CI экспорт»"><input className={`input ${nameErr ? 'invalid' : ''}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Роль"><Segmented sans value={role} onChange={setRole} options={ROLES.filter((r) => r !== 'owner').map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></Field>
          <Field label="Области доступа" help="Токен получит пересечение прав роли и выбранных областей" error={!scopes.length ? 'Выберите хотя бы одну область' : undefined}>
            <div className="row wrap gap-1">{SCOPE_PRESETS.map((s) => <button key={s} className="chip mono" aria-pressed={scopes.includes(s)} onClick={() => setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s])}>{s}</button>)}</div>
          </Field>
          <Field label="Срок действия"><Segmented sans value={ttl} onChange={setTtl} options={[{ value: '30', label: '30 дн.' }, { value: '90', label: '90 дн.' }, { value: '365', label: '1 год' }, { value: 'never', label: 'Бессрочно' }]} /></Field>
          {ttl === 'never' && <div className="field-help" style={{ color: 'var(--warn)' }}>Бессрочные токены не рекомендуются — их сложнее отследить при утечке.</div>}
          {create.error && <div className="field-error">{create.error.message}</div>}
        </div>
      )}
    </Modal>
  );
}
