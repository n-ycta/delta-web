import { isCoreEndpoint } from '@/api/endpoints';
import { tr } from '@/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, FlaskConical, PlugZap, RotateCcw, Upload } from 'lucide-react';
import { useApi } from '@/app/ApiContext';
import { useDashboards, usePlugins } from '@/app/data';
import { queryClient, useQuery } from '@/app/query';
import { toast, usePrefs, type Density, type Theme } from '@/app/stores';
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
const PREF_KEYS = ['theme', 'density', 'palette', 'hour12', 'homeStrip', 'realNoticeHidden', 'sidebarCollapsed'] as const;

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'general';
  const api = useApi();
  return (
    <div className="page">
      <PageHead title={tr("pages.SettingsPage.s_7f17c7c62a")} sub={tr("pages.SettingsPage.s_4bafd289f1")} />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'general', label: tr("pages.SettingsPage.s_8d7038f840") }, { id: 'connection', label: tr("pages.SettingsPage.s_47a23743fc") }, { id: 'backup', label: tr("pages.SettingsPage.s_45a67513f4") },
        ...(api instanceof MockCoreAdapter ? [{ id: 'developer' as const, label: tr("pages.SettingsPage.s_c69d7e0c09") }] : []),
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
      <Row label={tr("pages.SettingsPage.s_553c45f1b8")} help={p.theme === 'system' ? tr("pages.SettingsPage.s_1b7077ba89", { p0: (resolved === 'dark' ? tr("pages.SettingsPage.s_9bb136b149") : tr("pages.SettingsPage.s_afea312145")) }) : undefined}>
        <Segmented sans value={p.theme} onChange={(v: Theme) => p.set({ theme: v })} options={[{ value: 'light', label: tr("pages.SettingsPage.s_8080010c5e") }, { value: 'dark', label: tr("pages.SettingsPage.s_bd16b23470") }, { value: 'system', label: tr("pages.SettingsPage.s_f0a22d9d1a") }]} />
      </Row>
      <Row label={tr("pages.SettingsPage.s_57a66c5fce")} help={tr("pages.SettingsPage.s_de6dc5528a")}>
        <Segmented sans value={p.density} onChange={(v: Density) => p.set({ density: v })} options={[{ value: 'comfortable', label: tr("pages.SettingsPage.s_4cc6290561") }, { value: 'compact', label: tr("pages.SettingsPage.s_f6a45a2683") }]} />
      </Row>
      <Row label={tr("pages.SettingsPage.s_7b0f5e3496")} help={tr("pages.SettingsPage.s_23542ce3ca")}>
        <div className="col gap-2 palette-options">
          {Object.entries(PALETTES).map(([k, pal]) => (
            <button key={k} className="viz-option palette-option" aria-pressed={p.palette === k} onClick={() => p.set({ palette: k })}>
              <span className="palette-name">{pal.label}</span>
              <span className="row wrap gap-1 palette-swatches">{(resolved === 'dark' ? pal.dark : pal.light).map((c) => <span key={c} style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 3, background: c }} />)}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row label={tr("pages.SettingsPage.s_747942b4fa")}><Segmented value={p.hour12 ? '12' : '24'} onChange={(v) => p.set({ hour12: v === '12' })} options={[{ value: '24', label: tr("pages.SettingsPage.s_8b737da86f") }, { value: '12', label: tr("pages.SettingsPage.s_22575db1d9") }]} /></Row>
      <Row label={tr("pages.SettingsPage.s_f581466381")} help={tr("pages.SettingsPage.s_6963561d90")}><Switch checked={p.homeStrip} onChange={(v) => p.set({ homeStrip: v })} /></Row>
      <Row label={tr('runtime.showNotice')} help={tr('runtime.showNoticeHelp')}><Switch checked={!p.realNoticeHidden} onChange={(v) => p.set({ realNoticeHidden: !v })} label={tr('runtime.showNotice')} /></Row>
      <Row label={tr("pages.SettingsPage.s_bf76aec854")}><Switch checked={!p.sidebarCollapsed} onChange={(v) => p.set({ sidebarCollapsed: !v })} label={tr("pages.SettingsPage.s_ea3f25bcf4")} /></Row>
    </Panel>
  );
}

function Connection() {
  const api = useApi();
  const current = readConnectionSettings();
  const [draft, setDraft] = useState<ConnectionSettings>(current);
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'fail'; info?: CoreInfo; msg?: string; ms?: number }>({ state: 'idle' });
  const info = useQuery('core/info', (a) => a.info());
  const urlErr = draft.mode === 'http' && !isCoreEndpoint(draft.baseUrl) ? tr("pages.SettingsPage.s_a830b4c344") : undefined;
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
      <Panel title={tr("pages.SettingsPage.s_f4a6fcf588")} meta={<Badge mono tone={api.mode === 'mock' ? 'accent' : 'info'}>{api.mode}</Badge>}>
        {info.loading ? <Skeleton h={60} /> : info.error ? <ErrorState compact error={info.error} onRetry={info.refetch} /> : info.data && (
          <dl className="kv">
            <dt>{tr("pages.SettingsPage.s_3609281642")}</dt><dd className="mono">{info.data.name}</dd>
            <dt>{tr("pages.SettingsPage.s_38d5b8e4a8")}</dt><dd className="mono">{info.data.coreVersion} {tr("pages.SettingsPage.s_0d0c4ddd7c")}{info.data.apiVersion}</dd>
            <dt>{tr("pages.SettingsPage.s_7117989d8a")}</dt><dd className="mono">{PANEL_CONTRACT_VERSION}</dd>
            <dt>{tr("pages.SettingsPage.s_8db46ea789")}</dt><dd className="mono">{api.endpoint}</dd>
            <dt>{tr("pages.SettingsPage.s_e6156da328")}</dt><dd>{fmtDuration((Date.now() - info.data.startedAt) / 1000)}</dd>
            {info.data.region && <><dt>{tr("pages.SettingsPage.s_1089c8142d")}</dt><dd>{info.data.region}</dd></>}
            <dt>{tr("pages.SettingsPage.s_ba8e15f90c")}</dt><dd className="row wrap gap-1">{info.data.features.map((f) => <Badge key={f} mono outline>{f}</Badge>)}</dd>
          </dl>
        )}
      </Panel>
      <Panel title={tr("pages.SettingsPage.s_20acff3ddb")}>
        <Row label={tr("pages.SettingsPage.s_ff0fbd56f4")} help={tr("pages.SettingsPage.s_009a5c1104")}>
          <Segmented sans value={draft.mode} onChange={(m) => setDraft({ ...draft, mode: m })} options={[{ value: 'mock', label: tr("pages.SettingsPage.s_303e0ca407") }, { value: 'http', label: tr("pages.SettingsPage.s_3c4b103be6") }]} />
        </Row>
        {draft.mode === 'http' && <>
          <Row label={tr("pages.SettingsPage.s_0f883d3ea6")} help={tr("pages.SettingsPage.s_39e6ea4753")}><Field error={urlErr}><input className={`input mono ${urlErr ? 'invalid' : ''}`} value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder={tr("pages.SettingsPage.s_fb6b919d20")} /></Field></Row>
          <Row label={tr("pages.SettingsPage.s_a131b18387")} help={tr("pages.SettingsPage.s_a49a611746")}><input className="input mono" type="password" autoComplete="off" value={draft.token ?? ''} onChange={(e) => setDraft({ ...draft, token: e.target.value || undefined })} placeholder={tr("pages.SettingsPage.s_04ad84837e")} /></Row>
        </>}
        <div className="row" style={{ marginTop: 12 }}>
          {test.state === 'ok' && <span className="row" style={{ color: 'var(--ok)', fontSize: 12.5 }}><CheckCircle2 size={14} />{test.info?.name} {tr("pages.SettingsPage.s_4767c98808")}{test.info?.apiVersion} {tr("pages.SettingsPage.s_d3dacf895c")}{test.ms} {tr("pages.SettingsPage.s_5160aea6bb")}</span>}
          {test.state === 'fail' && <span className="row" style={{ color: 'var(--err)', fontSize: 12.5 }}><AlertTriangle size={14} />{test.msg}</span>}
          <span className="spacer" />
          <Button icon={<PlugZap size={14} />} loading={test.state === 'running'} disabled={!!urlErr} onClick={runTest}>{tr("pages.SettingsPage.s_52dec92eda")}</Button>
          <Button variant="primary" disabled={!dirty || !!urlErr} onClick={apply} title={dirty ? tr("pages.SettingsPage.s_4fc3be6905") : undefined}>{tr("pages.SettingsPage.s_4f52ca05be")}</Button>
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
    toast({ severity: 'success', title: tr("pages.SettingsPage.s_75eca8c60a"), body: tr("pages.SettingsPage.s_2ae7f1b0b0") });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setPlan(null); setParseErr(null);
    let raw: unknown;
    try { raw = JSON.parse(await f.text()); } catch { setParseErr([tr("pages.SettingsPage.s_c2af798b81")]); return; }
    const r = ConfigBundle.safeParse(raw);
    if (!r.success) { setParseErr(r.error.issues.slice(0, 8).map((i) => tr("pages.SettingsPage.s_43639a4c8b", { p0: (i.path.join('.') || tr("pages.SettingsPage.s_903b4e793b")), p1: (i.message) }))); return; }
    const b = r.data;
    const existing = new Map((dashboards.data ?? []).map((d) => [d.id, d]));
    const warnings: string[] = [];
    for (const d of b.dashboards) for (const w of d.widgets) if (!widgetRegistry.get(w.type)) warnings.push(tr("pages.SettingsPage.s_c356909cf0", { p0: (d.name), p1: (w.type) }));
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
      if (sel.dashboards) for (const d of plan.bundle.dashboards) { try { await api.saveDashboard({ ...d, updatedAt: Date.now() }); } catch { failed.push(tr("pages.SettingsPage.s_9e9fb443b1", { p0: (d.name) })); } }
      if (sel.settings) for (const id of plan.settingsApply) {
        const cur = plugins.data?.find((p) => p.manifest.id === id)?.instance.settings ?? {};
        try { await api.updatePluginSettings(id, { ...cur, ...plan.bundle.pluginSettings[id] }); } catch (e) { failed.push(`${id}: ${toApiError(e).message}`); }
      }
      if (sel.prefs) prefs.set(Object.fromEntries(plan.prefKeys.map((k) => [k, plan.bundle.preferences[k]])));
      queryClient.invalidate('dashboards'); queryClient.invalidate('plugins');
      if (failed.length) toast({ severity: 'warn', title: tr("pages.SettingsPage.s_14a56ceae6", { p0: (failed.length) }), body: failed.slice(0, 3).join('; ') });
      else toast({ severity: 'success', title: tr("pages.SettingsPage.s_693adb132a") });
      setPlan(null);
    } finally { setApplying(false); }
  };

  return (
    <div className="col gap-4">
      <Panel title={tr("pages.SettingsPage.s_dd5016c829")} meta={<span className="mono faint">{CONFIG_EXPORT_FORMAT} {tr("pages.SettingsPage.s_69b79b6b6f")}</span>}>
        <div className="col gap-3">
          <label className="check"><input type="checkbox" checked={incl.dashboards} onChange={(e) => setIncl({ ...incl, dashboards: e.target.checked })} /><span>{tr("pages.SettingsPage.s_4bb5b9689d")}<span className="faint">{tr("pages.SettingsPage.s_2e6ba7dc86")}{(dashboards.data ?? []).filter((d) => d.origin !== 'generated').length} {tr("pages.SettingsPage.s_3aaed1ead7")}</span></span></label>
          <label className="check"><input type="checkbox" checked={incl.settings} onChange={(e) => setIncl({ ...incl, settings: e.target.checked })} /><span>{tr("pages.SettingsPage.s_ed668b0ed5")}<span className="faint">{tr("pages.SettingsPage.s_b1491593c2")}</span></span></label>
          <label className="check"><input type="checkbox" checked={incl.prefs} onChange={(e) => setIncl({ ...incl, prefs: e.target.checked })} /><span>{tr("pages.SettingsPage.s_c949572544")}</span></label>
          <div><Button icon={<Download size={14} />} disabled={!incl.dashboards && !incl.settings && !incl.prefs} onClick={exportBundle}>{tr("pages.SettingsPage.s_2007ff2dec")}</Button></div>
        </div>
      </Panel>
      <Panel title={tr("pages.SettingsPage.s_3f8c55176b")}>
        <div className="col gap-3">
          <label className="btn" style={{ alignSelf: 'flex-start' }}><Upload size={14} />{tr("pages.SettingsPage.s_8cdc51667a")}<input type="file" accept="application/json,.json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {parseErr && (
            <div className="panel" style={{ borderColor: 'color-mix(in srgb, var(--err) 40%, var(--rule))' }}>
              <div className="issue" style={{ gridTemplateColumns: '16px minmax(0,1fr)' }}><AlertTriangle size={14} color="var(--err)" /><b>{tr("pages.SettingsPage.s_d396c16bf8")}</b></div>
              {parseErr.map((e, i) => <div key={i} className="issue" style={{ gridTemplateColumns: '16px minmax(0,1fr)' }}><span /><span className="p">{e}</span></div>)}
            </div>
          )}
          {plan && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">{tr("pages.SettingsPage.s_b2046f5276")}</span><span className="faint mono" style={{ fontSize: 11 }}>{tr("pages.SettingsPage.s_8c41ee924a")}{fmtDateTime(plan.bundle.exportedAt)}</span></div>
              <div className="panel-body col gap-3">
                <label className="check"><input type="checkbox" disabled={!plan.bundle.dashboards.length} checked={sel.dashboards} onChange={(e) => setSel({ ...sel, dashboards: e.target.checked })} />
                  <span>{tr("pages.SettingsPage.s_40e99fbc0b")}<b>{plan.dashNew.length}</b> {plural(plan.dashNew.length, tr("pages.SettingsPage.s_3697bef0b3"), tr("pages.SettingsPage.s_acf9690dfa"), tr("pages.SettingsPage.s_acf9690dfa"))}{tr("pages.SettingsPage.s_d3bc9a378d")}<b style={{ color: plan.dashOverwrite.length ? 'var(--warn)' : undefined }}>{plan.dashOverwrite.length}</b> {tr("pages.SettingsPage.s_94e15df73b")}{plan.dashOverwrite.length > 0 && <div className="faint" style={{ fontSize: 12 }}>{plan.dashOverwrite.map((d) => d.name).join(', ')}</div>}</span></label>
                <label className="check"><input type="checkbox" disabled={!plan.settingsApply.length} checked={sel.settings} onChange={(e) => setSel({ ...sel, settings: e.target.checked })} />
                  <span>{tr("pages.SettingsPage.s_5421ff0b12")}<b>{plan.settingsApply.length}</b> {tr("pages.SettingsPage.s_5760b828fc")}{plan.settingsSkip.length > 0 && <div className="faint" style={{ fontSize: 12 }}>{tr("pages.SettingsPage.s_5940b2be27")}{plan.settingsSkip.join(', ')}</div>}</span></label>
                <label className="check"><input type="checkbox" disabled={!plan.prefKeys.length} checked={sel.prefs} onChange={(e) => setSel({ ...sel, prefs: e.target.checked })} /><span>{tr("pages.SettingsPage.s_4b6d4519fb")}{plan.prefKeys.join(', ') || '—'}</span></label>
                {plan.warnings.map((w, i) => <div key={i} className="row" style={{ fontSize: 12, color: 'var(--warn)' }}><AlertTriangle size={13} />{w}</div>)}
                <div className="row"><span className="spacer" /><Button variant="ghost" onClick={() => setPlan(null)}>{tr("pages.SettingsPage.s_0ec753be8d")}</Button><Button variant="primary" perm="system.config" loading={applying} disabled={!sel.dashboards && !sel.settings && !sel.prefs} onClick={apply}>{tr("pages.SettingsPage.s_768af67762")}</Button></div>
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
    { label: tr("pages.SettingsPage.s_2b944228bd"), v: { latencyMin: 120, latencyMax: 450, errorRate: 0, offline: false } },
    { label: tr("pages.SettingsPage.s_d85eb853ed"), v: { latencyMin: 1200, latencyMax: 3500, errorRate: 0, offline: false } },
    { label: tr("pages.SettingsPage.s_e112d40a39"), v: { latencyMin: 200, latencyMax: 900, errorRate: 0.3, offline: false } },
    { label: tr("pages.SettingsPage.s_d5769c6c5c"), v: { latencyMin: 120, latencyMax: 450, errorRate: 0, offline: true } },
  ], []);
  return (
    <div className="col gap-4">
      <div className="banner info" style={{ borderRadius: 6, border: 0 }}><FlaskConical size={15} /><span>{tr("pages.SettingsPage.s_d80c4553c1")}</span></div>
      <Panel title={tr("pages.SettingsPage.s_23cbe0df93")}>
        <div className="row wrap gap-2">{presets.map((p) => <button key={p.label} className="chip" aria-pressed={c.latencyMin === p.v.latencyMin && c.latencyMax === p.v.latencyMax && c.errorRate === p.v.errorRate && c.offline === p.v.offline} onClick={() => { upd(p.v); queryClient.invalidate('plugins'); queryClient.invalidate('nodes'); }}>{p.label}</button>)}</div>
      </Panel>
      <Panel title={tr("pages.SettingsPage.s_ab9c102646")}>
        <Row label={tr("pages.SettingsPage.s_7d90b81a35")} help={tr("pages.SettingsPage.s_89d29c3875")}>
          <div className="row"><input className="input mono" style={{ width: 100 }} type="number" min={0} value={c.latencyMin} onChange={(e) => upd({ latencyMin: Math.max(0, Number(e.target.value)) })} /><span className="muted">{tr("pages.SettingsPage.s_1b93795b97")}</span><input className="input mono" style={{ width: 100 }} type="number" min={0} value={c.latencyMax} onChange={(e) => upd({ latencyMax: Math.max(c.latencyMin, Number(e.target.value)) })} /><span className="muted">{tr("pages.SettingsPage.s_bbb0e8e8cd")}</span></div>
        </Row>
        <Row label={tr("pages.SettingsPage.s_cee6426172")} help={tr("pages.SettingsPage.s_b8d8633e84")}>
          <div className="row"><input type="range" min={0} max={1} step={0.05} value={c.errorRate} onChange={(e) => upd({ errorRate: Number(e.target.value) })} style={{ width: 220, accentColor: 'var(--ink)' }} /><span className="num">{Math.round(c.errorRate * 100)}{tr("pages.SettingsPage.s_4345cb1fa2")}</span></div>
        </Row>
        <Row label={tr("pages.SettingsPage.s_19e8e9eb6a")} help={tr("pages.SettingsPage.s_4552eb86c4")}><Switch checked={c.offline} onChange={(v) => upd({ offline: v })} /></Row>
        <Row label={tr("pages.SettingsPage.s_9ad64a41fa")} help={tr("pages.SettingsPage.s_73446fdb52")}><Switch checked={c.liveEvents} onChange={(v) => upd({ liveEvents: v })} /></Row>
      </Panel>
      <Panel>
        <div className="row"><div className="grow"><div style={{ fontWeight: 600 }}>{tr("pages.SettingsPage.s_780e09a3ea")}</div><div className="muted" style={{ fontSize: 12.5 }}>{tr("pages.SettingsPage.s_8152f9928a")}</div></div>
          <Button variant="danger" icon={<RotateCcw size={14} />} onClick={() => setReset(true)}>{tr("pages.SettingsPage.s_058f162d29")}</Button></div>
      </Panel>
      <Confirm open={reset} onClose={() => setReset(false)} danger title={tr("pages.SettingsPage.s_b58d000580")} body={tr("pages.SettingsPage.s_fa5d8cdcf5")} confirmLabel={tr("pages.SettingsPage.s_6aac038116")} onConfirm={() => { resetMockDatabase(); location.reload(); }} />
    </div>
  );
}
