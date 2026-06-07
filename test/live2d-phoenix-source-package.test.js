import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'assets', 'live2d', 'phoenix', 'legendary', '_source');
const layerDir = path.join(sourceDir, 'layers');

const expectedLayers = [
  'body-core',
  'wing-left',
  'wing-right',
  'foot-left',
  'foot-right',
  'flame-halo',
  'crest-front',
];

const expectedMotions = ['Idle', 'Run', 'Fly', 'Tap', 'Happy', 'Worried'];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(sourceDir, name), 'utf8'));
}

test('phoenix legendary Live2D source package has canonical transparent layers', () => {
  for (const id of expectedLayers) {
    const file = path.join(layerDir, `${id}.png`);
    assert.equal(fs.existsSync(file), true, `${id}.png should exist in the Live2D source layer folder`);
    assert.equal(fs.statSync(file).size > 1024, true, `${id}.png should be a real PNG layer`);
  }
});

test('phoenix legendary Live2D rig map describes the canonical layer graph', () => {
  const rig = readJson('rig-map.json');

  assert.equal(rig.version, 1);
  assert.deepEqual(rig.canvas, { width: 256, height: 256 });
  assert.equal(rig.sourceSprite, '../../../../phoenix/legendary.png');
  assert.deepEqual(rig.layerOrder, expectedLayers);
  assert.equal(rig.export.model3, '../model3.json');
  assert.equal(rig.export.moc, '../phoenix.moc3');

  for (const id of expectedLayers) {
    const layer = rig.layers.find((candidate) => candidate.id === id);
    assert.ok(layer, `${id} should be described in rig-map.json`);
    assert.equal(layer.file, `layers/${id}.png`);
    assert.equal(typeof layer.partId, 'string');
    assert.equal(typeof layer.deformerId, 'string');
    assert.equal(Number.isFinite(layer.pivot.x), true);
    assert.equal(Number.isFinite(layer.pivot.y), true);
    assert.equal(Array.isArray(layer.parameters), true);
    assert.equal(layer.parameters.length > 0, true);
  }
});

test('phoenix legendary Live2D motion spec covers the requested pet actions', () => {
  const spec = readJson('motion-spec.json');

  assert.equal(spec.version, 1);
  assert.equal(spec.target, 'phoenix/legendary');
  assert.deepEqual(spec.motionOrder, expectedMotions);
  assert.deepEqual(Object.keys(spec.motions), expectedMotions);

  for (const name of expectedMotions) {
    const motion = spec.motions[name];
    assert.equal(typeof motion.file, 'string');
    assert.match(motion.file, /^motions\/.+\.motion3\.json$/);
    assert.equal(Number.isFinite(motion.durationSec), true);
    assert.equal(Array.isArray(motion.keyframes), true);
    assert.equal(motion.keyframes.length > 0, true);
  }
});

test('phoenix legendary Live2D source package documents the Cubism export handoff', () => {
  const checklist = fs.readFileSync(path.join(sourceDir, 'EXPORT_CHECKLIST.md'), 'utf8');

  for (const token of [
    'model3.json',
    'phoenix.moc3',
    'phoenix.physics3.json',
    'textures/texture_00.png',
    'motions/idle.motion3.json',
    'motions/run.motion3.json',
    'motions/fly.motion3.json',
    'motions/tap.motion3.json',
    'motions/happy.motion3.json',
    'motions/worried.motion3.json',
  ]) {
    assert.match(checklist, new RegExp(token.replace(/[./]/g, '\\$&')));
  }
});
