const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('node:path');
const { installCaptureHandler } = require('./capture.cjs');
const diagnosticMode = process.argv.includes('--diagnose-linux');
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
  if (diagnosticMode) return;
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(wc === main?.webContents && ['media','display-capture'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => wc === main?.webContents && ['media','display-capture'].includes(permission));
  main = new BrowserWindow({width:1280,height:850,minWidth:840,minHeight:660,backgroundColor:'#101216',title:'SofaFunk',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  installCaptureHandler({session:session.defaultSession, ipcMain, desktopCapturer, window:main, wayland:process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland'});
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.webContents.on('will-navigate', event=>event.preventDefault());
  main.loadFile(path.join(__dirname,'../public/index.html'));
});
app.on('window-all-closed',()=>app.quit());
