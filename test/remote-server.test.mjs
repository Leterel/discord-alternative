import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createSignalServer } from '../server/signal.mjs';
import { checkServer, serverEndpoint } from '../deploy/check-server.mjs';

const secret = 'local-server-check-secret';
async function withServer(config, operation) {
  const service = createSignalServer({ secret, ...config });
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  try { await operation(`ws://127.0.0.1:${service.server.address().port}`, service); }
  finally { await service.close(); }
}

test('remote checker allows only secure endpoints or literal loopback and never URL credentials', () => {
  for (const url of ['wss://sofa.example.net', 'ws://127.0.0.1:8787', 'ws://[::1]:8787', 'ws://localhost:8787']) assert.doesNotThrow(() => serverEndpoint(url));
  for (const url of [undefined, 'https://sofa.example.net', 'ws://192.168.1.2', 'ws://127.0.0.1.evil.example', 'wss://user:pass@sofa.example.net', 'wss://sofa.example.net/?secret=x', 'wss://sofa.example.net/#x', 'wss://sofa.example.net/other']) assert.throws(() => serverEndpoint(url), /SERVER_URL/);
});

test('checker performs real HTTP and bidirectional authenticated WebSocket signaling in a fresh room', async () => {
  await withServer({ turnUrls: 'turn:relay.invalid:3478', turnSecret: 'private-turn-secret' }, async (url, service) => {
    const result = await checkServer({ url, secret });
    assert.equal(result.health, true); assert.equal(result.authenticatedPeers, 2);
    assert.equal(result.bidirectionalSignaling, true); assert.equal(result.turnCredentials, true);
    assert.equal(result.rejectsWrongKey, true);
    assert.equal(result.tls, false);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes('private-turn-secret'), false);
    assert.equal(JSON.stringify(result).includes('credential"'), false);
    await service.close(); assert.equal(service.rooms.size, 0);
  });
});

test('checker fails closed when a healthy endpoint accepts wrong keys, hangs, or closes ambiguously', async () => {
  for (const mode of ['accept', 'hang', 'close']) {
    const server = http.createServer((_request, response) => response.end('ok'));
    const sockets = new WebSocketServer({ server });
    sockets.on('connection', socket => socket.on('message', () => {
      if (mode === 'accept') socket.send(JSON.stringify({ type: 'joined', id: 'unprotected' }));
      if (mode === 'close') socket.close(1000, 'sensitive server reason');
    }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      await assert.rejects(checkServer({ url: `ws://127.0.0.1:${server.address().port}`, secret, timeoutMs: 150 }), error => {
        assert.match(error.message, /Raumschluessel/);
        assert(!error.message.includes(secret));
        assert(!error.message.includes('sensitive server reason'));
        return true;
      });
    } finally {
      for (const socket of sockets.clients) socket.terminate();
      await new Promise(resolve => sockets.close(resolve));
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});

test('checker rejects missing TURN, but can explicitly check local development without it', async () => {
  await withServer({}, async url => {
    await assert.rejects(checkServer({ url, secret }), /TURN/);
    const result = await checkServer({ url, secret, requireTurn: false });
    assert.equal(result.turnCredentials, false);
  });
});

test('checker reports wrong room key without revealing it and closes its clients', async () => {
  await withServer({}, async (url, service) => {
    await assert.rejects(checkServer({ url, secret: 'wrong-private-room-key' }), error => {
      assert.match(error.message, /Raumschluessel abgelehnt/);
      assert(!error.message.includes('wrong-private-room-key')); return true;
    });
    await service.close(); assert.equal(service.rooms.size, 0);
  });
});

test('checker bounds network waits and rejects misleading health responses', async () => {
  for (const hang of [false, true]) {
    const server = http.createServer((_request, response) => { if (!hang) response.end('other application'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await assert.rejects(checkServer({ url: `ws://127.0.0.1:${server.address().port}`, secret, timeoutMs: 100 }), /Health-Check/); }
    finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});
