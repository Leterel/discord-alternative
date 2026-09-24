import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createSignalServer } from '../server/signal.mjs';
import WebSocket from 'ws';

const SECRET = 'server-test-secret-123';
let service, base;
test.before(async () => {
  service = createSignalServer({secret: SECRET});
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${service.server.address().port}`;
});
test.after(async () => { await service.close(); });

function client(url = base) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url.replace('http','ws'));
    ws.once('open', () => resolve(ws)); ws.once('error', reject);
  });
}
function next(ws, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const clean = () => { clearTimeout(timer); ws.off('message', onMessage); ws.off('error', onError); ws.off('close', onClose); };
    const onMessage = raw => { let value; try { value = JSON.parse(raw); } catch { return; } if (!predicate(value)) return; clean(); resolve(value); };
    const onError = error => { clean(); reject(error); };
    const onClose = () => onError(new Error('Socket closed before expected message'));
    const timer = setTimeout(() => onError(new Error('Timed out waiting for expected message')), 3000);
    ws.on('message', onMessage); ws.once('error', onError); ws.once('close', onClose);
  });
}
async function join(ws, name, room = 'test') {
  const joined = next(ws, message => message.type === 'joined');
  ws.send(JSON.stringify({type:'join',name,room,secret:SECRET}));
  return joined;
}
async function disconnect(...clients) {
  await Promise.all(clients.map(async ws => {
    if (ws.readyState === WebSocket.CLOSED) return;
    const closed = once(ws, 'close'); ws.close(); await closed;
  }));
}

test('health endpoint is available and static app is served', async () => {
  const health = await fetch(base + '/health'); assert.equal(health.status, 200); assert.equal(await health.text(), 'ok');
  const page = await fetch(base + '/'); assert.equal(page.status, 200); assert.match(await page.text(), /SofaFunk/);
});
test('authenticates room, relays signal, and limits room to two members', async () => {
  const one = await client(), two = await client();
  const first = await join(one, 'Mois');
  assert.equal(first.peers.length, 0); assert.equal(first.hasTurn, false);
  const joinedTwo = join(two, 'Kollege');
  const peerJoined = next(one, message => message.type === 'peer-joined');
  const second = await joinedTwo; await peerJoined; assert.equal(second.peers.length, 1);
  one.send(JSON.stringify({type:'signal',data:{description:{type:'offer',sdp:'test'}}}));
  const signal = await next(two, message => message.type === 'signal'); assert.equal(signal.data.description.type, 'offer');
  const three = await client(); three.send(JSON.stringify({type:'join',name:'Zu viel',room:'test',secret:SECRET}));
  const close = await new Promise(resolve => three.once('close', (_code, reason) => resolve({code:_code,reason:reason.toString()})));
  assert.equal(close.code, 4004); assert.match(close.reason, /zwei/);
  await disconnect(one, two, three);
});
test('wrong secret is rejected without disclosing room state', async () => {
  const ws = await client(); ws.send(JSON.stringify({type:'join',name:'Intruder',room:'secret',secret:'wrong-secret-123'}));
  const close = await new Promise(resolve => ws.once('close', (code, reason) => resolve({code,reason:reason.toString()})));
  assert.equal(close.code, 4003); assert.match(close.reason, /Falscher/);
});

test('authenticated resume replaces only its stale seat before the old socket closes', async () => {
  const old = await client(), friend = await client(), replacement = await client();
  try {
    const original = await join(old, 'Original', 'resume');
    const colleague = await join(friend, 'Friend', 'resume');
    assert.match(original.resumeToken, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(colleague.resumeToken, original.resumeToken);
    assert(!JSON.stringify(colleague.peers).includes(original.resumeToken));
    const oldClosed = once(old, 'close');
    const friendEvents = [];
    friend.on('message', raw => friendEvents.push(JSON.parse(raw)));
    const renewed = next(replacement, message => message.type === 'joined');
    // Deliberately leave the old socket OPEN; do not rely on client close timing.
    replacement.send(JSON.stringify({type:'join',name:'Original',room:'resume',secret:SECRET,resumeToken:original.resumeToken}));
    const result = await renewed; await oldClosed;
    assert.notEqual(result.id, original.id);
    assert.equal(result.resumeToken, original.resumeToken);
    const delivered = next(friend, message => message.type === 'signal');
    replacement.send(JSON.stringify({type:'signal',data:{afterResume:true}}));
    assert.equal((await delivered).from,result.id);
    assert.deepEqual(friendEvents.filter(message => ['peer-left','peer-joined'].includes(message.type)).map(message => [message.type,message.id]),
      [['peer-left',original.id],['peer-joined',result.id]]);
    assert.equal(service.rooms.get('resume').size,2);
    assert.deepEqual([...service.rooms.get('resume')].map(member => member.id).sort(),[colleague.id,result.id].sort());
  } finally { await disconnect(old,friend,replacement); }
});

test('resume tokens cannot bypass authentication, evict by name or replace another room', async () => {
  const one=await client(), two=await client(), elsewhere=await client();
  try {
    const original=await join(one,'Same name','protected');
    await join(two,'Friend','protected');
    const other=await join(elsewhere,'Elsewhere','other-resume');
    for (const [secret,token,code] of [[SECRET,'x'.repeat(43),4004],[SECRET,other.resumeToken,4004],['wrong-secret-123',original.resumeToken,4003]]) {
      const intruder=await client();
      const closed=once(intruder,'close');
      intruder.send(JSON.stringify({type:'join',name:'Same name',room:'protected',secret,resumeToken:token}));
      assert.equal((await closed)[0],code);
      assert.equal(service.rooms.get('protected').size,2);
      assert.equal(one.readyState,WebSocket.OPEN);
    }
  } finally {await disconnect(one,two,elsewhere);}
});
test('malformed joins are rejected', async () => {
  const ws = await client(); ws.send(JSON.stringify({type:'join',name:'',room:'bad room',secret:SECRET}));
  const close = await new Promise(resolve => ws.once('close', (code, reason) => resolve({code,reason:reason.toString()})));
  assert.equal(close.code, 4002); assert.match(close.reason, /ungueltig/);
});

test('room membership bounds signaling and cleans up disconnected clients', async () => {
  const one = await client(), two = await client(), outsider = await client();
  try {
    await join(one, 'One', 'isolated');
    await join(two, 'Two', 'isolated');
    await join(outsider, 'Other room', 'other');
    const outsiderMessages = [];
    outsider.on('message', data => outsiderMessages.push(JSON.parse(data)));
    const delivered = next(two, message => message.type === 'signal');
    one.send(JSON.stringify({type:'signal',data:{candidate:{candidate:'only-this-room'}}, room:'other'}));
    const signal = await delivered;
    assert.equal(signal.data.candidate.candidate, 'only-this-room');
    const peerLeft = next(two, message => message.type === 'peer-left');
    await disconnect(one); await peerLeft;
    assert.equal(service.rooms.get('isolated').size, 1);
    // A round trip on the other socket flushes the event loop without a timed sleep.
    const pong = once(outsider, 'pong'); outsider.ping(); await pong;
    assert.deepEqual(outsiderMessages, [], 'another room must receive neither signals nor peer departures');
    const replacement = await client();
    try { const joined = await join(replacement, 'Replacement', 'isolated'); assert.equal(joined.peers.length, 1); }
    finally { await disconnect(replacement); }
    const serverClosed = Promise.all([...service.rooms.get('isolated'), ...service.rooms.get('other')].map(ws => once(ws, 'close')));
    await disconnect(two, outsider); await serverClosed;
    assert.equal(service.rooms.has('isolated'), false);
    assert.equal(service.rooms.has('other'), false);
  } finally { await disconnect(one, two, outsider); }
});

test('TURN credentials use the coturn timestamp:HMAC-SHA1 contract per client', async () => {
  const turnSecret = 'independent-turn-secret-123456';
  const relay = createSignalServer({secret: SECRET, turnSecret, turnUrls: ' turn:turn.example.net:3478?transport=udp , turns:[2001:db8::1]:5349?transport=tcp '});
  await new Promise(resolve => relay.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${relay.server.address().port}`;
  const one = await client(url), two = await client(url);
  try {
    const before = Math.floor(Date.now() / 1000);
    const first = await join(one, 'One', 'relay');
    const second = await join(two, 'Two', 'relay');
    const after = Math.floor(Date.now() / 1000);
    assert.equal(first.hasTurn, true);
    assert.equal(first.iceServers.length, 1);
    const config = first.iceServers[0];
    assert.deepEqual(config.urls, ['turn:turn.example.net:3478?transport=udp', 'turns:[2001:db8::1]:5349?transport=tcp']);
    const expiry = Number(config.username.split(':')[0]);
    assert.ok(expiry >= before + 86400 && expiry <= after + 86400);
    assert.equal(config.username.split(':')[1], first.id);
    assert.equal(config.credential, createHmac('sha1', turnSecret).update(config.username).digest('base64'));
    assert.notEqual(config.username, second.iceServers[0].username);
    assert.notEqual(config.credential, second.iceServers[0].credential);
    assert.equal(JSON.stringify(first).includes(turnSecret), false);
    assert.equal(JSON.stringify(first).includes(SECRET), false);
  } finally { await disconnect(one, two); await relay.close(); }
});

test('invalid or incomplete TURN configuration fails before listening', () => {
  for (const config of [
    { turnUrls: 'turn:turn.example.net' },
    { turnSecret: 'long-enough-turn-secret' },
    { turnUrls: '', turnSecret: 'long-enough-turn-secret' },
    { turnUrls: 'turn:turn.example.net,', turnSecret: 'long-enough-turn-secret' },
    { turnUrls: 'https://turn.example.net', turnSecret: 'long-enough-turn-secret' },
    { turnUrls: 'turn:turn.example.net:70000', turnSecret: 'long-enough-turn-secret' },
    { turnUrls: 'turn:[not-ipv6]:3478', turnSecret: 'long-enough-turn-secret' },
  ]) assert.throws(() => createSignalServer({secret: SECRET, ...config}), /TURN_/);
});

test('shutdown waits for WebSockets and room cleanup and can be called twice', async () => {
  const temporary = createSignalServer({secret: SECRET});
  await new Promise(resolve => temporary.server.listen(0, '127.0.0.1', resolve));
  const ws = await client(`http://127.0.0.1:${temporary.server.address().port}`);
  await join(ws, 'Before shutdown');
  const closed = once(ws, 'close');
  const first = temporary.close();
  assert.equal(temporary.close(), first);
  await first; await closed;
  assert.equal(temporary.rooms.size, 0);
  assert.equal(temporary.wss.clients.size, 0);
  assert.equal(temporary.server.listening, false);
});
