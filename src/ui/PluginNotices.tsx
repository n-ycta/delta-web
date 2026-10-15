import { tr, language } from '@/i18n';
import { useState } from 'react';
import type { PluginEntry } from '@/core/contracts';
import { useMutation } from '@/app/query';
import { toast } from '@/app/stores';
import { Button } from './primitives';
import { Confirm } from './overlays';

/** Plugin-owned notices and declared actions. No platform or plugin-specific policy lives here. */
export function PluginNotices({ entry, prefix = false }: { entry: PluginEntry; prefix?: boolean }) {
 const [confirmId,setConfirmId]=useState<string|null>(null);
 const action=useMutation((api,id:string)=>api.runPluginAction(entry.manifest.id,id),{invalidate:['plugins'],onError:e=>toast({severity:'error',title:tr('pages.plugins.PluginDetail.s_b5d97a28d9'),body:e.message})});
 const selected=entry.manifest.actions.find(a=>a.id===confirmId);
 return <>
  {entry.instance.notices?.map(n=>{
   const declared=entry.manifest.actions.find(a=>a.id===n.actionId);
   return <div key={n.id} className={`banner ${n.severity} plugin-notice`} role="status" style={{marginBottom:12}}>
    <span className="grow">{prefix && <>{entry.manifest.name}{': '}</>}{n.localizations?.[language]??n.message}</span>
    {declared && <Button size="sm" perm="plugins.manage" disabled={entry.instance.status==='disabled'} loading={action.pending} onClick={()=>declared.dangerous?setConfirmId(declared.id):action.run(declared.id)}>{declared.label}</Button>}
   </div>;
  })}
  <Confirm open={!!selected} onClose={()=>setConfirmId(null)} danger={selected?.dangerous} title={selected?.label??''} body={selected?.description} confirmLabel={selected?.label} onConfirm={()=>{if(selected)action.run(selected.id);setConfirmId(null)}} />
 </>;
}
