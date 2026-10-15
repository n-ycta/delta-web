import { tr } from '@/i18n';
import { BUCKET_INTERVALS } from '@/widgets/intervals';
import { useEffect, useMemo, useState } from 'react';
import type { MetricDescriptor, PluginEntry, TimeRangePreset, WidgetConfig, WidgetDisplay } from '@/core/contracts';
import { PRESET_LABEL } from '@/core/contracts';
import { widgetRegistry, SYSTEM_FEEDS } from '@/widgets/registry';
import { isInstalled } from '@/core/registry/plugins';
import { widgetForMetric } from '@/core/registry/autodash';
import { Drawer } from '@/ui/overlays';
import { Button, Field, Segmented, Switch, Tabs } from '@/ui/primitives';
import { Icon } from '@/ui/Icon';
import { PALETTES, useChartColors } from '@/app/theme';
import { uid } from '@/core/lib/random';
import { WidgetFrame } from './WidgetFrame';

const KIND_LABEL: Record<string, string> = { gauge: tr("dashboards.WidgetEditor.s_2a8f0e1c88"), counter: tr("dashboards.WidgetEditor.s_9ce97be16c"), ratio: tr("dashboards.WidgetEditor.s_1c9bc474b9"), duration: tr("dashboards.WidgetEditor.s_77a319bd46"), distribution: tr("dashboards.WidgetEditor.s_82e2d33ad3"), categorical: tr("dashboards.WidgetEditor.s_7a05b0b6a0"), event: tr("dashboards.WidgetEditor.s_fbbef3924e") };

export function WidgetEditor({ open, initial, plugins, range, onClose, onSave }: {
  open: boolean; initial: WidgetConfig | null; plugins: PluginEntry[] | undefined; range: TimeRangePreset;
  onClose: () => void; onSave: (w: WidgetConfig) => void;
}) {
  const [cfg, setCfg] = useState<WidgetConfig | null>(initial);
  const [tab, setTab] = useState<'source' | 'viz' | 'style'>('source');
  useEffect(() => { setCfg(initial); setTab(initial ? 'viz' : 'source'); }, [initial, open]);
  const installed = (plugins ?? []).filter((p) => isInstalled(p) && p.validation.compatible && p.manifest.metrics.length);
  const src = cfg?.source;
  const plugin = src?.kind === 'metric' ? plugins?.find((p) => p.manifest.id === src.pluginId) : undefined;
  const metric = src?.kind === 'metric' ? plugin?.manifest.metrics.find((m) => m.id === src.metricId) : undefined;
  const def = cfg ? widgetRegistry.get(cfg.type) : undefined;
  const ranked = useMemo(() => (metric ? widgetRegistry.rank(metric) : []), [metric]);
  const colors = useChartColors(cfg?.display.palette);

  const pickMetric = (p: PluginEntry, m: MetricDescriptor) => {
    const w = widgetForMetric(widgetRegistry, p.manifest.id, m);
    const { size, ...rest } = w;
    setCfg((prev) => ({ ...rest, id: prev?.id ?? rest.id, title: undefined, layout: prev?.layout ?? { x: 0, y: 9999, ...size } }));
  };
  const pickSystem = (type: string) => {
    const d = widgetRegistry.get(type)!;
    setCfg((prev) => ({ id: prev?.id ?? uid('w'), type, typeVersion: d.version, source: { kind: 'system', feed: SYSTEM_FEEDS[type] }, display: {}, layout: prev?.layout ?? { x: 0, y: 9999, ...d.defaultSize } }));
  };
  const setDisplay = (patch: Partial<WidgetDisplay>) => setCfg((c) => (c ? { ...c, display: { ...c.display, ...patch } } : c));
  const setSource = (patch: Record<string, unknown>) => setCfg((c) => (c && c.source.kind === 'metric' ? { ...c, source: { ...c.source, ...patch } } : c));
  const setType = (type: string) => setCfg((c) => {
    if (!c) return c;
    const d = widgetRegistry.get(type)!;
    return { ...c, type, typeVersion: d.version, display: { ...d.defaultDisplay?.(metric), ...c.display, chart: d.defaultDisplay?.(metric)?.chart ?? c.display.chart } };
  });

  const opts = new Set(def?.options ?? []);
  const seriesKeys = metric ? (src?.kind === 'metric' && src.groupBy ? metric.dimensions.find((d) => d.id === src.groupBy)?.values?.map((v) => ({ key: v.id, label: v.label })) ?? [] : [{ key: 'value', label: metric.label }]) : [];

  return (
    <Drawer open={open} onClose={onClose} wide title={initial ? tr("dashboards.WidgetEditor.s_809b6edf27") : tr("dashboards.WidgetEditor.s_fba03061ed")} sub={def ? `${def.label} · v${def.version}` : tr("dashboards.WidgetEditor.s_cc6a1a1bdf")}
      footer={<><span className="muted grow" style={{ fontSize: 12 }}>{metric ? `${plugin?.manifest.id} / ${metric.id}` : ''}</span><Button variant="ghost" onClick={onClose}>{tr("dashboards.WidgetEditor.s_0ec753be8d")}</Button><Button variant="primary" disabled={!cfg} onClick={() => cfg && onSave(cfg)}>{initial ? tr("dashboards.WidgetEditor.s_768af67762") : tr("dashboards.WidgetEditor.s_559a87f7cc")}</Button></>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'source', label: tr("dashboards.WidgetEditor.s_dac966853e") }, { id: 'viz', label: tr("dashboards.WidgetEditor.s_fa562472a3") }, { id: 'style', label: tr("dashboards.WidgetEditor.s_ce6b4ba5bf") }]} />

      {tab === 'source' && (
        <div className="col gap-4">
          <div className="label">{tr("dashboards.WidgetEditor.s_0d846d47b3")}</div>
          {installed.length === 0 && <div className="muted">{tr("dashboards.WidgetEditor.s_8095b4c7d7")}</div>}
          {installed.map((p) => (
            <div key={p.manifest.id} className="panel">
              <div className="panel-head" style={{ minHeight: 36, padding: '6px 12px' }}><Icon name={p.manifest.icon} size={14} /><span className="panel-title">{p.manifest.name}</span><span className="widget-meta">{p.manifest.id}{tr("dashboards.WidgetEditor.s_9a78211436")}{p.manifest.version}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6, padding: 8 }}>
                {p.manifest.metrics.map((m) => {
                  const sel = src?.kind === 'metric' && src.pluginId === p.manifest.id && src.metricId === m.id;
                  return (
                    <button key={m.id} className="viz-option" aria-pressed={sel} onClick={() => pickMetric(p, m)}>
                      <span className="col" style={{ gap: 0, minWidth: 0 }}>
                        <span className="truncate" style={{ fontWeight: 500 }}>{m.label}</span>
                        <span className="muted mono" style={{ fontSize: 10.5 }}>{KIND_LABEL[m.kind]}{m.unit ? ` · ${m.unit}` : ''}{m.dimensions.length ? ` · ${m.dimensions.map((d) => d.id).join(',')}` : ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="label" style={{ marginTop: 6 }}>{tr("dashboards.WidgetEditor.s_fb4d324eca")}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
            {widgetRegistry.all('system').map((d) => (
              <button key={d.type} className="viz-option" aria-pressed={cfg?.type === d.type} onClick={() => pickSystem(d.type)}>
                <Icon name={d.icon} size={15} className="muted" />
                <span className="col" style={{ gap: 0, minWidth: 0 }}><span style={{ fontWeight: 500 }}>{d.label}</span><span className="muted" style={{ fontSize: 11 }}>{d.description}</span></span>
              </button>
            ))}
          </div>
          {metric && src?.kind === 'metric' && (
            <div className="panel"><div className="panel-body form-grid">
              <Field label={tr("dashboards.WidgetEditor.s_8d426d8fd0")}><select className="select" value={src.aggregation ?? ''} onChange={(e) => setSource({ aggregation: e.target.value })}>{metric.aggregations.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
              <Field label={tr("dashboards.WidgetEditor.s_eddce20420")} help={tr("dashboards.WidgetEditor.s_a4bf95f5ec")}>
                <select className="select" value={src.groupBy ?? ''} onChange={(e) => setSource({ groupBy: e.target.value || undefined })}>
                  <option value="">{tr("dashboards.WidgetEditor.s_049f703b1a")}</option>
                  {metric.dimensions.filter((d) => d.values?.length).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </Field>
              {metric.dimensions.filter((d) => d.values?.length).map((d) => (
                <Field key={d.id} label={tr("dashboards.WidgetEditor.s_f1e10191f1", { p0: (d.label) })} help={tr("dashboards.WidgetEditor.s_a2d8896472")}>
                  <div className="row wrap gap-1">
                    {d.values!.map((v) => {
                      const on = src.filters?.[d.id]?.includes(v.id) ?? false;
                      return <button key={v.id} type="button" className="chip" aria-pressed={on} onClick={() => {
                        const cur = src.filters?.[d.id] ?? [];
                        const next = on ? cur.filter((x) => x !== v.id) : [...cur, v.id];
                        setSource({ filters: { ...(src.filters ?? {}), [d.id]: next } });
                      }}>{v.label}</button>;
                    })}
                  </div>
                </Field>
              ))}
            </div></div>
          )}
        </div>
      )}

      {tab === 'viz' && (
        <div className="col gap-3">
          {!metric && cfg?.source.kind !== 'system' && <div className="muted">{tr("dashboards.WidgetEditor.s_5060163440")}</div>}
          {metric && (
            <>
              <div className="muted" style={{ fontSize: 12 }}>{tr("dashboards.WidgetEditor.s_d0aed14458")}<code>{metric.kind}</code>{tr("dashboards.WidgetEditor.s_94c67da09e")}<span className="badge accent">{tr("dashboards.WidgetEditor.s_734c3c67db")}</span> {tr("dashboards.WidgetEditor.s_dd00ccd707")}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
                {ranked.map(({ def: d, score, reason, hinted }) => (
                  <button key={d.type} className="viz-option" disabled={score === 0} aria-pressed={cfg?.type === d.type} onClick={() => setType(d.type)} title={reason}>
                    <Icon name={d.icon} size={16} className="muted" />
                    <span className="col" style={{ gap: 0, minWidth: 0 }}>
                      <span className="row" style={{ gap: 6 }}><span style={{ fontWeight: 500 }}>{d.label}</span>{hinted && <span className="badge accent" style={{ height: 16, fontSize: 10 }}>{tr("dashboards.WidgetEditor.s_734c3c67db")}</span>}</span>
                      <span className="muted" style={{ fontSize: 11 }}>{score === 0 ? reason : d.description}</span>
                    </span>
                    <span className="score">{score}</span>
                  </button>
                ))}
              </div>
              {metric.visualizations.filter((v) => !widgetRegistry.get(v)).length > 0 && (
                <div className="banner warn" style={{ borderRadius: 6, border: 0 }}>{tr("dashboards.WidgetEditor.s_ef20bca5e9")}{metric.visualizations.filter((v) => !widgetRegistry.get(v)).map((v) => <code key={v}>{v}</code>)} {tr("dashboards.WidgetEditor.s_e0952d8230")}</div>
              )}
            </>
          )}
          {cfg?.source.kind === 'system' && <div className="muted">{tr("dashboards.WidgetEditor.s_1523cfb0df")}{def?.label}{tr("dashboards.WidgetEditor.s_a96245a429")}</div>}
        </div>
      )}

      {tab === 'style' && cfg && (
        <div className="col gap-4">
          <Field label={tr("dashboards.WidgetEditor.s_a8504d513a")}><input className="input" value={cfg.title ?? ''} placeholder={metric?.label ?? def?.label} onChange={(e) => setCfg({ ...cfg, title: e.target.value || undefined })} /></Field>
          <div className="form-grid">
            {opts.has('chart') && <Field label={tr('runtime.chartPresentation')}><select className="select" aria-label={tr('runtime.chartPresentation')} value={cfg.display.chart ?? 'line'} onChange={(e) => setDisplay({ chart: e.target.value as WidgetDisplay['chart'] })}>{['line', 'dots', 'area', 'bar', 'step'].map(value => <option key={value} value={value}>{tr('runtime.chart_' + value)}</option>)}</select></Field>}
            {opts.has('interval') && <Field label={tr('runtime.bucketInterval')} help={tr('runtime.bucketHelp')}><select className="select" aria-label={tr('runtime.bucketInterval')} value={cfg.display.stepMs ?? ''} onChange={(e) => setDisplay({ stepMs: e.target.value ? Number(e.target.value) : null })}><option value="">{tr('runtime.bucketAuto')}</option>{BUCKET_INTERVALS.map(step => <option key={step} value={step}>{tr('runtime.bucket_' + step)}</option>)}</select></Field>}
            {opts.has('range') && <Field label={tr("dashboards.WidgetEditor.s_b2822e2bb3")} help={tr("dashboards.WidgetEditor.s_51b54d27dd")}><select className="select" value={cfg.display.rangeOverride ?? ''} onChange={(e) => setDisplay({ rangeOverride: (e.target.value || null) as TimeRangePreset | null })}><option value="">{tr("dashboards.WidgetEditor.s_23c96767b1")}{range}{tr("dashboards.WidgetEditor.s_e7064f0b80")}</option>{Object.entries(PRESET_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
            {opts.has('decimals') && <Field label={tr("dashboards.WidgetEditor.s_7fe4f68eb7")}><input className="input" type="number" min={0} max={4} value={cfg.display.decimals ?? metric?.precision ?? 1} onChange={(e) => setDisplay({ decimals: Number(e.target.value) })} /></Field>}
            {opts.has('limit') && <Field label={tr("dashboards.WidgetEditor.s_b0b9499ef3")}><input className="input" type="number" min={1} max={50} value={cfg.display.limit ?? 8} onChange={(e) => setDisplay({ limit: Number(e.target.value) })} /></Field>}
            {opts.has('yRange') && <Field label={tr("dashboards.WidgetEditor.s_b9725a52cd")}><div className="row"><input className="input" type="number" placeholder={tr("dashboards.WidgetEditor.s_2e68453ceb")} value={cfg.display.yMin ?? ''} onChange={(e) => setDisplay({ yMin: e.target.value === '' ? null : Number(e.target.value) })} /><input className="input" type="number" placeholder={tr("dashboards.WidgetEditor.s_2e68453ceb")} value={cfg.display.yMax ?? ''} onChange={(e) => setDisplay({ yMax: e.target.value === '' ? null : Number(e.target.value) })} /></div></Field>}
          </div>
          <div className="col" style={{ gap: 10 }}>
            {opts.has('chart') && cfg.display.chart !== 'dots' && cfg.display.chart !== 'bar' && <Field label={tr('runtime.connectObservations')} help={tr('runtime.connectHelp')}><Switch label={tr('runtime.connectObservations')} checked={cfg.display.connectNulls ?? true} onChange={(connectNulls) => setDisplay({ connectNulls })} /></Field>}
            {opts.has('compare') && <label className="row"><Switch checked={!!cfg.display.compare} onChange={(v) => setDisplay({ compare: v })} />{tr("dashboards.WidgetEditor.s_5e51dbcc85")}</label>}
            {opts.has('stacked') && <label className="row"><Switch checked={!!cfg.display.stacked} onChange={(v) => setDisplay({ stacked: v })} />{tr("dashboards.WidgetEditor.s_71e09c1ad6")}</label>}
            {opts.has('legend') && <label className="row"><Switch checked={cfg.display.showLegend ?? true} onChange={(v) => setDisplay({ showLegend: v })} />{tr("dashboards.WidgetEditor.s_e1ac2fb4d2")}</label>}
            {opts.has('grid') && <label className="row"><Switch checked={cfg.display.showGrid ?? true} onChange={(v) => setDisplay({ showGrid: v })} />{tr("dashboards.WidgetEditor.s_c9244e3a0b")}</label>}
            {opts.has('thresholds') && metric?.thresholds?.length ? <label className="row"><Switch checked={cfg.display.showThresholds ?? true} onChange={(v) => setDisplay({ showThresholds: v })} />{tr("dashboards.WidgetEditor.s_e5b379b524")}{metric.thresholds.map((t) => t.value).join(', ')}{tr("dashboards.WidgetEditor.s_e7064f0b80")}</label> : null}
          </div>
          {opts.has('colors') && (
            <div className="col gap-3">
              <Field label={tr("dashboards.WidgetEditor.s_7d4c797c67")}><Segmented sans value={cfg.display.palette ?? ''} onChange={(v) => setDisplay({ palette: v || undefined })} options={[{ value: '', label: tr("dashboards.WidgetEditor.s_afeb19400d") }, ...Object.entries(PALETTES).map(([k, p]) => ({ value: k, label: p.label }))]} /></Field>
              {seriesKeys.map((s, i) => (
                <div key={s.key} className="row" style={{ gap: 10 }}>
                  <span style={{ width: 120 }} className="truncate">{s.label}</span>
                  <div className="swatches">
                    {colors.series.map((col) => <button key={col} style={{ background: col }} aria-pressed={(cfg.display.colors?.[s.key] ?? colors.series[i % colors.series.length]) === col} onClick={() => setDisplay({ colors: { ...(cfg.display.colors ?? {}), [s.key]: col } })} aria-label={col} />)}
                  </div>
                  <input type="color" value={cfg.display.colors?.[s.key] ?? colors.series[i % colors.series.length]} onChange={(e) => setDisplay({ colors: { ...(cfg.display.colors ?? {}), [s.key]: e.target.value } })} style={{ width: 28, height: 22, border: 0, background: 'none', padding: 0 }} />
                  {cfg.display.colors?.[s.key] && <Button size="sm" variant="ghost" onClick={() => { const c = { ...(cfg.display.colors ?? {}) }; delete c[s.key]; setDisplay({ colors: c }); }}>{tr("dashboards.WidgetEditor.s_65f7c13713")}</Button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cfg && (
        <div style={{ marginTop: 20 }}>
          <div className="label" style={{ marginBottom: 6 }}>{tr("dashboards.WidgetEditor.s_5d092ca855")}</div>
          <div style={{ height: 260 }}>
            <WidgetFrame config={cfg} plugins={plugins} range={range} refreshSec={0} editing={false} onEdit={() => setTab('source')} onRemove={() => {}} onDuplicate={() => {}} onDisplay={setDisplay} onReplaceType={setType} />
          </div>
        </div>
      )}
    </Drawer>
  );
}
