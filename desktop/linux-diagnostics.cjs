const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {stat, readdir, readFile} = require('node:fs/promises');
const path = require('node:path');
const execute = promisify(execFile);

// Read-only: no getSources, no device access, no session creation and no
// D-Bus auto-activation. Only existing service properties and socket metadata.
async function diagnoseLinux({platform = process.platform, env = process.env,
  run = execute, files = {stat, readdir, readFile}} = {}) {
  if (platform !== 'linux') return {status:'unsupported', message:'Diese Diagnose ist fuer Linux gedacht.'};
  const wayland = env.XDG_SESSION_TYPE === 'wayland' || Boolean(env.WAYLAND_DISPLAY);
  const desktop = (env.XDG_CURRENT_DESKTOP || '').toLowerCase();
  const backendHint = desktop.includes('kde') ? 'xdg-desktop-portal-kde' :
    desktop.includes('gnome') ? 'xdg-desktop-portal-gnome' :
    desktop.includes('hyprland') ? 'xdg-desktop-portal-hyprland' :
    desktop.includes('sway') ? 'xdg-desktop-portal-wlr' : 'passendes ScreenCast-Backend deines Desktops';
  const runtime = env.XDG_RUNTIME_DIR;
  let pipewireSocket = false;
  if (runtime) {
    const remote = env.PIPEWIRE_REMOTE || 'pipewire-0';
    try { pipewireSocket = (await files.stat(path.posix.resolve(runtime, remote))).isSocket(); } catch {}
  }
  const dataHome = env.XDG_DATA_HOME || (env.HOME && path.posix.join(env.HOME, '.local/share'));
  const directories = [dataHome, ...(env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':')].filter(Boolean);
  const installedBackends = [];
  for (const directory of directories) {
    const folder = path.posix.join(directory, 'xdg-desktop-portal/portals');
    let names;
    try { names = await files.readdir(folder); } catch { continue; }
    for (const name of names.filter(name => /^[A-Za-z0-9_-]+\.portal$/.test(name))) {
      try {
        const descriptor = await files.readFile(path.posix.join(folder, name), 'utf8');
        const interfaces = /^Interfaces=(.*)$/m.exec(descriptor)?.[1].trim().split(';') || [];
        if (interfaces.includes('org.freedesktop.impl.portal.ScreenCast')) installedBackends.push(name.slice(0, -7));
      } catch {}
    }
  }
  async function property(name) {
    try {
      const {stdout} = await run('busctl', ['--user', '--auto-start=no', '--timeout=3', 'get-property',
        'org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop',
        'org.freedesktop.portal.ScreenCast', name], {timeout:4000, maxBuffer:8192, windowsHide:true});
      const match = /^u\s+(\d+)\s*$/.exec(stdout.trim());
      return match ? Number(match[1]) : null;
    } catch { return null; }
  }
  const version = await property('version');
  const sourceTypes = version === null ? null : await property('AvailableSourceTypes');
  const checks = [
    {id:'wayland-session', ok:wayland, detail:wayland ? 'Wayland-Umgebung erkannt.' : 'Keine Wayland-Umgebung erkannt; im Terminal der grafischen Sitzung ausfuehren.'},
    {id:'pipewire-socket', ok:pipewireSocket, detail:pipewireSocket ? 'Lokaler PipeWire-Socket vorhanden (noch kein Stream getestet).' : 'PipeWire-Socket fehlt; PipeWire in deiner Benutzersitzung pruefen.'},
    {id:'screencast-portal', ok:version !== null && version > 0 && sourceTypes !== null && (sourceTypes & 3) !== 0,
      detail:version === null ? `ScreenCast-Portal nicht erreichbar. busctl, xdg-desktop-portal und ${backendHint} pruefen. Es wurde kein Dienst gestartet.` :
        'Portal-Eigenschaften gelesen; Freigabe und Bilduebertragung sind damit noch nicht getestet.'}
  ];
  return {status:checks.every(check=>check.ok) ? 'prerequisites-present' : 'needs-attention',
    checks, portal:{version, monitor:sourceTypes === null ? null : Boolean(sourceTypes & 1), window:sourceTypes === null ? null : Boolean(sourceTypes & 2)},
    installedBackends:[...new Set(installedBackends)].sort(), backendHint,
    captureTested:false, note:'Keine Bildschirm-, Mikrofon- oder Kameraaufnahme; keine Dienst- oder Systemeinstellungen geaendert.'};
}

if (require.main === module) diagnoseLinux().then(report => {
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === 'prerequisites-present' ? 0 : 2;
}).catch(() => { console.error('Linux-Diagnose konnte nicht abgeschlossen werden.'); process.exitCode = 2; });
module.exports = {diagnoseLinux};
