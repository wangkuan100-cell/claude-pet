import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '..', 'widget', 'renderer', 'petlive2d.js'), 'utf8');

test('PetLive2D runtime requires an explicit modelUrl instead of a bundled sample pet', () => {
  assert.match(source, /modelUrl/);
  assert.doesNotMatch(source, /hijiki|tororo|wanko/);
});

test('PetLive2D runtime uses the Cubism 3\\/4 web plugin path', () => {
  assert.match(source, /cubism4\.min\.js/);
  assert.match(source, /live2dcubismcore\.min\.js/);
});
