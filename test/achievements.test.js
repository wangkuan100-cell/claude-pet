import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlockAchievements } from '../src/achievements.js';

function pet(overrides = {}) {
  return {
    level: 1,
    streak: { days: 1 },
    achievements: [],
    lifetime: { features: 0, testsPassed: 0, commits: 0, releases: 0 },
    ...overrides,
  };
}

test('unlockAchievements returns newly-qualified ids', () => {
  assert.deepEqual(unlockAchievements(pet()), []);
  assert.deepEqual(unlockAchievements(pet({ level: 2 })), ['first-hatch']);
  assert.deepEqual(
    unlockAchievements(pet({ lifetime: { features: 1, testsPassed: 0, commits: 0, releases: 0 } })),
    ['first-feat'],
  );
});

test('unlockAchievements does not re-award already-held ones', () => {
  const p = pet({ level: 2, achievements: [{ id: 'first-hatch', at: 't' }] });
  assert.deepEqual(unlockAchievements(p), []);
});

test('unlockAchievements can return multiple at once', () => {
  const p = pet({ level: 2, lifetime: { features: 1, testsPassed: 1, commits: 100, releases: 1 } });
  assert.deepEqual(
    unlockAchievements(p).sort(),
    ['century', 'first-feat', 'first-green', 'first-hatch', 'first-release'].sort(),
  );
});
