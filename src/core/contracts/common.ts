import { z } from 'zod';

/** Version of the plugin ↔ panel contract implemented by this build of the console. */
export const PANEL_CONTRACT_VERSION = '1.4.0';
/** Contract range the console accepts from the core API itself. */
export const CORE_API_RANGE = '^2.0.0';

export const Severity = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
export type Severity = z.infer<typeof Severity>;

export const Id = z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9._:-]*$/i, 'Идентификатор: латиница, цифры, . _ : -');
export const ReverseDnsId = z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+){1,}$/, 'Ожидается обратная DNS-нотация, например dev.delta.typing');
export const SemverStr = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Ожидается semver, например 1.2.0');
export const IsoTime = z.string().datetime({ offset: true }).or(z.string().datetime());

export const TimeRangePreset = z.enum(['15m', '1h', '6h', '24h', '7d', '30d', '90d']);
export type TimeRangePreset = z.infer<typeof TimeRangePreset>;
export const TimeRange = z.union([
  z.object({ preset: TimeRangePreset }),
  z.object({ from: z.number(), to: z.number() }),
]);
export type TimeRange = z.infer<typeof TimeRange>;

export const PRESET_MS: Record<TimeRangePreset, number> = {
  '15m': 15 * 60e3, '1h': 3600e3, '6h': 6 * 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3, '90d': 90 * 86400e3,
};
export const PRESET_LABEL: Record<TimeRangePreset, string> = {
  '15m': '15 мин', '1h': '1 час', '6h': '6 часов', '24h': '24 часа', '7d': '7 дней', '30d': '30 дней', '90d': '90 дней',
};

export function resolveRange(r: TimeRange, now = Date.now()): { from: number; to: number } {
  if ('preset' in r) return { from: now - PRESET_MS[r.preset], to: now };
  return r;
}

/** Choose a bucket step that keeps charts around ~60–120 points. */
export function autoStep(spanMs: number): number {
  const candidates = [60e3, 5 * 60e3, 15 * 60e3, 3600e3, 3 * 3600e3, 6 * 3600e3, 86400e3, 7 * 86400e3];
  return candidates.find((c) => spanMs / c <= 120) ?? 7 * 86400e3;
}
