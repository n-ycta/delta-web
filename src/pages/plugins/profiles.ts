/** Pure, schema-driven merge. Never apply credentials from a profile. */
export type SettingsProfiles = {
  selectionKey: string;
  protectedKeys: string[];
  items: { id: string; label: string; values: Record<string, unknown> }[];
};
export function mergeProfileValues(config: SettingsProfiles, ids: string[]) {
  const out: Record<string, unknown> = {};
  for (const item of config.items.filter((p) => ids.includes(p.id)))
    for (const [key, value] of Object.entries(item.values)) {
      if (Array.isArray(value))
        out[key] = [
          ...new Set([...(Array.isArray(out[key]) ? (out[key] as unknown[]) : []), ...value]),
        ];
      else if (typeof value === 'string')
        out[key] = [
          ...new Set(
            [
              ...(typeof out[key] === 'string' ? (out[key] as string).split('\n') : []),
              ...value.split('\n'),
            ].filter(Boolean),
          ),
        ].join('\n');
      else out[key] = value;
    }
  return out;
}
