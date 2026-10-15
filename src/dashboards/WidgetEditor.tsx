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

const KIND_LABEL: Record<string, string> = { gauge: 'величина', counter: 'счётчик', ratio: 'доля', duration: 'длительность', distribution: 'распределение', categorical: 'категории', event: 'события' };

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
    <Drawer open={open} onClose={onClose} wide title={initial ? 'Настройка виджета' : 'Новый виджет'} sub={def ? `${def.label} · v${def.version}` : 'Выберите источник данных'}
      footer={<><span className="muted grow" style={{ fontSize: 12 }}>{metric ? `${plugin?.manifest.id} / ${metric.id}` : ''}</span><Button variant="ghost" onClick={onClose}>Отмена</Button><Button variant="primary" disabled={!cfg} onClick={() => cfg && onSave(cfg)}>{initial ? 'Применить' : 'Добавить'}</Button></>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'source', label: '1 · Источник' }, { id: 'viz', label: '2 · Визуализация' }, { id: 'style', label: '3 · Отображение' }]} />

      {tab === 'source' && (
        <div className="col gap-4">
          <div className="label">Метрики плагинов</div>
          {installed.length === 0 && <div className="muted">Нет установленных плагинов с метриками.</div>}
          {installed.map((p) => (
            <div key={p.manifest.id} className="panel">
              <div className="panel-head" style={{ minHeight: 36, padding: '6px 12px' }}><Icon name={p.manifest.icon} size={14} /><span className="panel-title">{p.manifest.name}</span><span className="widget-meta">{p.manifest.id}@{p.manifest.version}</span></div>
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
          <div className="label" style={{ marginTop: 6 }}>Системные</div>
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
              <Field label="Агрегация"><select className="select" value={src.aggregation ?? ''} onChange={(e) => setSource({ aggregation: e.target.value })}>{metric.aggregations.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
              <Field label="Разбивка" help="Отдельная серия на каждое значение измерения">
                <select className="select" value={src.groupBy ?? ''} onChange={(e) => setSource({ groupBy: e.target.value || undefined })}>
                  <option value="">— без разбивки —</option>
                  {metric.dimensions.filter((d) => d.values?.length).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </Field>
              {metric.dimensions.filter((d) => d.values?.length).map((d) => (
                <Field key={d.id} label={`Фильтр: ${d.label}`} help="Пусто — все значения">
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
          {!metric && cfg?.source.kind !== 'system' && <div className="muted">Сначала выберите метрику.</div>}
          {metric && (
            <>
              <div className="muted" style={{ fontSize: 12 }}>Типы отсортированы по совместимости с контрактом метрики <code>{metric.kind}</code>. <span className="badge accent">hint</span> — рекомендация плагина.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
                {ranked.map(({ def: d, score, reason, hinted }) => (
                  <button key={d.type} className="viz-option" disabled={score === 0} aria-pressed={cfg?.type === d.type} onClick={() => setType(d.type)} title={reason}>
                    <Icon name={d.icon} size={16} className="muted" />
                    <span className="col" style={{ gap: 0, minWidth: 0 }}>
                      <span className="row" style={{ gap: 6 }}><span style={{ fontWeight: 500 }}>{d.label}</span>{hinted && <span className="badge accent" style={{ height: 16, fontSize: 10 }}>hint</span>}</span>
                      <span className="muted" style={{ fontSize: 11 }}>{score === 0 ? reason : d.description}</span>
                    </span>
                    <span className="score">{score}</span>
                  </button>
                ))}
              </div>
              {metric.visualizations.filter((v) => !widgetRegistry.get(v)).length > 0 && (
                <div className="banner warn" style={{ borderRadius: 6, border: 0 }}>Плагин предлагает неизвестные визуализации: {metric.visualizations.filter((v) => !widgetRegistry.get(v)).map((v) => <code key={v}>{v}</code>)} — использованы ближайшие доступные.</div>
              )}
            </>
          )}
          {cfg?.source.kind === 'system' && <div className="muted">Системный виджет «{def?.label}» не требует выбора визуализации.</div>}
        </div>
      )}

      {tab === 'style' && cfg && (
        <div className="col gap-4">
          <Field label="Заголовок"><input className="input" value={cfg.title ?? ''} placeholder={metric?.label ?? def?.label} onChange={(e) => setCfg({ ...cfg, title: e.target.value || undefined })} /></Field>
          <div className="form-grid">
            {opts.has('chart') && <Field label="Форма"><Segmented sans value={cfg.display.chart ?? 'line'} onChange={(v) => setDisplay({ chart: v })} options={[{ value: 'line', label: 'Линия' }, { value: 'area', label: 'Область' }, { value: 'bar', label: 'Столбцы' }, { value: 'step', label: 'Ступени' }]} /></Field>}
            {opts.has('range') && <Field label="Период" help="Пусто — как у дашборда"><select className="select" value={cfg.display.rangeOverride ?? ''} onChange={(e) => setDisplay({ rangeOverride: (e.target.value || null) as TimeRangePreset | null })}><option value="">как у дашборда ({range})</option>{Object.entries(PRESET_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
            {opts.has('decimals') && <Field label="Знаков после запятой"><input className="input" type="number" min={0} max={4} value={cfg.display.decimals ?? metric?.precision ?? 1} onChange={(e) => setDisplay({ decimals: Number(e.target.value) })} /></Field>}
            {opts.has('limit') && <Field label="Лимит элементов"><input className="input" type="number" min={1} max={50} value={cfg.display.limit ?? 8} onChange={(e) => setDisplay({ limit: Number(e.target.value) })} /></Field>}
            {opts.has('yRange') && <Field label="Ось Y: мин / макс"><div className="row"><input className="input" type="number" placeholder="авто" value={cfg.display.yMin ?? ''} onChange={(e) => setDisplay({ yMin: e.target.value === '' ? null : Number(e.target.value) })} /><input className="input" type="number" placeholder="авто" value={cfg.display.yMax ?? ''} onChange={(e) => setDisplay({ yMax: e.target.value === '' ? null : Number(e.target.value) })} /></div></Field>}
          </div>
          <div className="col" style={{ gap: 10 }}>
            {opts.has('compare') && <label className="row"><Switch checked={!!cfg.display.compare} onChange={(v) => setDisplay({ compare: v })} />Сравнить с предыдущим периодом</label>}
            {opts.has('stacked') && <label className="row"><Switch checked={!!cfg.display.stacked} onChange={(v) => setDisplay({ stacked: v })} />Накопление серий</label>}
            {opts.has('legend') && <label className="row"><Switch checked={cfg.display.showLegend ?? true} onChange={(v) => setDisplay({ showLegend: v })} />Легенда</label>}
            {opts.has('grid') && <label className="row"><Switch checked={cfg.display.showGrid ?? true} onChange={(v) => setDisplay({ showGrid: v })} />Сетка</label>}
            {opts.has('thresholds') && metric?.thresholds?.length ? <label className="row"><Switch checked={cfg.display.showThresholds ?? true} onChange={(v) => setDisplay({ showThresholds: v })} />Пороги из контракта ({metric.thresholds.map((t) => t.value).join(', ')})</label> : null}
          </div>
          {opts.has('colors') && (
            <div className="col gap-3">
              <Field label="Палитра"><Segmented sans value={cfg.display.palette ?? ''} onChange={(v) => setDisplay({ palette: v || undefined })} options={[{ value: '', label: 'Системная' }, ...Object.entries(PALETTES).map(([k, p]) => ({ value: k, label: p.label }))]} /></Field>
              {seriesKeys.map((s, i) => (
                <div key={s.key} className="row" style={{ gap: 10 }}>
                  <span style={{ width: 120 }} className="truncate">{s.label}</span>
                  <div className="swatches">
                    {colors.series.map((col) => <button key={col} style={{ background: col }} aria-pressed={(cfg.display.colors?.[s.key] ?? colors.series[i % colors.series.length]) === col} onClick={() => setDisplay({ colors: { ...(cfg.display.colors ?? {}), [s.key]: col } })} aria-label={col} />)}
                  </div>
                  <input type="color" value={cfg.display.colors?.[s.key] ?? colors.series[i % colors.series.length]} onChange={(e) => setDisplay({ colors: { ...(cfg.display.colors ?? {}), [s.key]: e.target.value } })} style={{ width: 28, height: 22, border: 0, background: 'none', padding: 0 }} />
                  {cfg.display.colors?.[s.key] && <Button size="sm" variant="ghost" onClick={() => { const c = { ...(cfg.display.colors ?? {}) }; delete c[s.key]; setDisplay({ colors: c }); }}>сброс</Button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cfg && (
        <div style={{ marginTop: 20 }}>
          <div className="label" style={{ marginBottom: 6 }}>Предпросмотр</div>
          <div style={{ height: 260 }}>
            <WidgetFrame config={cfg} plugins={plugins} range={range} refreshSec={0} editing={false} onEdit={() => setTab('source')} onRemove={() => {}} onDuplicate={() => {}} onDisplay={setDisplay} onReplaceType={setType} />
          </div>
        </div>
      )}
    </Drawer>
  );
}
