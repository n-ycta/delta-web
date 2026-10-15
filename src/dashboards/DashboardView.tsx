import { tr, language } from '@/i18n';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Check, LayoutGrid, Pencil, Plus, RefreshCw, X } from 'lucide-react';
import type { DashboardConfig, TimeRangePreset, WidgetConfig, WidgetDisplay } from '@/core/contracts';
import { widgetRegistry } from '@/widgets/registry';
import { usePlugins } from '@/app/data';
import { queryClient } from '@/app/query';
import { useCan } from '@/app/stores';
import { Button, Segmented } from '@/ui/primitives';
import { Empty } from '@/ui/states';
import { uid } from '@/core/lib/random';
import { nextFreeY } from '@/core/registry/autodash';
import { WidgetFrame } from './WidgetFrame';
import { WidgetEditor } from './WidgetEditor';

const Grid = WidthProvider(Responsive);
const RANGES: TimeRangePreset[] = ['1h', '6h', '24h', '7d', '30d', '90d'];

export function DashboardView({ dashboard, onSave, headerExtra, editable = true }: {
  dashboard: DashboardConfig; onSave: (d: DashboardConfig) => Promise<unknown> | void; headerExtra?: ReactNode; editable?: boolean;
}) {
  const plugins = usePlugins();
  const canWrite = useCan('dashboards.write') && editable;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardConfig>(dashboard);
  const [editor, setEditor] = useState<{ open: boolean; widget: WidgetConfig | null }>({ open: false, widget: null });
  const [bp, setBp] = useState('lg');
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number>();

  useEffect(() => { if (!editing) setDraft(dashboard); }, [dashboard, editing]);
  const dirty = editing && JSON.stringify(draft.widgets) !== JSON.stringify(dashboard.widgets);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  /** outside edit mode, small tweaks (range, legend) persist automatically */
  const persistSoon = useCallback((next: DashboardConfig) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { if (canWrite) onSave(next); }, 600);
  }, [onSave, canWrite]);

  const update = (fn: (d: DashboardConfig) => DashboardConfig, persist = !editing) => {
    setDraft((d) => { const n = fn(d); if (persist) persistSoon(n); return n; });
  };
  const patchWidget = (id: string, fn: (w: WidgetConfig) => WidgetConfig) => update((d) => ({ ...d, widgets: d.widgets.map((w) => (w.id === id ? fn(w) : w)) }));

  const layouts = useMemo(() => ({
    lg: draft.widgets.map((w) => {
      const def = widgetRegistry.get(w.type);
      return { i: w.id, ...w.layout, minW: def?.minSize.w ?? 2, minH: def?.minSize.h ?? 2 };
    }),
  }), [draft.widgets]);

  const onLayoutChange = (current: Layout[]) => {
    if (!editing || bp !== 'lg') return;
    setDraft((d) => ({ ...d, widgets: d.widgets.map((w) => { const l = current.find((x) => x.i === w.id); return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w; }) }));
  };

  const save = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); } finally { setSaving(false); }
  };
  const cancel = () => { setDraft(dashboard); setEditing(false); };

  const upsertWidget = (w: WidgetConfig) => {
    update((d) => {
      const exists = d.widgets.some((x) => x.id === w.id);
      if (exists) return { ...d, widgets: d.widgets.map((x) => (x.id === w.id ? w : x)) };
      return { ...d, widgets: [...d.widgets, { ...w, layout: { ...w.layout, x: 0, y: nextFreeY(d.widgets) } }] };
    });
    setEditor({ open: false, widget: null });
  };

  const refreshAll = () => { queryClient.invalidate('metric'); queryClient.invalidate('nodes'); queryClient.invalidate('events'); queryClient.invalidate('plugins'); };

  return (
    <div className={editing ? 'editing' : ''}>
      <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
        <Segmented value={draft.range} onChange={(r) => update((d) => ({ ...d, range: r }))} options={RANGES.map((r) => ({ value: r, label: r }))} />
        <select className="select" style={{ width: 120 }} value={draft.refreshSec} onChange={(e) => update((d) => ({ ...d, refreshSec: Number(e.target.value) }))} title={tr("dashboards.DashboardView.s_6fcdbbe8f7")}>
          <option value={0}>{tr("dashboards.DashboardView.s_4311c78bc2")}</option><option value={15}>{tr("dashboards.DashboardView.s_389a059cde")}</option><option value={30}>{tr("dashboards.DashboardView.s_566a88d6b7")}</option><option value={60}>{tr("dashboards.DashboardView.s_d677974a70")}</option><option value={300}>{tr("dashboards.DashboardView.s_6c85158f53")}</option>
        </select>
        <Button iconOnly variant="ghost" onClick={refreshAll} title={tr("dashboards.DashboardView.s_2b2dff43bf")}><RefreshCw size={14} /></Button>
        {headerExtra}
        <span className="spacer" />
        {editing ? (
          <>
            {dirty && <span className="muted" style={{ fontSize: 12 }}>{tr("dashboards.DashboardView.s_30583d6c81")}</span>}
            <Button icon={<Plus size={14} />} onClick={() => setEditor({ open: true, widget: null })}>{tr("dashboards.DashboardView.s_92a5d7dc45")}</Button>
            <Button variant="ghost" icon={<X size={14} />} onClick={cancel}>{tr("dashboards.DashboardView.s_0ec753be8d")}</Button>
            <Button variant="primary" icon={<Check size={14} />} loading={saving} onClick={save}>{tr("dashboards.DashboardView.s_4864057d62")}</Button>
          </>
        ) : (
          <>
            <Button icon={<Plus size={14} />} perm="dashboards.write" disabled={!editable} onClick={() => { setEditing(true); setEditor({ open: true, widget: null }); }}>{tr("dashboards.DashboardView.s_92a5d7dc45")}</Button>
            <Button icon={<Pencil size={14} />} perm="dashboards.write" disabled={!editable} onClick={() => setEditing(true)}>{tr("dashboards.DashboardView.s_b1aa6fccbe")}</Button>
          </>
        )}
      </div>

      {plugins.data?.filter(p => draft.widgets.some(w => w.source.kind === 'metric' && w.source.pluginId === p.manifest.id)).flatMap(p => (p.instance.notices ?? []).map(n => <div key={p.manifest.id+n.id} className={`banner ${n.severity}`} role="status" style={{marginBottom:12}}>{p.manifest.name}{': '}{n.localizations?.[language] ?? n.message}</div>))}
      {draft.widgets.length === 0 ? (
        <div className="panel"><Empty icon={<LayoutGrid size={18} />} title={tr("dashboards.DashboardView.s_a9565abd8b")} action={canWrite && <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditing(true); setEditor({ open: true, widget: null }); }}>{tr("dashboards.DashboardView.s_f574ac76be")}</Button>}>
          {tr("dashboards.DashboardView.s_2f714fc777")}</Empty></div>
      ) : (
        <Grid
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1100, md: 760, sm: 0 }}
          cols={{ lg: 12, md: 6, sm: 1 }}
          rowHeight={30}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          isDraggable={editing && bp === 'lg'}
          isResizable={editing && bp === 'lg'}
          draggableHandle=".drag-handle"
          draggableCancel="button, input, textarea, select, a"
          onLayoutChange={onLayoutChange}
          onBreakpointChange={setBp}
          compactType="vertical"
          useCSSTransforms
        >
          {draft.widgets.map((w) => (
            <div key={w.id}>
              <WidgetFrame
                config={w} plugins={plugins.data} range={draft.range} refreshSec={draft.refreshSec} editing={editing}
                selected={editor.open && editor.widget?.id === w.id}
                onEdit={() => setEditor({ open: true, widget: w })}
                onRemove={() => update((d) => ({ ...d, widgets: d.widgets.filter((x) => x.id !== w.id) }))}
                onDuplicate={() => update((d) => ({ ...d, widgets: [...d.widgets, { ...structuredClone(w), id: uid('w'), layout: { ...w.layout, y: nextFreeY(d.widgets) } }] }))}
                onDisplay={(patch: Partial<WidgetDisplay>) => patchWidget(w.id, (x) => ({ ...x, display: { ...x.display, ...patch } }))}
                onReplaceType={(type) => patchWidget(w.id, (x) => ({ ...x, type, typeVersion: widgetRegistry.get(type)?.version ?? '1.0.0' }))}
              />
            </div>
          ))}
        </Grid>
      )}
      {editing && bp !== 'lg' && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{tr("dashboards.DashboardView.s_148510f5a2")}</div>}

      <WidgetEditor open={editor.open} initial={editor.widget} plugins={plugins.data} range={draft.range} onClose={() => setEditor({ open: false, widget: null })} onSave={upsertWidget} />
    </div>
  );
}
