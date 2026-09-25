import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareConfig, parseConfig, validateConfig, writeConfig } from '../deploy/configure.mjs';

const addresses = { SOFA_DOMAIN: 'sofa.leterel.dev', TURN_DOMAIN: 'turn.leterel.dev',
  ACME_EMAIL: 'admin@leterel.dev', TURN_PUBLIC_IP: '8.8.8.8', TURN_LISTEN_IP: '10.1.2.3' };
// These are syntax fixtures only. No DNS, server connection or deployment occurs.
async function cleanup(directory) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.match(path.basename(resolved), /^sofa-(config|link)-/);
  await rm(resolved, { recursive: true, force: true });
}
test('deployment generates independent keys and roundtrips configuration', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sofa-config-'));
  try {
    const file = path.join(directory, '.env'); const config = prepareConfig(addresses);
    assert.match(config.ROOM_SECRET, /^[a-f0-9]{64}$/); assert.match(config.TURN_SECRET, /^[a-f0-9]{64}$/);
    assert.notEqual(config.ROOM_SECRET, config.TURN_SECRET);
    await writeConfig(config, file); const text = await readFile(file, 'utf8');
    assert.deepEqual({ ...parseConfig(text) }, config);
    if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
    await assert.rejects(writeConfig(prepareConfig(addresses), file), { code: 'EEXIST' });
    assert.equal(await readFile(file, 'utf8'), text);
  } finally { await cleanup(directory); }
});

test('deployment rejects placeholder domains, injection, invalid IPs and unsafe secrets', () => {
  const valid = prepareConfig(addresses);
  const cases = {
    SOFA_DOMAIN: ['sofa.example.net', 'localhost', 'host.local', 'https://sofa.leterel.dev', 'a.dev\nROOM_SECRET=oops', '-bad.dev', 'a..dev'],
    TURN_DOMAIN: ['turn.invalid', 'turn.test', 'turn.example.com', 'turn.leterel.dev:3478', 'a.dev;evil'],
    ACME_EMAIL: ['you@example.net', 'a@b', 'a b@leterel.dev', 'x@leterel.dev\nINJECT=x'],
    TURN_PUBLIC_IP: ['203.0.113.10', '198.51.100.8', '192.0.2.1', '10.1.2.3', '100.64.1.2', '127.0.0.1', '0.0.0.0', '224.0.0.1', '1.2.3.999', '::1'],
    TURN_LISTEN_IP: ['0.0.0.0', '127.0.0.1', '169.254.1.2', '203.0.113.10', '1.2.3.4;evil'],
    ROOM_SECRET: ['short', '${EXTERNAL}', 'a'.repeat(32) + '#comment'], TURN_SECRET: ['short', 'g'.repeat(64)],
  };
  for (const [key, values] of Object.entries(cases)) for (const value of values) {
    assert.throws(() => validateConfig({ ...valid, [key]: value }), error => !error.message.includes(value) && error.message.includes(key));
  }
  assert.throws(() => validateConfig({ ...valid, TURN_SECRET: valid.ROOM_SECRET }), /verschieden/);
});

test('manual configuration rejects duplicate and unknown fields without reflecting secrets', () => {
  const valid = prepareConfig(addresses); const text = Object.entries(valid).map(([key, value]) => `${key}=${value}`).join('\n');
  for (const suffix of ['\nROOM_SECRET=private-value', '\nUNKNOWN=private-value', '\nexport EVIL=private-value']) {
    assert.throws(() => parseConfig(text + suffix), error => !error.message.includes('private-value'));
  }
  assert.deepEqual({ ...parseConfig('# comment\r\n' + text.replaceAll('\n', '\r\n') + '\r\n') }, valid);
});

test('exclusive config creation does not follow a symlink', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sofa-link-'));
  try {
    const original = path.join(directory, 'original'); const link = path.join(directory, '.env');
    await writeFile(original, 'unchanged'); await symlink(original, link);
    await assert.rejects(writeConfig(prepareConfig(addresses), link), { code: 'EEXIST' });
    assert.equal(await readFile(original, 'utf8'), 'unchanged');
  } finally { await cleanup(directory); }
});
