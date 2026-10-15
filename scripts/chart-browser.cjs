// Isolated chart regression against real metric aggregation with sparse fixture observations.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {queryMetric}=await import('../server/metrics.mjs');
 const manifest=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../../delta_type/manifest.json'))).metadata.ui;
 let dashboard={id:'chart-qa',name:'Typing speed · RU / EN',origin:'user',range:'24h',refreshSec:0,pinned:true,createdAt:Date.now(),updatedAt:Date.now(),widgets:[{id:'wpm',type:'timeseries',typeVersion:'1.2.0',title:'Typing speed · RU / EN',source:{kind:'metric',pluginId:manifest.id,metricId:'wpm',aggregation:'avg',groupBy:'language'},display:{showLegend:true},layout:{x:0,y:0,w:12,h:8}}]};
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],queries=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/v1/**',async route=>{
  const {capability,args={}}=route.request().postDataJSON();let result=[];
  if(capability==='web.info') result={name:'Delta QA',coreVersion:'0.3.1',apiVersion:'1.0.0',startedAt:Date.now()-60000,features:[],principal:{name:'Fixture owner',role:'owner',scopes:['admin']}};
  if(capability==='web.plugins_list') result=[{manifest,latest:manifest,instance:{pluginId:manifest.id,status:'active',installedVersion:manifest.version,latestVersion:manifest.version,nodeIds:[],settings:{},grantedPermissions:[]}}];
  if(capability==='web.dashboards_list')result=[dashboard,{...dashboard,id:'home',origin:'home',name:'Overview',widgets:[]}];
  if(capability==='web.dashboards_save'){if(args.dashboard.id==='chart-qa')dashboard=args.dashboard;result=args.dashboard;}
  if(capability==='web.metrics_query'){
   queries.push(args.query);
   const client={call:async(_,q)=>({records:Array.from({length:48},(_,i)=>['ru','en'].map((language,j)=>({time:q.from+i*1800000+10000,value:60+j*14+Math.sin(i/4)*11,dimensions:{language}}))).flat(),truncated:false})};
   result=await queryMetric(client,'storage',args.query);
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,result})});
 });
 const base=process.env.TEST_UI_URL||'http://127.0.0.1:4173';await page.goto(base+'/#/dashboards/chart-qa');
 await page.locator('.recharts-line-curve').first().waitFor();
 const path=await page.locator('.recharts-line-curve').first().getAttribute('d');assert((path.match(/L/g)||[]).length>=40,'Default line connects sparse observations');
 await page.screenshot({path:'/data/chart-line-desktop.png'});
 async function editor(){await page.locator('.widget-head button').first().click();await page.getByText('Set up',{exact:true}).click();await page.getByText('3 · Display',{exact:true}).click();}
 await editor();
 const presentation=page.getByRole('combobox',{name:'Presentation',exact:true});
 for(const kind of ['dots','area','step','bar','line']){
  await presentation.selectOption(kind);await page.waitForTimeout(150);
  const preview=page.getByRole('dialog');
  if(kind==='bar')assert(await preview.locator('.recharts-bar-rectangle').count()>0);
  if(kind==='area')assert(await preview.locator('.recharts-area-area').count()>0);
  if(kind==='dots'){assert(await preview.locator('.recharts-line-dot').count()>40);assert.equal(await preview.locator('.recharts-line-curve').first().getAttribute('stroke-opacity'),'0');}
 }
 await presentation.selectOption('line');
 const connect=page.getByRole('switch',{name:'Connect across empty buckets',exact:true});await connect.click();
 let gapPath=await page.getByRole('dialog').locator('.recharts-line-curve').first().getAttribute('d');assert((gapPath.match(/M/g)||[]).length>1,'Gap mode preserves missing buckets');await connect.click();
 await page.getByRole('combobox',{name:'Bucket interval',exact:true}).selectOption('1800000');await page.waitForTimeout(200);assert(queries.some(q=>q.stepMs===1800000));
 await presentation.selectOption('dots');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});await page.waitForTimeout(800);await page.reload();await page.locator('.recharts-line-dot').first().waitFor();assert.equal(dashboard.widgets[0].display.chart,'dots');assert.equal(dashboard.widgets[0].display.stepMs,1800000);
 await editor();await page.getByRole('combobox',{name:'Presentation',exact:true}).selectOption('line');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.screenshot({path:'/data/chart-line-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);console.log('PASS connected sparse line, dots, area, step, bars, gap toggle, bucket query, saved reload, mobile and no page errors');
 } finally {await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
