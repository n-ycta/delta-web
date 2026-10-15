import { useEffect, useMemo, useState } from 'react';
import type { SettingField } from '@/core/contracts';
import { Badge, Button, Field, Switch } from '@/ui/primitives';

export function defaultsOf(fields: SettingField[]) {
  return Object.fromEntries(fields.map((f) => [f.key, 'default' in f ? f.default : f.type === 'secret' ? '' : undefined]));
}

function validate(f: SettingField, v: unknown): string | undefined {
  if (f.type === 'number') {
    if (v === '' || v === undefined || Number.isNaN(Number(v))) return 'Введите число';
    if (f.min !== undefined && Number(v) < f.min) return `Минимум ${f.min}`;
    if (f.max !== undefined && Number(v) > f.max) return `Максимум ${f.max}`;
  }
  if (f.type === 'string' && f.pattern && typeof v === 'string' && !new RegExp(f.pattern).test(v)) return 'Неверный формат';
  return undefined;
}

/**
 * Renders plugin settings purely from the manifest schema.
 * Secrets are never echoed back: the core stores them, the console only sends replacements.
 */
export function SettingsForm({ fields, values, onSubmit, saving, disabled }: { fields: SettingField[]; values: Record<string, unknown>; onSubmit: (v: Record<string, unknown>) => void; saving?: boolean; disabled?: boolean }) {
  const initial = useMemo(() => ({ ...defaultsOf(fields), ...values }), [fields, values]);
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  useEffect(() => { setV(initial); setSecrets({}); }, [initial]);
  const errors = Object.fromEntries(fields.map((f) => [f.key, validate(f, v[f.key])]).filter(([, e]) => e));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial) || Object.values(secrets).some(Boolean);
  const groups = [...new Set(fields.map((f) => f.group ?? 'Основные'))];
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));

  if (!fields.length) return <div className="muted">Плагин не объявляет настраиваемых параметров.</div>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!Object.keys(errors).length) onSubmit({ ...v, ...Object.fromEntries(Object.entries(secrets).filter(([, s]) => s)) }); }}>
      {groups.map((g) => (
        <div key={g} className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head"><span className="panel-title">{g}</span></div>
          <div className="panel-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            {fields.filter((f) => (f.group ?? 'Основные') === g).map((f) => (
              <div key={f.key} className="form-row">
                <div>
                  <div style={{ fontWeight: 500 }}>{f.label}</div>
                  <div className="mono faint" style={{ fontSize: 11 }}>{f.key}</div>
                  {f.requiresRestart && <Badge tone="warn">нужен перезапуск</Badge>}
                </div>
                <Field help={f.help} error={errors[f.key]}>
                  {f.type === 'string' && <input className="input" disabled={disabled} value={String(v[f.key] ?? '')} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />}
                  {f.type === 'secret' && (
                    <div className="row">
                      <input className="input mono" disabled={disabled} type="password" autoComplete="new-password" value={secrets[f.key] ?? ''} placeholder={values[f.key] ? '•••••••• (задан — введите для замены)' : f.placeholder ?? 'не задан'} onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))} />
                      {values[f.key] ? <Badge tone="ok">задан</Badge> : <Badge>пусто</Badge>}
                    </div>
                  )}
                  {f.type === 'number' && (
                    <div className="input-group" style={{ maxWidth: 240 }}>
                      <input className={`input mono ${errors[f.key] ? 'invalid' : ''}`} disabled={disabled} type="number" step={f.step} min={f.min} max={f.max} value={String(v[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
                      {f.unit && <span className="addon">{f.unit}</span>}
                    </div>
                  )}
                  {f.type === 'boolean' && <Switch disabled={disabled} checked={!!v[f.key]} onChange={(b) => set(f.key, b)} />}
                  {f.type === 'select' && <select className="select" disabled={disabled} style={{ maxWidth: 300 }} value={String(v[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
                  {f.type === 'multiselect' && (
                    <div className="row wrap gap-1">
                      {f.options.map((o) => {
                        const arr = (v[f.key] as string[] | undefined) ?? [];
                        const on = arr.includes(o.value);
                        return <button type="button" key={o.value} disabled={disabled} className="chip" aria-pressed={on} onClick={() => set(f.key, on ? arr.filter((x) => x !== o.value) : [...arr, o.value])}>{o.label}</button>;
                      })}
                    </div>
                  )}
                </Field>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="row">
        <Button type="submit" variant="primary" disabled={!dirty || !!Object.keys(errors).length || disabled} loading={saving} perm="plugins.manage">Сохранить настройки</Button>
        <Button type="button" variant="ghost" disabled={!dirty} onClick={() => { setV(initial); setSecrets({}); }}>Сбросить</Button>
        {dirty && <span className="muted" style={{ fontSize: 12 }}>изменения не сохранены</span>}
      </div>
    </form>
  );
}
