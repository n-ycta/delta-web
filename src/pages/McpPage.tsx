import { useEffect, useState } from 'react';
import { tr } from '@/i18n';
import { control } from '@/api/control';
import { PageHead, Button, Panel } from '@/ui/primitives';
export function McpPage() {
  const [profiles, setProfiles] = useState<any[]>([]),
    [catalog, setCatalog] = useState<any[]>([]),
    [error, setError] = useState(''),
    [config, setConfig] = useState(''),
    [name, setName] = useState(''),
    [caps, setCaps] = useState<string[]>(['web.metrics_query', 'typing.status']),
    [plugins, setPlugins] = useState(''),
    [nodes, setNodes] = useState(''),
    [days, setDays] = useState(7),
    [rows, setRows] = useState(1000),
    [redact, setRedact] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState('');
  const load = () =>
    Promise.all([control('web.mcp_list'), control('web.mcp_catalog')])
      .then(([p, c]) => {
        setProfiles(p);
        setCatalog(c);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  const list = (s: string) =>
    s
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== '*');
  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await control('web.mcp_create', {
        profile: {
          name,
          capabilities: caps,
          plugins: list(plugins),
          nodes: list(nodes),
          maxRangeDays: days,
          maxRows: rows,
          redactedFields: list(redact),
        },
      });
      setConfig(
        JSON.stringify(
          {
            mcpServers: {
              [r.profile.name]: {
                url: location.origin + '/mcp/' + r.profile.id,
                headers: { Authorization: 'Bearer ' + r.secret },
              },
            },
          },
          null,
          2,
        ),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <PageHead title={tr('polish.mcp')} />
      <p className="muted">{tr('polish.mcpWarning')}</p>
      {error && (
        <div className="banner err" role="alert">
          {error}
        </div>
      )}
      <div className="grid-aside">
        <Panel title={tr('polish.createMcp')}>
          <div className="col gap-3">
            <label>
              {tr('polish.mcpName')}
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <label>
              {tr('polish.mcpPreset')}
              <select
                className="select"
                defaultValue="analytics"
                onChange={(e) =>
                  setCaps(
                    e.target.value === 'analytics'
                      ? ['web.metrics_query', 'typing.status']
                      : e.target.value === 'ops'
                        ? ['system.info', 'system.ping', 'supervisor.list', 'supervisor.restart']
                        : [],
                  )
                }
              >
                <option value="analytics">{tr('polish.mcpAnalytics')}</option>
                <option value="ops">{tr('polish.mcpOps')}</option>
                <option value="custom">{tr('polish.mcpCustom')}</option>
              </select>
            </label>
            <div className="row">
              <input
                className="input"
                aria-label={tr('pluginData.searchCapabilities')}
                placeholder={tr('pluginData.searchCapabilities')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button onClick={() => void load()}>{tr('pluginData.refresh')}</Button>
            </div>
            <fieldset
              style={{
                border: '1px solid var(--rule)',
                padding: 12,
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr)',
                gap: 8,
              }}
            >
              <legend>{tr('polish.mcpCapabilities')}</legend>
              {catalog
                .filter((c) =>
                  (c.name + ' ' + (c.description || ''))
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((c) => (
                  <label
                    key={c.name}
                    className="check"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      width: '100%',
                      minHeight: 36,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={caps.includes(c.name)}
                      onChange={(e) =>
                        setCaps(
                          e.target.checked ? [...caps, c.name] : caps.filter((x) => x !== c.name),
                        )
                      }
                    />
                    <span>
                      <code>{c.name}</code>{' '}
                      {c.admin && <span className="badge warn">{tr('pluginData.admin')}</span>}
                      <br />
                      <span className="muted">{c.description}</span>
                      {Object.keys(c.params || {}).length > 0 && (
                        <span className="mono faint" style={{ display: 'block', fontSize: 11 }}>
                          {Object.keys(c.params).join(', ')}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
            </fieldset>
            <label>
              {tr('polish.mcpData')}
              <input
                className="input"
                value={plugins}
                onChange={(e) => setPlugins(e.target.value)}
              />
            </label>
            <label>
              {tr('polish.mcpNodes')}
              <input className="input" value={nodes} onChange={(e) => setNodes(e.target.value)} />
            </label>
            <label>
              {tr('polish.mcpRange')}
              <input
                className="input"
                type="number"
                min={1}
                max={366}
                value={days}
                onChange={(e) => setDays(+e.target.value)}
              />
            </label>
            <label>
              {tr('polish.maxRows')}
              <input
                className="input"
                type="number"
                min={1}
                max={10000}
                value={rows}
                onChange={(e) => setRows(+e.target.value)}
              />
            </label>
            <label>
              {tr('polish.redactFields')}
              <input className="input" value={redact} onChange={(e) => setRedact(e.target.value)} />
            </label>
            <Button
              variant="primary"
              perm="access.manage"
              disabled={!name || !caps.length}
              loading={busy}
              onClick={() => void create()}
            >
              {tr('pluginData.create')}
            </Button>
          </div>
        </Panel>
        <div className="col gap-3">
          {config && (
            <Panel title={tr('polish.mcpConfig')}>
              <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
                {config}
              </pre>
              <Button onClick={() => void navigator.clipboard.writeText(config)}>
                {tr('polish.copy')}
              </Button>
            </Panel>
          )}
          {profiles.map((p) => (
            <Panel key={p.id} title={p.name}>
              <p className="mono" style={{ overflowWrap: 'anywhere' }}>
                {p.capabilities.join(', ')}
              </p>
              <p className="muted">
                {p.maxRangeDays}
                {' d · '}
                {p.maxRows} {tr('polish.maxRows')}
              </p>
              <Button
                perm="access.manage"
                onClick={() => {
                  void control('web.mcp_revoke', { id: p.id })
                    .then(load)
                    .catch((e) => setError(e.message));
                }}
              >
                {tr('polish.revoke')}
              </Button>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
