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
      { id: 'p-home', group: 'Разделы', label: 'Обзор', icon: <Icon name="gauge" size={15} />, run: go('/') },
      { id: 'p-dash', group: 'Разделы', label: 'Дашборды', icon: <Icon name="layout-dashboard" size={15} />, run: go('/dashboards') },
      { id: 'p-plug', group: 'Разделы', label: 'Плагины', icon: <Icon name="puzzle" size={15} />, keywords: 'каталог plugins', run: go('/plugins') },
      { id: 'p-nodes', group: 'Разделы', label: 'Узлы', icon: <Icon name="server" size={15} />, keywords: 'nodes vps android', run: go('/nodes') },
      { id: 'p-ev', group: 'Разделы', label: 'События', icon: <Icon name="scroll-text" size={15} />, keywords: 'журнал логи events', run: go('/events') },
      { id: 'p-con', group: 'Разделы', label: 'Контракты и валидатор', icon: <Icon name="file-check-2" size={15} />, keywords: 'manifest schema', run: go('/contracts') },
      { id: 'p-acc', group: 'Разделы', label: 'Доступ и токены', icon: <Icon name="key-round" size={15} />, keywords: 'роли права token', run: go('/access') },
      { id: 'p-set', group: 'Разделы', label: 'Настройки', icon: <Icon name="settings" size={15} />, run: go('/settings') },
      { id: 'a-newdash', group: 'Действия', label: 'Создать дашборд', icon: <Icon name="plus" size={15} />, run: go('/dashboards?new=1') },
      { id: 'a-addnode', group: 'Действия', label: 'Подключить узел', icon: <Icon name="plus" size={15} />, keywords: 'pair pairing', run: go('/nodes?pair=1') },
      { id: 'a-theme', group: 'Действия', label: 'Переключить тему', icon: <Icon name="sun-moon" size={15} />, run: () => prefs.set({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }) },
      { id: 'a-density', group: 'Действия', label: `Плотность: ${prefs.density === 'compact' ? 'обычная' : 'компактная'}`, icon: <Icon name="rows-3" size={15} />, run: () => prefs.set({ density: prefs.density === 'compact' ? 'comfortable' : 'compact' }) },
      { id: 'a-export', group: 'Действия', label: 'Экспорт конфигурации', icon: <Icon name="download" size={15} />, run: go('/settings?tab=backup') },
      { id: 'a-readall', group: 'Действия', label: 'Отметить уведомления прочитанными', icon: <Icon name="check-check" size={15} />, run: async () => { await api.markNotifications('all', true); queryClient.invalidate('notifications'); toast({ severity: 'success', title: 'Уведомления прочитаны' }); } },
    ];
    dashboards.data?.filter((d) => d.origin !== 'home').forEach((d) => list.push({ id: `d-${d.id}`, group: 'Дашборды', label: d.name, hint: `${d.widgets.length} видж.`, icon: <Icon name={d.icon ?? 'layout-dashboard'} size={15} />, run: go(`/dashboards/${d.id}`) }));
    plugins.data?.forEach((p) => {
      list.push({ id: `pl-${p.manifest.id}`, group: 'Плагины', label: p.manifest.name, hint: p.manifest.id, keywords: p.manifest.description, icon: <Icon name={p.manifest.icon} size={15} />, run: go(`/plugins/${p.manifest.id}`) });
      if (p.instance.installedVersion) p.manifest.metrics.forEach((m) => list.push({ id: `m-${p.manifest.id}-${m.id}`, group: 'Метрики', label: `${m.label}`, hint: `${p.manifest.name} · ${m.id}`, keywords: m.description, icon: <Icon name="chart-line" size={15} />, run: go(`/dashboards/gen_${p.manifest.id}`) }));
    });
    nodes.data?.forEach((n) => {
      list.push({ id: `n-${n.id}`, group: 'Узлы', label: n.name, hint: `${NODE_KIND_LABEL[n.kind]} · ${n.address}`, keywords: `${n.os} ${n.tags.join(' ')}`, icon: <Icon name={NODE_ICON[n.kind]} size={15} />, run: go(`/nodes/${n.id}`) });
      if (n.allowedCommands.includes('sync-now') && n.status !== 'offline') list.push({ id: `nc-${n.id}`, group: 'Команды узлам', label: `Синхронизировать ${n.name}`, icon: <Icon name="refresh-cw" size={15} />, run: async () => { try { await api.runNodeCommand(n.id, 'sync-now'); toast({ severity: 'success', title: `${n.name}: синхронизировано` }); } catch (e) { toast({ severity: 'error', title: 'Команда не выполнена', body: (e as Error).message }); } } });
    });
    return list;
  }, [plugins.data, nodes.data, dashboards.data, prefs, api]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return cmds.filter((c) => c.group === 'Разделы' || c.group === 'Действия' || c.group === 'Дашборды');
    const words = t.split(/\s+/);
    return cmds
      .map((c) => {
        const hay = `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const score = (c.label.toLowerCase().startsWith(t) ? 3 : 0) + (c.label.toLowerCase().includes(t) ? 2 : 0) + (c.group === 'Разделы' ? 0.5 : 0);
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
      <div className="palette" role="dialog" aria-label="Поиск">
        <div className="palette-input"><Search size={16} className="muted" /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Плагины, метрики, узлы, дашборды, команды…" /><Kbd>esc</Kbd></div>
        <div className="palette-list" ref={listRef}>
          {ordered.length === 0 && <div className="state compact"><h4>Ничего не найдено</h4><p>Попробуйте id плагина, имя узла или название метрики.</p></div>}
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
        <div className="palette-foot"><span><Kbd>↑</Kbd> <Kbd>↓</Kbd> выбор</span><span><Kbd><CornerDownLeft size={9} /></Kbd> открыть</span><span className="spacer" /><span>{ordered.length} результатов</span></div>
      </div>
    </>, document.body);
}
