import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runHook(home, payload) {
  const r = spawnSync('node', ['bin/hook.js'], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });
  return r;
}

test('PostToolUse Write event adds line XP to pet.json and exits 0', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = runHook(home, {
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    cwd: home, // a dir that is not a git repo; snapshot stays read-only
    tool_name: 'Write',
    tool_input: { file_path: path.join(home, 'new.js'), content: 'a\nb\nc\n' },
    tool_response: {},
  });
  assert.equal(r.status, 0);
  const pet = JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8'));
  assert.ok(pet.xp > 0);
  assert.equal(pet.lifetime.linesAdded, 3);
});

test('SessionStart bumps session count and exits 0', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = runHook(home, { hook_event_name: 'SessionStart', session_id: 's1', cwd: home, source: 'startup' });
  assert.equal(r.status, 0);
  const pet = JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8'));
  assert.equal(pet.lifetime.sessions, 1);
});

test('malformed stdin still exits 0 (never blocks Claude)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = spawnSync('node', ['bin/hook.js'], {
    input: 'not json',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });
  assert.equal(r.status, 0);
});
