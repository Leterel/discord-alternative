const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { installCaptureHandler } = require('./capture.cjs');
const diagnosticMode = process.argv.includes('--diagnose-linux');
// Some Windows driver/Electron combinations crash while starting Chromium's
// GPU helper before the window exists. SofaFunk is a small WebRTC client and
// remains usable with software compositing; prefer a reliable launch there.
if (process.platform === 'win32') {
  // Electron may start its GPU helper before app.commandLine is evaluated.
  // Relaunch once with the flags present from process start so broken host
  // graphics DLLs cannot terminate the user's app before its window appears.
  if (!process.argv.includes('--sofa-gpu-safe')) {
    const child = spawn(process.execPath, [...process.argv.slice(1), '--sofa-gpu-safe', '--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    app.quit();
  }
  app.disableHardwareAcceleration();
  // Electron 44 can still create a GPU helper before the app window when the
  // host has a broken/missing graphics DLL. Force the software path too.
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
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
