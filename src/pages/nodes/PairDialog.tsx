import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { useMutation } from '@/app/query';
import { Modal } from '@/ui/overlays';
import { Button, Field, Segmented } from '@/ui/primitives';
import { NODE_KIND_LABEL } from '@/core/contracts';
import type { PairingTicket } from '@/api';

export function PairDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState('vps');
  const [name, setName] = useState('');
  const [ticket, setTicket] = useState<PairingTicket | null>(null);
  const [now, setNow] = useState(Date.now());
  const create = useMutation((api) => api.createPairingTicket(kind, name || `${kind}-new`), { onSuccess: (t) => setTicket(t) });
  useEffect(() => { if (open) { setTicket(null); setName(''); } }, [open]);
  useEffect(() => { if (!ticket) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [ticket]);
  const left = ticket ? Math.max(0, Math.round((ticket.expiresAt - now) / 1000)) : 0;
  return (
    <Modal open={open} onClose={onClose} title="Подключить узел" footer={ticket ? <Button variant="primary" onClick={onClose}>Готово</Button> : <><Button variant="ghost" onClick={onClose}>Отмена</Button><Button variant="primary" loading={create.pending} onClick={() => create.run()}>Получить код</Button></>}>
      {!ticket ? (
        <div className="col gap-4">
          <Field label="Тип окружения"><Segmented sans value={kind} onChange={setKind} options={Object.entries(NODE_KIND_LABEL).map(([k, l]) => ({ value: k, label: l }))} /></Field>
          <Field label="Имя узла" help="Можно изменить позже; используется в журналах и командах"><input className="input mono" value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} placeholder={`${kind}-new`} /></Field>
          {create.error && <div className="field-error">{create.error.message}</div>}
        </div>
      ) : (
        <div className="col gap-4">
          <div className="col" style={{ alignItems: 'center', gap: 4, padding: '8px 0' }}>
            <div className="label">Код сопряжения</div>
            <div className="num" style={{ fontSize: 34, letterSpacing: '0.12em' }}>{ticket.code}</div>
            <div className="muted mono" style={{ fontSize: 12 }}>истекает через {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
          </div>
          <Field label={kind === 'android' ? 'На устройстве' : 'Выполните на узле'}>
            <div className="row"><pre className="code grow" style={{ whiteSpace: 'pre-wrap' }}>{ticket.command}</pre><Button iconOnly onClick={() => navigator.clipboard?.writeText(ticket.command)} title="Копировать"><Copy size={14} /></Button></div>
          </Field>
          <div className="muted" style={{ fontSize: 12 }}>Агент установит mTLS-соединение с ядром и появится в списке узлов. Код одноразовый.</div>
        </div>
      )}
    </Modal>
  );
}
