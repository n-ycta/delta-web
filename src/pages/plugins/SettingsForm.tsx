import { tr } from '@/i18n';
import { useEffect, useMemo, useState } from 'react';
import type { SettingField } from '@/core/contracts';
import { Confirm } from '@/ui/overlays';
import { Badge, Button, Field, Switch } from '@/ui/primitives';

export function defaultsOf(fields: SettingField[]) {
  return Object.fromEntries(
    fields.map((f) => [f.key, 'default' in f ? f.default : f.type === 'secret' ? '' : undefined]),
  );
}

function validate(f: SettingField, v: unknown): string | undefined {
  if (f.type === 'number') {
    if (v === '' || v === undefined || Number.isNaN(Number(v)))
      return tr('pages.plugins.SettingsForm.s_c78b4f55e7');
    if (f.min !== undefined && Number(v) < f.min)
      return tr('pages.plugins.SettingsForm.s_9ae2cbe3e5', { p0: f.min });
    if (f.max !== undefined && Number(v) > f.max)
      return tr('pages.plugins.SettingsForm.s_b00c609cf9', { p0: f.max });
  }
  if (f.type === 'string' && f.pattern && typeof v === 'string' && !new RegExp(f.pattern).test(v))
    return tr('pages.plugins.SettingsForm.s_00e77dc8eb');
  return undefined;
}

/**
 * Renders plugin settings purely from the manifest schema.
 * Secrets are never echoed back: the core stores them, the console only sends replacements.
 */
export function SettingsForm({
  fields,
  values,
  onSubmit,
  saving,
  disabled,
  submitLabel,
  allowPristine = false,
}: {
  fields: SettingField[];
  values: Record<string, unknown>;
  onSubmit: (v: Record<string, unknown>) => void;
  saving?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  allowPristine?: boolean;
}) {
  const initialKey = JSON.stringify([fields, values]);
  const initial = useMemo(() => ({ ...defaultsOf(fields), ...values }), [initialKey]);
  const [v, setV] = useState<Record<string, unknown>>(initial);
  const [confirmation, setConfirmation] = useState<SettingField | null>(null);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  useEffect(() => {
    setV(initial);
    setSecrets({});
    setAcknowledged([]);
    setConfirmation(null);
  }, [initial]);
  const errors = Object.fromEntries(
    fields.map((f) => [f.key, validate(f, v[f.key])]).filter(([, e]) => e),
  );
  const dirty = JSON.stringify(v) !== JSON.stringify(initial) || Object.keys(secrets).length > 0;
  const groups = [
    ...new Set(fields.map((f) => f.group ?? tr('pages.plugins.SettingsForm.s_eee2285ba1'))),
  ];
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));

  if (!fields.length)
    return <div className="muted">{tr('pages.plugins.SettingsForm.s_c81cb5a980')}</div>;
  return (
    <form
      className="plugin-settings"
      onSubmit={(e) => {
        e.preventDefault();
        if (!Object.keys(errors).length)
          onSubmit({
            ...Object.fromEntries(
              Object.entries(v).filter(
                ([key]) =>
                  !key.startsWith('_') && !fields.some((f) => f.key === key && f.type === 'secret'),
              ),
            ),
            ...(acknowledged.length ? { _confirmations: acknowledged } : {}),
            ...secrets,
          });
      }}
    >
      {groups.map((g) => (
        <div key={g} className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head">
            <span className="panel-title">{g}</span>
          </div>
          <div className="panel-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            {fields
              .filter((f) => (f.group ?? tr('pages.plugins.SettingsForm.s_eee2285ba1')) === g)
              .map((f) => (
                <div key={f.key} className="form-row">
                  <div>
                    <div
                      className="plugin-setting-label"
                      id={`setting-${f.key}-label`}
                      style={{ fontWeight: 500 }}
                    >
                      {f.label}
                    </div>
                    <div className="mono faint" style={{ fontSize: 11 }}>
                      {f.key}
                    </div>
                    {f.requiresRestart && (
                      <Badge tone="warn">{tr('pages.plugins.SettingsForm.s_8d255547a6')}</Badge>
                    )}
                  </div>
                  <Field help={f.help} error={errors[f.key]}>
                    {f.type === 'string' &&
                      (f.multiline ? (
                        <textarea
                          aria-labelledby={`setting-${f.key}-label`}
                          className="input"
                          rows={4}
                          disabled={disabled || saving}
                          value={String(v[f.key] ?? '')}
                          placeholder={f.placeholder}
                          onChange={(e) => set(f.key, e.target.value)}
                        />
                      ) : (
                        <input
                          aria-labelledby={`setting-${f.key}-label`}
                          className="input"
                          disabled={disabled || saving}
                          value={String(v[f.key] ?? '')}
                          placeholder={f.placeholder}
                          onChange={(e) => set(f.key, e.target.value)}
                        />
                      ))}
                    {f.type === 'secret' && (
                      <div className="row">
                        <input
                          aria-labelledby={`setting-${f.key}-label`}
                          className="input mono"
                          disabled={disabled || saving}
                          type="password"
                          autoComplete="new-password"
                          value={secrets[f.key] ?? ''}
                          placeholder={
                            (Array.isArray(values._configuredSecrets) &&
                              values._configuredSecrets.includes(f.key)) ||
                            !!values[f.key]
                              ? tr('pages.plugins.SettingsForm.s_530c963286')
                              : (f.placeholder ?? tr('pages.plugins.SettingsForm.s_55331e77f7'))
                          }
                          onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
                        />
                        <Button
                          type="button"
                          disabled={disabled || saving}
                          onClick={() => setSecrets((p) => ({ ...p, [f.key]: '' }))}
                        >
                          {tr('pluginData.clearSecret')}
                        </Button>
                        {(Array.isArray(values._configuredSecrets) &&
                          values._configuredSecrets.includes(f.key)) ||
                        !!values[f.key] ? (
                          <Badge tone="ok">{tr('pages.plugins.SettingsForm.s_681c395071')}</Badge>
                        ) : (
                          <Badge>{tr('pages.plugins.SettingsForm.s_1646d49eb7')}</Badge>
                        )}
                      </div>
                    )}
                    {f.type === 'number' && (
                      <div className="input-group" style={{ maxWidth: 240 }}>
                        <input
                          aria-labelledby={`setting-${f.key}-label`}
                          className={`input mono ${errors[f.key] ? 'invalid' : ''}`}
                          disabled={disabled || saving}
                          type="number"
                          step={f.step}
                          min={f.min}
                          max={f.max}
                          value={String(v[f.key] ?? '')}
                          onChange={(e) =>
                            set(f.key, e.target.value === '' ? '' : Number(e.target.value))
                          }
                        />
                        {f.unit && <span className="addon">{f.unit}</span>}
                      </div>
                    )}
                    {f.type === 'boolean' && (
                      <Switch
                        label={f.label}
                        disabled={disabled || saving}
                        checked={!!v[f.key]}
                        onChange={(b) => {
                          if (b && f.confirmation && !v[f.key]) setConfirmation(f);
                          else set(f.key, b);
                        }}
                      />
                    )}
                    {f.type === 'select' && (
                      <select
                        aria-labelledby={`setting-${f.key}-label`}
                        className="select"
                        disabled={disabled || saving}
                        style={{ maxWidth: 300 }}
                        value={String(v[f.key] ?? '')}
                        onChange={(e) => set(f.key, e.target.value)}
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {f.type === 'multiselect' && (
                      <div className="row wrap gap-1">
                        {f.options.map((o) => {
                          const arr = (v[f.key] as string[] | undefined) ?? [];
                          const on = arr.includes(o.value);
                          return (
                            <button
                              type="button"
                              key={o.value}
                              disabled={disabled || saving}
                              className="chip"
                              aria-pressed={on}
                              onClick={() =>
                                set(
                                  f.key,
                                  on ? arr.filter((x) => x !== o.value) : [...arr, o.value],
                                )
                              }
                            >
                              {o.label}
                            </button>
                          );
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
        <Button
          type="submit"
          variant="primary"
          disabled={(!dirty && !allowPristine) || !!Object.keys(errors).length || disabled}
          loading={saving}
          perm="plugins.manage"
        >
          {submitLabel ?? tr('pages.plugins.SettingsForm.s_87ae19737e')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty}
          onClick={() => {
            setV(initial);
            setSecrets({});
            setAcknowledged([]);
            setConfirmation(null);
          }}
        >
          {tr('pages.plugins.SettingsForm.s_058f162d29')}
        </Button>
        {dirty && (
          <span className="muted" style={{ fontSize: 12 }}>
            {tr('pages.plugins.SettingsForm.s_618362da69')}
          </span>
        )}
      </div>
      <Confirm
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        title={confirmation?.confirmation?.title ?? ''}
        body={confirmation?.confirmation?.body}
        confirmLabel={confirmation?.confirmation?.acceptLabel}
        danger
        onConfirm={() => {
          if (confirmation?.confirmation) {
            set(confirmation.key, true);
            setAcknowledged((a) => [...new Set([...a, confirmation.confirmation!.id])]);
          }
          setConfirmation(null);
        }}
      />
    </form>
  );
}
