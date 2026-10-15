import ru from './ru.json';
/** Single-locale i18n. Catalog partitions follow source modules; no source text fallback. */
const catalog: Record<string, Record<string, string>> = ru;
export const locale = 'ru-RU';
export function tr(key: string, params: Record<string, unknown> = {}): string {
  const dot = key.lastIndexOf('.');
  const value = catalog[key.slice(0, dot)]?.[key.slice(dot + 1)];
  if (value === undefined) throw new Error(`Missing i18n key: ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}
