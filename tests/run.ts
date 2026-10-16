import {
  matchesCondition,
  isSettingVisible,
  settingsPayload,
} from '../src/pages/plugins/visibility';
import { SettingField, SettingCondition } from '../src/core/contracts/plugin';
import { mergeGeneratedDashboard } from '../src/core/registry/autodash';
import { safeDataLink, DataCell } from '../src/pages/plugins/PluginDataViews';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mergeProfileValues } from '../src/pages/plugins/profiles';
import { noticeKey, noticeFingerprint, dismissNotice } from '../src/ui/pluginNoticeState';
import { queryStep } from '../src/widgets/intervals';
import { WidgetDisplay } from '../src/core/contracts/dashboard';
import { buildQuery } from '../src/widgets/shared';
import { isCoreEndpoint } from '../src/api/endpoints';
/* Minimal dependency-free test runner: `npm test` */
declare const process: { exit(code: number): never };
import { compare, diffKind, isValid, satisfies } from '../src/core/lib/semver';
import { validateManifest } from '../src/core/contracts/validate';
import {
  ConfigBundle,
  ConnectionConfig,
  DashboardConfig,
  PANEL_CONTRACT_VERSION,
} from '../src/core/contracts';
import { generatePluginDashboard, pack } from '../src/core/registry/autodash';
import { normalizePlugins } from '../src/core/registry/plugins';
import { generateMetric } from '../src/api/mock/generate';
import * as M from '../src/api/mock/manifests';
import { widgetRegistry } from '../src/widgets/registry';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
  }
}
function eq<T>(a: T, b: T, msg = '') {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: unknown, msg = 'assertion failed') {
  if (!v) throw new Error(msg);
}
const known = widgetRegistry.knownVisualizations();
const v = (raw: unknown) =>
  validateManifest(raw, { knownVisualizations: known, panelContract: PANEL_CONTRACT_VERSION });

console.log('semver');
test('valid / invalid', () => {
  ok(isValid('1.2.3'));
  ok(isValid('2.0.0-beta.1'));
  ok(!isValid('1.2'));
  ok(!isValid('v1.2.3'));
});
test('compare incl. prerelease', () => {
  eq(Math.sign(compare('1.2.3', '1.10.0')), -1);
  eq(Math.sign(compare('2.0.0', '2.0.0-rc.1')), 1);
  eq(compare('1.0.0', '1.0.0'), 0);
});
test('caret ranges', () => {
  ok(satisfies('1.4.0', '^1.2.0'));
  ok(!satisfies('2.0.0', '^1.2.0'));
  ok(satisfies('0.3.5', '^0.3.1'));
  ok(!satisfies('0.4.0', '^0.3.1'));
});
test('tilde / comparators', () => {
  ok(satisfies('1.4.9', '~1.4.2'));
  ok(!satisfies('1.5.0', '~1.4.2'));
  ok(satisfies('1.4.0', '>=1.3.0 <2.0.0'));
});
test('diffKind', () => {
  eq(diffKind('2.4.1', '2.5.0'), 'minor');
  eq(diffKind('1.0.0', '2.0.0'), 'major');
  eq(diffKind('1.0.0', '1.0.1'), 'patch');
});

console.log('contract validation');
test('typing manifest is valid and compatible', () => {
  const r = v(M.typing);
  ok(r.report.ok, JSON.stringify(r.report.issues));
  ok(r.report.compatible);
  ok(r.manifest!.metrics.length >= 4);
});
test('unknown visualization is tolerated, reported', () => {
  const r = v(M.location);
  ok(r.report.compatible);
  ok(r.report.unknownVisualizations.includes('geo-map'));
});
test('contract major mismatch blocks loading', () => {
  const r = v(M.reader);
  ok(!r.report.compatible);
  ok(r.report.issues.some((i) => i.severity === 'error'));
});
test('broken manifest never throws and yields errors', () => {
  const r = v(M.legacyNotes);
  ok(!r.report.ok);
  ok(!r.manifest || !r.report.compatible);
  ok(r.report.issues.length > 0);
});
test('garbage input', () => {
  for (const g of [null, 42, 'x', [], { id: 1 }]) {
    const r = v(g);
    ok(!r.report.compatible);
  }
});

console.log('widget registry');
const accuracy = v(M.typing).manifest!.metrics.find((m) => m.kind === 'ratio')!;
test('ranking puts a sensible widget first', () => {
  const r = widgetRegistry.rank(accuracy);
  ok(r.length > 3);
  ok(r[0].score >= r[r.length - 1].score);
  ok(['gauge', 'stat', 'timeseries'].includes(r[0].def.type), r[0].def.type);
});
test('aliases resolve', () => {
  ok(widgetRegistry.get('kpi')?.type === 'stat');
});
test('unknown type → unknown resolution', () => {
  const res = widgetRegistry.resolve({
    id: 'w',
    type: 'sankey',
    typeVersion: '1.0.0',
    source: { kind: 'system', feed: 'events' },
    display: {},
    layout: { x: 0, y: 0, w: 4, h: 4 },
  } as never);
  eq(res.status, 'unknown');
});
test('newer major config → incompatible', () => {
  const res = widgetRegistry.resolve({
    id: 'w',
    type: 'stat',
    typeVersion: '9.0.0',
    source: { kind: 'system', feed: 'events' },
    display: {},
    layout: { x: 0, y: 0, w: 4, h: 4 },
  } as never);
  eq(res.status, 'incompatible');
});

console.log('dashboards');
test('pack fills full rows without overlap', () => {
  const l = pack([
    { w: 3, h: 4 },
    { w: 3, h: 4 },
    { w: 6, h: 6 },
    { w: 5, h: 5 },
    { w: 4, h: 6 },
  ]);
  for (let i = 0; i < l.length; i++)
    for (let j = i + 1; j < l.length; j++) {
      const a = l[i],
        b = l[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      ok(!overlap, `overlap ${i}/${j}`);
    }
  ok(l.every((r) => r.x + r.w <= 12));
});
test('generated dashboard satisfies DashboardConfig schema', () => {
  const entries = normalizePlugins(
    [
      {
        manifest: M.typing,
        latest: M.typingLatest,
        instance: {
          pluginId: 'dev.delta.typing',
          status: 'active',
          installedVersion: '2.4.1',
          latestVersion: '2.5.0',
          nodeIds: [],
          settings: {},
          grantedPermissions: [],
        },
      },
    ],
    known,
  );
  const d = generatePluginDashboard(entries[0], widgetRegistry);
  ok(DashboardConfig.safeParse(d).success);
  ok(d.widgets.length >= 5);
  eq(d.id, 'gen_dev.delta.typing');
});
test('config bundle rejects wrong format', () => {
  ok(!ConfigBundle.safeParse({ format: 'other', formatVersion: 1, exportedAt: '' }).success);
  ok(
    ConfigBundle.safeParse({ format: 'delta.console.config', formatVersion: 1, exportedAt: 'x' })
      .success,
  );
});
test('connection config bounds', () => {
  ok(
    !ConnectionConfig.safeParse({
      transport: 'wss',
      endpoint: 'x',
      heartbeatSec: 1,
      reconnect: 'linear',
      maxBackoffSec: 60,
      tls: true,
      compression: true,
    }).success,
  );
});

console.log('mock data');
test('generateMetric is deterministic and grouped', () => {
  const wpm = v(M.typing).manifest!.metrics.find((m) => m.id === 'wpm')!;
  const q = {
    pluginId: 'dev.delta.typing',
    metricId: 'wpm',
    range: { preset: '24h' as const },
    groupBy: 'language',
    aggregation: 'avg' as const,
  };
  const a = generateMetric(q as never, wpm),
    b = generateMetric(q as never, wpm);
  ok(a.series.length >= 2, `series=${a.series.length}`);
  eq(a.series[0].points.length, b.series[0].points.length);
});

test('local and HTTP core endpoints validated without blocking initial login', () => {
  ok(isCoreEndpoint('/api'));
  ok(isCoreEndpoint('http://127.0.0.1:7700'));
  ok(isCoreEndpoint('https://delta.example/api'));
  ok(!isCoreEndpoint('//evil.example'));
  ok(!isCoreEndpoint('javascript:alert(1)'));
  ok(!isCoreEndpoint('https://user:secret@delta.example'));
  ok(!isCoreEndpoint('/api?token=secret'));
});
test('chart representations and sampling settings validate', () => {
  for (const chart of ['dots', 'line', 'area', 'bar', 'step'])
    ok(WidgetDisplay.safeParse({ chart, connectNulls: true, stepMs: 1800000 }).success);
  ok(!WidgetDisplay.safeParse({ stepMs: -1 }).success);
  ok(!WidgetDisplay.safeParse({ stepMs: 1.5 }).success);
  eq(queryStep(undefined, '90d'), undefined);
  eq(queryStep(1800000, '24h'), 1800000);
  ok(7776000000 / queryStep(60000, '90d')! <= 2000);
});
test('query preserves range override, source aggregation, filters and cadence', () => {
  const q = buildQuery(
    {
      id: 'x',
      type: 'timeseries',
      typeVersion: '1.3.0',
      source: {
        kind: 'metric',
        pluginId: 'dev.delta.type',
        metricId: 'wpm',
        aggregation: 'avg',
        groupBy: 'language',
        filters: { language: ['ru'] },
      },
      display: { chart: 'dots', stepMs: 1800000, rangeOverride: '7d', compare: true },
      layout: { x: 0, y: 0, w: 6, h: 7 },
    },
    { range: '24h', refreshSec: 0, editing: false, onDisplayChange: () => {} },
  );
  eq(q?.range, { preset: '7d' });
  eq(q?.stepMs, 1800000);
  eq(q?.aggregation, 'avg');
  eq(q?.filters, { language: ['ru'] });
  eq(q?.compare, 'previous');
});
test('generated metric widget IDs are stable across polling and categorical words support dynamic dimensions', () => {
  const source = normalizePlugins(
    [
      {
        manifest: M.typing,
        latest: M.typing,
        instance: {
          pluginId: M.typing.id,
          status: 'active',
          installedVersion: M.typing.version,
          latestVersion: M.typing.version,
          nodeIds: [],
          settings: {},
          grantedPermissions: [],
        },
      },
    ],
    known,
  )[0];
  ok(source);
  const a = generatePluginDashboard(source, widgetRegistry),
    b = generatePluginDashboard(source, widgetRegistry);
  eq(
    a.widgets.map((w) => w.id),
    b.widgets.map((w) => w.id),
  );
  const metric = {
    ...v(M.typing).manifest!.metrics[0],
    id: 'word_frequency',
    kind: 'categorical' as const,
    dimensions: [{ id: 'word', label: 'Word', type: 'string' as const }],
    aggregations: ['sum' as const],
    defaultAggregation: 'sum' as const,
    visualizations: ['bubbles', 'bar', 'breakdown', 'table'],
  };
  eq(widgetRegistry.best(metric)?.type, 'bubbles');
});

console.log('plugin notice dismissals');
test('dismissal tracks content and is scoped to plugin, node and connection', () => {
  const entry = { manifest: { id: 'dev.delta.type' }, instance: { nodeIds: ['a'] } } as Parameters<
    typeof noticeKey
  >[1];
  const n = {
    id: 'type.words',
    severity: 'info' as const,
    message: 'Enabled',
    localizations: { ru: 'Включено', en: 'Enabled' },
  };
  const key = noticeKey('local-owner', entry, n),
    fp = noticeFingerprint(n);
  eq(noticeFingerprint({ ...n, localizations: { en: 'Enabled', ru: 'Включено' } }), fp);
  ok(noticeFingerprint({ ...n, message: 'Changed' }) !== fp);
  ok(noticeFingerprint({ ...n, severity: 'warn' }) !== fp);
  ok(noticeKey('other-owner', entry, n) !== key);
  ok(
    noticeKey('local-owner', { ...entry, instance: { ...entry.instance, nodeIds: ['b'] } }, n) !==
      key,
  );
  eq(dismissNotice({}, key, fp)[key], fp);
  const many = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [String(i), 'old']));
  eq(Object.keys(dismissNotice(many, key, fp)).length, 500);
});
test('generic plugin views and typed action inputs require contract 1.5', () => {
  const manifest = {
    ...M.typing,
    contract: '^1.5.0',
    actions: [
      {
        id: 'preview',
        label: 'Preview',
        inputs: [{ key: 'text', type: 'string', label: 'Text', multiline: true }],
      },
    ],
    views: [
      {
        id: 'items',
        label: 'Items',
        capability: 'example.items',
        columns: [{ key: 'title', label: 'Title', type: 'link', urlKey: 'url', width: 260 }],
      },
    ],
  };
  const r = v(manifest);
  ok(r.report.compatible);
  eq(r.manifest!.views[0].columns[0].width, 260);
  eq(r.manifest!.actions[0].inputs[0].type, 'string');
  const old = validateManifest(manifest, { knownVisualizations: known, panelContract: '1.4.0' });
  ok(!old.report.compatible);
  ok(
    !v({
      ...manifest,
      views: [{ ...manifest.views[0], columns: [{ key: 'x', label: 'X', type: 'html' }] }],
    }).report.compatible,
  );
});

test('generic profiles merge deterministically without losing overlapping values', () => {
  const config = {
    selectionKey: 'selected',
    protectedKeys: ['prompt'],
    items: [
      { id: 'a', label: 'A', values: { words: 'one\ntwo', prompt: 'A' } },
      { id: 'b', label: 'B', values: { words: 'two\nthree', prompt: 'B' } },
    ],
  };
  eq(mergeProfileValues(config, ['b', 'a']), { words: 'one\ntwo\nthree', prompt: 'A\nB' });
  eq(mergeProfileValues(config, ['b']), { words: 'two\nthree', prompt: 'B' });
});
test('existing table supports record views, stable IDs and idempotent saved-dashboard migration', () => {
  const manifest = {
    ...M.typing,
    views: [
      {
        id: 'buyers',
        label: 'Buyers',
        capability: 'typing.buyers',
        dashboard: { args: { verdict: 'lead' }, limit: 10 },
        columns: [{ key: 'title', label: 'Post', type: 'link', urlKey: 'url' }],
      },
    ],
  };
  const entries = normalizePlugins(
    [
      {
        manifest,
        latest: manifest,
        instance: {
          pluginId: manifest.id,
          status: 'active',
          installedVersion: manifest.version,
          latestVersion: manifest.version,
          nodeIds: ['vps'],
          settings: {},
          grantedPermissions: [],
        },
      },
    ],
    known,
  );
  const fresh = generatePluginDashboard(entries[0], widgetRegistry);
  eq(fresh.widgets[0].type, 'table');
  eq(fresh.widgets[0].source.kind, 'plugin-view');
  ok(DashboardConfig.safeParse(fresh).success);
  const saved = { ...fresh, widgets: fresh.widgets.filter((w) => w.source.kind !== 'plugin-view') };
  const original = JSON.stringify(saved.widgets);
  const merged = mergeGeneratedDashboard(saved, fresh);
  eq(JSON.stringify(merged.widgets.slice(0, saved.widgets.length)), original);
  eq(mergeGeneratedDashboard(merged, fresh), merged);
  ok(
    merged.widgets[merged.widgets.length - 1].layout.y >=
      Math.max(...saved.widgets.map((w) => w.layout.y + w.layout.h)),
  );
});
test('typed table links are clickable HTTPS links; unsafe URLs and markup never execute', () => {
  const column = { key: 'title', label: 'Post', type: 'link' as const, urlKey: 'url' };
  const render = (url: string) =>
    renderToStaticMarkup(
      createElement(DataCell, { row: { title: '<img onerror=alert(1)>', url }, column }),
    );
  ok(render('https://reddit.com/r/forhire/').includes('href="https://reddit.com/r/forhire/"'));
  ok(render('https://reddit.com').includes('noopener noreferrer'));
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://secret@reddit.com',
    'http://reddit.com',
  ]) {
    eq(safeDataLink(url), undefined);
    ok(!render(url).includes('<a '));
  }
  ok(render('https://reddit.com').includes('&lt;img'));
});
test('generic setting branches support nested AND/OR/NOT and preserve hidden settings without submitting them', () => {
  const condition = {
    all: [
      { key: 'enabled', equals: true },
      {
        any: [
          { key: 'mode', equals: 'parallel' },
          { not: { key: 'mode', oneOf: ['batch', 'sequential'] } },
        ],
      },
    ],
  };
  ok(SettingCondition.safeParse(condition).success);
  eq(matchesCondition(condition, { enabled: true, mode: 'parallel' }), true);
  eq(matchesCondition(condition, { enabled: true, mode: 'sequential' }), false);
  eq(matchesCondition({ key: 'missing', equals: null }, {}), false);
  const field = SettingField.parse({
    key: 'concurrency',
    label: 'Concurrency',
    type: 'number',
    min: 1,
    default: 3,
    visibleWhen: { key: 'mode', equals: 'parallel' },
  });
  const fields = [
    SettingField.parse({ key: 'mode', label: 'Mode', type: 'string' }),
    field,
    SettingField.parse({
      key: 'token',
      label: 'Token',
      type: 'secret',
      visibleWhen: { key: 'enabled', equals: true },
    }),
  ];
  const values = { mode: 'sequential', concurrency: 7 };
  eq(isSettingVisible(field, values), false);
  eq(settingsPayload(fields, values, { token: 'draft-secret' }), { mode: 'sequential' });
  eq(settingsPayload(fields, { ...values, mode: 'parallel' }, {}), {
    mode: 'parallel',
    concurrency: 7,
  });
  eq(values.concurrency, 7);
  ok(!SettingCondition.safeParse({ key: 'mode', equals: 'parallel', execute: 'anything' }).success);
  ok(!SettingCondition.safeParse({ all: [] }).success);
});
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
