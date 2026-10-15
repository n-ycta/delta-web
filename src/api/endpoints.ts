/** A local same-origin proxy or an explicit HTTP(S) core endpoint; not a network-relative URL. */
export function isCoreEndpoint(value: string): boolean {
  if (/\s/.test(value)) return false;
  if (/^\/(?!\/)/.test(value)) return !value.includes('#') && !value.includes('?');
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
}
