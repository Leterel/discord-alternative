import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
for (const safe of [false, true]) {
  test(`Windows startup stays in its process (${safe ? 'software' : 'default'} mode)`, async () => {
    const events = [], windows = [];
    const app = {
      getPath: () => '/test-profile',
      disableHardwareAcceleration: () => events.push('software'),
      commandLine: { appendSwitch: () => assert.fail('Unexpected graphics override') },
      whenReady: () => { events.push('ready'); return Promise.resolve(); },
      on() {}, quit: () => assert.fail('Must not quit during startup'),
    };
    class BrowserWindow {
      constructor(options) {
        windows.push(options);
        this.webContents = { setWindowOpenHandler() {}, on() {} };
      }
      loadFile(file) { events.push(file); }
      on() {}
    }
    vm.runInNewContext(source, {
      require(name) {
        if (name === 'electron') return { app, BrowserWindow, session: { defaultSession: {
          setPermissionRequestHandler() {}, setPermissionCheckHandler() {},
        } }, desktopCapturer: {}, ipcMain: {} };
        if (name === 'node:path') return { join: (...parts) => parts.join('/') };
        if (name === 'node:os') return {};
        if (name === './diagnostics.cjs') return { createDiagnostics: () => ({ record() {} }) };
        if (name === './capture.cjs') return { installCaptureHandler() {} };
        assert.fail(`Unexpected dependency during startup: ${name}`);
      },
      process: { platform: 'win32', argv: safe ? ['electron', '--sofa-gpu-safe'] : ['electron'], env: {}, on() {} },
      __dirname: '/desktop',
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(windows.length, 1);
    assert.equal(windows[0].webPreferences.sandbox, true);
    assert.deepEqual(events, [...(safe ? ['software'] : []), 'ready', '/desktop/../public/index.html']);
  });
}
