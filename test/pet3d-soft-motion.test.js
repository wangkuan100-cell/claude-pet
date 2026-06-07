import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pet3dSource = fs.readFileSync(path.join(__dirname, '..', 'widget', 'renderer', 'pet3d.js'), 'utf8');

test('Pet3D no longer keeps the legacy soft-body deformation path', () => {
  assert.match(pet3dSource, /animationMode: 'still'/);
  assert.match(pet3dSource, /typeof o\.animationMode === 'string' \? o\.animationMode : 'still'/);
  assert.doesNotMatch(pet3dSource, /function deformPlane/);
  assert.doesNotMatch(pet3dSource, /animationMode === 'soft'/);
});

test('Pet3D only enters split-layer mode when a keyframed rig is present', () => {
  assert.match(pet3dSource, /hasRigLayers/);
  assert.doesNotMatch(pet3dSource, /state\.animationMode = o\.rig \? 'rig' : 'layers'/);
});

test('Pet3D treats DragonBones and LoongBones as whole-sprite skeletal modes', () => {
  assert.match(pet3dSource, /SKELETAL_ENGINES/);
  assert.match(pet3dSource, /applySkeletalPlaneMotion/);
  assert.match(pet3dSource, /applySkeletalMeshZones/);
  assert.match(pet3dSource, /automaticBlinkAmount/);
  assert.match(pet3dSource, /blinkAmount/);
  assert.match(pet3dSource, /wingCurl/);
  assert.match(pet3dSource, /footPlant/);
  assert.match(pet3dSource, /zoneProgress/);
  assert.match(pet3dSource, /dataset\.blink/);
  assert.match(pet3dSource, /state\.animationMode = skeletalRig\.engine/);
});

test('Pet3D starts one-shot skeletal clips from action time', () => {
  assert.match(pet3dSource, /clipElapsedMs/);
  assert.match(pet3dSource, /state\.action && \(animation\.loop === false \|\| clip === 'flap'\)/);
  assert.match(pet3dSource, /state\.actionT \* 1000/);
});

test('Pet3D couples skeletal motion to ground shadow weight', () => {
  assert.match(pet3dSource, /updateShadow/);
  assert.match(pet3dSource, /groundLift/);
  assert.match(pet3dSource, /groundContact/);
  assert.match(pet3dSource, /shadow\.material\.opacity/);
});

test('Pet3D routes fly and flap actions to the skeletal flap clip', () => {
  assert.match(pet3dSource, /state\.action === 'flap'/);
  assert.match(pet3dSource, /state\.action === 'fly'/);
  assert.match(pet3dSource, /return 'flap'/);
});

test('Pet3D crossfades between skeletal clips instead of hard switching', () => {
  assert.match(pet3dSource, /TRANSITION_BLEND_MS = 160/);
  assert.match(pet3dSource, /blendRuntimeFrames/);
  assert.match(pet3dSource, /transitionFromFrame/);
  assert.match(pet3dSource, /dataset\.transitionBlend/);
});

test('Pet3D keeps the ground shadow below planted feet', () => {
  assert.match(pet3dSource, /const SHADOW_GROUND_Y = -1\.2/);
  assert.match(pet3dSource, /shadow\.position\.y = SHADOW_GROUND_Y/);
  assert.match(pet3dSource, /shadow\.renderOrder = -10/);
  assert.match(pet3dSource, /dy -= feet \* planted \* 0\.012/);
});

test('Pet3D layers subtle pet-like attention motions over skeletal clips', () => {
  assert.match(pet3dSource, /petAttentionFrame/);
  assert.match(pet3dSource, /attentionLook/);
  assert.match(pet3dSource, /doubleBlinkAmount/);
  assert.match(pet3dSource, /eyeShiftX/);
  assert.match(pet3dSource, /headTilt/);
  assert.match(pet3dSource, /landingRebound/);
  assert.match(pet3dSource, /dataset\.attention/);
  assert.match(pet3dSource, /dataset\.landingRebound/);
});

test('Pet3D masks wing deformation away from the protected face zone', () => {
  assert.match(pet3dSource, /faceGuard/);
  assert.match(pet3dSource, /zoneWeight\(x, y, zones\.face\)/);
  assert.match(pet3dSource, /rawLeftWing \* \(1 - faceGuard\)/);
  assert.match(pet3dSource, /rawRightWing \* \(1 - faceGuard\)/);
});

test('Pet3D keeps eye look and blink deformation subtle', () => {
  assert.match(pet3dSource, /const EYE_LOOK_X = 0\.01/);
  assert.match(pet3dSource, /const EYE_LOOK_Y = 0\.007/);
  assert.match(pet3dSource, /const EYE_BLINK_X = 0\.025/);
  assert.match(pet3dSource, /const EYE_BLINK_Y = 0\.52/);
  assert.match(pet3dSource, /eyeShiftX \* EYE_LOOK_X/);
  assert.match(pet3dSource, /eyeShiftY \* EYE_LOOK_Y/);
  assert.match(pet3dSource, /blinkAmount \* EYE_BLINK_X/);
  assert.match(pet3dSource, /blinkAmount \* EYE_BLINK_Y/);
});
