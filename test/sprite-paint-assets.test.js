import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachSpriteAssets } from '../widget/sprite-paint-assets.js';

test('attachSpriteAssets attaches a Live2D model while keeping PNG fallback art', () => {
  const sprite = { key: 'phoenix/legendary' };
  const source = {
    assetDataUrls: () => ['pose1', 'pose2'],
    assetLayerSet: () => ({ canvas: { width: 256, height: 256 }, layers: [{ id: 'body', src: 'body' }] }),
  };
  const live2dSource = {
    live2dModelFor: () => ({ key: 'phoenix/legendary', url: 'file:///phoenix/model3.json', motions: ['Idle', 'Tap'], hasPhysics: true }),
  };

  const result = attachSpriteAssets(sprite, source, '/assets', live2dSource);

  assert.equal(result.animationMode, 'live2d');
  assert.deepEqual(result.live2d, { key: 'phoenix/legendary', url: 'file:///phoenix/model3.json', motions: ['Idle', 'Tap'], hasPhysics: true });
  assert.deepEqual(result.poses, ['pose1']);
  assert.equal(result.imageSrc, 'pose1');
  assert.equal(result.layers, undefined);
});

test('attachSpriteAssets keeps generated pose variants out of the default animation loop', () => {
  const sprite = { key: 'dragon/legendary' };
  const source = {
    assetDataUrls: () => ['pose1', 'pose2', 'pose3', 'pose4'],
    assetLayerSet: () => ({ canvas: { width: 256, height: 256 }, layers: [{ id: 'body', src: 'body' }] }),
  };
  const result = attachSpriteAssets(sprite, source, '/assets');
  assert.equal(result.layers, undefined);
  assert.equal(result.layerCanvas, undefined);
  assert.equal(result.animationMode, 'still');
  assert.deepEqual(result.poses, ['pose1']);
  assert.equal(result.imageSrc, 'pose1');
  assert.equal(result.imageSrcPose2, undefined);
});

test('attachSpriteAssets prefers a stable full sprite over 2.5D layers even when only one pose exists', () => {
  const sprite = { key: 'dragon/legendary' };
  const source = {
    assetDataUrls: () => ['pose1'],
    assetLayerSet: () => ({ canvas: { width: 256, height: 256 }, layers: [{ id: 'body', src: 'body' }] }),
  };
  const result = attachSpriteAssets(sprite, source, '/assets');
  assert.equal(result.animationMode, 'still');
  assert.equal(result.layers, undefined);
  assert.equal(result.layerCanvas, undefined);
  assert.deepEqual(result.poses, ['pose1']);
});

test('attachSpriteAssets does not use legacy split layers without a keyframed rig', () => {
  const sprite = { key: 'dragon/legendary' };
  const source = {
    assetDataUrls: () => [],
    assetLayerSet: () => ({ canvas: { width: 256, height: 256 }, layers: [{ id: 'body', src: 'body' }] }),
  };
  const result = attachSpriteAssets(sprite, source, '/assets');
  assert.equal(result.animationMode, undefined);
  assert.equal(result.layers, undefined);
  assert.equal(result.layerCanvas, undefined);
  assert.equal(result.rig, undefined);
});

test('attachSpriteAssets ignores legacy keyframed split rigs and keeps the stable full sprite', () => {
  const rig = { id: 'phoenix/legendary', animations: { run: {} } };
  const layerSet = { canvas: { width: 256, height: 256 }, layers: [{ id: 'body', src: 'body' }] };
  const sprite = { key: 'phoenix/legendary' };
  const source = {
    assetDataUrls: () => ['pose1'],
    assetLayerSet: () => layerSet,
    assetRig: () => rig,
  };

  const result = attachSpriteAssets(sprite, source, '/assets');

  assert.equal(result.animationMode, 'still');
  assert.equal(result.rig, undefined);
  assert.equal(result.layers, undefined);
  assert.equal(result.layerCanvas, undefined);
  assert.deepEqual(result.poses, ['pose1']);
  assert.equal(result.imageSrc, 'pose1');
});

test('attachSpriteAssets uses explicit DragonBones rigs without legacy split layers', () => {
  const rig = { id: 'phoenix/legendary', engine: 'dragonbones', skeleton: 'pet_ske.json', atlas: 'pet_tex.json' };
  const layerSet = { canvas: { width: 256, height: 256 }, layers: [{ id: 'body', src: 'body' }] };
  const sprite = { key: 'phoenix/legendary' };
  const source = {
    assetDataUrls: () => ['pose1'],
    assetLayerSet: () => layerSet,
    assetRig: () => rig,
  };

  const result = attachSpriteAssets(sprite, source, '/assets');

  assert.equal(result.animationMode, 'dragonbones');
  assert.deepEqual(result.rig, rig);
  assert.equal(result.layers, undefined);
  assert.equal(result.layerCanvas, undefined);
});

test('attachSpriteAssets keeps a stable full sprite when no layers exist', () => {
  const sprite = { key: 'phoenix/adult' };
  const source = {
    assetDataUrls: () => ['pose1'],
    assetLayerSet: () => null,
  };
  const result = attachSpriteAssets(sprite, source, '/assets');
  assert.equal(result.layers, undefined);
  assert.equal(result.animationMode, 'still');
  assert.deepEqual(result.poses, ['pose1']);
  assert.equal(result.imageSrc, 'pose1');
  assert.equal(result.imageSrcPose2, undefined);
});
