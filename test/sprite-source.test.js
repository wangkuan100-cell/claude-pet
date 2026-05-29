import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { assetUrlFor, assetDataUrl } from '../widget/sprite-source.js';

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
  assert.equal(assetDataUrl(dir, 'egg'), null);
});
