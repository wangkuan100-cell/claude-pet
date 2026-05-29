import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestCommand, isTestSuccess } from '../src/tests-detect.js';

test('isTestCommand matches common runners', () => {
  assert.equal(isTestCommand('npm test'), true);
  assert.equal(isTestCommand('npx vitest run'), true);
  assert.equal(isTestCommand('pytest -q'), true);
  assert.equal(isTestCommand('go test ./...'), true);
  assert.equal(isTestCommand('cargo test'), true);
  assert.equal(isTestCommand('node --test'), true);
  assert.equal(isTestCommand('ls -la'), false);
  assert.equal(isTestCommand('git status'), false);
});

test('isTestSuccess prefers exit code when present', () => {
  assert.equal(isTestSuccess('any output', 0), true);
  assert.equal(isTestSuccess('any output', 1), false);
});

test('isTestSuccess falls back to output heuristics when no exit code', () => {
  assert.equal(isTestSuccess('5 passed, 0 failed', null), true);
  assert.equal(isTestSuccess('1 failed', null), false);
  assert.equal(isTestSuccess('no signal here', null), false);
});
