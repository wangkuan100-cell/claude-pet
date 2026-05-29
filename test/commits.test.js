import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommit } from '../src/commits.js';

test('classifyCommit reads conventional-commit type', () => {
  assert.equal(classifyCommit('feat: add login'), 'feat');
  assert.equal(classifyCommit('fix(api): null guard'), 'fix');
  assert.equal(classifyCommit('feat!: breaking change'), 'feat');
  assert.equal(classifyCommit('refactor: tidy'), 'refactor');
  assert.equal(classifyCommit('perf: speed up'), 'perf');
  assert.equal(classifyCommit('docs: readme'), 'docs');
});

test('classifyCommit falls back to other', () => {
  assert.equal(classifyCommit('updated stuff'), 'other');
  assert.equal(classifyCommit('WIP'), 'other');
  assert.equal(classifyCommit('feature: not conventional'), 'other');
});
