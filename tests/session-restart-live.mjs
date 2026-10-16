// Isolated local processes and browser profile only. Never touches an installed node.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';import {createServer} from 'node:net';
import {randomBytes,createHash} from 'node:crypto';import {chromium} from 'playwright';
import {schnorr} from '@noble/curves/secp256k1';import {sha256} from '@noble/hashes/sha256';import {bytesToHex,utf8ToBytes} from '@noble/hashes/utils';
const root=resolve(import.meta.dirname,'..'),binary=process.env.DELTA_TEST_BINARY||resolve(root,'../delta/target/debug/delta');
const dir=await mkdtemp(join(tmpdir(),'delta-restart-live-')),home=join(dir,'node'),data=join(dir,'web');
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const cp=await port(),wp=await port(),origin='http://127.0.0.1:'+wp,env={...process.env,DELTA_HOME:home};let core,web,browser;
async function stop(p){if(!p||p.exitCode!==null)return;await new Promise(r=>{p.once('exit',r);p.kill('SIGTERM')});}
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Process did not become ready: '+url)}
try{
 execFileSync(binary,['init','--name','restart-fixture','--port',String(cp)],{env,stdio:'pipe'});
 const token=(await readFile(join(home,'admin.token'),'utf8')).trim();
 const api=async(capability,args={})=>{const r=await fetch('http://127.0.0.1:'+cp+'/v1/call',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({capability,args})});const d=await r.json();assert(d.ok,d.error?.message);return d.result};
 const cfg=JSON.parse(await readFile(join(home,'config.json'),'utf8'));cfg.identity_origins.push(origin);await writeFile(join(home,'config.json'),JSON.stringify(cfg));
 async function start(){core=spawn(binary,['run'],{env,stdio:'ignore'});await ready('http://127.0.0.1:'+cp+'/v1/health');web=spawn(process.execPath,['server/main.mjs'],{cwd:root,env:{...env,DELTA_URL:'http://127.0.0.1:'+cp,DELTA_TOKEN:token,DATA_DIR:data,PORT:String(wp)},stdio:'ignore'});await ready(origin+'/');for(let i=0;i<100;i++){try{await api('web.info');return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Web did not register')}
 await start();
 browser=await chromium.launchPersistentContext(join(dir,'browser'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});
 let page=await browser.newPage();await page.goto(origin+'/');
 const privateKey=randomBytes(32),pk=bytesToHex(schnorr.getPublicKey(privateKey));
 const enrolled=await api('identity.enroll',{public_key:pk,name:'Restart fixture',scopes:['call:web.info','call:system.ping']});
 const post=async(path,args)=>page.evaluate(async({path,args})=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});return {status:r.status,data:await r.json()}},{path,args});
 const challenge=(await post('/session/challenge',{public_key:pk,remember:true})).data;assert(challenge.remember);
 const login=await post('/session/key-login',{nonce:challenge.nonce,signature:bytesToHex(schnorr.sign(sha256(utf8ToBytes(challenge.message)),privateKey))});privateKey.fill(0);assert.equal(login.status,200);
 assert((await browser.cookies()).some(c=>c.name==='delta_session'&&c.httpOnly&&c.expires>Date.now()/1000+2591900));
 assert.equal((await post('/api/v1/call',{capability:'web.info',args:{}})).status,200);
 await browser.close();browser=undefined;await stop(web);await stop(core);
 await start();browser=await chromium.launchPersistentContext(join(dir,'browser'),{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});page=await browser.newPage();await page.goto(origin+'/');
 const info=await post('/api/v1/call',{capability:'web.info',args:{}});assert.equal(info.status,200);assert.equal(info.data.result.principal.name,'key:'+enrolled.id);
 assert.equal((await post('/api/v1/call',{capability:'tokens.create',args:{name:'forbidden',scopes:['admin']}})).status,403);
 await api('identity.remove',{id:enrolled.id});assert.equal((await post('/api/v1/call',{capability:'web.info',args:{}})).status,401);
 await page.reload();await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.getByText('Connection to core lost, reconnecting…',{exact:true}).count(),0);
 console.log('PASS: remembered scoped login survives real core, Web and browser process restarts; key revocation still denies access and UI offers sign-in, not reconnect');
}finally{if(browser)await browser.close();await stop(web);await stop(core);await rm(dir,{recursive:true,force:true})}
