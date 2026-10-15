import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './primitives';

function useEscape(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, active]);
}

export function Modal({ open, onClose, title, children, footer, wide, icon }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; icon?: ReactNode }) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">{icon}<div className="modal-title grow">{title}</div><Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Закрыть"><X size={15} /></Button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>, document.body);
}

export function Drawer({ open, onClose, title, children, footer, wide, sub }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><div className="grow" style={{ minWidth: 0 }}><div className="modal-title truncate">{title}</div>{sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}</div><Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Закрыть"><X size={15} /></Button></div>
        <div className="modal-body" style={{ flex: 1 }}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </aside>
    </>, document.body);
}

export interface MenuEntry { label?: string; icon?: ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean; title?: string; separator?: boolean; header?: string }

/** Anchored dropdown menu. */
export function Menu({ trigger, items, align = 'end' }: { trigger: (p: { onClick: (e: React.MouseEvent) => void; 'aria-expanded': boolean }) => ReactNode; items: MenuEntry[]; align?: 'start' | 'end' }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  useEscape(() => setAnchor(null), !!anchor);
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let left = align === 'end' ? anchor.right - r.width : anchor.left;
    left = Math.max(8, Math.min(left, window.innerWidth - r.width - 8));
    let top = anchor.bottom + 4;
    if (top + r.height > window.innerHeight - 8) top = anchor.top - r.height - 4;
    setPos({ top, left });
  }, [anchor, align]);
  useEffect(() => {
    if (!anchor) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAnchor(null); };
    const s = () => setAnchor(null);
    setTimeout(() => window.addEventListener('mousedown', h));
    window.addEventListener('scroll', s, true);
    return () => { window.removeEventListener('mousedown', h); window.removeEventListener('scroll', s, true); };
  }, [anchor]);
  return (
    <>
      {trigger({ onClick: (e) => { e.stopPropagation(); setAnchor(anchor ? null : (e.currentTarget as HTMLElement).getBoundingClientRect()); }, 'aria-expanded': !!anchor })}
      {anchor && createPortal(
        <div ref={ref} className="menu" role="menu" style={pos} onMouseDown={(e) => e.stopPropagation()}>
          {items.map((it, i) => it.separator ? <div key={i} className="menu-sep" /> : it.header ? <div key={i} className="menu-label label">{it.header}</div> : (
            <button key={i} role="menuitem" className={`menu-item ${it.danger ? 'danger' : ''}`} disabled={it.disabled} title={it.title} onClick={(e) => { e.stopPropagation(); setAnchor(null); it.onSelect?.(); }}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>, document.body)}
    </>
  );
}

/** Confirmation dialog; for destructive actions can require typing the resource name. */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = 'Подтвердить', danger, requireText, loading, children }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean; requireText?: string; loading?: boolean; children?: ReactNode;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const ok = !requireText || text.trim() === requireText;
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<>
      <Button variant="ghost" onClick={onClose}>Отмена</Button>
      <Button variant={danger ? 'danger-solid' : 'primary'} disabled={!ok} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
    </>}>
      <div className="col gap-3">
        {body && <div className="ink2">{body}</div>}
        {children}
        {requireText && (
          <label className="field">
            <span className="field-help">Введите <code>{requireText}</code> для подтверждения</span>
            <input className="input mono" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </label>
        )}
      </div>
    </Modal>
  );
}
