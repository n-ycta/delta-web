import { tr } from '@/i18n';
import type { AuditEntry, CoreEvent, NodeInfo, Notification, PluginInstance, Principal } from '@/core/contracts';
import * as M from './manifests';

const now = () => Date.now();
const H = 3600e3, MIN = 60e3, D = 86400e3;
const GB = 1024 ** 3;

export const REGISTRY: { manifest: unknown; latest: unknown }[] = [
  { manifest: M.typing, latest: M.typingLatest },
  { manifest: M.health, latest: M.health },
  { manifest: M.finance, latest: M.finance },
  { manifest: M.git, latest: M.git },
  { manifest: M.home, latest: M.home },
  { manifest: M.screen, latest: M.screen },
  { manifest: M.browser, latest: M.browser },
  { manifest: M.weather, latest: M.weather },
  { manifest: M.music, latest: M.music },
  { manifest: M.location, latest: M.location },
  { manifest: M.reader, latest: M.reader },
  { manifest: M.legacyNotes, latest: M.legacyNotes },
];

const proc = (pid: number, name: string, component: string, cpu: number, memMb: number, status: NodeInfo['processes'][number]['status'] = 'running', restarts = 0) =>
  ({ pid, name, component, cpu, memMb, status, restarts, startedAt: now() - (pid % 13) * H - 2 * D });

export function seedNodes(): NodeInfo[] {
  const t = now();
  return [
    {
      id: 'fra-01', name: 'fra-01', kind: 'vps', os: 'Debian 12.7', arch: 'x86_64', address: '159.69.12.41', location: 'Hetzner · Falkenstein',
      status: 'online', lastSeen: t - 4000, uptimeSec: 41 * 86400 + 5 * 3600, agentVersion: '1.8.2', cpu: 23, cores: 4, memUsed: 5.1 * GB, memTotal: 8 * GB, diskUsed: 61 * GB, diskTotal: 160 * GB, latencyMs: 38,
      tags: ['core', 'prod'], pluginIds: ['dev.delta.finance', 'dev.delta.git', 'dev.delta.browser'],
      components: [
        { id: 'delta-core', name: 'delta-core', version: '2.3.1', latest: '2.3.1', status: 'ok', restartable: true },
        { id: 'delta-agent', name: 'delta-agent', version: '1.8.2', latest: '1.8.2', status: 'ok', restartable: true },
        { id: 'postgres', name: 'PostgreSQL', version: '16.4', status: 'ok', restartable: true },
        { id: 'nats', name: 'NATS JetStream', version: '2.10.21', status: 'ok', restartable: true },
        { id: 'console', name: 'delta-console', version: '0.9.0', status: 'ok', restartable: false },
      ],
      processes: [proc(812, 'delta-core', 'delta-core', 6.2, 412), proc(901, 'delta-agent', 'delta-agent', 1.1, 64), proc(377, 'postgres', 'postgres', 3.4, 1220), proc(455, 'nats-server', 'nats', 0.9, 180), proc(1220, 'plugin:finance', 'dev.delta.finance', 0.4, 96), proc(1221, 'plugin:git', 'dev.delta.git', 0.2, 71), proc(1290, 'plugin:browser', 'dev.delta.browser', 0, 0, 'crashed', 7)],
      connection: { transport: 'wss', endpoint: 'wss://core.delta.lan:7341/agent', heartbeatSec: 15, reconnect: 'exponential', maxBackoffSec: 120, tls: true, compression: true },
      allowedCommands: ['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache', 'update-agent', 'reboot', 'exec'],
      errors: [{ ts: t - 18 * MIN, code: 'AUTH_EXPIRED', message: tr("api.mock.seed.s_70b85abec9"), component: 'dev.delta.browser', count: 7 }],
    },
    {
      id: 'hel-02', name: 'hel-backup', kind: 'vps', os: 'Ubuntu 24.04', arch: 'aarch64', address: '65.21.140.7', location: 'Hetzner · Helsinki',
      status: 'degraded', lastSeen: t - 9000, uptimeSec: 12 * 86400, agentVersion: '1.7.4', cpu: 11, cores: 2, memUsed: 1.4 * GB, memTotal: 4 * GB, diskUsed: 74.2 * GB, diskTotal: 80 * GB, latencyMs: 46,
      tags: ['backup'], pluginIds: [],
      components: [
        { id: 'delta-agent', name: 'delta-agent', version: '1.7.4', latest: '1.8.2', status: 'outdated', restartable: true },
        { id: 'restic', name: 'restic', version: '0.17.1', status: 'ok', restartable: true },
        { id: 'replica', name: 'pg-replica', version: '16.4', status: 'error', restartable: true },
      ],
      processes: [proc(611, 'delta-agent', 'delta-agent', 0.8, 58), proc(702, 'restic', 'restic', 7.1, 310, 'sleeping'), proc(733, 'postgres (replica)', 'replica', 0, 0, 'stopped', 2)],
      connection: { transport: 'wss', endpoint: 'wss://core.delta.lan:7341/agent', heartbeatSec: 30, reconnect: 'exponential', maxBackoffSec: 300, tls: true, compression: true },
      allowedCommands: ['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache', 'update-agent', 'reboot'],
      errors: [
        { ts: t - 42 * MIN, code: 'DISK_PRESSURE', message: tr("api.mock.seed.s_51efa5be96"), component: 'replica', count: 1 },
        { ts: t - 3 * H, code: 'REPL_LAG', message: tr("api.mock.seed.s_b3eee24078"), component: 'replica', count: 4 },
      ],
    },
    {
      id: 'pixel-8', name: 'Pixel 8', kind: 'android', os: 'Android 15', arch: 'arm64-v8a', address: 'relay://pixel-8', location: tr("api.mock.seed.s_b80e9c3d89"),
      status: 'degraded', lastSeen: t - 95 * 1000, uptimeSec: 3 * 86400 + 7200, agentVersion: '1.8.1', cpu: 9, cores: 8, memUsed: 5.6 * GB, memTotal: 8 * GB, diskUsed: 88 * GB, diskTotal: 128 * GB,
      battery: { level: 0.34, charging: false }, latencyMs: 210, tempC: 34,
      tags: ['mobile', 'primary'], pluginIds: ['dev.delta.typing', 'dev.delta.health', 'dev.delta.screen', 'dev.delta.finance'],
      components: [
        { id: 'delta-agent', name: 'delta-agent (Android)', version: '1.8.1', latest: '1.8.2', status: 'outdated', restartable: true },
        { id: 'hc-bridge', name: 'Health Connect bridge', version: '0.5.0', status: 'ok', restartable: true },
        { id: 'ime-probe', name: 'IME probe', version: '2.4.1', status: 'ok', restartable: true },
      ],
      processes: [proc(4411, 'agent-service', 'delta-agent', 2.1, 140), proc(4470, 'hc-bridge', 'hc-bridge', 0.3, 48, 'sleeping'), proc(4502, 'ime-probe', 'ime-probe', 0.6, 33)],
      connection: { transport: 'adb-relay', endpoint: 'wss://core.delta.lan:7341/relay', heartbeatSec: 60, reconnect: 'exponential', maxBackoffSec: 900, tls: true, compression: true, meteredPolicy: 'essential' },
      allowedCommands: ['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache'],
      errors: [{ ts: t - 25 * MIN, code: 'DOZE_THROTTLED', message: tr("api.mock.seed.s_be6408da1b"), component: 'delta-agent', count: 3 }],
    },
    {
      id: 'tab-s9', name: 'Galaxy Tab S9', kind: 'android', os: 'Android 14 · One UI 6', arch: 'arm64-v8a', address: 'relay://tab-s9',
      status: 'offline', lastSeen: t - 3 * H - 14 * MIN, uptimeSec: 0, agentVersion: '1.8.2', cpu: 0, cores: 8, memUsed: 0, memTotal: 12 * GB, diskUsed: 140 * GB, diskTotal: 256 * GB,
      battery: { level: 0.08, charging: false },
      tags: ['mobile'], pluginIds: ['dev.delta.screen'],
      components: [{ id: 'delta-agent', name: 'delta-agent (Android)', version: '1.8.2', latest: '1.8.2', status: 'stopped', restartable: true }],
      processes: [],
      connection: { transport: 'adb-relay', endpoint: 'wss://core.delta.lan:7341/relay', heartbeatSec: 120, reconnect: 'exponential', maxBackoffSec: 900, tls: true, compression: true, meteredPolicy: 'paused' },
      allowedCommands: ['ping', 'sync-now', 'collect-logs'],
      errors: [{ ts: t - 3 * H - 15 * MIN, code: 'HEARTBEAT_LOST', message: tr("api.mock.seed.s_aba5a34a8b"), component: 'delta-agent', count: 1 }],
    },
    {
      id: 'ws', name: 'workstation', kind: 'desktop', os: 'Arch Linux · 6.11', arch: 'x86_64', address: '10.0.0.12', location: tr("api.mock.seed.s_99614a438e"),
      status: 'online', lastSeen: t - 2000, uptimeSec: 6 * 86400 + 4 * 3600, agentVersion: '1.8.2', cpu: 31, cores: 16, memUsed: 21.3 * GB, memTotal: 64 * GB, diskUsed: 1.1 * 1024 * GB, diskTotal: 2 * 1024 * GB, latencyMs: 2, tempC: 58,
      tags: ['primary', 'dev'], pluginIds: ['dev.delta.typing', 'dev.delta.git', 'dev.delta.screen'],
      components: [
        { id: 'delta-agent', name: 'delta-agent', version: '1.8.2', latest: '1.8.2', status: 'ok', restartable: true },
        { id: 'input-hook', name: 'input-hook (evdev)', version: '2.4.1', status: 'ok', restartable: true },
        { id: 'git-watch', name: 'git-watch', version: '1.2.0', status: 'ok', restartable: true },
      ],
      processes: [proc(2210, 'delta-agent', 'delta-agent', 0.9, 72), proc(2290, 'input-hook', 'input-hook', 1.4, 25), proc(2301, 'plugin:typing', 'dev.delta.typing', 0.6, 88), proc(2302, 'plugin:git', 'dev.delta.git', 0.1, 54), proc(2303, 'plugin:screen', 'dev.delta.screen', 0.2, 40)],
      connection: { transport: 'grpc', endpoint: 'core.delta.lan:7342', heartbeatSec: 10, reconnect: 'exponential', maxBackoffSec: 60, tls: true, compression: false },
      allowedCommands: ['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache', 'update-agent', 'reboot', 'exec'],
      errors: [],
    },
    {
      id: 'mba', name: 'macbook-air', kind: 'desktop', os: 'macOS 15.0', arch: 'arm64', address: '10.0.0.31', location: tr("api.mock.seed.s_f5979da89b"),
      status: 'online', lastSeen: t - 7000, uptimeSec: 2 * 86400, agentVersion: '1.8.2', cpu: 14, cores: 8, memUsed: 11.2 * GB, memTotal: 16 * GB, diskUsed: 301 * GB, diskTotal: 512 * GB, battery: { level: 0.81, charging: true }, latencyMs: 6,
      tags: ['laptop'], pluginIds: ['dev.delta.typing', 'dev.delta.screen'],
      components: [{ id: 'delta-agent', name: 'delta-agent', version: '1.8.2', latest: '1.8.2', status: 'ok', restartable: true }, { id: 'input-hook', name: 'input-hook (IOKit)', version: '2.4.1', status: 'ok', restartable: true }],
      processes: [proc(512, 'delta-agent', 'delta-agent', 0.7, 61), proc(540, 'input-hook', 'input-hook', 0.9, 22)],
      connection: { transport: 'grpc', endpoint: 'core.delta.lan:7342', heartbeatSec: 15, reconnect: 'exponential', maxBackoffSec: 120, tls: true, compression: false },
      allowedCommands: ['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache', 'update-agent'],
      errors: [],
    },
    {
      id: 'rpi-home', name: 'rpi-home', kind: 'sbc', os: 'Raspberry Pi OS 12', arch: 'aarch64', address: '10.0.0.5', location: tr("api.mock.seed.s_e91f67b8c6"),
      status: 'online', lastSeen: t - 3000, uptimeSec: 97 * 86400, agentVersion: '1.8.0', cpu: 17, cores: 4, memUsed: 1.9 * GB, memTotal: 4 * GB, diskUsed: 18 * GB, diskTotal: 64 * GB, tempC: 61, latencyMs: 3,
      tags: ['home', 'edge'], pluginIds: ['dev.delta.home'],
      components: [
        { id: 'delta-agent', name: 'delta-agent', version: '1.8.0', latest: '1.8.2', status: 'outdated', restartable: true },
        { id: 'z2m', name: 'zigbee2mqtt', version: '1.40.2', status: 'ok', restartable: true },
        { id: 'mosquitto', name: 'mosquitto', version: '2.0.18', status: 'ok', restartable: true },
      ],
      processes: [proc(330, 'delta-agent', 'delta-agent', 0.8, 52), proc(390, 'zigbee2mqtt', 'z2m', 4.3, 190), proc(402, 'mosquitto', 'mosquitto', 0.4, 12), proc(470, 'plugin:home', 'dev.delta.home', 1.2, 66)],
      connection: { transport: 'mqtt', endpoint: 'mqtts://core.delta.lan:8883', heartbeatSec: 20, reconnect: 'linear', maxBackoffSec: 60, tls: true, compression: false },
      allowedCommands: ['ping', 'sync-now', 'collect-logs', 'restart-component', 'clear-cache', 'update-agent', 'reboot'],
      errors: [],
    },
  ];
}

export function seedInstances(): Record<string, PluginInstance> {
  const t = now();
  const inst = (pluginId: string, status: PluginInstance['status'], installedVersion: string | undefined, latestVersion: string, nodeIds: string[], extra: Partial<PluginInstance> = {}): PluginInstance => ({
    pluginId, status, installedVersion, latestVersion, nodeIds, settings: {}, grantedPermissions: [], installedAt: installedVersion ? t - 40 * D : undefined, lastSyncAt: installedVersion ? t - 40e3 : undefined, ...extra,
  });
  return {
    'dev.delta.typing': inst('dev.delta.typing', 'active', '2.4.1', '2.5.0', ['ws', 'mba', 'pixel-8'], { grantedPermissions: ['input.keyboard.stats', 'apps.foreground.read'], eventsPerMin: 42 }),
    'dev.delta.health': inst('dev.delta.health', 'active', '1.9.0', '1.9.0', ['pixel-8'], { grantedPermissions: ['health.steps.read', 'health.heart.read', 'health.sleep.read'], eventsPerMin: 6, lastSyncAt: t - 95e3 }),
    'dev.delta.finance': inst('dev.delta.finance', 'active', '0.8.3', '0.8.3', ['fra-01', 'pixel-8'], { grantedPermissions: ['notifications.bank.read', 'storage.encrypted.write'], eventsPerMin: 0.4 }),
    'dev.delta.git': inst('dev.delta.git', 'active', '1.2.0', '1.2.0', ['ws', 'fra-01'], { grantedPermissions: ['fs.repos.read'], eventsPerMin: 1.2 }),
    'dev.delta.home': inst('dev.delta.home', 'degraded', '3.0.2', '3.0.2', ['rpi-home'], { grantedPermissions: ['net.mqtt.subscribe', 'devices.*'], eventsPerMin: 18, error: { code: 'SENSOR_STALE', message: tr("api.mock.seed.s_3c73665afa"), hint: tr("api.mock.seed.s_c38f151baf") } }),
    'dev.delta.screen': inst('dev.delta.screen', 'disabled', '1.1.4', '1.1.4', ['pixel-8', 'ws', 'mba', 'tab-s9'], { grantedPermissions: ['apps.usage.read'], lastSyncAt: t - 2 * D }),
    'dev.delta.browser': inst('dev.delta.browser', 'error', '0.6.0', '0.6.0', ['fra-01'], { grantedPermissions: ['net.firefox.sync'], lastSyncAt: t - 18 * 3600e3, error: { code: 'AUTH_EXPIRED', message: tr("api.mock.seed.s_a007f448c8"), hint: tr("api.mock.seed.s_1727038e5b") } }),
    'dev.delta.weather': inst('dev.delta.weather', 'available', undefined, '1.0.3', []),
    'org.community.scrobbler': inst('org.community.scrobbler', 'available', undefined, '0.4.0', []),
    'dev.delta.location': inst('dev.delta.location', 'available', undefined, '0.9.0', []),
    'io.readwise.bridge': inst('io.readwise.bridge', 'available', undefined, '3.1.0', []),
    'NotesSync': { pluginId: 'NotesSync', status: 'available', latestVersion: '1.0.0', nodeIds: [], settings: {}, grantedPermissions: [] },
  };
}

const EVENT_TEMPLATES: Omit<CoreEvent, 'id' | 'ts'>[] = [
  { severity: 'info', source: { type: 'plugin', id: 'dev.delta.typing', label: tr("api.mock.seed.s_114ae408c4") }, code: 'BATCH_INGESTED', message: tr("api.mock.seed.s_731b179ae3") },
  { severity: 'info', source: { type: 'node', id: 'fra-01', label: tr("api.mock.seed.s_22c46ac315") }, code: 'BACKUP_DONE', message: tr("api.mock.seed.s_ccf7717a71") },
  { severity: 'warn', source: { type: 'node', id: 'pixel-8', label: tr("api.mock.seed.s_cbac485ebb") }, code: 'DOZE_THROTTLED', message: tr("api.mock.seed.s_c2e01c50cd") },
  { severity: 'debug', source: { type: 'core', id: 'scheduler' }, code: 'JOB_TICK', message: tr("api.mock.seed.s_9934cca75c") },
  { severity: 'info', source: { type: 'plugin', id: 'dev.delta.home', label: tr("api.mock.seed.s_92f3f459ec") }, code: 'THRESHOLD', message: tr("api.mock.seed.s_360fe8f21f") },
  { severity: 'error', source: { type: 'plugin', id: 'dev.delta.browser', label: tr("api.mock.seed.s_98bb6af6fe") }, code: 'AUTH_EXPIRED', message: tr("api.mock.seed.s_876b92966f") },
  { severity: 'info', source: { type: 'auth', id: 'session' }, code: 'LOGIN', message: tr("api.mock.seed.s_545faaea66") },
  { severity: 'warn', source: { type: 'node', id: 'hel-02', label: tr("api.mock.seed.s_a75d100867") }, code: 'DISK_PRESSURE', message: tr("api.mock.seed.s_35ae088462") },
  { severity: 'info', source: { type: 'plugin', id: 'dev.delta.git', label: tr("api.mock.seed.s_473f89e442") }, code: 'COMMITS', message: tr("api.mock.seed.s_f6fd8dbd16") },
  { severity: 'info', source: { type: 'plugin', id: 'dev.delta.health', label: tr("api.mock.seed.s_cdb57ebc54") }, code: 'SLEEP_SESSION', message: tr("api.mock.seed.s_9c16c4a239") },
  { severity: 'debug', source: { type: 'node', id: 'rpi-home', label: tr("api.mock.seed.s_aba56a24ed") }, code: 'HEARTBEAT', message: tr("api.mock.seed.s_e6378ce473") },
];

let evtCounter = 0;
export function makeEvent(template?: Omit<CoreEvent, 'id' | 'ts'>, ts = now()): CoreEvent {
  const tpl = template ?? EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  return { ...tpl, id: `evt_${ts.toString(36)}_${(evtCounter++).toString(36)}`, ts };
}

export function seedEvents(): CoreEvent[] {
  const out: CoreEvent[] = [];
  let t = now() - 30 * 1000;
  for (let i = 0; i < 220; i++) {
    const tpl = EVENT_TEMPLATES[(i * 7 + (i % 5)) % EVENT_TEMPLATES.length];
    out.push(makeEvent(tpl, t));
    t -= (2 + ((i * 13) % 17)) * MIN;
  }
  out.push(makeEvent({ severity: 'critical', source: { type: 'node', id: 'tab-s9', label: tr("api.mock.seed.s_1f720a7657") }, code: 'HEARTBEAT_LOST', message: tr("api.mock.seed.s_528eff6fe3") }, now() - 3 * H + 5 * MIN));
  out.push(makeEvent({ severity: 'error', source: { type: 'node', id: 'hel-02', label: tr("api.mock.seed.s_a75d100867") }, code: 'REPL_STOPPED', message: tr("api.mock.seed.s_fb912df7f5") }, now() - 42 * MIN));
  return out.sort((a, b) => b.ts - a.ts);
}

export function seedNotifications(): Notification[] {
  const t = now();
  return [
    { id: 'n1', ts: t - 18 * MIN, severity: 'error', title: tr("api.mock.seed.s_d3e53e3d3f"), body: tr("api.mock.seed.s_62f1602cd6"), read: false, link: '/plugins/dev.delta.browser' },
    { id: 'n2', ts: t - 42 * MIN, severity: 'warn', title: tr("api.mock.seed.s_65d853ef92"), body: tr("api.mock.seed.s_cb11094b8b"), read: false, link: '/nodes/hel-02' },
    { id: 'n3', ts: t - 3 * H, severity: 'critical', title: tr("api.mock.seed.s_eddb416b7a"), body: tr("api.mock.seed.s_5f195e001b"), read: false, link: '/nodes/tab-s9' },
    { id: 'n4', ts: t - 5 * H, severity: 'info', title: tr("api.mock.seed.s_cbb195ae30"), body: tr("api.mock.seed.s_7b951ae370"), read: true, link: '/plugins/dev.delta.typing' },
    { id: 'n5', ts: t - 26 * H, severity: 'info', title: tr("api.mock.seed.s_5a1bdb9b79"), read: true },
  ];
}

export function seedPrincipals(): Principal[] {
  const t = now();
  return [
    { id: 'u_owner', name: tr("api.mock.seed.s_adb4032a9d"), email: 'owner@delta.lan', kind: 'user', role: 'owner', createdAt: t - 400 * D, lastActive: t, mfa: true },
    { id: 'u_anna', name: tr("api.mock.seed.s_435ab7fd8d"), email: 'anna@delta.lan', kind: 'user', role: 'analyst', createdAt: t - 60 * D, lastActive: t - 2 * D, mfa: true },
    { id: 'u_guest', name: tr("api.mock.seed.s_a0ee93b48a"), kind: 'user', role: 'viewer', createdAt: t - 20 * D, lastActive: t - 6 * H, mfa: false },
    { id: 't_ha', name: 'home-assistant', kind: 'token', role: 'operator', createdAt: t - 90 * D, lastActive: t - 4 * MIN, scopes: ['plugins.read', 'nodes.read', 'nodes.command'], tokenPreview: 'delta_pat_…3f9a', expiresAt: t + 275 * D },
    { id: 't_ci', name: 'ci-deploy', kind: 'token', role: 'operator', createdAt: t - 30 * D, lastActive: t - 3 * D, scopes: ['plugins.manage'], tokenPreview: 'delta_pat_…b71c', expiresAt: t + 5 * D },
    { id: 'nd_fra', name: 'agent@fra-01', kind: 'node', role: 'operator', createdAt: t - 300 * D, lastActive: t - 4000, scopes: ['agent.*'], tokenPreview: 'mTLS · SHA256:9C:41…' },
  ];
}

export function seedAudit(): AuditEntry[] {
  const t = now();
  const rows: [number, string, string, string][] = [
    [6 * MIN, tr("api.mock.seed.s_adb4032a9d"), 'plugin.settings.update', 'dev.delta.typing'],
    [50 * MIN, 'home-assistant', 'node.command.sync-now', 'rpi-home'],
    [3 * H, tr("api.mock.seed.s_adb4032a9d"), 'dashboard.save', tr("api.mock.seed.s_0d9af25998")],
    [8 * H, 'ci-deploy', 'plugin.update', 'dev.delta.health 1.8.2 → 1.9.0'],
    [26 * H, tr("api.mock.seed.s_435ab7fd8d"), 'dashboard.create', tr("api.mock.seed.s_1b3cfce4b5")],
    [2 * D, tr("api.mock.seed.s_adb4032a9d"), 'token.create', 'home-assistant'],
    [5 * D, tr("api.mock.seed.s_adb4032a9d"), 'permission.grant', 'dev.delta.typing → apps.foreground.read'],
  ];
  return rows.map(([ago, actor, action, target], i) => ({ id: `a${i}`, ts: t - ago, actor, action, target, ip: i % 2 ? '10.0.0.31' : '10.0.0.12' }));
}

export function pluginLogs(pluginId: string, n = 80) {
  const t = now();
  const msgs: [string, 'debug' | 'info' | 'warn' | 'error'][] = pluginId === 'dev.delta.browser'
    ? [['sync: GET /1.5/storage/history → 401', 'error'], ['token refresh failed: invalid_grant', 'error'], ['retry in 300s (attempt 7)', 'warn'], ['scheduler: next run 12:30', 'debug']]
    : pluginId === 'dev.delta.home'
      ? [['mqtt: zigbee2mqtt/office_co2 — no message for 2820s', 'warn'], ['ingest 18 readings', 'info'], ['threshold co2.bedroom crossed (1080 > 1000)', 'info'], ['mqtt keepalive ok', 'debug']]
      : [['flush buffer: 128 records → core', 'info'], ['rollup 5m complete', 'debug'], ['settings reloaded (live)', 'info'], ['upload latency 84ms', 'debug'], ['ws reconnect after 2s', 'warn']];
  return Array.from({ length: n }, (_, i) => {
    const [message, level] = msgs[(i * 3) % msgs.length];
    return { ts: t - i * 47e3 - (i % 4) * 9e3, level, message, nodeId: undefined };
  });
}
