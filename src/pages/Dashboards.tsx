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

const ICONS = ['layout-dashboard', 'sunrise', 'wallet', 'keyboard', 'heart-pulse', 'house', 'code', 'activity', 'moon', 'target'];

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
  useEffect(() => { if (params.get('new')) { setCreating(true); params.delete('new'); setParams(params, { replace: true }); } }, [params, setParams]);

  const user = (dashboards.data ?? []).filter((d) => d.origin === 'user' || (d.origin === 'generated' && dashboards.data?.some((x) => x.id === d.id)));
  const generatedIds = new Set(user.filter((d) => d.origin === 'generated').map((d) => d.generatedFrom));
  const auto = (plugins.data ?? []).filter((p) => isInstalled(p) && p.validation.compatible && p.manifest.metrics.length && !generatedIds.has(p.manifest.id));

  const create = async () => {
    const t = Date.now();
    let d: DashboardConfig = { id: uid('d'), name: name.trim() || 'Новый дашборд', icon, origin: 'user', range: '24h', refreshSec: 30, widgets: [], pinned: true, createdAt: t, updatedAt: t };
    if (template) {
      const p = plugins.data?.find((x) => x.manifest.id === template);
      if (p) d = { ...generatePluginDashboard(p, widgetRegistry), id: d.id, name: d.name, icon, origin: 'user', pinned: true };
    }
    await save(d);
    setCreating(false); setName(''); setTemplate('');
    nav(`/dashboards/${d.id}`);
  };

  const importFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const parsed = DashboardSchema.safeParse({ ...json, id: uid('d'), origin: 'user', createdAt: Date.now(), updatedAt: Date.now() });
      if (!parsed.success) { toast({ severity: 'error', title: 'Файл не является дашбордом Delta', body: parsed.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }); return; }
      const unknown = parsed.data.widgets.filter((w) => !widgetRegistry.get(w.type));
      await save(parsed.data);
      if (unknown.length) toast({ severity: 'warn', title: `Импортировано с предупреждениями`, body: `${unknown.length} виджет(ов) неизвестного типа — их можно заменить на дашборде.` });
      nav(`/dashboards/${parsed.data.id}`);
    } catch (e) { toast({ severity: 'error', title: 'Не удалось прочитать файл', body: (e as Error).message }); }
  };

  return (
    <div className="page">
      <PageHead title="Дашборды" sub="Собственные дашборды и автоматически построенные из контрактов плагинов."
        actions={<>
          <label className="btn" style={{ opacity: canWrite ? 1 : 0.45, pointerEvents: canWrite ? undefined : 'none' }}><Upload size={14} />Импорт JSON<input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} /></label>
          <Button variant="primary" icon={<Plus size={14} />} perm="dashboards.write" onClick={() => setCreating(true)}>Новый дашборд</Button>
        </>} />

      <section className="section">
        <div className="section-head"><h2 className="section-title">Мои</h2><span className="muted num">{user.length}</span></div>
        {dashboards.loading && <SkeletonRows rows={3} />}
        {dashboards.error && !dashboards.data && <ErrorState error={dashboards.error} onRetry={dashboards.refetch} />}
        {dashboards.data && user.length === 0 && <div className="panel"><Empty title="Пока нет собственных дашбордов" action={<Button perm="dashboards.write" onClick={() => setCreating(true)} icon={<Plus size={14} />}>Создать</Button>}>Начните с пустого или возьмите за основу автоматически созданный дашборд плагина.</Empty></div>}
        {user.length > 0 && (
          <div className="panel table-wrap">
            <table className="t">
              <thead><tr><th>Название</th><th>Виджеты</th><th>Источники</th><th>Период</th><th>Изменён</th><th /></tr></thead>
              <tbody>
                {user.map((d) => {
                  const sources = [...new Set(d.widgets.map((w) => (w.source.kind === 'metric' ? w.source.pluginId : 'system')))];
                  return (
                    <tr key={d.id} className="clickable" onClick={() => nav(`/dashboards/${d.id}`)}>
                      <td><span className="row"><Icon name={d.icon ?? 'layout-dashboard'} size={15} className="muted" /><span style={{ fontWeight: 500 }}>{d.name}</span>{d.pinned && <Pin size={11} className="faint" />}{d.origin === 'generated' && <span className="badge mono">из контракта</span>}</span></td>
                      <td className="num" style={{ textAlign: 'left' }}>{d.widgets.length}</td>
                      <td className="muted truncate" style={{ maxWidth: 280 }}>{sources.map((s) => plugins.data?.find((p) => p.manifest.id === s)?.manifest.name ?? s).join(', ') || '—'}</td>
                      <td className="mono">{d.range}</td>
                      <td className="muted">{ago(d.updatedAt)}</td>
                      <td className="r" onClick={(e) => e.stopPropagation()}>
                        <Menu trigger={(t) => <Button {...t} size="sm" variant="ghost" iconOnly><MoreHorizontal size={14} /></Button>} items={[
                          { label: d.pinned ? 'Открепить из меню' : 'Закрепить в меню', icon: <Pin size={14} />, onSelect: () => save({ ...d, pinned: !d.pinned }, { silent: true }), disabled: !canWrite },
                          { label: 'Дублировать', icon: <Copy size={14} />, disabled: !canWrite, onSelect: () => save({ ...structuredClone(d), id: uid('d'), name: `${d.name} (копия)`, origin: 'user', createdAt: Date.now(), updatedAt: Date.now() }) },
                          { label: 'Экспорт JSON', icon: <Download size={14} />, onSelect: () => downloadJson(`${d.name}.delta-dashboard.json`, d) },
                          { separator: true },
                          { label: 'Удалить', icon: <Trash2 size={14} />, danger: true, disabled: !canWrite, onSelect: () => setToDelete(d) },
                        ]} />
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
        <div className="section-head"><h2 className="section-title">Из контрактов плагинов</h2><span className="muted">строятся автоматически по объявленным метрикам; при сохранении становятся вашими</span></div>
        <div className="catalog">
          {auto.map((p) => {
            const gen = generatePluginDashboard(p, widgetRegistry);
            const types = [...new Set(gen.widgets.map((w) => widgetRegistry.get(w.type)?.label))];
            return (
              <Link key={p.manifest.id} to={`/dashboards/gen_${p.manifest.id}`} className="plug">
                <div className="row"><span className="plug-icon"><Icon name={p.manifest.icon} size={16} /></span><span className="col" style={{ gap: 0, minWidth: 0 }}><span style={{ fontWeight: 600 }}>{p.manifest.name}</span><span className="widget-meta">{p.manifest.metrics.length} метрик → {gen.widgets.length} виджетов</span></span></div>
                <div className="plug-desc">{types.join(' · ')}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} title="Новый дашборд" footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Отмена</Button><Button variant="primary" onClick={create}>Создать</Button></>}>
        <div className="col gap-4">
          <Field label="Название"><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, «Утро» или «Продуктивность»" onKeyDown={(e) => e.key === 'Enter' && create()} /></Field>
          <Field label="Иконка"><div className="row wrap gap-1">{ICONS.map((i) => <button key={i} type="button" className="chip" aria-pressed={icon === i} onClick={() => setIcon(i)}><Icon name={i} size={14} /></button>)}</div></Field>
          <Field label="Основа" help="Можно начать с виджетов, которые консоль подберёт по контракту плагина">
            <select className="select" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">Пустой дашборд</option>
              {(plugins.data ?? []).filter((p) => isInstalled(p) && p.manifest.metrics.length && p.validation.compatible).map((p) => <option key={p.manifest.id} value={p.manifest.id}>Из контракта: {p.manifest.name}</option>)}
            </select>
          </Field>
        </div>
      </Modal>
      <Confirm open={!!toDelete} onClose={() => setToDelete(null)} danger title="Удалить дашборд?" confirmLabel="Удалить" body={<>Дашборд «{toDelete?.name}» и его {toDelete?.widgets.length} виджетов будут удалены. Данные плагинов не затрагиваются.</>} onConfirm={async () => { if (toDelete) await remove(toDelete); setToDelete(null); }} />
    </div>
  );
}
