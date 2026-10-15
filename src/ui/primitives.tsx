import { tr } from '@/i18n';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { Tone } from './status';
import { useCan } from '@/app/stores';
import type { ConsolePermission } from '@/core/contracts';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'accent' | 'danger' | 'danger-solid' | 'ghost';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  loading?: boolean;
  iconOnly?: boolean;
  /** disables & explains when the current role lacks the permission */
  perm?: ConsolePermission;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'default', size = 'md', icon, loading, iconOnly, perm, className = '', children, disabled, title, ...rest }, ref) {
  const allowed = useCan(perm ?? 'dashboards.read');
  const cls = ['btn', variant === 'danger-solid' ? 'danger solid' : variant !== 'default' ? variant : '', size === 'sm' ? 'sm' : '', iconOnly ? 'icon' : '', className].join(' ');
  return (
    <button ref={ref} className={cls} disabled={disabled || loading || !allowed} title={!allowed ? tr("ui.primitives.s_d5f2f33278", { p0: (perm) }) : title} {...rest}>
      {loading ? <Loader2 size={14} className="spin" /> : icon}
      {children}
    </button>
  );
});

export function Dot({ tone = 'off', pulse }: { tone?: Tone; pulse?: boolean }) {
  return <span className={`dot ${tone} ${pulse ? 'pulse' : ''}`} />;
}

export function Badge({ tone, mono, outline, children, title }: { tone?: Tone; mono?: boolean; outline?: boolean; children: ReactNode; title?: string }) {
  return <span title={title} className={`badge ${tone ?? ''} ${mono ? 'mono' : ''} ${outline ? 'outline' : ''}`}>{children}</span>;
}

export function StatusBadge({ tone, label, pulse }: { tone: Tone; label: string; pulse?: boolean }) {
  return <span className="row gap-1" style={{ gap: 6, fontSize: 12.5 }}><Dot tone={tone} pulse={pulse} /><span>{label}</span></span>;
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Segmented<T extends string>({ value, options, onChange, sans }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; sans?: boolean }) {
  return (
    <div className={`seg ${sans ? 'sans' : ''}`} role="group">
      {options.map((o) => <button key={o.value} type="button" title={o.title} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number; alert?: boolean }[] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" className="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}{t.count !== undefined && <span className={`count ${t.alert ? 'alert' : ''}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, help, error, children, extra }: { label?: ReactNode; help?: ReactNode; error?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}{extra}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : help ? <span className="field-help">{help}</span> : null}
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd>; }

export function Meter({ value, tone, title }: { value: number; tone?: 'ok' | 'warn' | 'err'; title?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const t = tone ?? (v > 0.9 ? 'err' : v > 0.75 ? 'warn' : undefined);
  return <div className={`meter ${t ?? ''}`} title={title}><span style={{ width: `${v * 100}%` }} /></div>;
}

export function PageHead({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="label" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, flush, className = '', meta }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; className?: string; meta?: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && <div className="panel-head"><div className="panel-title">{title}</div>{meta && <span className="widget-meta">{meta}</span>}<div className="spacer" />{actions}</div>}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}
