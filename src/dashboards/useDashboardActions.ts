import { useApi } from '@/app/ApiContext';
import { queryClient } from '@/app/query';
import { toast } from '@/app/stores';
import type { DashboardConfig } from '@/core/contracts';
import { DashboardConfig as DashboardSchema } from '@/core/contracts';

export function useDashboardActions() {
  const api = useApi();
  const save = async (d: DashboardConfig, opts: { silent?: boolean } = {}) => {
    const parsed = DashboardSchema.safeParse(d);
    if (!parsed.success) { toast({ severity: 'error', title: 'Конфигурация дашборда невалидна', body: parsed.error.issues[0]?.message }); throw parsed.error; }
    const prev = queryClient.get<DashboardConfig[]>('dashboards')?.data;
    queryClient.setData<DashboardConfig[]>('dashboards', (list) => { const l = list ?? []; return l.some((x) => x.id === d.id) ? l.map((x) => (x.id === d.id ? d : x)) : [...l, d]; });
    try {
      const saved = await api.saveDashboard(d);
      queryClient.setData<DashboardConfig[]>('dashboards', (list) => (list ?? []).map((x) => (x.id === saved.id ? saved : x)));
      if (!opts.silent) toast({ severity: 'success', title: `Сохранено: ${d.name}` });
      return saved;
    } catch (e) {
      queryClient.setData('dashboards', () => prev ?? []);
      toast({ severity: 'error', title: 'Не удалось сохранить дашборд', body: (e as Error).message, action: { label: 'Повторить', run: () => save(d, opts) } });
      throw e;
    }
  };
  const remove = async (d: DashboardConfig) => {
    await api.deleteDashboard(d.id);
    queryClient.setData<DashboardConfig[]>('dashboards', (list) => (list ?? []).filter((x) => x.id !== d.id));
    toast({ severity: 'info', title: `Удалён дашборд «${d.name}»`, action: { label: 'Отменить', run: () => save(d) } });
  };
  return { save, remove };
}

export function downloadJson(name: string, data: unknown) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
