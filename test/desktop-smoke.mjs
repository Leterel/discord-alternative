import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const application=await electron.launch({args:process.env.TEST_DESKTOP_EXE?[]:['.'],executablePath:process.env.TEST_DESKTOP_EXE||undefined,env,timeout:30000});
try{
  application.context().setDefaultTimeout(15000);
  const page=await application.firstWindow();await page.locator('h1').waitFor();
  assert.match(await page.title(),/SofaFunk/);
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>window.desktop.platform),process.platform);
  assert.equal(await page.evaluate(()=>typeof window.desktop.cancelScreen),'function');
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/desktop.png'});
  console.log('Electron window loads; preload bridge available; Node integration disabled.');
}finally{await application.close();}
