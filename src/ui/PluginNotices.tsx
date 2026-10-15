import { tr, language } from '@/i18n';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useApi } from '@/app/ApiContext';
import { usePrefs, useRuntimeAccess } from '@/app/stores';
import { noticeKey, noticeFingerprint, dismissNotice } from './pluginNoticeState';
import type { PluginEntry } from '@/core/contracts';
import { useMutation } from '@/app/query';
import { toast } from '@/app/stores';
import { Button } from './primitives';
import { Confirm } from './overlays';

/** Plugin-owned notices and declared actions. No platform or plugin-specific policy lives here. */
export function PluginNotices({ entry, prefix = false }: { entry: PluginEntry; prefix?: boolean }) {
 const api=useApi();
 const name=useRuntimeAccess(s=>s.name);
 const dismissed=usePrefs(s=>s.dismissedPluginNotices);
 const scope=JSON.stringify([api.mode,api.endpoint,api.mode==='http'?name:'demo']);
 const [confirmId,setConfirmId]=useState<string|null>(null);
 const action=useMutation((api,id:string)=>api.runPluginAction(entry.manifest.id,id),{invalidate:['plugins'],onError:e=>toast({severity:'error',title:tr('pages.plugins.PluginDetail.s_b5d97a28d9'),body:e.message})});
 const selected=entry.manifest.actions.find(a=>a.id===confirmId);
 // Avoid a flash of dismissed banners while the authenticated identity is loading.
 if(api.mode==='http'&&!name)return null;
 return <>
  {entry.instance.notices?.map(n=>{
   const key=noticeKey(scope,entry,n),fingerprint=noticeFingerprint(n);
   if(dismissed[key]===fingerprint)return null;
   const declared=entry.manifest.actions.find(a=>a.id===n.actionId);
   return <div key={n.id} data-notice-id={n.id} className={`banner ${n.severity} plugin-notice`} role="status" style={{marginBottom:12}}>
    <span className="plugin-notice-content">{prefix && <>{entry.manifest.name}{': '}</>}{n.localizations?.[language]??n.message}</span>
    {declared && <Button className="plugin-notice-action" size="sm" perm="plugins.manage" disabled={entry.instance.status==='disabled'} loading={action.pending} onClick={()=>declared.dangerous?setConfirmId(declared.id):action.run(declared.id)}>{declared.label}</Button>}
    <Button variant="ghost" iconOnly className="plugin-notice-close" aria-label={tr('runtime.dismissPluginNotice')} title={tr('runtime.dismissPluginNotice')} onClick={()=>usePrefs.getState().set({dismissedPluginNotices:dismissNotice(usePrefs.getState().dismissedPluginNotices,key,fingerprint)})}><X size={16} /></Button>
   </div>;
  })}
  <Confirm open={!!selected} onClose={()=>setConfirmId(null)} danger={selected?.dangerous} title={selected?.label??''} body={selected?.description} confirmLabel={selected?.label} onConfirm={()=>{if(selected)action.run(selected.id);setConfirmId(null)}} />
 </>;
}
