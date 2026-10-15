import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpCircle, LayoutGrid, List, Search } from 'lucide-react';
import { usePlugins } from '@/app/data';
import { hasUpdate, isInstalled } from '@/core/registry/plugins';
import type { PluginCategory, PluginEntry } from '@/core/contracts';
import { ago } from '@/core/lib/format';
import { Badge, Button, PageHead, Segmented, StatusBadge, Tabs } from '@/ui/primitives';
import { Empty, ErrorState, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { PLUGIN_STATUS } from '@/ui/status';

export const CATEGORY_LABEL: Record<PluginCategory, string> = { input: 'Ввод', health: 'Здоровье', finance: 'Финансы', dev: 'Разработка', media: 'Медиа', home: 'Дом', system: 'Система', location: 'Геоданные', productivity: 'Продуктивность', other: 'Другое' };

type Tab = 'installed' | 'available' | 'updates' | 'issues';

function PluginCard({ p, onOpen }: { p: PluginEntry; onOpen: () => void }) {
  const st = PLUGIN_STATUS[p.instance.status];
  const warn = p.validation.issues.filter((i) => i.severity !== 'info').length;
  return (
    <article className="plug" onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className={`plug-icon ${p.validation.compatible ? '' : 'muted'}`}><Icon name={p.manifest.icon} size={17} /></span>
        <div className="col grow" style={{ gap: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }} className="truncate">{p.manifest.name}</span>{hasUpdate(p) && <Badge tone="accent">↑ {p.instance.latestVersion}</Badge>}</div>
          <span className="mono faint truncate" style={{ fontSize: 11 }}>{p.manifest.id} · {p.manifest.version}</span>
        </div>
        <StatusBadge tone={st.tone} label={st.label} pulse={p.instance.status === 'installing' || p.instance.status === 'updating'} />
      </div>
      <p className="plug-desc">{p.instance.error ? <span style={{ color: 'var(--err)' }}>{p.instance.error.message}</span> : p.manifest.description}</p>
      <div className="plug-foot">
        <span>{CATEGORY_LABEL[p.manifest.category]}</span>·<span>{p.manifest.metrics.length} метрик</span>
        {isInstalled(p) && <>·<span>{p.instance.nodeIds.length} узл.</span></>}
        <span className="spacer" />
        {!p.validation.compatible ? <Badge tone="err">контракт {p.manifest.contract}</Badge> : warn ? <Badge tone="warn" title="Замечания валидации">{warn} ⚠</Badge> : <span className="mono">{p.manifest.publisher}</span>}
        {p.instance.lastSyncAt && <span className="mono">{ago(p.instance.lastSyncAt)}</span>}
      </div>
    </article>
  );
}

export function PluginsPage() {
  const plugins = usePlugins();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'installed';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<PluginCategory | ''>('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const all = plugins.data ?? [];
  const counts = {
    installed: all.filter(isInstalled).length,
    available: all.filter((p) => !isInstalled(p)).length,
    updates: all.filter(hasUpdate).length,
    issues: all.filter((p) => ['error', 'degraded', 'incompatible'].includes(p.instance.status) || !p.validation.ok).length,
  };
  const list = useMemo(() => all.filter((p) => {
    if (tab === 'installed' && !isInstalled(p)) return false;
    if (tab === 'available' && isInstalled(p)) return false;
    if (tab === 'updates' && !hasUpdate(p)) return false;
    if (tab === 'issues' && !(['error', 'degraded', 'incompatible'].includes(p.instance.status) || !p.validation.ok)) return false;
    if (cat && p.manifest.category !== cat) return false;
    if (q) { const t = q.toLowerCase(); return `${p.manifest.name} ${p.manifest.id} ${p.manifest.description} ${p.manifest.metrics.map((m) => m.label).join(' ')}`.toLowerCase().includes(t); }
    return true;
  }), [all, tab, cat, q]);
  const cats = [...new Set(all.map((p) => p.manifest.category))];

  return (
    <div className="page">
      <PageHead title="Плагины" sub="Модули публикуют через ядро контракт: метрики, настройки, разрешения и действия. Консоль валидирует его и строит интерфейс сама."
        actions={counts.updates > 0 && <Button icon={<ArrowUpCircle size={14} />} onClick={() => setParams({ tab: 'updates' })}>Обновления: {counts.updates}</Button>} />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'installed', label: 'Установленные', count: counts.installed },
        { id: 'available', label: 'Каталог', count: counts.available },
        { id: 'updates', label: 'Обновления', count: counts.updates },
        { id: 'issues', label: 'Проблемы', count: counts.issues, alert: counts.issues > 0 },
      ]} />
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="input-group" style={{ width: 300, maxWidth: '100%' }}><span className="addon" style={{ borderRadius: '5px 0 0 5px', borderLeft: '1px solid var(--rule-strong)', borderRight: 0 }}><Search size={13} /></span><input className="input" style={{ borderRadius: '0 5px 5px 0' }} placeholder="Название, id, метрика…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row wrap gap-1">
          <button className="chip" aria-pressed={cat === ''} onClick={() => setCat('')}>Все</button>
          {cats.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{CATEGORY_LABEL[c]}</button>)}
        </div>
        <span className="spacer" />
        <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: <LayoutGrid size={13} />, title: 'Карточки' }, { value: 'table', label: <List size={13} />, title: 'Таблица' }]} />
      </div>
      {plugins.loading && <SkeletonRows rows={6} h={60} />}
      {plugins.error && !plugins.data && <ErrorState error={plugins.error} onRetry={plugins.refetch} />}
      {plugins.data && list.length === 0 && <div className="panel"><Empty title={q || cat ? 'Ничего не найдено' : tab === 'updates' ? 'Все плагины актуальны' : tab === 'issues' ? 'Проблем нет' : 'Пусто'} action={(q || cat) && <Button onClick={() => { setQ(''); setCat(''); }}>Сбросить фильтры</Button>} /></div>}
      {list.length > 0 && view === 'grid' && <div className="catalog">{list.map((p) => <PluginCard key={p.manifest.id} p={p} onOpen={() => nav(`/plugins/${encodeURIComponent(p.manifest.id)}`)} />)}</div>}
      {list.length > 0 && view === 'table' && (
        <div className="panel table-wrap"><table className="t">
          <thead><tr><th>Плагин</th><th>Статус</th><th>Версия</th><th>Контракт</th><th>Узлы</th><th>Метрики</th><th>Синхр.</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.manifest.id} className="clickable" onClick={() => nav(`/plugins/${encodeURIComponent(p.manifest.id)}`)}>
              <td><span className="row"><Icon name={p.manifest.icon} size={15} className="muted" /><span className="col" style={{ gap: 0 }}><span style={{ fontWeight: 500 }}>{p.manifest.name}</span><span className="mono faint" style={{ fontSize: 11 }}>{p.manifest.id}</span></span></span></td>
              <td><StatusBadge {...PLUGIN_STATUS[p.instance.status]} /></td>
              <td className="mono">{p.instance.installedVersion ?? '—'}{hasUpdate(p) && <span style={{ color: 'var(--accent)' }}> → {p.instance.latestVersion}</span>}</td>
              <td className="mono">{p.manifest.contract} {!p.validation.compatible && <Badge tone="err">✕</Badge>}</td>
              <td className="num" style={{ textAlign: 'left' }}>{p.instance.nodeIds.length || '—'}</td>
              <td className="num" style={{ textAlign: 'left' }}>{p.manifest.metrics.length}</td>
              <td className="muted">{p.instance.lastSyncAt ? ago(p.instance.lastSyncAt) : '—'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
