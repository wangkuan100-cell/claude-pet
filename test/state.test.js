import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CLAUDE_PET_HOME = dir;
  return dir;
}

test('defaultPet is an unadopted egg', async () => {
  freshHome();
  const { defaultPet } = await import('../src/state.js?1');
  const p = defaultPet('2026-05-28T00:00:00Z');
  assert.equal(p.species, null);
  assert.equal(p.level, 1);
  assert.equal(p.stage, 'egg');
  assert.equal(p.xp, 0);
  assert.equal(p.mood, 80);
});

test('savePet then loadPet round-trips', async () => {
  freshHome();
  const { defaultPet, savePet, loadPet } = await import('../src/state.js?2');
  const p = defaultPet('2026-05-28T00:00:00Z');
  p.xp = 123;
  savePet(p);
  assert.equal(loadPet().xp, 123);
});

test('loadPet returns a default when no file exists', async () => {
  freshHome();
  const { loadPet } = await import('../src/state.js?3');
  assert.equal(loadPet().xp, 0);
});
