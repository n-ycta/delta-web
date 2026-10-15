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
    issues.push({ severity: 'error', code: 'contract.range', path: 'contract', message: `Не удаётся разобрать диапазон «${m.contract}»` });
  } else if (!satisfies(panel, m.contract)) {
    const newer = rangeTarget.major > (parse(panel)?.major ?? 0) || (rangeTarget.major === parse(panel)?.major && rangeTarget.minor > (parse(panel)?.minor ?? 0));
    issues.push({
      severity: 'error', code: 'contract.incompatible', path: 'contract',
      message: newer
        ? `Плагин требует контракт ${m.contract}, консоль реализует ${panel}. Обновите консоль.`
        : `Плагин собран под устаревший контракт ${m.contract} (консоль ${panel}). Нужна новая версия плагина.`,
    });
  }

  // metric semantics
  const seen = new Set<string>();
  const unknownViz = new Set<string>();
  m.metrics.forEach((metric, i) => {
    const p = `metrics[${i}]`;
    if (seen.has(metric.id)) issues.push({ severity: 'error', code: 'metric.duplicate', path: `${p}.id`, message: `Дублирующийся id метрики «${metric.id}»` });
    seen.add(metric.id);
    if (metric.defaultAggregation && !metric.aggregations.includes(metric.defaultAggregation))
      issues.push({ severity: 'error', code: 'metric.aggregation', path: `${p}.defaultAggregation`, message: `defaultAggregation «${metric.defaultAggregation}» отсутствует в aggregations` });
    if (metric.kind === 'ratio' && metric.range && (metric.range.min < 0 || metric.range.max > 1))
      issues.push({ severity: 'warning', code: 'metric.ratio-range', path: `${p}.range`, message: 'Для ratio ожидается диапазон 0..1' });
    if (metric.range && metric.range.min >= metric.range.max)
      issues.push({ severity: 'error', code: 'metric.range', path: `${p}.range`, message: 'range.min должен быть меньше range.max' });
    if (metric.kind === 'categorical' && metric.dimensions.length === 0)
      issues.push({ severity: 'warning', code: 'metric.categorical-dim', path: `${p}.dimensions`, message: 'Категориальная метрика без измерений — категории будут взяты из данных' });
    metric.visualizations.forEach((v) => { if (!opts.knownVisualizations.includes(v)) unknownViz.add(v); });
    const dims = new Set<string>();
    metric.dimensions.forEach((d, j) => {
      if (dims.has(d.id)) issues.push({ severity: 'error', code: 'dimension.duplicate', path: `${p}.dimensions[${j}]`, message: `Дублирующееся измерение «${d.id}»` });
      dims.add(d.id);
    });
  });
  if (unknownViz.size) issues.push({ severity: 'warning', code: 'viz.unknown', path: 'metrics[].visualizations', message: `Неизвестные визуализации будут заменены подходящими: ${[...unknownViz].join(', ')}` });

  // settings
  const keys = new Set<string>();
  m.settings.forEach((s, i) => {
    if (keys.has(s.key)) issues.push({ severity: 'error', code: 'setting.duplicate', path: `settings[${i}].key`, message: `Дублирующийся ключ настройки «${s.key}»` });
    keys.add(s.key);
    if (s.type === 'number' && s.min !== undefined && s.max !== undefined && s.min > s.max)
      issues.push({ severity: 'error', code: 'setting.range', path: `settings[${i}]`, message: 'min > max' });
    if (s.type === 'select' && s.default && !s.options.some((o) => o.value === s.default))
      issues.push({ severity: 'warning', code: 'setting.default', path: `settings[${i}].default`, message: 'Значение по умолчанию не входит в options' });
  });

  // capabilities
  const unknownCaps = m.capabilities.filter((c) => !(c in KNOWN_CAPABILITIES));
  unknownCaps.forEach((c) => issues.push({
    severity: c.startsWith('x-') ? 'info' : 'warning', code: 'capability.unknown', path: 'capabilities',
    message: c.startsWith('x-') ? `Экспериментальная возможность «${c}» проигнорирована` : `Неизвестная возможность «${c}» — функция будет недоступна в консоли`,
  }));
  if (m.metrics.length && !m.capabilities.includes('metrics.timeseries'))
    issues.push({ severity: 'warning', code: 'capability.missing', path: 'capabilities', message: 'Метрики объявлены, но capability metrics.timeseries отсутствует' });

  // permissions
  m.permissions.forEach((p, i) => {
    if (p.scope.endsWith('.*')) issues.push({ severity: 'warning', code: 'permission.wildcard', path: `permissions[${i}]`, message: `Широкое разрешение «${p.scope}» — проверьте перед установкой` });
  });

  const hasError = issues.some((i) => i.severity === 'error');
  const contractBroken = issues.some((i) => i.code.startsWith('contract.'));
  return {
    manifest: m,
    report: { ok: !hasError, compatible: !contractBroken && !hasError, issues, unknownVisualizations: [...unknownViz], unknownCapabilities: unknownCaps },
  };
}
