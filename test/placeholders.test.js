import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spritePlaceholder, SPECIES } from '../widget/placeholders.js';

test('SPECIES lists the adoptable starters', () => {
  assert.deepEqual(SPECIES, ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox']);
});

test('egg sprite is a small egg with no expression overlay', () => {
  assert.deepEqual(spritePlaceholder('egg'), { base: '🥚', scale: 0.7, expr: null });
});

test('species sprite maps base emoji, stage scale, and expression overlay', () => {
  assert.deepEqual(spritePlaceholder('dragon/child/flow'), { base: '🐉', scale: 1.0, expr: '🤩' });
  assert.deepEqual(spritePlaceholder('cat/adult/sleepy'), { base: '🐱', scale: 1.3, expr: '😴' });
});

test('evolved stages scale up; unknown parts fall back gracefully', () => {
  assert.equal(spritePlaceholder('fox/evolved2/happy').scale, 1.45);
  assert.equal(spritePlaceholder('zebra/child/happy').base, '🐾');
});
