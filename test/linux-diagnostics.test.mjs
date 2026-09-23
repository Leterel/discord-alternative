import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseLinux} from '../desktop/linux-diagnostics.cjs';

function fixture(overrides={}) {
  const calls=[];
  const options={platform:'linux',env:{XDG_SESSION_TYPE:'wayland',XDG_CURRENT_DESKTOP:'KDE',XDG_RUNTIME_DIR:'/run/user/test'},
    files:{stat:async()=>({isSocket:()=>true}),readdir:async()=>['kde.portal','gtk.portal'],readFile:async name=>
      `[portal]\nInterfaces=org.freedesktop.impl.portal.${name.endsWith('kde.portal')?'ScreenCast;':'FileChooser;'}\n`},
    run:async(program,args,limits)=>{calls.push({program,args,limits});return {stdout:args.at(-1)==='version'?'u 5\n':'u 3\n'};}, ...overrides};
  return {options,calls};
}

test('Linux check reports available portal capabilities without opening a capture or activating a service',async()=>{
  const f=fixture(); const report=await diagnoseLinux(f.options);
  assert.equal(report.status,'prerequisites-present'); assert.equal(report.captureTested,false);
  assert.deepEqual(report.installedBackends,['kde']); assert.equal(report.portal.window,true);
  assert.equal(report.backendHint,'xdg-desktop-portal-kde');
  assert.equal(f.calls.length,2);
  for(const call of f.calls){
    assert.equal(call.program,'busctl'); assert.ok(call.args.includes('--auto-start=no'));
    assert.ok(call.args.includes('get-property')); assert.equal(call.limits.timeout,4000);
    assert.ok(!call.args.some(arg=>/CreateSession|SelectSources|Start|OpenPipeWireRemote/.test(arg)));
  }
  assert.ok(!JSON.stringify(report).includes('/run/user/test'));
});

test('missing services produce actionable incomplete status without leaking command errors',async()=>{
  const f=fixture({run:async()=>{throw new Error('private session bus path /run/user/123');},
    files:{stat:async()=>{throw new Error('missing');},readdir:async()=>[]}});
  const report=await diagnoseLinux(f.options);
  assert.equal(report.status,'needs-attention'); assert.equal(report.portal.version,null);
  assert.ok(report.checks.find(c=>c.id==='screencast-portal').detail.includes('xdg-desktop-portal-kde'));
  assert.ok(!JSON.stringify(report).includes('/run/user/123'));
});

test('a live portal without ScreenCast sources does not pass readiness',async()=>{
  const f=fixture({run:async()=>({stdout:'u 0\n'})});
  const report=await diagnoseLinux(f.options); assert.equal(report.status,'needs-attention');
  assert.equal(report.checks.find(c=>c.id==='screencast-portal').ok,false);
});

test('monitor-only portal is reported honestly and WAYLAND_DISPLAY supports unset session type',async()=>{
  const f=fixture({env:{WAYLAND_DISPLAY:'wayland-1',XDG_CURRENT_DESKTOP:'sway',XDG_RUNTIME_DIR:'/runtime'},run:async()=>({stdout:'u 1'})});
  const report=await diagnoseLinux(f.options);
  assert.equal(report.status,'prerequisites-present'); assert.equal(report.portal.window,false);
  assert.equal(report.portal.monitor,true); assert.equal(report.backendHint,'xdg-desktop-portal-wlr');
});

test('malformed D-Bus replies are unknown, and other operating systems execute nothing',async()=>{
  const f=fixture({run:async()=>({stdout:'not a property'})});
  assert.equal((await diagnoseLinux(f.options)).status,'needs-attention');
  const other=fixture({platform:'win32'}); assert.equal((await diagnoseLinux(other.options)).status,'unsupported');
  assert.equal(other.calls.length,0);
});
