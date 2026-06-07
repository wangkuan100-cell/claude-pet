import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORMS, LINE_IDS } from '../src/lines.js';
import { rigFor } from '../widget/rig-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

const EXPANDED_LINE_IDS = ['unicorn', 'griffin', 'pegasus', 'leviathan', 'basilisk', 'mandrake'];

test('expanded pets use the same generic egg and get their own post-hatch sprites', () => {
  assert.equal(fs.existsSync(path.join(assetsDir, 'egg.png')), true);

  for (const line of EXPANDED_LINE_IDS) {
    assert.ok(LINE_IDS.includes(line), `${line} is not hatchable`);
    assert.equal(fs.existsSync(path.join(assetsDir, line, 'egg.png')), false, `${line} must not reveal a species egg`);

    for (const form of FORMS.filter((value) => value !== 'egg')) {
      const spritePath = path.join(assetsDir, line, `${form}.png`);
      assert.equal(fs.existsSync(spritePath), true, `${line}/${form}.png missing`);
    }
  }
});

test('expanded legendary pets enter the shared DragonBones whole-sprite rig', () => {
  for (const line of EXPANDED_LINE_IDS) {
    const rig = rigFor(assetsDir, `${line}/legendary`);
    assert.equal(rig?.engine, 'dragonbones', `${line} should use DragonBones`);
    assert.equal(rig?.id, `${line}/legendary`);
  }
});
