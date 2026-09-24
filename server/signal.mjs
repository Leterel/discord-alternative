import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';

const staticFiles = new Map(['index.html', 'style.css', 'app.js', 'connection.mjs'].map(n => ['/' + n, new URL('../public/' + n, import.meta.url)]));
const mime = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript' };
function validateTurn(turnUrls, turnSecret) {
  if (turnUrls === undefined && turnSecret === undefined) return [];
  if (typeof turnUrls !== 'string' || !turnUrls.trim() || typeof turnSecret !== 'string' || turnSecret.length < 12) {
    throw new Error('TURN_URLS und TURN_SECRET (mindestens 12 Zeichen) gemeinsam setzen oder beide weglassen');
  }
  const urls = turnUrls.split(',').map(value => value.trim());
  for (const url of urls) {
    const match = /^(turns?):(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/i.exec(url);
    const host = match?.[2];
    const validHost = host?.startsWith('[')
      ? isIP(host.slice(1, -1)) === 6
      : host && host.length <= 253 && host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    if (!match || !validHost || (match[3] && (Number(match[3]) < 1 || Number(match[3]) > 65535))) {
      throw new Error('TURN_URLS muss gueltige, komma-getrennte turn:/turns:-Adressen enthalten');
    }
  }
  return [...new Set(urls)];
}
export function createSignalServer({ secret, turnUrls, turnSecret } = {}) {
  if (typeof secret !== 'string' || secret.length < 12) throw new Error('ROOM_SECRET braucht mindestens 12 Zeichen');
  // Fail at startup, rather than advertising broken relay credentials to clients.
  const relayUrls = validateTurn(turnUrls, turnSecret);
  const rooms = new Map();
  const server = http.createServer(async (req, res) => {
    const route = (req.url || '').split('?')[0];
    if (route === '/health') { res.writeHead(200); return res.end('ok'); }
    const file = staticFiles.get(route === '/' ? '/index.html' : route);
    if (!file) { res.writeHead(404); return res.end('Nicht gefunden'); }
    try { const body = await readFile(fileURLToPath(file)); res.writeHead(200, { 'Content-Type': mime[file.pathname.split('.').pop()], 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; media-src 'self' blob:; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" }); res.end(body); }
    catch { res.writeHead(500); res.end('Datei fehlt'); }
  });
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
  const same = value => typeof value === 'string' && Buffer.byteLength(value) === Buffer.byteLength(secret) && timingSafeEqual(Buffer.from(value), Buffer.from(secret));
  wss.on('connection', ws => {
    ws.id = randomUUID(); ws.alive = true; ws.tokens = 100; ws.last = Date.now();
    const deadline = setTimeout(() => ws.close(4001, 'Anmeldung fehlt'), 10000);
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('message', raw => {
      if (ws.replaced) return;
      const now = Date.now(); ws.tokens = Math.min(100, ws.tokens + (now - ws.last) / 100); ws.last = now;
      if (--ws.tokens < 0) return ws.close(4008, 'Zu viele Nachrichten');
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return ws.close(4002, 'Ungueltiges JSON'); }
      if (!msg || typeof msg !== 'object') return;
      if (!ws.room) {
        if (msg.type !== 'join' || !same(msg.secret)) return ws.close(4003, 'Falscher Raumschluessel');
        if (typeof msg.room !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(msg.room) || typeof msg.name !== 'string' || !msg.name.trim() || msg.name.length > 32) return ws.close(4002, 'Raum oder Name ungueltig');
        const members = rooms.get(msg.room) || new Set();
        // Only a previously authenticated caller holding its own opaque token
        // may replace a stale socket. Never evict the other seat by name or ID.
        const previous = typeof msg.resumeToken === 'string' && msg.resumeToken.length === 43
          ? [...members].find(member => Buffer.byteLength(msg.resumeToken) === Buffer.byteLength(member.resumeToken) &&
              timingSafeEqual(Buffer.from(msg.resumeToken), Buffer.from(member.resumeToken)))
          : undefined;
        if (previous) {
          previous.replaced = true;
          members.delete(previous);
          for (const member of members) send(member, {type:'peer-left',id:previous.id});
          previous.terminate();
        }
        if (members.size >= 2) return ws.close(4004, 'Hier passen nur zwei rein');
        clearTimeout(deadline); ws.room = msg.room; ws.name = msg.name.trim();
        ws.resumeToken = previous?.resumeToken || randomBytes(32).toString('base64url');
        const iceServers = [];
        if (relayUrls.length) {
          const username = `${Math.floor(Date.now()/1000) + 86400}:${ws.id}`;
          iceServers.push({ urls: relayUrls, username, credential: createHmac('sha1', turnSecret).update(username).digest('base64') });
        }
        send(ws, { type: 'joined', id: ws.id, resumeToken: ws.resumeToken, peers: [...members].map(p => ({id:p.id,name:p.name})), iceServers, hasTurn: iceServers.length > 0 });
        for (const peer of members) send(peer, {type:'peer-joined',id:ws.id,name:ws.name});
        members.add(ws); rooms.set(msg.room, members); return;
      }
      if (msg.type === 'signal' && msg.data && typeof msg.data === 'object') {
        for (const peer of rooms.get(ws.room) || []) if (peer !== ws) send(peer, {type:'signal',from:ws.id,data:msg.data});
      }
    });
    ws.on('close', () => {
      clearTimeout(deadline); const members = rooms.get(ws.room); if (!members) return;
      if (!members.delete(ws)) return; // A replaced socket cannot remove its successor.
      for (const peer of members) send(peer,{type:'peer-left',id:ws.id});
      if (!members.size) rooms.delete(ws.room);
    });
  });
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } } }, 30000);
  heartbeat.unref(); wss.on('close', () => clearInterval(heartbeat));
  let closing;
  const close = () => {
    if (!closing) {
      clearInterval(heartbeat);
      closing = Promise.all([
        new Promise(resolve => wss.close(resolve)),
        new Promise(resolve => server.close(resolve)),
      ]).then(() => undefined);
      for (const ws of wss.clients) ws.terminate();
    }
    return closing;
  };
  return { server, wss, rooms, close };
}
