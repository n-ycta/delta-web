import {randomUUID} from 'node:crypto';
const SOURCE='dev.delta.web.node',METRICS=['cpu','mem','disk','latency','availability'];
export function createTelemetry(client,storage){
 let busy=false,lastSyncAt=0,error=null;const writes=[];let lastRetention=0;
 async function sample(){if(busy)return;busy=true;try{const local=await client.call('core.info'),peers=await client.call('peers.list').catch(()=>[]),nodes=[{node_id:local.node_id,online:true},...peers];const records=[];
  for(const n of nodes){const now=Date.now(),node=n.node_id===local.node_id?undefined:n.node_id;let stats;const before=performance.now();if(n.online)try{stats=await client.call('system.info',{},node)}catch{}const latency=stats?Math.max(0,Math.round(performance.now()-before)):null;
   const values={availability:stats?1:0,...(stats?{cpu:stats.cpu_usage??null,mem:stats.memory.total&&stats.memory.available!==null?100*(stats.memory.total-stats.memory.available)/stats.memory.total:null,disk:stats.disk.total?100*stats.disk.used/stats.disk.total:null,latency}:{})};
   for(const [metric,value]of Object.entries(values))records.push({id:randomUUID(),time:now,source:SOURCE,node:n.node_id,metric,value,dimensions:{node:n.node_id},payload:{schema:'dev.delta.web.node.v1',samplePeriodMs:15000}});
  }
  if(records.length)await client.call(storage+'.write',{records});lastSyncAt=Date.now();writes.push({t:lastSyncAt,n:records.length});while(writes[0]?.t<Date.now()-60000)writes.shift();error=null;if(Date.now()-lastRetention>86400000){for(const metric of METRICS)await client.call(storage+'.delete',{source:SOURCE,metric,from:0,to:Date.now()-90*86400000});lastRetention=Date.now();}
 }catch(e){error=e.code||e.name;}finally{busy=false;}}
 async function aggregate(metric,id,from,to,bucketMs){const r=await client.call(storage+'.aggregate',{source:SOURCE,metric,from,to,filters:{node:[id]},aggregation:'avg',groupBy:[],bucketMs,limit:10000});if(r.truncated)throw Error('Telemetry result too large');return r.rows;}
 return {sample,status:()=>({lastSyncAt: lastSyncAt||undefined,eventsPerMin:writes.filter(w=>w.t>=Date.now()-60000).reduce((s,w)=>s+w.n,0),error}),
  history:async(id,span)=>{const to=Date.now(),from=to-Math.min(Math.max(Number(span)||86400000,60000),90*86400000),bucket=Math.max(60000,Math.ceil((to-from)/180/60000)*60000);const result={};for(const metric of ['cpu','mem','latency']){const rows=await aggregate(metric,id,from,to,bucket);result[metric]={key:metric,label:metric,points:rows.length?Array.from({length:Math.ceil(to/bucket)-Math.floor(from/bucket)},(_,i)=>{const t=(Math.floor(from/bucket)+i)*bucket;return {t,v:rows.find(r=>r.time===t)?.value??null}}):[]}}return result},
  uptime:async(id,days)=>{days=Math.min(Math.max(Math.floor(days)||90,1),90);const today=Math.floor(Date.now()/86400000)*86400000,from=today-(days-1)*86400000,rows=await aggregate('availability',id,from,Date.now()+1,86400000),byDay=new Map(rows.map(r=>[r.time,r.value]));return Array.from({length:days},(_,i)=>{const day=from+i*86400000,v=byDay.get(day);return {day,state:v===undefined||v===null?'nodata':v>=.999?'up':v<=0?'down':'partial',availability:v??0}})},
  start(){void sample();const timer=setInterval(()=>void sample(),15000);timer.unref();return ()=>clearInterval(timer)}
 };
}
