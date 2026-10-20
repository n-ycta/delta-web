import{test}from'node:test';import assert from'node:assert/strict';import{createServer}from'node:http';import{connect}from'node:net';import{trackHttpServer}from'../server/shutdown.mjs';
test('Web restart bounds partial browser connections rather than waiting forever',async()=>{
 const server=createServer((req,res)=>res.end('ok')),close=trackHttpServer(server);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const socket=connect(server.address().port,'127.0.0.1');
 await new Promise(r=>socket.once('connect',r));socket.write('GET / HTTP/1.1\r\nHost: localhost\r\n');
 const start=Date.now();await close({graceMs:30});assert(Date.now()-start<1000);socket.destroy();assert.equal(server.listening,false);
});
