import type { SettingCondition, SettingField } from '@/core/contracts';

export function matchesCondition(
  condition: SettingCondition,
  values: Record<string, unknown>,
): boolean {
  if ('all' in condition) return condition.all.every((c) => matchesCondition(c, values));
  if ('any' in condition) return condition.any.some((c) => matchesCondition(c, values));
  if ('not' in condition) return !matchesCondition(condition.not, values);
  // Missing values never satisfy a leaf (including a null comparison).
  if (
    !Object.prototype.hasOwnProperty.call(values, condition.key) ||
    values[condition.key] === undefined
  )
    return false;
  return 'oneOf' in condition
    ? condition.oneOf.some((x) => Object.is(x, values[condition.key]))
    : Object.is(condition.equals, values[condition.key]);
}
export function isSettingVisible(field: SettingField, values: Record<string, unknown>) {
  return !field.visibleWhen || matchesCondition(field.visibleWhen, values);
}
/** Hidden fields remain in the draft and on the node; hidden edits/secrets are not submitted. */
export function settingsPayload(
  fields: SettingField[],
  values: Record<string, unknown>,
  secrets: Record<string, string>,
) {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.key.startsWith('_') || !isSettingVisible(f, values)) continue;
    if (f.type === 'secret') {
      if (Object.prototype.hasOwnProperty.call(secrets, f.key)) payload[f.key] = secrets[f.key];
    } else if (Object.prototype.hasOwnProperty.call(values, f.key)) payload[f.key] = values[f.key];
  }
  return payload;
}
