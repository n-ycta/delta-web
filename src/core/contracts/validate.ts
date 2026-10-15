import { tr } from '@/i18n';
import { z } from 'zod';
import { PANEL_CONTRACT_VERSION } from './common';
import { KNOWN_CAPABILITIES, PluginManifest } from './plugin';
import { satisfies, parse } from '../lib/semver';

export type IssueSeverity = 'error' | 'warning' | 'info';
export interface ValidationIssue { severity: IssueSeverity; path: string; message: string; code: string }

export interface ValidationReport {
  ok: boolean;
  /** compatible = may be loaded; ok = no errors at all */
  compatible: boolean;
  issues: ValidationIssue[];
  unknownVisualizations: string[];
  unknownCapabilities: string[];
}

export interface ValidateOptions {
  knownVisualizations: string[];
  panelContract?: string;
}

const pathOf = (p: (string | number)[]) => p.map((s) => (typeof s === 'number' ? `[${s}]` : `.${s}`)).join('').replace(/^\./, '') || '(root)';

export function zodIssues(err: z.ZodError, prefix = ''): ValidationIssue[] {
  return err.issues.map((i) => ({ severity: 'error', code: `schema.${i.code}`, path: prefix + pathOf(i.path), message: i.message }));
}

/**
 * Validates a raw manifest: schema → semantic → compatibility.
 * Never throws; the console must survive arbitrary input from third-party plugins.
 */
export function validateManifest(raw: unknown, opts: ValidateOptions): { manifest?: PluginManifest; report: ValidationReport } {
  const issues: ValidationIssue[] = [];
  const parsed = PluginManifest.safeParse(raw);
  if (!parsed.success) {
    issues.push(...zodIssues(parsed.error));
    return { report: { ok: false, compatible: false, issues, unknownCapabilities: [], unknownVisualizations: [] } };
  }
  const m = parsed.data;
  const panel = opts.panelContract ?? PANEL_CONTRACT_VERSION;

  // contract compatibility
  const rangeTarget = parse(m.contract.replace(/^[\^~>=<\s]+/, ''));
  if (!rangeTarget) {
    issues.push({ severity: 'error', code: 'contract.range', path: 'contract', message: tr("core.contracts.validate.s_d39e62b5c0", { p0: (m.contract) }) });
  } else if (!satisfies(panel, m.contract)) {
    const newer = rangeTarget.major > (parse(panel)?.major ?? 0) || (rangeTarget.major === parse(panel)?.major && rangeTarget.minor > (parse(panel)?.minor ?? 0));
    issues.push({
      severity: 'error', code: 'contract.incompatible', path: 'contract',
      message: newer
        ? tr("core.contracts.validate.s_dbf4281cd5", { p0: (m.contract), p1: (panel) })
        : tr("core.contracts.validate.s_37f4f3b501", { p0: (m.contract), p1: (panel) }),
    });
  }

  // metric semantics
  const seen = new Set<string>();
  const unknownViz = new Set<string>();
  m.metrics.forEach((metric, i) => {
    const p = `metrics[${i}]`;
    if (seen.has(metric.id)) issues.push({ severity: 'error', code: 'metric.duplicate', path: `${p}.id`, message: tr("core.contracts.validate.s_416359e4ec", { p0: (metric.id) }) });
    seen.add(metric.id);
    if (metric.defaultAggregation && !metric.aggregations.includes(metric.defaultAggregation))
      issues.push({ severity: 'error', code: 'metric.aggregation', path: `${p}.defaultAggregation`, message: tr("core.contracts.validate.s_aad8886d37", { p0: (metric.defaultAggregation) }) });
    if (metric.kind === 'ratio' && metric.range && (metric.range.min < 0 || metric.range.max > 1))
      issues.push({ severity: 'warning', code: 'metric.ratio-range', path: `${p}.range`, message: tr("core.contracts.validate.s_21382146f3") });
    if (metric.range && metric.range.min >= metric.range.max)
      issues.push({ severity: 'error', code: 'metric.range', path: `${p}.range`, message: tr("core.contracts.validate.s_cbd25e93d1") });
    if (metric.kind === 'categorical' && metric.dimensions.length === 0)
      issues.push({ severity: 'warning', code: 'metric.categorical-dim', path: `${p}.dimensions`, message: tr("core.contracts.validate.s_efa5c635bf") });
    metric.visualizations.forEach((v) => { if (!opts.knownVisualizations.includes(v)) unknownViz.add(v); });
    const dims = new Set<string>();
    metric.dimensions.forEach((d, j) => {
      if (dims.has(d.id)) issues.push({ severity: 'error', code: 'dimension.duplicate', path: `${p}.dimensions[${j}]`, message: tr("core.contracts.validate.s_2288e59460", { p0: (d.id) }) });
      dims.add(d.id);
    });
  });
  if (unknownViz.size) issues.push({ severity: 'warning', code: 'viz.unknown', path: 'metrics[].visualizations', message: tr("core.contracts.validate.s_e71a07ac06", { p0: ([...unknownViz].join(', ')) }) });

  // settings
  const keys = new Set<string>();
  m.settings.forEach((s, i) => {
    if (keys.has(s.key)) issues.push({ severity: 'error', code: 'setting.duplicate', path: `settings[${i}].key`, message: tr("core.contracts.validate.s_f8a13ef909", { p0: (s.key) }) });
    keys.add(s.key);
    if (s.type === 'number' && s.min !== undefined && s.max !== undefined && s.min > s.max)
      issues.push({ severity: 'error', code: 'setting.range', path: `settings[${i}]`, message: tr("core.contracts.validate.s_a0feb7f245") });
    if (s.type === 'select' && s.default && !s.options.some((o) => o.value === s.default))
      issues.push({ severity: 'warning', code: 'setting.default', path: `settings[${i}].default`, message: tr("core.contracts.validate.s_f4ee874321") });
  });

  // capabilities
  const unknownCaps = m.capabilities.filter((c) => !(c in KNOWN_CAPABILITIES));
  unknownCaps.forEach((c) => issues.push({
    severity: c.startsWith('x-') ? 'info' : 'warning', code: 'capability.unknown', path: 'capabilities',
    message: c.startsWith('x-') ? tr("core.contracts.validate.s_301b337e29", { p0: (c) }) : tr("core.contracts.validate.s_bbb0834fcb", { p0: (c) }),
  }));
  if (m.metrics.length && !m.capabilities.includes('metrics.timeseries'))
    issues.push({ severity: 'warning', code: 'capability.missing', path: 'capabilities', message: tr("core.contracts.validate.s_79df7093cf") });

  // permissions
  m.permissions.forEach((p, i) => {
    if (p.scope.endsWith('.*')) issues.push({ severity: 'warning', code: 'permission.wildcard', path: `permissions[${i}]`, message: tr("core.contracts.validate.s_06709524a0", { p0: (p.scope) }) });
  });

  const hasError = issues.some((i) => i.severity === 'error');
  const contractBroken = issues.some((i) => i.code.startsWith('contract.'));
  return {
    manifest: m,
    report: { ok: !hasError, compatible: !contractBroken && !hasError, issues, unknownVisualizations: [...unknownViz], unknownCapabilities: unknownCaps },
  };
}
