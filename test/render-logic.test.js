import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentMood, currentExpression, spriteKey, xpProgress, bubbleFor, buildPaintData,
} from '../widget/render-logic.js';

const NOW = new Date('2026-05-28T12:00:00Z');

function pet(over = {}) {
  return {
    species: 'dragon', name: null, xp: 300, level: 2, stage: 'hatchling',
    mood: 80, lastActivityAt: NOW.toISOString(), recentFailureUntil: null,
    achievements: [{ id: 'first-hatch', at: 't' }], ...over,
  };
}

test('currentMood decays from lastActivityAt', () => {
  const p = pet({ lastActivityAt: '2026-05-28T10:00:00Z' }); // 2h ago
  assert.equal(currentMood(p, NOW), 70); // 80 - 5*2
});

test('currentExpression reflects mood, and failure overrides it', () => {
  assert.equal(currentExpression(pet({ mood: 90 }), NOW), 'flow');
  const failing = pet({ mood: 90, recentFailureUntil: '2026-05-28T12:10:00Z' }); // still active
  assert.equal(currentExpression(failing, NOW), 'worried');
});

test('spriteKey is egg until adopted, else species/stage/expression', () => {
  assert.equal(spriteKey(pet({ species: null, stage: 'egg' }), NOW), 'egg');
  assert.equal(spriteKey(pet({ mood: 90 }), NOW), 'dragon/hatchling/flow');
});

test('xpProgress computes progress within the current level', () => {
  assert.deepEqual(xpProgress(pet({ xp: 300, level: 2 })), { level: 2, intoLevel: 150, span: 300, toNext: 150, pct: 50 });
});

test('bubbleFor picks the highest-priority alert', () => {
  assert.equal(bubbleFor({ alerts: ['git', 'context'] }).kind, 'context');
  assert.equal(bubbleFor({ alerts: ['rest'] }).kind, 'rest');
  assert.equal(bubbleFor({ alerts: [] }), null);
  assert.equal(bubbleFor(null), null);
});

test('buildPaintData returns adopt mode when unadopted', () => {
  const data = buildPaintData(pet({ species: null, stage: 'egg' }), null, NOW);
  assert.equal(data.mode, 'adopt');
  assert.deepEqual(data.species, ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox']);
});

test('buildPaintData returns pet mode with sprite, bubble, and panel', () => {
  const status = { repo: 'a/b', contextUsedPct: 85, sessionCostUsd: 0.5, alerts: ['context'] };
  const data = buildPaintData(pet({ mood: 90 }), status, NOW);
  assert.equal(data.mode, 'pet');
  assert.equal(data.sprite.base, '🐉');
  assert.equal(data.sprite.expr, '🤩');
  assert.equal(data.bubble.kind, 'context');
  assert.equal(data.panel.level, 2);
  assert.equal(data.panel.xpPct, 50);
  assert.equal(data.panel.project.repo, 'a/b');
  assert.deepEqual(data.panel.achievements, ['first-hatch']);
});
