const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('node:path');
const { installCaptureHandler } = require('./capture.cjs');
const os = require('node:os');
const { createDiagnostics } = require('./diagnostics.cjs');
const diagnosticMode = process.argv.includes('--diagnose-linux');
const reportMode = process.argv.includes('--diagnose-app');
const diagnostics = createDiagnostics(path.join(app.getPath('userData'), 'diagnostics'));
if (reportMode) {
  console.log(JSON.stringify({ app: 'SofaFunk', version: app.getVersion(), platform: process.platform,
    architecture: process.arch, osRelease: os.release(), electron: process.versions.electron,
    events: diagnostics.read(), limitations: 'Keine Speicherabbilder, Gespraechsinhalte oder Netzwerkdaten; ein harter Prozessabbruch kann ohne Ereignis bleiben.' }, null, 2));
  app.exit(0);
} else if (!diagnosticMode) {
  diagnostics.record('started');
  app.on('child-process-gone', (_event, details) => diagnostics.record('child-gone', details));
  app.on('quit', (_event, exitCode) => diagnostics.record('quit', { exitCode }));
  // Observe fatal exceptions without suppressing Node/Electron's normal exit.
  process.on('uncaughtExceptionMonitor', () => diagnostics.record('uncaught-exception'));
  process.on('unhandledRejection', () => {
    diagnostics.record('unhandled-rejection');
    app.exit(1);
  });
}
// Explicit troubleshooting mode. Stay in the original process so launchers,
// installers and diagnostics observe the actual application's lifetime.
if (process.argv.includes('--sofa-gpu-safe')) {
  app.disableHardwareAcceleration();
}
if (diagnosticMode) {
  require('./linux-diagnostics.cjs').diagnoseLinux().then(report => {
    console.log(JSON.stringify(report, null, 2));
    app.exit(report.status === 'prerequisites-present' ? 0 : 2);
  }).catch(() => { console.error('Linux-Diagnose fehlgeschlagen.'); app.exit(2); });
}
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
let main;
app.whenReady().then(() => {
  if (diagnosticMode || reportMode) return;
  diagnostics.record('ready');
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(wc === main?.webContents && ['media','display-capture'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => wc === main?.webContents && ['media','display-capture'].includes(permission));
  main = new BrowserWindow({width:1280,height:850,minWidth:840,minHeight:660,backgroundColor:'#101216',title:'SofaFunk',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  installCaptureHandler({session:session.defaultSession, ipcMain, desktopCapturer, window:main, wayland:process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland'});
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.webContents.on('will-navigate', event=>event.preventDefault());
  main.webContents.on('render-process-gone', (_event, details) => diagnostics.record('renderer-gone', details));
  main.on('unresponsive', () => diagnostics.record('unresponsive'));
  main.loadFile(path.join(__dirname,'../public/index.html'));
});
app.on('window-all-closed',()=>app.quit());
