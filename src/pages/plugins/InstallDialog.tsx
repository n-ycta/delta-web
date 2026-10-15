import { tr } from '@/i18n';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { PluginEntry } from '@/core/contracts';
import { NODE_KIND_LABEL } from '@/core/contracts';
import { useNodes } from '@/app/data';
import { useMutation } from '@/app/query';
import { toast } from '@/app/stores';
import { Modal } from '@/ui/overlays';
import { Badge, Button, Dot } from '@/ui/primitives';
import { Icon } from '@/ui/Icon';
import { NODE_STATUS } from '@/ui/status';
import { defaultsOf } from './SettingsForm';
import { compare } from '@/core/lib/semver';

/** Three-step install: compatibility & nodes → permissions review → confirm. */
export function InstallDialog({ entry, open, onClose }: { entry: PluginEntry; open: boolean; onClose: () => void }) {
  const m = entry.latest;
  const nodes = useNodes();
  const [step, setStep] = useState(0);
  const [nodeIds, setNodeIds] = useState<string[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const eligible = (nodes.data ?? []).filter((n) => m.runtime.targets.includes(n.kind));
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setNodeIds(eligible.filter((n) => n.status !== 'offline').map((n) => n.id).slice(0, 2));
    setPerms(m.permissions.filter((p) => !p.optional).map((p) => p.scope));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const install = useMutation((api) => api.installPlugin(m.id, { nodeIds, permissions: perms, settings: defaultsOf(m.settings) }), {
    invalidate: ['plugins'],
    onSuccess: () => { toast({ severity: 'info', title: tr("pages.plugins.InstallDialog.s_0d1c65dc59", { p0: (m.name) }), body: tr("pages.plugins.InstallDialog.s_8f09862c6a") }); onClose(); },
  });
  const steps = [tr("pages.plugins.InstallDialog.s_3293ac18db"), tr("pages.plugins.InstallDialog.s_f4470c5797"), tr("pages.plugins.InstallDialog.s_846aff7071")];
  return (
    <Modal open={open} onClose={onClose} wide icon={<span className="plug-icon"><Icon name={m.icon} size={16} /></span>} title={<>{tr("pages.plugins.InstallDialog.s_405c1bad63")}{m.name}{tr("pages.plugins.InstallDialog.s_34708f502e")}<span className="muted mono" style={{ fontSize: 12, fontWeight: 400 }}>{m.version}</span></>}
      footer={<>
        <span className="row grow" style={{ gap: 14 }}>{steps.map((s, i) => <span key={s} className={i === step ? '' : 'muted'} style={{ fontSize: 12, fontWeight: i === step ? 600 : 400 }}>{i + 1}{tr("pages.plugins.InstallDialog.s_94c67da09e")}{s}</span>)}</span>
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>{tr("pages.plugins.InstallDialog.s_f6dab074d7")}</Button>}
        {step < 2 ? <Button variant="primary" disabled={step === 0 && !nodeIds.length} onClick={() => setStep(step + 1)}>{tr("pages.plugins.InstallDialog.s_9c714cf25e")}</Button>
          : <Button variant="primary" loading={install.pending} onClick={() => install.run()}>{tr("pages.plugins.InstallDialog.s_ce88d35b18")}</Button>}
      </>}>
      {install.error && <div className="banner err" style={{ borderRadius: 6, marginBottom: 12 }}>{install.error.message}</div>}
      {step === 0 && (
        <div className="col gap-3">
          <div className="muted">{tr("pages.plugins.InstallDialog.s_1a94698e9d")}{m.runtime.targets.map((t) => <Badge key={t}>{NODE_KIND_LABEL[t]}</Badge>)} {m.runtime.minAgent && <>{tr("pages.plugins.InstallDialog.s_78e7e3ab08")}<code>{m.runtime.minAgent}</code></>}</div>
          {eligible.length === 0 && <div className="banner warn" style={{ borderRadius: 6 }}>{tr("pages.plugins.InstallDialog.s_e0c0b2243c")}</div>}
          <div className="panel">
            {eligible.map((n) => {
              const old = !!m.runtime.minAgent && compare(n.agentVersion, m.runtime.minAgent) < 0;
              return (
                <label key={n.id} className="row" style={{ padding: '9px 14px', borderBottom: '1px solid var(--rule)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={nodeIds.includes(n.id)} onChange={(e) => setNodeIds(e.target.checked ? [...nodeIds, n.id] : nodeIds.filter((x) => x !== n.id))} />
                  <Dot tone={NODE_STATUS[n.status].tone} />
                  <span style={{ fontWeight: 500 }}>{n.name}</span><span className="muted">{NODE_KIND_LABEL[n.kind]} {tr("pages.plugins.InstallDialog.s_d3dacf895c")}{n.os}</span>
                  <span className="spacer" />
                  {n.status === 'offline' && <Badge tone="warn">{tr("pages.plugins.InstallDialog.s_345ebe32be")}</Badge>}
                  {old && <Badge tone="warn">{tr("pages.plugins.InstallDialog.s_d28654e1e7")}{n.agentVersion} {tr("pages.plugins.InstallDialog.s_ac3abe28a6")}</Badge>}
                </label>
              );
            })}
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="col gap-3">
          <div className="muted">{tr("pages.plugins.InstallDialog.s_e6ad1a6e69")}</div>
          <div className="panel">
            {m.permissions.map((p) => (
              <label key={p.scope} className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--rule)', alignItems: 'flex-start', cursor: p.optional ? 'pointer' : 'default' }}>
                <input type="checkbox" disabled={!p.optional} checked={perms.includes(p.scope)} onChange={(e) => setPerms(e.target.checked ? [...perms, p.scope] : perms.filter((x) => x !== p.scope))} style={{ marginTop: 3 }} />
                <span className="col grow" style={{ gap: 2 }}>
                  <span className="row"><code>{p.scope}</code>{p.optional ? <Badge>{tr("pages.plugins.InstallDialog.s_8bf2ee2944")}</Badge> : <Badge tone="info">{tr("pages.plugins.InstallDialog.s_3adffd9fc9")}</Badge>}{p.scope.endsWith('*') && <Badge tone="warn"><ShieldAlert size={11} />{tr("pages.plugins.InstallDialog.s_a2ed5933dc")}</Badge>}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{p.reason}</span>
                </span>
              </label>
            ))}
            {!m.permissions.length && <div className="panel-body muted">{tr("pages.plugins.InstallDialog.s_b67ca75ffa")}</div>}
          </div>
        </div>
      )}
      {step === 2 && (
        <dl className="kv">
          <dt>{tr("pages.plugins.InstallDialog.s_f79d7e1e29")}</dt><dd><code>{m.id}{tr("pages.plugins.InstallDialog.s_9a78211436")}{m.version}</code> {tr("pages.plugins.InstallDialog.s_d3dacf895c")}{m.publisher}</dd>
          <dt>{tr("pages.plugins.InstallDialog.s_2ff930d7e7")}</dt><dd><code>{m.contract}</code> {entry.validation.issues.length ? <Badge tone="warn">{entry.validation.issues.length} {tr("pages.plugins.InstallDialog.s_00c5805d94")}</Badge> : <Badge tone="ok">{tr("pages.plugins.InstallDialog.s_ce79c859fc")}</Badge>}</dd>
          <dt>{tr("pages.plugins.InstallDialog.s_3293ac18db")}</dt><dd>{nodeIds.map((id) => nodes.data?.find((n) => n.id === id)?.name).join(', ')}</dd>
          <dt>{tr("pages.plugins.InstallDialog.s_f4470c5797")}</dt><dd>{perms.map((p) => <code key={p} style={{ marginRight: 8 }}>{p}</code>)}</dd>
          <dt>{tr("pages.plugins.InstallDialog.s_3aeb33af51")}</dt><dd>{m.metrics.map((x) => x.label).join(', ') || '—'}</dd>
          <dt>{tr("pages.plugins.InstallDialog.s_f5c9001f43")}</dt><dd>{tr("pages.plugins.InstallDialog.s_760a828671")}{m.metrics.length} {tr("pages.plugins.InstallDialog.s_2040e4e5b5")}</dd>
        </dl>
      )}
    </Modal>
  );
}
