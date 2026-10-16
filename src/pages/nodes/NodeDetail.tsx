import { tr } from '@/i18n';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ChevronLeft, Play, RotateCcw, Terminal, Trash2, Wifi } from 'lucide-react';
import { useNodes, usePlugins } from '@/app/data';
import { queryClient, useMutation, useQuery } from '@/app/query';
import { toast, useCan } from '@/app/stores';
import { useChartColors } from '@/app/theme';
import {
  ConnectionConfig,
  NODE_COMMANDS,
  NODE_KIND_LABEL,
  type NodeCommandId,
  type NodeInfo,
  type Series,
} from '@/core/contracts';
import {
  ago,
  fmtBytes,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtAxisTime,
  DAY,
  HOUR,
} from '@/core/lib/format';
import {
  Badge,
  Button,
  Field,
  Meter,
  PageHead,
  Panel,
  Segmented,
  StatusBadge,
  Switch,
  Tabs,
} from '@/ui/primitives';
import { Confirm } from '@/ui/overlays';
import { ChartSkeleton, Empty, ErrorState, Skeleton, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { NODE_STATUS, PLUGIN_STATUS, SEVERITY_LABEL } from '@/ui/status';
import { NODE_ICON } from '@/widgets/system/NodeGridWidget';
import { ChartTooltip } from '@/widgets/shared';

type Tab =
  | 'overview'
  | 'processes'
  | 'plugins'
  | 'components'
  | 'errors'
  | 'events'
  | 'console'
  | 'connection';
const RANGES = { '1h': HOUR, '24h': DAY, '7d': 7 * DAY } as const;

export function NodeDetail() {
  const { id = '' } = useParams();
  const nodes = useNodes();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const n = nodes.data?.find((x) => x.id === id);

  if (nodes.loading)
    return (
      <div className="page">
        <Skeleton h={48} w={360} />
        <div style={{ height: 20 }} />
        <SkeletonRows rows={8} />
      </div>
    );
  if (nodes.error && !nodes.data)
    return (
      <div className="page">
        <ErrorState error={nodes.error} onRetry={nodes.refetch} />
      </div>
    );
  if (!n)
    return (
      <div className="page">
        <div className="panel">
          <Empty
            title={tr('pages.nodes.NodeDetail.s_43ec565be2')}
            action={
              <Link className="btn" to="/nodes">
                {tr('pages.nodes.NodeDetail.s_f4ddb122d1')}
              </Link>
            }
          >
            {tr('pages.nodes.NodeDetail.s_a818ffee17')}
            <code>{id}</code> {tr('pages.nodes.NodeDetail.s_0fcbd2410d')}
          </Empty>
        </div>
      </div>
    );

  const st = NODE_STATUS[n.status];
  const errCount = n.errors.reduce((s, e) => s + e.count, 0);
  const crashed = n.processes.filter((p) => p.status === 'crashed').length;
  return (
    <div className="page">
      <Link to="/nodes" className="row muted" style={{ fontSize: 12, marginBottom: 10, gap: 4 }}>
        <ChevronLeft size={13} />
        {tr('pages.nodes.NodeDetail.s_3293ac18db')}
      </Link>
      <PageHead
        title={
          <span className="row" style={{ gap: 14 }}>
            <span className="plug-icon lg">
              <Icon name={NODE_ICON[n.kind]} size={22} />
            </span>
            <span className="col" style={{ gap: 2 }}>
              <span>{n.name}</span>
              <span
                className="mono muted"
                style={{ fontSize: 12, fontWeight: 400, letterSpacing: 0 }}
              >
                {n.id} {tr('pages.nodes.NodeDetail.s_d3dacf895c')}
                {NODE_KIND_LABEL[n.kind]} {tr('pages.nodes.NodeDetail.s_d3dacf895c')}
                {n.os} {n.arch} {tr('pages.nodes.NodeDetail.s_d3dacf895c')}
                {n.address}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <StatusBadge tone={st.tone} label={st.label} pulse={n.status === 'online'} />
            <span className="muted" style={{ fontSize: 12 }}>
              {tr('pages.nodes.NodeDetail.s_2f59101da0')}
              {ago(n.lastSeen)}
            </span>
            <Button icon={<Terminal size={14} />} onClick={() => setParams({ tab: 'console' })}>
              {tr('pages.nodes.NodeDetail.s_5a214bdfe9')}
            </Button>
          </>
        }
      />
      {n.status === 'offline' && (
        <div className="banner err" style={{ borderRadius: 6, border: 0, marginBottom: 16 }}>
          <AlertTriangle size={15} />
          <span className="grow">
            {tr('pages.nodes.NodeDetail.s_da3f9eba3e')}
            {fmtDateTime(n.lastSeen)}
            {tr('pages.nodes.NodeDetail.s_2bbb749eef')}
          </span>
          <Button size="sm" onClick={() => setParams({ tab: 'connection' })}>
            {tr('pages.nodes.NodeDetail.s_64cffcf3ef')}
          </Button>
        </div>
      )}
      {n.status === 'degraded' && n.errors[0] && (
        <div className="banner warn" style={{ borderRadius: 6, border: 0, marginBottom: 16 }}>
          <AlertTriangle size={15} />
          <span className="grow">
            <b>{n.errors[0].code}</b>
            {tr('pages.nodes.NodeDetail.s_ceca32e904')}
            {n.errors[0].message}
          </span>
          <Button size="sm" onClick={() => setParams({ tab: 'errors' })}>
            {tr('pages.nodes.NodeDetail.s_aadf55c11e')}
          </Button>
        </div>
      )}
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { id: 'overview', label: tr('pages.nodes.NodeDetail.s_39c6387206') },
          {
            id: 'processes',
            label: tr('pages.nodes.NodeDetail.s_ae8d8352d6'),
            count: n.processes.length,
            alert: crashed > 0,
          },
          {
            id: 'plugins',
            label: tr('pages.nodes.NodeDetail.s_ff13ef845f'),
            count: n.pluginIds.length,
          },
          {
            id: 'components',
            label: tr('pages.nodes.NodeDetail.s_e8affcf359'),
            count: n.components.length,
            alert: n.components.some((c) => c.status === 'error'),
          },
          {
            id: 'errors',
            label: tr('pages.nodes.NodeDetail.s_681b5ae3d2'),
            count: errCount || undefined,
            alert: errCount > 0,
          },
          { id: 'events', label: tr('pages.nodes.NodeDetail.s_bb9ac87531') },
          { id: 'console', label: tr('pages.nodes.NodeDetail.s_3afd5ef962') },
          { id: 'connection', label: tr('pages.nodes.NodeDetail.s_79e350f743') },
        ]}
      />
      {tab === 'overview' && <Overview n={n} />}
      {tab === 'processes' && <Processes n={n} />}
      {tab === 'plugins' && <NodePlugins n={n} />}
      {tab === 'components' && <Components n={n} />}
      {tab === 'errors' && <Errors n={n} />}
      {tab === 'events' && <NodeEvents n={n} />}
      {tab === 'console' && <Console n={n} />}
      {tab === 'connection' && <Connection n={n} />}
    </div>
  );
}

function MiniChart({
  s,
  unit,
  span,
  color,
  max,
}: {
  s: Series;
  unit: string;
  span: number;
  color: string;
  max?: number;
}) {
  const c = useChartColors();
  const data = s.points.map((p) => ({ t: p.t, v: p.v }));
  const gid = `g-${s.key}`;
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.18} />
            <stop offset="1" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(t) => fmtAxisTime(t, span)}
          tick={{ fill: c.axis, fontSize: 10.5 }}
          stroke={c.grid}
          minTickGap={40}
        />
        <YAxis
          domain={[0, max ?? 'auto']}
          tick={{ fill: c.axis, fontSize: 10.5 }}
          stroke={c.grid}
          width={44}
        />
        <Tooltip
          content={<ChartTooltip unit={unit} decimals={1} span={span} labels={{ v: s.label }} />}
        />
        <Area
          dataKey="v"
          name={s.label}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gid})`}
          isAnimationActive={false}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Overview({ n }: { n: NodeInfo }) {
  const [range, setRange] = useState<keyof typeof RANGES>('24h');
  const span = RANGES[range];
  const hist = useQuery(`nodes/${n.id}/history/${range}`, (api) => api.getNodeHistory(n.id, span), {
    refetchMs: 60000,
  });
  const up = useQuery(`nodes/${n.id}/uptime`, (api) => api.getNodeUptime(n.id, 90));
  const c = useChartColors();
  const avail = up.data ? up.data.filter((d) => d.state !== 'nodata') : [];
  const availPct = avail.length
    ? (avail.reduce((s, d) => s + d.availability, 0) / avail.length) * 100
    : null;
  const off = n.status === 'offline';
  const tone = (v: number) => (v > 0.9 ? 'err' : v > 0.75 ? 'warn' : undefined);
  return (
    <div className="grid-aside">
      <div className="col gap-4">
        <div className="strip" style={{ marginBottom: 0 }}>
          <div>
            <div className="label">
              {tr('pages.nodes.NodeDetail.s_1e138246dc')}
              {n.cores} {tr('pages.nodes.NodeDetail.s_aa45b5efaf')}
            </div>
            <div className="v">{off ? '—' : `${Math.round(n.cpu)}%`}</div>
          </div>
          <div>
            <div className="label">{tr('pages.nodes.NodeDetail.s_f63c10e017')}</div>
            <div className="v">
              {fmtBytes(n.memUsed)}
              <small>
                {tr('pages.nodes.NodeDetail.s_36fee9f368')}
                {fmtBytes(n.memTotal)}
              </small>
            </div>
          </div>
          <div>
            <div className="label">{tr('pages.nodes.NodeDetail.s_ca040760a3')}</div>
            <div
              className="v"
              style={{ color: n.diskUsed / n.diskTotal > 0.9 ? 'var(--err)' : undefined }}
            >
              {Math.round((n.diskUsed / n.diskTotal) * 100)}
              {tr('pages.nodes.NodeDetail.s_4345cb1fa2')}
              <small>
                {fmtBytes(n.diskTotal - n.diskUsed)} {tr('pages.nodes.NodeDetail.s_e623ac515b')}
              </small>
            </div>
          </div>
          <div>
            <div className="label">{tr('pages.nodes.NodeDetail.s_d0d899d70c')}</div>
            <div className="v">{off ? '—' : fmtDuration(n.uptimeSec)}</div>
          </div>
          {n.battery ? (
            <div>
              <div className="label">{tr('pages.nodes.NodeDetail.s_96a4c39fe9')}</div>
              <div className="v">
                {Math.round(n.battery.level * 100)}
                {tr('pages.nodes.NodeDetail.s_4345cb1fa2')}
                <small>
                  {n.battery.charging
                    ? tr('pages.nodes.NodeDetail.s_7c7b4d2b9b')
                    : tr('pages.nodes.NodeDetail.s_2bb3c36c2f')}
                </small>
              </div>
            </div>
          ) : (
            <div>
              <div className="label">{tr('pages.nodes.NodeDetail.s_b78a6d1c81')}</div>
              <div className="v">
                {off || n.latencyMs === undefined ? '—' : n.latencyMs}
                <small>{tr('pages.nodes.NodeDetail.s_bbb0e8e8cd')}</small>
              </div>
            </div>
          )}
        </div>
        <Panel
          title={tr('pages.nodes.NodeDetail.s_3e559b8cc3')}
          actions={
            <Segmented
              value={range}
              onChange={setRange}
              options={Object.keys(RANGES).map((k) => ({
                value: k as keyof typeof RANGES,
                label: k,
              }))}
            />
          }
        >
          {hist.data &&
          !Object.values(hist.data).some((s) =>
            s.points.some((p: { v: number | null }) => p.v !== null),
          ) ? (
            <div className="muted">{tr('analytics.historyStarting')}</div>
          ) : hist.error && !hist.data ? (
            <ErrorState compact error={hist.error} onRetry={hist.refetch} />
          ) : (
            <div className="grid-3">
              {(['cpu', 'mem', 'latency'] as const).map((k, i) => (
                <div key={k}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    {k === 'cpu'
                      ? 'CPU, %'
                      : k === 'mem'
                        ? tr('pages.nodes.NodeDetail.s_d561f0e35d')
                        : tr('pages.nodes.NodeDetail.s_a62dd55b07')}
                  </div>
                  {hist.data ? (
                    <MiniChart
                      s={hist.data[k]}
                      unit={k === 'latency' ? 'ms' : '%'}
                      span={span}
                      color={c.series[i]}
                      max={k === 'latency' ? undefined : 100}
                    />
                  ) : (
                    <ChartSkeleton />
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel
          title={tr('pages.nodes.NodeDetail.s_f10ad2a9af')}
          actions={
            <span className="muted" style={{ fontSize: 11 }}>
              {tr('analytics.observedAvailability')}
            </span>
          }
          meta={
            availPct !== null && (
              <span className="num muted">
                {availPct.toFixed(2)}
                {tr('pages.nodes.NodeDetail.s_4345cb1fa2')}
              </span>
            )
          }
        >
          {up.error && !up.data ? (
            <ErrorState compact error={up.error} onRetry={up.refetch} />
          ) : up.data ? (
            <>
              <div className="uptime">
                {up.data.map((d) => (
                  <span
                    key={d.day}
                    className={d.state === 'up' ? '' : d.state}
                    title={tr('pages.nodes.NodeDetail.s_68c5ac7fd0', {
                      p0: fmtDate(d.day),
                      p1:
                        d.state === 'nodata'
                          ? tr('pages.nodes.NodeDetail.s_fdc64e6ca7')
                          : `${(d.availability * 100).toFixed(1)}%`,
                    })}
                  />
                ))}
              </div>
              <div className="row muted" style={{ fontSize: 11, marginTop: 6 }}>
                <span>{tr('pages.nodes.NodeDetail.s_5093c2bf77')}</span>
                <span className="spacer" />
                <span>{tr('pages.nodes.NodeDetail.s_42f85ce119')}</span>
              </div>
            </>
          ) : (
            <Skeleton h={26} />
          )}
        </Panel>
        {n.errors.length > 0 && (
          <Panel title={tr('pages.nodes.NodeDetail.s_366f9b92b7')} flush>
            <ErrorList errors={n.errors.slice(0, 3)} />
          </Panel>
        )}
      </div>
      <div className="col gap-4">
        <Panel title={tr('pages.nodes.NodeDetail.s_99bf044d04')}>
          <dl className="kv">
            <dt>{tr('pages.nodes.NodeDetail.s_d25691ca40')}</dt>
            <dd>{NODE_KIND_LABEL[n.kind]}</dd>
            <dt>{tr('pages.nodes.NodeDetail.s_8f481eb5a8')}</dt>
            <dd>
              {n.os} {tr('pages.nodes.NodeDetail.s_d3dacf895c')}
              {n.arch}
            </dd>
            <dt>{tr('pages.nodes.NodeDetail.s_8db46ea789')}</dt>
            <dd className="mono">{n.address}</dd>
            {n.location && (
              <>
                <dt>{tr('pages.nodes.NodeDetail.s_2c5d3eb3ba')}</dt>
                <dd>{n.location}</dd>
              </>
            )}
            <dt>{tr('pages.nodes.NodeDetail.s_8634e35e72')}</dt>
            <dd className="mono">{n.agentVersion}</dd>
            <dt>{tr('pages.nodes.NodeDetail.s_e25d2d0eed')}</dt>
            <dd className="mono">
              {n.connection.transport} {tr('pages.nodes.NodeDetail.s_d3dacf895c')}
              {n.connection.heartbeatSec}
              {tr('pages.nodes.NodeDetail.s_a0f1490a20')}
            </dd>
            {n.tempC !== undefined && (
              <>
                <dt>{tr('pages.nodes.NodeDetail.s_56f7653b88')}</dt>
                <dd className="num">
                  {n.tempC.toFixed(0)} {tr('pages.nodes.NodeDetail.s_ac64280f97')}
                </dd>
              </>
            )}
            <dt>{tr('pages.nodes.NodeDetail.s_25d548189f')}</dt>
            <dd>{fmtDateTime(n.lastSeen)}</dd>
            <dt>{tr('pages.nodes.NodeDetail.s_5e52520af4')}</dt>
            <dd className="row wrap gap-1">
              {n.tags.map((t) => (
                <Badge key={t} mono outline>
                  {t}
                </Badge>
              ))}
            </dd>
          </dl>
        </Panel>
        <Panel title={tr('pages.nodes.NodeDetail.s_c6e47aac4b')}>
          <div className="col gap-3">
            {[
              [tr('runtime.cpuLabel'), n.cpu / 100],
              [tr('pages.nodes.NodeDetail.s_f63c10e017'), n.memUsed / n.memTotal],
              [tr('pages.nodes.NodeDetail.s_ca040760a3'), n.diskUsed / n.diskTotal],
            ].map(([l, v]) => (
              <div key={l as string} className="col" style={{ gap: 4 }}>
                <div className="row" style={{ fontSize: 12 }}>
                  <span className="muted">{l}</span>
                  <span className="spacer" />
                  <span className="num">
                    {Math.round((v as number) * 100)}
                    {tr('pages.nodes.NodeDetail.s_4345cb1fa2')}
                  </span>
                </div>
                <Meter value={v as number} tone={tone(v as number)} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ErrorList({ errors }: { errors: NodeInfo['errors'] }) {
  return (
    <div>
      {errors.map((e, i) => (
        <div
          key={i}
          className="issue"
          style={{ gridTemplateColumns: '16px 170px minmax(0,1fr) auto' }}
        >
          <AlertTriangle size={14} color="var(--err)" style={{ marginTop: 2 }} />
          <span className="mono" style={{ fontSize: 11.5 }}>
            {e.code}
          </span>
          <span>
            <div>{e.message}</div>
            <div className="p">
              {e.component} {tr('pages.nodes.NodeDetail.s_653da13eaa')}
              {ago(e.ts)}
            </div>
          </span>
          <Badge mono tone="err">
            {tr('pages.nodes.NodeDetail.s_67fba2f357')}
            {e.count}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function Processes({ n }: { n: NodeInfo }) {
  const [sort, setSort] = useState<'cpu' | 'mem' | 'name'>('cpu');
  const list = [...n.processes].sort((a, b) =>
    sort === 'cpu'
      ? b.cpu - a.cpu
      : sort === 'mem'
        ? b.memMb - a.memMb
        : a.name.localeCompare(b.name),
  );
  if (!list.length)
    return (
      <div className="panel">
        <Empty title={tr('pages.nodes.NodeDetail.s_c9d8789fba')}>
          {n.status === 'offline'
            ? tr('pages.nodes.NodeDetail.s_481714eec8')
            : tr('pages.nodes.NodeDetail.s_568ce376a8')}
        </Empty>
      </div>
    );
  const tone = {
    running: 'ok',
    sleeping: 'off',
    stopped: 'off',
    crashed: 'err',
    restarting: 'warn',
  } as const;
  return (
    <div className="panel table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th className="r">{tr('pages.nodes.NodeDetail.s_dde57e820d')}</th>
            <th className="sortable" onClick={() => setSort('name')}>
              {tr('pages.nodes.NodeDetail.s_2988c59c8b')}
            </th>
            <th>{tr('pages.nodes.NodeDetail.s_8879f45a65')}</th>
            <th>{tr('pages.nodes.NodeDetail.s_f7f293b5c5')}</th>
            <th className="r sortable" onClick={() => setSort('cpu')}>
              {tr('pages.nodes.NodeDetail.s_b0652c330e')}
              {sort === 'cpu' && '↓'}
            </th>
            <th className="r sortable" onClick={() => setSort('mem')}>
              {tr('pages.nodes.NodeDetail.s_a083bbb014')}
              {sort === 'mem' && '↓'}
            </th>
            <th className="r">{tr('pages.nodes.NodeDetail.s_23be9bc057')}</th>
            <th>{tr('pages.nodes.NodeDetail.s_3feee4e549')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.pid}>
              <td className="num">{p.pid}</td>
              <td className="mono">{p.name}</td>
              <td className="muted">{p.component}</td>
              <td>
                <StatusBadge tone={tone[p.status]} label={p.status} />
              </td>
              <td className="num">
                {n.telemetryUnavailable?.includes('processCpu') ? '—' : p.cpu.toFixed(1)}
                {tr('pages.nodes.NodeDetail.s_4345cb1fa2')}
              </td>
              <td className="num">
                {n.telemetryUnavailable?.includes('processMemory') ? '—' : p.memMb.toFixed(0)}{' '}
                {tr('pages.nodes.NodeDetail.s_cbb86104b4')}
              </td>
              <td className="num" style={{ color: p.restarts > 3 ? 'var(--warn)' : undefined }}>
                {p.restarts}
              </td>
              <td className="muted">{ago(p.startedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NodePlugins({ n }: { n: NodeInfo }) {
  const plugins = usePlugins();
  const nav = useNavigate();
  const list = (plugins.data ?? []).filter((p) => n.pluginIds.includes(p.manifest.id));
  if (plugins.loading) return <SkeletonRows rows={4} />;
  if (!list.length)
    return (
      <div className="panel">
        <Empty
          title={tr('pages.nodes.NodeDetail.s_f2bffbc793')}
          action={
            <Link className="btn" to="/plugins?tab=available">
              {tr('pages.nodes.NodeDetail.s_faf6a92f70')}
            </Link>
          }
        >
          {tr('pages.nodes.NodeDetail.s_34d1e37a15')}
        </Empty>
      </div>
    );
  return (
    <div className="panel table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>{tr('pages.nodes.NodeDetail.s_f79d7e1e29')}</th>
            <th>{tr('pages.nodes.NodeDetail.s_97c248cbe0')}</th>
            <th>{tr('pages.nodes.NodeDetail.s_f7f293b5c5')}</th>
            <th>{tr('pages.nodes.NodeDetail.s_36704999c6')}</th>
            <th>{tr('pages.nodes.NodeDetail.s_7cedddad2b')}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr
              key={p.manifest.id}
              className="clickable"
              onClick={() => nav(`/plugins/${encodeURIComponent(p.manifest.id)}`)}
            >
              <td>
                <span className="row">
                  <Icon name={p.manifest.icon} size={15} className="muted" />
                  {p.manifest.name}
                </span>
              </td>
              <td className="mono">{p.instance.installedVersion ?? p.manifest.version}</td>
              <td>
                <StatusBadge {...PLUGIN_STATUS[p.instance.status]} />
              </td>
              <td className="muted">
                {p.manifest.runtime.targets.map((k) => NODE_KIND_LABEL[k]).join(', ')}
              </td>
              <td className="muted">{p.instance.lastSyncAt ? ago(p.instance.lastSyncAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useNodeCommand(
  n: NodeInfo,
  onDone?: (
    cmd: NodeCommandId,
    r: { ok: boolean; output: string[]; durationMs: number; exitCode?: number },
  ) => void,
) {
  return useMutation(
    (api, cmd: NodeCommandId, args?: Record<string, string>) =>
      api.runNodeCommand(n.id, cmd, args).then((r) => ({ cmd, r })),
    {
      invalidate: ['nodes', 'events'],
      onSuccess: ({ cmd, r }) => onDone?.(cmd, r),
    },
  );
}

function Components({ n }: { n: NodeInfo }) {
  const [target, setTarget] = useState<string | null>(null);
  const canCmd = useCan('nodes.command');
  const run = useNodeCommand(n, (_c, r) =>
    toast({
      severity: r.ok ? 'success' : 'error',
      title: r.ok
        ? tr('pages.nodes.NodeDetail.s_eb9fc4ed24')
        : tr('pages.nodes.NodeDetail.s_041c83f024'),
      body: r.output.slice(-1)[0],
    }),
  );
  const allowed = n.allowedCommands.includes('restart-component');
  const tone = { ok: 'ok', outdated: 'warn', error: 'err', stopped: 'off' } as const;
  const label = {
    ok: tr('pages.nodes.NodeDetail.s_e23dc64895'),
    outdated: tr('pages.nodes.NodeDetail.s_f63e27fb5c'),
    error: tr('pages.nodes.NodeDetail.s_c394f7f85f'),
    stopped: tr('pages.nodes.NodeDetail.s_037aac4ca4'),
  };
  return (
    <>
      <div className="panel table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>{tr('pages.nodes.NodeDetail.s_8879f45a65')}</th>
              <th>{tr('pages.nodes.NodeDetail.s_97c248cbe0')}</th>
              <th>{tr('pages.nodes.NodeDetail.s_e9ce37f198')}</th>
              <th>{tr('pages.nodes.NodeDetail.s_81e4bb361c')}</th>
              <th className="r" />
            </tr>
          </thead>
          <tbody>
            {n.components.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div className="mono faint" style={{ fontSize: 11 }}>
                    {c.id}
                  </div>
                </td>
                <td className="mono">{c.version}</td>
                <td className="mono">
                  {c.latest && c.latest !== c.version ? (
                    <Badge tone="warn" mono>
                      {c.latest}
                    </Badge>
                  ) : (
                    <span className="faint">{tr('pages.nodes.NodeDetail.s_108ca7117c')}</span>
                  )}
                </td>
                <td>
                  <StatusBadge tone={tone[c.status]} label={label[c.status]} />
                </td>
                <td className="r">
                  <Button
                    size="sm"
                    icon={<RotateCcw size={12} />}
                    disabled={!c.restartable || !allowed || !canCmd || n.status === 'offline'}
                    title={
                      !allowed
                        ? tr('pages.nodes.NodeDetail.s_0ac684532d')
                        : n.status === 'offline'
                          ? tr('pages.nodes.NodeDetail.s_4fcb12b86e')
                          : !c.restartable
                            ? tr('pages.nodes.NodeDetail.s_2f629c1e06')
                            : undefined
                    }
                    loading={run.pending && target === c.id}
                    onClick={() => setTarget(c.id)}
                  >
                    {tr('pages.nodes.NodeDetail.s_7ff2b51c23')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Confirm
        open={!!target}
        onClose={() => setTarget(null)}
        title={tr('pages.nodes.NodeDetail.s_f830fa29e8', { p0: target })}
        body={tr('pages.nodes.NodeDetail.s_3ed81bb52c')}
        confirmLabel={tr('pages.nodes.NodeDetail.s_7ff2b51c23')}
        loading={run.pending}
        onConfirm={async () => {
          await run.run('restart-component', { component: target! });
          setTarget(null);
        }}
      />
    </>
  );
}

function Errors({ n }: { n: NodeInfo }) {
  if (!n.errors.length)
    return (
      <div className="panel">
        <Empty
          icon={<Icon name="check-circle-2" size={18} />}
          title={tr('pages.nodes.NodeDetail.s_c26868825e')}
        >
          {tr('pages.nodes.NodeDetail.s_d504850bff')}
        </Empty>
      </div>
    );
  return (
    <div className="panel">
      <ErrorList errors={n.errors} />
    </div>
  );
}

function NodeEvents({ n }: { n: NodeInfo }) {
  const ev = useQuery(`events/node/${n.id}`, (api) =>
    api.listEvents({ sourceId: n.id, limit: 100 }),
  );
  if (ev.loading) return <SkeletonRows rows={8} />;
  if (ev.error && !ev.data) return <ErrorState error={ev.error} onRetry={ev.refetch} />;
  if (!ev.data?.length)
    return (
      <div className="panel">
        <Empty title={tr('pages.nodes.NodeDetail.s_b5ac581559')}>
          {tr('pages.nodes.NodeDetail.s_a4f40c13f1')}
        </Empty>
      </div>
    );
  return (
    <Panel
      flush
      title={tr('pages.nodes.NodeDetail.s_69c0803b3a')}
      actions={
        <Link className="btn sm" to={`/events?q=${encodeURIComponent(n.id)}`}>
          {tr('pages.nodes.NodeDetail.s_c2f2bf09c3')}
        </Link>
      }
    >
      {ev.data.map((e) => (
        <div
          key={e.id}
          className="logline"
          style={{ gridTemplateColumns: '120px 52px 170px minmax(0,1fr)' }}
        >
          <span className="muted">{fmtDateTime(e.ts)}</span>
          <span className={`sev ${e.severity}`}>{SEVERITY_LABEL[e.severity]}</span>
          <span className="truncate">{e.code}</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5 }}>{e.message}</span>
        </div>
      ))}
    </Panel>
  );
}

interface TermLine {
  kind: 'prompt' | 'out' | 'err' | 'dim' | 'ok';
  text: string;
}

function Console({ n }: { n: NodeInfo }) {
  const canCmd = useCan('nodes.command');
  const canAdmin = useCan('nodes.admin');
  const [cmd, setCmd] = useState<NodeCommandId>('ping');
  const [args, setArgs] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<TermLine[]>([
    {
      kind: 'dim',
      text: tr('pages.nodes.NodeDetail.s_c4ae216044', {
        p0: n.id,
        p1: n.connection.transport,
        p2: n.connection.endpoint,
      }),
    },
    { kind: 'dim', text: tr('pages.nodes.NodeDetail.s_9e24a4390e') },
  ]);
  const [confirm, setConfirm] = useState(false);
  const term = useRef<HTMLDivElement>(null);
  const spec = NODE_COMMANDS.find((c) => c.id === cmd)!;
  const run = useNodeCommand(n);
  useEffect(() => {
    term.current?.scrollTo({ top: term.current.scrollHeight });
  }, [lines]);

  const permOk = (p: string) => p === 'nodes.read' || (p === 'nodes.command' ? canCmd : canAdmin);
  const reason = (c: (typeof NODE_COMMANDS)[number]) =>
    !n.allowedCommands.includes(c.id)
      ? tr('pages.nodes.NodeDetail.s_5be976580b')
      : !permOk(c.permission)
        ? tr('pages.nodes.NodeDetail.s_942a94909e', { p0: c.permission })
        : n.status === 'offline' && c.id !== 'ping'
          ? tr('pages.nodes.NodeDetail.s_0fb4362fb4')
          : null;
  const exec = async () => {
    setConfirm(false);
    const argStr = Object.entries(args)
      .filter(([k]) => spec.args?.some((a) => a.key === k))
      .map(([, v]) => v)
      .join(' ');
    setLines((l) => [
      ...l,
      { kind: 'prompt', text: `delta node ${n.id} ${cmd}${argStr ? ' ' + argStr : ''}` },
    ]);
    const res = await run.run(cmd, args);
    if (!res) {
      setLines((l) => [
        ...l,
        {
          kind: 'err',
          text: tr('pages.nodes.NodeDetail.s_afe1343278', {
            p0: run.error?.code ?? 'ERROR',
            p1: run.error?.message ?? tr('pages.nodes.NodeDetail.s_c78c6da6b7'),
          }),
        },
      ]);
      return;
    }
    setLines((l) => [
      ...l,
      ...res.r.output.map((t) => ({ kind: 'out' as const, text: t })),
      {
        kind: res.r.ok ? 'ok' : 'err',
        text: tr('pages.nodes.NodeDetail.s_a0f74e68ef', {
          p0: res.r.ok ? '✓' : '✗',
          p1: res.r.exitCode ?? (res.r.ok ? 0 : 1),
          p2: res.r.durationMs,
        }),
      },
    ]);
  };
  const r = reason(spec);
  const missingArg = spec.args?.some((a) => !args[a.key]);
  return (
    <div className="grid-aside" style={{ gridTemplateColumns: '300px minmax(0,1fr)' }}>
      <Panel title={tr('pages.nodes.NodeDetail.s_3afd5ef962')} flush>
        {NODE_COMMANDS.map((c) => {
          const why = reason(c);
          return (
            <button
              key={c.id}
              className="viz-option"
              style={{
                border: 0,
                borderBottom: '1px solid var(--rule)',
                borderRadius: 0,
                opacity: why ? 0.5 : 1,
              }}
              aria-pressed={cmd === c.id}
              onClick={() => {
                setCmd(c.id);
                setArgs({});
              }}
            >
              <span className="col" style={{ gap: 1, minWidth: 0 }}>
                <span className="row" style={{ fontWeight: 500 }}>
                  {c.label}
                  {c.dangerous && (
                    <Badge tone="err">{tr('pages.nodes.NodeDetail.s_04a69cdb46')}</Badge>
                  )}
                </span>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {why ?? c.description}
                </span>
              </span>
            </button>
          );
        })}
      </Panel>
      <div className="col gap-3">
        <div className="panel">
          <div className="panel-body">
            <div className="row wrap" style={{ alignItems: 'flex-end' }}>
              <div className="col" style={{ gap: 2, minWidth: 200 }}>
                <span style={{ fontWeight: 600 }}>{spec.label}</span>
                <span className="mono faint" style={{ fontSize: 11 }}>
                  {spec.id} {tr('pages.nodes.NodeDetail.s_d3dacf895c')}
                  {spec.permission}
                </span>
              </div>
              {spec.args?.map((a) => (
                <Field key={a.key} label={a.label}>
                  {a.kind === 'component' ? (
                    <select
                      className="select"
                      style={{ width: 200, maxWidth: '100%' }}
                      value={args[a.key] ?? ''}
                      onChange={(e) => setArgs({ ...args, [a.key]: e.target.value })}
                    >
                      <option value="">{tr('pages.nodes.NodeDetail.s_533af9f788')}</option>
                      {n.components
                        .filter((c) => c.restartable)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      className="input mono"
                      style={{ width: 260, maxWidth: '100%' }}
                      placeholder={tr('pages.nodes.NodeDetail.s_651bc68bd2')}
                      value={args[a.key] ?? ''}
                      onChange={(e) => setArgs({ ...args, [a.key]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !r && !missingArg)
                          spec.dangerous ? setConfirm(true) : exec();
                      }}
                    />
                  )}
                </Field>
              ))}
              <span className="spacer" />
              <Button
                variant={spec.dangerous ? 'danger' : 'primary'}
                icon={<Play size={13} />}
                disabled={!!r || missingArg}
                title={r ?? undefined}
                loading={run.pending}
                onClick={() => (spec.dangerous ? setConfirm(true) : exec())}
              >
                {tr('pages.nodes.NodeDetail.s_224c8e93c8')}
              </Button>
            </div>
            {r && (
              <div className="field-error" style={{ marginTop: 8 }}>
                {tr('pages.nodes.NodeDetail.s_00e97a9ece')}
                {r}
              </div>
            )}
          </div>
        </div>
        <div className="terminal" ref={term} role="log" aria-live="polite">
          {lines.map((l, i) => (
            <div key={i} className={l.kind === 'out' ? '' : l.kind}>
              {l.kind === 'prompt' ? (
                <>
                  <span className="prompt">{tr('pages.nodes.NodeDetail.s_48bb4ccc18')}</span>
                  {l.text}
                </>
              ) : (
                l.text
              )}
            </div>
          ))}
          {run.pending && <div className="dim">{tr('pages.nodes.NodeDetail.s_9d29ce4520')}</div>}
        </div>
        <div className="row">
          <span className="faint" style={{ fontSize: 11.5 }}>
            {tr('pages.nodes.NodeDetail.s_90ab618964')}
            {n.allowedCommands.join(', ')}
          </span>
          <span className="spacer" />
          <Button size="sm" variant="ghost" onClick={() => setLines([])}>
            {tr('pages.nodes.NodeDetail.s_98b2073ed1')}
          </Button>
        </div>
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        danger
        title={tr('pages.nodes.NodeDetail.s_b390ea4885', { p0: spec.label, p1: n.name })}
        body={
          spec.id === 'reboot'
            ? tr('pages.nodes.NodeDetail.s_c53baec1b3')
            : tr('pages.nodes.NodeDetail.s_8f87afc804')
        }
        confirmLabel={tr('pages.nodes.NodeDetail.s_224c8e93c8')}
        requireText={spec.id === 'reboot' ? n.id : undefined}
        onConfirm={exec}
      />
    </div>
  );
}

function Connection({ n }: { n: NodeInfo }) {
  const [cfg, setCfg] = useState(n.connection);
  const [remove, setRemove] = useState(false);
  const [trustConfirm, setTrustConfirm] = useState(false);
  const changeTrust = useMutation((api) => api.setNodeTrust(n.id, !n.trustedAdmin), {
    invalidate: ['nodes'],
    onSuccess: () => setTrustConfirm(false),
  });
  const canAdmin = useCan('nodes.admin');
  const nav = useNavigate();
  const parsed = useMemo(() => ConnectionConfig.safeParse(cfg), [cfg]);
  const errs: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errs[i.path.join('.')] = i.message;
  if (!cfg.endpoint.trim()) errs.endpoint = tr('pages.nodes.NodeDetail.s_d0cc1bc460');
  const dirty = JSON.stringify(cfg) !== JSON.stringify(n.connection);
  const save = useMutation((api) => api.updateNodeConnection(n.id, cfg), {
    invalidate: ['nodes'],
    onSuccess: () =>
      toast({
        severity: 'success',
        title: tr('pages.nodes.NodeDetail.s_56d429ffaa'),
        body: tr('pages.nodes.NodeDetail.s_42bb058d2a'),
      }),
    onError: (e) =>
      toast({
        severity: 'error',
        title: tr('pages.nodes.NodeDetail.s_8976fe0108'),
        body: e.message,
      }),
  });
  const del = useMutation((api) => api.removeNode(n.id), {
    onSuccess: () => {
      queryClient.invalidate('nodes');
      toast({ severity: 'info', title: tr('pages.nodes.NodeDetail.s_2b18323ef4', { p0: n.name }) });
      nav('/nodes');
    },
  });
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg({ ...cfg, [k]: v });
  const num = (k: 'heartbeatSec' | 'maxBackoffSec') => (
    <input
      className={`input mono ${errs[k] ? 'invalid' : ''}`}
      style={{ width: 120 }}
      type="number"
      value={cfg[k]}
      disabled={!canAdmin}
      onChange={(e) => set(k, Number(e.target.value))}
    />
  );
  return (
    <div className="col gap-4">
      {n.trustedAdmin !== undefined && (
        <Panel title={tr('ssh.trust')}>
          <label className="check">
            <input
              type="checkbox"
              checked={n.trustedAdmin}
              disabled={!canAdmin || changeTrust.pending}
              onChange={() => (n.trustedAdmin ? changeTrust.run() : setTrustConfirm(true))}
            />
            {tr('ssh.trustIncoming')}
          </label>
          {changeTrust.error && <div className="field-error">{changeTrust.error.message}</div>}
          <Confirm
            open={trustConfirm}
            onClose={() => setTrustConfirm(false)}
            danger
            title={tr('ssh.trustIncoming')}
            body={tr('ssh.adminWarning')}
            confirmLabel={tr('ssh.saveTrust')}
            loading={changeTrust.pending}
            onConfirm={() => changeTrust.run()}
          />
        </Panel>
      )}
      {n.sshConnection ? (
        <Panel title={tr('ssh.transport')}>
          <p className="mono" style={{ overflowWrap: 'anywhere' }}>
            {n.sshConnection.host}
            {':'}
            {n.sshConnection.port}
          </p>
          <Field label={tr('ssh.fingerprint')}>
            <code style={{ overflowWrap: 'anywhere' }}>{n.sshConnection.fingerprint}</code>
          </Field>
          <p className="muted">{tr('ssh.background')}</p>
        </Panel>
      ) : (
        <Panel
          title={tr('pages.nodes.NodeDetail.s_47a23743fc')}
          actions={
            <>
              <Wifi size={14} className="muted" />
              <span className="muted" style={{ fontSize: 12 }}>
                {tr('pages.nodes.NodeDetail.s_e724c1cb96')}
                {n.latencyMs ?? '—'} {tr('pages.nodes.NodeDetail.s_5160aea6bb')}
              </span>
            </>
          }
        >
          <div className="form-row">
            <div>
              <div className="field-label">{tr('pages.nodes.NodeDetail.s_e25d2d0eed')}</div>
              <div className="field-help">{tr('pages.nodes.NodeDetail.s_b664474aa5')}</div>
            </div>
            <Segmented
              value={cfg.transport}
              onChange={(v) => set('transport', v)}
              options={(['wss', 'grpc', 'mqtt', 'adb-relay'] as const).map((v) => ({
                value: v,
                label: v,
              }))}
            />
          </div>
          <div className="form-row">
            <div>
              <div className="field-label">{tr('pages.nodes.NodeDetail.s_21ad4b9f38')}</div>
              <div className="field-help">{tr('pages.nodes.NodeDetail.s_1c976ed51d')}</div>
            </div>
            <Field error={errs.endpoint}>
              <input
                className={`input mono ${errs.endpoint ? 'invalid' : ''}`}
                value={cfg.endpoint}
                disabled={!canAdmin}
                onChange={(e) => set('endpoint', e.target.value)}
              />
            </Field>
          </div>
          <div className="form-row">
            <div>
              <div className="field-label">{tr('pages.nodes.NodeDetail.s_2a7387f492')}</div>
              <div className="field-help">{tr('pages.nodes.NodeDetail.s_ba91655600')}</div>
            </div>
            <Field error={errs.heartbeatSec}>{num('heartbeatSec')}</Field>
          </div>
          <div className="form-row">
            <div>
              <div className="field-label">{tr('pages.nodes.NodeDetail.s_a8e2cfb793')}</div>
            </div>
            <div className="row wrap gap-3">
              <Segmented
                sans
                value={cfg.reconnect}
                onChange={(v) => set('reconnect', v)}
                options={[
                  { value: 'exponential', label: tr('pages.nodes.NodeDetail.s_385a16b6ef') },
                  { value: 'linear', label: tr('pages.nodes.NodeDetail.s_c12f117198') },
                  { value: 'manual', label: tr('pages.nodes.NodeDetail.s_5ec7b0f52b') },
                ]}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                {tr('pages.nodes.NodeDetail.s_77266b937a')}
              </span>
              <Field error={errs.maxBackoffSec}>{num('maxBackoffSec')}</Field>
            </div>
          </div>
          <div className="form-row">
            <div>
              <div className="field-label">{tr('pages.nodes.NodeDetail.s_d91e1888f2')}</div>
              <div className="field-help">{tr('pages.nodes.NodeDetail.s_c165229e15')}</div>
            </div>
            <div className="row">
              <Switch checked={cfg.tls} disabled={!canAdmin} onChange={(v) => set('tls', v)} />
              {!cfg.tls && <Badge tone="warn">{tr('pages.nodes.NodeDetail.s_48a0d60af9')}</Badge>}
            </div>
          </div>
          <div className="form-row">
            <div>
              <div className="field-label">{tr('pages.nodes.NodeDetail.s_63b71f6785')}</div>
            </div>
            <Switch
              checked={cfg.compression}
              disabled={!canAdmin}
              onChange={(v) => set('compression', v)}
            />
          </div>
          {(n.kind === 'android' || cfg.meteredPolicy) && (
            <div className="form-row">
              <div>
                <div className="field-label">{tr('pages.nodes.NodeDetail.s_6679cdceb0')}</div>
                <div className="field-help">{tr('pages.nodes.NodeDetail.s_4b20fd742b')}</div>
              </div>
              <Segmented
                sans
                value={cfg.meteredPolicy ?? 'essential'}
                onChange={(v) => set('meteredPolicy', v)}
                options={[
                  { value: 'full', label: tr('pages.nodes.NodeDetail.s_fc7905a75b') },
                  { value: 'essential', label: tr('pages.nodes.NodeDetail.s_65787e9a7f') },
                  { value: 'paused', label: tr('pages.nodes.NodeDetail.s_03498e395a') },
                ]}
              />
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <span className="spacer" />
            <Button disabled={!dirty} onClick={() => setCfg(n.connection)}>
              {tr('pages.nodes.NodeDetail.s_058f162d29')}
            </Button>
            <Button
              variant="primary"
              perm="nodes.admin"
              disabled={!dirty || Object.keys(errs).length > 0}
              loading={save.pending}
              onClick={() => save.run()}
            >
              {tr('pages.nodes.NodeDetail.s_4864057d62')}
            </Button>
          </div>
        </Panel>
      )}
      <div
        className="panel"
        style={{ borderColor: 'color-mix(in srgb, var(--err) 35%, var(--rule))' }}
      >
        <div className="panel-body row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{tr('pages.nodes.NodeDetail.s_cd579ec9b5')}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {tr('pages.nodes.NodeDetail.s_6f6b815715')}
            </div>
          </div>
          <Button
            variant="danger"
            icon={<Trash2 size={14} />}
            perm="nodes.admin"
            onClick={() => setRemove(true)}
          >
            {tr('pages.nodes.NodeDetail.s_94d07a2171')}
          </Button>
        </div>
      </div>
      <Confirm
        open={remove}
        onClose={() => setRemove(false)}
        danger
        title={tr('pages.nodes.NodeDetail.s_cfeed80985', { p0: n.name })}
        body={tr('pages.nodes.NodeDetail.s_0a94a3831f')}
        requireText={n.id}
        confirmLabel={tr('pages.nodes.NodeDetail.s_cd579ec9b5')}
        loading={del.pending}
        onConfirm={() => del.run()}
      />
    </div>
  );
}
