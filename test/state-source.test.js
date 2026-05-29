import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('readState returns the current pet and status', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CLAUDE_PET_HOME = home;
  const { readState } = await import('../widget/state-source.js?1');
  // No files yet -> default pet, null status.
  const empty = readState();
  assert.equal(empty.pet.xp, 0);
  assert.equal(empty.status, null);
  // Write files -> reflected.
  fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify({ xp: 42, species: 'cat' }));
  fs.writeFileSync(path.join(home, 'status.json'), JSON.stringify({ repo: 'a/b' }));
  const s = readState();
  assert.equal(s.pet.xp, 42);
  assert.equal(s.status.repo, 'a/b');
});

test('watch invokes the callback after a file changes, and stop() cleans up', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CLAUDE_PET_HOME = home;
  fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify({ xp: 1 }));
  const { watch } = await import('../widget/state-source.js?2');
  // fs.watch can emit spurious/early events (or fire mid-write); only settle once we
  // actually observe the new value, and fail cleanly if it never arrives.
  const seen = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('watch did not fire within 3s')); }, 3000);
    const stop = watch((state) => {
      if (state.pet.xp === 2) { clearTimeout(timer); stop(); resolve(state); }
    });
    setTimeout(() => fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify({ xp: 2 })), 50);
  });
  assert.equal(seen.pet.xp, 2);
});
