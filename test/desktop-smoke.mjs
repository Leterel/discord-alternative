import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve(process.env.TEST_OUTPUT_DIR||'test-results/desktop-smoke');
await mkdir(output,{recursive:true});
const profile=await mkdtemp(path.join(output,'profile-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const gpuSafe=process.platform==='win32'&&process.env.TEST_DESKTOP_EXE?['--sofa-gpu-safe','--disable-gpu','--disable-gpu-compositing','--use-angle=swiftshader']:[];
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
  await page.screenshot({path:path.join(output,'desktop.png')});
  console.log('Electron window loads; preload bridge available; Node integration disabled.');
}finally{await application.close();}
