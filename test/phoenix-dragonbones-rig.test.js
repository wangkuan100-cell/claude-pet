import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rigDir = path.join(__dirname, '..', 'assets', 'rigs', 'phoenix', 'legendary');
const rigPath = path.join(rigDir, 'rig.json');
const skeletonPath = path.join(rigDir, 'phoenix_ske.json');
const atlasPath = path.join(rigDir, 'phoenix_tex.json');
const texturePath = path.join(rigDir, 'phoenix_tex.png');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function overlapArea(a, b) {
  const xOverlap = Math.max(0, Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin));
  const yOverlap = Math.max(0, Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin));
  return xOverlap * yOverlap;
}

test('phoenix legendary declares a production DragonBones package', () => {
  const rig = readJson(rigPath);

  assert.equal(rig.id, 'phoenix/legendary');
  assert.equal(rig.engine, 'dragonbones');
  assert.equal(rig.skeleton, 'phoenix_ske.json');
  assert.equal(rig.atlas, 'phoenix_tex.json');
  assert.equal(rig.texture, 'phoenix_tex.png');
  assert.equal(rig.runtime.mode, 'whole-sprite-safe');
  assert.deepEqual(Object.keys(rig.runtime.meshZones).sort(), ['crest', 'face', 'feet', 'leftEye', 'leftWing', 'rightEye', 'rightWing']);
  assert.deepEqual(Object.keys(rig.runtime.animations).sort(), ['blink', 'flap', 'happy', 'hop', 'idle', 'run', 'tap', 'walk', 'worried']);
  assert.ok(rig.runtime.animations.flap.keyframes.some((frame) => typeof frame.wingLift === 'number'));
  assert.ok(rig.runtime.animations.flap.keyframes.some((frame) => typeof frame.wingCurl === 'number'));
  assert.ok(rig.runtime.animations.flap.keyframes.every((frame) => typeof frame.footPlant === 'number' && frame.footPlant <= 0.2));
  assert.ok(rig.runtime.animations.run.keyframes.some((frame) => typeof frame.footStride === 'number'));
  assert.ok(rig.runtime.animations.run.keyframes.some((frame) => typeof frame.footPlant === 'number'));
  assert.ok(rig.runtime.animations.walk.keyframes.some((frame) => typeof frame.footStride === 'number'));
  assert.ok(rig.runtime.animations.walk.keyframes.some((frame) => typeof frame.footPlant === 'number'));
  assert.ok(rig.runtime.animations.hop.keyframes.some((frame) => typeof frame.hopSquash === 'number'));
  assert.ok(rig.runtime.animations.blink.keyframes.some((frame) => typeof frame.blink === 'number'));
});

test('phoenix legendary wing mesh zones stay separated from face controls', () => {
  const rig = readJson(rigPath);
  const zones = rig.runtime.meshZones;

  assert.ok(zones.face);
  assert.ok(zones.face.xMin < zones.leftEye.xMin);
  assert.ok(zones.face.xMax > zones.rightEye.xMax);
  assert.equal(overlapArea(zones.leftWing, zones.leftEye), 0);
  assert.equal(overlapArea(zones.rightWing, zones.rightEye), 0);
  assert.equal(overlapArea(zones.leftWing, zones.face), 0);
  assert.equal(overlapArea(zones.rightWing, zones.face), 0);
  assert.ok(zones.leftWing.xMax <= zones.leftEye.xMin);
  assert.ok(zones.rightWing.xMin >= zones.rightEye.xMax);
  assert.ok(zones.leftWing.xMax <= zones.face.xMin);
  assert.ok(zones.rightWing.xMin >= zones.face.xMax);
});

test('phoenix legendary DragonBones skeleton keeps the face on one full-body display', () => {
  const skeleton = readJson(skeletonPath);
  const armature = skeleton.armature?.[0];

  assert.equal(skeleton.name, 'code-pet-phoenix-legendary');
  assert.equal(skeleton.frameRate, 24);
  assert.equal(armature.name, 'PhoenixLegendary');
  assert.deepEqual(armature.bone.map((bone) => bone.name), ['root', 'body', 'leftWing', 'rightWing', 'feet', 'crest', 'leftEye', 'rightEye']);
  assert.deepEqual(armature.slot.map((slot) => slot.name), ['whole-body']);

  const display = armature.skin[0].slot[0].display[0];
  assert.equal(display.name, 'phoenix_full');
  assert.equal(display.path, 'phoenix_full');
  assert.equal(display.type, 'image');
  assert.equal(armature.animation.length, 9);
});

test('phoenix legendary DragonBones atlas points at a real 256px transparent texture', () => {
  const atlas = readJson(atlasPath);
  const size = pngSize(texturePath);

  assert.equal(atlas.imagePath, 'phoenix_tex.png');
  assert.deepEqual(size, { width: 256, height: 256 });
  assert.deepEqual(atlas.SubTexture, [
    { name: 'phoenix_full', x: 0, y: 0, width: 256, height: 256 },
  ]);
});
