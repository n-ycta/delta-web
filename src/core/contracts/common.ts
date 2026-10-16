import { tr } from '@/i18n';
import { z } from 'zod';

/** Version of the plugin ↔ panel contract implemented by this build of the console. */
export const PANEL_CONTRACT_VERSION = '1.6.0';
/** Contract range the console accepts from the core API itself. */
export const CORE_API_RANGE = '^1.0.0';

export const Severity = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
export type Severity = z.infer<typeof Severity>;

export const Id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._:-]*$/i, tr('core.contracts.common.s_07fc5fb2b5'));
export const ReverseDnsId = z
  .string()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+){1,}$/, tr('core.contracts.common.s_4a1e693123'));
export const SemverStr = z
  .string()
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, tr('core.contracts.common.s_405710521f'));
export const IsoTime = z.string().datetime({ offset: true }).or(z.string().datetime());

export const TimeRangePreset = z.enum(['15m', '1h', '6h', '24h', '7d', '30d', '90d']);
export type TimeRangePreset = z.infer<typeof TimeRangePreset>;
export const TimeRange = z.union([
  z.object({ preset: TimeRangePreset }),
  z.object({ from: z.number(), to: z.number() }),
]);
export type TimeRange = z.infer<typeof TimeRange>;

export const PRESET_MS: Record<TimeRangePreset, number> = {
  '15m': 15 * 60e3,
  '1h': 3600e3,
  '6h': 6 * 3600e3,
  '24h': 86400e3,
  '7d': 7 * 86400e3,
  '30d': 30 * 86400e3,
  '90d': 90 * 86400e3,
};
export const PRESET_LABEL: Record<TimeRangePreset, string> = {
  '15m': tr('core.contracts.common.s_5a86194fa8'),
  '1h': tr('core.contracts.common.s_e5f1687baa'),
  '6h': tr('core.contracts.common.s_915bfe2c70'),
  '24h': tr('core.contracts.common.s_e14e414b71'),
  '7d': tr('core.contracts.common.s_e65da6ce30'),
  '30d': tr('core.contracts.common.s_fb925c5d79'),
  '90d': tr('core.contracts.common.s_c85eb5f581'),
};

export function resolveRange(r: TimeRange, now = Date.now()): { from: number; to: number } {
  if ('preset' in r) return { from: now - PRESET_MS[r.preset], to: now };
  return r;
}

/** Choose a bucket step that keeps charts around ~60–120 points. */
export function autoStep(spanMs: number): number {
  const candidates = [
    60e3,
    5 * 60e3,
    15 * 60e3,
    3600e3,
    3 * 3600e3,
    6 * 3600e3,
    86400e3,
    7 * 86400e3,
  ];
  return candidates.find((c) => spanMs / c <= 120) ?? 7 * 86400e3;
}
