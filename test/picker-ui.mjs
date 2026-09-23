// Real app + real signaling/WebRTC; only the desktop picker/acquisition is
// controlled to reproduce a failed or timed-out native request without capture.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createSignalServer} from '../server/signal.mjs';
const service=createSignalServer({secret:'picker-regression-local-secret'});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const port=service.server.address().port;
const errors=[];
let browser;
async function actor(name){
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    let show, rejectCapture;
    window.desktop={
      onScreens:handler=>{show=handler;},
      chooseScreen:()=>rejectCapture?.(new DOMException('User cancelled','NotAllowedError')),
      cancelScreen:()=>rejectCapture?.(new DOMException('Room left','AbortError'))
    };
    navigator.mediaDevices.getDisplayMedia=()=>new Promise((_resolve,reject)=>{
      rejectCapture=reject;
      show([{id:'test-window',name:'Synthetic test source',thumbnail:''}]);
    });
    window.rejectTestCapture=()=>rejectCapture(new DOMException('Picker timeout','NotAllowedError'));
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator('#server').fill(`ws://127.0.0.1:${port}`);
  await page.locator('#name').fill(name);await page.locator('#secret').fill('picker-regression-local-secret');
  await page.locator('#join').click();return page;
}
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME||undefined});
  const a=await actor('Picker test A'), b=await actor('Picker test B');
  await Promise.all([a,b].map(page=>page.waitForFunction(()=>document.getElementById('badge').textContent.includes('Zusammen'))));
  await a.locator('#screen').click();await a.locator('#screens').waitFor({state:'visible'});
  await a.evaluate(()=>window.rejectTestCapture());
  await a.locator('#screens').waitFor({state:'hidden'});
  assert.match(await a.locator('#notice').textContent(),/Picker timeout/);
  assert.equal(await a.locator('#screen').isEnabled(),true);
  // Retry and cancel using the visible UI; no failed request traps the dialog.
  await a.locator('#screen').click();await a.locator('#cancel-screen').click();
  await a.locator('#screens').waitFor({state:'hidden'});
  await a.waitForFunction(()=>document.getElementById('notice').textContent.includes('User cancelled'));
  await a.locator('#screen').click();await a.locator('#screens').waitFor({state:'visible'});
  // Other peer leaving while the picker is open must cancel and dismiss it.
  await b.locator('#leave').click();await a.locator('#screens').waitFor({state:'hidden'});
  await a.waitForFunction(()=>document.getElementById('peer-name').textContent==='Warte auf Gesellschaft');
  assert.equal(await a.locator('#screen').isEnabled(),false);
  assert.deepEqual(errors,[]);
  console.log('Picker UI: timeout dismisses dialog; retry/cancel works; peer leave cancels and dismisses; no media captured.');
} finally {await browser?.close();await service.close();}
