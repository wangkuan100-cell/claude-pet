import fs from 'node:fs';
import path from 'node:path';
import { baseDir } from '../src/state.js';

// widget.json holds the widget's UI state: window position { x, y } and a
// `prefs` object (feature toggles). Reads/writes are read-modify-write so
// saving one part never clobbers the other.
const posPath = () => path.join(baseDir(), 'widget.json');

function readAll() {
  try {
    const obj = JSON.parse(fs.readFileSync(posPath(), 'utf8'));
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  const file = posPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}

export function loadPos() {
  const p = readAll();
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
}

export function savePos(pos) {
  const x = Array.isArray(pos) ? pos[0] : pos.x;
  const y = Array.isArray(pos) ? pos[1] : pos.y;
  const all = readAll();
  all.x = x;
  all.y = y;
  writeAll(all);
}

export function loadPrefs() {
  const p = readAll();
  return p.prefs && typeof p.prefs === 'object' ? p.prefs : {};
}

export function savePrefs(prefs) {
  const all = readAll();
  all.prefs = { ...(all.prefs || {}), ...prefs };
  writeAll(all);
}
