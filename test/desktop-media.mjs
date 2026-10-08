// Two real desktop processes and real WebRTC/RTP, with generated media only.
// This deliberately does not exercise hardware devices or the native picker.
import { _electron as electron } from 'playwright';
import { createSignalServer } from '../server/signal.mjs';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const output = path.resolve(process.env.TEST_OUTPUT_DIR || 'test-results/desktop-media');
await mkdir(output, { recursive: true });
const service = createSignalServer({ secret: 'desktop-generated-media-test-secret' });
await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const applications = [], steps = [], receipts = [], errors = [], runtimes = [];
let passed = false;

async function actor(name) {
  const profile = await mkdtemp(path.join(output, 'profile-'));
  const application = await electron.launch({
    executablePath: process.env.TEST_DESKTOP_EXE || undefined,
    args: [...(process.env.TEST_DESKTOP_EXE ? [] : ['.']), `--user-data-dir=${profile}`],
    env, timeout: 30000,
  });
  applications.push(application);
  application.context().setDefaultTimeout(20000);
  const page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#join').waitFor();
  runtimes.push(await application.evaluate(({ app, BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.setAudioMuted(true);
    return { version: app.getVersion(), packaged: app.isPackaged, appPath: app.getAppPath(),
      electron: process.versions.electron, chromium: process.versions.chrome };
  }));
  assert.equal(path.resolve(await application.evaluate(({ app }) => app.getPath('userData'))), profile);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');

  // Install generators before joining. No original capture method is retained
  // or called, and permissions are not granted by the automation framework.
  await page.evaluate(() => {
    window.generatedStreams = [];
    window.mediaPeers = [];
    const NativePeer = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeer {
      constructor(...args) { super(...args); window.mediaPeers.push(this); }
    };
    function retain(stream, cleanup) {
      window.generatedStreams.push(stream);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        let stopped = false;
        track.stop = () => { stop(); if (!stopped) { stopped = true; cleanup(); } };
      }
      return stream;
    }
    function video(width, height, label) {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      let frame = 0;
      const paint = () => {
        context.fillStyle = frame++ % 2 ? '#9abf8c' : '#6b69b8';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#101216';
        context.fillText(`${label} ${frame}`, 20, 40);
      };
      paint();
      const timer = setInterval(paint, 100);
      return retain(canvas.captureStream(10), () => clearInterval(timer));
    }
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (constraints.audio && !constraints.video) {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        const oscillator = context.createOscillator();
        oscillator.frequency.value = 440;
        oscillator.connect(destination); // Never connects to a speaker output.
        oscillator.start();
        await context.resume();
        return retain(destination.stream, () => { oscillator.stop(); void context.close(); });
      }
      if (constraints.video && !constraints.audio) return video(320, 180, 'Generated camera');
      throw new Error('Unsupported synthetic media request; hardware capture forbidden');
    };
    navigator.mediaDevices.getDisplayMedia = async () => video(640, 360, 'Generated screen');
  });
  await page.locator('#server').fill(`ws://127.0.0.1:${service.server.address().port}`);
  await page.locator('#room').fill('desktop-generated-media');
  await page.locator('#name').fill(name);
  await page.locator('#secret').fill('desktop-generated-media-test-secret');
  await page.locator('#join').click();
  return page;
}

async function connected(...pages) {
  await Promise.all(pages.map(page => page.waitForFunction(
    () => document.getElementById('badge').textContent.includes('Zusammen'), {}, { timeout: 25000 })));
}

async function receive(page, kind, stage) {
  const deadline = performance.now() + 20000;
  do {
    // Await getStats in Node. A Promise itself must never count as RTP evidence.
    const receipt = await page.evaluate(async kind => {
      const stats = await window.mediaPeers.at(-1).getStats();
      const record = [...stats.values()].find(record => record.type === 'inbound-rtp'
        && record.kind === kind && record.bytesReceived > 500
        && (kind !== 'video' || record.framesDecoded > 0));
      return record ? { kind, bytesReceived: record.bytesReceived, packetsReceived: record.packetsReceived,
        ...(kind === 'video' ? { framesDecoded: record.framesDecoded } : {}) } : null;
    }, kind);
    if (receipt) { receipts.push({ stage, ...receipt }); return; }
    await delay(100);
  } while (performance.now() < deadline);
  throw new Error(`No verified ${kind} RTP at ${stage}`);
}

async function allStopped(page) {
  await page.waitForFunction(() => window.generatedStreams.length > 0
    && window.generatedStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
  for (const kind of ['mic', 'camera', 'screen']) {
    assert.equal(await page.locator(`#${kind}`).getAttribute('aria-pressed'), 'false');
  }
}

try {
  const a = await actor('Generated A'), b = await actor('Generated B');
  await connected(a, b);
  for (const page of [a, b]) await page.waitForFunction(() => document.getElementById('connection').dataset.route === 'direct');
  steps.push('Two actual desktop instances connected directly with separate profiles');

  await a.locator('#mic').click(); await receive(b, 'audio', 'A to B');
  await b.locator('#mic').click(); await receive(a, 'audio', 'B to A');
  steps.push('Generated audio transported over real RTP in both directions; desktop output muted');
  await a.locator('#camera').click(); await receive(b, 'video', 'camera A to B');
  await b.waitForFunction(() => document.getElementById('remote-video').videoWidth === 320);
  steps.push('Generated camera decoded at the other desktop instance');
  await a.locator('#screen').click();
  await b.waitForFunction(() => {
    const video = document.getElementById('remote-video');
    return video.videoWidth === 640 && video.videoHeight === 360 && video.currentTime > 0;
  });
  steps.push('Generated screen transmitted alongside camera and selected for display');
  await a.locator('#screen').click();
  await b.waitForFunction(() => document.getElementById('remote-video').videoWidth === 320);
  steps.push('Stopping screen sharing restores the still-active camera');

  await a.locator('#screen').click();
  const previous = await a.evaluate(() => window.mediaPeers.length);
  await a.locator('#reconnect').click();
  await a.waitForFunction(count => window.mediaPeers.length > count, previous);
  await connected(a, b); await allStopped(a); await allStopped(b);
  steps.push('Reconnect stops all generated tracks on both clients and creates a fresh connection');
  await a.locator('#message').fill('Desktop-Medien neu verbunden');
  await a.locator('#send').click();
  await b.locator('#messages').getByText('Desktop-Medien neu verbunden', { exact: true }).waitFor();
  await b.locator('#mic').click(); await receive(a, 'audio', 'after reconnect B to A');
  steps.push('Chat and newly enabled audio work after reconnect');
  await b.locator('#leave').click(); await allStopped(b);
  await a.waitForFunction(() => document.getElementById('peer-name').textContent === 'Warte auf Gesellschaft');
  steps.push('Leaving stops remaining generated media and clears peer state');
  assert.deepEqual(errors, []);
  passed = true;
  console.log(steps.join('\n'));
} finally {
  await writeFile(path.join(output, 'desktop-media-results.json'), `${JSON.stringify({
    passed, steps, receipts, errors, runtimes, testedAt: new Date().toISOString(), platform: process.platform,
    limitations: ['Both clients and server on one computer', 'Generated media only; no physical microphone or camera',
      'Native screen picker and Wayland portal not exercised', 'Public TLS/TURN and two home networks not tested'],
  }, null, 2)}\n`);
  await Promise.allSettled(applications.map(application => application.close()));
  await service.close();
}
