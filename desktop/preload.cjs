const {contextBridge,ipcRenderer}=require('electron');
let requestId;
contextBridge.exposeInMainWorld('desktop',{
  platform:process.platform,
  onScreens:handler=>ipcRenderer.on('screen-options',(_event,options)=>{requestId=options.requestId;handler(options.sources);}),
  chooseScreen:id=>ipcRenderer.send('screen-choice',{requestId,id:typeof id==='string'?id:null}),
  cancelScreen:()=>ipcRenderer.send('screen-cancel')
});
