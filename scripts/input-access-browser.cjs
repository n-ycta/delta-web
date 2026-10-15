// Local isolated node only. Permission-denied UI is a fixture; no OS permission is granted by this test.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const token=fs.readFileSync('/data/test-home/admin.token','utf8').trim();
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(t=>{localStorage.setItem('delta.language','ru');localStorage.setItem('delta.console.connection',JSON.stringify({mode:'http',baseUrl:'/api'}));sessionStorage.setItem('delta.console.connection.token',t);localStorage.setItem('delta.console.prefs',JSON.stringify({state:{theme:'dark',sidebarCollapsed:true,realNoticeHidden:true},version:1}));},token);
 const page=await context.newPage();let requests=0;
 await page.route('**/api/v1/call',async route=>{
 const data=route.request().postDataJSON();if(data.capability==='web.plugins_action'&&data.args.actionId==='request_input_access')requests++;
 const response=await route.fetch();let json;try{json=await response.json()}catch{return route.fulfill({response})}
 if(data.capability==='web.plugins_list'&&json.ok){const p=json.result.find(p=>p.manifest.id==='dev.delta.type');p.instance.notices=[{id:'test.permission',severity:'warn',message:'Permission fixture',localizations:{ru:'Нет доступа к клавиатуре. Подтвердите системный запрос на узле.'},actionId:'request_input_access'}];}
 await route.fulfill({response,json});
 });
 await page.goto('http://127.0.0.1:7710/#/plugins/dev.delta.type?tab=settings');const button=page.getByRole('button',{name:'Разрешить доступ к клавиатуре',exact:true});await button.waitFor();await button.click();const dialog=page.getByRole('dialog');await dialog.waitFor();const text=await dialog.innerText();assert(text.includes('пароли'));assert(text.includes('root'));assert.equal(requests,0);await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(requests,0);
 await button.click();await dialog.getByRole('button',{name:'Разрешить доступ к клавиатуре',exact:true}).click();await page.waitForTimeout(700);assert.equal(requests,1,'One explicit action after confirmation');
 const status=await fetch('http://127.0.0.1:7700/v1/call',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({capability:'typing.status',args:{}})}).then(r=>r.json());assert.equal(status.result.inputAccess.reason,'missing_tools');
 await page.screenshot({path:'/data/input-access-button.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);const rect=await button.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);await page.screenshot({path:'/data/input-access-mobile.png'});
 console.log('PASS permission UI: Type-owned Russian warning/action, explicit confirm/cancel, no auto grant, actual missing-tools failure visible in Type state, button fits mobile');
 }finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
