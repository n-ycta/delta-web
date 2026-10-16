// Real Core + Web. Only temporary node/browser/data; never uses an installed user profile.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),binary=process.env.DELTA_TEST_BINARY||resolve(root,'../delta/target/debug/delta');
const {recoverWeb}=await import(pathToFileURL(process.env.DELTA_RECOVERY_SCRIPT||resolve(root,'../delta/scripts/recover-web.mjs')).href);
const dir=await mkdtemp(join(tmpdir(),'delta-owner-recovery-')),home=join(dir,'node'),data=join(dir,'web'),evidence=resolve(root,'../auth-recovery');await mkdir(evidence,{recursive:true});let core,web,browser;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Test service not ready')}
async function stop(p){if(!p||p.exitCode!==null)return;await new Promise(r=>{p.once('exit',r);p.kill('SIGTERM')})}
const cp=await port(),wp=await port(),origin='http://127.0.0.1:'+wp,env={...process.env,DELTA_HOME:home};
try{
 execFileSync(binary,['init','--name','Original node','--port',String(cp)],{env,stdio:'pipe'});
 const owner=(await readFile(join(home,'admin.token'),'utf8')).trim();await mkdir(data,{recursive:true});await writeFile(join(data,'existing-settings'),'preserve-me');
 const cfg=JSON.parse(await readFile(join(home,'config.json'),'utf8'));
 cfg.identity_origins.push(origin);cfg.components.push({id:'web',scopes:null,token_name:null,command:['unused-disabled-fixture'],enabled:false,env:{DATA_DIR:data,PORT:String(wp)}},{id:'old-plugin',scopes:null,token_name:null,command:['unchanged'],enabled:false,env:{PREFERENCE:'old-value'}});
 await writeFile(join(home,'config.json'),JSON.stringify(cfg));
 const api=async(capability,args={})=>{const r=await fetch('http://127.0.0.1:'+cp+'/v1/call',{method:'POST',headers:{authorization:'Bearer '+owner,'content-type':'application/json'},body:JSON.stringify({capability,args})});const d=await r.json();assert(d.ok,d.error?.message);return d.result};
 core=spawn(binary,['run'],{env,stdio:'ignore'});await ready('http://127.0.0.1:'+cp+'/v1/health');web=spawn(process.execPath,['server/main.mjs'],{cwd:root,env:{...env,DELTA_URL:'http://127.0.0.1:'+cp,DELTA_TOKEN:owner,DATA_DIR:data,PORT:String(wp),APP_HOST:'127.0.0.1',APP_PORT:String(await port())},stdio:'ignore'});await ready(origin+'/');for(let i=0;i<100;i++){try{await api('web.info');break}catch{}await new Promise(r=>setTimeout(r,100))}
 const beforeComponents=JSON.parse(await readFile(join(home,'config.json'),'utf8')).components;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const en=JSON.parse(await readFile(resolve(process.env.DELTA_UI_SOURCE||resolve(root,'node_modules/@delta/ui'),'src/i18n/en.json'),'utf8'));
 const key=randomBytes(32).toString('hex');const posted=[];page.on('request',r=>{if(r.method()==='POST')posted.push(r.postData()||'')});
 await page.goto(origin+'/');await page.getByRole('heading',{name:en.auth.title,exact:true}).waitFor();
 await page.getByLabel(en.polish.secretKey,{exact:true}).fill(key);await page.getByRole('button',{name:en.polish.login,exact:true}).click();await page.getByRole('alert').filter({hasText:en.auth.keyNotEnrolled}).waitFor();
 assert.equal(await page.locator('.shell').count(),0);
 await page.screenshot({path:join(evidence,'unregistered-key-390.png')});
 await page.getByRole('button',{name:en.auth.recover,exact:true}).click();await page.getByText(en.auth.recoverDescription,{exact:true}).waitFor();
 assert.equal(await page.locator('input[type=password]').count(),0,'Recovery never asks for nonexistent old key');
 await page.screenshot({path:join(evidence,'recover-390.png')});
 const lines=[];await recoverWeb({home,output:s=>lines.push(s)});const link=lines.find(s=>s.startsWith('http'));
 await page.goto(link);await page.getByText(en.auth.setupSession,{exact:true}).waitFor();
 await page.getByLabel(en.polish.identityName,{exact:true}).fill('Recovered owner');await page.getByRole('button',{name:en.auth.importKey,exact:true}).click();
 await page.getByLabel(en.polish.secretKey,{exact:true}).last().fill(key);await page.getByRole('button',{name:en.auth.register,exact:true}).click();
 await page.waitForFunction(()=>!document.body.innerText.includes('Temporary owner access.'));
 const user=await page.evaluate(async()=>{const r=await fetch('/api/v1/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'web.info',args:{}})});return (await r.json()).result});
 assert.match(user.principal.name,/^key:/);assert.equal((await page.evaluate(async()=>(await fetch('/apps/catalog')).status)),200,'Actual owner can access app catalog with original caller scope');assert(!(await api('tokens.list')).some(t=>t.name==='browser-owner'));
 const after=JSON.parse(await readFile(join(home,'config.json'),'utf8'));assert.equal(after.node_id,cfg.node_id);assert.deepEqual(after.components,beforeComponents);assert.equal(await readFile(join(data,'existing-settings'),'utf8'),'preserve-me');
 assert(posted.every(p=>!p.includes(key)),'Private key never sent over HTTP');
 assert(!(await page.evaluate(()=>JSON.stringify(localStorage)+JSON.stringify(sessionStorage))).includes(key),'Private key never stored by Console');
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));await page.screenshot({path:join(evidence,`identity-${width}.png`)});
  await page.getByRole('button',{name:en['layout.Topbar'].s_ee3c35f311,exact:true}).click();await page.locator('.drawer').waitFor();await page.screenshot({path:join(evidence,`notifications-${width}.png`),animations:'disabled'});await page.keyboard.press('Escape');}

 // Exercise the real profile backend, including UI upload, durable reload and host restart.
 await page.goto(origin+'/#/settings?tab=profile');await page.getByRole('heading',{name:en['pages.SettingsPage'].s_e1aaa72b71||'Settings',exact:true}).waitFor();
 await page.getByLabel(en.profile.name,{exact:true}).fill('Recovered owner');await page.getByLabel(en.profile.nickname,{exact:true}).fill('nyx');
 await page.locator('input[type=file]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2I+QAAAAASUVORK5CYII=','base64')});
 await page.locator('.profile-preview img').waitFor();await page.getByRole('button',{name:en.profile.save,exact:true}).click();
 await page.waitForFunction(async()=>{const r=await fetch('/api/v1/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'web.profile_get',args:{}})});const d=await r.json();return d.result?.name==='Recovered owner'&&d.result?.avatar?.startsWith('data:image/webp;base64,')});
 await stop(web);web=spawn(process.execPath,['server/main.mjs'],{cwd:root,env:{...env,DELTA_URL:'http://127.0.0.1:'+cp,DELTA_TOKEN:owner,DATA_DIR:data,PORT:String(wp),APP_HOST:'127.0.0.1',APP_PORT:String(await port())},stdio:'ignore'});await ready(origin+'/');await page.reload();await page.getByLabel(en.profile.name,{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('input[autocomplete=name]')?.value==='Recovered owner');assert.equal(await page.getByLabel(en.profile.name,{exact:true}).inputValue(),'Recovered owner');assert.equal(await page.getByLabel(en.profile.nickname,{exact:true}).inputValue(),'nyx');await page.locator('.profile-preview img').waitFor();
 await page.goto(origin+'/#/identity');await page.getByRole('button',{name:en.polish.logout,exact:true}).waitFor();

 // A fresh browser can sign in with the newly registered key to the same node.
 await page.getByRole('button',{name:en.polish.logout,exact:true}).click();await page.getByRole('heading',{name:en.auth.title,exact:true}).waitFor();await page.getByLabel(en.polish.secretKey,{exact:true}).fill(key);await page.getByRole('button',{name:en.polish.login,exact:true}).click();await page.locator('.shell').waitFor();
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS: unregistered-key explanation -> local same-node recovery -> import/register -> verified signed login -> logout/login; original node ID, plugin config and settings preserved; temporary owner revoked; no secret HTTP/storage; 390/1440px no overflow.');
}finally{if(browser)await browser.close();await stop(web);await stop(core);await rm(dir,{recursive:true,force:true})}
