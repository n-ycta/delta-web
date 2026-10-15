import { X } from 'lucide-react';
import { useUi } from '@/app/stores';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.severity}`}>
          <span className="bar" />
          <div className="grow">
            <div style={{ fontWeight: 500 }}>{t.title}</div>
            {t.body && <div className="t-body">{t.body}</div>}
            {t.action && <button className="t-action" style={{ marginTop: 6 }} onClick={() => { t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          </div>
          <button onClick={() => dismiss(t.id)} aria-label="Закрыть"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
