// Track accepted sockets too: Server.close alone can leave a detached/unfinished
// browser connection alive indefinitely during a supervised restart.
export function trackHttpServer(server) {
 const sockets=new Set();
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 return async function close({graceMs=3000}={}) {
  await new Promise(resolve=>{
   let timer;
   const done=()=>{clearTimeout(timer);resolve()};
   server.close(done);
   timer=setTimeout(()=>{for(const socket of sockets)socket.destroy();server.closeAllConnections?.();},graceMs);
   timer.unref();
  });
 };
}
