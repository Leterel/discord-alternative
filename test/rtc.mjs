// Real WebSocket + WebRTC integration. Synthetic camera/microphone/screen
// sources keep this test independent of personal devices and desktop content.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createSignalServer } from '../server/signal.mjs';
const service=createSignalServer({secret:'local-integration-test-secret'});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const port=service.server.address().port;
const results=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME||undefined,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const errors=[];
async function actor(name) {
  const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:1350,height:900}});
  await context.addInitScript(()=>{
    const Original=window.RTCPeerConnection; window.testPeers=[];
    window.RTCPeerConnection=class extends Original{constructor(...args){super(...args);window.testPeers.push(this);}};
    window.testStreams=[];
    const originalMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await originalMedia(constraints);window.testStreams.push(stream);return stream;};
    navigator.mediaDevices.getDisplayMedia=async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const context=canvas.getContext('2d');let frame=0;
      const timer=setInterval(()=>{context.fillStyle=frame++%2?'#d4f58a':'#613ab4';context.fillRect(0,0,640,360);context.fillStyle='#111';context.fillText('Synthetic screen / '+frame,50,100);},50);
      const stream=canvas.captureStream(20);window.testStreams.push(stream);
      stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;
    };
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.locator('#server').fill(`ws://127.0.0.1:${port}`);
  await page.locator('#name').fill(name);await page.locator('#secret').fill('local-integration-test-secret');
  return {page,context};
}
async function connected(a,b){await Promise.all([a,b].map(p=>p.waitForFunction(()=>document.getElementById('badge').textContent.includes('Zusammen'),{},{timeout:25000})));}
async function received(page,kind){await page.waitForFunction(async kind=>{const stats=await window.testPeers.at(-1)?.getStats();return stats&&[...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind===kind&&s.bytesReceived>500);},kind,{timeout:20000});}
try {
  const {page:a}=await actor('Mois');const {page:b}=await actor('Kollege');
  await a.screenshot({path:'test-results/offline.png',fullPage:true});
  await Promise.all([a.locator('#join').click(),b.locator('#join').click()]);await connected(a,b);results.push('Two independent browser contexts connected through actual WebSocket signaling + WebRTC');
  await a.locator('#message').fill('ey <script>safe</script>');await a.locator('#send').click();
  await b.locator('#messages').getByText('ey <script>safe</script>',{exact:true}).waitFor();
  await b.locator('#message').fill('läuft, Mois.');await b.locator('#send').click();await a.locator('#messages').getByText('läuft, Mois.',{exact:true}).waitFor();results.push('Bidirectional data-channel chat; HTML displayed as text');
  await a.locator('#mic').click();await received(b,'audio');
  await b.locator('#mic').click();await received(a,'audio');results.push('Bidirectional real RTP audio using synthetic microphone');
  await a.locator('#camera').click();await received(b,'video');
  await b.waitForFunction(()=>document.getElementById('remote-video').videoWidth>0);results.push('Camera video decoded at peer using synthetic camera');
  await a.locator('#screen').click();await b.waitForFunction(()=>{const v=document.getElementById('remote-video');return v.videoWidth===640&&v.videoHeight===360;});results.push('Synthetic screen stream transmitted and selected over camera');
  await b.screenshot({path:'test-results/connected.png',fullPage:true});
  await a.locator('#screen').click();await a.locator('#camera').click();await a.locator('#mic').click();
  await a.waitForFunction(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));results.push('Stopped capture tracks all ended');
  await b.locator('#leave').click();await a.waitForFunction(()=>document.getElementById('peer-name').textContent==='Warte auf Gesellschaft');
  await b.waitForFunction(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));results.push('Leaving stops own media and tears down peer');
  await b.locator('#join').click();await connected(a,b);
  await a.locator('#message').fill('Wieder da');await a.locator('#send').click();await b.locator('#messages').getByText('Wieder da',{exact:true}).waitFor();results.push('Rejoin establishes new functioning data channel');
  assert.deepEqual(errors,[]);console.log(results.join('\n'));
} finally {
  await mkdir('test-results',{recursive:true});await writeFile('test-results/rtc-results.json',JSON.stringify({results,errors,testedAt:new Date().toISOString(),limitations:['Synthetic capture sources; not physical devices','Loopback network; not two home NATs','Chromium engine; native screen picker and CachyOS Wayland need device checks']},null,2));
  await browser.close();await service.close();
}
