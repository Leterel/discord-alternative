import { createSignalServer } from './signal.mjs';
const secret = process.env.ROOM_SECRET;
if (!secret || secret.length < 12) {
  console.error('Setze ROOM_SECRET auf mindestens 12 Zeichen. Beispiel: eigene zufaellige Passphrase.');
  process.exit(1);
}
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT muss eine ganze Zahl zwischen 1 und 65535 sein.');
  process.exit(1);
}
let service;
try {
  service = createSignalServer({ secret, turnUrls: process.env.TURN_URLS, turnSecret: process.env.TURN_SECRET });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
service.server.on('error', error => {
  // Report only the error code; never echo environment credentials.
  console.error('Server konnte nicht starten: ' + error.code);
  process.exitCode = 1;
  void service.close();
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void service.close(); });
service.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log('SofaFunk bereit auf Port ' + service.server.address().port));
