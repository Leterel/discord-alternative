// A pending picker belongs to one renderer and completes exactly once, even
// when the room/window closes while the native source enumeration is pending.
function installCaptureHandler({session, ipcMain, desktopCapturer, window, wayland, timeoutMs = 60000}) {
  const contents = window.webContents;
  let pending = null, sequence = 0;
  const owned = event => event.sender === contents && event.senderFrame === contents.mainFrame;
  const cancel = () => pending?.finish({});
  const choose = (event, choice) => {
    if (!owned(event) || !pending || choice?.requestId !== pending.id) return;
    const source = pending.sources.find(item => item.id === choice.id);
    pending.finish(source ? {video:source} : {});
  };
  const cancelFromRenderer = event => { if (owned(event)) cancel(); };
  ipcMain.on('screen-choice', choose);
  ipcMain.on('screen-cancel', cancelFromRenderer);
  contents.on('did-start-navigation', cancel);
  contents.on('render-process-gone', cancel);
  window.once('closed', () => {
    cancel();
    ipcMain.removeListener('screen-choice', choose);
    ipcMain.removeListener('screen-cancel', cancelFromRenderer);
    contents.removeListener('did-start-navigation', cancel);
    contents.removeListener('render-process-gone', cancel);
  });
  session.setDisplayMediaRequestHandler(async (request, callback) => {
    if (contents.isDestroyed() || request.frame !== contents.mainFrame || !request.videoRequested) return callback({});
    cancel();
    const current = {id:++sequence, sources:[], finished:false};
    current.finish = result => {
      if (current.finished) return;
      current.finished = true;
      clearTimeout(current.timer);
      if (pending === current) pending = null;
      callback(result);
    };
    pending = current;
    current.timer = setTimeout(() => current.finish({}), timeoutMs);
    try {
      current.sources = await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:320,height:180}});
      if (current.finished) return;
      if (contents.isDestroyed() || !current.sources.length) return current.finish({});
      // PipeWire has already asked the user to select a source through the
      // desktop portal. It returns exactly one selected source. A Wayland
      // environment variable alone does not prove a portal was used: XWayland
      // or an explicit Ozone override can return a normal list instead.
      if (wayland && current.sources.length === 1) return current.finish({video:current.sources[0]});
      contents.send('screen-options', {
        requestId:current.id,
        sources:current.sources.map(source => ({id:source.id, name:source.name, thumbnail:source.thumbnail.toDataURL()}))
      });
    } catch { current.finish({}); }
  }, {useSystemPicker:true});
}
module.exports = {installCaptureHandler};
