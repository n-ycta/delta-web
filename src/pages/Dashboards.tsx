import { dashboardPlugins } from '@/core/registry/dashboardIndex';
import { tr } from '@/i18n';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Download, MoreHorizontal, Pin, Plus, Trash2, Upload } from 'lucide-react';
import { useDashboards, usePlugins } from '@/app/data';
import { useCan } from '@/app/stores';
import { isInstalled } from '@/core/registry/plugins';
import { generatePluginDashboard } from '@/core/registry/autodash';
import { widgetRegistry } from '@/widgets/registry';
import { DashboardConfig as DashboardSchema, type DashboardConfig } from '@/core/contracts';
import { uid } from '@/core/lib/random';
import { ago } from '@/core/lib/format';
import { Button, Field, PageHead } from '@/ui/primitives';
import { Menu, Modal, Confirm } from '@/ui/overlays';
import { Empty, ErrorState, SkeletonRows } from '@/ui/states';
import { Icon } from '@/ui/Icon';
import { downloadJson, useDashboardActions } from '@/dashboards/useDashboardActions';
import { toast } from '@/app/stores';

const ICONS = [
  'layout-dashboard',
  'sunrise',
  'wallet',
  'keyboard',
  'heart-pulse',
  'house',
  'code',
  'activity',
  'moon',
  'target',
];

export function DashboardsPage() {
  const dashboards = useDashboards();
  const plugins = usePlugins();
  const { save, remove } = useDashboardActions();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [template, setTemplate] = useState<string>('');
  const [toDelete, setToDelete] = useState<DashboardConfig | null>(null);
  const canWrite = useCan('dashboards.write');
  useEffect(() => {
    if (params.get('new')) {
      setCreating(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const user = (dashboards.data ?? []).filter((d) => d.origin === 'user');
  const generatedByPlugin = new Map(
    (dashboards.data ?? [])
      .filter((d) => d.origin === 'generated')
      .map((d) => [d.generatedFrom, d]),
  );
  const auto = dashboardPlugins(plugins.data ?? []);

  const create = async () => {
    const t = Date.now();
    let d: DashboardConfig = {
      id: uid('d'),
      name: name.trim() || tr('pages.Dashboards.s_91db70e4f0'),
      icon,
      origin: 'user',
      range: '24h',
      refreshSec: 30,
      widgets: [],
      pinned: true,
      createdAt: t,
      updatedAt: t,
    };
    if (template) {
      const p = plugins.data?.find((x) => x.manifest.id === template);
      if (p)
        d = {
          ...generatePluginDashboard(p, widgetRegistry),
          id: d.id,
          name: d.name,
          icon,
          origin: 'user',
          pinned: true,
        };
    }
    await save(d);
    setCreating(false);
    setName('');
    setTemplate('');
    nav(`/dashboards/${d.id}`);
  };

  const importFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const parsed = DashboardSchema.safeParse({
        ...json,
        id: uid('d'),
        origin: 'user',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      if (!parsed.success) {
        toast({
          severity: 'error',
          title: tr('pages.Dashboards.s_82178e6940'),
          body: parsed.error.issues
            .slice(0, 2)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        });
        return;
      }
      const unknown = parsed.data.widgets.filter((w) => !widgetRegistry.get(w.type));
      await save(parsed.data);
      if (unknown.length)
        toast({
          severity: 'warn',
          title: tr('pages.Dashboards.s_cf0ba52e13'),
          body: tr('pages.Dashboards.s_6ca21f5817', { p0: unknown.length }),
        });
      nav(`/dashboards/${parsed.data.id}`);
    } catch (e) {
      toast({
        severity: 'error',
        title: tr('pages.Dashboards.s_6d02ec2feb'),
        body: (e as Error).message,
      });
    }
  };

  return (
    <div className="page">
      <PageHead
        title={tr('pages.Dashboards.s_292999fc23')}
        sub={tr('pages.Dashboards.s_d8820a1a20')}
        actions={
          <>
            <label
              className="btn"
              style={{ opacity: canWrite ? 1 : 0.45, pointerEvents: canWrite ? undefined : 'none' }}
            >
              <Upload size={14} />
              {tr('pages.Dashboards.s_c903779e0b')}
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
              />
            </label>
            <Button
              variant="primary"
              icon={<Plus size={14} />}
              perm="dashboards.write"
              onClick={() => setCreating(true)}
            >
              {tr('pages.Dashboards.s_91db70e4f0')}
            </Button>
          </>
        }
      />

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{tr('pages.Dashboards.s_61edc217cc')}</h2>
          <span className="muted num">{user.length}</span>
        </div>
        {dashboards.loading && <SkeletonRows rows={3} />}
        {dashboards.error && !dashboards.data && (
          <ErrorState error={dashboards.error} onRetry={dashboards.refetch} />
        )}
        {dashboards.data && user.length === 0 && (
          <div className="panel">
            <Empty
              title={tr('pages.Dashboards.s_e2ca21f52a')}
              action={
                <Button
                  perm="dashboards.write"
                  onClick={() => setCreating(true)}
                  icon={<Plus size={14} />}
                >
                  {tr('pages.Dashboards.s_84370a2097')}
                </Button>
              }
            >
              {tr('pages.Dashboards.s_35bb6d3e84')}
            </Empty>
          </div>
        )}
        {user.length > 0 && (
          <div className="panel table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{tr('pages.Dashboards.s_3de49828e8')}</th>
                  <th>{tr('pages.Dashboards.s_ea0dbecce0')}</th>
                  <th>{tr('pages.Dashboards.s_5384db72a4')}</th>
                  <th>{tr('pages.Dashboards.s_b2822e2bb3')}</th>
                  <th>{tr('pages.Dashboards.s_440e2b5d80')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {user.map((d) => {
                  const sources = [
                    ...new Set(
                      d.widgets.map((w) =>
                        w.source.kind !== 'system' ? w.source.pluginId : 'system',
                      ),
                    ),
                  ];
                  return (
                    <tr key={d.id} className="clickable" onClick={() => nav(`/dashboards/${d.id}`)}>
                      <td>
                        <span className="row">
                          <Icon name={d.icon ?? 'layout-dashboard'} size={15} className="muted" />
                          <span style={{ fontWeight: 500 }}>{d.name}</span>
                          {d.pinned && <Pin size={11} className="faint" />}
                        </span>
                      </td>
                      <td className="num" style={{ textAlign: 'left' }}>
                        {d.widgets.length}
                      </td>
                      <td className="muted truncate" style={{ maxWidth: 280 }}>
                        {sources
                          .map(
                            (s) =>
                              plugins.data?.find((p) => p.manifest.id === s)?.manifest.name ?? s,
                          )
                          .join(', ') || '—'}
                      </td>
                      <td className="mono">{d.range}</td>
                      <td className="muted">{ago(d.updatedAt)}</td>
                      <td className="r" onClick={(e) => e.stopPropagation()}>
                        <Menu
                          trigger={(t) => (
                            <Button {...t} size="sm" variant="ghost" iconOnly>
                              <MoreHorizontal size={14} />
                            </Button>
                          )}
                          items={[
                            {
                              label: d.pinned
                                ? tr('pages.Dashboards.s_5d48aa3263')
                                : tr('pages.Dashboards.s_c9a82797e3'),
                              icon: <Pin size={14} />,
                              onSelect: () => save({ ...d, pinned: !d.pinned }, { silent: true }),
                              disabled: !canWrite,
                            },
                            {
                              label: tr('pages.Dashboards.s_c9a3458cb5'),
                              icon: <Copy size={14} />,
                              disabled: !canWrite,
                              onSelect: () =>
                                save({
                                  ...structuredClone(d),
                                  id: uid('d'),
                                  name: tr('pages.Dashboards.s_5971ffb591', { p0: d.name }),
                                  origin: 'user',
                                  createdAt: Date.now(),
                                  updatedAt: Date.now(),
                                }),
                            },
                            {
                              label: tr('pages.Dashboards.s_4910a3a93b'),
                              icon: <Download size={14} />,
                              onSelect: () => downloadJson(`${d.name}.delta-dashboard.json`, d),
                            },
                            { separator: true },
                            {
                              label: tr('pages.Dashboards.s_86ea33aef5'),
                              icon: <Trash2 size={14} />,
                              danger: true,
                              disabled: !canWrite,
                              onSelect: () => setToDelete(d),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{tr('pages.Dashboards.s_6f7224eeab')}</h2>
          <span className="muted">{tr('pages.Dashboards.s_02d496627d')}</span>
        </div>
        <div className="catalog">
          {auto.map((p) => {
            const gen =
              generatedByPlugin.get(p.manifest.id) ?? generatePluginDashboard(p, widgetRegistry);
            const types = [...new Set(gen.widgets.map((w) => widgetRegistry.get(w.type)?.label))];
            return (
              <Link key={p.manifest.id} to={`/dashboards/${gen.id}`} className="plug">
                <div className="row">
                  <span className="plug-icon">
                    <Icon name={p.manifest.icon} size={16} />
                  </span>
                  <span className="col" style={{ gap: 0, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{p.manifest.name}</span>
                    <span className="widget-meta">
                      {p.manifest.metrics.length} {tr('pages.Dashboards.s_5df475e5e5')}
                      {gen.widgets.length} {tr('pages.Dashboards.s_530cce9f4a')}
                    </span>
                  </span>
                </div>
                <div className="plug-desc">{types.join(' · ')}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={tr('pages.Dashboards.s_91db70e4f0')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {tr('pages.Dashboards.s_0ec753be8d')}
            </Button>
            <Button variant="primary" onClick={create}>
              {tr('pages.Dashboards.s_84370a2097')}
            </Button>
          </>
        }
      >
        <div className="col gap-4">
          <Field label={tr('pages.Dashboards.s_3de49828e8')}>
            <input
              className="input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr('pages.Dashboards.s_a423ff5813')}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
          </Field>
          <Field label={tr('pages.Dashboards.s_25b8ac0dd8')}>
            <div className="row wrap gap-1">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className="chip"
                  aria-pressed={icon === i}
                  onClick={() => setIcon(i)}
                >
                  <Icon name={i} size={14} />
                </button>
              ))}
            </div>
          </Field>
          <Field
            label={tr('pages.Dashboards.s_adf905f367')}
            help={tr('pages.Dashboards.s_a0e2c7f5ff')}
          >
            <select
              className="select"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            >
              <option value="">{tr('pages.Dashboards.s_201dda28ad')}</option>
              {(plugins.data ?? [])
                .filter(
                  (p) =>
                    isInstalled(p) &&
                    (p.manifest.metrics.length || p.manifest.views.some((v) => v.dashboard)) &&
                    p.validation.compatible,
                )
                .map((p) => (
                  <option key={p.manifest.id} value={p.manifest.id}>
                    {tr('pages.Dashboards.s_707dcd2f1e')}
                    {p.manifest.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </Modal>
      <Confirm
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        danger
        title={tr('pages.Dashboards.s_2b6531cd72')}
        confirmLabel={tr('pages.Dashboards.s_86ea33aef5')}
        body={
          <>
            {tr('pages.Dashboards.s_11e6ee1c62')}
            {toDelete?.name}
            {tr('pages.Dashboards.s_03a42229df')}
            {toDelete?.widgets.length} {tr('pages.Dashboards.s_3d44747e07')}
          </>
        }
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}
