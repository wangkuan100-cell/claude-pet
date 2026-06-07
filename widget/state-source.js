import fs from 'node:fs';
import path from 'node:path';
import { loadPet, loadStatus, baseDir } from '../src/state.js';

export function readState() {
  return { pet: loadPet(), status: loadStatus() };
}

function stateSignature() {
  try {
    const dir = baseDir();
    return ['pet.json', 'status.json']
      .map((name) => {
        try {
          const stat = fs.statSync(path.join(dir, name));
          return `${name}:${stat.mtimeMs}:${stat.size}`;
        } catch {
          return `${name}:missing`;
        }
      })
      .join('|');
  } catch {
    return '';
  }
}

// Watches the state dir and calls onChange(readState()) shortly after any change,
// debounced so a burst of writes collapses into one repaint. Returns a stop fn.
export function watch(onChange, { debounceMs = 40, pollMs = 100 } = {}) {
  let timer = null;
  let poller = null;
  let signature = stateSignature();
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(readState()), debounceMs);
  };
  const startPolling = () => {
    if (poller) return;
    poller = setInterval(() => {
      const next = stateSignature();
      if (next !== signature) {
        signature = next;
        fire();
      }
    }, pollMs);
  };
  let watcher;
  try {
    watcher = fs.watch(baseDir(), { persistent: true }, fire);
    watcher.on('error', () => {
      if (watcher) watcher.close();
      watcher = null;
      startPolling();
    });
    startPolling();
  } catch {
    watcher = null;
    startPolling();
  }
  return function stop() {
    clearTimeout(timer);
    if (watcher) watcher.close();
    if (poller) clearInterval(poller);
  };
}
