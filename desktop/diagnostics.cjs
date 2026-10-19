const fs = require('node:fs');
const path = require('node:path');
const EVENTS = new Set(['started', 'ready', 'quit', 'renderer-gone', 'child-gone', 'unresponsive', 'uncaught-exception', 'unhandled-rejection']);
const REASONS = new Set(['clean-exit', 'abnormal-exit', 'killed', 'crashed', 'oom', 'launch-failed', 'integrity-failure']);
const TYPES = new Set(['GPU', 'Utility', 'Renderer', 'Zygote', 'Sandbox helper', 'Pepper Plugin', 'Pepper Plugin Broker']);
const MAX_BYTES = 64 * 1024;

// Deliberate allowlist: never serialize exception messages, renderer URLs,
// command lines, environment, chat messages or WebRTC/network addresses.
function sanitize(event, details = {}) {
  if (!EVENTS.has(event)) return null;
  const record = { time: new Date().toISOString(), event };
  if (REASONS.has(details.reason)) record.reason = details.reason;
  if (TYPES.has(details.type)) record.type = details.type;
  if (Number.isInteger(details.exitCode)) record.exitCode = details.exitCode;
  return record;
}

function createDiagnostics(directory) {
  const filename = path.join(directory, 'lifecycle.jsonl');
  function record(event, details) {
    const entry = sanitize(event, details);
    if (!entry) return false;
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      if (fs.existsSync(filename) && fs.statSync(filename).size >= MAX_BYTES) {
        fs.renameSync(filename, filename + '.previous');
      }
      fs.appendFileSync(filename, JSON.stringify(entry) + '\n', { mode: 0o600 });
      return true;
    } catch { return false; } // A full/unwritable disk must not crash the app.
  }
  function read() {
    const result = [];
    for (const file of [filename + '.previous', filename]) {
      try {
        const size = fs.statSync(file).size;
        if (size > MAX_BYTES + 1024) continue;
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          try {
            const parsed = JSON.parse(line);
            const entry = sanitize(parsed.event, parsed);
            if (entry && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(parsed.time)) {
              entry.time = parsed.time;
              result.push(entry);
            }
          } catch { /* Ignore partial writes after a hard crash. */ }
        }
      } catch { /* No events yet. */ }
    }
    return result.slice(-100);
  }
  return { record, read };
}
module.exports = { createDiagnostics, MAX_BYTES };
