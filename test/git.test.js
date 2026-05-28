import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitSnapshot, newCommitsSince } from '../src/git.js';

function fakeGit(map) {
  // map: key = args.join(' ') => { code, stdout }
  const calls = [];
  const run = (args) => {
    calls.push(args.join(' '));
    return map[args.join(' ')] ?? { code: 1, stdout: '' };
  };
  run.calls = calls;
  return run;
}

test('gitSnapshot reads branch, dirty count, and last commit', () => {
  const now = new Date('2026-05-28T12:00:00Z');
  const ct = Math.floor(now.getTime() / 1000) - 3600; // committed 60 min ago
  const run = fakeGit({
    'rev-parse --is-inside-work-tree': { code: 0, stdout: 'true\n' },
    'rev-parse --abbrev-ref HEAD': { code: 0, stdout: 'main\n' },
    'status --porcelain': { code: 0, stdout: ' M a.js\n?? b.js\n' },
    'log -1 --format=%H %ct': { code: 0, stdout: `abc123 ${ct}\n` },
  });
  const snap = gitSnapshot(run, now);
  assert.equal(snap.isRepo, true);
  assert.equal(snap.branch, 'main');
  assert.equal(snap.dirtyCount, 2);
  assert.equal(snap.lastCommitHash, 'abc123');
  assert.equal(snap.minsSinceLastCommit, 60);
});

test('gitSnapshot reports non-repo cleanly', () => {
  const run = fakeGit({ 'rev-parse --is-inside-work-tree': { code: 128, stdout: '' } });
  const snap = gitSnapshot(run, new Date());
  assert.equal(snap.isRepo, false);
});

test('newCommitsSince parses hash and subject, keeping spaces in the subject', () => {
  const run = fakeGit({
    'log abc..HEAD --format=%H %s': { code: 0, stdout: 'h2 feat: x\nh1 fix: y\n' },
  });
  const commits = newCommitsSince(run, 'abc');
  assert.deepEqual(commits, [
    { hash: 'h2', message: 'feat: x' },
    { hash: 'h1', message: 'fix: y' },
  ]);
});

test('newCommitsSince with no baseline returns only HEAD (no backfill)', () => {
  const run = fakeGit({
    'log -1 --format=%H %s': { code: 0, stdout: 'head1 initial\n' },
  });
  const commits = newCommitsSince(run, null);
  assert.deepEqual(commits, [{ hash: 'head1', message: 'initial' }]);
});
