import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';import {randomBytes,createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {DeltaClient,DeltaError} from './delta-sdk.mjs';
const pluginForComponent=id=>({typing:'dev.delta.type',storage:'dev.delta.db',web:'dev.delta.web'}[id]||id);
const hash=s=>createHash('sha256').update(s).digest('hex');
export const safeCapabilities=['core.info','system.info','system.ping','typing.status','storage.health','storage.query','web.metrics_query','web.nodes_list','web.plugins_list','supervisor.list','supervisor.logs','supervisor.restart'];
const administrative=new Set(['supervisor.list','supervisor.logs','supervisor.restart']);
const presets={'15m':900000,'1h':3600000,'6h':21600000,'24h':86400000,'7d':604800000,'30d':2592000000,'90d':7776000000};
export function constrain(profile,cap,args){
 const a=structuredClone(args||{}),target=a._targetNode;delete a._targetNode;
 if(profile.nodes.length&&!['web.nodes_list','web.plugins_list'].includes(cap)&&(!target||!profile.nodes.includes(target)))throw new DeltaError('forbidden','Select an allowed target node');
 const q=cap==='web.metrics_query'?a.query:cap==='storage.query'?a:null;
 if(q){const source=q.pluginId||q.source;if(profile.plugins.length&&!profile.plugins.includes(source))throw new DeltaError('forbidden','Plugin data is outside this profile');const range=q.range||q;const duration=range.preset?presets[range.preset]:range.to-range.from;if(!Number.isFinite(duration)||duration<=0||duration>profile.maxRangeDays*86400000)throw new DeltaError('forbidden','Time range exceeds profile limit');if(q.compare==='previous'&&duration*2>profile.maxRangeDays*86400000)throw new DeltaError('forbidden','Comparison exceeds profile limit');if(cap==='storage.query')q.limit=Math.min(q.limit||profile.maxRows,profile.maxRows);}
 // Generic node/plugin listing is filtered after execution. Logs contain arbitrary text and cannot be field-redacted reliably.
 if(profile.plugins.length&&['supervisor.logs','supervisor.restart'].includes(cap)&&!profile.plugins.includes(pluginForComponent(a.id)))throw new DeltaError('forbidden','Component is outside this profile');
 if(profile.plugins.length&&cap==='typing.status'&&!profile.plugins.includes('dev.delta.type'))throw new DeltaError('forbidden','Typing data is outside this profile');
 return {args:a,node:target};
}
const filtersSchema={type:'object',additionalProperties:{type:'array',items:{type:'string'},minItems:1}};
const metricQuerySchema={type:'object',additionalProperties:false,required:['pluginId','metricId','range'],properties:{pluginId:{type:'string',description:'Stable reverse-DNS plugin ID, for example dev.delta.type'},metricId:{type:'string',description:'Published metric ID, for example wpm or accuracy'},range:{oneOf:[{type:'object',required:['preset'],additionalProperties:false,properties:{preset:{enum:Object.keys(presets)}}},{type:'object',required:['from','to'],additionalProperties:false,properties:{from:{type:'integer',minimum:0,description:'Inclusive epoch milliseconds'},to:{type:'integer',minimum:1,description:'Exclusive epoch milliseconds'}}}]},aggregation:{enum:['avg','sum','min','max','last','p95','count']},stepMs:{type:'integer',minimum:1000},groupBy:{type:'string'},filters:filtersSchema,compare:{enum:['none','previous']}}};
export function toolSchema(name,cap={},profile={nodes:[]}){
 const properties={},required=[];
 for(const [k,v] of Object.entries(cap.params||{})){properties[k]={...v};delete properties[k].required;if(v.required===true)required.push(k);}
 if(name==='web.metrics_query'){properties.query=metricQuerySchema;required.push('query');}
 if(name==='storage.query'){Object.assign(properties,{source:{type:'string',description:'Producer plugin ID'},metric:{type:'string'},from:{type:'integer',minimum:0},to:{type:'integer',minimum:1},limit:{type:'integer',minimum:1,maximum:10000},filters:filtersSchema});required.push('source','metric','from','to');}
 properties._targetNode={type:'string',description:'Execute on this paired node; omit for the local node',...(profile.nodes.length?{enum:profile.nodes}:{})};
 if(profile.nodes.length&&!['web.nodes_list','web.plugins_list'].includes(name))required.push('_targetNode');
 return {type:'object',properties,required:[...new Set(required)],additionalProperties:false};
}
function redact(v,fields){if(Array.isArray(v))return v.map(x=>redact(x,fields));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!fields.includes(k)).map(([k,x])=>[k,redact(x,fields)]));return v;}
export async function createMcp(service,file=resolve(process.env.DATA_DIR||'data','mcp.json')){
 let profiles=[];try{profiles=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 let queue=Promise.resolve();const save=()=>{const content=JSON.stringify(profiles);const p=queue.then(async()=>{await mkdir(dirname(file),{recursive:true,mode:0o700});await writeFile(file+'.tmp',content,{mode:0o600});await rename(file+'.tmp',file);});queue=p.catch(()=>{});return p;};
 const publicProfile=p=>{const {secretHash,token,tokenId,...rest}=p;return rest};
 const handlers={
 'web.mcp_list':async()=>profiles.map(publicProfile),
 'web.mcp_catalog':async()=>{const caps=await service.request('GET','/capabilities');return (Array.isArray(caps)?caps:caps.capabilities||[]).filter(c=>safeCapabilities.includes(c.name));},
 'web.mcp_create':async({profile:p})=>{
  if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Array.isArray(p.capabilities)||!p.capabilities.length||p.capabilities.some(c=>!safeCapabilities.includes(c)))throw new DeltaError('bad_request','Choose a name and supported explicit capabilities');
  const strings=v=>Array.isArray(v)&&v.length<=64&&v.every(s=>typeof s==='string'&&s.length<128)?v:[];
  const id=randomUUID(),secret='dmc_'+randomBytes(32).toString('hex'),record={id,name:p.name.trim(),capabilities:[...new Set(p.capabilities)],nodes:strings(p.nodes),plugins:strings(p.plugins),redactedFields:strings(p.redactedFields),maxRangeDays:Math.min(366,Math.max(1,Number(p.maxRangeDays)||7)),maxRows:Math.min(10000,Math.max(1,Number(p.maxRows)||1000)),createdAt:Date.now(),secretHash:hash(secret)};
  const t=await service.call('tokens.create',{name:'mcp:'+id,scopes:record.capabilities.map(c=>(administrative.has(c)?'admin:':'call:')+c)});record.token=t.token;record.tokenId=t.id;
  profiles.push(record);try{await save()}catch(e){profiles=profiles.filter(p=>p.id!==id);await service.call('tokens.revoke',{id:t.id}).catch(()=>{});throw e;}
  return {profile:publicProfile(record),secret};
 },
 'web.mcp_revoke':async({id})=>{const p=profiles.find(p=>p.id===id);if(!p)throw new DeltaError('not_found','Profile not found');await service.call('tokens.revoke',{id:p.tokenId});profiles=profiles.filter(p=>p.id!==id);await save();return {revoked:id};}
 };
 for(const [name,fn] of Object.entries(handlers))handlers[name]=async(a,c)=>{if(!c?.scopes?.includes('admin'))throw new DeltaError('forbidden','Owner access required');return fn(a,c);};
 return {handlers,async http(req,res,pathname){
  const reply=(status,v)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(v===undefined?'':JSON.stringify(v));};
  if(req.method!=='POST'){reply(405);return;}
  if(req.headers.origin&&req.headers.origin!==(process.env.PUBLIC_ORIGIN||'http://'+req.headers.host)){reply(403);return;}
  const id=pathname.split('/')[2],p=profiles.find(p=>p.id===id),credential=req.headers.authorization?.replace(/^Bearer /,'')||'';
  if(!p||!timingSafeEqual(Buffer.from(hash(credential)),Buffer.from(p.secretHash))){res.setHeader('www-authenticate','Bearer');reply(401,{error:'unauthorized'});return;}
  let message;try{let body='',size=0;for await(const c of req){size+=c.length;if(size>1048576)throw Error('Body too large');body+=c}message=JSON.parse(body);}catch{reply(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
  const rpc=(v)=>reply(200,{jsonrpc:'2.0',id:message.id??null,...v});
  if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string'){rpc({error:{code:-32600,message:'Invalid request'}});return;}
  if(message.id===undefined){reply(202);return;}
  try{
   if(message.method==='initialize'){rpc({result:{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'Delta · '+p.name,version:'0.2.0'}}});return;}
   if(message.method==='ping'){rpc({result:{}});return;}
   if(message.method==='tools/list'){const catalog=await service.request('GET','/capabilities');const caps=Array.isArray(catalog)?catalog:catalog.capabilities||[];rpc({result:{tools:p.capabilities.map(name=>{const c=caps.find(c=>c.name===name)||{};return {name:name.replaceAll('.','__'),description:c.description||name,inputSchema:toolSchema(name,c,p)};})}});return;}
   if(message.method==='tools/call'){const name=String(message.params?.name||'').replaceAll('__','.');if(!p.capabilities.includes(name))throw new DeltaError('forbidden','Tool is not allowed');const a=constrain(p,name,message.params?.arguments);const client=new DeltaClient(service.url,p.token);let result=await client.call(name,a.args,a.node);if(name==='web.nodes_list'&&p.nodes.length)result=result.filter(n=>p.nodes.includes(n.id));if(name==='supervisor.list'&&p.plugins.length)result=result.filter(n=>p.plugins.includes(pluginForComponent(n.id)));if(name==='web.plugins_list'&&p.plugins.length)result=result.filter(n=>p.plugins.includes(n.manifest.id));result=redact(result,p.redactedFields);if(Buffer.byteLength(JSON.stringify(result))>2_000_000)throw new DeltaError('bad_request','Result too large; narrow the query');rpc({result:{content:[{type:'text',text:JSON.stringify(result)}],isError:false}});return;}
   rpc({error:{code:-32601,message:'Method not found'}});
  }catch(e){rpc({result:{content:[{type:'text',text:JSON.stringify({code:e.code||'unavailable',message:e.code?e.message:'Tool execution failed'})}],isError:true}});}
 }};
}
