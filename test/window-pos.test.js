import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('loadPos null with no file; savePos then loadPos round-trips (array or object)', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { loadPos, savePos } = await import('../widget/window-pos.js?1');
  assert.equal(loadPos(), null);
  savePos([120, 340]); // accepts win.getPosition() array
  assert.deepEqual(loadPos(), { x: 120, y: 340 });
  savePos({ x: 5, y: 6 });
  assert.deepEqual(loadPos(), { x: 5, y: 6 });
});

test('loadPos returns null for malformed/non-numeric data', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { loadPos } = await import('../widget/window-pos.js?2');
  fs.writeFileSync(path.join(process.env.CLAUDE_PET_HOME, 'widget.json'), '{"x":"a","y":3}');
  assert.equal(loadPos(), null);
});
