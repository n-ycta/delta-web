import { tr } from '@/i18n';
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

export const CATEGORY_LABEL: Record<PluginCategory, string> = { input: tr("pages.plugins.PluginsPage.s_c15522ef34"), health: tr("pages.plugins.PluginsPage.s_08930838eb"), finance: tr("pages.plugins.PluginsPage.s_61dcf3af42"), dev: tr("pages.plugins.PluginsPage.s_738724359f"), media: tr("pages.plugins.PluginsPage.s_198be2a9a8"), home: tr("pages.plugins.PluginsPage.s_92f3f459ec"), system: tr("pages.plugins.PluginsPage.s_3ac98f278c"), location: tr("pages.plugins.PluginsPage.s_eb6f9c21f2"), productivity: tr("pages.plugins.PluginsPage.s_7fadb95f60"), other: tr("pages.plugins.PluginsPage.s_8f96cac0d4") };

type Tab = 'installed' | 'available' | 'updates' | 'issues';

function PluginCard({ p, onOpen }: { p: PluginEntry; onOpen: () => void }) {
  const st = PLUGIN_STATUS[p.instance.status];
  const warn = p.validation.issues.filter((i) => i.severity !== 'info').length;
  return (
    <article className="plug" onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <span className={`plug-icon ${p.validation.compatible ? '' : 'muted'}`}><Icon name={p.manifest.icon} size={17} /></span>
        <div className="col grow" style={{ gap: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }} className="truncate">{p.manifest.name}</span>{hasUpdate(p) && <Badge tone="accent">{tr("pages.plugins.PluginsPage.s_6f6312ab93")}{p.instance.latestVersion}</Badge>}</div>
          <span className="mono faint truncate" style={{ fontSize: 11 }}>{p.manifest.id} {tr("pages.plugins.PluginsPage.s_d3dacf895c")}{p.manifest.version}</span>
        </div>
        <StatusBadge tone={st.tone} label={st.label} pulse={p.instance.status === 'installing' || p.instance.status === 'updating'} />
      </div>
      <p className="plug-desc">{p.instance.error ? <span style={{ color: 'var(--err)' }}>{p.instance.error.message}</span> : p.manifest.description}</p>
      <div className="plug-foot">
        <span>{CATEGORY_LABEL[p.manifest.category]}</span>{tr("pages.plugins.PluginsPage.s_1fdf0d90c3")}<span>{p.manifest.metrics.length} {tr("pages.plugins.PluginsPage.s_dbed049336")}</span>
        {isInstalled(p) && <>{tr("pages.plugins.PluginsPage.s_1fdf0d90c3")}<span>{p.instance.nodeIds.length} {tr("pages.plugins.PluginsPage.s_b940ce6285")}</span></>}
        <span className="spacer" />
        {!p.validation.compatible ? <Badge tone="err">{tr("pages.plugins.PluginsPage.s_ddd65de460")}{p.manifest.contract}</Badge> : warn ? <Badge tone="warn" title={tr("pages.plugins.PluginsPage.s_e78a1e0116")}>{warn} {tr("pages.plugins.PluginsPage.s_f3a371dc8d")}</Badge> : <span className="mono">{p.manifest.publisher}</span>}
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
      <PageHead title={tr("pages.plugins.PluginsPage.s_ff13ef845f")} sub={tr("pages.plugins.PluginsPage.s_13f5b9ea75")}
        actions={counts.updates > 0 && <Button icon={<ArrowUpCircle size={14} />} onClick={() => setParams({ tab: 'updates' })}>{tr("pages.plugins.PluginsPage.s_8dcaf51985")}{counts.updates}</Button>} />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'installed', label: tr("pages.plugins.PluginsPage.s_92e4a3e2cb"), count: counts.installed },
        { id: 'available', label: tr("pages.plugins.PluginsPage.s_46e27e2f0a"), count: counts.available },
        { id: 'updates', label: tr("pages.plugins.PluginsPage.s_1392090686"), count: counts.updates },
        { id: 'issues', label: tr("pages.plugins.PluginsPage.s_7c80872ccf"), count: counts.issues, alert: counts.issues > 0 },
      ]} />
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="input-group" style={{ width: 300, maxWidth: '100%' }}><span className="addon" style={{ borderRadius: '5px 0 0 5px', borderLeft: '1px solid var(--rule-strong)', borderRight: 0 }}><Search size={13} /></span><input className="input" style={{ borderRadius: '0 5px 5px 0' }} placeholder={tr("pages.plugins.PluginsPage.s_c43dd99223")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row wrap gap-1">
          <button className="chip" aria-pressed={cat === ''} onClick={() => setCat('')}>{tr("pages.plugins.PluginsPage.s_fd08da7a63")}</button>
          {cats.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{CATEGORY_LABEL[c]}</button>)}
        </div>
        <span className="spacer" />
        <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: <LayoutGrid size={13} />, title: tr("pages.plugins.PluginsPage.s_a0d17d23d2") }, { value: 'table', label: <List size={13} />, title: tr("pages.plugins.PluginsPage.s_f2729fd738") }]} />
      </div>
      {plugins.loading && <SkeletonRows rows={6} h={60} />}
      {plugins.error && !plugins.data && <ErrorState error={plugins.error} onRetry={plugins.refetch} />}
      {plugins.data && list.length === 0 && <div className="panel"><Empty title={q || cat ? tr("pages.plugins.PluginsPage.s_1e1b70b17c") : tab === 'updates' ? tr("pages.plugins.PluginsPage.s_5ab23fd08c") : tab === 'issues' ? tr("pages.plugins.PluginsPage.s_12ef865f61") : tr("pages.plugins.PluginsPage.s_1526c02015")} action={(q || cat) && <Button onClick={() => { setQ(''); setCat(''); }}>{tr("pages.plugins.PluginsPage.s_03ead01c5b")}</Button>} /></div>}
      {list.length > 0 && view === 'grid' && <div className="catalog">{list.map((p) => <PluginCard key={p.manifest.id} p={p} onOpen={() => nav(`/plugins/${encodeURIComponent(p.manifest.id)}`)} />)}</div>}
      {list.length > 0 && view === 'table' && (
        <div className="panel table-wrap"><table className="t">
          <thead><tr><th>{tr("pages.plugins.PluginsPage.s_f79d7e1e29")}</th><th>{tr("pages.plugins.PluginsPage.s_f7f293b5c5")}</th><th>{tr("pages.plugins.PluginsPage.s_97c248cbe0")}</th><th>{tr("pages.plugins.PluginsPage.s_2ff930d7e7")}</th><th>{tr("pages.plugins.PluginsPage.s_3293ac18db")}</th><th>{tr("pages.plugins.PluginsPage.s_3aeb33af51")}</th><th>{tr("pages.plugins.PluginsPage.s_4e14b19eb5")}</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.manifest.id} className="clickable" onClick={() => nav(`/plugins/${encodeURIComponent(p.manifest.id)}`)}>
              <td><span className="row"><Icon name={p.manifest.icon} size={15} className="muted" /><span className="col" style={{ gap: 0 }}><span style={{ fontWeight: 500 }}>{p.manifest.name}</span><span className="mono faint" style={{ fontSize: 11 }}>{p.manifest.id}</span></span></span></td>
              <td><StatusBadge {...PLUGIN_STATUS[p.instance.status]} /></td>
              <td className="mono">{p.instance.installedVersion ?? '—'}{hasUpdate(p) && <span style={{ color: 'var(--accent)' }}> {tr("pages.plugins.PluginsPage.s_0d9f4dcfc3")}{p.instance.latestVersion}</span>}</td>
              <td className="mono">{p.manifest.contract} {!p.validation.compatible && <Badge tone="err">{tr("pages.plugins.PluginsPage.s_0951b9a022")}</Badge>}</td>
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
