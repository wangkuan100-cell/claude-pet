import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWanderTarget, glidePath, hopPath } from '../widget/wander.js';

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

test('hopPath ends at the target, X is monotonic, Y bounces above the baseline', () => {
  const p = hopPath([0, 100], [200, 100], 4, 20, 8);
  assert.equal(p.length, 4 * 8); // hops × stepsPerHop
  assert.deepEqual(p[p.length - 1], [200, 100]); // last point hits target exactly
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] >= p[i - 1][0]); // X never goes backward
  assert.ok(p.some(([, y]) => y < 100));                                 // arcs rise above baseline
  assert.ok(p.some(([, y]) => Math.abs(y - 100) <= 1));                  // touches baseline at hop edges
});
