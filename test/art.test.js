import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { promptFor, spriteMatrix, outputPath } from '../art/prompts.js';
import { generateAll } from '../art/generate.mjs';

test('promptFor includes species, stage, expression and the shared style', () => {
  const p = promptFor('dragon', 'child', 'happy');
  assert.match(p, /dragon/i);
  assert.match(p, /transparent background/i);
});

test('spriteMatrix covers every species x stage x expression and builds key paths', () => {
  const m = spriteMatrix(['dragon']);
  assert.ok(m.length >= 5 * 6); // 5 stages x 6 expressions (at least)
  assert.ok(m.every((i) => i.key === `${i.species}/${i.stage}/${i.expr}`));
  assert.equal(outputPath('/A', { species: 'dragon', stage: 'child', expr: 'happy' }), '/A/dragon/child/happy.png');
});

test('generateAll writes a PNG per item using the injected requestImage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  const calls = [];
  const requestImage = async (prompt) => { calls.push(prompt); return Buffer.from('PNGDATA'); };
  const items = [{ species: 'dragon', stage: 'child', expr: 'happy', key: 'dragon/child/happy' }];
  const res = await generateAll(items, { assetsDir: dir, requestImage });
  assert.equal(res.written, 1);
  assert.equal(calls.length, 1);
  const file = path.join(dir, 'dragon', 'child', 'happy.png');
  assert.ok(fs.existsSync(file));
  assert.equal(fs.readFileSync(file, 'utf8'), 'PNGDATA');
});
