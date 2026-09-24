// Actual HTTP/WebSocket endpoints; only browser time is advanced for deadlines.
import http from 'node:http';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright';
import { createSignalServer } from '../server/signal.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = process.env.TEST_OUTPUT_DIR || 'test-results/connection';
const service = createSignalServer({ secret: 'connection-ui-test-secret' });
const stalled = http.createServer();
const wss = new WebSocketServer({ noServer: true });
const rawSockets = new Set();
let mode = 'handshake', upgrades = 0, joins = 0, browser, passed = false;
const errors = [], steps = [];
stalled.on('upgrade', (request, socket, head) => {
  upgrades++; rawSockets.add(socket); socket.on('close', () => rawSockets.delete(socket));
  if (mode === 'auth') wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request);
    ws.on('message', () => joins++); // Accept transport, never acknowledge login.
  });
});
await Promise.all([service.server, stalled].map(server => new Promise(resolve => server.listen(0,'127.0.0.1',resolve))));
const url = `http://127.0.0.1:${service.server.address().port}`;
const signalUrl = url.replace(/^http/,'ws');
const stalledUrl = `ws://127.0.0.1:${stalled.address().port}`;
async function until(predicate) {
  for (let i=0;i<100;i++) { if(predicate()) return; await new Promise(resolve=>setTimeout(resolve,20)); }
  throw new Error('Test endpoint did not receive expected browser request');
}
try {
  browser = await chromium.launch({ headless:true, executablePath:process.env.TEST_CHROME||undefined });
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror', error=>errors.push(error.message));
  await page.clock.install();
  await page.goto(url);
  await page.locator('#secret').fill('connection-ui-test-secret');
  await page.locator('#server').fill(stalledUrl);
  await page.locator('#join').click(); await until(()=>upgrades===1);
  await page.clock.runFor(12001);
  await page.waitForFunction(()=>!document.getElementById('join').disabled);
  assert.match(await page.locator('#notice').textContent(), /Server antwortet nicht/);
  assert.equal(await page.locator('#leave').isDisabled(),true);
  steps.push('WebSocket handshake timeout releases join controls');

  mode='auth'; await page.locator('#join').click(); await until(()=>joins===1);
  await page.clock.runFor(12001);
  await page.waitForFunction(()=>!document.getElementById('join').disabled);
  assert.match(await page.locator('#notice').textContent(), /bestätigt die Anmeldung nicht/);
  steps.push('Open socket without joined acknowledgement times out and can retry');

  await page.locator('#join').click(); await until(()=>joins===2);
  await page.locator('#leave').click(); await page.clock.runFor(25000);
  assert.equal(await page.locator('#notice').textContent(),'Du hast das Sofa verlassen.');
  steps.push('Leaving cancels pending deadline; no stale timeout overwrites status');

  await page.locator('#server').fill(signalUrl);
  await page.locator('#secret').fill('wrong-room-key-for-test');
  await page.locator('#join').click();
  await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Raumschlüssel stimmt nicht'));
  assert.equal(await page.locator('#join').isEnabled(),true);
  steps.push('Actual rejected authentication gives clear retryable error');

  await page.locator('#secret').fill('connection-ui-test-secret');
  await page.locator('#join').click(); await page.locator('#setup').waitFor({state:'hidden'});
  await page.clock.runFor(25000);
  assert.equal(await page.locator('#setup').isHidden(),true);
  assert.equal(await page.locator('#reconnect').isEnabled(),true);
  assert.match(await page.locator('#relay-hint').textContent(), /keinen TURN/);
  await page.locator('summary').click();
  await mkdir(output,{recursive:true}); await page.screenshot({path:path.join(output,'connection-help.png'),fullPage:true});
  steps.push('Successful retry cancels deadline and shows missing relay configuration honestly');
  assert.deepEqual(errors,[]); passed=true;
  console.log(steps.join('\n'));
} finally {
  await mkdir(output,{recursive:true});
  await writeFile(path.join(output,'connection-ui-results.json'),JSON.stringify({passed,steps,errors,testedAt:new Date().toISOString(),scope:'Real loopback HTTP/WebSocket; accelerated browser deadline timers; no media capture'},null,2));
  await browser?.close(); for(const socket of rawSockets) socket.destroy();
  for(const client of wss.clients) client.terminate();
  await Promise.all([service.close(), new Promise(resolve=>stalled.close(resolve)),new Promise(resolve=>wss.close(resolve))]);
}
