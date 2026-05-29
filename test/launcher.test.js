import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('start spawns once, writes a pidfile; isRunning detects it; stop clears it', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { start, stop, isRunning } = await import('../widget/launcher.js?1');

  assert.equal(isRunning(), false);

  const spawned = [];
  const fakeSpawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: process.pid, unref() {} }; };
  const r = start({ spawn: fakeSpawn, electronPath: '/fake/electron' });
  assert.equal(r.started, true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].cmd, '/fake/electron');
  assert.deepEqual(spawned[0].args, ['.']);
  assert.equal(spawned[0].opts.detached, true);
  // pidfile written with our live pid -> isRunning true
  assert.equal(isRunning(), true);

  // second start is a no-op while running
  const r2 = start({ spawn: fakeSpawn, electronPath: '/fake/electron' });
  assert.equal(r2.started, false);
  assert.equal(spawned.length, 1);

  stop();
  assert.equal(isRunning(), false);
});

test('isRunning is false for a stale/dead pid', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { isRunning } = await import('../widget/launcher.js?2');
  fs.writeFileSync(path.join(process.env.CLAUDE_PET_HOME, 'widget.pid'), '2147483646'); // unlikely live pid
  assert.equal(isRunning(), false);
});
