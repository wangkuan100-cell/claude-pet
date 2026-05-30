import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { assetUrlFor, assetDataUrl, assetDataUrlPose2 } from '../widget/sprite-source.js';

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
