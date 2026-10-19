import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDiagnostics, MAX_BYTES } from '../desktop/diagnostics.cjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'sofa-diagnostics-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, log: createDiagnostics(directory), file: path.join(directory, 'lifecycle.jsonl') };
}

test('crash diagnostics store only allowed fields and read also sanitizes tampered records', t => {
  const { log, file } = fixture(t);
  assert.equal(log.record('renderer-gone', { reason: 'crashed', exitCode: -1073741795,
    url: 'wss://private.example', secret: 'room-password', message: 'private-chat' }), true);
  assert.equal(log.record('room-password'), false);
  const text = readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /private|password|secret|url|message/);
  assert.equal(log.read()[0].exitCode, -1073741795);
  writeFileSync(file, text.trimEnd() + ',broken\n' + text.replace('"reason":"crashed"', '"reason":"private-chat","message":"secret"'));
  const entries = log.read();
  assert.equal(entries.length, 1);
  assert.doesNotMatch(JSON.stringify(entries), /private|secret/);
});

test('diagnostics rotate bounded files and report only the last 100 events', t => {
  const { log, file } = fixture(t);
  writeFileSync(file, ' '.repeat(MAX_BYTES));
  assert.equal(log.record('started'), true);
  assert.equal(readFileSync(file + '.previous', 'utf8').length, MAX_BYTES);
  for (let i = 0; i < 120; i++) log.record('child-gone', { type: 'GPU', reason: 'crashed', exitCode: i });
  assert.equal(log.read().length, 100);
  assert.equal(log.read().at(-1).exitCode, 119);
});

test('unwritable diagnostics never throw or prevent application startup', t => {
  const { directory } = fixture(t);
  const blocked = path.join(directory, 'file');
  writeFileSync(blocked, 'not a directory');
  const log = createDiagnostics(blocked);
  assert.equal(log.record('started'), false);
  assert.deepEqual(log.read(), []);
});
