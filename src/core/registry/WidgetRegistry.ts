import type { ComponentType } from 'react';
import type { MetricDescriptor, WidgetConfig, WidgetDisplay } from '../contracts';
import { parse } from '../lib/semver';

export type DisplayOption = 'chart' | 'stacked' | 'legend' | 'grid' | 'compare' | 'colors' | 'decimals' | 'yRange' | 'thresholds' | 'limit' | 'range' | 'text';

export interface Compatibility { score: number; reason?: string }

export interface WidgetTypeDef<P = any> {
  type: string;
  /** semver of widget config schema; majors must match saved configs or be migrated */
  version: string;
  label: string;
  icon: string;
  description: string;
  category: 'metric' | 'system';
  aliases?: string[];
  accepts?: (m: MetricDescriptor) => Compatibility;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  defaultDisplay?: (m?: MetricDescriptor) => WidgetDisplay;
  options: DisplayOption[];
  component: ComponentType<P>;
  migrate?: (cfg: WidgetConfig, from: string) => WidgetConfig;
}

export type Resolution =
  | { status: 'ok'; def: WidgetTypeDef; config: WidgetConfig }
  | { status: 'migrated'; def: WidgetTypeDef; config: WidgetConfig; from: string }
  | { status: 'unknown'; config: WidgetConfig }
  | { status: 'incompatible'; def: WidgetTypeDef; config: WidgetConfig; reason: string };

/**
 * Extensible registry of widget types. Plugins only describe *data*;
 * the console decides how to visualize it by asking each widget type how well it fits.
 */
export class WidgetRegistry {
  private defs = new Map<string, WidgetTypeDef>();
  private alias = new Map<string, string>();

  register(def: WidgetTypeDef) {
    if (this.defs.has(def.type)) throw new Error(`Widget type "${def.type}" already registered`);
    if (!parse(def.version)) throw new Error(`Widget type "${def.type}" has invalid version`);
    this.defs.set(def.type, def);
    def.aliases?.forEach((a) => this.alias.set(a, def.type));
    return this;
  }

  get(type: string): WidgetTypeDef | undefined {
    return this.defs.get(type) ?? this.defs.get(this.alias.get(type) ?? '');
  }

  all(category?: 'metric' | 'system') { return [...this.defs.values()].filter((d) => !category || d.category === category); }

  /** ids & aliases that plugins may reference as visualization hints */
  knownVisualizations(): string[] {
    return [...this.all('metric').map((d) => d.type), ...this.alias.keys()];
  }

  /** Ranks widget types for a metric. Plugin hints boost the score; hint order matters. */
  rank(m: MetricDescriptor): { def: WidgetTypeDef; score: number; reason?: string; hinted: boolean }[] {
    const hints = m.visualizations.map((v) => this.get(v)?.type).filter(Boolean) as string[];
    return this.all('metric')
      .map((def) => {
        const c = def.accepts?.(m) ?? { score: 0 };
        const hi = hints.indexOf(def.type);
        const hinted = hi >= 0 && c.score > 0;
        return { def, score: c.score + (hinted ? 30 - hi * 5 : 0), reason: c.reason, hinted };
      })
      .sort((a, b) => b.score - a.score);
  }

  best(m: MetricDescriptor): WidgetTypeDef | undefined {
    const r = this.rank(m)[0];
    return r && r.score > 0 ? r.def : undefined;
  }

  resolve(cfg: WidgetConfig): Resolution {
    const def = this.get(cfg.type);
    if (!def) return { status: 'unknown', config: cfg };
    const have = parse(cfg.typeVersion ?? '1.0.0');
    const want = parse(def.version)!;
    if (!have || have.major === want.major) return { status: 'ok', def, config: cfg };
    if (have.major < want.major && def.migrate) {
      try { return { status: 'migrated', def, config: { ...def.migrate(cfg, cfg.typeVersion), typeVersion: def.version }, from: cfg.typeVersion }; }
      catch (e) { return { status: 'incompatible', def, config: cfg, reason: `Ошибка миграции: ${(e as Error).message}` }; }
    }
    return { status: 'incompatible', def, config: cfg, reason: `Конфигурация v${cfg.typeVersion} несовместима с виджетом v${def.version}` };
  }
}
