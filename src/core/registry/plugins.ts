import { compare, isValid } from '@/core/lib/semver';
import { localizeManifest } from './localize';
import { tr } from '@/i18n';
import type { PluginEntry, PluginInstance, PluginManifest, ValidationReport } from '../contracts';
import { validateManifest } from '../contracts';

export interface RawRecord { manifest: unknown; latest: unknown; instance: PluginInstance }

function placeholder(raw: unknown, inst: PluginInstance): PluginManifest {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? inst.pluginId), name: String(r.name ?? r.id ?? tr("core.registry.plugins.s_18ace30e43")), version: String(r.version ?? '0.0.0'),
    contract: String(r.contract ?? '?'), publisher: String(r.publisher ?? '—'), description: String(r.description ?? ''), icon: 'file-warning',
    category: 'other', defaultLocale: 'en', screenshots: [], permissions: [], settings: [], metrics: [], actions: [], capabilities: [], runtime: { targets: ['vps'] },
  };
}

/** Turns untrusted core records into validated catalog entries. Invalid manifests are kept, flagged and quarantined. */
export function normalizePlugins(records: RawRecord[], knownVisualizations: string[]): PluginEntry[] {
  return records.map((rec) => {
    const cur = validateManifest(localizeManifest(rec.manifest), { knownVisualizations });
    const latest = rec.latest === rec.manifest ? cur : validateManifest(localizeManifest(rec.latest), { knownVisualizations });
    const manifest = cur.manifest ?? placeholder(rec.manifest, rec.instance);
    const validation: ValidationReport = cur.report;
    const instance: PluginInstance = { ...rec.instance };
    if (!validation.compatible && !instance.installedVersion) instance.status = 'incompatible';
    if (!validation.compatible && instance.installedVersion) {
      instance.status = 'error';
      instance.error = { code: 'CONTRACT_INVALID', message: tr("core.registry.plugins.s_2df61fb885"), hint: tr("core.registry.plugins.s_2c1f3f522d") };
    }
    return { manifest, latest: latest.manifest ?? manifest, instance, validation };
  });
}

export const isInstalled = (e: PluginEntry) => !!e.instance.installedVersion;
export const hasUpdate = (e: PluginEntry) => isInstalled(e) && !!e.instance.installedVersion && !!e.instance.latestVersion && isValid(e.instance.installedVersion) && isValid(e.instance.latestVersion) && compare(e.instance.latestVersion,e.instance.installedVersion)>0 && e.instance.status !== 'updating';
export const isLive = (e: PluginEntry) => ['active', 'degraded'].includes(e.instance.status);
