import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { tr, locale } from '@/i18n';
import { useApi } from '@/app/ApiContext';
import { useQuery, useMutation } from '@/app/query';
import { useRuntimeAccess, toast } from '@/app/stores';
import { Button, Panel, Switch, Field, Badge } from '@/ui/primitives';
import { Confirm } from '@/ui/overlays';
import type { UpdateSettings } from '@/api/updates';
const text = (code?: string) => tr('updates.' + (code || 'operation_failed'));
export function Updates() {
  const api = useApi(),
    owner = useRuntimeAccess((s) => s.scopes.includes('admin'));
  const live = api.mode === 'http';
  const q = useQuery(live && owner ? 'updates' : null, (a) => a.updateStatus(), {
    refetchMs: 3000,
  });
  const [draft, setDraft] = useState<UpdateSettings | null>(null),
    [target, setTarget] = useState<string | null>(null),
    [autoConfirm, setAutoConfirm] = useState(false);
  useEffect(() => {
    if (q.data && !draft) setDraft(q.data.settings);
  }, [q.data, draft]);
  const fail = (e: Error) =>
    toast({ severity: 'error', title: tr('updates.failed'), body: e.message });
  const check = useMutation((a) => a.checkUpdates(), {
    invalidate: ['updates', 'notifications'],
    onError: fail,
  });
  const install = useMutation((a, id: string) => a.installUpdates(id), {
    invalidate: ['updates'],
    onError: fail,
  });
  const save = useMutation((a, values: UpdateSettings) => a.configureUpdates(values), {
    invalidate: ['updates'],
    onSuccess: (s) => setDraft(s),
    onError: fail,
  });
  if (!live) return <Panel>{tr('updates.liveOnly')}</Panel>;
  if (!owner) return <Panel>{tr('updates.ownerOnly')}</Panel>;
  if (q.error && !q.data)
    return (
      <Panel>
        <p>{q.error.message}</p>
        <Button onClick={q.refetch}>{tr('updates.retry')}</Button>
      </Panel>
    );
  if (!q.data || !draft) return <Panel>{tr('updates.loading')}</Panel>;
  const state = q.data,
    job = state.job,
    busy = job && ['queued', 'running'].includes(job.status),
    available = state.items.filter((i) => i.available && !i.blocked),
    dirty = JSON.stringify(draft) !== JSON.stringify(state.settings),
    webUpdated =
      job?.status === 'complete' &&
      job.items.some((i) => i.kind === 'web') &&
      sessionStorage.getItem('delta.updates.reloaded') !== job.id;
  const set = (values: Partial<UpdateSettings>) => setDraft({ ...draft, ...values });
  return (
    <div className="col gap-4 updates-page">
      <Panel>
        <div className="row wrap gap-2 updates-heading">
          <div className="grow">
            <strong>{tr('updates.title')}</strong>
            <div className="muted">{tr('updates.description')}</div>
          </div>
          <Button
            icon={<RefreshCw size={16} />}
            loading={check.pending || state.checking}
            disabled={!!busy}
            onClick={() => check.run()}
          >
            {tr('updates.check')}
          </Button>
          <Button
            variant="primary"
            icon={<Download size={16} />}
            disabled={!available.length || !!busy}
            onClick={() => setTarget('all')}
          >
            {tr('updates.installAll')}
          </Button>
        </div>
        <div className="faint" style={{ marginTop: 12 }}>
          {tr('updates.lastCheck')}
          {': '}
          {state.lastCheckedAt
            ? new Date(state.lastCheckedAt).toLocaleString(locale)
            : tr('updates.never')}
        </div>
        {state.issues?.map((issue, n) => (
          <div className="banner warn" role="status" key={issue.nodeId + ':' + n}>
            {issue.nodeId}
            {': '}
            {text(issue.code)}
          </div>
        ))}
        {state.error && (
          <div className="banner warn" role="status">
            {text(state.error)}
          </div>
        )}
      </Panel>
      <Panel title={tr('updates.components')}>
        <div className="updates-items">
          {state.items.map((i) => (
            <div key={i.target || i.id} className="update-item">
              <div className="grow" style={{ minWidth: 0 }}>
                <strong>{i.name}</strong>
                {i.nodeId && (
                  <div className="muted" style={{ overflowWrap: 'anywhere' }}>
                    {i.nodeName || i.nodeId}
                  </div>
                )}
                <div className="mono muted">
                  {i.installed || tr('updates.version_unknown')}
                  {i.available ? ' → ' + i.latest : ''}
                </div>
                {i.blocked && <div className="muted">{text(i.blocked)}</div>}
                {!i.enabled && <div className="muted">{tr('updates.disabledPreserved')}</div>}
              </div>
              <Badge>
                {i.blocked
                  ? tr('updates.unavailable')
                  : !i.installed || !i.latest
                    ? tr('updates.unknown')
                    : i.available
                      ? tr('updates.available')
                      : tr('updates.current')}
              </Badge>
              {i.available && (
                <Button
                  size="sm"
                  disabled={!!busy || !!i.blocked}
                  onClick={() => setTarget(i.target || i.id)}
                >
                  {tr('updates.install')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Panel>
      {job && (
        <Panel title={tr('updates.progress')}>
          <div role="status">
            <strong>{text(job.status)}</strong>
            {busy && <p className="muted">{tr('updates.disconnectHint')}</p>}
            {job.error && <p>{text(job.error)}</p>}
          </div>
          {job.items.map((i) => (
            <div className="update-item" key={i.target || i.id}>
              <span className="grow">
                {i.name}
                {' · '}
                {i.latest}
              </span>
              <span>
                {text(i.status)}
                {i.phase ? ' · ' + text(i.phase) : ''}
              </span>
            </div>
          ))}
          {webUpdated && (
            <Button
              onClick={() => {
                sessionStorage.setItem('delta.updates.reloaded', job.id);
                location.reload();
              }}
            >
              {tr('updates.reload')}
            </Button>
          )}
        </Panel>
      )}
      <Panel title={tr('updates.preferences')}>
        <div className="form-row">
          <div>
            <strong>{tr('updates.automaticCheck')}</strong>
            <div className="field-help">{tr('updates.backgroundHint')}</div>
          </div>
          <Switch
            checked={draft.automaticCheck}
            label={tr('updates.automaticCheck')}
            onChange={(v) => set({ automaticCheck: v, ...(!v ? { autoInstall: false } : {}) })}
          />
        </div>
        <div className="form-row">
          <div>{tr('updates.interval')}</div>
          <Field>
            <input
              className="input"
              aria-label={tr('updates.interval')}
              type="number"
              min={15}
              max={1440}
              value={draft.intervalMinutes}
              onChange={(e) => set({ intervalMinutes: Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="form-row">
          <div>{tr('updates.notify')}</div>
          <Switch
            checked={draft.notify}
            label={tr('updates.notify')}
            onChange={(v) => set({ notify: v })}
          />
        </div>
        <div className="form-row">
          <div>
            <strong>{tr('updates.autoInstall')}</strong>
            <div className="field-help">{tr('updates.autoWarning')}</div>
          </div>
          <Switch
            disabled={!draft.automaticCheck}
            checked={draft.autoInstall}
            label={tr('updates.autoInstall')}
            onChange={(v) => (v ? setAutoConfirm(true) : set({ autoInstall: false }))}
          />
        </div>
        <div className="form-row">
          <div>{tr('updates.autoCore')}</div>
          <Switch
            checked={draft.autoCore}
            label={tr('updates.autoCore')}
            onChange={(v) => set({ autoCore: v })}
          />
        </div>
        <div className="form-row">
          <div>{tr('updates.autoPlugins')}</div>
          <Switch
            checked={draft.autoPlugins}
            label={tr('updates.autoPlugins')}
            onChange={(v) => set({ autoPlugins: v })}
          />
        </div>
        <div className="form-row">
          <div>
            {tr('updates.autoRemote')}
            <div className="field-help">{tr('updates.autoRemoteHelp')}</div>
          </div>
          <Switch
            checked={draft.autoRemote ?? false}
            disabled={!draft.autoCore}
            label={tr('updates.autoRemote')}
            onChange={(v) => set({ autoRemote: v })}
          />
        </div>
        <Button
          disabled={
            !dirty ||
            !Number.isInteger(draft.intervalMinutes) ||
            draft.intervalMinutes < 15 ||
            draft.intervalMinutes > 1440
          }
          loading={save.pending}
          onClick={() => save.run(draft)}
        >
          {tr('updates.save')}
        </Button>
      </Panel>
      <Confirm
        open={!!target}
        onClose={() => setTarget(null)}
        title={tr('updates.installConfirm')}
        body={tr('updates.disconnectHint')}
        confirmLabel={tr('updates.install')}
        onConfirm={() => {
          if (target) install.run(target);
          setTarget(null);
        }}
      />
      <Confirm
        open={autoConfirm}
        onClose={() => setAutoConfirm(false)}
        title={tr('updates.autoInstall')}
        body={tr('updates.autoWarning')}
        confirmLabel={tr('updates.enable')}
        onConfirm={() => {
          set({ autoInstall: true });
          setAutoConfirm(false);
        }}
      />
    </div>
  );
}
