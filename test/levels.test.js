import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelForXp, stageForLevel } from '../src/levels.js';
import { thresholdForLevel } from '../src/levels.js';

test('levelForXp maps cumulative xp to level', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(149), 1);
  assert.equal(levelForXp(150), 2);
  assert.equal(levelForXp(449), 2);
  assert.equal(levelForXp(450), 3);
  assert.equal(levelForXp(9000), 7);
});

test('levelForXp doubles thresholds beyond the table', () => {
  // Lv8 threshold = 9000 * 2 = 18000, Lv9 = 36000
  assert.equal(levelForXp(17999), 7);
  assert.equal(levelForXp(18000), 8);
  assert.equal(levelForXp(36000), 9);
});

test('stageForLevel maps levels to the six evolution form tiers', () => {
  assert.equal(stageForLevel(1), 'egg');
  assert.equal(stageForLevel(2), 'hatchling');
  assert.equal(stageForLevel(3), 'juvenile');
  assert.equal(stageForLevel(4), 'adolescent');
  assert.equal(stageForLevel(5), 'adult');
  assert.equal(stageForLevel(6), 'legendary');
  assert.equal(stageForLevel(9), 'legendary');
});

test('thresholdForLevel returns cumulative-XP thresholds, doubling past the table', () => {
  assert.equal(thresholdForLevel(1), 0);
  assert.equal(thresholdForLevel(2), 150);
  assert.equal(thresholdForLevel(3), 450);
  assert.equal(thresholdForLevel(7), 9000);
  assert.equal(thresholdForLevel(8), 18000);
  assert.equal(thresholdForLevel(9), 36000);
});
