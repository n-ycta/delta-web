import { isCoreEndpoint } from '../src/api/endpoints';
/* Minimal dependency-free test runner: `npm test` */
declare const process: { exit(code: number): never };
import { compare, diffKind, isValid, satisfies } from '../src/core/lib/semver';
import { validateManifest } from '../src/core/contracts/validate';
import { ConfigBundle, ConnectionConfig, DashboardConfig, PANEL_CONTRACT_VERSION } from '../src/core/contracts';
import { generatePluginDashboard, pack } from '../src/core/registry/autodash';
import { normalizePlugins } from '../src/core/registry/plugins';
import { generateMetric } from '../src/api/mock/generate';
import * as M from '../src/api/mock/manifests';
import { widgetRegistry } from '../src/widgets/registry';

let passed = 0; const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(name); console.log(`  ✗ ${name}\n    ${(e as Error).message}`); }
}
function eq<T>(a: T, b: T, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(v: unknown, msg = 'assertion failed') { if (!v) throw new Error(msg); }
const known = widgetRegistry.knownVisualizations();
const v = (raw: unknown) => validateManifest(raw, { knownVisualizations: known, panelContract: PANEL_CONTRACT_VERSION });

console.log('semver');
test('valid / invalid', () => { ok(isValid('1.2.3')); ok(isValid('2.0.0-beta.1')); ok(!isValid('1.2')); ok(!isValid('v1.2.3')); });
test('compare incl. prerelease', () => { eq(Math.sign(compare('1.2.3', '1.10.0')), -1); eq(Math.sign(compare('2.0.0', '2.0.0-rc.1')), 1); eq(compare('1.0.0', '1.0.0'), 0); });
test('caret ranges', () => { ok(satisfies('1.4.0', '^1.2.0')); ok(!satisfies('2.0.0', '^1.2.0')); ok(satisfies('0.3.5', '^0.3.1')); ok(!satisfies('0.4.0', '^0.3.1')); });
test('tilde / comparators', () => { ok(satisfies('1.4.9', '~1.4.2')); ok(!satisfies('1.5.0', '~1.4.2')); ok(satisfies('1.4.0', '>=1.3.0 <2.0.0')); });
test('diffKind', () => { eq(diffKind('2.4.1', '2.5.0'), 'minor'); eq(diffKind('1.0.0', '2.0.0'), 'major'); eq(diffKind('1.0.0', '1.0.1'), 'patch'); });

console.log('contract validation');
test('typing manifest is valid and compatible', () => { const r = v(M.typing); ok(r.report.ok, JSON.stringify(r.report.issues)); ok(r.report.compatible); ok(r.manifest!.metrics.length >= 4); });
test('unknown visualization is tolerated, reported', () => { const r = v(M.location); ok(r.report.compatible); ok(r.report.unknownVisualizations.includes('geo-map')); });
test('contract major mismatch blocks loading', () => { const r = v(M.reader); ok(!r.report.compatible); ok(r.report.issues.some((i) => i.severity === 'error')); });
test('broken manifest never throws and yields errors', () => { const r = v(M.legacyNotes); ok(!r.report.ok); ok(!r.manifest || !r.report.compatible); ok(r.report.issues.length > 0); });
test('garbage input', () => { for (const g of [null, 42, 'x', [], { id: 1 }]) { const r = v(g); ok(!r.report.compatible); } });

console.log('widget registry');
const accuracy = v(M.typing).manifest!.metrics.find((m) => m.kind === 'ratio')!;
test('ranking puts a sensible widget first', () => { const r = widgetRegistry.rank(accuracy); ok(r.length > 3); ok(r[0].score >= r[r.length - 1].score); ok(['gauge', 'stat', 'timeseries'].includes(r[0].def.type), r[0].def.type); });
test('aliases resolve', () => { ok(widgetRegistry.get('kpi')?.type === 'stat'); });
test('unknown type → unknown resolution', () => { const res = widgetRegistry.resolve({ id: 'w', type: 'sankey', typeVersion: '1.0.0', source: { kind: 'system', feed: 'events' }, display: {}, layout: { x: 0, y: 0, w: 4, h: 4 } } as never); eq(res.status, 'unknown'); });
test('newer major config → incompatible', () => { const res = widgetRegistry.resolve({ id: 'w', type: 'stat', typeVersion: '9.0.0', source: { kind: 'system', feed: 'events' }, display: {}, layout: { x: 0, y: 0, w: 4, h: 4 } } as never); eq(res.status, 'incompatible'); });

console.log('dashboards');
test('pack fills full rows without overlap', () => {
  const l = pack([{ w: 3, h: 4 }, { w: 3, h: 4 }, { w: 6, h: 6 }, { w: 5, h: 5 }, { w: 4, h: 6 }]);
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    const a = l[i], b = l[j]; const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; ok(!overlap, `overlap ${i}/${j}`);
  }
  ok(l.every((r) => r.x + r.w <= 12));
});
test('generated dashboard satisfies DashboardConfig schema', () => {
  const entries = normalizePlugins([{ manifest: M.typing, latest: M.typingLatest, instance: { pluginId: 'dev.delta.typing', status: 'active', installedVersion: '2.4.1', latestVersion: '2.5.0', nodeIds: [], settings: {}, grantedPermissions: [] } }], known);
  const d = generatePluginDashboard(entries[0], widgetRegistry);
  ok(DashboardConfig.safeParse(d).success); ok(d.widgets.length >= 5); eq(d.id, 'gen_dev.delta.typing');
});
test('config bundle rejects wrong format', () => { ok(!ConfigBundle.safeParse({ format: 'other', formatVersion: 1, exportedAt: '' }).success); ok(ConfigBundle.safeParse({ format: 'delta.console.config', formatVersion: 1, exportedAt: 'x' }).success); });
test('connection config bounds', () => { ok(!ConnectionConfig.safeParse({ transport: 'wss', endpoint: 'x', heartbeatSec: 1, reconnect: 'linear', maxBackoffSec: 60, tls: true, compression: true }).success); });

console.log('mock data');
test('generateMetric is deterministic and grouped', () => {
  const wpm = v(M.typing).manifest!.metrics.find((m) => m.id === 'wpm')!;
  const q = { pluginId: 'dev.delta.typing', metricId: 'wpm', range: { preset: '24h' as const }, groupBy: 'language', aggregation: 'avg' as const };
  const a = generateMetric(q as never, wpm), b = generateMetric(q as never, wpm);
  ok(a.series.length >= 2, `series=${a.series.length}`); eq(a.series[0].points.length, b.series[0].points.length);
});

test('local and HTTP core endpoints validated without blocking initial login', () => {
  ok(isCoreEndpoint('/api')); ok(isCoreEndpoint('http://127.0.0.1:7700')); ok(isCoreEndpoint('https://delta.example/api'));
  ok(!isCoreEndpoint('//evil.example')); ok(!isCoreEndpoint('javascript:alert(1)')); ok(!isCoreEndpoint('https://user:secret@delta.example')); ok(!isCoreEndpoint('/api?token=secret'));
});
console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
