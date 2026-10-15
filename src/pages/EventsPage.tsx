import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pause, Play, Search } from 'lucide-react';
import { useQuery } from '@/app/query';
import { useUi } from '@/app/stores';
import { useApi } from '@/app/ApiContext';
import { toApiError } from '@/api';
import type { CoreEvent, Severity } from '@/core/contracts';
import { fmtDateTime, fmtTime } from '@/core/lib/format';
import { Badge, Button, PageHead } from '@/ui/primitives';
import { Drawer } from '@/ui/overlays';
import { Empty, ErrorState, SkeletonRows } from '@/ui/states';
import { SEVERITY_LABEL, SEVERITY_TONE } from '@/ui/status';
import { downloadJson } from '@/dashboards/useDashboardActions';

const SEVS: Severity[] = ['critical', 'error', 'warn', 'info', 'debug'];
const SOURCES = [['node', 'Узлы'], ['plugin', 'Плагины'], ['core', 'Ядро'], ['auth', 'Доступ'], ['console', 'Консоль']] as const;
const SEV_RU: Record<Severity, string> = { critical: 'Критично', error: 'Ошибки', warn: 'Предупр.', info: 'Инфо', debug: 'Отладка' };

function sourceLink(e: CoreEvent) {
  if (e.source.type === 'node') return `/nodes/${e.source.id}`;
  if (e.source.type === 'plugin') return `/plugins/${encodeURIComponent(e.source.id)}`;
  if (e.source.type === 'auth') return '/access';
  return null;
}

export function EventsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(text);
  const sevs = (params.get('sev')?.split(',').filter(Boolean) as Severity[] | undefined) ?? [];
  const srcs = params.get('src')?.split(',').filter(Boolean) ?? [];
  const [tail, setTail] = useState(true);
  const [older, setOlder] = useState<CoreEvent[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [moreErr, setMoreErr] = useState<string>();
  const live = useUi((s) => s.live);
  const [pausedAt, setPausedAt] = useState<number>(0);
  const focusId = params.get('focus');
  const [selected, setSelected] = useState<CoreEvent | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(text), 250); return () => clearTimeout(t); }, [text]);
  useEffect(() => {
    const p = new URLSearchParams(params);
    if (debounced) p.set('q', debounced); else p.delete('q');
    if (p.toString() !== params.toString()) setParams(p, { replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const qobj = useMemo(() => ({ severities: sevs.length ? sevs : undefined, sourceTypes: srcs.length ? srcs : undefined, text: debounced || undefined, limit: 60 }), [sevs.join(), srcs.join(), debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = `events/list/${JSON.stringify(qobj)}`;
  const base = useQuery(key, (a) => a.listEvents(qobj));
  useEffect(() => { setOlder([]); setExhausted(false); setMoreErr(undefined); }, [key]);

  const matches = (e: CoreEvent) => (!sevs.length || sevs.includes(e.severity)) && (!srcs.length || srcs.includes(e.source.type)) && (!debounced || (e.message + e.code + e.source.id).toLowerCase().includes(debounced.toLowerCase()));
  const startedAt = base.updatedAt;
  const liveNew = live.filter((e) => e.ts > startedAt && matches(e) && (tail || e.ts <= pausedAt));
  const pending = tail ? 0 : live.filter((e) => e.ts > Math.max(startedAt, pausedAt) && matches(e)).length;
  const all = useMemo(() => {
    const seen = new Set<string>(); const out: CoreEvent[] = [];
    for (const e of [...liveNew, ...(base.data ?? []), ...older]) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    return out;
  }, [liveNew, base.data, older]);

  useEffect(() => { if (focusId) { const f = all.find((e) => e.id === focusId); if (f) setSelected(f); } }, [focusId, all.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k: 'sev' | 'src', v: string) => {
    const cur = k === 'sev' ? sevs : srcs; const next = cur.includes(v as never) ? cur.filter((x) => x !== v) : [...cur, v];
    const p = new URLSearchParams(params); if (next.length) p.set(k, next.join(',')); else p.delete(k); setParams(p, { replace: true });
  };
  const loadMore = async () => {
    const last = all[all.length - 1]; if (!last) return;
    setLoadingMore(true); setMoreErr(undefined);
    try { const r = await api.listEvents({ ...qobj, before: last.ts }); setOlder((o) => [...o, ...r]); if (r.length < qobj.limit) setExhausted(true); }
    catch (e) { setMoreErr(toApiError(e).message); } finally { setLoadingMore(false); }
  };
  const counts = SEVS.map((s) => [s, all.filter((e) => e.severity === s).length] as const);
  const close = () => { setSelected(null); if (focusId) { const p = new URLSearchParams(params); p.delete('focus'); setParams(p, { replace: true }); } };

  return (
    <div className="page">
      <PageHead title="События" sub="Единый журнал ядра: узлы, плагины, доступ и действия в консоли. Новые события приходят в реальном времени."
        actions={<>
          <Button icon={tail ? <Pause size={14} /> : <Play size={14} />} onClick={() => { if (tail) setPausedAt(Date.now()); setTail(!tail); }}>{tail ? 'Пауза' : `Продолжить${pending ? ` (+${pending})` : ''}`}</Button>
          <Button onClick={() => downloadJson(`delta-events-${new Date().toISOString().slice(0, 10)}`, all)} disabled={!all.length}>Экспорт JSON</Button>
        </>} />
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <div className="input-group" style={{ width: 300 }}><span className="addon" style={{ borderRadius: '5px 0 0 5px', borderLeft: '1px solid var(--rule-strong)', borderRight: 0 }}><Search size={13} /></span><input className="input" style={{ borderRadius: '0 5px 5px 0' }} placeholder="Код, сообщение, источник…" value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div className="row wrap gap-1">{SEVS.map((s) => <button key={s} className="chip" aria-pressed={sevs.includes(s)} onClick={() => toggle('sev', s)}><span className={`dot ${SEVERITY_TONE[s]}`} />{SEV_RU[s]}</button>)}</div>
        <span style={{ width: 1, height: 18, background: 'var(--rule-strong)' }} />
        <div className="row wrap gap-1">{SOURCES.map(([k, l]) => <button key={k} className="chip" aria-pressed={srcs.includes(k)} onClick={() => toggle('src', k)}>{l}</button>)}</div>
        <span className="spacer" />
        <span className="row muted" style={{ fontSize: 12 }}>{tail ? <><span className="dot ok pulse" />поток</> : <><span className="dot off" />пауза</>}</span>
      </div>
      <div className="row gap-3 muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
        {counts.filter(([, c]) => c).map(([s, c]) => <span key={s}><span className={`sev ${s}`}>{SEVERITY_LABEL[s]}</span> <span className="num">{c}</span></span>)}
        <span className="spacer" />{all.length > 0 && <span>показано {all.length}</span>}
      </div>
      {base.loading && <SkeletonRows rows={12} h={22} />}
      {base.error && !base.data && <ErrorState error={base.error} onRetry={base.refetch} />}
      {base.data && all.length === 0 && <div className="panel"><Empty title="Событий не найдено" action={(sevs.length || srcs.length || text) ? <Button onClick={() => { setText(''); setParams({}, { replace: true }); }}>Сбросить фильтры</Button> : undefined}>Попробуйте расширить фильтры или подождать новых событий.</Empty></div>}
      {all.length > 0 && (
        <div className="panel">
          <div className="logline" style={{ gridTemplateColumns: '128px 52px 150px 190px minmax(0,1fr)', background: 'var(--surface-2)', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--muted)' }}><span>Время</span><span>Ур.</span><span>Источник</span><span>Код</span><span>Сообщение</span></div>
          {all.map((e) => (
            <div key={e.id} className="logline" role="button" tabIndex={0} onClick={() => setSelected(e)} onKeyDown={(k) => k.key === 'Enter' && setSelected(e)}
              style={{ gridTemplateColumns: '128px 52px 150px 190px minmax(0,1fr)', cursor: 'pointer', background: e.id === focusId ? 'var(--selected)' : e.ts > startedAt ? 'color-mix(in srgb, var(--accent-weak) 45%, transparent)' : undefined }}>
              <span className="muted">{fmtDateTime(e.ts)}</span><span className={`sev ${e.severity}`}>{SEVERITY_LABEL[e.severity]}</span>
              <span className="truncate ink2">{e.source.label ?? e.source.id}</span><span className="truncate">{e.code}</span>
              <span className="truncate" style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5 }}>{e.message}</span>
            </div>
          ))}
          <div className="row" style={{ padding: 10, justifyContent: 'center' }}>
            {moreErr && <span className="field-error">{moreErr}</span>}
            {exhausted ? <span className="faint" style={{ fontSize: 12 }}>Начало журнала</span> : <Button size="sm" loading={loadingMore} onClick={loadMore}>{moreErr ? 'Повторить' : 'Загрузить ещё'}</Button>}
          </div>
        </div>
      )}
      <Drawer open={!!selected} onClose={close} title={selected?.code ?? ''} sub={selected && <span className="row"><Badge tone={SEVERITY_TONE[selected.severity]}>{selected.severity}</Badge><span className="muted">{fmtDateTime(selected.ts)} · {fmtTime(selected.ts, true)}</span></span>}>
        {selected && (
          <div className="col gap-4">
            <p style={{ fontSize: 14 }}>{selected.message}</p>
            <dl className="kv">
              <dt>ID</dt><dd className="mono">{selected.id}</dd>
              <dt>Источник</dt><dd>{(() => { const l = sourceLink(selected); const t = `${selected.source.type}: ${selected.source.label ?? selected.source.id}`; return l ? <Link className="link" to={l}>{t}</Link> : t; })()}</dd>
              <dt>Время</dt><dd className="mono">{new Date(selected.ts).toISOString()}</dd>
            </dl>
            {selected.details && <div><div className="label" style={{ marginBottom: 6 }}>Детали</div><pre className="code" style={{ margin: 0 }}>{JSON.stringify(selected.details, null, 2)}</pre></div>}
            <div className="row"><Button size="sm" onClick={() => { setText(selected.code); close(); }}>Похожие события</Button>{selected.source.id && <Button size="sm" variant="ghost" onClick={() => { setText(selected.source.id); close(); }}>Все от источника</Button>}</div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
