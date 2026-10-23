import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import {startLocalDemo} from '../server/demo.mjs';

function message(ws,predicate) {
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);ws.off('message',receive);ws.off('close',closed);};
    const closed=()=>{cleanup();reject(Error('Socket closed before expected message'));};
    const receive=raw=>{const data=JSON.parse(raw);if(predicate(data)){cleanup();resolve(data);}};
    const timer=setTimeout(()=>{cleanup();reject(Error('Demo message timeout'));},3000);
    ws.on('message',receive);ws.once('close',closed);
  });
}

test('local demo ignores deployment settings and authenticates two isolated real sockets',async()=>{
  const names=['HOST','PORT','ROOM_SECRET','TURN_URLS','TURN_SECRET'];
  const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  Object.assign(process.env,{HOST:'0.0.0.0',PORT:'1',ROOM_SECRET:'deployment-secret-unused',TURN_URLS:'not-a-valid-turn-url',TURN_SECRET:'deployment-turn-unused'});
  let first,second;const sockets=[];
  try {
    first=await startLocalDemo();second=await startLocalDemo();
    assert.match(first.websocket,/^ws:\/\/127\.0\.0\.1:\d+$/);
    assert.notEqual(first.websocket,second.websocket);assert.notEqual(first.secret,second.secret);
    assert.equal(first.secret.length,43);assert.notEqual(first.secret,process.env.ROOM_SECRET);
    assert.equal(await (await fetch(first.url+'/health')).text(),'ok');
    assert.match(await (await fetch(first.url)).text(),/SofaFunk/);
    const connect=async()=>{const ws=new WebSocket(first.websocket);sockets.push(ws);await once(ws,'open');return ws;};
    const a=await connect(),b=await connect();
    for(const [ws,name] of [[a,'Demo A'],[b,'Demo B']]) {
      const joined=message(ws,data=>data.type==='joined');
      ws.send(JSON.stringify({type:'join',name,room:'ersttest',secret:first.secret}));
      assert.deepEqual((await joined).iceServers,[]);
    }
    const received=message(b,data=>data.type==='signal');
    a.send(JSON.stringify({type:'signal',data:{demo:'synthetic payload'}}));
    assert.deepEqual((await received).data,{demo:'synthetic payload'});
    const wrong=await connect(),closed=once(wrong,'close');
    wrong.send(JSON.stringify({type:'join',name:'Wrong key',room:'ersttest',secret:second.secret}));
    assert.equal((await closed)[0],4003);
    await first.close();await first.close();
    assert.equal(await (await fetch(second.url+'/health')).text(),'ok');
  } finally {
    sockets.forEach(ws=>ws.terminate());await first?.close();await second?.close();
    for(const name of names)if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];
  }
});
