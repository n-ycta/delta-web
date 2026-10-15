import en from './en.json';
import ru from './ru.json';
export type UiLanguage = 'en' | 'ru';
const key = 'delta.language';
function initialLanguage(): UiLanguage {
  try { const saved = localStorage.getItem(key); if (saved === 'en' || saved === 'ru') return saved; } catch { /* SSR/tests */ }
  return 'en';
}
export const language: UiLanguage = initialLanguage();
export const locale = language === 'ru' ? 'ru-RU' : 'en-US';
const catalogs: Record<UiLanguage, Record<string, Record<string,string>>> = { en, ru };
export function setLanguage(next: UiLanguage): void {
  localStorage.setItem(key, next);
  // Reload recalculates module-level registry labels and validation messages consistently.
  location.reload();
}
export function tr(key: string, params: Record<string, unknown> = {}): string {
  const dot = key.lastIndexOf('.');
  const value = catalogs[language][key.slice(0, dot)]?.[key.slice(dot + 1)] ?? catalogs.en[key.slice(0, dot)]?.[key.slice(dot + 1)];
  if (value === undefined) throw new Error(`Missing i18n key: ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}
/** Legacy bundled demo manifests can be translated by their original catalog text. */
const legacy = new Map<string,string>();
for (const [part, entries] of Object.entries(ru)) for (const [key,value] of Object.entries(entries)) legacy.set(value, catalogs[language][part]?.[key] ?? value);
export function translateDemoText(text: string): string { return legacy.get(text) ?? text; }
