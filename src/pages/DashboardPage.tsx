import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, MoreHorizontal, Pencil, RotateCcw, Trash2, Wand2 } from 'lucide-react';
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
  const genFor = id.startsWith('gen_') ? id.slice(4) : undefined;
  const plugin = usePlugin(genFor);
  const { save, remove } = useDashboardActions();
  const canWrite = useCan('dashboards.write');
  const [rename, setRename] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [resetGen, setResetGen] = useState(false);

  const stored = dashboards.data?.find((d) => d.id === id);
  const generated = useMemo(() => (genFor && plugin.data && !stored ? generatePluginDashboard(plugin.data, widgetRegistry) : undefined), [genFor, plugin.data, stored]);
  const d: DashboardConfig | undefined = stored ?? generated;

  if (dashboards.error && !dashboards.data) return <div className="page"><ErrorState error={dashboards.error} onRetry={dashboards.refetch} /></div>;
  if (!dashboards.data || (genFor && plugin.loading)) return <div className="page"><Skeleton h={28} w={260} /><div style={{ height: 16 }} /><div className="grid-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={180} />)}</div></div>;
  if (!d) return <div className="page"><div className="panel"><Empty title="Дашборд не найден" action={<Link className="btn" to="/dashboards">Ко всем дашбордам</Link>}>Возможно, он удалён или ссылка устарела. {genFor && 'Плагин не установлен или не прошёл валидацию.'}</Empty></div></div>;

  const isGen = d.origin === 'generated';
  return (
    <div className="page">
      <PageHead
        eyebrow={isGen ? <span className="row" style={{ gap: 6 }}><Wand2 size={12} />построен из контракта {d.generatedFrom}</span> : 'дашборд'}
        title={<span className="row" style={{ gap: 10 }}><Icon name={d.icon ?? 'layout-dashboard'} size={20} className="muted" />{d.name}</span>}
        sub={generated ? 'Это автоматически собранный вид. Любое изменение сохранит его как ваш дашборд.' : d.description}
        actions={<Menu trigger={(t) => <Button {...t} iconOnly variant="ghost"><MoreHorizontal size={15} /></Button>} items={[
          { label: 'Переименовать', icon: <Pencil size={14} />, onSelect: () => setRename(d.name), disabled: !canWrite },
          { label: 'Экспорт JSON', icon: <Download size={14} />, onSelect: () => downloadJson(`${d.name}.delta-dashboard.json`, d) },
          ...(isGen && stored ? [{ label: 'Пересобрать из контракта', icon: <RotateCcw size={14} />, onSelect: () => setResetGen(true), disabled: !canWrite }] : []),
          ...(stored ? [{ separator: true }, { label: 'Удалить', icon: <Trash2 size={14} />, danger: true, onSelect: () => setDel(true), disabled: !canWrite }] : []),
        ]} />}
      />
      <DashboardView key={d.id} dashboard={d} onSave={(x) => save({ ...x, updatedAt: Date.now() }, { silent: !!stored })} />
      <Modal open={rename !== null} onClose={() => setRename(null)} title="Переименовать" footer={<><Button variant="ghost" onClick={() => setRename(null)}>Отмена</Button><Button variant="primary" onClick={async () => { await save({ ...d, name: rename || d.name }); setRename(null); }}>Сохранить</Button></>}>
        <Field label="Название"><input className="input" autoFocus value={rename ?? ''} onChange={(e) => setRename(e.target.value)} /></Field>
      </Modal>
      <Confirm open={del} onClose={() => setDel(false)} danger title="Удалить дашборд?" confirmLabel="Удалить" body={`«${d.name}» будет удалён.`} onConfirm={async () => { await remove(d); nav('/dashboards'); }} />
      <Confirm open={resetGen} onClose={() => setResetGen(false)} title="Пересобрать из контракта?" confirmLabel="Пересобрать" body="Текущая раскладка будет заменена набором виджетов, подобранных по актуальному контракту плагина." onConfirm={async () => {
        if (plugin.data) await save({ ...generatePluginDashboard(plugin.data, widgetRegistry), id: d.id, name: d.name });
        setResetGen(false);
      }} />
    </div>
  );
}
