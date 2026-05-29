import { spawn as realSpawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseDir } from '../src/state.js';

const require = createRequire(import.meta.url);
const pidPath = () => path.join(baseDir(), 'widget.pid');
const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function isRunning() {
  try {
    const pid = Number(fs.readFileSync(pidPath(), 'utf8').trim());
    if (!pid) return false;
    process.kill(pid, 0); // signal 0 = liveness check; throws if dead
    return true;
  } catch { return false; }
}

export function start(deps = {}) {
  if (isRunning()) return { started: false, reason: 'already running' };
  const spawn = deps.spawn || realSpawn;
  const electronPath = deps.electronPath || require('electron');
  const child = spawn(electronPath, ['.'], { cwd: pluginRoot, detached: true, stdio: 'ignore' });
  child.unref();
  fs.mkdirSync(baseDir(), { recursive: true });
  fs.writeFileSync(pidPath(), String(child.pid));
  return { started: true, pid: child.pid };
}

export function stop() {
  try {
    const pid = Number(fs.readFileSync(pidPath(), 'utf8').trim());
    if (pid && pid !== process.pid) { try { process.kill(pid); } catch {} }
    fs.rmSync(pidPath(), { force: true });
    return { stopped: true };
  } catch { return { stopped: false }; }
}

export function ensureRunning(deps) { return isRunning() ? { started: false, reason: 'already running' } : start(deps); }
