import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetLayerSet } from '../widget/sprite-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

test('legendary 2.5D showcase creatures have layered art manifests', () => {
  const expected = {
    'dragon/legendary': ['body-core', 'wing-left', 'wing-right', 'tail', 'leg-back', 'leg-front', 'horns-front', 'orb-front'],
    'phoenix/legendary': ['body-core', 'wing-left', 'wing-right', 'foot-left', 'foot-right', 'flame-halo', 'crest-front'],
    'kitsune/legendary': ['body-core', 'head-ears', 'tails-left', 'tails-right', 'leg-back', 'leg-front', 'aura-front'],
  };

  for (const [spriteKey, ids] of Object.entries(expected)) {
    const set = assetLayerSet(assetsDir, spriteKey);
    assert.ok(set, `${spriteKey} should have a valid 2.5D layer set`);
    assert.deepEqual(set.canvas, { width: 256, height: 256 });
    assert.deepEqual(set.layers.map((layer) => layer.id), ids);
    assert.ok(set.layers.every((layer) => layer.src.startsWith('data:image/png;base64,')));
    assert.ok(set.layers.every((layer) => layer.pivot), `${spriteKey} layers should define rig pivots`);
    assert.ok(set.layers.every((layer) => layer.motion), `${spriteKey} layers should define animation motion types`);
  }
});
