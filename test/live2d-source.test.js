import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { live2dModelFor } from '../widget/live2d-source.js';

function writeModel(root, spriteKey, model) {
  const dir = path.join(root, 'live2d', ...spriteKey.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'model3.json'), JSON.stringify(model));
  return dir;
}

test('live2dModelFor returns model metadata when a local Cubism model is complete', () => {
  const assetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live2d-assets-'));
  const model = {
    Version: 3,
    FileReferences: {
      Moc: 'phoenix.moc3',
      Textures: ['textures/texture_00.png'],
      Physics: 'phoenix.physics3.json',
      Motions: {
        Idle: [{ File: 'motions/idle.motion3.json' }],
        Tap: [{ File: 'motions/tap.motion3.json' }],
      },
    },
  };
  const dir = writeModel(assetsDir, 'phoenix/legendary', model);
  fs.writeFileSync(path.join(dir, 'phoenix.moc3'), 'moc');
  fs.mkdirSync(path.join(dir, 'textures'));
  fs.writeFileSync(path.join(dir, 'textures', 'texture_00.png'), 'png');
  fs.writeFileSync(path.join(dir, 'phoenix.physics3.json'), '{}');
  fs.mkdirSync(path.join(dir, 'motions'));
  fs.writeFileSync(path.join(dir, 'motions', 'idle.motion3.json'), '{}');
  fs.writeFileSync(path.join(dir, 'motions', 'tap.motion3.json'), '{}');

  const result = live2dModelFor(assetsDir, 'phoenix/legendary');

  assert.equal(result.key, 'phoenix/legendary');
  assert.match(result.url, /^file:\/\/.*model3\.json$/);
  assert.deepEqual(result.motions, ['Idle', 'Tap']);
  assert.equal(result.hasPhysics, true);
});

test('live2dModelFor returns null when model3.json or required references are missing', () => {
  const assetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live2d-assets-'));
  assert.equal(live2dModelFor(assetsDir, 'phoenix/legendary'), null);

  writeModel(assetsDir, 'phoenix/legendary', {
    Version: 3,
    FileReferences: {
      Moc: 'missing.moc3',
      Textures: ['textures/texture_00.png'],
    },
  });
  assert.equal(live2dModelFor(assetsDir, 'phoenix/legendary'), null);
});
