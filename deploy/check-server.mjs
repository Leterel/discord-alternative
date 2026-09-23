// Run from either friend's network. Never accepts a room key on the command line.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

export function serverEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('SERVER_URL muss wss://server.example sein.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'wss:' && !(url.protocol === 'ws:' && local)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SERVER_URL braucht WSS ohne Pfad, Zugangsdaten oder Parameter; WS ist nur auf Loopback erlaubt.');
  }
  return url;
}

function connection(url, timeoutMs) {
  const socket = new WebSocket(url, { handshakeTimeout: timeoutMs, maxPayload: 64 * 1024 });
  const queue = [];
  const waiters = new Set();
  let failure;
  const fail = error => {
    failure ||= error;
    for (const waiter of waiters) waiter.reject(failure);
    waiters.clear();
  };
  // Do not include server-supplied close reasons/errors: they may contain secrets.
  socket.on('error', () => fail(new Error('WSS-Verbindung fehlgeschlagen; DNS, TLS-Zertifikat und Reverse-Proxy pruefen.')));
  socket.on('close', code => fail(new Error(code === 4003 ? 'Raumschluessel abgelehnt.' : `WSS-Verbindung beendet (Code ${code}).`)));
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw); } catch { fail(new Error('Server lieferte ungueltiges JSON.')); return; }
    if (!message || typeof message !== 'object') return;
    for (const waiter of waiters) {
      if (waiter.predicate(message)) { waiters.delete(waiter); waiter.resolve(message); return; }
    }
    if (queue.length >= 100) { fail(new Error('Unerwartet viele Servernachrichten.')); socket.terminate(); return; }
    queue.push(message);
  });
  function next(predicate) {
    if (failure) return Promise.reject(failure);
    const index = queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const finish = callback => value => { clearTimeout(timer); waiters.delete(waiter); callback(value); };
      const waiter = { predicate, resolve: finish(resolve), reject: finish(reject) };
      const timer = setTimeout(() => waiter.reject(new Error('Zeitlimit beim Warten auf die Serverantwort.')), timeoutMs);
      waiters.add(waiter);
    });
  }
  const opened = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.terminate(); reject(new Error('Zeitlimit beim WSS-Verbindungsaufbau.')); }, timeoutMs);
    const done = callback => value => { clearTimeout(timer); socket.off('open', onOpen); socket.off('error', onError); socket.off('close', onClose); callback(value); };
    const onOpen = done(resolve);
    const onError = done(() => reject(failure || new Error('WSS-Verbindung fehlgeschlagen.')));
    const onClose = done(() => reject(failure || new Error('WSS-Verbindung vor Anmeldung beendet.')));
    socket.once('open', onOpen); socket.once('error', onError); socket.once('close', onClose);
  });
  return { opened, next, send: value => socket.send(JSON.stringify(value)), close: () => socket.terminate() };
}

function hasRelayCredentials(joined) {
  return joined.hasTurn === true && Array.isArray(joined.iceServers) && joined.iceServers.some(server => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const expiry = Number(String(server.username).split(':')[0]);
    return urls.some(url => typeof url === 'string' && /^turns?:/.test(url)) &&
      expiry > Date.now() / 1000 && typeof server.credential === 'string' && server.credential.length > 0;
  });
}

export async function checkServer({ url, secret, timeoutMs = 10000, requireTurn = true }) {
  const endpoint = serverEndpoint(url);
  if (typeof secret !== 'string' || secret.length < 12) throw new Error('ROOM_SECRET braucht mindestens 12 Zeichen.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('Zeitlimit muss zwischen 1 und 60000 ms liegen.');
  const health = new URL('/health', endpoint); health.protocol = endpoint.protocol === 'wss:' ? 'https:' : 'http:';
  try {
    const response = await fetch(health, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok || (await response.text()).trim() !== 'ok') throw new Error();
  } catch { throw new Error('Health-Check fehlgeschlagen; DNS, TLS, Caddy und Signalisierungsserver pruefen.'); }
  const clients = [];
  try {
    const room = `check_${randomUUID().replaceAll('-', '')}`;
    const first = connection(endpoint, timeoutMs); clients.push(first); await first.opened;
    first.send({ type: 'join', name: 'Servercheck A', room, secret });
    const one = await first.next(message => message.type === 'joined');
    const second = connection(endpoint, timeoutMs); clients.push(second); await second.opened;
    second.send({ type: 'join', name: 'Servercheck B', room, secret });
    const two = await second.next(message => message.type === 'joined');
    const arrival = await first.next(message => message.type === 'peer-joined');
    if (arrival.id !== two.id || !two.peers?.some(peer => peer.id === one.id)) throw new Error('Peer-Zuordnung des Servers stimmt nicht.');
    const nonce = randomUUID();
    first.send({ type: 'signal', data: { serverCheck: nonce } });
    const forward = await second.next(message => message.type === 'signal');
    if (forward.from !== one.id || forward.data?.serverCheck !== nonce) throw new Error('Signalisierung A nach B fehlgeschlagen.');
    second.send({ type: 'signal', data: { serverCheck: nonce } });
    const backward = await first.next(message => message.type === 'signal');
    if (backward.from !== two.id || backward.data?.serverCheck !== nonce) throw new Error('Signalisierung B nach A fehlgeschlagen.');
    const turnCredentials = hasRelayCredentials(one) && hasRelayCredentials(two);
    if (requireTurn && !turnCredentials) throw new Error('Server liefert keine gueltigen temporaeren TURN-Zugangsdaten. TURN_URLS und TURN_SECRET am Server pruefen.');
    return { health: true, tls: endpoint.protocol === 'wss:', authenticatedPeers: 2, bidirectionalSignaling: true, turnCredentials,
      limitations: ['Kein TURN-Datentransport getestet; dafuer den externen RTC-Test ausfuehren.', 'Kein Beweis fuer zwei Heimnetze oder native Bildschirmfreigabe.'] };
  } finally { for (const client of clients) client.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkServer({ url: process.env.SERVER_URL, secret: process.env.ROOM_SECRET });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
