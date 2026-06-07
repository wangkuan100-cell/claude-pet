import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  delete process.env.CODE_PET_HOME;
  process.env.CLAUDE_PET_HOME = dir;
  return dir;
}

function clearPetEnv() {
  delete process.env.CODE_PET_HOME;
  delete process.env.CLAUDE_PET_HOME;
}

test('baseDir prefers CODE_PET_HOME over the legacy Claude env var', async () => {
  const codeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pet-'));
  const claudeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CODE_PET_HOME = codeHome;
  process.env.CLAUDE_PET_HOME = claudeHome;
  const { baseDir } = await import('../src/state.js?code-home');
  assert.equal(baseDir(), codeHome);
});

test('baseDir keeps an existing legacy ~/.claude-pet state before defaulting to ~/.code-pet', async () => {
  const oldHome = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-home-'));
  try {
    clearPetEnv();
    process.env.HOME = fakeHome;
    const legacyHome = path.join(fakeHome, '.claude-pet');
    fs.mkdirSync(legacyHome, { recursive: true });
    fs.writeFileSync(path.join(legacyHome, 'pet.json'), '{}');
    const { baseDir } = await import('../src/state.js?legacy-home');
    assert.equal(baseDir(), legacyHome);
  } finally {
    process.env.HOME = oldHome;
  }
});

test('baseDir defaults to ~/.code-pet when no legacy state exists', async () => {
  const oldHome = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-home-'));
  try {
    clearPetEnv();
    process.env.HOME = fakeHome;
    const { baseDir } = await import('../src/state.js?default-code-home');
    assert.equal(baseDir(), path.join(fakeHome, '.code-pet'));
  } finally {
    process.env.HOME = oldHome;
  }
});

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
