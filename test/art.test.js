import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { promptFor, spriteMatrix, outputPath, STYLE } from '../art/prompts.js';
import { generateAll } from '../art/generate.mjs';

test('STYLE is cartoon 3D and promptFor includes the line form art + style', () => {
  assert.match(STYLE, /cartoon 3D/i);
  const p = promptFor('phoenix', 'legendary');
  assert.match(p, /phoenix/i);
  assert.match(p, /transparent background/i);
});

test('spriteMatrix covers lines x forms; outputPath is <line>/<form>.png', () => {
  const m = spriteMatrix(['phoenix']);
  assert.equal(m.length, 6); // 6 forms
  assert.ok(m.every((i) => i.key === `${i.line}/${i.form}`));
  assert.equal(outputPath('/A', { line: 'phoenix', form: 'legendary' }), '/A/phoenix/legendary.png');
});

test('generateAll writes a PNG per item using the injected requestImage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  const calls = [];
  const requestImage = async (prompt) => { calls.push(prompt); return Buffer.from('PNGDATA'); };
  const items = [{ line: 'phoenix', form: 'legendary', key: 'phoenix/legendary' }];
  const res = await generateAll(items, { assetsDir: dir, requestImage });
  assert.equal(res.written, 1);
  assert.equal(calls.length, 1);
  const file = path.join(dir, 'phoenix', 'legendary.png');
  assert.ok(fs.existsSync(file));
  assert.equal(fs.readFileSync(file, 'utf8'), 'PNGDATA');
});
