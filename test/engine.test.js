import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, updateStreak, buildStatus } from '../src/engine.js';
import { defaultPet } from '../src/state.js?engine';

const T0 = new Date('2026-05-28T10:00:00Z');

function acc() { return { linesXp: 0, testXp: 0 }; }

test('lines event adds xp and lifetime, never below floor mood', () => {
  const { pet, sessionAcc } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'lines', count: 10 }, T0);
  assert.equal(pet.xp, 10);
  assert.equal(pet.lifetime.linesAdded, 10);
  assert.equal(sessionAcc.linesXp, 10);
});

test('a fresh egg stays an unhatched egg below level 2', () => {
  const { pet } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'lines', count: 10 }, T0, () => 0);
  assert.equal(pet.species, null);
  assert.equal(pet.stage, 'egg');
});

test('the egg hatches into a RANDOM species the first time it passes level 1', () => {
  // milestone = 300 xp -> level 2 -> hatch; injected rng picks the first line deterministically
  const { pet } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'milestone' }, T0, () => 0);
  assert.equal(pet.level, 2);
  assert.equal(pet.species, 'phoenix'); // LINE_IDS[0]
  assert.equal(pet.stage, 'hatchling');
});

test('feed raises mood by 8 (capped at 100), awards no xp', () => {
  const { pet } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'feed' }, T0); // mood 80 -> 88
  assert.equal(pet.mood, 88);
  assert.equal(pet.xp, 0);
  const happy = applyEvent({ ...defaultPet(T0.toISOString()), mood: 96 }, acc(), { type: 'feed' }, T0);
  assert.equal(happy.pet.mood, 100); // capped
});

test('per-session line XP cap is enforced across events', () => {
  let pet = defaultPet(T0.toISOString());
  let sessionAcc = acc();
  for (let i = 0; i < 10; i++) {
    ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'lines', count: 30 }, T0));
  }
  // 10 events × 30 = 300 raw, but session cap is 200
  assert.equal(sessionAcc.linesXp, 200);
  assert.equal(pet.xp, 200);
});

test('feat commit awards big xp, bumps features, raises mood, can level up', () => {
  const { pet, unlocked } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'commit', kind: 'feat' }, T0);
  assert.equal(pet.xp, 120);
  assert.equal(pet.lifetime.commits, 1);
  assert.equal(pet.lifetime.features, 1);
  assert.equal(pet.mood, 90);
  assert.ok(unlocked.includes('first-feat'));
});

test('milestone awards 300 and unlocks first-release', () => {
  const { pet, unlocked } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'milestone' }, T0);
  assert.equal(pet.xp, 300);
  assert.equal(pet.level, 2); // 300 xp -> Lv2 (>=150, <450)
  assert.ok(unlocked.includes('first-release'));
});

test('mood only drops after 3 consecutive failures (encourage, not anger)', () => {
  let pet = defaultPet(T0.toISOString());
  let sessionAcc = acc();
  // First two failures are the normal TDD red phase: no mood drop, no worried flag.
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  assert.equal(pet.mood, 80);
  assert.equal(pet.recentFailureUntil, null);
  // Third consecutive failure crosses the threshold.
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  assert.equal(pet.mood, 72);
  assert.ok(new Date(pet.recentFailureUntil) > T0);
});

test('a passing test resets the consecutive-failure streak', () => {
  let pet = defaultPet(T0.toISOString());
  let sessionAcc = acc();
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'testPass' }, T0));
  assert.equal(sessionAcc.failures, 0);
  // Two more failures after the reset is only 2 consecutive → still no worried flag.
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  ({ pet, sessionAcc } = applyEvent(pet, sessionAcc, { type: 'failure' }, T0));
  assert.equal(pet.recentFailureUntil, null);
});

test('idle event applies decay based on lastActivityAt', () => {
  const start = defaultPet(T0.toISOString());
  const later = new Date('2026-05-28T12:00:00Z'); // 2h later
  const { pet } = applyEvent(start, acc(), { type: 'idle' }, later);
  assert.equal(pet.mood, 70); // 80 - 5*2
});

test('updateStreak increments on consecutive day, resets after a gap', () => {
  assert.deepEqual(updateStreak({ days: 3, lastActiveDate: '2026-05-27' }, new Date('2026-05-28T09:00:00Z')),
    { days: 4, lastActiveDate: '2026-05-28' });
  assert.deepEqual(updateStreak({ days: 3, lastActiveDate: '2026-05-28' }, new Date('2026-05-28T18:00:00Z')),
    { days: 3, lastActiveDate: '2026-05-28' }); // same day, no change
  assert.deepEqual(updateStreak({ days: 9, lastActiveDate: '2026-05-20' }, new Date('2026-05-28T09:00:00Z')),
    { days: 1, lastActiveDate: '2026-05-28' }); // gap resets
});

test('buildStatus raises alerts past thresholds', () => {
  const snap = { isRepo: true, branch: 'main', dirtyCount: 20, minsSinceLastCommit: 200 };
  const usage = { totalTokens: 120000, lastContextTokens: 170000 };
  const status = buildStatus({ cwd: '/x', repo: 'a/b', snapshot: snap, usage, costUsd: 0.5, activeMins: 100 }, new Date());
  assert.ok(status.alerts.includes('context')); // 170000/200000 = 85%
  assert.ok(status.alerts.includes('git'));
  assert.ok(status.alerts.includes('rest'));
});
