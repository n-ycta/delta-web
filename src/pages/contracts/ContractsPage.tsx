import { tr } from '@/i18n';
import { useMemo, useState } from 'react';
import { FileJson, Wand2 } from 'lucide-react';
import { MetricKind, PANEL_CONTRACT_VERSION, validateManifest, type MetricDescriptor } from '@/core/contracts';
import { widgetRegistry } from '@/widgets/registry';
import * as M from '@/api/mock/manifests';
import { Badge, PageHead, Panel, Segmented, Tabs } from '@/ui/primitives';
import { Icon } from '@/ui/Icon';
import { ValidationIssues } from './ValidationIssues';
import { SettingsForm } from '../plugins/SettingsForm';

const SAMPLES: Record<string, { label: string; value: unknown }> = {
  typing: { label: tr("pages.contracts.ContractsPage.s_22cc3c3ba5"), value: M.typing },
  location: { label: tr("pages.contracts.ContractsPage.s_d058350565"), value: M.location },
  reader: { label: tr("pages.contracts.ContractsPage.s_c700a42657"), value: M.reader },
  legacy: { label: tr("pages.contracts.ContractsPage.s_de97806b3d"), value: M.legacyNotes },
  minimal: { label: tr("pages.contracts.ContractsPage.s_6b65a84977"), value: { id: 'dev.me.pomodoro', name: tr("pages.contracts.ContractsPage.s_81f616bdab"), version: '0.1.0', contract: '^1.4.0', publisher: tr("pages.contracts.ContractsPage.s_b1c1d8736f"), description: tr("pages.contracts.ContractsPage.s_c10721cc4d"), icon: 'timer', capabilities: ['metrics.timeseries'], runtime: { targets: ['desktop'] }, metrics: [{ id: 'focus', label: tr("pages.contracts.ContractsPage.s_9395be84e8"), kind: 'duration', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'project', label: tr("pages.contracts.ContractsPage.s_48b486d9c5"), values: [{ id: 'a', label: tr("pages.contracts.ContractsPage.s_75436e3162") }, { id: 'b', label: tr("pages.contracts.ContractsPage.s_2e3c5fdafe") }] }] }, { id: 'interruptions', label: tr("pages.contracts.ContractsPage.s_5362e7a2f8"), kind: 'counter', aggregations: ['sum'] }], settings: [{ key: 'length', type: 'number', label: tr("pages.contracts.ContractsPage.s_6f4dbb30e2"), default: 25, min: 5, max: 90, unit: tr("pages.contracts.ContractsPage.s_d6035dc6ed") }] } },
};

export function ContractsPage() {
  const [tab, setTab] = useState<'validator' | 'registry' | 'spec'>('validator');
  const [sample, setSample] = useState('minimal');
  const [text, setText] = useState(() => JSON.stringify(SAMPLES.minimal.value, null, 2));
  const parsed = useMemo(() => { try { return { json: JSON.parse(text) as unknown }; } catch (e) { return { error: (e as Error).message }; } }, [text]);
  const result = useMemo(() => ('json' in parsed ? validateManifest(parsed.json, { knownVisualizations: widgetRegistry.knownVisualizations() }) : null), [parsed]);

  return (
    <div className="page">
      <PageHead title={tr("pages.contracts.ContractsPage.s_ae73060f94")} sub={<>{tr("pages.contracts.ContractsPage.s_2efa64beb1")}<code>{PANEL_CONTRACT_VERSION}</code>{tr("pages.contracts.ContractsPage.s_2e755af855")}</>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'validator', label: tr("pages.contracts.ContractsPage.s_cdb102640d") }, { id: 'registry', label: tr("pages.contracts.ContractsPage.s_a4d6c2aa7e"), count: widgetRegistry.all().length }, { id: 'spec', label: tr("pages.contracts.ContractsPage.s_003298ddf1") }]} />

      {tab === 'validator' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <Panel title={<span className="row"><FileJson size={14} />{tr("pages.contracts.ContractsPage.s_ca642a2268")}</span>} flush actions={
            <select className="select" style={{ width: 260 }} value={sample} onChange={(e) => { setSample(e.target.value); setText(JSON.stringify(SAMPLES[e.target.value].value, null, 2)); }}>
              {Object.entries(SAMPLES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>}>
            <textarea className="textarea" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} style={{ border: 0, borderRadius: 0, minHeight: 620, background: 'var(--surface-2)' }} />
          </Panel>
          <div className="col gap-4">
            <Panel title={tr("pages.contracts.ContractsPage.s_9fa227c53f")} flush meta={result ? (result.report.compatible ? tr("pages.contracts.ContractsPage.s_c28ddd98f8") : tr("pages.contracts.ContractsPage.s_bde0e8f8cd")) : tr("pages.contracts.ContractsPage.s_43d5884b84")}>
              {'error' in parsed ? <div className="issue"><span /><span className="p">{tr("pages.contracts.ContractsPage.s_031a4e76f0")}</span><span style={{ color: 'var(--err)' }}>{parsed.error}</span></div> : result && <ValidationIssues report={result.report} />}
            </Panel>
            {result?.manifest && (
              <>
                <Panel title={<span className="row"><Wand2 size={14} />{tr("pages.contracts.ContractsPage.s_5748712ef4")}</span>} flush>
                  <table className="t"><thead><tr><th>{tr("pages.contracts.ContractsPage.s_4102160a4d")}</th><th>{tr("pages.contracts.ContractsPage.s_92a5d7dc45")}</th><th>{tr("pages.contracts.ContractsPage.s_cfb3b83982")}</th></tr></thead><tbody>
                    {result.manifest.metrics.map((m) => {
                      const r = widgetRegistry.rank(m).filter((x) => x.score > 0);
                      return <tr key={m.id}><td><span style={{ fontWeight: 500 }}>{m.label}</span> <span className="mono faint">{m.kind}</span></td><td>{r[0] ? <span className="row"><Icon name={r[0].def.icon} size={13} />{r[0].def.label}<span className="score">{r[0].score}</span></span> : <Badge tone="err">{tr("pages.contracts.ContractsPage.s_ced07fd144")}</Badge>}</td><td className="muted">{r.slice(1, 4).map((x) => x.def.label).join(', ')}</td></tr>;
                    })}
                  </tbody></table>
                </Panel>
                {result.manifest.settings.length > 0 && <Panel title={tr("pages.contracts.ContractsPage.s_0eb99bbedc")}><SettingsForm fields={result.manifest.settings} values={{}} onSubmit={() => {}} disabled /></Panel>}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'registry' && <RegistryTab />}
      {tab === 'spec' && <SpecTab />}
    </div>
  );
}

function RegistryTab() {
  const [cat, setCat] = useState<'metric' | 'system'>('metric');
  const kinds = MetricKind.options;
  const probe = (kind: string, dims: boolean): MetricDescriptor => ({ id: 'x', label: tr("pages.contracts.ContractsPage.s_11f6ad8ec5"), kind: kind as MetricDescriptor['kind'], unit: '', precision: 1, better: 'neutral', dimensions: dims ? [{ id: 'd', label: tr("pages.contracts.ContractsPage.s_3c363836cf"), values: [{ id: 'a', label: tr("pages.contracts.ContractsPage.s_86f7e437fa") }, { id: 'b', label: tr("pages.contracts.ContractsPage.s_e9d71f5ee7") }] }] : [], aggregations: ['avg'], visualizations: [], tags: [], range: kind === 'ratio' ? { min: 0, max: 1 } : undefined });
  return (
    <div className="col gap-4">
      <Segmented sans value={cat} onChange={setCat} options={[{ value: 'metric', label: tr("pages.contracts.ContractsPage.s_cb4e41ceb1") }, { value: 'system', label: tr("pages.contracts.ContractsPage.s_fb4d324eca") }]} />
      <Panel flush>
        <table className="t"><thead><tr><th>{tr("pages.contracts.ContractsPage.s_d25691ca40")}</th><th>{tr("pages.contracts.ContractsPage.s_97c248cbe0")}</th><th>{tr("pages.contracts.ContractsPage.s_2ec2016d83")}</th><th>{tr("pages.contracts.ContractsPage.s_98713e8814")}</th><th>{tr("pages.contracts.ContractsPage.s_7f17c7c62a")}</th></tr></thead><tbody>
          {widgetRegistry.all(cat).map((d) => (
            <tr key={d.type}><td><span className="row"><Icon name={d.icon} size={14} className="muted" /><span className="col" style={{ gap: 0 }}><span style={{ fontWeight: 500 }}>{d.label}</span><span className="mono faint" style={{ fontSize: 11 }}>{d.type}</span></span></span></td>
              <td className="mono">{d.version}</td><td className="mono muted">{d.aliases?.join(', ') || '—'}</td><td className="mono muted">{d.defaultSize.w}{tr("pages.contracts.ContractsPage.s_67fba2f357")}{d.defaultSize.h} {tr("pages.contracts.ContractsPage.s_9ee562a196")}{d.minSize.w}{tr("pages.contracts.ContractsPage.s_67fba2f357")}{d.minSize.h}{tr("pages.contracts.ContractsPage.s_e7064f0b80")}</td><td className="muted" style={{ fontSize: 11.5 }}>{d.options.join(', ') || '—'}</td></tr>
          ))}
        </tbody></table>
      </Panel>
      {cat === 'metric' && (
        <Panel title={tr("pages.contracts.ContractsPage.s_a1837cea82")} meta={tr("pages.contracts.ContractsPage.s_4521df6008")} flush>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>{tr("pages.contracts.ContractsPage.s_0ef25ae00f")}</th>{widgetRegistry.all('metric').map((d) => <th key={d.type} className="r">{d.label}</th>)}</tr></thead>
            <tbody>{kinds.map((k) => (
              <tr key={k}><td className="mono">{k}</td>{widgetRegistry.all('metric').map((d) => {
                const a = d.accepts?.(probe(k, false)).score ?? 0, b = d.accepts?.(probe(k, true)).score ?? 0;
                return <td key={d.type} className="num" style={{ color: Math.max(a, b) === 0 ? 'var(--faint)' : Math.max(a, b) >= 75 ? 'var(--ink)' : 'var(--muted)' }}>{a === b ? a : `${a}/${b}`}</td>;
              })}</tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}
    </div>
  );
}

function SpecTab() {
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Panel title={tr("pages.contracts.ContractsPage.s_46eabdadf9")}>
        <ol className="ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tr("pages.contracts.ContractsPage.s_d928a0c49b")}<code>{tr("pages.contracts.ContractsPage.s_c5beef2de7")}</code> {tr("pages.contracts.ContractsPage.s_75bba720fb")}<code>{tr("pages.contracts.ContractsPage.s_2e0c2f3739")}</code>{tr("pages.contracts.ContractsPage.s_d41919407c")}</li>
          <li>{tr("pages.contracts.ContractsPage.s_82d08e8db8")}</li>
          <li>{tr("pages.contracts.ContractsPage.s_5d7c872dc2")}</li>
          <li>{tr("pages.contracts.ContractsPage.s_fbaaf45beb")}<code>{tr("pages.contracts.ContractsPage.s_d61ceadbdb")}</code> {tr("pages.contracts.ContractsPage.s_a4c78569fc")}<code>{PANEL_CONTRACT_VERSION}</code>{tr("pages.contracts.ContractsPage.s_3a52ce7809")}</li>
          <li>{tr("pages.contracts.ContractsPage.s_90e614cb73")}<code>{tr("pages.contracts.ContractsPage.s_37dfd38fd1")}</code>{tr("pages.contracts.ContractsPage.s_d41919407c")}</li>
          <li>{tr("pages.contracts.ContractsPage.s_6cc6c5bb08")}<code>{tr("pages.contracts.ContractsPage.s_3cc1d5a427")}</code> {tr("pages.contracts.ContractsPage.s_fcb1d54cc2")}<code>{tr("pages.contracts.ContractsPage.s_326b426f9a")}</code> {tr("pages.contracts.ContractsPage.s_bc13256efc")}<code>{tr("pages.contracts.ContractsPage.s_7e9272be70")}</code> {tr("pages.contracts.ContractsPage.s_46d2691976")}</li>
          <li>{tr("pages.contracts.ContractsPage.s_7693779e65")}<code>{tr("pages.contracts.ContractsPage.s_0750e85bb4")}</code>{tr("pages.contracts.ContractsPage.s_186612c25c")}</li>
        </ol>
      </Panel>
      <Panel title={tr("pages.contracts.ContractsPage.s_ff8a31bfb5")}>
        <dl className="kv">
          <dt><code>{tr("pages.contracts.ContractsPage.s_7e0e019097")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_ecafe428bd")}</dd>
          <dt><code>{tr("pages.contracts.ContractsPage.s_458796e4e9")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_75a8f31573")}</dd>
          <dt><code>{tr("pages.contracts.ContractsPage.s_4b6339ba29")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_604d17e117")}</dd>
          <dt><code>{tr("pages.contracts.ContractsPage.s_5d3f344b5b")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_38343f8323")}</dd>
          <dt><code>{tr("pages.contracts.ContractsPage.s_c6fbbcc823")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_1c7ca17d22")}</dd>
          <dt><code>{tr("pages.contracts.ContractsPage.s_5be4eaf454")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_8fcd103c57")}</dd>
          <dt><code>{tr("pages.contracts.ContractsPage.s_5006ed0248")}</code></dt><dd>{tr("pages.contracts.ContractsPage.s_69171efcfb")}</dd>
        </dl>
        <hr className="divider" />
        <div className="muted" style={{ fontSize: 12 }}>{tr("pages.contracts.ContractsPage.s_0970f3b5ac")}<code>{tr("pages.contracts.ContractsPage.s_2c9eed7721")}</code>{tr("pages.contracts.ContractsPage.s_c85659c19f")}<code>{tr("pages.contracts.ContractsPage.s_67b8b1c4fe")}</code>{tr("pages.contracts.ContractsPage.s_42099b4af0")}<code>{tr("pages.contracts.ContractsPage.s_094b0fe0e3")}</code>{tr("pages.contracts.ContractsPage.s_3a52ce7809")}</div>
      </Panel>
    </div>
  );
}
