import{DeltaError}from'./delta-sdk.mjs';
export const serviceTargets={mcp:'mcp',updates:'updater',ssh:'provision'};
export function createServices(client){
 const forward=(cap,args={})=>client.forward(cap,args);
 const optional=async(cap,args,fallback)=>{try{return await forward(cap,args)}catch(e){if(['not_found','unavailable'].includes(e.code))return fallback;throw e}};
 return{
 monitor:{history:(id,rangeMs)=>forward('observability.history',{id,rangeMs}),uptime:(id,days)=>forward('observability.uptime',{id,days}),status:()=>optional('observability.status',{}, {activity:{error:'missing_dependency'}})},
 updater:{notes:_locale=>optional('updater.notes',{_locale},[]),mark:(ids,read)=>forward('updater.mark',{ids,read})},
 events:{list:(query,c,_locale)=>forward('observability.events',{query,_locale}),audit:(action,a,c,e)=>optional('observability.audit',{action,target:a?.id||a?.dashboard?.id||'local',...(e?{errorCode:e.code||'operation_failed'}:{})},{recorded:false})},
 ssh:{connections:()=>optional('provision.connections',{},[]).catch(e=>{if(e.code==='forbidden')return[];throw e}),remove:id=>optional('provision.remove',{id},{removed:false})},
 handlers:Object.fromEntries([...['list','catalog','create','revoke'].map(x=>['web.mcp_'+x,'mcp.'+x]),...['status','check','settings','install'].map(x=>['web.updates_'+x,'updater.'+x]),...['preflight','probe','install','status'].map(x=>['web.nodes_ssh_'+x,'provision.'+x])].map(([a,b])=>[a,args=>forward(b,args)]))
 };
}
export const withEventAudit=(events,action,handler)=>async(a={},c)=>{try{const r=await handler(a,c);await events.audit(action,a,c).catch(()=>{});return r}catch(e){await events.audit(action,a,c,e).catch(()=>{});throw e}};
export async function proxyMcp(req,res,path){
 const base=new URL(process.env.DELTA_MCP_URL||'http://127.0.0.1:7730');
 if(!['127.0.0.1','[::1]','localhost'].includes(base.hostname)||base.protocol!=='http:'||base.username||base.password)throw new DeltaError('forbidden','MCP proxy must target an explicit local service');
 if(req.method!=='POST'){res.writeHead(405);res.end();return}
 if(req.headers.origin&&req.headers.origin!==(process.env.PUBLIC_ORIGIN||'http://'+req.headers.host)){res.writeHead(403);res.end();return}
 if(!/^\/mcp\/[a-zA-Z0-9_-]+$/.test(path)){res.writeHead(404);res.end();return}
 let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>1048576){res.writeHead(413);res.end();return}parts.push(part)}
 const upstream=await fetch(new URL(path,base),{method:'POST',headers:{authorization:req.headers.authorization||'','content-type':'application/json'},body:Buffer.concat(parts),signal:AbortSignal.timeout(35000)});
 res.writeHead(upstream.status,{'content-type':'application/json','cache-control':'no-store',...(upstream.status===401?{'www-authenticate':'Bearer'}:{})});res.end(await upstream.text());
}
