import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const previewPath = path.join(root, 'bin', 'preview-all-pets.mjs');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('package exposes a six-pet DragonBones preview script', () => {
  assert.equal(packageJson.scripts['preview:all-pets'], 'node bin/preview-all-pets.mjs');
  assert.equal(fs.existsSync(previewPath), true);
});

test('six-pet preview covers every legendary pet with DragonBones fixtures', () => {
  const source = fs.readFileSync(previewPath, 'utf8');

  for (const key of [
    'phoenix/legendary',
    'dragon/legendary',
    'kitsune/legendary',
    'cerberus/legendary',
    'sphinx/legendary',
    'golem/legendary',
  ]) {
    assert.match(source, new RegExp(key.replace('/', '\\/')));
  }
  assert.match(source, /attachSpriteAssets/);
  assert.match(source, /DragonBones whole-sprite rig/);
  assert.match(source, /127\.0\.0\.1/);
});
