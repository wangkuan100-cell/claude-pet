import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { assetUrlFor, assetDataUrl, assetDataUrlPose2, assetDataUrls, assetLayerSet } from '../widget/sprite-source.js';

test('assetUrlFor returns a file URL for an existing <line>/<form>.png, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'phoenix'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary.png'), 'x');
  assert.match(assetUrlFor(dir, 'phoenix/legendary'), /^file:\/\/.*phoenix\/legendary\.png$/);
  assert.equal(assetUrlFor(dir, 'phoenix/adult'), null);
  assert.equal(assetUrlFor(dir, 'egg'), null);
});

test('assetDataUrl returns a base64 PNG data URL for an existing sprite, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'dragon'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dragon', 'adult.png'), Buffer.from('PNGDATA'));
  const url = assetDataUrl(dir, 'dragon/adult');
  assert.match(url, /^data:image\/png;base64,/);
  assert.equal(Buffer.from(url.split(',')[1], 'base64').toString(), 'PNGDATA');
  assert.equal(assetDataUrl(dir, 'dragon/legendary'), null);
});

test("assetDataUrl maps the 'egg' key to the GENERIC assets/egg.png (same for everyone)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.writeFileSync(path.join(dir, 'egg.png'), Buffer.from('GENERIC-EGG'));
  const url = assetDataUrl(dir, 'egg');
  assert.match(url, /^data:image\/png;base64,/);
  assert.equal(Buffer.from(url.split(',')[1], 'base64').toString(), 'GENERIC-EGG');
});

test('assetDataUrlPose2 returns the optional pose2 PNG when present, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'phoenix'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary.png'), Buffer.from('POSE1'));
  // No pose2 yet → null
  assert.equal(assetDataUrlPose2(dir, 'phoenix/legendary'), null);
  // Now create it
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary_pose2.png'), Buffer.from('POSE2'));
  const url = assetDataUrlPose2(dir, 'phoenix/legendary');
  assert.match(url, /^data:image\/png;base64,/);
  assert.equal(Buffer.from(url.split(',')[1], 'base64').toString(), 'POSE2');
  // 'egg' (generic) never has a pose2
  assert.equal(assetDataUrlPose2(dir, 'egg'), null);
});

test('assetDataUrls returns [pose1, pose2, ...] in order, stopping at the first gap', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'phoenix'), { recursive: true });

  // Missing base sprite → empty
  assert.deepEqual(assetDataUrls(dir, 'phoenix/legendary'), []);

  // Just pose1 → length 1
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary.png'), Buffer.from('POSE1'));
  let urls = assetDataUrls(dir, 'phoenix/legendary');
  assert.equal(urls.length, 1);
  assert.equal(Buffer.from(urls[0].split(',')[1], 'base64').toString(), 'POSE1');

  // Add pose2 + pose3 + pose4 → length 4 in order
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary_pose2.png'), Buffer.from('POSE2'));
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary_pose3.png'), Buffer.from('POSE3'));
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary_pose4.png'), Buffer.from('POSE4'));
  urls = assetDataUrls(dir, 'phoenix/legendary');
  assert.equal(urls.length, 4);
  assert.equal(Buffer.from(urls[1].split(',')[1], 'base64').toString(), 'POSE2');
  assert.equal(Buffer.from(urls[2].split(',')[1], 'base64').toString(), 'POSE3');
  assert.equal(Buffer.from(urls[3].split(',')[1], 'base64').toString(), 'POSE4');

  // Gap-stop: skip pose5 but write pose6 → returns only [pose1..pose4], pose6 is ignored
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary_pose6.png'), Buffer.from('POSE6'));
  urls = assetDataUrls(dir, 'phoenix/legendary');
  assert.equal(urls.length, 4);

  // 'egg' (generic): only the single egg.png — no pose variants exist for it
  fs.writeFileSync(path.join(dir, 'egg.png'), Buffer.from('EGG'));
  urls = assetDataUrls(dir, 'egg');
  assert.equal(urls.length, 1);
  assert.equal(Buffer.from(urls[0].split(',')[1], 'base64').toString(), 'EGG');
});

test('assetLayerSet loads a 2.5D rig manifest with data URLs, pivots, and motion metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  const layerDir = path.join(dir, 'layers', 'dragon', 'legendary');
  fs.mkdirSync(layerDir, { recursive: true });
  fs.writeFileSync(path.join(layerDir, 'body.png'), Buffer.from('BODY'));
  fs.writeFileSync(path.join(layerDir, 'head.png'), Buffer.from('HEAD'));
  fs.writeFileSync(path.join(layerDir, 'manifest.json'), JSON.stringify({
    version: 2,
    canvas: { width: 256, height: 256 },
    layers: [
      {
        id: 'body',
        file: 'body.png',
        z: 0,
        x: 0,
        y: -0.04,
        scale: 1,
        opacity: 1,
        pivot: { x: 128, y: 170 },
        motion: 'body',
        clip: { idle: { rotate: 0.03, bob: 0.02 }, run: { rotate: 0.06, bob: 0.05 } },
      },
      {
        id: 'head',
        file: 'head.png',
        z: 0.08,
        x: 0.02,
        y: 0.1,
        scale: 1.02,
        opacity: 0.95,
        sway: 0.08,
        pivot: { x: 128, y: 126 },
        motion: 'head',
        direction: -1,
      },
    ],
  }));

  const set = assetLayerSet(dir, 'dragon/legendary');
  assert.equal(set.key, 'dragon/legendary');
  assert.deepEqual(set.canvas, { width: 256, height: 256 });
  assert.equal(set.layers.length, 2);
  assert.equal(set.layers[0].id, 'body');
  assert.match(set.layers[0].src, /^data:image\/png;base64,/);
  assert.equal(Buffer.from(set.layers[1].src.split(',')[1], 'base64').toString(), 'HEAD');
  assert.equal(set.layers[1].z, 0.08);
  assert.equal(set.layers[1].sway, 0.08);
  assert.deepEqual(set.layers[0].pivot, { x: 128, y: 170 });
  assert.equal(set.layers[0].motion, 'body');
  assert.deepEqual(set.layers[0].clip, { idle: { rotate: 0.03, bob: 0.02 }, run: { rotate: 0.06, bob: 0.05 } });
  assert.equal(set.layers[1].direction, -1);
});

test('assetLayerSet returns null when the manifest or a layer file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  assert.equal(assetLayerSet(dir, 'dragon/legendary'), null);

  const layerDir = path.join(dir, 'layers', 'dragon', 'legendary');
  fs.mkdirSync(layerDir, { recursive: true });
  fs.writeFileSync(path.join(layerDir, 'manifest.json'), JSON.stringify({
    version: 1,
    layers: [{ id: 'body', file: 'missing.png' }],
  }));
  assert.equal(assetLayerSet(dir, 'dragon/legendary'), null);
  assert.equal(assetLayerSet(dir, 'egg'), null);
});
