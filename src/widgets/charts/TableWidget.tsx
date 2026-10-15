import { tr } from '@/i18n';
import type { WidgetProps } from '../types';
import { MetricData, toRows } from '../shared';
import { fmtDateTime, fmtValue } from '@/core/lib/format';
import type { MetricResult } from '@/core/contracts';

export function resultToCsv(r: MetricResult): string {
  if (r.categories) return ['key,label,value', ...r.categories.map((c) => `${c.key},"${c.label}",${c.value}`)].join('\n');
  if (r.buckets) return ['lo,hi,count', ...r.buckets.map((b) => `${b.lo},${b.hi},${b.count}`)].join('\n');
  const rows = toRows(r.series);
  return [['time', ...r.series.map((s) => s.key)].join(','), ...rows.map((row) => [new Date(row.t as number).toISOString(), ...r.series.map((s) => row[s.key] ?? '')].join(','))].join('\n');
}

/** Raw tabular view — universal fallback for any metric, including unknown visualizations. */
export function TableWidget({ config, ctx }: WidgetProps) {
  return (
    <MetricData cfg={config} ctx={ctx}>
      {(r, m) => {
        if (r.categories || r.buckets) {
          const items = r.categories?.map((c) => [c.label, c.value]) ?? r.buckets!.map((b) => [`${Math.round(b.lo)}–${Math.round(b.hi)}`, b.count]);
          return <div style={{ overflow: 'auto', flex: 1 }}><table className="t"><thead><tr><th>{tr("widgets.charts.TableWidget.s_19c85838e6")}</th><th className="r">{tr("widgets.charts.TableWidget.s_9f0b990967")}</th></tr></thead><tbody>{items.map(([k, v]) => <tr key={String(k)}><td>{k}</td><td className="num">{fmtValue(v as number, r.buckets ? '' : m.unit, m.precision)}</td></tr>)}</tbody></table></div>;
        }
        const rows = toRows(r.series).reverse().slice(0, 200);
        return (
          <div style={{ overflow: 'auto', flex: 1, margin: '0 -12px' }}>
            <table className="t">
              <thead><tr><th>{tr("widgets.charts.TableWidget.s_c80d7e8172")}</th>{r.series.map((s) => <th key={s.key} className="r">{s.label}</th>)}</tr></thead>
              <tbody>{rows.map((row) => <tr key={row.t as number}><td className="num muted" style={{ textAlign: 'left' }}>{fmtDateTime(row.t as number)}</td>{r.series.map((s) => <td key={s.key} className="num">{fmtValue(row[s.key] as number | null, m.unit, config.display.decimals ?? m.precision)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      }}
    </MetricData>
  );
}
