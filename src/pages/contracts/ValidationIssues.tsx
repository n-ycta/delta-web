import { tr } from '@/i18n';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ValidationReport } from '@/core/contracts';

export function ValidationIssues({ report }: { report: ValidationReport }) {
  if (!report.issues.length) return <div className="row" style={{ padding: 14, color: 'var(--ok)' }}><CheckCircle2 size={15} />{tr("pages.contracts.ValidationIssues.s_0fdea00241")}</div>;
  return (
    <div>
      {report.issues.map((i, k) => (
        <div key={k} className="issue">
          {i.severity === 'error' ? <AlertCircle size={14} color="var(--err)" /> : i.severity === 'warning' ? <AlertTriangle size={14} color="var(--warn)" /> : <Info size={14} color="var(--info)" />}
          <span className="p">{i.path}</span>
          <span>{i.message} <span className="mono faint" style={{ fontSize: 10.5 }}>{i.code}</span></span>
        </div>
      ))}
    </div>
  );
}
