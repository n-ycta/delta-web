// Optional integration test: real published binaries, isolated home and loopback port.
// Not part of npm test; CI runs it on Linux and Windows after unit tests.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,readFile,rm} from 'node:fs/promises';
import {tmpdir,platform,arch} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {Updater,UpdateError,officialDownload,unpackCore} from '../server/updater.mjs';
const exec=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const target=platform()==='win32'?'windows-x64':'linux-'+arch();
const asset='delta-'+target+'.tar.gz',exe=platform()==='win32'?'delta.exe':'delta';
const latest='0.3.4',oldVersion='0.3.3';
const base=v=>'https://github.com/n-ycta/delta/releases/download/v'+v+'/';
const home=await mkdtemp(join(tmpdir(),'delta-core-update-live-'));
const u=await new Updater(home,{healthAttempts:30}).init(),binary=join(home,'bin',exe);
try{
 const [body,sums]=await Promise.all([officialDownload(base(oldVersion)+asset,50000000),officialDownload(base(oldVersion)+'SHA256SUMS')]);
 const digest=createHash('sha256').update(body).digest('hex');
 assert(sums.toString().split('\n').some(l=>l.trim().split(/\s+/).join(' ')==digest+' '+asset));
 await mkdir(join(home,'bin'));await writeFile(binary,unpackCore(body).get(exe));await chmod(binary,0o700);
 await exec(binary,['init','--port','17739','--name','update-live-ci'],{env:{...process.env,DELTA_HOME:home},windowsHide:true});
 await writeFile(join(home,'sentinel'),'preserve identity and data');await u.startCore(binary,false);
 let before;for(let i=0;i<100;i++){try{before=await u.call('core.info');break}catch{await sleep(100)}}assert(before);
 const item={latest,asset:base(latest)+asset},download=u.download;
 u.download=async(url,limit)=>url.endsWith('SHA256SUMS')?Buffer.from('invalid checksum'):download(url,limit);
 await assert.rejects(u.installCore(item,async()=>{}),e=>e.code==='checksum');assert.equal((await u.call('core.info')).version,oldVersion);u.download=download;
 const wait=u.waitCore.bind(u);u.waitCore=async(v,id)=>{await wait(v,id);if(v===latest)throw new UpdateError('core_health')};
 await assert.rejects(u.installCore(item,async()=>{}),e=>e.code==='rolled_back');assert.equal((await u.call('core.info')).version,oldVersion);assert.equal((await u.call('core.info')).node_id,before.node_id);
 u.waitCore=wait;await u.installCore(item,async()=>{});assert.equal((await u.call('core.info')).version,latest);assert.equal((await u.call('core.info')).node_id,before.node_id);assert.equal(await readFile(join(home,'sentinel'),'utf8'),'preserve identity and data');
 console.log('PASS '+platform()+': published core checksum, actual replacement, forced-health rollback, same identity and data');
}finally{const identity=await u.findCore(binary).catch(()=>null);if(identity)await u.stopCore(binary,identity,false);await rm(home,{recursive:true,force:true})}
