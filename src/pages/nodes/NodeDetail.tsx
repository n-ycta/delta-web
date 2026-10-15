import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ChevronLeft, Play, RotateCcw, Terminal, Trash2, Wifi } from 'lucide-react';
import { useNodes, usePlugins } from '@/app/data';
import { queryClient, useMutation, useQuery } from '@/app/query';
import { toast, useCan } from '@/app/stores';
import { useChartColors } from '@/app/theme';
import { ConnectionConfig, NODE_COMMANDS, NODE_KIND_LABEL, type NodeCommandId, type NodeInfo, type Series } from '@/core/contracts';
import { ago, fmtBytes, fmtDate, fmtDateTime, fmtDuration, fmtAxisTime, DAY, HOUR } from '@/core/lib/format';
import { Badge, Button, Field, Meter, PageHead, Panel, Segmented, StatusBadge, Switch, Tabs } from '@/ui/primitives';
import { Confirm } from '@/ui/overlays';
import { ChartSkeleton, Empty, ErrorState, Skeleton, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { NODE_STATUS, PLUGIN_STATUS, SEVERITY_LABEL } from '@/ui/status';
import { NODE_ICON } from '@/widgets/system/NodeGridWidget';
import { ChartTooltip } from '@/widgets/shared';

type Tab = 'overview' | 'processes' | 'plugins' | 'components' | 'errors' | 'events' | 'console' | 'connection';
const RANGES = { '1h': HOUR, '24h': DAY, '7d': 7 * DAY } as const;

export function NodeDetail() {
  const { id = '' } = useParams();
  const nodes = useNodes();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const n = nodes.data?.find((x) => x.id === id);

  if (nodes.loading) return <div className="page"><Skeleton h={48} w={360} /><div style={{ height: 20 }} /><SkeletonRows rows={8} /></div>;
  if (nodes.error && !nodes.data) return <div className="page"><ErrorState error={nodes.error} onRetry={nodes.refetch} /></div>;
  if (!n) return <div className="page"><div className="panel"><Empty title="Узел не найден" action={<Link className="btn" to="/nodes">Все узлы</Link>}>Узел <code>{id}</code> удалён или ещё не подключён.</Empty></div></div>;

  const st = NODE_STATUS[n.status];
  const errCount = n.errors.reduce((s, e) => s + e.count, 0);
  const crashed = n.processes.filter((p) => p.status === 'crashed').length;
  return (
    <div className="page">
      <Link to="/nodes" className="row muted" style={{ fontSize: 12, marginBottom: 10, gap: 4 }}><ChevronLeft size={13} />Узлы</Link>
      <PageHead
        title={<span className="row" style={{ gap: 14 }}><span className="plug-icon lg"><Icon name={NODE_ICON[n.kind]} size={22} /></span><span className="col" style={{ gap: 2 }}><span>{n.name}</span><span className="mono muted" style={{ fontSize: 12, fontWeight: 400, letterSpacing: 0 }}>{n.id} · {NODE_KIND_LABEL[n.kind]} · {n.os} {n.arch} · {n.address}</span></span></span>}
        actions={<>
          <StatusBadge tone={st.tone} label={st.label} pulse={n.status === 'online'} />
          <span className="muted" style={{ fontSize: 12 }}>контакт {ago(n.lastSeen)}</span>
          <Button icon={<Terminal size={14} />} onClick={() => setParams({ tab: 'console' })}>Консоль</Button>
        </>}
      />
      {n.status === 'offline' && (
        <div className="banner err" style={{ borderRadius: 6, border: 0, marginBottom: 16 }}>
          <AlertTriangle size={15} /><span className="grow">Нет связи с агентом с {fmtDateTime(n.lastSeen)}. Данные плагинов на узле буферизуются и будут выгружены после восстановления.</span>
          <Button size="sm" onClick={() => setParams({ tab: 'connection' })}>Параметры подключения</Button>
        </div>
      )}
      {n.status === 'degraded' && n.errors[0] && (
        <div className="banner warn" style={{ borderRadius: 6, border: 0, marginBottom: 16 }}>
          <AlertTriangle size={15} /><span className="grow"><b>{n.errors[0].code}</b>: {n.errors[0].message}</span>
          <Button size="sm" onClick={() => setParams({ tab: 'errors' })}>Все ошибки</Button>
        </div>
      )}
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'overview', label: 'Обзор' },
        { id: 'processes', label: 'Процессы', count: n.processes.length, alert: crashed > 0 },
        { id: 'plugins', label: 'Плагины', count: n.pluginIds.length },
        { id: 'components', label: 'Компоненты', count: n.components.length, alert: n.components.some((c) => c.status === 'error') },
        { id: 'errors', label: 'Ошибки', count: errCount || undefined, alert: errCount > 0 },
        { id: 'events', label: 'События' },
        { id: 'console', label: 'Команды' },
        { id: 'connection', label: 'Подключение' },
      ]} />
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

function MiniChart({ s, unit, span, color, max }: { s: Series; unit: string; span: number; color: string; max?: number }) {
  const c = useChartColors();
  const data = s.points.map((p) => ({ t: p.t, v: p.v }));
  const gid = `g-${s.key}`;
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.18} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t) => fmtAxisTime(t, span)} tick={{ fill: c.axis, fontSize: 10.5 }} stroke={c.grid} minTickGap={40} />
        <YAxis domain={[0, max ?? 'auto']} tick={{ fill: c.axis, fontSize: 10.5 }} stroke={c.grid} width={44} />
        <Tooltip content={<ChartTooltip unit={unit} decimals={1} span={span} labels={{ v: s.label }} />} />
        <Area dataKey="v" name={s.label} stroke={color} strokeWidth={1.5} fill={`url(#${gid})`} isAnimationActive={false} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Overview({ n }: { n: NodeInfo }) {
  const [range, setRange] = useState<keyof typeof RANGES>('24h');
  const span = RANGES[range];
  const hist = useQuery(`nodes/${n.id}/history/${range}`, (api) => api.getNodeHistory(n.id, span), { refetchMs: 60000 });
  const up = useQuery(`nodes/${n.id}/uptime`, (api) => api.getNodeUptime(n.id, 90));
  const c = useChartColors();
  const avail = up.data ? up.data.filter((d) => d.state !== 'nodata') : [];
  const availPct = avail.length ? (avail.reduce((s, d) => s + d.availability, 0) / avail.length) * 100 : null;
  const off = n.status === 'offline';
  const tone = (v: number) => (v > 0.9 ? 'err' : v > 0.75 ? 'warn' : undefined);
  return (
    <div className="grid-aside">
      <div className="col gap-4">
        <div className="strip" style={{ marginBottom: 0 }}>
          <div><div className="label">CPU · {n.cores} ядер</div><div className="v">{off ? '—' : `${Math.round(n.cpu)}%`}</div></div>
          <div><div className="label">Память</div><div className="v">{fmtBytes(n.memUsed)}<small>из {fmtBytes(n.memTotal)}</small></div></div>
          <div><div className="label">Диск</div><div className="v" style={{ color: n.diskUsed / n.diskTotal > 0.9 ? 'var(--err)' : undefined }}>{Math.round((n.diskUsed / n.diskTotal) * 100)}%<small>{fmtBytes(n.diskTotal - n.diskUsed)} своб.</small></div></div>
          <div><div className="label">Аптайм</div><div className="v">{off ? '—' : fmtDuration(n.uptimeSec)}</div></div>
          {n.battery ? <div><div className="label">Батарея</div><div className="v">{Math.round(n.battery.level * 100)}%<small>{n.battery.charging ? 'заряжается' : 'от батареи'}</small></div></div>
            : <div><div className="label">RTT</div><div className="v">{off || n.latencyMs === undefined ? '—' : n.latencyMs}<small>мс</small></div></div>}
        </div>
        <Panel title="Ресурсы" actions={<Segmented value={range} onChange={setRange} options={Object.keys(RANGES).map((k) => ({ value: k as keyof typeof RANGES, label: k }))} />}>
          {hist.error && !hist.data ? <ErrorState compact error={hist.error} onRetry={hist.refetch} /> : (
            <div className="grid-3">
              {(['cpu', 'mem', 'latency'] as const).map((k, i) => (
                <div key={k}>
                  <div className="label" style={{ marginBottom: 6 }}>{k === 'cpu' ? 'CPU, %' : k === 'mem' ? 'Память, %' : 'Задержка, мс'}</div>
                  {hist.data ? <MiniChart s={hist.data[k]} unit={k === 'latency' ? 'ms' : '%'} span={span} color={c.series[i]} max={k === 'latency' ? undefined : 100} /> : <ChartSkeleton />}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Доступность за 90 дней" meta={availPct !== null && <span className="num muted">{availPct.toFixed(2)}%</span>}>
          {up.error && !up.data ? <ErrorState compact error={up.error} onRetry={up.refetch} /> : up.data ? (
            <>
              <div className="uptime">{up.data.map((d) => <span key={d.day} className={d.state === 'up' ? '' : d.state} title={`${fmtDate(d.day)} — ${d.state === 'nodata' ? 'нет данных' : `${(d.availability * 100).toFixed(1)}%`}`} />)}</div>
              <div className="row muted" style={{ fontSize: 11, marginTop: 6 }}><span>90 дней назад</span><span className="spacer" /><span>сегодня</span></div>
            </>
          ) : <Skeleton h={26} />}
        </Panel>
        {n.errors.length > 0 && <Panel title="Последние ошибки" flush><ErrorList errors={n.errors.slice(0, 3)} /></Panel>}
      </div>
      <div className="col gap-4">
        <Panel title="Сведения">
          <dl className="kv">
            <dt>Тип</dt><dd>{NODE_KIND_LABEL[n.kind]}</dd>
            <dt>ОС / архитектура</dt><dd>{n.os} · {n.arch}</dd>
            <dt>Адрес</dt><dd className="mono">{n.address}</dd>
            {n.location && <><dt>Расположение</dt><dd>{n.location}</dd></>}
            <dt>Агент</dt><dd className="mono">{n.agentVersion}</dd>
            <dt>Транспорт</dt><dd className="mono">{n.connection.transport} · {n.connection.heartbeatSec}s</dd>
            {n.tempC !== undefined && <><dt>Температура</dt><dd className="num">{n.tempC.toFixed(0)} °C</dd></>}
            <dt>Последний контакт</dt><dd>{fmtDateTime(n.lastSeen)}</dd>
            <dt>Теги</dt><dd className="row wrap gap-1">{n.tags.map((t) => <Badge key={t} mono outline>{t}</Badge>)}</dd>
          </dl>
        </Panel>
        <Panel title="Нагрузка сейчас">
          <div className="col gap-3">
            {[['CPU', n.cpu / 100], ['Память', n.memUsed / n.memTotal], ['Диск', n.diskUsed / n.diskTotal]].map(([l, v]) => (
              <div key={l as string} className="col" style={{ gap: 4 }}><div className="row" style={{ fontSize: 12 }}><span className="muted">{l}</span><span className="spacer" /><span className="num">{Math.round((v as number) * 100)}%</span></div><Meter value={v as number} tone={tone(v as number)} /></div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ErrorList({ errors }: { errors: NodeInfo['errors'] }) {
  return <div>{errors.map((e, i) => (
    <div key={i} className="issue" style={{ gridTemplateColumns: '16px 170px minmax(0,1fr) auto' }}>
      <AlertTriangle size={14} color="var(--err)" style={{ marginTop: 2 }} />
      <span className="mono" style={{ fontSize: 11.5 }}>{e.code}</span>
      <span><div>{e.message}</div><div className="p">{e.component} · последнее {ago(e.ts)}</div></span>
      <Badge mono tone="err">×{e.count}</Badge>
    </div>
  ))}</div>;
}

function Processes({ n }: { n: NodeInfo }) {
  const [sort, setSort] = useState<'cpu' | 'mem' | 'name'>('cpu');
  const list = [...n.processes].sort((a, b) => sort === 'cpu' ? b.cpu - a.cpu : sort === 'mem' ? b.memMb - a.memMb : a.name.localeCompare(b.name));
  if (!list.length) return <div className="panel"><Empty title="Нет данных о процессах">{n.status === 'offline' ? 'Узел не в сети — снимок процессов недоступен.' : 'Агент не передаёт список процессов.'}</Empty></div>;
  const tone = { running: 'ok', sleeping: 'off', stopped: 'off', crashed: 'err', restarting: 'warn' } as const;
  return (
    <div className="panel table-wrap">
      <table className="t">
        <thead><tr><th className="r">PID</th><th className="sortable" onClick={() => setSort('name')}>Процесс</th><th>Компонент</th><th>Статус</th><th className="r sortable" onClick={() => setSort('cpu')}>CPU {sort === 'cpu' && '↓'}</th><th className="r sortable" onClick={() => setSort('mem')}>RSS {sort === 'mem' && '↓'}</th><th className="r">Рестарты</th><th>Запущен</th></tr></thead>
        <tbody>{list.map((p) => (
          <tr key={p.pid}><td className="num">{p.pid}</td><td className="mono">{p.name}</td><td className="muted">{p.component}</td>
            <td><StatusBadge tone={tone[p.status]} label={p.status} /></td>
            <td className="num">{p.cpu.toFixed(1)}%</td><td className="num">{p.memMb.toFixed(0)} MB</td>
            <td className="num" style={{ color: p.restarts > 3 ? 'var(--warn)' : undefined }}>{p.restarts}</td><td className="muted">{ago(p.startedAt)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function NodePlugins({ n }: { n: NodeInfo }) {
  const plugins = usePlugins();
  const nav = useNavigate();
  const list = (plugins.data ?? []).filter((p) => n.pluginIds.includes(p.manifest.id));
  if (plugins.loading) return <SkeletonRows rows={4} />;
  if (!list.length) return <div className="panel"><Empty title="На узле нет плагинов" action={<Link className="btn" to="/plugins?tab=available">Каталог плагинов</Link>}>Плагины назначаются узлам при установке или в карточке плагина.</Empty></div>;
  return (
    <div className="panel table-wrap"><table className="t">
      <thead><tr><th>Плагин</th><th>Версия</th><th>Статус</th><th>Поддерживаемые узлы</th><th>Синхронизация</th></tr></thead>
      <tbody>{list.map((p) => (
        <tr key={p.manifest.id} className="clickable" onClick={() => nav(`/plugins/${encodeURIComponent(p.manifest.id)}`)}>
          <td><span className="row"><Icon name={p.manifest.icon} size={15} className="muted" />{p.manifest.name}</span></td>
          <td className="mono">{p.instance.installedVersion ?? p.manifest.version}</td>
          <td><StatusBadge {...PLUGIN_STATUS[p.instance.status]} /></td>
          <td className="muted">{p.manifest.runtime.targets.map((k) => NODE_KIND_LABEL[k]).join(', ')}</td>
          <td className="muted">{p.instance.lastSyncAt ? ago(p.instance.lastSyncAt) : '—'}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

function useNodeCommand(n: NodeInfo, onDone?: (cmd: NodeCommandId, r: { ok: boolean; output: string[]; durationMs: number; exitCode?: number }) => void) {
  return useMutation((api, cmd: NodeCommandId, args?: Record<string, string>) => api.runNodeCommand(n.id, cmd, args).then((r) => ({ cmd, r })), {
    invalidate: ['nodes', 'events'],
    onSuccess: ({ cmd, r }) => onDone?.(cmd, r),
  });
}

function Components({ n }: { n: NodeInfo }) {
  const [target, setTarget] = useState<string | null>(null);
  const canCmd = useCan('nodes.command');
  const run = useNodeCommand(n, (_c, r) => toast({ severity: r.ok ? 'success' : 'error', title: r.ok ? 'Компонент перезапущен' : 'Перезапуск не удался', body: r.output.slice(-1)[0] }));
  const allowed = n.allowedCommands.includes('restart-component');
  const tone = { ok: 'ok', outdated: 'warn', error: 'err', stopped: 'off' } as const;
  const label = { ok: 'работает', outdated: 'устарел', error: 'ошибка', stopped: 'остановлен' };
  return (
    <>
      <div className="panel table-wrap"><table className="t">
        <thead><tr><th>Компонент</th><th>Версия</th><th>Доступна</th><th>Состояние</th><th className="r" /></tr></thead>
        <tbody>{n.components.map((c) => (
          <tr key={c.id}><td><div style={{ fontWeight: 500 }}>{c.name}</div><div className="mono faint" style={{ fontSize: 11 }}>{c.id}</div></td>
            <td className="mono">{c.version}</td><td className="mono">{c.latest && c.latest !== c.version ? <Badge tone="warn" mono>{c.latest}</Badge> : <span className="faint">актуальна</span>}</td>
            <td><StatusBadge tone={tone[c.status]} label={label[c.status]} /></td>
            <td className="r"><Button size="sm" icon={<RotateCcw size={12} />} disabled={!c.restartable || !allowed || !canCmd || n.status === 'offline'} title={!allowed ? 'Команда не разрешена политикой узла' : n.status === 'offline' ? 'Узел не в сети' : !c.restartable ? 'Компонент нельзя перезапустить отдельно' : undefined} loading={run.pending && target === c.id} onClick={() => setTarget(c.id)}>Перезапустить</Button></td></tr>
        ))}</tbody>
      </table></div>
      <Confirm open={!!target} onClose={() => setTarget(null)} title={`Перезапустить ${target}?`} body="Процесс будет остановлен и запущен заново. Буферизованные данные сохранятся." confirmLabel="Перезапустить" loading={run.pending}
        onConfirm={async () => { await run.run('restart-component', { component: target! }); setTarget(null); }} />
    </>
  );
}

function Errors({ n }: { n: NodeInfo }) {
  if (!n.errors.length) return <div className="panel"><Empty icon={<Icon name="check-circle-2" size={18} />} title="Ошибок нет">Агент не сообщал об ошибках за последние 7 дней.</Empty></div>;
  return <div className="panel"><ErrorList errors={n.errors} /></div>;
}

function NodeEvents({ n }: { n: NodeInfo }) {
  const ev = useQuery(`events/node/${n.id}`, (api) => api.listEvents({ sourceId: n.id, limit: 100 }));
  if (ev.loading) return <SkeletonRows rows={8} />;
  if (ev.error && !ev.data) return <ErrorState error={ev.error} onRetry={ev.refetch} />;
  if (!ev.data?.length) return <div className="panel"><Empty title="Событий нет">По этому узлу в журнале ядра нет записей.</Empty></div>;
  return (
    <Panel flush title="События узла" actions={<Link className="btn sm" to={`/events?q=${encodeURIComponent(n.id)}`}>Открыть в журнале</Link>}>
      {ev.data.map((e) => (
        <div key={e.id} className="logline" style={{ gridTemplateColumns: '120px 52px 170px minmax(0,1fr)' }}>
          <span className="muted">{fmtDateTime(e.ts)}</span><span className={`sev ${e.severity}`}>{SEVERITY_LABEL[e.severity]}</span><span className="truncate">{e.code}</span><span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5 }}>{e.message}</span>
        </div>
      ))}
    </Panel>
  );
}

interface TermLine { kind: 'prompt' | 'out' | 'err' | 'dim' | 'ok'; text: string }

function Console({ n }: { n: NodeInfo }) {
  const canCmd = useCan('nodes.command');
  const canAdmin = useCan('nodes.admin');
  const [cmd, setCmd] = useState<NodeCommandId>('ping');
  const [args, setArgs] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<TermLine[]>([{ kind: 'dim', text: `# сеанс к ${n.id} · ${n.connection.transport} · ${n.connection.endpoint}` }, { kind: 'dim', text: '# команды выполняются агентом в рамках политики узла и прав вашей роли' }]);
  const [confirm, setConfirm] = useState(false);
  const term = useRef<HTMLDivElement>(null);
  const spec = NODE_COMMANDS.find((c) => c.id === cmd)!;
  const run = useNodeCommand(n);
  useEffect(() => { term.current?.scrollTo({ top: term.current.scrollHeight }); }, [lines]);

  const permOk = (p: string) => p === 'nodes.read' || (p === 'nodes.command' ? canCmd : canAdmin);
  const reason = (c: typeof NODE_COMMANDS[number]) => !n.allowedCommands.includes(c.id) ? 'запрещено политикой узла' : !permOk(c.permission) ? `нужно право ${c.permission}` : n.status === 'offline' && c.id !== 'ping' ? 'узел не в сети' : null;
  const exec = async () => {
    setConfirm(false);
    const argStr = Object.entries(args).filter(([k]) => spec.args?.some((a) => a.key === k)).map(([, v]) => v).join(' ');
    setLines((l) => [...l, { kind: 'prompt', text: `delta node ${n.id} ${cmd}${argStr ? ' ' + argStr : ''}` }]);
    const res = await run.run(cmd, args);
    if (!res) { setLines((l) => [...l, { kind: 'err', text: `✗ ${run.error?.code ?? 'ERROR'}: ${run.error?.message ?? 'команда не выполнена'}` }]); return; }
    setLines((l) => [...l, ...res.r.output.map((t) => ({ kind: 'out' as const, text: t })), { kind: res.r.ok ? 'ok' : 'err', text: `${res.r.ok ? '✓' : '✗'} exit ${res.r.exitCode ?? (res.r.ok ? 0 : 1)} · ${res.r.durationMs} мс` }]);
  };
  const r = reason(spec);
  const missingArg = spec.args?.some((a) => !args[a.key]);
  return (
    <div className="grid-aside" style={{ gridTemplateColumns: '300px minmax(0,1fr)' }}>
      <Panel title="Команды" flush>
        {NODE_COMMANDS.map((c) => {
          const why = reason(c);
          return (
            <button key={c.id} className="viz-option" style={{ border: 0, borderBottom: '1px solid var(--rule)', borderRadius: 0, opacity: why ? 0.5 : 1 }} aria-pressed={cmd === c.id} onClick={() => { setCmd(c.id); setArgs({}); }}>
              <span className="col" style={{ gap: 1, minWidth: 0 }}>
                <span className="row" style={{ fontWeight: 500 }}>{c.label}{c.dangerous && <Badge tone="err">опасно</Badge>}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{why ?? c.description}</span>
              </span>
            </button>
          );
        })}
      </Panel>
      <div className="col gap-3">
        <div className="panel"><div className="panel-body">
          <div className="row wrap" style={{ alignItems: 'flex-end' }}>
            <div className="col" style={{ gap: 2, minWidth: 200 }}><span style={{ fontWeight: 600 }}>{spec.label}</span><span className="mono faint" style={{ fontSize: 11 }}>{spec.id} · {spec.permission}</span></div>
            {spec.args?.map((a) => (
              <Field key={a.key} label={a.label}>
                {a.kind === 'component'
                  ? <select className="select" style={{ width: 200 }} value={args[a.key] ?? ''} onChange={(e) => setArgs({ ...args, [a.key]: e.target.value })}><option value="">— выберите —</option>{n.components.filter((c) => c.restartable).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  : <input className="input mono" style={{ width: 260 }} placeholder="uptime | df -h | journalctl -n 50" value={args[a.key] ?? ''} onChange={(e) => setArgs({ ...args, [a.key]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !r && !missingArg) (spec.dangerous ? setConfirm(true) : exec()); }} />}
              </Field>
            ))}
            <span className="spacer" />
            <Button variant={spec.dangerous ? 'danger' : 'primary'} icon={<Play size={13} />} disabled={!!r || missingArg} title={r ?? undefined} loading={run.pending} onClick={() => (spec.dangerous ? setConfirm(true) : exec())}>Выполнить</Button>
          </div>
          {r && <div className="field-error" style={{ marginTop: 8 }}>Недоступно: {r}</div>}
        </div></div>
        <div className="terminal" ref={term} role="log" aria-live="polite">
          {lines.map((l, i) => <div key={i} className={l.kind === 'out' ? '' : l.kind}>{l.kind === 'prompt' ? <><span className="prompt">$ </span>{l.text}</> : l.text}</div>)}
          {run.pending && <div className="dim">… ожидание ответа агента</div>}
        </div>
        <div className="row"><span className="faint" style={{ fontSize: 11.5 }}>Разрешено политикой: {n.allowedCommands.join(', ')}</span><span className="spacer" /><Button size="sm" variant="ghost" onClick={() => setLines([])}>Очистить</Button></div>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} danger title={`${spec.label} на ${n.name}?`} body={spec.id === 'reboot' ? 'Узел будет недоступен 1–3 минуты. Плагины на нём временно перестанут собирать данные.' : 'Команда выполнится с правами агента. Проверьте её перед запуском.'}
        confirmLabel="Выполнить" requireText={spec.id === 'reboot' ? n.id : undefined} onConfirm={exec} />
    </div>
  );
}

function Connection({ n }: { n: NodeInfo }) {
  const [cfg, setCfg] = useState(n.connection);
  const [remove, setRemove] = useState(false);
  const canAdmin = useCan('nodes.admin');
  const nav = useNavigate();
  const parsed = useMemo(() => ConnectionConfig.safeParse(cfg), [cfg]);
  const errs: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errs[i.path.join('.')] = i.message;
  if (!cfg.endpoint.trim()) errs.endpoint = 'Укажите адрес';
  const dirty = JSON.stringify(cfg) !== JSON.stringify(n.connection);
  const save = useMutation((api) => api.updateNodeConnection(n.id, cfg), { invalidate: ['nodes'], onSuccess: () => toast({ severity: 'success', title: 'Параметры подключения сохранены', body: 'Агент применит их при следующем heartbeat' }), onError: (e) => toast({ severity: 'error', title: 'Не сохранено', body: e.message }) });
  const del = useMutation((api) => api.removeNode(n.id), { onSuccess: () => { queryClient.invalidate('nodes'); toast({ severity: 'info', title: `Узел ${n.name} отключён` }); nav('/nodes'); } });
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg({ ...cfg, [k]: v });
  const num = (k: 'heartbeatSec' | 'maxBackoffSec') => <input className={`input mono ${errs[k] ? 'invalid' : ''}`} style={{ width: 120 }} type="number" value={cfg[k]} disabled={!canAdmin} onChange={(e) => set(k, Number(e.target.value))} />;
  return (
    <div className="col gap-4" style={{ maxWidth: 900 }}>
      <Panel title="Подключение к ядру" actions={<><Wifi size={14} className="muted" /><span className="muted" style={{ fontSize: 12 }}>RTT {n.latencyMs ?? '—'} мс</span></>}>
        <div className="form-row"><div><div className="field-label">Транспорт</div><div className="field-help">Канал между агентом и ядром</div></div>
          <Segmented value={cfg.transport} onChange={(v) => set('transport', v)} options={(['wss', 'grpc', 'mqtt', 'adb-relay'] as const).map((v) => ({ value: v, label: v }))} /></div>
        <div className="form-row"><div><div className="field-label">Адрес ядра</div><div className="field-help">host:port или URL</div></div>
          <Field error={errs.endpoint}><input className={`input mono ${errs.endpoint ? 'invalid' : ''}`} value={cfg.endpoint} disabled={!canAdmin} onChange={(e) => set('endpoint', e.target.value)} /></Field></div>
        <div className="form-row"><div><div className="field-label">Heartbeat, с</div><div className="field-help">5–600. Чаще — точнее статус, больше трафика</div></div><Field error={errs.heartbeatSec}>{num('heartbeatSec')}</Field></div>
        <div className="form-row"><div><div className="field-label">Переподключение</div></div>
          <div className="row wrap gap-3"><Segmented sans value={cfg.reconnect} onChange={(v) => set('reconnect', v)} options={[{ value: 'exponential', label: 'Экспоненциально' }, { value: 'linear', label: 'Линейно' }, { value: 'manual', label: 'Вручную' }]} />
            <span className="muted" style={{ fontSize: 12 }}>макс. пауза</span><Field error={errs.maxBackoffSec}>{num('maxBackoffSec')}</Field></div></div>
        <div className="form-row"><div><div className="field-label">TLS</div><div className="field-help">Отключать только в доверенной сети</div></div><div className="row"><Switch checked={cfg.tls} disabled={!canAdmin} onChange={(v) => set('tls', v)} />{!cfg.tls && <Badge tone="warn">трафик не шифруется</Badge>}</div></div>
        <div className="form-row"><div><div className="field-label">Сжатие</div></div><Switch checked={cfg.compression} disabled={!canAdmin} onChange={(v) => set('compression', v)} /></div>
        {(n.kind === 'android' || cfg.meteredPolicy) && (
          <div className="form-row"><div><div className="field-label">Мобильная сеть</div><div className="field-help">Поведение на лимитном соединении</div></div>
            <Segmented sans value={cfg.meteredPolicy ?? 'essential'} onChange={(v) => set('meteredPolicy', v)} options={[{ value: 'full', label: 'Всё' }, { value: 'essential', label: 'Только важное' }, { value: 'paused', label: 'Пауза' }]} /></div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <span className="spacer" />
          <Button disabled={!dirty} onClick={() => setCfg(n.connection)}>Сбросить</Button>
          <Button variant="primary" perm="nodes.admin" disabled={!dirty || Object.keys(errs).length > 0} loading={save.pending} onClick={() => save.run()}>Сохранить</Button>
        </div>
      </Panel>
      <div className="panel" style={{ borderColor: 'color-mix(in srgb, var(--err) 35%, var(--rule))' }}>
        <div className="panel-body row">
          <div className="grow"><div style={{ fontWeight: 600 }}>Отключить узел</div><div className="muted" style={{ fontSize: 12.5 }}>Агент будет отозван, плагины на узле перестанут отправлять данные. Исторические данные сохранятся в ядре.</div></div>
          <Button variant="danger" icon={<Trash2 size={14} />} perm="nodes.admin" onClick={() => setRemove(true)}>Отключить</Button>
        </div>
      </div>
      <Confirm open={remove} onClose={() => setRemove(false)} danger title={`Отключить ${n.name}?`} body="Токен агента будет отозван. Чтобы вернуть узел, потребуется повторное сопряжение." requireText={n.id} confirmLabel="Отключить узел" loading={del.pending} onConfirm={() => del.run()} />
    </div>
  );
}


