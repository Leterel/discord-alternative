const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('node:path');
const { installCaptureHandler } = require('./capture.cjs');
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
let main;
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(wc === main?.webContents && ['media','display-capture'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => wc === main?.webContents && ['media','display-capture'].includes(permission));
  main = new BrowserWindow({width:1280,height:850,minWidth:840,minHeight:660,backgroundColor:'#101216',title:'SofaFunk',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  installCaptureHandler({session:session.defaultSession, ipcMain, desktopCapturer, window:main, wayland:process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland'});
  main.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  main.webContents.on('will-navigate', event=>event.preventDefault());
  main.loadFile(path.join(__dirname,'../public/index.html'));
});
app.on('window-all-closed',()=>app.quit());
