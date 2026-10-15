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
  typing: { label: 'Анализ печати (валидный)', value: M.typing },
  location: { label: 'Геотрекер (неизвестные визуализации)', value: M.location },
  reader: { label: 'Readwise (контракт 2.x)', value: M.reader },
  legacy: { label: 'Notes Sync (сломанный)', value: M.legacyNotes },
  minimal: { label: 'Минимальный шаблон', value: { id: 'dev.me.pomodoro', name: 'Помидоры', version: '0.1.0', contract: '^1.4.0', publisher: 'me', description: 'Фокус-сессии', icon: 'timer', capabilities: ['metrics.timeseries'], runtime: { targets: ['desktop'] }, metrics: [{ id: 'focus', label: 'Фокус', kind: 'duration', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'project', label: 'Проект', values: [{ id: 'a', label: 'Работа' }, { id: 'b', label: 'Учёба' }] }] }, { id: 'interruptions', label: 'Прерывания', kind: 'counter', aggregations: ['sum'] }], settings: [{ key: 'length', type: 'number', label: 'Длина сессии', default: 25, min: 5, max: 90, unit: 'мин' }] } },
};

export function ContractsPage() {
  const [tab, setTab] = useState<'validator' | 'registry' | 'spec'>('validator');
  const [sample, setSample] = useState('minimal');
  const [text, setText] = useState(() => JSON.stringify(SAMPLES.minimal.value, null, 2));
  const parsed = useMemo(() => { try { return { json: JSON.parse(text) as unknown }; } catch (e) { return { error: (e as Error).message }; } }, [text]);
  const result = useMemo(() => ('json' in parsed ? validateManifest(parsed.json, { knownVisualizations: widgetRegistry.knownVisualizations() }) : null), [parsed]);

  return (
    <div className="page">
      <PageHead title="Контракты" sub={<>Консоль реализует контракт плагинов <code>{PANEL_CONTRACT_VERSION}</code>. Здесь можно проверить манифест до публикации и увидеть, какой интерфейс будет для него построен.</>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'validator', label: 'Валидатор' }, { id: 'registry', label: 'Реестр виджетов', count: widgetRegistry.all().length }, { id: 'spec', label: 'Спецификация' }]} />

      {tab === 'validator' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <Panel title={<span className="row"><FileJson size={14} />manifest.json</span>} flush actions={
            <select className="select" style={{ width: 260 }} value={sample} onChange={(e) => { setSample(e.target.value); setText(JSON.stringify(SAMPLES[e.target.value].value, null, 2)); }}>
              {Object.entries(SAMPLES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>}>
            <textarea className="textarea" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} style={{ border: 0, borderRadius: 0, minHeight: 620, background: 'var(--surface-2)' }} />
          </Panel>
          <div className="col gap-4">
            <Panel title="Результат" flush meta={result ? (result.report.compatible ? 'можно загрузить' : 'будет изолирован') : 'JSON не разобран'}>
              {'error' in parsed ? <div className="issue"><span /><span className="p">JSON</span><span style={{ color: 'var(--err)' }}>{parsed.error}</span></div> : result && <ValidationIssues report={result.report} />}
            </Panel>
            {result?.manifest && (
              <>
                <Panel title={<span className="row"><Wand2 size={14} />Интерфейс, который построит консоль</span>} flush>
                  <table className="t"><thead><tr><th>Метрика</th><th>Виджет</th><th>Альтернативы</th></tr></thead><tbody>
                    {result.manifest.metrics.map((m) => {
                      const r = widgetRegistry.rank(m).filter((x) => x.score > 0);
                      return <tr key={m.id}><td><span style={{ fontWeight: 500 }}>{m.label}</span> <span className="mono faint">{m.kind}</span></td><td>{r[0] ? <span className="row"><Icon name={r[0].def.icon} size={13} />{r[0].def.label}<span className="score">{r[0].score}</span></span> : <Badge tone="err">нет</Badge>}</td><td className="muted">{r.slice(1, 4).map((x) => x.def.label).join(', ')}</td></tr>;
                    })}
                  </tbody></table>
                </Panel>
                {result.manifest.settings.length > 0 && <Panel title="Форма настроек (из схемы)"><SettingsForm fields={result.manifest.settings} values={{}} onSubmit={() => {}} disabled /></Panel>}
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
  const probe = (kind: string, dims: boolean): MetricDescriptor => ({ id: 'x', label: 'x', kind: kind as MetricDescriptor['kind'], unit: '', precision: 1, better: 'neutral', dimensions: dims ? [{ id: 'd', label: 'd', values: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }] }] : [], aggregations: ['avg'], visualizations: [], tags: [], range: kind === 'ratio' ? { min: 0, max: 1 } : undefined });
  return (
    <div className="col gap-4">
      <Segmented sans value={cat} onChange={setCat} options={[{ value: 'metric', label: 'Метрические' }, { value: 'system', label: 'Системные' }]} />
      <Panel flush>
        <table className="t"><thead><tr><th>Тип</th><th>Версия</th><th>Алиасы</th><th>Размер</th><th>Настройки</th></tr></thead><tbody>
          {widgetRegistry.all(cat).map((d) => (
            <tr key={d.type}><td><span className="row"><Icon name={d.icon} size={14} className="muted" /><span className="col" style={{ gap: 0 }}><span style={{ fontWeight: 500 }}>{d.label}</span><span className="mono faint" style={{ fontSize: 11 }}>{d.type}</span></span></span></td>
              <td className="mono">{d.version}</td><td className="mono muted">{d.aliases?.join(', ') || '—'}</td><td className="mono muted">{d.defaultSize.w}×{d.defaultSize.h} (min {d.minSize.w}×{d.minSize.h})</td><td className="muted" style={{ fontSize: 11.5 }}>{d.options.join(', ') || '—'}</td></tr>
          ))}
        </tbody></table>
      </Panel>
      {cat === 'metric' && (
        <Panel title="Матрица совместимости" meta="score: тип метрики × виджет, с измерением / без" flush>
          <div className="table-wrap"><table className="t">
            <thead><tr><th>kind</th>{widgetRegistry.all('metric').map((d) => <th key={d.type} className="r">{d.label}</th>)}</tr></thead>
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
      <Panel title="Жизненный цикл контракта">
        <ol className="ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Плагин публикует <code>manifest</code> через ядро (<code>GET /plugins</code>).</li>
          <li>Консоль проверяет схему (zod) — ошибки схемы изолируют плагин, но не ломают каталог.</li>
          <li>Семантические проверки: дубли id, агрегации, диапазоны, пороги, разрешения.</li>
          <li>Совместимость: <code>contract</code> плагина — semver-диапазон, который должен включать <code>{PANEL_CONTRACT_VERSION}</code>.</li>
          <li>Неизвестные визуализации и возможности не фатальны: заменяются ранжированием реестра или игнорируются (<code>x-*</code>).</li>
          <li>По метрикам строятся дашборды, по <code>settings</code> — формы, по <code>actions</code> — команды, по <code>permissions</code> — экран согласия.</li>
          <li>Сохранённые виджеты хранят <code>typeVersion</code>; при смене major-версии типа срабатывает миграция или безопасная заглушка.</li>
        </ol>
      </Panel>
      <Panel title="Типы метрик">
        <dl className="kv">
          <dt><code>gauge</code></dt><dd>мгновенная величина (скорость, температура)</dd>
          <dt><code>counter</code></dt><dd>накапливается по интервалу (нажатия, шаги)</dd>
          <dt><code>ratio</code></dt><dd>доля 0..1 (точность, заряд)</dd>
          <dt><code>duration</code></dt><dd>секунды (сон, экранное время)</dd>
          <dt><code>distribution</code></dt><dd>гистограмма значений (задержки)</dd>
          <dt><code>categorical</code></dt><dd>значения по категориям (топ приложений)</dd>
          <dt><code>event</code></dt><dd>дискретные события</dd>
        </dl>
        <hr className="divider" />
        <div className="muted" style={{ fontSize: 12 }}>Измерения (<code>dimensions</code>) дают разбивку, фильтры и сравнения — например, язык набора <code>ru</code>/<code>en</code>.</div>
      </Panel>
    </div>
  );
}
