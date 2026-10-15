import { language, translateDemoText } from '@/i18n';
const displayFields = new Set(['name','description','label','help','reason','placeholder','group','notes','alt']);
const ids = ['id','key','scope','value','version'];
function merge(base: any, patch: any): any {
  if (!base || typeof base !== 'object') return base;
  if (Array.isArray(base)) return base.map(item => {
    const id = ids.find(k => item && typeof item === 'object' && k in item);
    const override = Array.isArray(patch) && id ? patch.find(p => p?.[id] === item[id]) : undefined;
    return merge(item, override);
  });
  const result = { ...base };
  for (const [key,value] of Object.entries(base)) {
    if (key === 'notes' && Array.isArray(value) && Array.isArray(patch?.notes) && patch.notes.every((n: unknown) => typeof n === 'string')) result[key] = patch.notes;
    else if (displayFields.has(key) && typeof value === 'string') result[key] = typeof patch?.[key] === 'string' ? patch[key] : translateDemoText(value);
    else if (value && typeof value === 'object' && key !== 'localizations') result[key] = merge(value, patch?.[key]);
  }
  return result;
}
/** Locale patches are presentation-only: they cannot replace ids, versions, types or permission scopes. */
export function localizeManifest(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const m = raw as any;
  return merge(m, m.localizations?.[language] ?? m.localizations?.[m.defaultLocale ?? 'en']);
}
