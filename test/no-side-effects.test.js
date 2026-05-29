import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeGitRunner } from '../src/run-git.js';

test('git runner refuses mutating subcommands', () => {
  const runGit = makeGitRunner(process.cwd());
  for (const bad of ['commit', 'add', 'checkout', 'push', 'reset', 'tag']) {
    assert.throws(() => runGit([bad, '-x']), /non-read-only/);
  }
});

test('hook run leaves the project dir untouched, only writes under CLAUDE_PET_HOME', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));
  fs.writeFileSync(path.join(project, 'keep.txt'), 'original');
  const before = fs.readdirSync(project).sort();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));

  const r = spawnSync('node', ['bin/hook.js'], {
    input: JSON.stringify({
      hook_event_name: 'PostToolUse', session_id: 's1', cwd: project,
      tool_name: 'Edit', tool_input: { new_string: 'x\ny\n' }, tool_response: {},
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });

  assert.equal(r.status, 0);
  assert.deepEqual(fs.readdirSync(project).sort(), before); // no new/removed files
  assert.equal(fs.readFileSync(path.join(project, 'keep.txt'), 'utf8'), 'original'); // unchanged
  assert.ok(fs.existsSync(path.join(home, 'pet.json'))); // state written here instead
});
