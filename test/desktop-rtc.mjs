// Two actual desktop app instances with separate disposable profiles.
// No microphone, camera or screen capture is requested; tests real data channels.
import { _electron as electron } from 'playwright';
import { createSignalServer } from '../server/signal.mjs';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const output=path.resolve(process.env.TEST_OUTPUT_DIR||'test-results/desktop-rtc');
await mkdir(output,{recursive:true});
const service=createSignalServer({secret:'desktop-local-integration-secret'});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const apps=[],errors=[],steps=[];
let passed=false;
async function actor(name) {
  const profile=await mkdtemp(path.join(output,'profile-'));
  const gpuSafe=process.env.TEST_GPU_SAFE==='1'?['--sofa-gpu-safe']:[];
  const application=await electron.launch({
    args:[...gpuSafe,...(process.env.TEST_DESKTOP_EXE?[]:['.']),`--user-data-dir=${profile}`],
    executablePath:process.env.TEST_DESKTOP_EXE||undefined,env,timeout:30000
  });
  apps.push(application); application.context().setDefaultTimeout(20000);
  const page=await application.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.locator('#join').waitFor();
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>window.desktop.platform),process.platform);
  await page.locator('#server').fill(`ws://127.0.0.1:${service.server.address().port}`);
  await page.locator('#name').fill(name);
  await page.locator('#secret').fill('desktop-local-integration-secret');
  await page.locator('#join').click();return page;
}
async function connected(...pages) {
  await Promise.all(pages.map(page=>page.waitForFunction(()=>document.getElementById('badge').textContent.includes('Zusammen'),{},{timeout:25000})));
}
async function message(from,to,text) {
  await from.locator('#message').fill(text);await from.locator('#send').click();
  await to.locator('#messages').getByText(text,{exact:true}).waitFor();
}
try {
  const a=await actor('Desktop A'),b=await actor('Desktop B');await connected(a,b);
  for(const page of [a,b]) await page.waitForFunction(()=>document.getElementById('connection').dataset.route==='direct');
  steps.push('Two real desktop windows connected over WebRTC without media capture or browser permission overrides');
  await message(a,b,'Desktop A sagt ey');await message(b,a,'Desktop B ist da');
  steps.push('Bidirectional chat over real desktop data channel');
  await a.locator('#reconnect').click();await connected(a,b);
  await message(a,b,'Nach Neuverbinden angekommen');
  steps.push('Desktop reconnect creates a working new data channel');
  for(const page of [a,b]) for(const kind of ['mic','camera','screen']) assert.equal(await page.locator('#'+kind).getAttribute('aria-pressed'),'false');
  steps.push('All media controls remain off throughout the test');
  assert.deepEqual(errors,[]);passed=true;
  await a.screenshot({path:path.join(output,'desktop-connected.png')});
  console.log(steps.join('\n'));
} finally {
  await writeFile(path.join(output,'desktop-rtc-results.json'),JSON.stringify({passed,steps,errors,testedAt:new Date().toISOString(),platform:process.platform,packaged:Boolean(process.env.TEST_DESKTOP_EXE),limits:['Both clients and signaling server on same computer','No microphone, camera or screen capture tested']},null,2));
  for(const app of apps) await app.close();await service.close();
}
