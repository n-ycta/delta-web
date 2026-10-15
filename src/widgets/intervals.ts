import { PRESET_MS, type TimeRangePreset } from '@/core/contracts';
export const BUCKET_INTERVALS = [60000, 300000, 900000, 1800000, 3600000, 10800000, 21600000, 86400000, 604800000];
/** Preserve the requested cadence unless the server's 2,000-bucket safety limit requires coarsening. */
export function queryStep(requested: number | null | undefined, range: TimeRangePreset): number | undefined {
  if (!requested) return undefined;
  const minimum = PRESET_MS[range] / 2000;
  return requested >= minimum ? requested : BUCKET_INTERVALS.find(step => step >= minimum);
}
