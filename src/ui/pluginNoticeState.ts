import type { PluginEntry } from '@/core/contracts';
type Notice = NonNullable<PluginEntry['instance']['notices']>[number];
/** Local UI preference only: never acknowledges consent or changes plugin settings. */
export function noticeKey(scope: string, entry: PluginEntry, notice: Notice): string {
 return JSON.stringify([scope, entry.manifest.id, [...entry.instance.nodeIds].sort(), notice.id]);
}
export function noticeFingerprint(notice: Notice): string {
 const content=JSON.stringify([notice.severity,notice.message,notice.actionId??'',Object.entries(notice.localizations??{}).sort(([a],[b])=>a.localeCompare(b))]);
 let hash=2166136261;for(let i=0;i<content.length;i++)hash=Math.imul(hash^content.charCodeAt(i),16777619);
 return (hash>>>0).toString(16);
}
export function dismissNotice(previous: Record<string,string>, key: string, fingerprint: string): Record<string,string> {
 return Object.fromEntries([...Object.entries(previous).filter(([k])=>k!==key).slice(-499),[key,fingerprint]]);
}
