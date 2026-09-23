import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installCaptureHandler} from '../desktop/capture.cjs';

const source = {id:'screen:1', name:'Test screen', thumbnail:{toDataURL:()=> 'data:image/png;base64,test'}};
function fixture(options = {}) {
  const ipcMain = new EventEmitter(), window = new EventEmitter(), contents = new EventEmitter();
  const messages = [], answers = [];
  Object.assign(contents, {mainFrame:{}, isDestroyed:()=>false, send:(...args)=>messages.push(args)});
  window.webContents = contents;
  let handler;
  installCaptureHandler({ipcMain, window, session:{setDisplayMediaRequestHandler:value=>handler=value},
    desktopCapturer:{getSources:options.getSources || (async()=>[source])}, wayland:options.wayland, timeoutMs:options.timeoutMs || 1000});
  return {ipcMain, window, contents, messages, answers,
    start:()=>handler({frame:contents.mainFrame,videoRequested:true}, value=>answers.push(value)),
    choose:(id,requestId=messages.at(-1)?.[1].requestId)=>ipcMain.emit('screen-choice',{sender:contents,senderFrame:contents.mainFrame},{requestId,id}),
    cancel:()=>ipcMain.emit('screen-cancel',{sender:contents,senderFrame:contents.mainFrame})};
}
test('capture accepts only a choice from its own main frame and only once', async()=> {
  const f=fixture(); await f.start(); const requestId=f.messages[0][1].requestId;
  f.ipcMain.emit('screen-choice',{sender:f.contents,senderFrame:{}},{requestId,id:source.id});
  assert.equal(f.answers.length,0);
  f.choose(source.id); f.choose(source.id);
  assert.deepEqual(f.answers,[{video:source}]); f.window.emit('closed');
  assert.equal(f.ipcMain.listenerCount('screen-choice'),0);
});
test('leaving during slow source enumeration cannot reopen picker or start capture', async()=> {
  let resolve; const f=fixture({getSources:()=>new Promise(done=>resolve=done)});
  const task=f.start(); f.cancel(); resolve([source]); await task;
  assert.deepEqual(f.answers,[{}]); assert.equal(f.messages.length,0); f.window.emit('closed');
});
test('a stale selection cannot complete a replacement request',async()=> {
  const f=fixture(); await f.start(); const oldId=f.messages[0][1].requestId;
  await f.start(); assert.deepEqual(f.answers,[{}]);
  f.choose(source.id,oldId); assert.equal(f.answers.length,1);
  f.choose(source.id); assert.deepEqual(f.answers,[{},{video:source}]); f.window.emit('closed');
});
test('closing the window cancels enumeration exactly once',async()=> {
  let resolve; const f=fixture({getSources:()=>new Promise(done=>resolve=done)});
  const task=f.start(); f.window.emit('closed'); resolve([source]); await task;
  assert.deepEqual(f.answers,[{}]); assert.equal(f.messages.length,0);
});
test('PipeWire uses the source already chosen in the system portal',async()=> {
  const f=fixture({wayland:true}); await f.start();
  assert.deepEqual(f.answers,[{video:source}]); assert.equal(f.messages.length,0); f.window.emit('closed');
});
test('source failure and picker timeout both reject capture',async()=> {
  const failed=fixture({getSources:async()=>{throw new Error('portal unavailable');}}); await failed.start();
  assert.deepEqual(failed.answers,[{}]); failed.window.emit('closed');
  const slow=fixture({timeoutMs:10}); await slow.start();
  await new Promise(done=>setTimeout(done,30)); assert.deepEqual(slow.answers,[{}]); slow.window.emit('closed');
});

test('Wayland environment with multiple sources still requires an explicit choice',async()=> {
  const other={...source,id:'window:2',name:'Second window'};
  const f=fixture({wayland:true,getSources:async()=>[source,other]}); await f.start();
  assert.equal(f.answers.length,0); assert.equal(f.messages[0][1].sources.length,2);
  f.choose(other.id); assert.deepEqual(f.answers,[{video:other}]); f.window.emit('closed');
});

test('a cancelled native portal returning no source never grants a screen',async()=> {
  const f=fixture({wayland:true,getSources:async()=>[]}); await f.start();
  assert.deepEqual(f.answers,[{}]); assert.equal(f.messages.length,0); f.window.emit('closed');
});

test('a late portal response after timeout cannot grant capture or disturb a new choice',async()=> {
  let resolve, calls=0;
  const f=fixture({wayland:true,timeoutMs:10,getSources:()=>++calls===1 ? new Promise(done=>resolve=done) : Promise.resolve([source])});
  const late=f.start(); await new Promise(done=>setTimeout(done,30));
  assert.deepEqual(f.answers,[{}]);
  await f.start(); resolve([source]); await late;
  assert.deepEqual(f.answers,[{},{video:source}]); assert.equal(f.messages.length,0); f.window.emit('closed');
});
