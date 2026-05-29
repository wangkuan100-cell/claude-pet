import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('session accumulator defaults to zero and round-trips', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { loadSession, saveSession } = await import('../src/session.js?1');
  assert.deepEqual(loadSession('sess-1'), { linesXp: 0, testXp: 0, startedAt: null, failures: 0 });
  saveSession('sess-1', { linesXp: 50, testXp: 0, startedAt: '2026-05-28T10:00:00Z', failures: 1 });
  assert.equal(loadSession('sess-1').linesXp, 50);
  assert.equal(loadSession('sess-2').linesXp, 0);
});
