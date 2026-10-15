import { useEffect, useState } from "react";
import { tr } from "@/i18n";
import { useMutation, useQuery, queryClient } from "@/app/query";
import { Modal } from "@/ui/overlays";
import { Button, Field } from "@/ui/primitives";
import type { SSHProbe, SSHInstall } from "@/api";
const JOB = "delta.ssh.job";
export function SSHConnectDialog({
  open,
  onClose,
  onDirect,
}: {
  open: boolean;
  onClose: () => void;
  onDirect: () => void;
}) {
  const [host, setHost] = useState(""),
    [port, setPort] = useState(22),
    [username, setUser] = useState("root");
  const [auth, setAuth] = useState<"password" | "key">("password"),
    [password, setPassword] = useState(""),
    [privateKey, setKey] = useState(""),
    [passphrase, setPhrase] = useState("");
  const [probe, setProbe] = useState<SSHProbe>(),
    [verified, setVerified] = useState(false),
    [trust, setTrust] = useState<SSHInstall["trust"]>("manage"),
    [ack, setAck] = useState(false);
  const [jobId, setJobId] = useState(() => {
    try {
      return sessionStorage.getItem(JOB) || "";
    } catch {
      return "";
    }
  });
  const clearSecrets = () => {
    setPassword("");
    setKey("");
    setPhrase("");
  };
  useEffect(() => {
    if (!open) clearSecrets();
  }, [open]);
  const check = useMutation((api) => api.probeSSH({ host, port, username }), {
    onSuccess: (p) => {
      setProbe(p);
      setVerified(false);
    },
  });
  const install = useMutation(
    (api) =>
      api.installSSH({
        host,
        port,
        username,
        auth,
        password: auth === "password" ? password : undefined,
        privateKey: auth === "key" ? privateKey : undefined,
        passphrase: auth === "key" ? passphrase : undefined,
        ticket: probe!.ticket,
        fingerprint: probe!.fingerprint,
        trust,
        acknowledgeAdmin: ack,
      }),
    {
      onSuccess: (r) => {
        clearSecrets();
        setJobId(r.jobId);
        sessionStorage.setItem(JOB, r.jobId);
      },
    },
  );
  const status = useQuery(
    open && jobId ? "ssh-job/" + jobId : null,
    (api) => api.sshJob(jobId),
    { refetchMs: 2000 },
  );
  useEffect(() => {
    if (status.data?.status === "complete") queryClient.invalidate("nodes");
  }, [status.data?.status]);
  const changed = () => {
    setProbe(undefined);
    setVerified(false);
    check.reset();
    install.reset();
  };
  const running = !!jobId && (!status.data || status.data.status === "running");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr("ssh.title")}
      footer={<Button onClick={onClose}>{tr("ssh.close")}</Button>}
    >
      {jobId ? (
        <div className="col gap-4">
          <strong>
            {status.data?.status === "complete"
              ? tr("ssh.connected")
              : status.data?.phase
                ? tr("ssh.phase_" + status.data.phase)
                : tr("ssh.phase_connecting")}
          </strong>
          <p className="muted">{host || status.data?.host}</p>
          {status.data?.error && (
            <div className="field-error">{sshError(status.data.error)}</div>
          )}
          {status.error && (
            <div className="field-error">{status.error.message}</div>
          )}
          <p className="muted">{tr("ssh.background")}</p>
          {!running && (
            <Button
              onClick={() => {
                setJobId("");
                sessionStorage.removeItem(JOB);
                changed();
              }}
            >
              {tr("ssh.retry")}
            </Button>
          )}
        </div>
      ) : (
        <div className="col gap-4">
          <p className="muted">{tr("ssh.intro")}</p>
          <Field label={tr("ssh.host")}>
            <input
              className="input"
              value={host}
              autoComplete="off"
              onChange={(e) => {
                setHost(e.target.value.trim());
                changed();
              }}
              placeholder="203.0.113.10"
            />
          </Field>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)",
              gap: 12,
            }}
          >
            <Field label={tr("ssh.port")}>
              <input
                className="input"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => {
                  setPort(Number(e.target.value));
                  changed();
                }}
              />
            </Field>
            <Field label={tr("ssh.user")}>
              <input
                className="input"
                value={username}
                autoComplete="off"
                onChange={(e) => {
                  setUser(e.target.value);
                  changed();
                }}
              />
            </Field>
          </div>
          <Button
            disabled={
              !host ||
              !username ||
              !Number.isInteger(port) ||
              port < 1 ||
              port > 65535
            }
            loading={check.pending}
            onClick={() => check.run()}
          >
            {tr("ssh.probe")}
          </Button>
          {check.error && (
            <div className="field-error">{check.error.message}</div>
          )}
          {probe && (
            <div className="col gap-4">
              <Field label={tr("ssh.fingerprint")} help={tr("ssh.verifyHelp")}>
                <code style={{ overflowWrap: "anywhere" }}>
                  {probe.fingerprint}
                </code>
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                />
                {tr("ssh.confirmHost")}
              </label>
              <Field label={tr("ssh.auth")}>
                <select
                  className="select"
                  value={auth}
                  onChange={(e) => {
                    setAuth(e.target.value as "password" | "key");
                    clearSecrets();
                  }}
                >
                  <option value="password">{tr("ssh.password")}</option>
                  <option value="key">{tr("ssh.key")}</option>
                </select>
              </Field>
              {auth === "password" ? (
                <Field label={tr("ssh.password")}>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              ) : (
                <>
                  <Field label={tr("ssh.key")}>
                    <input
                      type="file"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f && f.size <= 65536) setKey(await f.text());
                        e.target.value = "";
                      }}
                    />
                    <textarea
                      className="input mono"
                      style={{ minHeight: 100 }}
                      spellCheck={false}
                      autoComplete="off"
                      value={privateKey}
                      onChange={(e) => setKey(e.target.value)}
                    />
                  </Field>
                  <Field label={tr("ssh.passphrase")}>
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      value={passphrase}
                      onChange={(e) => setPhrase(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <Field
                label={tr("ssh.trust")}
                help={tr("ssh.trustHelp_" + trust)}
              >
                <select
                  className="select"
                  value={trust}
                  onChange={(e) => {
                    setTrust(e.target.value as SSHInstall["trust"]);
                    setAck(false);
                  }}
                >
                  <option value="calls">{tr("ssh.calls")}</option>
                  <option value="manage">{tr("ssh.manage")}</option>
                  <option value="mutual">{tr("ssh.mutual")}</option>
                </select>
              </Field>
              {trust !== "calls" && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  {tr("ssh.adminWarning")}
                </label>
              )}
              <p className="muted">{tr("ssh.secrets")}</p>
              <p className="muted">{tr("ssh.rootHint")}</p>
              {install.error && (
                <div className="field-error">{install.error.message}</div>
              )}
              <Button
                variant="primary"
                loading={install.pending}
                disabled={
                  !verified ||
                  probe.expiresAt < Date.now() ||
                  !(auth === "password" ? password : privateKey) ||
                  (trust !== "calls" && !ack)
                }
                onClick={() => install.run()}
              >
                {tr("ssh.install")}
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              clearSecrets();
              onDirect();
            }}
          >
            {tr("ssh.direct")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
function sshError(code: string) {
  return tr("ssh.error_" + (knownErrors.includes(code) ? code : "ssh_failed"));
}
const knownErrors = [
  "invalid",
  "owner",
  "host_key",
  "ssh_failed",
  "prerequisite",
  "busy",
  "remote_setup",
  "tunnel",
  "pairing",
  "interrupted",
  "missing",
];
