import { tr } from '@/i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { useDashboards, useNodes, usePlugins } from '@/app/data';
import { usePrefs, useUi, toast } from '@/app/stores';
import { useApi } from '@/app/ApiContext';
import { queryClient } from '@/app/query';
import { Icon } from '@/ui/Icon';
import { Highlight, Kbd } from '@/ui/primitives';
import { NODE_KIND_LABEL } from '@/core/contracts';
import { NODE_ICON } from '@/widgets/system/NodeGridWidget';

interface Cmd { id: string; group: string; label: string; hint?: string; icon: ReactNode; keywords?: string; run: () => void }

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const set = useUi((s) => s.set);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const api = useApi();
  const plugins = usePlugins();
  const nodes = useNodes();
  const dashboards = useDashboards();
  const prefs = usePrefs();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); set({ paletteOpen: !useUi.getState().paletteOpen }); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [set]);
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);

  const go = (to: string) => () => nav(to);
  const cmds = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [
      { id: 'p-home', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_39c6387206"), icon: <Icon name="gauge" size={15} />, run: go('/') },
      { id: 'p-dash', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_292999fc23"), icon: <Icon name="layout-dashboard" size={15} />, run: go('/dashboards') },
      { id: 'p-plug', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_ff13ef845f"), icon: <Icon name="puzzle" size={15} />, keywords: tr("layout.CommandPalette.s_475844eebf"), run: go('/plugins') },
      { id: 'p-nodes', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_3293ac18db"), icon: <Icon name="server" size={15} />, keywords: 'nodes vps android', run: go('/nodes') },
      { id: 'p-ev', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_bb9ac87531"), icon: <Icon name="scroll-text" size={15} />, keywords: tr("layout.CommandPalette.s_f56c683880"), run: go('/events') },
      { id: 'p-con', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_e894a203a7"), icon: <Icon name="file-check-2" size={15} />, keywords: 'manifest schema', run: go('/contracts') },
      { id: 'p-acc', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_bbc99c4e25"), icon: <Icon name="key-round" size={15} />, keywords: tr("layout.CommandPalette.s_a998a1ff21"), run: go('/access') },
      { id: 'p-set', group: tr("layout.CommandPalette.s_946ee08764"), label: tr("layout.CommandPalette.s_7f17c7c62a"), icon: <Icon name="settings" size={15} />, run: go('/settings') },
      { id: 'a-newdash', group: tr("layout.CommandPalette.s_9978ac34b2"), label: tr("layout.CommandPalette.s_7fce29ffdd"), icon: <Icon name="plus" size={15} />, run: go('/dashboards?new=1') },
      { id: 'a-addnode', group: tr("layout.CommandPalette.s_9978ac34b2"), label: tr("layout.CommandPalette.s_3f9a7c101f"), icon: <Icon name="plus" size={15} />, keywords: 'pair pairing', run: go('/nodes?pair=1') },
      { id: 'a-theme', group: tr("layout.CommandPalette.s_9978ac34b2"), label: tr("layout.CommandPalette.s_e8902e8570"), icon: <Icon name="sun-moon" size={15} />, run: () => prefs.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }) },
      { id: 'a-density', group: tr("layout.CommandPalette.s_9978ac34b2"), label: tr("layout.CommandPalette.s_70c5fdd9af", { p0: (prefs.density === 'compact' ? tr("layout.CommandPalette.s_623e7c2db3") : tr("layout.CommandPalette.s_db1bc48369")) }), icon: <Icon name="rows-3" size={15} />, run: () => prefs.set({ density: prefs.density === 'compact' ? 'comfortable' : 'compact' }) },
      { id: 'a-export', group: tr("layout.CommandPalette.s_9978ac34b2"), label: tr("layout.CommandPalette.s_f99c00f377"), icon: <Icon name="download" size={15} />, run: go('/settings?tab=backup') },
      { id: 'a-readall', group: tr("layout.CommandPalette.s_9978ac34b2"), label: tr("layout.CommandPalette.s_c8f68da831"), icon: <Icon name="check-check" size={15} />, run: async () => { await api.markNotifications('all', true); queryClient.invalidate('notifications'); toast({ severity: 'success', title: tr("layout.CommandPalette.s_ee5f845f59") }); } },
    ];
    dashboards.data?.filter((d) => d.origin !== 'home').forEach((d) => list.push({ id: `d-${d.id}`, group: tr("layout.CommandPalette.s_292999fc23"), label: d.name, hint: tr("layout.CommandPalette.s_4a579880de", { p0: (d.widgets.length) }), icon: <Icon name={d.icon ?? 'layout-dashboard'} size={15} />, run: go(`/dashboards/${d.id}`) }));
    plugins.data?.forEach((p) => {
      list.push({ id: `pl-${p.manifest.id}`, group: tr("layout.CommandPalette.s_ff13ef845f"), label: p.manifest.name, hint: p.manifest.id, keywords: p.manifest.description, icon: <Icon name={p.manifest.icon} size={15} />, run: go(`/plugins/${p.manifest.id}`) });
      if (p.instance.installedVersion) p.manifest.metrics.forEach((m) => list.push({ id: `m-${p.manifest.id}-${m.id}`, group: tr("layout.CommandPalette.s_3aeb33af51"), label: `${m.label}`, hint: `${p.manifest.name} · ${m.id}`, keywords: m.description, icon: <Icon name="chart-line" size={15} />, run: go(`/dashboards/gen_${p.manifest.id}`) }));
    });
    nodes.data?.forEach((n) => {
      list.push({ id: `n-${n.id}`, group: tr("layout.CommandPalette.s_3293ac18db"), label: n.name, hint: `${NODE_KIND_LABEL[n.kind]} · ${n.address}`, keywords: `${n.os} ${n.tags.join(' ')}`, icon: <Icon name={NODE_ICON[n.kind]} size={15} />, run: go(`/nodes/${n.id}`) });
      if (n.allowedCommands.includes('sync-now') && n.status !== 'offline') list.push({ id: `nc-${n.id}`, group: tr("layout.CommandPalette.s_156bc8b353"), label: tr("layout.CommandPalette.s_3bcb7fb2ef", { p0: (n.name) }), icon: <Icon name="refresh-cw" size={15} />, run: async () => { try { await api.runNodeCommand(n.id, 'sync-now'); toast({ severity: 'success', title: tr("layout.CommandPalette.s_f622bcbb88", { p0: (n.name) }) }); } catch (e) { toast({ severity: 'error', title: tr("layout.CommandPalette.s_fe1fac6b5f"), body: (e as Error).message }); } } });
    });
    return list;
  }, [plugins.data, nodes.data, dashboards.data, prefs, api]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return cmds.filter((c) => c.group === tr("layout.CommandPalette.s_946ee08764") || c.group === tr("layout.CommandPalette.s_9978ac34b2") || c.group === tr("layout.CommandPalette.s_292999fc23"));
    const words = t.split(/\s+/);
    return cmds
      .map((c) => {
        const hay = `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const score = (c.label.toLowerCase().startsWith(t) ? 3 : 0) + (c.label.toLowerCase().includes(t) ? 2 : 0) + (c.group === tr("layout.CommandPalette.s_946ee08764") ? 0.5 : 0);
        return { c, score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 40)
      .map((x) => x!.c);
  }, [q, cmds]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  if (!open) return null;

  const run = (c: Cmd) => { set({ paletteOpen: false }); c.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && results[sel]) run(results[sel]);
    else if (e.key === 'Escape') set({ paletteOpen: false });
  };
  const groups: string[] = [];
  results.forEach((r) => { if (!groups.includes(r.group)) groups.push(r.group); });
  const ordered = groups.flatMap((g) => results.filter((r) => r.group === g));

  return createPortal(
    <>
      <div className="overlay" style={{ zIndex: 69 }} onClick={() => set({ paletteOpen: false })} />
      <div className="palette" role="dialog" aria-label={tr("layout.CommandPalette.s_6433b522a1")}>
        <div className="palette-input"><Search size={16} className="muted" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={tr("layout.CommandPalette.s_b21f3f2f65")} /><Kbd>{tr("layout.CommandPalette.s_abb761d9af")}</Kbd></div>
        <div className="palette-list" ref={listRef}>
          {ordered.length === 0 && <div className="state compact"><h4>{tr("layout.CommandPalette.s_1e1b70b17c")}</h4><p>{tr("layout.CommandPalette.s_51c016c04a")}</p></div>}
          {groups.map((g) => (
            <div key={g}>
              <div className="palette-group label">{g}</div>
              {ordered.filter((r) => r.group === g).map((c) => {
                const idx = ordered.indexOf(c);
                return (
                  <div key={c.id} className="palette-item" aria-selected={idx === sel} onMouseMove={() => setSel(idx)} onClick={() => run(c)}>
                    {c.icon}<span className="truncate"><Highlight text={c.label} q={q.trim()} /></span>
                    {c.hint && <span className="hint truncate" style={{ maxWidth: 260 }}>{c.hint}</span>}
                    {idx === sel && <ArrowRight size={13} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot"><span><Kbd>{tr("layout.CommandPalette.s_9555ffd723")}</Kbd> <Kbd>{tr("layout.CommandPalette.s_fc486696ad")}</Kbd> {tr("layout.CommandPalette.s_a3e7114d1a")}</span><span><Kbd><CornerDownLeft size={9} /></Kbd> {tr("layout.CommandPalette.s_b0e4c387fd")}</span><span className="spacer" /><span>{ordered.length} {tr("layout.CommandPalette.s_1828692928")}</span></div>
      </div>
    </>, document.body);
}
