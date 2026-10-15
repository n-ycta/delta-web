import { tr } from '@/i18n';
import type { PluginManifestInput } from '@/core/contracts';

/**
 * Demo plugin manifests, as a real core would serve them.
 * Some are deliberately imperfect to exercise validation & compatibility paths.
 */
const LANG = { id: 'language', label: tr("api.mock.manifests.s_ed3f0e507a"), values: [{ id: 'ru', label: tr("api.mock.manifests.s_5537fc8e69") }, { id: 'en', label: tr("api.mock.manifests.s_649df08a44") }] };

export const typing: PluginManifestInput = {
  id: 'dev.delta.typing',
  name: tr("api.mock.manifests.s_114ae408c4"),
  version: '2.4.1',
  contract: '^1.2.0',
  publisher: tr("api.mock.manifests.s_edabe0f9b1"),
  description: tr("api.mock.manifests.s_fc8af2ec4a"),
  icon: 'keyboard',
  category: 'input',
  capabilities: ['metrics.timeseries', 'metrics.realtime', 'settings.live', 'export.csv', 'actions'],
  runtime: { targets: ['desktop', 'android'], minAgent: '1.6.0' },
  permissions: [
    { scope: 'input.keyboard.stats', reason: tr("api.mock.manifests.s_00519a1c39") },
    { scope: 'apps.foreground.read', reason: tr("api.mock.manifests.s_8aed0ca444"), optional: true },
  ],
  settings: [
    { key: 'languages', type: 'multiselect', label: tr("api.mock.manifests.s_c7e1aa0ab0"), default: ['ru', 'en'], options: [{ value: 'ru', label: tr("api.mock.manifests.s_5537fc8e69") }, { value: 'en', label: tr("api.mock.manifests.s_649df08a44") }, { value: 'de', label: tr("api.mock.manifests.s_a6a7709266") }] },
    { key: 'minSession', type: 'number', label: tr("api.mock.manifests.s_28e20310e0"), default: 30, min: 5, max: 600, unit: tr("api.mock.manifests.s_b40bbca36d"), help: tr("api.mock.manifests.s_d5b7a7640b") },
    { key: 'excludeApps', type: 'string', label: tr("api.mock.manifests.s_eb05c2b972"), default: 'keepassxc, 1password', placeholder: tr("api.mock.manifests.s_16b3f9f5d6"), group: tr("api.mock.manifests.s_972590c07b") },
    { key: 'pauseOnPassword', type: 'boolean', label: tr("api.mock.manifests.s_5fabe95f27"), default: true, group: tr("api.mock.manifests.s_972590c07b") },
    { key: 'sampling', type: 'select', label: tr("api.mock.manifests.s_f15e45664b"), default: '60', options: [{ value: '15', label: tr("api.mock.manifests.s_dad5ebd865") }, { value: '60', label: tr("api.mock.manifests.s_f5125b5f0b") }, { value: '300', label: tr("api.mock.manifests.s_26b591f3f3") }], requiresRestart: true },
  ],
  metrics: [
    { id: 'wpm', label: tr("api.mock.manifests.s_28e3e37a5b"), description: tr("api.mock.manifests.s_017fb23295"), kind: 'gauge', unit: 'wpm', precision: 0, better: 'higher', dimensions: [LANG], aggregations: ['avg', 'max', 'p95'], defaultAggregation: 'avg', visualizations: ['timeseries', 'comparison', 'stat'] },
    { id: 'accuracy', label: tr("api.mock.manifests.s_913eea7e42"), description: tr("api.mock.manifests.s_47308c8bec"), kind: 'ratio', unit: 'ratio', precision: 1, better: 'higher', range: { min: 0, max: 1 }, dimensions: [LANG], aggregations: ['avg', 'min'], visualizations: ['gauge', 'timeseries'], thresholds: [{ value: 0.9, severity: 'warn', label: tr("api.mock.manifests.s_2caab8aed0") }] },
    { id: 'keystrokes', label: tr("api.mock.manifests.s_97c3b22863"), kind: 'counter', unit: '', precision: 0, dimensions: [LANG], aggregations: ['sum'], visualizations: ['bar', 'heatmap', 'stat'] },
    { id: 'error_keys', label: tr("api.mock.manifests.s_4c744c1589"), kind: 'categorical', unit: '', precision: 0, dimensions: [{ id: 'key', label: tr("api.mock.manifests.s_02b295beec") }], aggregations: ['sum'], visualizations: ['breakdown'] },
    { id: 'key_latency', label: tr("api.mock.manifests.s_230358dda9"), kind: 'distribution', unit: 'ms', precision: 0, better: 'lower', aggregations: ['avg', 'p95'], visualizations: ['distribution'] },
    { id: 'session_time', label: tr("api.mock.manifests.s_0c995b1dad"), kind: 'duration', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'app', label: tr("api.mock.manifests.s_f9886ca2bc"), values: [{ id: 'code', label: tr("api.mock.manifests.s_64edc3e61e") }, { id: 'tg', label: tr("api.mock.manifests.s_edbea9ff1a") }, { id: 'browser', label: tr("api.mock.manifests.s_1b4034547a") }, { id: 'obsidian', label: tr("api.mock.manifests.s_24c869802c") }] }], visualizations: ['bar', 'breakdown'] },
  ],
  actions: [
    { id: 'recalibrate', label: tr("api.mock.manifests.s_aba3a2663e"), description: tr("api.mock.manifests.s_4b483648bc") },
    { id: 'purge-today', label: tr("api.mock.manifests.s_7a78de7c49"), dangerous: true },
  ],
  changelog: [
    { version: '2.4.1', date: '2026-09-28', notes: [tr("api.mock.manifests.s_063e669612")] },
    { version: '2.4.0', date: '2026-09-10', notes: [tr("api.mock.manifests.s_c2d1b05cb3"), tr("api.mock.manifests.s_a852668343")] },
  ],
};

export const typingLatest: PluginManifestInput = {
  ...typing,
  version: '2.5.0',
  changelog: [{ version: '2.5.0', date: '2026-10-11', notes: [tr("api.mock.manifests.s_f0e2784d39"), tr("api.mock.manifests.s_cc2f884f47"), tr("api.mock.manifests.s_83f1d5c9a1")] }, ...(typing.changelog ?? [])],
  metrics: [...(typing.metrics ?? []), { id: 'layout_switches', label: tr("api.mock.manifests.s_f9a515e175"), kind: 'counter', unit: '', precision: 0, aggregations: ['sum'], visualizations: ['bar'] }],
};

export const health: PluginManifestInput = {
  id: 'dev.delta.health',
  name: tr("api.mock.manifests.s_cdb57ebc54"),
  version: '1.9.0',
  contract: '^1.3.0',
  publisher: tr("api.mock.manifests.s_edabe0f9b1"),
  description: tr("api.mock.manifests.s_9f6aea320e"),
  icon: 'heart-pulse',
  category: 'health',
  capabilities: ['metrics.timeseries', 'storage.local'],
  runtime: { targets: ['android'] },
  permissions: [
    { scope: 'health.steps.read', reason: tr("api.mock.manifests.s_26413deed0") },
    { scope: 'health.heart.read', reason: tr("api.mock.manifests.s_109a4a57a5") },
    { scope: 'health.sleep.read', reason: tr("api.mock.manifests.s_029dfed00d") },
  ],
  settings: [
    { key: 'stepGoal', type: 'number', label: tr("api.mock.manifests.s_992de2536c"), default: 9000, min: 1000, max: 40000, step: 500 },
    { key: 'source', type: 'select', label: tr("api.mock.manifests.s_8290a3dbc0"), default: 'hc', options: [{ value: 'hc', label: tr("api.mock.manifests.s_be6bca3ec8") }, { value: 'gf', label: tr("api.mock.manifests.s_870e380d6d") }] },
  ],
  metrics: [
    { id: 'steps', label: tr("api.mock.manifests.s_e2d16a37b1"), kind: 'counter', unit: '', precision: 0, better: 'higher', aggregations: ['sum'], visualizations: ['bar', 'stat', 'heatmap'] },
    { id: 'heart_rate', label: tr("api.mock.manifests.s_f49929cc98"), kind: 'gauge', unit: tr("api.mock.manifests.s_afb959a47a"), precision: 0, aggregations: ['avg', 'min', 'max'], visualizations: ['timeseries'], thresholds: [{ value: 120, severity: 'warn' }] },
    { id: 'sleep', label: tr("api.mock.manifests.s_6c281a9aa0"), kind: 'duration', unit: 's', better: 'higher', dimensions: [{ id: 'stage', label: tr("api.mock.manifests.s_ac9b738893"), values: [{ id: 'deep', label: tr("api.mock.manifests.s_d0a4cddd18") }, { id: 'light', label: tr("api.mock.manifests.s_1269c5adba") }, { id: 'rem', label: tr("api.mock.manifests.s_e56eb975d9") }] }], aggregations: ['sum', 'avg'], visualizations: ['bar', 'breakdown'] },
    { id: 'hrv', label: tr("api.mock.manifests.s_c7fff84a33"), kind: 'gauge', unit: tr("api.mock.manifests.s_bbb0e8e8cd"), precision: 0, better: 'higher', aggregations: ['avg'], visualizations: ['timeseries', 'stat'] },
  ],
};

export const finance: PluginManifestInput = {
  id: 'dev.delta.finance',
  name: tr("api.mock.manifests.s_61dcf3af42"),
  version: '0.8.3',
  contract: '^1.0.0',
  publisher: tr("api.mock.manifests.s_236087fd3c"),
  description: tr("api.mock.manifests.s_c718cf64f6"),
  icon: 'wallet',
  category: 'finance',
  capabilities: ['metrics.timeseries', 'events.stream', 'export.csv'],
  runtime: { targets: ['vps', 'android'] },
  permissions: [
    { scope: 'notifications.bank.read', reason: tr("api.mock.manifests.s_dd26891c08") },
    { scope: 'storage.encrypted.write', reason: tr("api.mock.manifests.s_f6a8b65980") },
  ],
  settings: [
    { key: 'currency', type: 'select', label: tr("api.mock.manifests.s_6dfca1070c"), default: 'RUB', options: [{ value: 'RUB', label: tr("api.mock.manifests.s_939756a210") }, { value: 'EUR', label: tr("api.mock.manifests.s_c8fb9c99ec") }, { value: 'USD', label: tr("api.mock.manifests.s_0d7c01a8be") }] },
    { key: 'budget', type: 'number', label: tr("api.mock.manifests.s_bb427b4c3e"), default: 90000, min: 0, unit: '₽' },
    { key: 'imapPassword', type: 'secret', label: tr("api.mock.manifests.s_f864b222bf"), group: tr("api.mock.manifests.s_55ca8fac21") },
  ],
  metrics: [
    { id: 'spend', label: tr("api.mock.manifests.s_5ca32915d5"), kind: 'counter', unit: '₽', precision: 0, better: 'lower', dimensions: [{ id: 'category', label: tr("api.mock.manifests.s_19c85838e6"), values: [{ id: 'food', label: tr("api.mock.manifests.s_c85756a1ae") }, { id: 'cafe', label: tr("api.mock.manifests.s_62fa090db4") }, { id: 'transport', label: tr("api.mock.manifests.s_e25d2d0eed") }, { id: 'subs', label: tr("api.mock.manifests.s_9f52d47392") }, { id: 'home', label: tr("api.mock.manifests.s_92f3f459ec") }, { id: 'other', label: tr("api.mock.manifests.s_2ade33f377") }] }], aggregations: ['sum'], visualizations: ['bar', 'breakdown', 'stat'] },
    { id: 'balance', label: tr("api.mock.manifests.s_c13a87fc54"), kind: 'gauge', unit: '₽', precision: 0, aggregations: ['last', 'min'], defaultAggregation: 'last', visualizations: ['timeseries', 'stat'] },
  ],
};

export const git: PluginManifestInput = {
  id: 'dev.delta.git',
  name: tr("api.mock.manifests.s_473f89e442"),
  version: '1.2.0',
  contract: '^1.1.0',
  publisher: tr("api.mock.manifests.s_edabe0f9b1"),
  description: tr("api.mock.manifests.s_52d3aef3c2"),
  icon: 'git-branch',
  category: 'dev',
  capabilities: ['metrics.timeseries', 'events.stream'],
  runtime: { targets: ['desktop', 'vps'] },
  permissions: [{ scope: 'fs.repos.read', reason: tr("api.mock.manifests.s_12b016687c") }, { scope: 'net.github.read', reason: tr("api.mock.manifests.s_86fcbeae58"), optional: true }],
  settings: [
    { key: 'roots', type: 'string', label: tr("api.mock.manifests.s_3a03d93021"), default: '~/src, ~/work' },
    { key: 'githubToken', type: 'secret', label: tr("api.mock.manifests.s_bbbc336238") },
  ],
  metrics: [
    { id: 'commits', label: tr("api.mock.manifests.s_b4f456d721"), kind: 'counter', unit: '', precision: 0, dimensions: [{ id: 'repo', label: tr("api.mock.manifests.s_cff4deb5a6"), values: [{ id: 'delta-core', label: tr("api.mock.manifests.s_edabe0f9b1") }, { id: 'console', label: tr("api.mock.manifests.s_e2346381bb") }, { id: 'dotfiles', label: tr("api.mock.manifests.s_1587c51d54") }] }], aggregations: ['sum'], visualizations: ['bar', 'heatmap'] },
    { id: 'churn', label: tr("api.mock.manifests.s_3e0985e0b9"), kind: 'counter', unit: tr("api.mock.manifests.s_730f20f161"), precision: 0, dimensions: [{ id: 'op', label: tr("api.mock.manifests.s_d25691ca40"), values: [{ id: 'add', label: tr("api.mock.manifests.s_158599b9fe") }, { id: 'del', label: tr("api.mock.manifests.s_af87b40b97") }] }], aggregations: ['sum'], visualizations: ['bar'] },
  ],
};

export const home: PluginManifestInput = {
  id: 'dev.delta.home',
  name: tr("api.mock.manifests.s_92f3f459ec"),
  version: '3.0.2',
  contract: '^1.4.0',
  publisher: tr("api.mock.manifests.s_edabe0f9b1"),
  description: tr("api.mock.manifests.s_12439389d2"),
  icon: 'house',
  category: 'home',
  capabilities: ['metrics.timeseries', 'metrics.realtime', 'actions', 'x-scenes'],
  runtime: { targets: ['sbc', 'vps'] },
  permissions: [{ scope: 'net.mqtt.subscribe', reason: tr("api.mock.manifests.s_85305c1b07") }, { scope: 'devices.*', reason: tr("api.mock.manifests.s_e5af8e3422") }],
  settings: [
    { key: 'broker', type: 'string', label: tr("api.mock.manifests.s_e9bced8fd1"), default: 'mqtt://rpi-home.lan:1883' },
    { key: 'co2Alert', type: 'number', label: tr("api.mock.manifests.s_f8071aa834"), default: 1000, unit: 'ppm', min: 400, max: 5000 },
  ],
  metrics: [
    { id: 'temperature', label: tr("api.mock.manifests.s_56f7653b88"), kind: 'gauge', unit: '°C', precision: 1, dimensions: [{ id: 'room', label: tr("api.mock.manifests.s_7f404c23c7"), values: [{ id: 'living', label: tr("api.mock.manifests.s_440161911a") }, { id: 'bedroom', label: tr("api.mock.manifests.s_784db8899c") }, { id: 'office', label: tr("api.mock.manifests.s_46c7be08dd") }] }], aggregations: ['avg', 'min', 'max', 'last'], visualizations: ['timeseries', 'comparison'] },
    { id: 'co2', label: tr("api.mock.manifests.s_8f95f8ec8c"), kind: 'gauge', unit: 'ppm', precision: 0, better: 'lower', range: { min: 400, max: 2000 }, dimensions: [{ id: 'room', label: tr("api.mock.manifests.s_7f404c23c7"), values: [{ id: 'bedroom', label: tr("api.mock.manifests.s_784db8899c") }, { id: 'office', label: tr("api.mock.manifests.s_46c7be08dd") }] }], aggregations: ['avg', 'max', 'last'], visualizations: ['timeseries', 'gauge'], thresholds: [{ value: 1000, severity: 'warn' }, { value: 1400, severity: 'error' }] },
    { id: 'energy', label: tr("api.mock.manifests.s_30988652d9"), kind: 'counter', unit: tr("api.mock.manifests.s_95201b0bb2"), precision: 2, aggregations: ['sum'], visualizations: ['bar', 'heatmap'] },
  ],
  actions: [{ id: 'scene-night', label: tr("api.mock.manifests.s_7b4827e29e") }, { id: 'reconnect', label: tr("api.mock.manifests.s_febaf1c408") }],
};

export const screen: PluginManifestInput = {
  id: 'dev.delta.screen',
  name: tr("api.mock.manifests.s_18f658bde4"),
  version: '1.1.4',
  contract: '^1.0.0',
  publisher: tr("api.mock.manifests.s_edabe0f9b1"),
  description: tr("api.mock.manifests.s_c709223f24"),
  icon: 'smartphone',
  category: 'productivity',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['android', 'desktop'] },
  permissions: [{ scope: 'apps.usage.read', reason: tr("api.mock.manifests.s_8d1953838b") }],
  settings: [{ key: 'focusApps', type: 'string', label: tr("api.mock.manifests.s_758fafd269"), default: 'code, obsidian, terminal' }],
  metrics: [
    { id: 'screen_time', label: tr("api.mock.manifests.s_18f658bde4"), kind: 'duration', unit: 's', better: 'lower', dimensions: [{ id: 'device', label: tr("api.mock.manifests.s_bc791dbe7e"), values: [{ id: 'pixel', label: tr("api.mock.manifests.s_cbac485ebb") }, { id: 'ws', label: tr("api.mock.manifests.s_65b822a4a7") }, { id: 'mac', label: tr("api.mock.manifests.s_81f471f2f6") }] }], aggregations: ['sum'], visualizations: ['bar', 'stat'] },
    { id: 'top_apps', label: tr("api.mock.manifests.s_13fdc4f39f"), kind: 'categorical', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'app', label: tr("api.mock.manifests.s_f9886ca2bc") }], visualizations: ['breakdown', 'pie'] },
    { id: 'pickups', label: tr("api.mock.manifests.s_f767c7361f"), kind: 'counter', unit: '', precision: 0, better: 'lower', aggregations: ['sum'], visualizations: ['heatmap', 'stat'] },
  ],
};

export const browser: PluginManifestInput = {
  id: 'dev.delta.browser',
  name: tr("api.mock.manifests.s_98bb6af6fe"),
  version: '0.6.0',
  contract: '^1.2.0',
  publisher: tr("api.mock.manifests.s_236087fd3c"),
  description: tr("api.mock.manifests.s_148f34b4b3"),
  icon: 'globe',
  category: 'productivity',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['vps', 'desktop'] },
  permissions: [{ scope: 'net.firefox.sync', reason: tr("api.mock.manifests.s_fa30601ff0") }],
  settings: [
    { key: 'syncAccount', type: 'string', label: tr("api.mock.manifests.s_432cf3eb07"), default: 'me@example.org' },
    { key: 'syncToken', type: 'secret', label: tr("api.mock.manifests.s_77c5737a48") },
  ],
  metrics: [
    { id: 'visits', label: tr("api.mock.manifests.s_7c516823ad"), kind: 'counter', unit: '', precision: 0, aggregations: ['sum'], visualizations: ['bar'] },
    { id: 'domains', label: tr("api.mock.manifests.s_e72915e46a"), kind: 'categorical', unit: '', aggregations: ['sum'], dimensions: [{ id: 'domain', label: tr("api.mock.manifests.s_98bda38eab") }], visualizations: ['breakdown'] },
  ],
};

// ---- registry-only (not installed) -------------------------------------------------

export const weather: PluginManifestInput = {
  id: 'dev.delta.weather',
  name: tr("api.mock.manifests.s_7175b8452c"),
  version: '1.0.3',
  contract: '^1.2.0',
  publisher: tr("api.mock.manifests.s_edabe0f9b1"),
  description: tr("api.mock.manifests.s_85abea0dae"),
  icon: 'cloud-sun',
  category: 'home',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['vps', 'sbc'] },
  permissions: [{ scope: 'net.http.outbound', reason: tr("api.mock.manifests.s_851337a34e") }],
  settings: [
    { key: 'lat', type: 'number', label: tr("api.mock.manifests.s_e4f7317068"), default: 56.84 },
    { key: 'lon', type: 'number', label: tr("api.mock.manifests.s_f22a3ecb8f"), default: 60.6 },
    { key: 'provider', type: 'select', label: tr("api.mock.manifests.s_8290a3dbc0"), default: 'open-meteo', options: [{ value: 'open-meteo', label: tr("api.mock.manifests.s_12d6303f4c") }, { value: 'local', label: tr("api.mock.manifests.s_47feafff40") }] },
  ],
  metrics: [
    { id: 'outdoor_temp', label: tr("api.mock.manifests.s_b4a41a4faa"), kind: 'gauge', unit: '°C', precision: 1, aggregations: ['avg', 'min', 'max'], visualizations: ['timeseries', 'stat'] },
    { id: 'pressure', label: tr("api.mock.manifests.s_aa017a589e"), kind: 'gauge', unit: tr("api.mock.manifests.s_d96200d057"), precision: 0, aggregations: ['avg'], visualizations: ['timeseries'] },
    { id: 'precip', label: tr("api.mock.manifests.s_158b93dbbb"), kind: 'counter', unit: tr("api.mock.manifests.s_b8d125b76d"), precision: 1, aggregations: ['sum'], visualizations: ['bar'] },
  ],
};

export const music: PluginManifestInput = {
  id: 'org.community.scrobbler',
  name: tr("api.mock.manifests.s_32f4ea59f9"),
  version: '0.4.0',
  contract: '^1.1.0',
  publisher: tr("api.mock.manifests.s_71c9934ed8"),
  description: tr("api.mock.manifests.s_50773d8d33"),
  icon: 'music',
  category: 'media',
  capabilities: ['metrics.timeseries', 'x-now-playing'],
  runtime: { targets: ['android', 'desktop'] },
  permissions: [{ scope: 'media.session.read', reason: tr("api.mock.manifests.s_7da440369d") }],
  settings: [{ key: 'minPlay', type: 'number', label: tr("api.mock.manifests.s_008aafaa1d"), default: 30, unit: tr("api.mock.manifests.s_b40bbca36d") }],
  metrics: [
    { id: 'plays', label: tr("api.mock.manifests.s_32f4ea59f9"), kind: 'counter', unit: '', precision: 0, aggregations: ['sum'], visualizations: ['bar', 'heatmap'] },
    { id: 'genres', label: tr("api.mock.manifests.s_3a856dcd9b"), kind: 'categorical', unit: '', aggregations: ['sum'], dimensions: [{ id: 'genre', label: tr("api.mock.manifests.s_aa8ab25302") }], visualizations: ['treemap', 'breakdown'] },
  ],
};

export const location: PluginManifestInput = {
  id: 'dev.delta.location',
  name: tr("api.mock.manifests.s_e35b24010e"),
  version: '0.9.0',
  contract: '^1.3.0',
  publisher: tr("api.mock.manifests.s_236087fd3c"),
  description: tr("api.mock.manifests.s_9cf09e2c9e"),
  icon: 'map-pin',
  category: 'location',
  capabilities: ['metrics.timeseries', 'x-geo-tiles', 'geo.tracks'],
  runtime: { targets: ['android'] },
  permissions: [{ scope: 'location.background', reason: tr("api.mock.manifests.s_8eace0f38a") }, { scope: 'location.history.read', reason: tr("api.mock.manifests.s_d94cc55526"), optional: true }],
  settings: [{ key: 'accuracy', type: 'select', label: tr("api.mock.manifests.s_913eea7e42"), default: 'balanced', options: [{ value: 'high', label: tr("api.mock.manifests.s_3670a3f8df") }, { value: 'balanced', label: tr("api.mock.manifests.s_dac16b6b95") }, { value: 'low', label: tr("api.mock.manifests.s_daf4e679c5") }] }],
  metrics: [
    { id: 'distance', label: tr("api.mock.manifests.s_353c4ff085"), kind: 'counter', unit: tr("api.mock.manifests.s_3ced3a0e89"), precision: 1, dimensions: [{ id: 'mode', label: tr("api.mock.manifests.s_9870437e70"), values: [{ id: 'walk', label: tr("api.mock.manifests.s_00ca91a1ef") }, { id: 'transit', label: tr("api.mock.manifests.s_e25d2d0eed") }, { id: 'car', label: tr("api.mock.manifests.s_5695330ffb") }] }], aggregations: ['sum'], visualizations: ['geo-map', 'bar'] },
    { id: 'places', label: tr("api.mock.manifests.s_a661590413"), kind: 'categorical', unit: 's', aggregations: ['sum'], dimensions: [{ id: 'place', label: tr("api.mock.manifests.s_8e2fe0254e") }], visualizations: ['geo-heat', 'breakdown'] },
  ],
};

export const reader: PluginManifestInput = {
  id: 'io.readwise.bridge',
  name: 'Readwise Bridge',
  version: '3.1.0',
  contract: '^2.0.0',
  publisher: tr("api.mock.manifests.s_b27deb66bc"),
  description: tr("api.mock.manifests.s_a518afda8c"),
  icon: 'book-open',
  category: 'media',
  capabilities: ['metrics.timeseries'],
  runtime: { targets: ['vps'] },
  permissions: [{ scope: 'net.readwise.read', reason: tr("api.mock.manifests.s_0086886af5") }],
  metrics: [{ id: 'highlights', label: tr("api.mock.manifests.s_b6b78aa3ad"), kind: 'counter', unit: '', aggregations: ['sum'] }],
};

/** Deliberately broken manifest to show schema errors in the catalog. */
export const legacyNotes: unknown = {
  id: 'NotesSync',
  name: 'Notes Sync (legacy)',
  version: '1.0',
  contract: '^0.9',
  publisher: tr("api.mock.manifests.s_50d8b4a941"),
  description: tr("api.mock.manifests.s_608b9342aa"),
  runtime: { targets: ['desktop', 'mainframe'] },
  metrics: [
    { id: 'notes', label: tr("api.mock.manifests.s_bbcf06b3c9"), kind: 'counter', aggregations: ['sum'] },
    { id: 'notes', label: tr("api.mock.manifests.s_333973aa5d"), kind: 'tally' },
  ],
};
