// Real loopback WebSocket/WebRTC and native Chromium audio playback. Two initial
// remote-audio play() rejections are deliberately injected; this is NOT a claim
// that Chromium's real autoplay policy rejected a previously activated page.
// Only Chromium's synthetic microphone is acquired. No camera/screen capture.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSignalServer } from '../server/signal.mjs';

const output = process.env.TEST_OUTPUT_DIR || 'test-results/audio-recovery';
const service = createSignalServer({ secret: 'audio-recovery-local-test-secret' });
await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${service.server.address().port}`;
const errors = [], steps = [], observations = {};
let browser, passed = false;

async function actor(name, blockInitialPlayback) {
  const context = await browser.newContext({ permissions: ['microphone'] });
  await context.addInitScript(({ blockInitialPlayback }) => {
    window.testPeers = [];
    const OriginalPeer = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends OriginalPeer {
      constructor(...args) { super(...args); window.testPeers.push(this); }
    };
    window.testStreams = [];
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (constraints.video || !constraints.audio) throw new Error('This test permits synthetic audio only');
      const stream = await originalGetUserMedia(constraints);
      window.testStreams.push(stream);
      return stream;
    };
    navigator.mediaDevices.getDisplayMedia = async () => { throw new Error('Screen capture forbidden in this test'); };
    window.audioProbe = { attempts: 0, rejected: 0, resolved: 0, playing: 0, notices: [], pendingSettled: 0 };
    let failuresRemaining = blockInitialPlayback ? 2 : 0;
    const nativePlay = HTMLMediaElement.prototype.play;
    const srcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      ...srcObject,
      set(stream) {
        // Prevent the autoplay attribute from independently bypassing our one
        // injected play() failures. Successful retries use the real native play().
        if (blockInitialPlayback && this.tagName === 'AUDIO') this.autoplay = false;
        srcObject.set.call(this, stream);
      }
    });
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.tagName !== 'AUDIO' || !this.srcObject) return nativePlay.apply(this, args);
      window.audioProbe.attempts++;
      if (failuresRemaining > 0) {
        failuresRemaining--;
        window.audioProbe.rejected++;
        return Promise.reject(new DOMException('Deliberately injected autoplay rejection', 'NotAllowedError'));
      }
      if (window.deferNextAudioPlay) {
        window.deferNextAudioPlay = false;
        return new Promise((resolve, reject) => {
          window.pendingAudioPlay = { resolve, reject };
        }).finally(() => { window.audioProbe.pendingSettled++; });
      }
      return nativePlay.apply(this, args).then(value => {
        window.audioProbe.resolved++;
        return value;
      });
    };
    document.addEventListener('playing', event => {
      if (event.target.tagName === 'AUDIO') window.audioProbe.playing++;
    }, true);
    document.addEventListener('DOMContentLoaded', () => {
      const notice = document.getElementById('notice');
      new MutationObserver(() => window.audioProbe.notices.push(notice.textContent))
        .observe(notice, { childList: true, characterData: true, subtree: true });
    });
  }, { blockInitialPlayback });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#server').fill(url.replace(/^http/, 'ws'));
  await page.locator('#room').fill('audio-recovery-local');
  await page.locator('#secret').fill('audio-recovery-local-test-secret');
  await page.locator('#name').fill(name);
  await page.locator('#join').click();
  return page;
}

async function state(page) {
  return page.evaluate(async () => {
    const audio = document.querySelector('audio');
    const pc = window.testPeers.at(-1);
    const stats = pc && pc.connectionState !== 'closed' ? await pc.getStats() : new Map();
    const inbound = [...stats.values()].filter(s => s.type === 'inbound-rtp' && s.kind === 'audio');
    return {
      ...window.audioProbe,
      paused: audio.paused, currentTime: audio.currentTime, streamAttached: !!audio.srcObject,
      notice: document.getElementById('notice').textContent,
      recoveryVisible: !document.getElementById('audio-help').hidden,
      recoveryEnabled: !document.getElementById('allow-audio').disabled,
      peerState: pc?.connectionState,
      inboundAudioBytes: inbound.reduce((bytes, record) => bytes + (record.bytesReceived || 0), 0),
      inboundAudio: inbound.map(({ id, bytesReceived, packetsReceived }) => ({ id, bytesReceived, packetsReceived })),
      localTracks: window.testStreams.flatMap(stream => stream.getTracks().map(track => track.readyState))
    };
  });
}

try {
  browser = await chromium.launch({
    headless: true, executablePath: process.env.TEST_CHROME || undefined,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--mute-audio']
  });
  observations.runtime = { browser: browser.version(), node: process.version, platform: process.platform };
  const sender = await actor('Synthetic sender', false);
  const receiver = await actor('Playback receiver', true);
  await Promise.all([sender, receiver].map(page => page.waitForFunction(
    () => document.getElementById('badge').textContent.includes('Zusammen'), {}, { timeout: 25000 })));
  await receiver.waitForFunction(() => window.audioProbe.rejected === 1);
  await sender.locator('#mic').click();
  // Playwright waitForFunction does not await an async predicate before checking
  // its truthiness. Poll in Node so a Promise cannot count as received RTP.
  const audioDeadline = Date.now() + 20000;
  do {
    observations.blocked = await state(receiver);
    if (observations.blocked.inboundAudioBytes > 500) break;
    await delay(100);
  } while (Date.now() < audioDeadline);
  assert.equal(observations.blocked.rejected, 1);
  assert.equal(observations.blocked.resolved, 0);
  assert.equal(observations.blocked.paused, true);
  assert.equal(observations.blocked.streamAttached, true);
  assert(observations.blocked.inboundAudioBytes > 500);
  assert.equal(observations.blocked.recoveryVisible, true);
  assert.equal(observations.blocked.recoveryEnabled, true);
  assert(observations.blocked.notice.startsWith('Ihr seid verbunden.'));
  steps.push('Injected first NotAllowedError leaves native audio paused while real synthetic RTP arrives; separate recovery control survives connected notice');

  await receiver.locator('#allow-audio').click();
  await receiver.waitForFunction(() => window.audioProbe.rejected === 2 && !document.getElementById('allow-audio').disabled);
  observations.rejectedAgain = await state(receiver);
  assert.equal(observations.rejectedAgain.attempts, 2);
  assert.equal(observations.rejectedAgain.recoveryVisible, true);
  assert.equal(observations.rejectedAgain.paused, true);
  steps.push('A second injected rejection keeps the recovery button visible and usable without duplicate pointer/click retries');

  // Native button activation by keyboard; no direct call to production retry.
  await receiver.locator('#allow-audio').focus();
  await receiver.keyboard.press('Enter');
  await receiver.waitForFunction(() => {
    const audio = document.querySelector('audio');
    return window.audioProbe.resolved > 0 && window.audioProbe.playing > 0 && !audio.paused && audio.currentTime > 0;
  }, {}, { timeout: 10000 });
  observations.recovered = await state(receiver);
  assert.equal(observations.recovered.attempts, 3);
  assert.equal(observations.recovered.recoveryVisible, false);
  const previousTime = observations.recovered.currentTime;
  await receiver.waitForFunction(previous => document.querySelector('audio').currentTime > previous + 0.1, previousTime);
  steps.push('Enter activates native play(); playing event, unpaused state and advancing media time confirm recovery, and its control hides');

  await receiver.locator('#leave').click();
  await receiver.waitForFunction(() => !document.querySelector('audio').srcObject && window.testPeers.every(pc => pc.connectionState === 'closed'));
  await sender.waitForFunction(() => window.testStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
  observations.left = await state(receiver);
  assert.equal(observations.left.streamAttached, false);
  assert.equal(observations.left.recoveryVisible, false);
  assert.equal(observations.left.notice, 'Du hast das Sofa verlassen.');
  const previousAttempts = observations.left.attempts;
  await receiver.locator('#notice').click();
  const afterClick = await state(receiver);
  assert.equal(afterClick.attempts, previousAttempts);
  assert.equal(afterClick.streamAttached, false);
  observations.senderAfterLeave = await state(sender);
  assert.deepEqual(observations.senderAfterLeave.localTracks, ['ended']);
  steps.push('Leave detaches remote audio and closes peer; later clicks do not retry detached audio; sender synthetic capture ends');

  // Hold the next ontrack play promise through Leave. Settling either way must
  // not change a disconnected page. Only these race outcomes are synthetic;
  // native playback and received RTP above are independently checked.
  for (const outcome of ['reject', 'resolve']) {
    await receiver.evaluate(() => { window.deferNextAudioPlay = true; window.pendingAudioPlay = null; });
    await receiver.locator('#join').click();
    await receiver.waitForFunction(() => !!window.pendingAudioPlay && document.getElementById('badge').textContent.includes('Zusammen'));
    await receiver.locator('#leave').click();
    await receiver.waitForFunction(() => !document.querySelector('audio').srcObject && window.testPeers.every(pc => pc.connectionState === 'closed'));
    const settledBefore = await receiver.evaluate(() => window.audioProbe.pendingSettled);
    await receiver.evaluate(outcome => {
      if (outcome === 'reject') window.pendingAudioPlay.reject(new DOMException('Injected late rejection', 'NotAllowedError'));
      else window.pendingAudioPlay.resolve();
    }, outcome);
    await receiver.waitForFunction(previous => window.audioProbe.pendingSettled === previous + 1, settledBefore);
    observations[`late${outcome}`] = await state(receiver);
    assert.equal(observations[`late${outcome}`].recoveryVisible, false);
    assert.equal(observations[`late${outcome}`].streamAttached, false);
    assert.equal(observations[`late${outcome}`].notice, 'Du hast das Sofa verlassen.');
    steps.push(`An injected pending play() ${outcome} after Leave cannot revive audio controls or overwrite the disconnected notice`);
  }
  assert.deepEqual(errors, []);
  passed = true;
  console.log(steps.join('\n'));
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'audio-recovery-results.json'), JSON.stringify({
    passed, steps, observations, errors, testedAt: new Date().toISOString(),
    limitations: [
      'Two initial NotAllowedErrors and late-promise race outcomes are deliberately injected; automatic attribute playback is disabled on the receiver.',
      'Recovery uses native Chromium play() and real loopback WebRTC with a synthetic microphone.',
      'No physical microphone, camera, screen, sound-card output, remote network or packaged Electron test.'
    ]
  }, null, 2));
  await browser?.close();
  await service.close();
}
