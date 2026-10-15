import { tr } from '@/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BatteryLow, Plus, Search } from 'lucide-react';
import { useNodes } from '@/app/data';
import { NODE_KIND_LABEL, type NodeInfo } from '@/core/contracts';
import { ago, fmtBytes } from '@/core/lib/format';
import { Badge, Button, Meter, PageHead, StatusBadge } from '@/ui/primitives';
import { Empty, ErrorState, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { NODE_STATUS } from '@/ui/status';
import { NODE_ICON } from '@/widgets/system/NodeGridWidget';
import { PairDialog } from './PairDialog';

const LATEST_AGENT = '1.8.2';

export function NodesPage() {
  const nodes = useNodes();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [pair, setPair] = useState(false);
  const [sort, setSort] = useState<'status' | 'name' | 'cpu' | 'seen'>('status');
  useEffect(() => { if (params.get('pair')) { setPair(true); params.delete('pair'); setParams(params, { replace: true }); } }, [params, setParams]);
  const all = nodes.data ?? [];
  const order = { offline: 0, degraded: 1, connecting: 2, online: 3 } as const;
  const list = useMemo(() => all.filter((n) => (!kind || n.kind === kind) && (!status || n.status === status) && (!q || `${n.name} ${n.address} ${n.os} ${n.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'cpu' ? b.cpu - a.cpu : sort === 'seen' ? b.lastSeen - a.lastSeen : order[a.status] - order[b.status] || a.name.localeCompare(b.name)), [all, kind, status, q, sort]);
  const by = (s: NodeInfo['status']) => all.filter((n) => n.status === s).length;
  return (
    <div className="page">
      <PageHead title={tr("pages.nodes.NodesPage.s_3293ac18db")} sub={tr("pages.nodes.NodesPage.s_2ac37c2b56")}
        actions={<Button variant="primary" icon={<Plus size={14} />} perm="nodes.admin" onClick={() => setPair(true)}>{tr("pages.nodes.NodesPage.s_3f9a7c101f")}</Button>} />
      <div className="strip">
        {(['online', 'degraded', 'offline'] as const).map((s) => (
          <button key={s} style={{ textAlign: 'left', background: status === s ? 'var(--selected)' : 'none', border: 0, cursor: 'pointer', borderRight: '1px solid var(--rule)' }} onClick={() => setStatus(status === s ? '' : s)}>
            <div className="label">{NODE_STATUS[s].label}</div><div className="v" style={{ color: s === 'offline' && by(s) ? 'var(--err)' : s === 'degraded' && by(s) ? 'var(--warn)' : undefined }}>{by(s)}</div>
          </button>
        ))}
        <div><div className="label">{tr("pages.nodes.NodesPage.s_cde0440b2d")}</div><div className="v">{all.filter((n) => n.agentVersion !== LATEST_AGENT).length}<small>{tr("pages.nodes.NodesPage.s_2d17e7fa9d")}{LATEST_AGENT}</small></div></div>
        <div><div className="label">{tr("pages.nodes.NodesPage.s_a98ea0a5ff")}</div><div className="v">{all.reduce((s, n) => s + n.cores, 0)}<small>{fmtBytes(all.reduce((s, n) => s + n.memTotal, 0))}</small></div></div>
      </div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <div className="input-group" style={{ width: 280 }}><span className="addon" style={{ borderRadius: '5px 0 0 5px', borderLeft: '1px solid var(--rule-strong)', borderRight: 0 }}><Search size={13} /></span><input className="input" style={{ borderRadius: '0 5px 5px 0' }} placeholder={tr("pages.nodes.NodesPage.s_58e414b76d")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row wrap gap-1">
          <button className="chip" aria-pressed={!kind} onClick={() => setKind('')}>{tr("pages.nodes.NodesPage.s_fd08da7a63")}</button>
          {Object.entries(NODE_KIND_LABEL).filter(([k]) => all.some((n) => n.kind === k)).map(([k, l]) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}><Icon name={NODE_ICON[k]} size={12} />{l}</button>)}
        </div>
        <span className="spacer" />
        <select className="select" style={{ width: 170 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="status">{tr("pages.nodes.NodesPage.s_fdd09b20a5")}</option><option value="name">{tr("pages.nodes.NodesPage.s_48b527cb15")}</option><option value="cpu">{tr("pages.nodes.NodesPage.s_348919da95")}</option><option value="seen">{tr("pages.nodes.NodesPage.s_2575377324")}</option></select>
      </div>
      {nodes.loading && <SkeletonRows rows={7} h={26} />}
      {nodes.error && !nodes.data && <ErrorState error={nodes.error} onRetry={nodes.refetch} />}
      {nodes.data && list.length === 0 && <div className="panel"><Empty title={all.length ? tr("pages.nodes.NodesPage.s_cd9285e3b5") : tr("pages.nodes.NodesPage.s_a617938656")} action={all.length ? <Button onClick={() => { setQ(''); setKind(''); setStatus(''); }}>{tr("pages.nodes.NodesPage.s_03ead01c5b")}</Button> : <Button variant="primary" onClick={() => setPair(true)}>{tr("pages.nodes.NodesPage.s_557c02c8ac")}</Button>} /></div>}
      {list.length > 0 && (
        <div className="panel table-wrap">
          <table className="t">
            <thead><tr><th>{tr("pages.nodes.NodesPage.s_564eba1527")}</th><th>{tr("pages.nodes.NodesPage.s_f7f293b5c5")}</th><th style={{ width: 120 }}>{tr("pages.nodes.NodesPage.s_ff221d4752")}</th><th style={{ width: 120 }}>{tr("pages.nodes.NodesPage.s_f63c10e017")}</th><th style={{ width: 110 }}>{tr("pages.nodes.NodesPage.s_ca040760a3")}</th><th className="r">{tr("pages.nodes.NodesPage.s_b78a6d1c81")}</th><th>{tr("pages.nodes.NodesPage.s_8634e35e72")}</th><th className="r">{tr("pages.nodes.NodesPage.s_ff13ef845f")}</th><th>{tr("pages.nodes.NodesPage.s_62f220e3a2")}</th></tr></thead>
            <tbody>
              {list.map((n) => {
                const off = n.status === 'offline';
                return (
                  <tr key={n.id} className="clickable" onClick={() => nav(`/nodes/${n.id}`)}>
                    <td><span className="row"><Icon name={NODE_ICON[n.kind]} size={15} className="muted" /><span className="col" style={{ gap: 0, minWidth: 0 }}><span style={{ fontWeight: 500 }}>{n.name}</span><span className="mono faint truncate" style={{ fontSize: 11 }}>{NODE_KIND_LABEL[n.kind]} {tr("pages.nodes.NodesPage.s_d3dacf895c")}{n.os} {tr("pages.nodes.NodesPage.s_d3dacf895c")}{n.address}</span></span>{n.battery && n.battery.level < 0.2 && !n.battery.charging && <BatteryLow size={14} color="var(--warn)" />}</span></td>
                    <td><StatusBadge {...NODE_STATUS[n.status]} pulse={n.status === 'online'} /></td>
                    <td>{off ? <span className="faint">{tr("pages.nodes.NodesPage.s_1b93795b97")}</span> : <div className="col" style={{ gap: 3 }}><span className="num" style={{ fontSize: 11.5 }}>{Math.round(n.cpu)}{tr("pages.nodes.NodesPage.s_4345cb1fa2")}</span><Meter value={n.cpu / 100} /></div>}</td>
                    <td>{off ? <span className="faint">{tr("pages.nodes.NodesPage.s_1b93795b97")}</span> : <div className="col" style={{ gap: 3 }}><span className="num" style={{ fontSize: 11.5 }}>{fmtBytes(n.memUsed)} {tr("pages.nodes.NodesPage.s_0d0c4ddd7c")}{fmtBytes(n.memTotal)}</span><Meter value={n.memUsed / n.memTotal} /></div>}</td>
                    <td><div className="col" style={{ gap: 3 }}><span className="num" style={{ fontSize: 11.5 }}>{Math.round((n.diskUsed / n.diskTotal) * 100)}{tr("pages.nodes.NodesPage.s_4345cb1fa2")}</span><Meter value={n.diskUsed / n.diskTotal} /></div></td>
                    <td className="num">{off || n.latencyMs === undefined ? '—' : `${n.latencyMs}`}</td>
                    <td className="mono">{n.agentVersion}{n.agentVersion !== LATEST_AGENT && <> <Badge tone="warn">{tr("pages.nodes.NodesPage.s_9555ffd723")}</Badge></>}</td>
                    <td className="num">{n.pluginIds.length}</td>
                    <td className={off ? '' : 'muted'} style={off ? { color: 'var(--err)' } : undefined}>{ago(n.lastSeen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PairDialog open={pair} onClose={() => setPair(false)} />
    </div>
  );
}
