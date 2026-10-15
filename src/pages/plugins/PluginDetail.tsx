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

  const toggle = useMutation((api, en: boolean) => api.setPluginEnabled(pid, en), { invalidate: ['plugins'], onSuccess: (_r, en) => toast({ severity: 'success', title: en ? 'Плагин включён' : 'Плагин отключён' }), onError: (e) => toast({ severity: 'error', title: 'Не удалось', body: e.message }) });
  const update = useMutation((api) => api.updatePlugin(pid), { invalidate: ['plugins'], onSuccess: () => toast({ severity: 'info', title: 'Обновление запущено' }), onError: (e) => toast({ severity: 'error', title: 'Обновление не удалось', body: e.message }) });
  const remove = useMutation((api) => api.uninstallPlugin(pid, { purgeData: purge }), { invalidate: ['plugins', 'nodes'], onSuccess: () => { setRemoveOpen(false); toast({ severity: 'info', title: 'Плагин удалён' }); } });
  const action = useMutation((api, a: string) => api.runPluginAction(pid, a), { onSuccess: (r) => toast({ severity: 'success', title: 'Действие выполнено', body: `${r.durationMs} мс` }), onError: (e) => toast({ severity: 'error', title: 'Действие не выполнено', body: e.message + (e.hint ? ` — ${e.hint}` : '') }) });

  if (p.loading) return <div className="page"><Skeleton h={48} w={360} /><div style={{ height: 20 }} /><SkeletonRows rows={8} /></div>;
  if (p.error && !p.data) return <div className="page"><ErrorState error={p.error} onRetry={p.refetch} /></div>;
  if (!p.data) return <div className="page"><div className="panel"><Empty title="Плагин не найден" action={<Link className="btn" to="/plugins">В каталог</Link>}><code>{pid}</code> отсутствует в реестре ядра.</Empty></div></div>;

  const e = p.data;
  const m = e.manifest;
  const inst = e.instance;
  const installed = isInstalled(e);
  const st = PLUGIN_STATUS[inst.status];
  const busy = inst.status === 'installing' || inst.status === 'updating';
  const issueCount = e.validation.issues.filter((i) => i.severity !== 'info').length;

  return (
    <div className="page">
      <Link to="/plugins" className="row muted" style={{ fontSize: 12, marginBottom: 10, gap: 4 }}><ChevronLeft size={13} />Плагины</Link>
      <PageHead
        title={<span className="row" style={{ gap: 14 }}><span className="plug-icon lg"><Icon name={m.icon} size={22} /></span><span className="col" style={{ gap: 2 }}><span>{m.name}</span><span className="mono muted" style={{ fontSize: 12, fontWeight: 400, letterSpacing: 0 }}>{m.id} · {installed ? inst.installedVersion : m.version} · {m.publisher}</span></span></span>}
        actions={<>
          <StatusBadge tone={st.tone} label={st.label} pulse={busy} />
          {installed && e.validation.compatible && m.metrics.length > 0 && <Button icon={<LayoutDashboard size={14} />} onClick={() => nav(`/dashboards/gen_${m.id}`)}>Дашборд</Button>}
          {!installed && <Button variant="primary" icon={<Download size={14} />} perm="plugins.manage" disabled={!e.validation.compatible || busy} title={!e.validation.compatible ? 'Контракт несовместим' : undefined} onClick={() => setInstallOpen(true)}>Установить</Button>}
          {hasUpdate(e) && <Button variant="accent" icon={<ArrowUpCircle size={14} />} perm="plugins.manage" loading={update.pending} onClick={() => update.run()}>Обновить до {inst.latestVersion}</Button>}
          {installed && <Button icon={<Power size={14} />} perm="plugins.manage" disabled={busy} loading={toggle.pending} onClick={() => toggle.run(inst.status === 'disabled')}>{inst.status === 'disabled' ? 'Включить' : 'Отключить'}</Button>}
          {installed && (m.actions.length > 0 || true) && <Menu trigger={(t) => <Button {...t} iconOnly aria-label="Ещё"><Zap size={14} /></Button>} items={[
            ...(m.actions.length ? [{ header: 'Действия плагина' }] : []),
            ...m.actions.map((a) => ({ label: a.label, icon: <Play size={14} />, danger: a.dangerous, disabled: !canManage || inst.status === 'disabled', title: a.description, onSelect: () => (a.dangerous ? setActionConfirm(a.id) : action.run(a.id)) })),
            ...(m.actions.length ? [{ separator: true }] : []),
            { label: 'Удалить плагин', icon: <Trash2 size={14} />, danger: true, disabled: !canManage, onSelect: () => setRemoveOpen(true) },
          ]} />}
        </>}
      />

      {inst.error && (
        <div className={`banner ${inst.status === 'degraded' ? 'warn' : 'err'}`} style={{ borderRadius: 6, border: 0, marginBottom: 16, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} style={{ marginTop: 2 }} />
          <div className="grow"><div style={{ fontWeight: 600 }}>{inst.error.code}: {inst.error.message}</div>{inst.error.hint && <div style={{ opacity: 0.85 }}>{inst.error.hint}</div>}</div>
          {inst.error.code === 'AUTH_EXPIRED' && <Button size="sm" onClick={() => setParams({ tab: 'settings' })}>Открыть настройки</Button>}
          {inst.error.code === 'CONTRACT_INVALID' && <Button size="sm" onClick={() => setParams({ tab: 'contract' })}>Подробнее</Button>}
          {m.actions.some((a) => a.id === 'reconnect') && <Button size="sm" icon={<RotateCcw size={13} />} loading={action.pending} onClick={() => action.run('reconnect')}>Переподключить</Button>}
          <Button size="sm" variant="ghost" onClick={() => setParams({ tab: 'logs' })}>Журнал</Button>
        </div>
      )}
      {!e.validation.compatible && !installed && (
        <div className="banner err" style={{ borderRadius: 6, border: 0, marginBottom: 16 }}><AlertTriangle size={15} /><span className="grow">Установка заблокирована: {e.validation.issues.find((i) => i.severity === 'error')?.message}</span><Button size="sm" onClick={() => setParams({ tab: 'contract' })}>Отчёт валидации</Button></div>
      )}

      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'overview', label: 'Обзор' },
        { id: 'settings', label: 'Настройки', count: m.settings.length || undefined },
        { id: 'permissions', label: 'Разрешения', count: m.permissions.length || undefined },
        { id: 'nodes', label: 'Узлы', count: installed ? inst.nodeIds.length : undefined },
        { id: 'logs', label: 'Журнал' },
        { id: 'contract', label: 'Контракт', count: issueCount || undefined, alert: !e.validation.ok },
      ]} />

      {tab === 'overview' && <Overview e={e} />}
      {tab === 'settings' && (installed ? <SettingsTab e={e} /> : <NotInstalled onInstall={() => setInstallOpen(true)} />)}
      {tab === 'permissions' && <PermissionsTab e={e} />}
      {tab === 'nodes' && (installed ? <NodesTab e={e} /> : <NotInstalled onInstall={() => setInstallOpen(true)} />)}
      {tab === 'logs' && (installed ? <LogsTab id={m.id} /> : <NotInstalled onInstall={() => setInstallOpen(true)} />)}
      {tab === 'contract' && <ContractTab e={e} />}

      <InstallDialog entry={e} open={installOpen} onClose={() => setInstallOpen(false)} />
      <Confirm open={removeOpen} onClose={() => setRemoveOpen(false)} danger title={`Удалить «${m.name}»?`} confirmLabel="Удалить" requireText={m.id} loading={remove.pending} onConfirm={() => remove.run()}
        body="Плагин будет остановлен и удалён со всех узлов. Виджеты на дашбордах покажут, что источник недоступен.">
        <label className="check"><input type="checkbox" checked={purge} onChange={(ev) => setPurge(ev.target.checked)} /><span>Удалить также собранные данные <span className="muted">(необратимо)</span></span></label>
      </Confirm>
      <Confirm open={!!actionConfirm} onClose={() => setActionConfirm(null)} danger title="Выполнить опасное действие?" confirmLabel="Выполнить" body={m.actions.find((a) => a.id === actionConfirm)?.label} onConfirm={() => { action.run(actionConfirm!); setActionConfirm(null); }} />
    </div>
  );
}

function NotInstalled({ onInstall }: { onInstall: () => void }) {
  return <div className="panel"><Empty title="Плагин не установлен" action={<Button variant="primary" perm="plugins.manage" onClick={onInstall}>Установить</Button>}>Раздел станет доступен после установки.</Empty></div>;
}

function Overview({ e }: { e: PluginEntry }) {
  const m = e.manifest;
  const nodes = useNodes();
  return (
    <div className="grid-aside">
      <div className="col gap-4">
        <p className="ink2" style={{ fontSize: 14, maxWidth: 720 }}>{m.description}</p>
        <Panel title="Метрики" meta={`${m.metrics.length}`} flush>
          {m.metrics.length === 0 ? <Empty compact title="Плагин не публикует метрик" /> : (
            <div className="table-wrap"><table className="t">
              <thead><tr><th>Метрика</th><th>Тип</th><th>Ед.</th><th>Измерения</th><th>Визуализация консоли</th></tr></thead>
              <tbody>{m.metrics.map((x) => {
                const ranked = widgetRegistry.rank(x).filter((r) => r.score > 0).slice(0, 3);
                const unknown = x.visualizations.filter((v) => !widgetRegistry.get(v));
                return (
                  <tr key={x.id}>
                    <td><div style={{ fontWeight: 500 }}>{x.label}</div><div className="mono faint" style={{ fontSize: 11 }}>{x.id}</div></td>
                    <td className="mono">{x.kind}</td>
                    <td className="mono">{x.unit || '—'}</td>
                    <td className="mono muted">{x.dimensions.map((d) => `${d.id}${d.values ? `(${d.values.length})` : ''}`).join(', ') || '—'}</td>
                    <td><span className="row wrap gap-1">{ranked.map((r, i) => <Badge key={r.def.type} tone={i === 0 ? 'info' : undefined}>{r.def.label}</Badge>)}{unknown.map((u) => <Badge key={u} tone="warn" title="Неизвестная визуализация — заменена">{u}?</Badge>)}</span></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Panel>
        {e.latest.changelog && (
          <Panel title="Изменения">
            <div className="col gap-3">
              {e.latest.changelog.map((c) => (
                <div key={c.version} className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
                  <span className="mono" style={{ width: 54 }}>{c.version}</span>
                  <span className="muted mono" style={{ width: 84, fontSize: 11.5 }}>{c.date}</span>
                  <ul style={{ margin: 0, paddingLeft: 16 }} className="ink2">{c.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                  {e.instance.installedVersion === c.version && <Badge>установлена</Badge>}
                  {e.instance.installedVersion && e.instance.installedVersion !== c.version && c.version === e.instance.latestVersion && <Badge tone="accent">{diffKind(e.instance.installedVersion, c.version)}</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
      <div className="col gap-4">
        <Panel title="Сведения">
          <dl className="kv">
            <dt>Категория</dt><dd>{CATEGORY_LABEL[m.category]}</dd>
            <dt>Установлена</dt><dd className="mono">{e.instance.installedVersion ?? '—'}</dd>
            <dt>Последняя</dt><dd className="mono">{e.instance.latestVersion}</dd>
            <dt>Контракт</dt><dd className="mono">{m.contract}</dd>
            <dt>Среды</dt><dd>{m.runtime.targets.map((t) => NODE_KIND_LABEL[t]).join(', ')}</dd>
            {m.runtime.minAgent && <><dt>Агент</dt><dd className="mono">≥ {m.runtime.minAgent}</dd></>}
            <dt>Синхронизация</dt><dd>{e.instance.lastSyncAt ? ago(e.instance.lastSyncAt) : '—'}</dd>
            <dt>Поток</dt><dd className="mono">{e.instance.eventsPerMin !== undefined ? `${e.instance.eventsPerMin} соб/мин` : '—'}</dd>
            <dt>Узлы</dt><dd>{e.instance.nodeIds.map((id) => nodes.data?.find((n) => n.id === id)?.name ?? id).join(', ') || '—'}</dd>
          </dl>
        </Panel>
        <Panel title="Возможности">
          <div className="col" style={{ gap: 6 }}>
            {m.capabilities.map((c) => (
              <div key={c} className="row" style={{ fontSize: 12.5 }}>
                <Dot tone={c in KNOWN_CAPABILITIES ? 'ok' : c.startsWith('x-') ? 'off' : 'warn'} />
                <code>{c}</code><span className="muted truncate">{KNOWN_CAPABILITIES[c] ?? (c.startsWith('x-') ? 'экспериментальная, игнорируется' : 'не поддерживается консолью')}</span>
              </div>
            ))}
            {!m.capabilities.length && <span className="muted">—</span>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SettingsTab({ e }: { e: PluginEntry }) {
  const save = useMutation((api, v: Record<string, unknown>) => api.updatePluginSettings(e.manifest.id, v), {
    invalidate: ['plugins'],
    onSuccess: () => toast({ severity: 'success', title: 'Настройки сохранены', body: e.manifest.capabilities.includes('settings.live') ? 'Применены без перезапуска' : 'Применятся при следующем цикле плагина' }),
    onError: (err) => toast({ severity: 'error', title: 'Не сохранено', body: err.message }),
  });
  const canManage = useCan('plugins.manage');
  return <div style={{ maxWidth: 920 }}><SettingsForm fields={e.manifest.settings} values={e.instance.settings} saving={save.pending} disabled={!canManage} onSubmit={(v) => save.run(v)} /></div>;
}

function PermissionsTab({ e }: { e: PluginEntry }) {
  const canManage = useCan('plugins.manage');
  const set = useMutation((api, scopes: string[]) => api.setPluginPermissions(e.manifest.id, scopes), { invalidate: ['plugins'], onSuccess: () => toast({ severity: 'success', title: 'Разрешения обновлены' }) });
  const granted = e.instance.grantedPermissions;
  const installed = isInstalled(e);
  return (
    <Panel flush title="Запрошенные области доступа" meta={installed ? `${granted.length} выдано` : 'до установки'}>
      {e.manifest.permissions.map((p) => {
        const on = granted.includes(p.scope);
        return (
          <div key={p.scope} className="row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--rule)', alignItems: 'flex-start' }}>
            <div className="col grow" style={{ gap: 3 }}>
              <span className="row"><code style={{ fontWeight: 500 }}>{p.scope}</code>{p.optional ? <Badge>необязательно</Badge> : <Badge tone="info">обязательно</Badge>}{p.scope.endsWith('*') && <Badge tone="warn">широкое</Badge>}</span>
              <span className="muted">{p.reason}</span>
            </div>
            {installed && <Switch checked={on} disabled={!canManage || !p.optional || set.pending} label={p.scope} onChange={(v) => set.run(v ? [...granted, p.scope] : granted.filter((x) => x !== p.scope))} />}
          </div>
        );
      })}
      {!e.manifest.permissions.length && <Empty compact title="Разрешения не требуются" />}
      {installed && <div className="panel-body muted" style={{ fontSize: 12 }}>Обязательные разрешения отзываются только удалением плагина. Изменения пишутся в журнал аудита.</div>}
    </Panel>
  );
}

function NodesTab({ e }: { e: PluginEntry }) {
  const nodes = useNodes();
  const canManage = useCan('plugins.manage');
  const set = useMutation((api, ids: string[]) => api.setPluginNodes(e.manifest.id, ids), { invalidate: ['plugins', 'nodes'], onSuccess: () => toast({ severity: 'success', title: 'Размещение обновлено' }) });
  const ids = e.instance.nodeIds;
  return (
    <Panel flush title="Размещение по узлам" meta={`поддерживаются: ${e.manifest.runtime.targets.map((t) => NODE_KIND_LABEL[t]).join(', ')}`}>
      {nodes.loading ? <SkeletonRows /> : (
        <table className="t"><thead><tr><th>Узел</th><th>Тип</th><th>Статус</th><th>Процесс</th><th className="r">Запущен</th></tr></thead><tbody>
          {(nodes.data ?? []).map((n) => {
            const supported = e.manifest.runtime.targets.includes(n.kind);
            const proc = n.processes.find((x) => x.component === e.manifest.id);
            return (
              <tr key={n.id} style={{ opacity: supported ? 1 : 0.45 }}>
                <td><Link to={`/nodes/${n.id}`} style={{ fontWeight: 500 }}>{n.name}</Link></td>
                <td>{NODE_KIND_LABEL[n.kind]}</td>
                <td><StatusBadge {...NODE_STATUS[n.status]} /></td>
                <td className="mono muted">{proc ? `${proc.name} · ${proc.status}${proc.restarts ? ` · ↻${proc.restarts}` : ''}` : ids.includes(n.id) ? 'встроен в агент' : '—'}</td>
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
    <Panel flush title="Журнал плагина" meta="обновляется каждые 10 с" actions={<Segmented value={level} onChange={setLevel} options={[{ value: 'all', label: 'все' }, { value: 'warn', label: 'warn+' }, { value: 'error', label: 'error' }]} />}>
      {q.loading && <SkeletonRows rows={8} h={12} />}
      {q.error && !q.data && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && !list.length && <Empty compact title="Записей нет" />}
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
      <Panel title="Отчёт валидации" flush meta={e.validation.compatible ? 'совместим' : 'несовместим'}><ValidationIssues report={e.validation} /></Panel>
      <Panel title="Манифест" meta="после нормализации схемой" flush><pre className="code" style={{ border: 0, borderRadius: 0, maxHeight: 640 }}>{JSON.stringify(e.manifest, null, 2)}</pre></Panel>
    </div>
  );
}
