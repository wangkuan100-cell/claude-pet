import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const runtimePath = path.join(root, 'widget', 'renderer', 'petrig.js');
const legacyRig = {
  id: 'test/legacy',
  bones: {
    body: { parent: null, y: 0, rotation: 0 },
    footLeft: { parent: 'body', y: 0 },
    footRight: { parent: 'body', y: 0 },
  },
  slots: [
    { id: 'body-core', bone: 'body', file: 'body.png' },
    { id: 'foot-left', bone: 'footLeft', file: 'left.png' },
    { id: 'foot-right', bone: 'footRight', file: 'right.png' },
  ],
  animations: {
    idle: {
      duration: 1000,
      loop: true,
      tracks: { body: { keyframes: [{ time: 0, y: 0 }, { time: 1, y: 0 }] } },
    },
    run: {
      duration: 720,
      loop: true,
      tracks: {
        body: { keyframes: [{ time: 0, y: 0 }, { time: 1, y: 0 }] },
        footLeft: { keyframes: [{ time: 0, y: 0, contact: true }, { time: 0.5, y: 0.06, contact: false }, { time: 1, y: 0, contact: true }] },
        footRight: { keyframes: [{ time: 0, y: 0.06, contact: false }, { time: 0.5, y: 0, contact: true }, { time: 1, y: 0.06, contact: false }] },
      },
    },
    tap: {
      duration: 500,
      loop: false,
      tracks: { body: { keyframes: [{ time: 0, y: 0 }, { time: 1, y: 0.08 }] } },
    },
  },
};

function loadRuntime() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(runtimePath, 'utf8'), context);
  return context.window.PetRig;
}

function readRig() {
  return legacyRig;
}

test('evaluateRig samples the run gait with alternating foot transforms', () => {
  const PetRig = loadRuntime();
  const rig = readRig();

  const pose0 = PetRig.evaluateRig(rig, 'run', 0, { moving: true });
  const poseHalf = PetRig.evaluateRig(rig, 'run', 360, { moving: true });

  assert.equal(pose0.clip, 'run');
  assert.equal(poseHalf.clip, 'run');
  assert.notEqual(pose0.transforms.footLeft.y, poseHalf.transforms.footLeft.y);
  assert.notEqual(pose0.transforms.footRight.y, poseHalf.transforms.footRight.y);
  assert.equal(pose0.transforms.footLeft.contact, true);
  assert.equal(poseHalf.transforms.footRight.contact, true);
});

test('evaluateRig wraps looping clips and clamps one-shot clips', () => {
  const PetRig = loadRuntime();
  const rig = readRig();

  const run0 = PetRig.evaluateRig(rig, 'run', 0);
  const runWrapped = PetRig.evaluateRig(rig, 'run', 720);
  assert.deepEqual(runWrapped.transforms.body, run0.transforms.body);

  const tapEnd = PetRig.evaluateRig(rig, 'tap', 500);
  const tapLate = PetRig.evaluateRig(rig, 'tap', 1200);
  assert.deepEqual(tapLate.transforms.body, tapEnd.transforms.body);
});

test('evaluateRig falls back to idle for unknown clips', () => {
  const PetRig = loadRuntime();
  const rig = readRig();

  const pose = PetRig.evaluateRig(rig, 'missing-motion', 0);

  assert.equal(pose.clip, 'idle');
});

test('boneTransformsToLayerTransforms maps evaluated bones back to rig slots', () => {
  const PetRig = loadRuntime();
  const rig = readRig();
  const pose = PetRig.evaluateRig(rig, 'run', 180);
  const layers = PetRig.boneTransformsToLayerTransforms(rig, pose);

  assert.deepEqual(layers.map((layer) => layer.id), rig.slots.map((slot) => slot.id));
  assert.equal(layers.find((layer) => layer.id === 'foot-left').bone, 'footLeft');
  assert.equal(Number.isFinite(layers.find((layer) => layer.id === 'body-core').rotation), true);
});
