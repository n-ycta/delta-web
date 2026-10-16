import {readFile,mkdir,writeFile,rename,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DeltaError} from './delta-sdk.mjs';
import {validateWorkspace} from './workbench-schema.mjs';
export function createWorkspaces({directory=process.env.DATA_DIR||process.env.DELTA_DATA||'data'}={}){
 const dir=resolve(directory),file=resolve(dir,'workspaces.json');let tail=Promise.resolve();
 const actor=c=>{if(!c?.name||c.name==='anonymous'||!c.scopes?.length)throw new DeltaError('unauthorized','Authentication required');return c.scopes.includes('admin')?'owner':createHash('sha256').update(JSON.stringify([c.kind||'',c.peer_id||'',c.name])).digest('hex')};
 const read=async()=>{try{const d=JSON.parse(await readFile(file,'utf8'));if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid workspace store');return d}catch(e){if(e.code==='ENOENT')return {};throw e}};
 const write=async(path,value)=>{await writeFile(path+'.tmp',value,{mode:0o600});if(process.platform!=='win32')await chmod(path+'.tmp',0o600);await rename(path+'.tmp',path)};
 return {
 'web.workspace_get':async(_a,c)=>{const id=actor(c);await tail;return (await read())[id]||{workspace:null,revision:0}},
 'web.workspace_put':async(a,c)=>{const id=actor(c);if(!Number.isSafeInteger(a.revision)||a.revision<0)throw new DeltaError('bad_request','Invalid revision');let workspace;try{if(Buffer.byteLength(JSON.stringify(a.workspace))>48000)throw Error('Node layout limit: 48 KB');workspace=validateWorkspace(a.workspace)}catch(e){throw new DeltaError('bad_request',e.message)}
 const save=tail.then(async()=>{const data=await read(),old=data[id]||{workspace:null,revision:0};if(old.revision!==a.revision)throw new DeltaError('conflict','Layout changed on the node. Load it before saving.');const result={workspace,revision:old.revision+1};await mkdir(dir,{recursive:true,mode:0o700});if(data[id])await write(file+'.backup',JSON.stringify(data));data[id]=result;await write(file,JSON.stringify(data));return result});tail=save.catch(()=>{});return save;}
 };
}
