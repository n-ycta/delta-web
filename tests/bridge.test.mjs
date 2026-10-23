import {test} from 'node:test';import assert from 'node:assert/strict';import {queryMetric,reduce} from 'delta-observability/server/metrics.mjs';import {createBridge} from '../server/bridge.mjs';import {allowed} from '../server/delta-sdk.mjs';
test('aggregation and p95 are deterministic',()=>{assert.equal(reduce([1,2,3],'sum'),6);assert.equal(reduce([1,2,3],'p95'),3);assert.equal(reduce([],'avg'),null)});
test('current/previous RU EN series have aligned timestamps and empty buckets',async()=>{const client={call:async(_cap,q)=>({records:[{time:q.from+1,value:q.from===10000?50:40,dimensions:{language:'ru'}},{time:q.from+2,value:70,dimensions:{language:'en'}}]})};const r=await queryMetric(client,'storage',{pluginId:'dev.delta.type',metricId:'wpm',range:{from:10000,to:14000},stepMs:1000,groupBy:'language',compare:'previous'});assert.equal(r.series.length,2);assert.equal(r.compare[0].key,'ru__prev');assert.notEqual(r.series[0].key,r.compare[0].key);assert.equal(r.series[0].points[1].v,null);assert.equal(r.compare[0].points[0].t,r.series[0].points[0].t);assert.equal(r.summary.current,60)});
test('truncated queries fail rather than report partial analytics',async()=>{await assert.rejects(queryMetric({call:async()=>({records:[],truncated:true})},'storage',{pluginId:'p',metricId:'m',range:{from:1,to:10000}}),e=>e.code==='bad_request')});
test('service admin credential does not grant callers command privileges',async()=>{let called=false;const h=createBridge({call:async()=>{called=true}});await assert.rejects(h['web.nodes_command']({id:'n',command:'restart-component',args:{component:'typing'}},{scopes:['call:web.nodes_command']}),e=>e.code==='forbidden');assert.equal(called,false)});
test('scope glob matching and missing scopes fail closed',()=>{assert(allowed({scopes:['call:system.*']},'system.ping'));assert(!allowed({},'tokens.create'));assert(!allowed({scopes:['call:system.*']},'tokens.create'))});
test('dashboard configuration validated server-side',async()=>{const h=createBridge({});await assert.rejects(h['web.dashboards_save']({dashboard:{id:'x'}},{name:'a'}),e=>e.code==='bad_request')});

test('call:* never delegates administrative node commands through web service',async()=>{let privileged=false;const client={call:async name=>{if(name==='core.catalog')return [{name:'supervisor.restart',admin:true,node:'n'}];privileged=true;},request:async()=>[{name:'supervisor.restart',admin:true}]};const h=createBridge(client);await assert.rejects(h['web.nodes_command']({id:'n',command:'restart-component',args:{component:'typing'}},{scopes:['call:*']}),e=>e.code==='forbidden');assert.equal(privileged,false);assert.equal(allowed({scopes:['call:*']},'supervisor.restart',true),false);assert.equal(allowed({scopes:['admin:supervisor.restart']},'supervisor.restart',true),true);});

test('arbitrary plugin owns sanitized settings and notices; web forwards without Type IDs',async()=>{
 const ui={id:'dev.example.sensor',name:'Sensor',endpoints:{status:'sensor.status'},settings:[]};
 const client={call:async name=>{const values={'core.info':{node_id:'local'},'core.components':[{id:'sensor',version:'1',metadata:{ui}}],'supervisor.list':[{id:'sensor',enabled:true,running:true}],'packages.catalog':{plugins:[]},'peers.list':[],'packages.jobs':[],'sensor.status':{settings:{enabled:false},notices:[{id:'access',severity:'warn',message:'Plugin-owned warning'}]}};assert(name in values,name);return values[name];}};
 const rows=await createBridge(client)['web.plugins_list']();const p=rows.find(p=>p.manifest.id===ui.id);assert.equal(p.instance.settings.enabled,false);assert.equal(p.instance.notices[0].message,'Plugin-owned warning');
});
test('known registration errors localize without rewriting arbitrary diagnostics',async()=>{
 const client={call:async name=>({'core.info':{node_id:'local'},'core.components':[],'supervisor.list':[{id:'offline_plugin',enabled:true,running:false}],'packages.catalog':{plugins:[{id:'dev.example.offline',component:'offline_plugin',version:'1.0.0',manifest:{id:'dev.example.offline'}}]},'peers.list':[],'packages.jobs':[]}[name])};
 const row=(await createBridge(client)['web.plugins_list']({_locale:'ru'})).find(p=>p.manifest.id==='dev.example.offline');assert.equal(row.instance.error.message,'Плагин не зарегистрирован');
});
test('uninstall removes the managed component and subsequent discovery marks it available',async()=>{
 let installed=true;const id='dev.example.removable',component='removable',ui={id,name:'Removable',settings:[]};
 const client={call:async(name,args)=>{if(name==='supervisor.remove'){assert.equal(args.id,component);installed=false;return {removed:component}};const values={'core.info':{node_id:'local'},'core.components':installed?[{id:component,version:'1.0.0',metadata:{ui}}]:[],'supervisor.list':installed?[{id:component,enabled:true,running:true}]:[],'packages.catalog':{plugins:[{id,component,version:'1.0.0',manifest:ui}]},'peers.list':[],'packages.jobs':[],'storage.document_put':{}};assert(name in values,name);return values[name];}};
 const h=createBridge(client);await h['web.plugins_uninstall']({id,purgeData:false},{name:'owner',scopes:['admin']});const row=(await h['web.plugins_list']()).find(p=>p.manifest.id===id);assert.equal(row.instance.status,'available');assert.equal(row.instance.installedVersion,undefined);assert.deepEqual(row.instance.nodeIds,[]);
});
test('generic notice action preserves caller authority and forwards UI locale to plugin',async()=>{
 const id='dev.example.sensor',ui={id,settings:[],actions:[{id:'authorize',label:'Authorize'}]};let forwarded;
 const client={call:async(name,args)=>{if(name==='sensor.authorize'){forwarded=args;return {pending:true}}const d={'core.info':{node_id:'local'},'core.components':[{id:'sensor',version:'1.0.0',metadata:{ui}}],'supervisor.list':[{id:'sensor',enabled:true,running:true}],'packages.catalog':{plugins:[]},'peers.list':[],'packages.jobs':[],'storage.document_put':{}};assert(name in d,name);return d[name]}};
 const h=createBridge(client);
 await assert.rejects(h['web.plugins_action']({id,actionId:'authorize',_locale:'ru'},{name:'viewer',scopes:['call:web.plugins_action']}),e=>e.code==='forbidden');assert.equal(forwarded,undefined);
 await h['web.plugins_action']({id,actionId:'authorize',_locale:'ru'},{name:'owner',scopes:['admin']});assert.deepEqual(forwarded,{_locale:'ru'});
 await assert.rejects(h['web.plugins_action']({id,actionId:'undeclared'},{name:'owner',scopes:['admin']}),e=>e.code==='not_found');
});

test('application dashboard widget roundtrips with its surface and valid layout',async()=>{
 let saved;
 const h=createBridge({call:async(name,args)=>{if(name==='storage.document_put'){if(args.namespace.startsWith('dashboards_'))saved=args;return args.document || args.value || {ok:true}};throw Error(name)}});
 const widget={id:'media-player',type:'app',typeVersion:'1.0.0',source:{kind:'system',feed:'app'},display:{app:'dev.delta.media',surface:'player'},layout:{x:0,y:0,w:6,h:4}};
 await h['web.dashboards_save']({dashboard:{id:'test',name:'Media',origin:'user',range:'24h',refreshSec:0,pinned:false,createdAt:1,updatedAt:1,widgets:[widget]}},{name:'owner',scopes:['admin']});
 assert(saved, 'app source must pass the real server validator');
 assert(JSON.stringify(saved).includes('"surface":"player"'));
});
test('nodes_pair sends a normalized reachable hub URL to peers.invite and returns the pairing link',async()=>{
 const calls=[];const mk=info=>createBridge({call:async(n,a)=>{if(n==='storage.document_put')return {};calls.push([n,a]);if(n==='core.info')return info;if(n==='peers.invite')return {code:'c',url:a.url,link:'delta://pair?url=x&code=c',command:'delta join',expires_in:60};throw Error(n)}});
 const admin={scopes:['admin']};
 let r=await mk({url:'http://127.0.0.1:7700'})['web.nodes_pair']({url:'hub.lan:7700/'},admin);
 assert.deepEqual(calls.at(-1),['peers.invite',{trust_admin:false,url:'http://hub.lan:7700'}]);assert.equal(r.link,'delta://pair?url=x&code=c');assert.equal(r.url,'http://hub.lan:7700');assert(r.expiresAt>Date.now());
 calls.length=0;
 for(const bad of ['http://127.0.0.1:7700','localhost:7700','http://[::1]:7700','http://[::ffff:127.0.0.1]:7700','http://0.0.0.0:7700','http://hub.lan:0','http://u:p@hub.lan','http://hub.lan/?a=1','http://hub.lan/#x'])
  await assert.rejects(mk({})['web.nodes_pair']({url:bad,_locale:'ru'},admin),e=>e.code==='hub_url_required'&&/URL хаба/.test(e.message));
 assert.equal(calls.length,0);
 await h_core({public_url:'https://pub.example',url:'http://127.0.0.1:7700'},'https://pub.example');
 await h_core({url:'http://10.0.0.5:7700'},'http://10.0.0.5:7700');
 async function h_core(info,want){await mk(info)['web.nodes_pair']({},admin);assert.equal(calls.at(-1)[1].url,want)}
 calls.length=0;
 await assert.rejects(mk({url:'http://127.0.0.1:7700'})['web.nodes_pair']({},admin),e=>e.code==='hub_url_required'&&/hub URL/.test(e.message));
 assert(!calls.some(c=>c[0]==='peers.invite'));
});
