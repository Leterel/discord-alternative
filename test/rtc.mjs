// Real WebSocket + WebRTC integration. Synthetic camera/microphone/screen
// sources keep this test independent of personal devices and desktop content.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSignalServer } from '../server/signal.mjs';
import { serverEndpoint } from '../deploy/check-server.mjs';
const remoteEndpoint=process.env.TEST_SERVER_URL?serverEndpoint(process.env.TEST_SERVER_URL):undefined;
const remoteSecret=process.env.TEST_ROOM_SECRET;
if (Boolean(remoteEndpoint)!==Boolean(remoteSecret)) throw new Error('Set both TEST_SERVER_URL and TEST_ROOM_SECRET for an external server test.');
if (remoteSecret&&remoteSecret.length<12) throw new Error('TEST_ROOM_SECRET must contain at least 12 characters.');
const turnUrls=process.env.TEST_TURN_URLS;
const turnSecret=process.env.TEST_TURN_SECRET;
if (Boolean(turnUrls)!==Boolean(turnSecret)) throw new Error('Set both TEST_TURN_URLS and TEST_TURN_SECRET for relay verification.');
if (remoteEndpoint&&(turnUrls||turnSecret)) throw new Error('External tests use the server-issued TURN credentials; unset TEST_TURN_URLS and TEST_TURN_SECRET.');
const relayTest=Boolean(remoteEndpoint||turnUrls);
const outputDirectory=process.env.TEST_OUTPUT_DIR||'test-results';
await mkdir(outputDirectory,{recursive:true});
const service=remoteEndpoint?undefined:createSignalServer({secret:'local-integration-test-secret',...(relayTest?{turnUrls,turnSecret}:{})});
if (service) await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
const signalUrl=remoteEndpoint?.href||`ws://127.0.0.1:${service.server.address().port}`;
const pageUrl=signalUrl.replace(/^ws/, 'http');
const room=`rtc_${randomUUID().replaceAll('-','')}`;
const results=[];
let browser, passed=false;
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
  await page.goto(pageUrl);
  await page.locator('#server').fill(signalUrl);
  await page.locator('#room').fill(room);
  await page.locator('#name').fill(name);
  // Suppress Playwright's fill call log if this field fails: it would echo the key.
  try { await page.locator('#secret').fill(remoteSecret||'local-integration-test-secret'); }
  catch { throw new Error('Could not enter room key into the app.'); }
  return {page,context};
}
async function connected(a,b){await Promise.all([a,b].map(p=>p.waitForFunction(()=>document.getElementById('badge').textContent.includes('Zusammen'),{},{timeout:25000})));}
async function received(page,kind){await page.waitForFunction(async kind=>{const stats=await window.testPeers.at(-1)?.getStats();return stats&&[...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind===kind&&s.bytesReceived>500);},kind,{timeout:20000});}
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME||undefined,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
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
  assert.deepEqual(errors,[]);passed=true;console.log(results.join('\n'));
} finally {
  await writeFile(path.join(outputDirectory,'rtc-results.json'),JSON.stringify({passed,results,errors,testedAt:new Date().toISOString(),externalServer:Boolean(remoteEndpoint),limitations:['Synthetic capture sources; not physical devices',remoteEndpoint?'Separate server and TURN path from this computer; both peers still use the same client network':relayTest?'Real coturn relay; local test does not verify two home NATs or public TURN':'Loopback network; not two home NATs','Chromium engine; native screen picker and CachyOS Wayland need device checks']},null,2));
  await browser?.close();await service?.close();
}
