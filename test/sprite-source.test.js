import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { assetUrlFor } from '../widget/sprite-source.js';

test('assetUrlFor returns a file URL for an existing <line>/<form>.png, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'phoenix'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary.png'), 'x');
  assert.match(assetUrlFor(dir, 'phoenix/legendary'), /^file:\/\/.*phoenix\/legendary\.png$/);
  assert.equal(assetUrlFor(dir, 'phoenix/adult'), null);
  assert.equal(assetUrlFor(dir, 'egg'), null);
});
