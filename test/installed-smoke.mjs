import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

assert.ok([3, 4].includes(process.argv.slice(2).length), 'Pass the installed executable, isolated profile, evidence directory and optional expected version.');
const [executablePath, profile, evidence] = process.argv.slice(2, 5).map(value => path.resolve(value));
const expectedVersion = process.argv[5] ?? '0.1.2';
assert.ok(expectedVersion.length <= 32 && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(expectedVersion)
  && !/[\r\n]/.test(expectedVersion), 'Expected version must be a numeric major.minor.patch version.');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
await mkdir(evidence, { recursive: true });
// The packaged launcher hands off once on Windows so GPU flags are present
// before Electron starts Chromium. Attach directly to that safe child here.
const gpuSafe = process.platform === 'win32' ? ['--sofa-gpu-safe', '--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader'] : [];
const application = await electron.launch({ executablePath, args: [...gpuSafe, `--user-data-dir=${profile}`], env, timeout: 30000 });
try {
  application.context().setDefaultTimeout(15000);
  const page = await application.firstWindow();
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.hide()));
  await page.locator('h1').waitFor();
  const main = await application.evaluate(({ app, BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { appPath: app.getAppPath(), userData: app.getPath('userData'), version: app.getVersion(),
      nodeIntegration: preferences.nodeIntegration, contextIsolation: preferences.contextIsolation, sandbox: preferences.sandbox };
  });
  assert.equal(main.userData.toLowerCase(), profile.toLowerCase());
  assert.equal(main.appPath.toLowerCase(), path.join(path.dirname(executablePath), 'resources', 'app.asar').toLowerCase());
  assert.equal(main.version, expectedVersion);
  assert.equal(main.nodeIntegration, false);
  assert.equal(main.contextIsolation, true);
  assert.equal(main.sandbox, true);
  assert.match(await page.title(), /SofaFunk/);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => window.desktop.platform), 'win32');
  for (const method of ['onScreens', 'chooseScreen', 'cancelScreen']) {
    assert.equal(await page.evaluate(method => typeof window.desktop[method], method), 'function');
  }
  await writeFile(path.join(evidence, 'smoke.json'), `${JSON.stringify({ passed: true, ...main,
    checks: ['installed ASAR loaded', `version ${expectedVersion}`, 'isolated profile used', 'main UI loaded',
      'preload bridge present', 'Node integration disabled', 'context isolation enabled', 'renderer sandbox enabled'],
    mediaRequested: false }, null, 2)}\n`);
  console.log('PASS: installed SofaFunk main UI, isolated profile, preload bridge and renderer security. No media requested.');
} finally {
  await application.close();
}
