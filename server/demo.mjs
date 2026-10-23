import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createSignalServer} from './signal.mjs';

// Always isolated from deployment settings: no remote bind, TURN or stored key.
export async function startLocalDemo() {
  const secret=randomBytes(32).toString('base64url');
  const service=createSignalServer({secret});
  try {
    await new Promise((resolve,reject)=>{
      service.server.once('error',reject);
      service.server.listen(0,'127.0.0.1',()=>{
        service.server.off('error',reject);resolve();
      });
    });
  } catch(error) { await service.close();throw error; }
  const port=service.server.address().port;
  return {secret,url:`http://127.0.0.1:${port}`,websocket:`ws://127.0.0.1:${port}`,close:service.close};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv.length!==2) {console.error('Keine Argumente: npm run demo');process.exitCode=1;}
  else {
    try {
      const demo=await startLocalDemo();
      console.log('SofaFunk: lokaler Testserver, nur auf diesem PC erreichbar.');
      console.log('Browser: '+demo.url);
      console.log('Serverfeld in SofaFunk: '+demo.websocket);
      console.log('Raum: ersttest');
      console.log('Frischer Testschlüssel (nur lokal verwenden): '+demo.secret);
      console.log('Zwei Browserfenster oder App-Fenster mit verschiedenen Namen verbinden.');
      console.log('Keine Kamera/Mikrofonfreigabe nötig für Text. Strg+C beendet den Test.');
      const stop=()=>{void demo.close();};
      process.once('SIGINT',stop);process.once('SIGTERM',stop);
    } catch {console.error('Lokaler Testserver konnte nicht starten.');process.exitCode=1;}
  }
}
