import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { assetUrlFor } from '../widget/sprite-source.js';

test('assetUrlFor returns a file URL when the PNG exists, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'dragon', 'child'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dragon', 'child', 'happy.png'), 'x');
  assert.match(assetUrlFor(dir, 'dragon/child/happy'), /^file:\/\/.*dragon\/child\/happy\.png$/);
  assert.equal(assetUrlFor(dir, 'dragon/child/sleepy'), null);
  assert.equal(assetUrlFor(dir, 'egg'), null);
});
