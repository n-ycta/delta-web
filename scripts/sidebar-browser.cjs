const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:990}});
 await context.addInitScript(()=>{localStorage.setItem('delta.language','ru');localStorage.setItem('delta.console.connection',JSON.stringify({mode:'mock'}));localStorage.setItem('delta.console.prefs',JSON.stringify({state:{theme:'dark',sidebarCollapsed:true},version:1}));});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_UI_URL||'http://127.0.0.1:5173');await page.locator('.nav-item').first().waitFor();await page.waitForTimeout(1800);
 const check=async()=>{
 const bounds=await page.evaluate(()=>{const box=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,c:b.x+b.width/2}};return {rail:box('.sidebar'),logo:box('.delta-logo'),toggle:box('.sidebar-toggle'),avatar:box('.profile-avatar'),foot:box('.sidebar-foot'),icons:[...document.querySelectorAll('.nav > .nav-item > svg')].map(e=>{const b=e.getBoundingClientRect();return {c:b.x+b.width/2,w:b.width}}),overflow:document.documentElement.scrollWidth>innerWidth+1}});
 for(const b of [bounds.logo,bounds.toggle,bounds.avatar,...bounds.icons])assert(Math.abs(b.c-(bounds.rail.c-.5))<1,'All glyphs centred on the rail');
 assert(bounds.toggle.y<bounds.icons.length*44&&bounds.toggle.y<bounds.foot.y,'Toggle at top, not footer');assert(bounds.toggle.x>=0&&bounds.toggle.x+bounds.toggle.w<=bounds.rail.w,'Toggle inside sidebar');assert(bounds.icons.every(i=>i.w===20));assert(!bounds.overflow);assert.equal(bounds.avatar.w,bounds.avatar.h);
 };
 await check();await page.screenshot({path:'/data/sidebar-collapsed-dark.png'});
 await page.locator('.sidebar-toggle').click();assert.equal(await page.locator('.shell').getAttribute('data-collapsed'),'false');await page.waitForTimeout(700);await page.screenshot({path:'/data/sidebar-expanded-dark.png'});
 await page.locator('.sidebar-toggle').click();await page.reload();await page.locator('.nav-item').first().waitFor();assert.equal(await page.locator('.shell').getAttribute('data-collapsed'),'true');await check();
 await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.waitForTimeout(700);await page.screenshot({path:'/data/sidebar-collapsed-light.png'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/меню/i}).first().click();await page.waitForTimeout(250);assert(await page.locator('.sidebar-foot-text').isVisible(),'Mobile profile restored even with collapsed preference');assert(await page.locator('.nav-label').first().isVisible());assert(!await page.locator('.sidebar-toggle').isVisible());await page.screenshot({path:'/data/sidebar-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS sidebar: centred 20px glyphs, contained top toggle, round profile, expand/collapse persistence, dark/light and mobile menu');
 }finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
