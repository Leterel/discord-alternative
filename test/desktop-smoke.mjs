import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const output=path.resolve(process.env.TEST_OUTPUT_DIR||'test-results/desktop-smoke');
await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(output,'profile-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const gpuSafe=process.env.TEST_GPU_SAFE==='1'?['--sofa-gpu-safe']:[];
const application=await electron.launch({args:[...gpuSafe,...(process.env.TEST_DESKTOP_EXE?[]:['.']),`--user-data-dir=${profile}`],executablePath:process.env.TEST_DESKTOP_EXE||undefined,env,timeout:30000});
try{
  const userData=await application.evaluate(({app})=>app.getPath('userData'));
  assert.equal(path.resolve(userData),profile);
  application.context().setDefaultTimeout(15000);
  const page=await application.firstWindow();await page.locator('h1').waitFor();
  assert.match(await page.title(),/SofaFunk/);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>window.desktop.platform),process.platform);
  assert.equal(await page.evaluate(()=>typeof window.desktop.cancelScreen),'function');
  // Simulate an Electron crash notification; no actual crash or capture needed.
  await application.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.emit('render-process-gone', {}, {
    reason: 'crashed', exitCode: -1073741795, secret: 'DO-NOT-LOG-THIS', url: 'wss://private.invalid'
  }));
  const diagnosticText=await readFile(path.join(profile,'diagnostics/lifecycle.jsonl'),'utf8');
  const diagnosticEvents=diagnosticText.trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(diagnosticEvents.some(event=>event.event==='started'));
  assert.ok(diagnosticEvents.some(event=>event.event==='ready'));
  assert.ok(diagnosticEvents.some(event=>event.event==='renderer-gone'&&event.reason==='crashed'&&event.exitCode===-1073741795));
  assert.doesNotMatch(diagnosticText,/DO-NOT-LOG-THIS|private.invalid/);
  await page.screenshot({path:path.join(output,'desktop.png')});
  console.log('Electron window loads; preload bridge available; Node integration disabled.');
}finally{await application.close();}
{
  const binary=process.env.TEST_DESKTOP_EXE||createRequire(import.meta.url)('electron');
  const result=spawnSync(binary,[...(process.env.TEST_DESKTOP_EXE?[]:['.']),`--user-data-dir=${profile}`,'--diagnose-app'],{env,encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.app,'SofaFunk');
  assert.ok(report.events.some(event=>event.event==='renderer-gone'&&event.reason==='crashed'));
  assert.ok(report.events.some(event=>event.event==='quit'));
  assert.doesNotMatch(result.stdout,/DO-NOT-LOG-THIS|private.invalid/);
  console.log('App diagnostic CLI exports sanitized lifecycle/crash events and exits successfully.');
}
