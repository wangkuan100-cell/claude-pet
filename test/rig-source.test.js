import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rigFor } from '../widget/rig-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

test('rigFor loads the phoenix legendary DragonBones package', () => {
  const rig = rigFor(assetsDir, 'phoenix/legendary');

  assert.equal(rig.id, 'phoenix/legendary');
  assert.equal(rig.engine, 'dragonbones');
  assert.equal(rig.skeleton, 'phoenix_ske.json');
  assert.equal(rig.atlas, 'phoenix_tex.json');
  assert.equal(rig.texture, 'phoenix_tex.png');
  assert.equal(rig.skeletonData.name, 'code-pet-phoenix-legendary');
  assert.equal(rig.atlasData.imagePath, 'phoenix_tex.png');
  assert.match(rig.textureSrc, /^data:image\/png;base64,/);
});

test('rigFor loads explicit DragonBones and LoongBones rig manifests', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pet-rig-'));
  const dragonDir = path.join(dir, 'rigs', 'dragon', 'legendary');
  const kitsuneDir = path.join(dir, 'rigs', 'kitsune', 'legendary');
  fs.mkdirSync(dragonDir, { recursive: true });
  fs.mkdirSync(kitsuneDir, { recursive: true });
  fs.writeFileSync(
    path.join(dragonDir, 'rig.json'),
    JSON.stringify({ id: 'dragon/legendary', engine: 'dragonbones', skeleton: 'dragon_ske.json', atlas: 'dragon_tex.json' }),
  );
  fs.writeFileSync(
    path.join(kitsuneDir, 'rig.json'),
    JSON.stringify({ id: 'kitsune/legendary', engine: 'loongbones', skeleton: 'kitsune_ske.json', atlas: 'kitsune_tex.json' }),
  );

  assert.equal(rigFor(dir, 'dragon/legendary').engine, 'dragonbones');
  assert.equal(rigFor(dir, 'kitsune/legendary').engine, 'loongbones');
});

test('rigFor applies the shared subtle-eye DragonBones rig to other legendary pets', () => {
  const legendaryKeys = [
    'dragon/legendary',
    'kitsune/legendary',
    'cerberus/legendary',
    'sphinx/legendary',
    'golem/legendary',
  ];

  for (const key of legendaryKeys) {
    const rig = rigFor(assetsDir, key);
    assert.equal(rig.id, key);
    assert.equal(rig.engine, 'dragonbones');
    assert.equal(rig.runtime.mode, 'whole-sprite-safe');
    assert.ok(rig.runtime.meshZones.face);
    assert.ok(rig.runtime.meshZones.leftEye);
    assert.ok(rig.runtime.meshZones.rightEye);
    assert.ok(rig.runtime.animations.blink.keyframes.some((frame) => typeof frame.blink === 'number'));
    assert.match(rig.textureSrc, /^data:image\/png;base64,/);
  }
});

test('rigFor returns null for missing or malformed sprite keys', () => {
  assert.equal(rigFor(assetsDir, 'phoenix/adult'), null);
  assert.equal(rigFor(assetsDir, 'dragon/adult'), null);
  assert.equal(rigFor(assetsDir, 'egg'), null);
  assert.equal(rigFor(assetsDir, ''), null);
});
