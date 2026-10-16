import {readFile,writeFile,mkdir,rename,unlink,chmod} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';import {DeltaError} from './delta-sdk.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const local=hostname=>['localhost','127.0.0.1','[::1]'].includes(hostname);
export async function createSessions(client){
 const dir=resolve(process.env.DATA_DIR||process.env.DELTA_DATA||'data'),file=resolve(dir,'sessions.json');let sessions={};
 try{sessions=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!sessions||Array.isArray(sessions)||typeof sessions!=='object')throw Error('Invalid session store');
 let tail=Promise.resolve();const prune=()=>{for(const [key,s]of Object.entries(sessions))if(!s||!Number.isFinite(s.expires)||s.expires<=Date.now())delete sessions[key]};prune();
 const save=()=>{const text=JSON.stringify(sessions);const p=tail.then(async()=>{await mkdir(dirname(file),{recursive:true,mode:0o700});if(process.platform!=='win32')await chmod(dirname(file),0o700);await writeFile(file+'.tmp',text,{mode:0o600});if(process.platform!=='win32')await chmod(file+'.tmp',0o600);await rename(file+'.tmp',file)});tail=p.catch(()=>{});return p;};
 const cookie=req=>{const id=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('delta_session='))?.slice(14);return id&&/^[a-f0-9]{64}$/.test(id)?hash(id):''};
 const credential=req=>{const s=sessions[cookie(req)];return s&&s.expires>Date.now()?s.token:undefined};
 const issue=async(req,res,token,tokenId,expires,secure)=>{prune();if(Object.keys(sessions).length>=1024)throw new DeltaError('unavailable','Session limit reached');const previous=sessions[cookie(req)];delete sessions[cookie(req)];const secret=randomBytes(32).toString('hex');sessions[hash(secret)]={token,tokenId,expires};await save();if(previous?.tokenId&&previous.tokenId!==tokenId)await client.call('tokens.revoke',{id:previous.tokenId}).catch(()=>{});res.setHeader('set-cookie',`delta_session=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((expires-Date.now())/1000))}${secure?'; Secure':''}`)};
 const limits=new Map();function limited(req){const now=Date.now(),key=req.socket?.remoteAddress||'local';for(const[k,v]of limits)if(v.until<now)limits.delete(k);let b=limits.get(key);if(!b){if(limits.size>=4096)return true;b={until:now+60000,n:0};limits.set(key,b)}return ++b.n>30}
 let bootBusy=false;
 return{credential,async http(req,res,path){
  const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data))};
  if(req.method!=='POST'){reply(405,{error:'method_not_allowed'});return}
  let origin,secure;try{const u=new URL(process.env.PUBLIC_ORIGIN||'http://'+req.headers.host);if(u.origin!==u.href.replace(/\/$/,'' )||u.username||u.password||!['http:','https:'].includes(u.protocol))throw Error();origin=u.origin;secure=u.protocol==='https:';if(!secure&&!local(u.hostname))throw Error()}catch{reply(403,{error:'secure_origin_required',message:'Sign in over HTTPS or a localhost SSH tunnel.'});return}
  if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site'){reply(403,{error:'origin_rejected'});return}
  if(limited(req)){res.setHeader('retry-after','60');reply(429,{error:'rate_limited'});return}
  try{let text='',size=0;for await(const c of req){size+=c.length;if(size>16384)throw new DeltaError('bad_request','Body too large');text+=c}const a=JSON.parse(text||'{}');if(!a||typeof a!=='object'||Array.isArray(a))throw new DeltaError('bad_request','Object required');
   if(path==='/session/bootstrap'){
    if(bootBusy)throw new DeltaError('unauthorized','Bootstrap in use');bootBusy=true;
    try{const f=resolve(dir,'bootstrap.json'),boot=JSON.parse(await readFile(f,'utf8'));if(!Number.isFinite(boot.expires)||boot.expires<Date.now()||typeof boot.hash!=='string'||!/^[a-f0-9]{64}$/.test(boot.hash)||!timingSafeEqual(Buffer.from(hash(String(a.code||''))),Buffer.from(boot.hash)))throw new DeltaError('unauthorized','Setup link expired or consumed');await unlink(f);const t=await client.call('tokens.create',{name:'browser-owner',scopes:['admin'],ttl_seconds:3600});await issue(req,res,t.token,t.id,Date.now()+3600000,secure);reply(200,{ok:true,setup:true})}finally{bootBusy=false}return
   }
   if(path==='/session/challenge'){const c=await client.call('identity.challenge',{public_key:a.public_key,audience:origin,remember:a.remember===true});reply(200,c);return}
   if(path==='/session/key-login'){const t=await client.call('identity.login',{nonce:a.nonce,signature:a.signature});if(t.audience!==origin)throw new DeltaError('forbidden','Audience mismatch');await issue(req,res,t.token,t.id,t.expires_at*1000,secure);reply(200,{ok:true});return}
   if(path==='/session/logout'){const id=cookie(req),s=sessions[id];if(s)await client.call('tokens.revoke',{id:s.tokenId}).catch(()=>{});delete sessions[id];await save();res.setHeader('set-cookie',`delta_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);reply(200,{ok:true});return}
   reply(404,{error:'not_found'});
  }catch(e){reply(e.code==='forbidden'?403:e.code==='bad_request'?400:e.code==='unavailable'?503:401,{error:e.code||'unauthorized',message:e.code?e.message:'Sign-in unavailable or setup link expired'})}
 }};
}
