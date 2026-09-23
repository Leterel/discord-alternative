// Real WebSocket + WebRTC integration. Synthetic camera/microphone/screen
// sources keep this test independent of personal devices and desktop content.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createSignalServer } from '../server/signal.mjs';
const turnUrls=process.env.TEST_TURN_URLS;
const turnSecret=process.env.TEST_TURN_SECRET;
if (Boolean(turnUrls)!==Boolean(turnSecret)) throw new Error('Set both TEST_TURN_URLS and TEST_TURN_SECRET for relay verification.');
const relayTest=Boolean(turnUrls);
const outputDirectory=process.env.TEST_OUTPUT_DIR||'test-results';
await mkdir(outputDirectory,{recursive:true});
const service=createSignalServer({secret:'local-integration-test-secret',...(relayTest?{turnUrls,turnSecret}:{})});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const port=service.server.address().port;
const results=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME||undefined,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const errors=[];
async function actor(name) {
  const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:1350,height:900}});
  await context.addInitScript(({relayTest})=>{
    const Original=window.RTCPeerConnection; window.testPeers=[];
    window.RTCPeerConnection=class extends Original{constructor(...args){super(...(relayTest?[{...args[0],iceTransportPolicy:'relay'}]:args));window.testPeers.push(this);}};
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
  },{relayTest});
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
  await a.screenshot({path:path.join(outputDirectory,'offline.png'),fullPage:true});
  await Promise.all([a.locator('#join').click(),b.locator('#join').click()]);await connected(a,b);results.push('Two independent browser contexts connected through actual WebSocket signaling + WebRTC');
  await a.locator('#message').fill('ey <script>safe</script>');await a.locator('#send').click();
  await b.locator('#messages').getByText('ey <script>safe</script>',{exact:true}).waitFor();
  await b.locator('#message').fill('läuft, Mois.');await b.locator('#send').click();await a.locator('#messages').getByText('läuft, Mois.',{exact:true}).waitFor();results.push('Bidirectional data-channel chat; HTML displayed as text');
  await a.locator('#mic').click();await received(b,'audio');
  await b.locator('#mic').click();await received(a,'audio');results.push('Bidirectional real RTP audio using synthetic microphone');
  await a.locator('#camera').click();await received(b,'video');
  await b.waitForFunction(()=>document.getElementById('remote-video').videoWidth>0);results.push('Camera video decoded at peer using synthetic camera');
  await a.locator('#screen').click();await b.waitForFunction(()=>{const v=document.getElementById('remote-video');return v.videoWidth===640&&v.videoHeight===360;});results.push('Synthetic screen stream transmitted and selected over camera');
  await b.screenshot({path:path.join(outputDirectory,'connected.png'),fullPage:true});
  if (relayTest) {
    const candidatePairs=[];
    for (const [name,page] of [['Mois',a],['Kollege',b]]) {
      const pair=await page.evaluate(async()=>{
        const pc=window.testPeers.at(-1),stats=await pc.getStats();
        const transport=[...stats.values()].find(s=>s.type==='transport'&&s.selectedCandidatePairId);
        const selected=transport&&stats.get(transport.selectedCandidatePairId);
        if (!selected) throw new Error('No selected ICE pair');
        const local=stats.get(selected.localCandidateId),remote=stats.get(selected.remoteCandidateId);
        return {policy:pc.getConfiguration().iceTransportPolicy,state:selected.state,
          bytesSent:selected.bytesSent,bytesReceived:selected.bytesReceived,
          localType:local.candidateType,remoteType:remote.candidateType,
          protocol:local.protocol,relayProtocol:local.relayProtocol,
          inbound:[...stats.values()].filter(s=>s.type==='inbound-rtp').map(s=>({kind:s.kind,bytesReceived:s.bytesReceived,packetsReceived:s.packetsReceived,framesDecoded:s.framesDecoded}))};
      });
      assert.equal(pair.policy,'relay');assert.equal(pair.state,'succeeded');
      assert.equal(pair.localType,'relay');assert.equal(pair.remoteType,'relay');
      assert(pair.bytesSent>0&&pair.bytesReceived>0);
      candidatePairs.push({name,...pair});
    }
    await writeFile(path.join(outputDirectory,'relay-pairs.json'),JSON.stringify({testedAt:new Date().toISOString(),candidatePairs},null,2));
    results.push('Both selected ICE pairs are relay-to-relay through real coturn; actual bidirectional bytes and RTP received');
  }
  await a.locator('#screen').click();await a.locator('#camera').click();await a.locator('#mic').click();
  await a.waitForFunction(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));results.push('Stopped capture tracks all ended');
  await b.locator('#leave').click();await a.waitForFunction(()=>document.getElementById('peer-name').textContent==='Warte auf Gesellschaft');
  await b.waitForFunction(()=>window.testStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));results.push('Leaving stops own media and tears down peer');
  await b.locator('#join').click();await connected(a,b);
  await a.locator('#message').fill('Wieder da');await a.locator('#send').click();await b.locator('#messages').getByText('Wieder da',{exact:true}).waitFor();results.push('Rejoin establishes new functioning data channel');
  assert.deepEqual(errors,[]);console.log(results.join('\n'));
} finally {
  await writeFile(path.join(outputDirectory,'rtc-results.json'),JSON.stringify({results,errors,testedAt:new Date().toISOString(),limitations:['Synthetic capture sources; not physical devices',relayTest?'Real coturn relay; local test does not verify two home NATs or public TURN':'Loopback network; not two home NATs','Chromium engine; native screen picker and CachyOS Wayland need device checks']},null,2));
  await browser.close();await service.close();
}
