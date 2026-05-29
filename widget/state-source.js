import fs from 'node:fs';
import { loadPet, loadStatus, baseDir } from '../src/state.js';

export function readState() {
  return { pet: loadPet(), status: loadStatus() };
}

// Watches the state dir and calls onChange(readState()) shortly after any change,
// debounced so a burst of writes collapses into one repaint. Returns a stop fn.
export function watch(onChange, { debounceMs = 40 } = {}) {
  let timer = null;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(readState()), debounceMs);
  };
  let watcher;
  try {
    watcher = fs.watch(baseDir(), { persistent: true }, fire);
  } catch {
    watcher = null; // dir may not exist yet; caller can retry later
  }
  return function stop() {
    clearTimeout(timer);
    if (watcher) watcher.close();
  };
}
