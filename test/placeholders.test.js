import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spritePlaceholder, LINE_IDS } from '../widget/placeholders.js';

test('LINE_IDS exposes the six adoptable evolution lines', () => {
  assert.equal(LINE_IDS.length, 6);
  assert.ok(LINE_IDS.includes('phoenix'));
});

test('pre-adoption egg key returns the generic egg', () => {
  assert.deepEqual(spritePlaceholder('egg'), { base: '🥚', scale: 0.7, expr: null });
});

test('spritePlaceholder returns the per-line/form emoji and a form-scaled size', () => {
  assert.equal(spritePlaceholder('phoenix/legendary').base, '🔥');
  assert.equal(spritePlaceholder('phoenix/egg').base, '🥚');
  assert.equal(spritePlaceholder('dragon/legendary').base, '🐉');
  assert.ok(spritePlaceholder('dragon/adult').scale >= 1.0);
  assert.equal(spritePlaceholder('phoenix/legendary').scale, 1.4);
});

test('unknown line/form falls back to a paw print', () => {
  assert.equal(spritePlaceholder('zebra/adult').base, '🐾');
});
