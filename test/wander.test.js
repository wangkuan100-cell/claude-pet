import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWanderTarget, glidePath } from '../widget/wander.js';

test('pickWanderTarget lands on the bottom edge, x within range', () => {
  const wa = { width: 1000, height: 800 };
  const ws = { width: 240, height: 300 };
  assert.deepEqual(pickWanderTarget(wa, ws, () => 0.5), { x: 380, y: 500 }); // 800-300 bottom; round(.5*760)
  assert.equal(pickWanderTarget(wa, ws, () => 0).x, 0);
  assert.equal(pickWanderTarget(wa, ws, () => 1).x, 760); // 1000-240
});

test('glidePath eases from start to end and ends exactly at the target', () => {
  const p = glidePath([0, 0], [100, 0], 10);
  assert.equal(p.length, 10);
  assert.deepEqual(p[p.length - 1], [100, 0]); // last frame == target
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] >= p[i - 1][0]); // monotonic x
});
