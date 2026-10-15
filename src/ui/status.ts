import { tr } from '@/i18n';
import type { NodeStatus, PluginStatus, Severity } from '@/core/contracts';

export type Tone = 'ok' | 'warn' | 'err' | 'crit' | 'info' | 'off' | 'accent';

export const PLUGIN_STATUS: Record<PluginStatus, { label: string; tone: Tone }> = {
  active: { label: tr("ui.status.s_667904ef22"), tone: 'ok' },
  degraded: { label: tr("ui.status.s_60c64dc0ea"), tone: 'warn' },
  error: { label: tr("ui.status.s_72aecd9ad8"), tone: 'err' },
  disabled: { label: tr("ui.status.s_c9467860d8"), tone: 'off' },
  installing: { label: tr("ui.status.s_057cbde0f6"), tone: 'info' },
  updating: { label: tr("ui.status.s_5c450e676f"), tone: 'info' },
  available: { label: tr("ui.status.s_11382e05ef"), tone: 'off' },
  incompatible: { label: tr("ui.status.s_e342f4dc62"), tone: 'err' },
};

export const NODE_STATUS: Record<NodeStatus, { label: string; tone: Tone }> = {
  online: { label: tr("ui.status.s_e858f4e3af"), tone: 'ok' },
  degraded: { label: tr("ui.status.s_60c64dc0ea"), tone: 'warn' },
  offline: { label: tr("ui.status.s_67b99cc9bf"), tone: 'err' },
  connecting: { label: tr("ui.status.s_40b27edf9a"), tone: 'info' },
};

export const SEVERITY_TONE: Record<Severity, Tone> = { debug: 'off', info: 'info', warn: 'warn', error: 'err', critical: 'crit' };
export const SEVERITY_LABEL: Record<Severity, string> = { debug: 'debug', info: 'info', warn: 'warn', error: 'error', critical: 'crit' };
