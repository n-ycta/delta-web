// Explicit opt-in integration suite. Requires running node + all three plugins.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {DeltaClient} from '../server/delta-sdk.mjs';
const root=new URL('../../',import.meta.url),url=process.env.DELTA_URL||'http://127.0.0.1:7700';
const user=new DeltaClient(url,(await readFile(new URL('console-user.token',root),'utf8')).trim());const trainer=new DeltaClient(url,(await readFile(new URL('trainer-user.token',root),'utf8')).trim());
const info=await user.call('web.info');assert.equal(info.apiVersion,'1.0.0');assert.equal(info.principal.role,'owner');
const plugins=await user.call('web.plugins_list');assert(plugins.some(p=>p.manifest.id==='dev.delta.type'));assert(plugins.some(p=>p.manifest.id==='dev.delta.db'));
assert.equal((await user.call('storage.health')).status,'ok');
const now=Date.now(),session={id:randomUUID(),startedAt:now-60000,endedAt:now,language:'ru',characters:300,corrections:15,node:'e2e-trainer'};
const accepted=await trainer.call('typing.ingest',{session});assert.equal(accepted.metrics.wpm,60);assert.equal(accepted.metrics.accuracy,.95);
assert.equal((await trainer.call('typing.ingest',{session})).accepted,false);
const enSession={...session,id:randomUUID(),language:'en',characters:450,corrections:9};assert.equal((await trainer.call('typing.ingest',{session:enSession})).metrics.wpm,90);
await user.call('typing.flush');
const query={pluginId:'dev.delta.type',metricId:'wpm',range:{from:now-120000,to:now+1},groupBy:'language',filters:{language:['ru']},compare:'previous'};
const result=await user.call('web.metrics_query',{query});assert.equal(result.summary.current,60);assert.equal(result.series[0].key,'ru');assert.equal(result.series[0].label,'Русский');
assert.equal((await user.call('web.metrics_query',{query:{...query,filters:{language:['en']}}})).summary.current,90);
const home=(await user.call('web.dashboards_list')).find(d=>d.origin==='home');assert(home);await user.call('web.dashboards_save',{dashboard:{...home,name:'E2E Home'}});assert.equal((await user.call('web.dashboards_list')).find(d=>d.id===home.id).name,'E2E Home');await user.call('web.dashboards_save',{dashboard:home});
const nodes=await user.call('web.nodes_list');assert(nodes.length>=1);assert(nodes[0].cpu>=0&&nodes[0].cpu<=100);assert.equal(nodes[0].connection.transport,'http');assert((await user.call('web.nodes_command',{id:nodes[0].id,command:'ping'})).ok);
const r=await user.call('tokens.create',{name:'e2e-viewer-'+randomUUID().slice(0,8),scopes:['call:web.*'],ttl_seconds:60});const restricted=new DeltaClient(url,r.token);
await assert.rejects(restricted.call('web.access_create',{input:{name:'attack',role:'owner',scopes:['admin'],ttlDays:null}}),e=>e.code==='forbidden');await assert.rejects(restricted.call('web.nodes_command',{id:nodes[0].id,command:'restart-component',args:{component:'typing'}}),e=>e.code==='forbidden');await user.call('tokens.revoke',{id:r.id});
// Direct transport format: duplicate UUID+time records stay idempotent.
const record={id:randomUUID(),time:now,source:'e2e',node:'n',metric:'test',value:1,dimensions:{language:'ru'},payload:{}};
assert.equal((await user.call('storage.write',{records:[record]})).inserted,1);assert.equal((await user.call('storage.write',{records:[record]})).inserted,0);
console.log('PASS live Delta → web/type → PostgreSQL/TimescaleDB: discovery, RU aggregates, dedupe, metrics, dashboards, nodes, delegation, TTL token creation');
