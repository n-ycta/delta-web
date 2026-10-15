// Requires an isolated live node + web/type/storage stack (see delta/scripts/setup-local.mjs).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const token=fs.readFileSync(path.resolve(__dirname,'../../console-user.token'),'utf8').trim();
 const base=process.env.TEST_UI_URL||'http://127.0.0.1:7710',core=process.env.DELTA_URL||'http://127.0.0.1:7700';
 const call=async(capability,args={})=>{const r=await fetch(core+'/v1/call',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({capability,args})});const d=await r.json();if(!d.ok)throw Error(d.error.message);return d.result};
 const initial=await call('typing.settings');await call('typing.settings',{values:{recordKeys:false}});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(t=>{localStorage.setItem('delta.language','ru');localStorage.setItem('delta.console.connection',JSON.stringify({mode:'http',baseUrl:'/api'}));sessionStorage.setItem('delta.console.connection.token',t);localStorage.setItem('delta.console.prefs',JSON.stringify({state:{theme:'dark',realNoticeHidden:true},version:1}));},token);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#/plugins/dev.delta.type?tab=settings');const toggle=page.getByRole('switch',{name:'Записывать последовательность физических клавиш локально',exact:true});await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'),'false');await toggle.click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert((await dialog.innerText()).includes('пароли'));await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await toggle.getAttribute('aria-checked'),'false');
  await toggle.click();await dialog.getByRole('button',{name:'Понимаю, включить запись',exact:true}).click();assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal((await call('typing.settings')).recordKeys,false);
  await page.getByRole('button',{name:'Сохранить настройки',exact:true}).click();await page.waitForTimeout(800);assert.equal((await call('typing.settings')).recordKeys,true);
  const avatar=await page.locator('.profile-avatar').boundingBox();assert.equal(avatar.width,avatar.height);assert.equal(await page.locator('.profile-avatar svg').count(),1);
  const number=page.locator('input[type=number]');await number.fill('8');await page.waitForTimeout(11000);assert.equal(await number.inputValue(),'8','Polling must not reset unsaved settings');
  await page.screenshot({path:process.env.TEST_SCREENSHOT_DIR?path.join(process.env.TEST_SCREENSHOT_DIR,'type-settings.png'):'/data/type-settings.png',fullPage:true});
  await page.goto(base+'/#/plugins/dev.delta.db?tab=settings');await page.locator('.plugin-settings').waitFor();await page.screenshot({path:'/data/storage-settings.png',fullPage:true});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  const select=page.locator('.plugin-settings select');await select.click();await page.screenshot({path:'/data/storage-picker.png',fullPage:true});await page.keyboard.press('Escape');
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'No overflow at '+width);}
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/#/mcp');await page.getByRole('heading',{name:'MCP-шлюзы'}).waitFor();await page.waitForTimeout(500);assert((await page.locator('fieldset').innerText()).includes('Перезапустить процесс'));await page.screenshot({path:'/data/mcp-fixed.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS live UI: plugin-owned RU confirmation, cancel/accept/save, round glyph, polling-safe edits, themed picker, storage layout, responsive widths and localized MCP descriptions');
 }finally{await call('typing.settings',{values:{...initial,_confirmations:initial.recordKeys?['type.record-keys.v1']:[]}});await browser.close();}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
