import type { NodeStatus, PluginStatus, Severity } from '@/core/contracts';

export type Tone = 'ok' | 'warn' | 'err' | 'crit' | 'info' | 'off' | 'accent';

export const PLUGIN_STATUS: Record<PluginStatus, { label: string; tone: Tone }> = {
  active: { label: 'Активен', tone: 'ok' },
  degraded: { label: 'Деградация', tone: 'warn' },
  error: { label: 'Ошибка', tone: 'err' },
  disabled: { label: 'Отключён', tone: 'off' },
  installing: { label: 'Установка…', tone: 'info' },
  updating: { label: 'Обновление…', tone: 'info' },
  available: { label: 'Не установлен', tone: 'off' },
  incompatible: { label: 'Несовместим', tone: 'err' },
};

export const NODE_STATUS: Record<NodeStatus, { label: string; tone: Tone }> = {
  online: { label: 'В сети', tone: 'ok' },
  degraded: { label: 'Деградация', tone: 'warn' },
  offline: { label: 'Не в сети', tone: 'err' },
  connecting: { label: 'Подключение…', tone: 'info' },
};

export const SEVERITY_TONE: Record<Severity, Tone> = { debug: 'off', info: 'info', warn: 'warn', error: 'err', critical: 'crit' };
export const SEVERITY_LABEL: Record<Severity, string> = { debug: 'debug', info: 'info', warn: 'warn', error: 'error', critical: 'crit' };
