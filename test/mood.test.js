import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodAfterEvent, moodAfterDecay, moodAfterFailure, expressionFor } from '../src/mood.js';

test('moodAfterEvent adds the event delta and clamps to ceiling', () => {
  assert.equal(moodAfterEvent(80, 'feat'), 90);
  assert.equal(moodAfterEvent(95, 'milestone'), 100); // clamped
  assert.equal(moodAfterEvent(50, 'activity'), 52);
});

test('moodAfterFailure subtracts and respects floor', () => {
  assert.equal(moodAfterFailure(50), 42);
  assert.equal(moodAfterFailure(12), 10); // floor
});

test('moodAfterDecay loses 5 per idle hour, floored at 10', () => {
  assert.equal(moodAfterDecay(80, 2), 70);
  assert.equal(moodAfterDecay(20, 10), 10); // floor
  assert.equal(moodAfterDecay(80, 0.5), 78); // rounds 77.5 -> 78
});

test('expressionFor uses mood bands; failure overrides', () => {
  assert.equal(expressionFor({ mood: 90, recentFailureActive: false }), 'flow');
  assert.equal(expressionFor({ mood: 70, recentFailureActive: false }), 'happy');
  assert.equal(expressionFor({ mood: 40, recentFailureActive: false }), 'normal');
  assert.equal(expressionFor({ mood: 20, recentFailureActive: false }), 'sleepy');
  assert.equal(expressionFor({ mood: 12, recentFailureActive: false }), 'bored');
  assert.equal(expressionFor({ mood: 90, recentFailureActive: true }), 'worried');
});
