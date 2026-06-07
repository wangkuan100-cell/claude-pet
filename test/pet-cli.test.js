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

test('a fresh pet is an unhatched egg', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const out = pet(home, ['status']).stdout;
  assert.match(out, /egg/i);
  assert.match(out, /Lv\s*1/i);
});

test('milestone awards 300 xp and hatches the egg into a random species', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  pet(home, ['milestone', 'shipped v1']);
  const saved = JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8'));
  assert.equal(saved.xp, 300);
  assert.ok(saved.species); // hatched into some line, chosen at random
});

test('status shows the last activity provider when status exists', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pet-'));
  fs.writeFileSync(path.join(home, 'status.json'), JSON.stringify({
    provider: 'codex',
    cwd: home,
    repo: null,
    contextUsedPct: 12,
    sessionCostUsd: 0,
    alerts: [],
  }));
  const out = pet(home, ['status'], '', { CODE_PET_HOME: home }).stdout;
  assert.match(out, /provider:\s*codex/i);
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
