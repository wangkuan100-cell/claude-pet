import fs from 'node:fs';
import path from 'node:path';
import { baseDir } from './state.js';

function sessionFile(id) {
  const safe = String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(baseDir(), `session-${safe}.json`);
}

export function loadSession(id) {
  try { return JSON.parse(fs.readFileSync(sessionFile(id), 'utf8')); }
  catch { return { linesXp: 0, testXp: 0, startedAt: null, failures: 0 }; }
}

export function saveSession(id, acc) {
  const file = sessionFile(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(acc));
  fs.renameSync(tmp, file);
}
