import {readFile,mkdir,writeFile,rename,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DeltaError} from './delta-sdk.mjs';
export function validateProfile(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new DeltaError('bad_request','Invalid profile');
 const {name,nickname,avatar}=value;
 if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\p{Cc}]/u.test(name))throw new DeltaError('bad_request','Invalid profile name');
 if(typeof nickname!=='string'||nickname.length>32||nickname&&!/^[\p{L}\p{N}_.-]+$/u.test(nickname))throw new DeltaError('bad_request','Invalid nickname');
 if(typeof avatar!=='string'||avatar.length>48000)throw new DeltaError('bad_request','Invalid avatar');
 if(avatar){const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatar);if(!m)throw new DeltaError('bad_request','Invalid avatar format');const b=Buffer.from(m[2],'base64');const valid=m[1]==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';if(!valid||b.length>36000)throw new DeltaError('bad_request','Invalid avatar image')}
 return {name:name.trim(),nickname,avatar,updatedAt:Date.now()};
}
export function createProfiles({directory=process.env.DATA_DIR||process.env.DELTA_DATA||'data'}={}){
 const dir=resolve(directory),file=resolve(dir,'profiles.json');let tail=Promise.resolve();
 const actor=c=>{if(!c?.name||c.name==='anonymous'||!c.scopes?.length)throw new DeltaError('unauthorized','Authentication required');return c.scopes.includes('admin')?'owner':createHash('sha256').update(c.name).digest('hex')};
 const read=async()=>{try{const d=JSON.parse(await readFile(file,'utf8'));if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid profile store');return d}catch(e){if(e.code==='ENOENT')return {};throw e}};
 return {'web.profile_get':async(_a,c)=>{const id=actor(c);await tail;return (await read())[id]||{name:'',nickname:'',avatar:'',updatedAt:0}},'web.profile_save':async(a,c)=>{const id=actor(c),value=validateProfile(a.profile);const save=tail.then(async()=>{const data=await read();data[id]=value;await mkdir(dir,{recursive:true,mode:0o700});await writeFile(file+'.tmp',JSON.stringify(data),{mode:0o600});if(process.platform!=='win32')await chmod(file+'.tmp',0o600);await rename(file+'.tmp',file);return value});tail=save.catch(()=>{});return save}};
}
