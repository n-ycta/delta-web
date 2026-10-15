import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';import {DeltaError} from './delta-sdk.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function createSessions(client){
 const dir=resolve(process.env.DATA_DIR||process.env.DELTA_DATA||'data'),file=resolve(dir,'sessions.json');let sessions={};
 try{sessions=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let tail=Promise.resolve();const save=()=>{const text=JSON.stringify(sessions);const p=tail.then(async()=>{await mkdir(dirname(file),{recursive:true,mode:0o700});await writeFile(file+'.tmp',text,{mode:0o600});await rename(file+'.tmp',file)});tail=p.catch(()=>{});return p;};
 const cookie=req=>{const id=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('delta_session='))?.slice(14);return id?hash(id):'';};
 const credential=req=>{const s=sessions[cookie(req)];return s&&s.expires>Date.now()?s.token:undefined;};
 const issue=async(res,token,tokenId,expires)=>{const secret=randomBytes(32).toString('hex');sessions[hash(secret)]={token,tokenId,expires};await save();res.setHeader('set-cookie',`delta_session=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((expires-Date.now())/1000))}${process.env.PUBLIC_ORIGIN?.startsWith('https:')?'; Secure':''}`);};
 let bootBusy=false;
 return {credential,async http(req,res,path){
  const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  if(req.method!=='POST'){reply(405,{error:'method_not_allowed'});return;}
  const origin=process.env.PUBLIC_ORIGIN||'http://'+req.headers.host;
  if(req.headers.origin!==origin){reply(403,{error:'origin_rejected'});return;}
  try{let text='',size=0;for await(const c of req){size+=c.length;if(size>16384)throw new DeltaError('bad_request','Body too large');text+=c;}const a=JSON.parse(text||'{}');
   if(path==='/session/bootstrap'){
    if(bootBusy)throw new DeltaError('unauthorized','Bootstrap in use');bootBusy=true;
    try{const f=resolve(dir,'bootstrap.json'),boot=JSON.parse(await readFile(f,'utf8'));if(boot.expires<Date.now()||!timingSafeEqual(Buffer.from(hash(String(a.code||''))),Buffer.from(boot.hash)))throw new DeltaError('unauthorized','Setup link expired or consumed');await unlink(f);const t=await client.call('tokens.create',{name:'browser-owner',scopes:['admin'],ttl_seconds:28800});await issue(res,t.token,t.id,Date.now()+28800000);reply(200,{ok:true});}finally{bootBusy=false;}return;
   }
   if(path==='/session/challenge'){const c=await client.call('identity.challenge',{public_key:a.public_key,audience:origin});reply(200,c);return;}
   if(path==='/session/key-login'){const t=await client.call('identity.login',{nonce:a.nonce,signature:a.signature});if(t.audience!==origin)throw new DeltaError('forbidden','Audience mismatch');await issue(res,t.token,t.id,t.expires_at*1000);reply(200,{ok:true});return;}
   if(path==='/session/logout'){const id=cookie(req),s=sessions[id];if(s)await client.call('tokens.revoke',{id:s.tokenId}).catch(()=>{});delete sessions[id];await save();res.setHeader('set-cookie','delta_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');reply(200,{ok:true});return;}
   reply(404,{error:'not_found'});
  }catch(e){reply(e.code==='forbidden'?403:e.code==='bad_request'?400:401,{error:e.code||'unauthorized',message:e.code?e.message:'Sign-in unavailable or setup link expired'});}
 }};
}
