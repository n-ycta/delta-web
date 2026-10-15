import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, FlaskConical, PlugZap, RotateCcw, Upload } from 'lucide-react';
import { useApi } from '@/app/ApiContext';
import { useDashboards, usePlugins } from '@/app/data';
import { queryClient, useQuery } from '@/app/query';
import { toast, useCan, usePrefs, type Density, type Theme } from '@/app/stores';
import { PALETTES, useResolvedTheme } from '@/app/theme';
import { createCoreApi, readConnectionSettings, toApiError, writeConnectionSettings, type ConnectionSettings, type CoreInfo } from '@/api';
import { MockCoreAdapter, resetMockDatabase, type MockControl } from '@/api/mock/MockCoreAdapter';
import { CONFIG_EXPORT_FORMAT, ConfigBundle, PANEL_CONTRACT_VERSION, type DashboardConfig } from '@/core/contracts';
import { fmtDateTime, fmtDuration, plural } from '@/core/lib/format';
import { Badge, Button, Field, PageHead, Panel, Segmented, Switch, Tabs } from '@/ui/primitives';
import { Confirm } from '@/ui/overlays';
import { ErrorState, Skeleton } from '@/ui/states';
import { downloadJson } from '@/dashboards/useDashboardActions';
import { widgetRegistry } from '@/widgets/registry';

type Tab = 'general' | 'connection' | 'backup' | 'developer';
const PREF_KEYS = ['theme', 'density', 'palette', 'hour12', 'homeStrip', 'sidebarCollapsed'] as const;

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'general';
  const api = useApi();
  return (
    <div className="page">
      <PageHead title="Настройки" sub="Параметры консоли, подключение к ядру и резервные копии конфигурации." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'general', label: 'Интерфейс' }, { id: 'connection', label: 'Подключение к ядру' }, { id: 'backup', label: 'Импорт и экспорт' },
        ...(api instanceof MockCoreAdapter ? [{ id: 'developer' as const, label: 'Симуляция' }] : []),
      ]} />
      <div style={{ maxWidth: 1040 }}>
      {tab === 'general' && <General />}
      {tab === 'connection' && <Connection />}
      {tab === 'backup' && <Backup />}
      {tab === 'developer' && api instanceof MockCoreAdapter && <Developer api={api} />}
      </div>
    </div>
  );
}

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return <div className="form-row"><div><div className="field-label">{label}</div>{help && <div className="field-help">{help}</div>}</div><div>{children}</div></div>;
}

function General() {
  const p = usePrefs();
  const resolved = useResolvedTheme();
  return (
    <Panel>
      <Row label="Тема" help={p.theme === 'system' ? `Сейчас: ${resolved === 'dark' ? 'тёмная' : 'светлая'} (по системе)` : undefined}>
        <Segmented sans value={p.theme} onChange={(v: Theme) => p.set({ theme: v })} options={[{ value: 'light', label: 'Светлая' }, { value: 'dark', label: 'Тёмная' }, { value: 'system', label: 'Как в системе' }]} />
      </Row>
      <Row label="Плотность" help="Компактный режим — больше строк в таблицах и журналах">
        <Segmented sans value={p.density} onChange={(v: Density) => p.set({ density: v })} options={[{ value: 'comfortable', label: 'Обычная' }, { value: 'compact', label: 'Компактная' }]} />
      </Row>
      <Row label="Палитра графиков" help="Применяется к виджетам без явно заданных цветов">
        <div className="col gap-2">
          {Object.entries(PALETTES).map(([k, pal]) => (
            <button key={k} className="viz-option" style={{ width: 360 }} aria-pressed={p.palette === k} onClick={() => p.set({ palette: k })}>
              <span style={{ width: 80 }}>{pal.label}</span>
              <span className="row gap-1">{(resolved === 'dark' ? pal.dark : pal.light).map((c) => <span key={c} style={{ width: 16, height: 16, borderRadius: 3, background: c }} />)}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row label="Формат времени"><Segmented value={p.hour12 ? '12' : '24'} onChange={(v) => p.set({ hour12: v === '12' })} options={[{ value: '24', label: '24 ч' }, { value: '12', label: '12 ч' }]} /></Row>
      <Row label="Сводка на главной" help="Строка ключевых показателей над домашним дашбордом"><Switch checked={p.homeStrip} onChange={(v) => p.set({ homeStrip: v })} /></Row>
      <Row label="Боковая панель"><Switch checked={!p.sidebarCollapsed} onChange={(v) => p.set({ sidebarCollapsed: !v })} label="Развёрнута" /></Row>
    </Panel>
  );
}

function Connection() {
  const api = useApi();
  const canConfig = useCan('system.config');
  const current = readConnectionSettings();
  const [draft, setDraft] = useState<ConnectionSettings>(current);
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'fail'; info?: CoreInfo; msg?: string; ms?: number }>({ state: 'idle' });
  const info = useQuery('core/info', (a) => a.info());
  const urlErr = draft.mode === 'http' && !/^https?:\/\/[^\s/]+/.test(draft.baseUrl) ? 'Ожидается http(s)://host[:port]/path' : undefined;
  const dirty = JSON.stringify(draft) !== JSON.stringify(current);
  const runTest = async () => {
    setTest({ state: 'running' });
    const t0 = performance.now();
    try { const i = await createCoreApi(draft).info(); setTest({ state: 'ok', info: i, ms: Math.round(performance.now() - t0) }); }
    catch (e) { const err = toApiError(e); setTest({ state: 'fail', msg: `${err.code}: ${err.message}${err.hint ? ` — ${err.hint}` : ''}` }); }
  };
  const apply = () => { writeConnectionSettings(draft); queryClient.clear(); location.reload(); };
  return (
    <div className="col gap-4">
      <Panel title="Текущее подключение" meta={<Badge mono tone={api.mode === 'mock' ? 'accent' : 'info'}>{api.mode}</Badge>}>
        {info.loading ? <Skeleton h={60} /> : info.error ? <ErrorState compact error={info.error} onRetry={info.refetch} /> : info.data && (
          <dl className="kv">
            <dt>Ядро</dt><dd className="mono">{info.data.name}</dd>
            <dt>Версия ядра / API</dt><dd className="mono">{info.data.coreVersion} / {info.data.apiVersion}</dd>
            <dt>Контракт панели</dt><dd className="mono">{PANEL_CONTRACT_VERSION}</dd>
            <dt>Адрес</dt><dd className="mono">{api.endpoint}</dd>
            <dt>Работает</dt><dd>{fmtDuration((Date.now() - info.data.startedAt) / 1000)}</dd>
            {info.data.region && <><dt>Регион</dt><dd>{info.data.region}</dd></>}
            <dt>Возможности</dt><dd className="row wrap gap-1">{info.data.features.map((f) => <Badge key={f} mono outline>{f}</Badge>)}</dd>
          </dl>
        )}
      </Panel>
      <Panel title="Адаптер API">
        <Row label="Режим" help="Демо-режим работает полностью в браузере на синтетических данных">
          <Segmented sans value={draft.mode} onChange={(m) => setDraft({ ...draft, mode: m })} options={[{ value: 'mock', label: 'Демо (mock)' }, { value: 'http', label: 'Ядро Delta (HTTP)' }]} />
        </Row>
        {draft.mode === 'http' && <>
          <Row label="Базовый URL" help="REST-эндпоинт ядра; realtime подключается к /stream"><Field error={urlErr}><input className={`input mono ${urlErr ? 'invalid' : ''}`} value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://core.example.lan/api/v1" /></Field></Row>
          <Row label="Токен доступа" help="Bearer-токен. Хранится локально в этом браузере"><input className="input mono" type="password" autoComplete="off" value={draft.token ?? ''} onChange={(e) => setDraft({ ...draft, token: e.target.value || undefined })} placeholder="delta_pat_…" /></Row>
        </>}
        <div className="row" style={{ marginTop: 12 }}>
          {test.state === 'ok' && <span className="row" style={{ color: 'var(--ok)', fontSize: 12.5 }}><CheckCircle2 size={14} />{test.info?.name} · API {test.info?.apiVersion} · {test.ms} мс</span>}
          {test.state === 'fail' && <span className="row" style={{ color: 'var(--err)', fontSize: 12.5 }}><AlertTriangle size={14} />{test.msg}</span>}
          <span className="spacer" />
          <Button icon={<PlugZap size={14} />} loading={test.state === 'running'} disabled={!!urlErr} onClick={runTest}>Проверить</Button>
          <Button variant="primary" perm="system.config" disabled={!dirty || !!urlErr || !canConfig} onClick={apply} title={dirty ? 'Консоль перезагрузится с новым адаптером' : undefined}>Применить и перезагрузить</Button>
        </div>
      </Panel>
    </div>
  );
}

interface ImportPlan { bundle: ConfigBundle; dashNew: DashboardConfig[]; dashOverwrite: DashboardConfig[]; settingsApply: string[]; settingsSkip: string[]; prefKeys: string[]; warnings: string[] }

function Backup() {
  const api = useApi();
  const dashboards = useDashboards();
  const plugins = usePlugins();
  const prefs = usePrefs();
  const [incl, setIncl] = useState({ dashboards: true, settings: true, prefs: true });
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parseErr, setParseErr] = useState<string[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [sel, setSel] = useState({ dashboards: true, settings: true, prefs: true });

  const exportBundle = () => {
    const secretKeys = (pid: string) => new Set(plugins.data?.find((p) => p.manifest.id === pid)?.manifest.settings.filter((s) => s.type === 'secret').map((s) => s.key));
    const bundle: ConfigBundle = {
      format: CONFIG_EXPORT_FORMAT, formatVersion: 1, exportedAt: new Date().toISOString(),
      dashboards: incl.dashboards ? (dashboards.data ?? []).filter((d) => d.origin !== 'generated') : [],
      pluginSettings: incl.settings ? Object.fromEntries((plugins.data ?? []).filter((p) => p.instance.installedVersion).map((p) => { const sk = secretKeys(p.manifest.id); return [p.manifest.id, Object.fromEntries(Object.entries(p.instance.settings).filter(([k]) => !sk.has(k)))]; })) : {},
      preferences: incl.prefs ? Object.fromEntries(PREF_KEYS.map((k) => [k, prefs[k]])) : {},
    };
    downloadJson(`delta-config-${new Date().toISOString().slice(0, 10)}`, bundle);
    toast({ severity: 'success', title: 'Конфигурация экспортирована', body: 'Секретные поля плагинов не включаются в файл' });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setPlan(null); setParseErr(null);
    let raw: unknown;
    try { raw = JSON.parse(await f.text()); } catch { setParseErr(['Файл не является корректным JSON']); return; }
    const r = ConfigBundle.safeParse(raw);
    if (!r.success) { setParseErr(r.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(корень)'}: ${i.message}`)); return; }
    const b = r.data;
    const existing = new Map((dashboards.data ?? []).map((d) => [d.id, d]));
    const warnings: string[] = [];
    for (const d of b.dashboards) for (const w of d.widgets) if (!widgetRegistry.get(w.type)) warnings.push(`Дашборд «${d.name}»: тип виджета «${w.type}» не зарегистрирован — будет показан как неподдерживаемый`);
    const installed = new Set((plugins.data ?? []).filter((p) => p.instance.installedVersion).map((p) => p.manifest.id));
    setPlan({
      bundle: b,
      dashNew: b.dashboards.filter((d) => !existing.has(d.id)), dashOverwrite: b.dashboards.filter((d) => existing.has(d.id)),
      settingsApply: Object.keys(b.pluginSettings).filter((id) => installed.has(id)), settingsSkip: Object.keys(b.pluginSettings).filter((id) => !installed.has(id)),
      prefKeys: Object.keys(b.preferences).filter((k) => (PREF_KEYS as readonly string[]).includes(k)), warnings: warnings.slice(0, 6),
    });
    setSel({ dashboards: b.dashboards.length > 0, settings: Object.keys(b.pluginSettings).length > 0, prefs: Object.keys(b.preferences).length > 0 });
  };

  const apply = async () => {
    if (!plan) return;
    setApplying(true);
    const failed: string[] = [];
    try {
      if (sel.dashboards) for (const d of plan.bundle.dashboards) { try { await api.saveDashboard({ ...d, updatedAt: Date.now() }); } catch { failed.push(`дашборд ${d.name}`); } }
      if (sel.settings) for (const id of plan.settingsApply) {
        const cur = plugins.data?.find((p) => p.manifest.id === id)?.instance.settings ?? {};
        try { await api.updatePluginSettings(id, { ...cur, ...plan.bundle.pluginSettings[id] }); } catch (e) { failed.push(`${id}: ${toApiError(e).message}`); }
      }
      if (sel.prefs) prefs.set(Object.fromEntries(plan.prefKeys.map((k) => [k, plan.bundle.preferences[k]])));
      queryClient.invalidate('dashboards'); queryClient.invalidate('plugins');
      if (failed.length) toast({ severity: 'warn', title: `Импорт выполнен частично (${failed.length} ошибок)`, body: failed.slice(0, 3).join('; ') });
      else toast({ severity: 'success', title: 'Конфигурация импортирована' });
      setPlan(null);
    } finally { setApplying(false); }
  };

  return (
    <div className="col gap-4">
      <Panel title="Экспорт" meta={<span className="mono faint">{CONFIG_EXPORT_FORMAT} v1</span>}>
        <div className="col gap-3">
          <label className="check"><input type="checkbox" checked={incl.dashboards} onChange={(e) => setIncl({ ...incl, dashboards: e.target.checked })} /><span>Дашборды <span className="faint">— {(dashboards.data ?? []).filter((d) => d.origin !== 'generated').length} шт., кроме автоматически созданных</span></span></label>
          <label className="check"><input type="checkbox" checked={incl.settings} onChange={(e) => setIncl({ ...incl, settings: e.target.checked })} /><span>Настройки плагинов <span className="faint">— без секретов (токены и пароли нужно ввести заново)</span></span></label>
          <label className="check"><input type="checkbox" checked={incl.prefs} onChange={(e) => setIncl({ ...incl, prefs: e.target.checked })} /><span>Предпочтения интерфейса</span></label>
          <div><Button icon={<Download size={14} />} disabled={!incl.dashboards && !incl.settings && !incl.prefs} onClick={exportBundle}>Скачать JSON</Button></div>
        </div>
      </Panel>
      <Panel title="Импорт">
        <div className="col gap-3">
          <label className="btn" style={{ alignSelf: 'flex-start' }}><Upload size={14} />Выбрать файл…<input type="file" accept="application/json,.json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {parseErr && (
            <div className="panel" style={{ borderColor: 'color-mix(in srgb, var(--err) 40%, var(--rule))' }}>
              <div className="issue" style={{ gridTemplateColumns: '16px minmax(0,1fr)' }}><AlertTriangle size={14} color="var(--err)" /><b>Файл отклонён валидатором</b></div>
              {parseErr.map((e, i) => <div key={i} className="issue" style={{ gridTemplateColumns: '16px minmax(0,1fr)' }}><span /><span className="p">{e}</span></div>)}
            </div>
          )}
          {plan && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">Предпросмотр изменений</span><span className="faint mono" style={{ fontSize: 11 }}>экспорт от {fmtDateTime(plan.bundle.exportedAt)}</span></div>
              <div className="panel-body col gap-3">
                <label className="check"><input type="checkbox" disabled={!plan.bundle.dashboards.length} checked={sel.dashboards} onChange={(e) => setSel({ ...sel, dashboards: e.target.checked })} />
                  <span>Дашборды: <b>{plan.dashNew.length}</b> {plural(plan.dashNew.length, 'новый', 'новых', 'новых')}, <b style={{ color: plan.dashOverwrite.length ? 'var(--warn)' : undefined }}>{plan.dashOverwrite.length}</b> будет перезаписано
                    {plan.dashOverwrite.length > 0 && <div className="faint" style={{ fontSize: 12 }}>{plan.dashOverwrite.map((d) => d.name).join(', ')}</div>}</span></label>
                <label className="check"><input type="checkbox" disabled={!plan.settingsApply.length} checked={sel.settings} onChange={(e) => setSel({ ...sel, settings: e.target.checked })} />
                  <span>Настройки плагинов: <b>{plan.settingsApply.length}</b> применимо{plan.settingsSkip.length > 0 && <div className="faint" style={{ fontSize: 12 }}>Пропущены (плагин не установлен): {plan.settingsSkip.join(', ')}</div>}</span></label>
                <label className="check"><input type="checkbox" disabled={!plan.prefKeys.length} checked={sel.prefs} onChange={(e) => setSel({ ...sel, prefs: e.target.checked })} /><span>Предпочтения: {plan.prefKeys.join(', ') || '—'}</span></label>
                {plan.warnings.map((w, i) => <div key={i} className="row" style={{ fontSize: 12, color: 'var(--warn)' }}><AlertTriangle size={13} />{w}</div>)}
                <div className="row"><span className="spacer" /><Button variant="ghost" onClick={() => setPlan(null)}>Отмена</Button><Button variant="primary" perm="system.config" loading={applying} disabled={!sel.dashboards && !sel.settings && !sel.prefs} onClick={apply}>Применить</Button></div>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Developer({ api }: { api: MockCoreAdapter }) {
  const [c, setC] = useState<MockControl>(api.getControl());
  const [reset, setReset] = useState(false);
  const upd = (p: Partial<MockControl>) => { const next = { ...c, ...p }; setC(next); api.setControl(next); };
  const presets = useMemo(() => [
    { label: 'Норма', v: { latencyMin: 120, latencyMax: 450, errorRate: 0, offline: false } },
    { label: 'Медленная сеть', v: { latencyMin: 1200, latencyMax: 3500, errorRate: 0, offline: false } },
    { label: 'Нестабильное ядро', v: { latencyMin: 200, latencyMax: 900, errorRate: 0.3, offline: false } },
    { label: 'Ядро недоступно', v: { latencyMin: 120, latencyMax: 450, errorRate: 0, offline: true } },
  ], []);
  return (
    <div className="col gap-4">
      <div className="banner info" style={{ borderRadius: 6, border: 0 }}><FlaskConical size={15} /><span>Раздел доступен только в демо-режиме. Позволяет проверить состояния загрузки, ошибок и восстановления без реального ядра.</span></div>
      <Panel title="Сценарии">
        <div className="row wrap gap-2">{presets.map((p) => <button key={p.label} className="chip" aria-pressed={c.latencyMin === p.v.latencyMin && c.latencyMax === p.v.latencyMax && c.errorRate === p.v.errorRate && c.offline === p.v.offline} onClick={() => { upd(p.v); queryClient.invalidate('plugins'); queryClient.invalidate('nodes'); }}>{p.label}</button>)}</div>
      </Panel>
      <Panel title="Параметры симуляции">
        <Row label="Задержка ответа" help="Диапазон в миллисекундах">
          <div className="row"><input className="input mono" style={{ width: 100 }} type="number" min={0} value={c.latencyMin} onChange={(e) => upd({ latencyMin: Math.max(0, Number(e.target.value)) })} /><span className="muted">—</span><input className="input mono" style={{ width: 100 }} type="number" min={0} value={c.latencyMax} onChange={(e) => upd({ latencyMax: Math.max(c.latencyMin, Number(e.target.value)) })} /><span className="muted">мс</span></div>
        </Row>
        <Row label="Доля ошибок" help="Случайные 503 на запросах данных">
          <div className="row"><input type="range" min={0} max={1} step={0.05} value={c.errorRate} onChange={(e) => upd({ errorRate: Number(e.target.value) })} style={{ width: 220, accentColor: 'var(--ink)' }} /><span className="num">{Math.round(c.errorRate * 100)}%</span></div>
        </Row>
        <Row label="Ядро офлайн" help="Все запросы падают с сетевой ошибкой, realtime-канал закрыт"><Switch checked={c.offline} onChange={(v) => upd({ offline: v })} /></Row>
        <Row label="Поток событий" help="Генерация событий и обновлений узлов в реальном времени"><Switch checked={c.liveEvents} onChange={(v) => upd({ liveEvents: v })} /></Row>
      </Panel>
      <Panel>
        <div className="row"><div className="grow"><div style={{ fontWeight: 600 }}>Сбросить демо-данные</div><div className="muted" style={{ fontSize: 12.5 }}>Вернуть исходные плагины, узлы, дашборды и журнал. Предпочтения интерфейса сохранятся.</div></div>
          <Button variant="danger" icon={<RotateCcw size={14} />} onClick={() => setReset(true)}>Сбросить</Button></div>
      </Panel>
      <Confirm open={reset} onClose={() => setReset(false)} danger title="Сбросить демо-базу?" body="Все изменения в демо-режиме будут потеряны." confirmLabel="Сбросить и перезагрузить" onConfirm={() => { resetMockDatabase(); location.reload(); }} />
    </div>
  );
}
