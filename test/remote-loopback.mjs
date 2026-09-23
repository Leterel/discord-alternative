// Exercise the external-server client path against a separate loopback server.
// The real TURN relay must already be running (see turn-relay.sh --external).
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createSignalServer} from '../server/signal.mjs';
import {checkServer} from '../deploy/check-server.mjs';

const secret=randomBytes(32).toString('hex');
if (!process.env.TEST_TURN_URLS || !process.env.TEST_TURN_SECRET) throw new Error('Start with bash test/turn-relay.sh --external.');
const service=createSignalServer({secret,turnUrls:process.env.TEST_TURN_URLS,turnSecret:process.env.TEST_TURN_SECRET});
await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));
try {
  const url=`ws://127.0.0.1:${service.server.address().port}`;
  const report=await checkServer({url,secret});
  const env={...process.env,TEST_SERVER_URL:url,TEST_ROOM_SECRET:secret};
  delete env.TEST_TURN_URLS;delete env.TEST_TURN_SECRET;
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['test/rtc.mjs'],{env,stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('exit',code=>resolve(code??1));
  });
  if (code!==0) throw new Error('RTC client against separate loopback server failed.');
  await writeFile(path.join(env.TEST_OUTPUT_DIR||'test-results','server-check.json'),JSON.stringify({...report,environment:'separate loopback server; not public TLS or two home networks',testedAt:new Date().toISOString()},null,2));
  console.log('External-server client path and server checker passed against separate local server and real TURN.');
} finally {await service.close();}
