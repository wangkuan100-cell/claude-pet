import fs from 'node:fs';
import path from 'node:path';
import { baseDir } from '../src/state.js';

const posPath = () => path.join(baseDir(), 'widget.json');

export function loadPos() {
  try {
    const p = JSON.parse(fs.readFileSync(posPath(), 'utf8'));
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
}

export function savePos(pos) {
  const x = Array.isArray(pos) ? pos[0] : pos.x;
  const y = Array.isArray(pos) ? pos[1] : pos.y;
  const file = posPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ x, y }));
  fs.renameSync(tmp, file);
}
