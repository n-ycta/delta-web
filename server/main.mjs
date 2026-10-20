import {trackHttpServer} from './shutdown.mjs';
import {createWorkspaces} from './workspaces.mjs';
import {createProfiles} from './profile.mjs';
import {createApps} from './apps.mjs';
import {createServices,proxyMcp} from './services.mjs';
import {createSessions} from './sessions.mjs';
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';import {DeltaClient,servePlugin} from './delta-sdk.mjs';import {createBridge} from './bridge.mjs';
const client=new DeltaClient(),root=resolve('dist'),controller=new AbortController();
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
const core=await client.call('core.info');if(!/^0\.4\.(?:[3-9]|[1-9][0-9]+)$/.test(String(core.version)))throw Error('Delta Core >=0.4.3 <0.5.0 required before starting this Web version');
const services=createServices(client),sessions=await createSessions(client);
const apps=await createApps(client,sessions);
const server=createServer(async(req,res)=>{
 try{
  res.setHeader('x-content-type-options','nosniff');res.setHeader('x-frame-options','DENY');res.setHeader('content-security-policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");res.setHeader('referrer-policy','no-referrer');
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/apps/')){await apps.http(req,res,pathname);return}
  if(pathname.startsWith('/mcp/')){await proxyMcp(req,res,pathname);return}
  if(pathname.startsWith('/session/')){await sessions.http(req,res,pathname);return}
  if(pathname.startsWith('/api/v1/')){
   if(req.headers.origin&&req.headers.origin!==`${process.env.PUBLIC_ORIGIN||'http://'+req.headers.host}`){res.writeHead(403);res.end();return}
   const path=pathname.slice('/api/v1'.length);if(!['/call','/health','/capabilities'].includes(path)||!['GET','POST'].includes(req.method)){res.writeHead(404);res.end();return}
   let body='',bytes=0;for await(const c of req){bytes+=c.length;if(bytes>4*1024*1024){res.writeHead(413);res.end();return}body+=c}
   // Never accept SSH login secrets over a publicly served plaintext Web origin.
   if(req.method==='POST'&&path==='/call'){
    let payload;try{payload=JSON.parse(body)}catch{}
    if(payload?.capability==='web.nodes_ssh_install'){
     const origin=new URL(process.env.PUBLIC_ORIGIN||'http://'+req.headers.host);
     if(origin.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)){
      res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify({ok:false,error:{code:'forbidden',message:payload.args?._locale==='ru'?'Для передачи SSH-данных откройте Web через HTTPS или локальный туннель.':'Use HTTPS or a localhost tunnel before submitting SSH credentials.'}}));return;
     }
    }
   }
   // Forward the user's credential, NOT the service's admin token.
   const upstream=await fetch(client.url+'/v1'+path,{method:req.method,headers:{authorization:req.headers.authorization||(sessions.credential(req)?'Bearer '+sessions.credential(req):''),'content-type':'application/json'},body:req.method==='POST'?body:undefined,signal:AbortSignal.timeout(35000)});
   res.writeHead(upstream.status,{'content-type':'application/json','cache-control':'no-store'});res.end(await upstream.text());return
  }
  if(req.method!=='GET'){res.writeHead(405);res.end();return}
  const file=resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
  const data=await readFile(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
  res.setHeader('content-type',types[extname(file)]||'application/octet-stream');res.end(data);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:503);res.end('Delta service unavailable')}
});
const closeServer=trackHttpServer(server);
server.listen(Number(process.env.PORT||7710),process.env.HOST||'127.0.0.1');for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>controller.abort());
await servePlugin(client,manifest,{...createBridge(client,process.env.STORAGE_COMPONENT||'storage',services.monitor,services.updater,services.events,services.ssh),...services.handlers,...createProfiles(),...createWorkspaces()},{signal:controller.signal});await Promise.all([closeServer(),apps.close()]);
