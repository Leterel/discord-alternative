// Local preparation only: no network requests, Docker commands or secret output.
import { randomBytes } from 'node:crypto';
import { isIPv4 } from 'node:net';
import { readFile, open } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const keys = ['SOFA_DOMAIN', 'TURN_DOMAIN', 'ACME_EMAIL', 'ROOM_SECRET', 'TURN_SECRET', 'TURN_PUBLIC_IP', 'TURN_LISTEN_IP'];
const defaultFile = fileURLToPath(new URL('.env', import.meta.url));
const invalid = field => { throw new Error(`${field}: ungueltiger oder fehlender Wert; siehe SERVER.md.`); };

function domain(value, field) {
  if (typeof value !== 'string' || value.length > 253 || !value.includes('.') ||
      !value.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
      !/[a-z]$/i.test(value) || /(^|\.)(localhost|local|invalid|test|example|arpa)$/i.test(value) ||
      /(^|\.)example\.(com|net|org)$/i.test(value)) invalid(field);
}

function usableIPv4(value, field, publicOnly) {
  if (!isIPv4(value ?? '')) invalid(field);
  const [a, b, c] = value.split('.').map(Number);
  if (a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)) invalid(field);
  if (publicOnly && (a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && c === 0))) invalid(field);
}

export function validateConfig(config) {
  domain(config.SOFA_DOMAIN, 'SOFA_DOMAIN'); domain(config.TURN_DOMAIN, 'TURN_DOMAIN');
  if (!/^[A-Za-z0-9.!%+_-]+@[A-Za-z0-9.-]+$/.test(config.ACME_EMAIL ?? '')) invalid('ACME_EMAIL');
  domain(config.ACME_EMAIL.split('@')[1], 'ACME_EMAIL');
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(config.ROOM_SECRET ?? '')) invalid('ROOM_SECRET');
  if (!/^[a-f0-9]{64}$/i.test(config.TURN_SECRET ?? '')) invalid('TURN_SECRET');
  if (config.ROOM_SECRET === config.TURN_SECRET) throw new Error('ROOM_SECRET und TURN_SECRET muessen verschieden sein.');
  usableIPv4(config.TURN_PUBLIC_IP, 'TURN_PUBLIC_IP', true);
  usableIPv4(config.TURN_LISTEN_IP, 'TURN_LISTEN_IP', false);
  return config;
}

export function parseConfig(text) {
  const config = Object.create(null);
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Z_]+)=([^\s#'"$`\\]*)$/.exec(line.trim());
    if (!match || !keys.includes(match[1])) throw new Error('Konfiguration erwartet nur bekannte KEY=VALUE-Zeilen ohne Anfuehrungszeichen oder Interpolation.');
    if (Object.hasOwn(config, match[1])) throw new Error(`Doppeltes Feld: ${match[1]}`);
    config[match[1]] = match[2];
  }
  return validateConfig(config);
}

export function prepareConfig(addresses) {
  return validateConfig({ ...addresses, ROOM_SECRET: randomBytes(32).toString('hex'), TURN_SECRET: randomBytes(32).toString('hex') });
}

export async function writeConfig(config, destination = defaultFile) {
  validateConfig(config);
  // Exclusive creation: a retry cannot replace live secrets or follow a symlink.
  const file = await open(destination, 'wx', 0o600);
  try {
    await file.writeFile('# Private SofaFunk server configuration. Never commit or share this file.\n' +
      keys.map(key => `${key}=${config[key]}`).join('\n') + '\n', 'utf8');
    await file.sync();
  } finally { await file.close(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    parseConfig(await readFile(defaultFile, 'utf8'));
    console.log('Konfiguration lokal gueltig. DNS, offene Ports, TLS und TURN-Datentransport sind damit noch nicht getestet.');
    return;
  }
  if (args.length) throw new Error('Aufruf: node deploy/configure.mjs [--check]');
  try { await readFile(defaultFile); throw new Error('deploy/.env existiert bereits. Es wird nichts ueberschrieben; mit --check pruefen.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!process.stdin.isTTY) throw new Error('Die Einrichtung braucht ein interaktives Terminal. Fuer vorhandene .env: --check.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const values = {};
  try {
    for (const [key, label] of [
      ['SOFA_DOMAIN', 'Domain fuer SofaFunk (ohne https://)'], ['TURN_DOMAIN', 'Domain fuer TURN'],
      ['ACME_EMAIL', 'E-Mail fuer Zertifikate'], ['TURN_PUBLIC_IP', 'Oeffentliche IPv4 des Servers'],
      ['TURN_LISTEN_IP', 'Lokale IPv4 am Server (Enter = oeffentliche IPv4)'],
    ]) values[key] = (await prompt.question(`${label}: `)).trim();
  } finally { prompt.close(); }
  values.TURN_LISTEN_IP ||= values.TURN_PUBLIC_IP;
  await writeConfig(prepareConfig(values));
  console.log('deploy/.env erstellt; zwei unterschiedliche Zufallsschluessel gespeichert, nicht ausgegeben.');
  console.log('Auf Linux Dateimodus 600. Nur ROOM_SECRET mit dem Kollegen teilen; TURN_SECRET bleibt auf dem Server.');
  console.log('Naechster Schritt auf dem Linux-Server: cd deploy; docker compose config --quiet; docker compose up -d --build');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const message = error.code === 'ENOENT' ? 'deploy/.env fehlt; zuerst die Einrichtung starten.' :
      error.code === 'EEXIST' ? 'deploy/.env existiert bereits; nichts ueberschrieben.' :
      error.code ? 'Konfigurationsdatei konnte nicht sicher gelesen oder geschrieben werden.' : error.message;
    console.error(message); process.exitCode = 1;
  });
}
