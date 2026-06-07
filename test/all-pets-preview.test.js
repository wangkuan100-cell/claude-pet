import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const previewPath = path.join(root, 'bin', 'preview-all-pets.mjs');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const EXPECTED_LINE_IDS = [
  'phoenix',
  'dragon',
  'kitsune',
  'cerberus',
  'sphinx',
  'golem',
  'unicorn',
  'griffin',
  'pegasus',
  'leviathan',
  'basilisk',
  'mandrake',
];

test('package exposes an expanded DragonBones preview script', () => {
  assert.equal(packageJson.scripts['preview:all-pets'], 'node bin/preview-all-pets.mjs');
  assert.equal(fs.existsSync(previewPath), true);
});

test('all-pets preview covers every legendary pet with DragonBones fixtures', () => {
  const source = fs.readFileSync(previewPath, 'utf8');

  assert.equal(EXPECTED_LINE_IDS.length, 12);
  assert.match(source, /LINE_IDS/);
  assert.match(source, /LINES/);
  assert.match(source, /legendary/);
  assert.match(source, /attachSpriteAssets/);
  assert.match(source, /DragonBones whole-sprite rig/);
  assert.match(source, /127\.0\.0\.1/);
});
