import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function pet(home, args, input, extraEnv = {}) {
  return spawnSync('node', ['bin/pet.js', ...args], {
    encoding: 'utf8', input: input || '',
    env: { ...process.env, CLAUDE_PET_HOME: home, ...extraEnv },
  });
}

test('adopt sets species; status prints it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  assert.equal(pet(home, ['adopt', 'dragon']).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8')).species, 'dragon');
  const out = pet(home, ['status']).stdout;
  assert.match(out, /dragon/);
  assert.match(out, /Lv\s*1/i);
});

test('adopt rejects unknown species', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = pet(home, ['adopt', 'unicorn']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown species/i);
});

test('milestone awards 300 xp', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  pet(home, ['adopt', 'phoenix']);
  pet(home, ['milestone', 'shipped v1']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8')).xp, 300);
});

test('start launches via the configured electron path; stop clears the pidfile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const start = pet(home, ['start'], '', { CLAUDE_PET_FAKE_ELECTRON: '/usr/bin/true' });
  assert.equal(start.status, 0);
  assert.match(start.stdout, /started|already running/i);
  assert.ok(fs.existsSync(path.join(home, 'widget.pid')));
  const stop = pet(home, ['stop'], '', { CLAUDE_PET_FAKE_ELECTRON: '/usr/bin/true' });
  assert.equal(stop.status, 0);
  assert.equal(fs.existsSync(path.join(home, 'widget.pid')), false);
});
