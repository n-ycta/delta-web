import {tr,language} from '@/i18n';
import { readConnectionSettings } from './index';
/** Owner/control-plane calls share the same original-user transport as the regular adapter. */
export async function control(capability:string,args:unknown={},node?:string):Promise<any>{
 const s=readConnectionSettings();if(s.mode==='mock')throw Error(tr('polish.liveRequired'));
 const r=await fetch(s.baseUrl.replace(/\/$/,'').replace(/\/v1$/,'')+'/v1/call',{method:'POST',headers:{'content-type':'application/json',...(s.token?{authorization:'Bearer '+s.token}:{})},body:JSON.stringify({capability,args:{...(args as object),_locale:language},...(node?{node}:{})})});
 const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error?.message||tr('polish.requestFailed'));return data.result;
}
