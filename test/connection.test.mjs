import test from 'node:test';
import assert from 'node:assert/strict';
import { describeConnection, serverCloseMessage } from '../public/connection.mjs';

function stats(localType, remoteType, latency = .042) {
  return new Map([
    ['transport', { type: 'transport', selectedCandidatePairId: 'selected' }],
    ['selected', { type: 'candidate-pair', state: 'succeeded', localCandidateId: 'local', remoteCandidateId: 'remote', currentRoundTripTime: latency }],
    ['local', { type: 'local-candidate', candidateType: localType, address: 'private-address', usernameFragment: 'private-fragment' }],
    ['remote', { type: 'remote-candidate', candidateType: remoteType, address: 'other-private-address' }],
    ['unused', { type: 'candidate-pair', state: 'succeeded', localCandidateId: 'unusedRelay', remoteCandidateId: 'remote' }],
    ['unusedRelay', { type: 'local-candidate', candidateType: 'relay' }]
  ]);
}
test('uses selected transport, not an unused successful relay pair', () => {
  const result = describeConnection(stats('host', 'srflx'));
  assert.equal(result.kind, 'direct'); assert.equal(result.rttMs, 42);
  assert.match(result.label, /Direkt verbunden/);
  assert(!JSON.stringify(result).includes('private-'));
});
test('TURN on either side is displayed as a relay without addresses or credentials', () => {
  for (const types of [['relay','host'], ['host','relay'], ['relay','relay']]) {
    const result = describeConnection(stats(...types));
    assert.equal(result.kind, 'relay'); assert.match(result.label, /Vermittlungsserver/);
    assert(!result.label.includes('Direkt')); assert(!JSON.stringify(result).includes('private-'));
  }
});
test('missing selected pairs or candidate metadata cannot assert a direct path', () => {
  assert.equal(describeConnection(new Map()).kind, 'unknown');
  const missing = stats('host','host'); missing.delete('remote');
  assert.equal(describeConnection(missing).kind, 'unknown');
  const failed = stats('host','host'); failed.get('selected').state = 'failed';
  assert.equal(describeConnection(failed).kind, 'unknown');
});
test('legacy explicitly selected pair works, nominated-only pair is not guessed', () => {
  const legacy = stats('relay','host'); legacy.delete('transport');
  legacy.get('selected').nominated = true;
  assert.equal(describeConnection(legacy).kind, 'unknown');
  legacy.get('selected').selected = true;
  assert.equal(describeConnection(legacy).kind, 'relay');
});
test('bad RTT values are omitted, zero RTT is kept', () => {
  for (const latency of [NaN, Infinity, -1, 61, '0.1', null]) {
    const result = describeConnection(stats('host','host',latency));
    assert.equal(result.rttMs, undefined); assert(!result.label.includes('ms'));
  }
  assert.equal(describeConnection(stats('host','host',0)).rttMs, 0);
});
test('close codes give actionable messages, without trusting remote close text', () => {
  assert.match(serverCloseMessage(4003), /Raumschlüssel stimmt nicht/);
  assert.match(serverCloseMessage(4004), /genau zwei/);
  assert.match(serverCloseMessage(1006), /Serververbindung abgebrochen/);
  assert.equal(serverCloseMessage(4999), 'Verbindung zum Server beendet. Bitte erneut verbinden.');
});
