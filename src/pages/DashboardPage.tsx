import { tr } from '@/i18n';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useDashboards, usePlugin } from '@/app/data';
import { useCan } from '@/app/stores';
import { generatePluginDashboard } from '@/core/registry/autodash';
import { widgetRegistry } from '@/widgets/registry';
import { DashboardView } from '@/dashboards/DashboardView';
import { downloadJson, useDashboardActions } from '@/dashboards/useDashboardActions';
import { Button, Field, PageHead } from '@/ui/primitives';
import { Confirm, Menu, Modal } from '@/ui/overlays';
import { Empty, ErrorState, Skeleton } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import type { DashboardConfig } from '@/core/contracts';

export function DashboardPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const dashboards = useDashboards();
  const stored = dashboards.data?.find((d) => d.id === id);
  const genFor =
    stored?.origin === 'generated'
      ? stored.generatedFrom
      : id.startsWith('gen_')
        ? id.slice(4)
        : undefined;
  const plugin = usePlugin(genFor);
  const { save, remove } = useDashboardActions();
  const canWrite = useCan('dashboards.write');
  const [rename, setRename] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [resetGen, setResetGen] = useState(false);

  const generated = useMemo(
    () =>
      genFor && plugin.data && !stored
        ? generatePluginDashboard(plugin.data, widgetRegistry)
        : undefined,
    [genFor, plugin.data, stored],
  );
  // Add newly declared metrics to saved generated dashboards without moving user widgets.
  const d: DashboardConfig | undefined = useMemo(() => {
    if (!stored || stored.origin !== 'generated' || !plugin.data) return stored ?? generated;
    const fresh = generatePluginDashboard(plugin.data, widgetRegistry);
    const existing = new Set(
      stored.widgets.flatMap((w) => (w.source.kind === 'metric' ? [w.source.metricId] : [])),
    );
    let y = stored.widgets.reduce((n, w) => Math.max(n, w.layout.y + w.layout.h), 0);
    const added = fresh.widgets
      .filter(
        (w) => w.source.kind === 'metric' && !existing.has(w.source.metricId) && w.type !== 'stat',
      )
      .map((w) => {
        const next = { ...w, layout: { ...w.layout, x: 0, y, w: 12 } };
        y += w.layout.h;
        return next;
      });
    return { ...stored, widgets: [...stored.widgets, ...added] };
  }, [stored, generated, plugin.data]);

  if (dashboards.error && !dashboards.data)
    return (
      <div className="page">
        <ErrorState error={dashboards.error} onRetry={dashboards.refetch} />
      </div>
    );
  if (!dashboards.data || (genFor && plugin.loading))
    return (
      <div className="page">
        <Skeleton h={28} w={260} />
        <div style={{ height: 16 }} />
        <div className="grid-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} h={180} />
          ))}
        </div>
      </div>
    );
  if (!d)
    return (
      <div className="page">
        <div className="panel">
          <Empty
            title={tr('pages.DashboardPage.s_201cf81628')}
            action={
              <Link className="btn" to="/dashboards">
                {tr('pages.DashboardPage.s_f7bcb06361')}
              </Link>
            }
          >
            {tr('pages.DashboardPage.s_d5547a1a16')}
            {genFor && tr('pages.DashboardPage.s_c816ac6440')}
          </Empty>
        </div>
      </div>
    );

  const isGen = d.origin === 'generated';
  return (
    <div className="page">
      <PageHead
        eyebrow={tr('pages.DashboardPage.s_c957a35c33')}
        title={
          <span className="row" style={{ gap: 10 }}>
            <Icon name={d.icon ?? 'layout-dashboard'} size={20} className="muted" />
            {d.name}
          </span>
        }
        sub={isGen || d.generatedFrom ? undefined : d.description}
        actions={
          <Menu
            trigger={(t) => (
              <Button {...t} iconOnly variant="ghost">
                <MoreHorizontal size={15} />
              </Button>
            )}
            items={[
              {
                label: tr('pages.DashboardPage.s_715e8f0c32'),
                icon: <Pencil size={14} />,
                onSelect: () => setRename(d.name),
                disabled: !canWrite,
              },
              {
                label: tr('pages.DashboardPage.s_4910a3a93b'),
                icon: <Download size={14} />,
                onSelect: () => downloadJson(`${d.name}.delta-dashboard.json`, d),
              },
              ...(isGen && stored
                ? [
                    {
                      label: tr('pages.DashboardPage.s_ba47c18401'),
                      icon: <RotateCcw size={14} />,
                      onSelect: () => setResetGen(true),
                      disabled: !canWrite,
                    },
                  ]
                : []),
              ...(stored
                ? [
                    { separator: true },
                    {
                      label: tr('pages.DashboardPage.s_86ea33aef5'),
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onSelect: () => setDel(true),
                      disabled: !canWrite,
                    },
                  ]
                : []),
            ]}
          />
        }
      />
      <DashboardView
        key={d.id}
        dashboard={d}
        onSave={(x) => save({ ...x, updatedAt: Date.now() }, { silent: !!stored })}
      />
      <Modal
        open={rename !== null}
        onClose={() => setRename(null)}
        title={tr('pages.DashboardPage.s_715e8f0c32')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRename(null)}>
              {tr('pages.DashboardPage.s_0ec753be8d')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await save({ ...d, name: rename || d.name });
                setRename(null);
              }}
            >
              {tr('pages.DashboardPage.s_4864057d62')}
            </Button>
          </>
        }
      >
        <Field label={tr('pages.DashboardPage.s_3de49828e8')}>
          <input
            className="input"
            autoFocus
            value={rename ?? ''}
            onChange={(e) => setRename(e.target.value)}
          />
        </Field>
      </Modal>
      <Confirm
        open={del}
        onClose={() => setDel(false)}
        danger
        title={tr('pages.DashboardPage.s_2b6531cd72')}
        confirmLabel={tr('pages.DashboardPage.s_86ea33aef5')}
        body={tr('pages.DashboardPage.s_6e572fde68', { p0: d.name })}
        onConfirm={async () => {
          await remove(d);
          nav('/dashboards');
        }}
      />
      <Confirm
        open={resetGen}
        onClose={() => setResetGen(false)}
        title={tr('pages.DashboardPage.s_0b04a8cb71')}
        confirmLabel={tr('pages.DashboardPage.s_600363a73d')}
        body={tr('pages.DashboardPage.s_37c44a307c')}
        onConfirm={async () => {
          if (plugin.data)
            await save({
              ...generatePluginDashboard(plugin.data, widgetRegistry),
              id: d.id,
              name: d.name,
            });
          setResetGen(false);
        }}
      />
    </div>
  );
}
