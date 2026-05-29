import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForEvent, applyStreakMultiplier } from '../src/xp.js';

test('xpForEvent: lines are capped per event', () => {
  assert.equal(xpForEvent({ type: 'lines', count: 10 }), 10);
  assert.equal(xpForEvent({ type: 'lines', count: 500 }), 30);
  assert.equal(xpForEvent({ type: 'lines', count: 0 }), 0);
});

test('xpForEvent: fixed-value events', () => {
  assert.equal(xpForEvent({ type: 'newFile' }), 15);
  assert.equal(xpForEvent({ type: 'testPass' }), 40);
  assert.equal(xpForEvent({ type: 'milestone' }), 300);
});

test('xpForEvent: commit value depends on kind', () => {
  assert.equal(xpForEvent({ type: 'commit', kind: 'feat' }), 120);
  assert.equal(xpForEvent({ type: 'commit', kind: 'fix' }), 60);
  assert.equal(xpForEvent({ type: 'commit', kind: 'other' }), 40);
});

test('xpForEvent: tokens award per 100k', () => {
  assert.equal(xpForEvent({ type: 'tokens', tokens: 250000 }), 10);
  assert.equal(xpForEvent({ type: 'tokens', tokens: 50000 }), 0);
});

test('applyStreakMultiplier ramps then caps at 2x', () => {
  assert.equal(applyStreakMultiplier(100, 1), 100);
  assert.equal(applyStreakMultiplier(100, 3), 110); // 1 + 0.05*2 = 1.1
  assert.equal(applyStreakMultiplier(100, 100), 200); // capped
});
