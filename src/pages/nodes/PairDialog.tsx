import { tr } from '@/i18n';
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { useMutation } from '@/app/query';
import { Modal } from '@/ui/overlays';
import { Button, Field, Segmented } from '@/ui/primitives';
import { NODE_KIND_LABEL } from '@/core/contracts';
import type { PairingTicket } from '@/api';

export function PairDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [hub,setHub]=useState(''),[device,setDevice]=useState(''),[trust,setTrust]=useState(false),[os,setOs]=useState('linux');
  const [kind, setKind] = useState('vps');
  const [name, setName] = useState('');
  const [ticket, setTicket] = useState<PairingTicket | null>(null);
  const [now, setNow] = useState(Date.now());
  const create = useMutation((api) => api.createPairingTicket(kind, name || `${kind}-new`), { onSuccess: (t) => setTicket(t) });
  useEffect(() => { if (open) { setTicket(null); setName(''); } }, [open]);
  useEffect(() => { if (!ticket) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [ticket]);
  const left = ticket ? Math.max(0, Math.round((ticket.expiresAt - now) / 1000)) : 0;
  const quote=(s:string)=>"'"+s.replaceAll("'",os==='linux'?"'\"'\"'":"''")+"'";
  const command=ticket?(os==='linux'?`curl -fsSL https://raw.githubusercontent.com/n-ycta/delta/main/install.sh -o /tmp/delta-install.sh && sh /tmp/delta-install.sh --plugins none --listen 0.0.0.0 --public-url ${quote(device)} --join-url ${quote(hub)} --join-code ${quote(ticket.code)} ${trust?'--trust-hub':''}`:`$p=Join-Path $env:TEMP 'delta-install.ps1'; Invoke-WebRequest https://raw.githubusercontent.com/n-ycta/delta/main/install.ps1 -OutFile $p; & $p -Plugins 'none' -Listen '0.0.0.0' -PublicUrl ${quote(device)} -JoinUrl ${quote(hub)} -JoinCode ${quote(ticket.code)} ${trust?'-TrustHub':''}`):'';
  return (
    <Modal open={open} onClose={onClose} title={tr("pages.nodes.PairDialog.s_3f9a7c101f")} footer={ticket ? <Button variant="primary" onClick={onClose}>{tr("pages.nodes.PairDialog.s_398c7d4f7b")}</Button> : <><Button variant="ghost" onClick={onClose}>{tr("pages.nodes.PairDialog.s_0ec753be8d")}</Button><Button variant="primary" loading={create.pending} disabled={!/^https?:\/\//.test(hub)||!/^https?:\/\//.test(device)} onClick={() => create.run()}>{tr("pages.nodes.PairDialog.s_7c5f96cd82")}</Button></>}>
      {!ticket ? (
        <div className="col gap-4">
          <p className="muted">{tr('polish.remoteHint')}</p>
          <Field label={tr('polish.hubUrl')}><input className="input" value={hub} onChange={e=>setHub(e.target.value)} /></Field>
          <Field label={tr('polish.deviceUrl')}><input className="input" value={device} onChange={e=>setDevice(e.target.value)} /></Field>
          <select className="select" value={os} onChange={e=>setOs(e.target.value)}><option value="linux">{'Linux'}</option><option value="windows">{'Windows'}</option></select>
          <label className="check"><input type="checkbox" checked={trust} onChange={e=>setTrust(e.target.checked)} />{tr('polish.trustHub')}</label>
          <Field label={tr("pages.nodes.PairDialog.s_56ef096f5e")}><Segmented sans value={kind} onChange={setKind} options={Object.entries(NODE_KIND_LABEL).map(([k, l]) => ({ value: k, label: l }))} /></Field>
          <Field label={tr("pages.nodes.PairDialog.s_7cb0561bcc")} help={tr("pages.nodes.PairDialog.s_42326c20c8")}><input className="input mono" value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} placeholder={`${kind}-new`} /></Field>
          {create.error && <div className="field-error">{create.error.message}</div>}
        </div>
      ) : (
        <div className="col gap-4">
          <div className="col" style={{ alignItems: 'center', gap: 4, padding: '8px 0' }}>
            <div className="label">{tr("pages.nodes.PairDialog.s_7463fb8caa")}</div>
            <div className="num" style={{ fontSize: 34, letterSpacing: '0.12em' }}>{ticket.code}</div>
            <div className="muted mono" style={{ fontSize: 12 }}>{tr("pages.nodes.PairDialog.s_e858964b98")}{Math.floor(left / 60)}{tr("pages.nodes.PairDialog.s_05a79f06cf")}{String(left % 60).padStart(2, '0')}</div>
          </div>
          <Field label={kind === 'android' ? tr("pages.nodes.PairDialog.s_b58eb11658") : tr("pages.nodes.PairDialog.s_562381ef14")}>
            <div className="row"><pre className="code grow" style={{ whiteSpace: 'pre-wrap' }}>{command}</pre><Button iconOnly onClick={() => navigator.clipboard?.writeText(command)} title={tr("pages.nodes.PairDialog.s_4a05d8619d")}><Copy size={14} /></Button></div>
          </Field>
          <div className="muted" style={{ fontSize: 12 }}>{tr("pages.nodes.PairDialog.s_e3302a6b4d")}</div>
        </div>
      )}
    </Modal>
  );
}
