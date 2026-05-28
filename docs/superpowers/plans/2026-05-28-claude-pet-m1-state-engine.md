# claude-pet M1: State Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only state engine for the claude-pet plugin: Claude Code hooks that observe coding activity and persist a growing pet (XP/level/mood/streak/achievements) plus a current-project status snapshot, exposed via a `/pet` CLI — with a hard invariant of zero side-effects on the user's project.

**Architecture:** Pure functions (XP/levels/mood/commit-classification/test-detection/achievements/transcript parsing) + a read-only git snapshot module, composed by an `engine` that maps an observed event to a new pet+status state, persisted atomically under `~/.claude-pet/`. A thin `bin/hook.js` reads hook JSON on stdin and dispatches to the engine; `bin/pet.js` is the user-facing CLI. No widget in M1.

**Tech Stack:** Node.js ≥ 18 (developed on 22), ESM modules, built-in `node:test` runner + `node:assert/strict` (zero runtime deps). Claude Code plugin hooks.

**Spec:** `docs/superpowers/specs/2026-05-28-claude-pet-design.md` (this plan covers milestone M1).

---

## Invariant (applies to every task)

The engine is **read-only with respect to the user's project**:
- Never write anywhere except under `~/.claude-pet/` (overridable by `CLAUDE_PET_HOME` for tests).
- Only ever run read-only git subcommands: `status`, `log`, `tag`, `rev-parse`, `config`. Never `add/commit/checkout/tag <new>/push/reset/...`.
- Hooks always exit 0 and never block Claude.

Task 16 enforces this with an automated test. Keep it true in every task.

## File Structure

```
claude-pet/                      (plugin root = repo root)
├── .claude-plugin/plugin.json   minimal manifest (name + hooks/commands paths)
├── hooks/hooks.json             wires SessionStart, PostToolUse, Stop
├── commands/pet.md              /pet slash command → runs bin/pet.js
├── bin/
│   ├── hook.js                  hook entrypoint: stdin JSON → engine → persist
│   └── pet.js                   CLI: status | adopt | rename | milestone
├── src/
│   ├── constants.js             all tunable numbers in one place
│   ├── levels.js                levelForXp, stageForLevel
│   ├── xp.js                    xpForEvent, applyStreakMultiplier
│   ├── commits.js               classifyCommit
│   ├── tests-detect.js          isTestCommand, isTestSuccess
│   ├── mood.js                  moodAfterEvent, moodAfterDecay, moodAfterFailure, expressionFor
│   ├── achievements.js          ACHIEVEMENTS, unlockAchievements
│   ├── transcript.js            parseTranscriptUsage
│   ├── git.js                   gitSnapshot, newCommitsSince (injected runner)
│   ├── state.js                 paths, defaultPet, load/save (atomic)
│   └── engine.js                applyEvent, buildStatus, updateStreak
├── test/                        one *.test.js per src module + integration + invariant
├── package.json
└── .gitignore
```

Each `src/*.js` has one responsibility and is unit-tested in isolation. `engine.js` composes them. `bin/*` are thin I/O shells.

---

### Task 1: Project skeleton

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.claude-plugin/plugin.json`
- Create: `src/constants.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "claude-pet",
  "version": "0.1.0",
  "description": "A desktop pet that grows as you code with Claude Code (state engine).",
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
*.log
.DS_Store
```

- [ ] **Step 3: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "claude-pet",
  "description": "A desktop pet that grows as you code with Claude Code.",
  "version": "0.1.0"
}
```

- [ ] **Step 4: Create `src/constants.js`** (single source of tunable values)

```js
export const SCHEMA_VERSION = 1;

// XP per event (base, before streak multiplier)
export const LINE_XP_PER = 1;
export const LINE_XP_CAP_PER_EVENT = 30;
export const LINE_XP_CAP_PER_SESSION = 200;
export const NEW_FILE_XP = 15;
export const TEST_PASS_XP = 40;
export const TEST_XP_CAP_PER_SESSION = 160;
export const MILESTONE_XP = 300;
export const TOKENS_XP_PER_100K = 5;
export const COMMIT_XP = {
  feat: 120, fix: 60, refactor: 50, perf: 50,
  test: 40, docs: 40, chore: 40, other: 40,
};

// Levels: index i (0-based) => minimum cumulative XP for level i+1
export const LEVEL_THRESHOLDS = [0, 150, 450, 1000, 2200, 4500, 9000];

// Streak
export const STREAK_STEP = 0.05;
export const STREAK_MAX_MULT = 2.0;

// Mood
export const MOOD_INIT = 80;
export const MOOD_FLOOR = 10;
export const MOOD_CEIL = 100;
export const MOOD_DELTA = { feat: 10, milestone: 15, testPass: 6, commit: 2, activity: 2 };
export const MOOD_FAILURE_DELTA = -8;
export const MOOD_DECAY_PER_HOUR = 5;
export const FAILURE_WINDOW_MIN = 30;
export const FAILURE_STREAK_THRESHOLD = 3;

// Status alert thresholds
export const CONTEXT_ALERT_PCT = 80;
export const GIT_DIRTY_ALERT = 15;
export const COMMIT_AGE_ALERT_MIN = 120;
export const REST_ALERT_MIN = 90;

// Context window size used to estimate contextUsedPct from token counts.
export const CONTEXT_WINDOW_TOKENS = Number(process.env.CLAUDE_PET_CONTEXT_WINDOW || 200000);
```

- [ ] **Step 5: Verify the test runner works (no tests yet = exit 0)**

Run: `node --test`
Expected: exits 0 with "tests 0" (no test files yet).

- [ ] **Step 6: Commit**

```bash
git init
git add package.json .gitignore .claude-plugin/plugin.json src/constants.js
git commit -m "chore: scaffold claude-pet state engine project"
```

---

### Task 2: Levels (`src/levels.js`)

**Files:**
- Create: `src/levels.js`
- Test: `test/levels.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelForXp, stageForLevel } from '../src/levels.js';

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

test('stageForLevel names life stages', () => {
  assert.equal(stageForLevel(1), 'egg');
  assert.equal(stageForLevel(2), 'hatchling');
  assert.equal(stageForLevel(3), 'child');
  assert.equal(stageForLevel(4), 'teen');
  assert.equal(stageForLevel(5), 'adult');
  assert.equal(stageForLevel(6), 'evolved1');
  assert.equal(stageForLevel(8), 'evolved3');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/levels.test.js`
Expected: FAIL — cannot find module `../src/levels.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import { LEVEL_THRESHOLDS } from './constants.js';

function thresholdForLevel(level) {
  // level is 1-based. Use table where available, else double the last entry.
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return last * Math.pow(2, level - LEVEL_THRESHOLDS.length);
}

export function levelForXp(xp) {
  let level = 1;
  while (xp >= thresholdForLevel(level + 1)) level++;
  return level;
}

export function stageForLevel(level) {
  const stages = { 1: 'egg', 2: 'hatchling', 3: 'child', 4: 'teen', 5: 'adult' };
  return stages[level] || `evolved${level - 5}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/levels.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/levels.js test/levels.test.js
git commit -m "feat: add level and life-stage computation"
```

---

### Task 3: XP events (`src/xp.js`)

**Files:**
- Create: `src/xp.js`
- Test: `test/xp.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForEvent, applyStreakMultiplier } from '../src/xp.js';

test('xpForEvent: lines are capped per event', () => {
  assert.equal(xpForEvent({ type: 'lines', count: 10 }), 10);
  assert.equal(xpForEvent({ type: 'lines', count: 500 }), 30);
  assert.equal(xpForEvent({ type: 'lines', count: 0 }), 0);
});

test('xpForEvent: fixed-value events', () => {
  assert.equal(xpForEvent({ type: 'newFile' }), 15);
  assert.equal(xpForEvent({ type: 'testPass' }), 40);
  assert.equal(xpForEvent({ type: 'milestone' }), 300);
});

test('xpForEvent: commit value depends on kind', () => {
  assert.equal(xpForEvent({ type: 'commit', kind: 'feat' }), 120);
  assert.equal(xpForEvent({ type: 'commit', kind: 'fix' }), 60);
  assert.equal(xpForEvent({ type: 'commit', kind: 'other' }), 40);
});

test('xpForEvent: tokens award per 100k', () => {
  assert.equal(xpForEvent({ type: 'tokens', tokens: 250000 }), 10);
  assert.equal(xpForEvent({ type: 'tokens', tokens: 50000 }), 0);
});

test('applyStreakMultiplier ramps then caps at 2x', () => {
  assert.equal(applyStreakMultiplier(100, 1), 100);
  assert.equal(applyStreakMultiplier(100, 3), 110); // 1 + 0.05*2 = 1.1
  assert.equal(applyStreakMultiplier(100, 100), 200); // capped
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/xp.test.js`
Expected: FAIL — cannot find module `../src/xp.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import {
  LINE_XP_PER, LINE_XP_CAP_PER_EVENT, NEW_FILE_XP, TEST_PASS_XP,
  MILESTONE_XP, TOKENS_XP_PER_100K, COMMIT_XP, STREAK_STEP, STREAK_MAX_MULT,
} from './constants.js';

export function xpForEvent(event) {
  switch (event.type) {
    case 'lines':
      return Math.min((event.count || 0) * LINE_XP_PER, LINE_XP_CAP_PER_EVENT);
    case 'newFile': return NEW_FILE_XP;
    case 'testPass': return TEST_PASS_XP;
    case 'milestone': return MILESTONE_XP;
    case 'commit': return COMMIT_XP[event.kind] ?? COMMIT_XP.other;
    case 'tokens': return Math.floor((event.tokens || 0) / 100000) * TOKENS_XP_PER_100K;
    default: return 0;
  }
}

export function applyStreakMultiplier(baseXp, streakDays) {
  const days = Math.max(1, streakDays || 1);
  const mult = Math.min(1 + STREAK_STEP * (days - 1), STREAK_MAX_MULT);
  return Math.round(baseXp * mult);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/xp.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/xp.js test/xp.test.js
git commit -m "feat: add per-event XP values and streak multiplier"
```

---

### Task 4: Commit classification (`src/commits.js`)

**Files:**
- Create: `src/commits.js`
- Test: `test/commits.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commits.test.js`
Expected: FAIL — cannot find module `../src/commits.js`.

- [ ] **Step 3: Write minimal implementation**

```js
const KNOWN = new Set(['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore']);

export function classifyCommit(message) {
  const m = /^(\w+)(\([^)]*\))?!?:/.exec((message || '').trim());
  if (m && KNOWN.has(m[1])) return m[1];
  return 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commits.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commits.js test/commits.test.js
git commit -m "feat: classify commits by conventional-commit type"
```

---

### Task 5: Test-run detection (`src/tests-detect.js`)

**Files:**
- Create: `src/tests-detect.js`
- Test: `test/tests-detect.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tests-detect.test.js`
Expected: FAIL — cannot find module `../src/tests-detect.js`.

- [ ] **Step 3: Write minimal implementation**

```js
const TEST_CMD = /(^|\s|&&|;|\|)(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|vitest|jest|mocha|pytest|py\.test|unittest|go\s+test|cargo\s+test|node\s+--test|rspec|phpunit|gradle\s+test|mvn\s+test/i;
const PASS = /\b(\d+\s+passed|all tests passed|tests?\s+passed|ok\b|✓|PASS\b)/i;
// Only treat a NON-ZERO failure/error count (or an explicit FAIL/✗ marker) as failure,
// so "5 passed, 0 failed" is still a success.
const FAIL = /[1-9]\d*\s+(failed|failures|errors?)|✗|\bFAIL\b/i;

export function isTestCommand(cmd) {
  return TEST_CMD.test(cmd || '');
}

export function isTestSuccess(output, exitCode) {
  if (exitCode !== null && exitCode !== undefined) return exitCode === 0;
  const text = output || '';
  return PASS.test(text) && !FAIL.test(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/tests-detect.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tests-detect.js test/tests-detect.test.js
git commit -m "feat: detect test-runner commands and success"
```

---

### Task 6: Mood (`src/mood.js`)

**Files:**
- Create: `src/mood.js`
- Test: `test/mood.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/mood.test.js`
Expected: FAIL — cannot find module `../src/mood.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import { MOOD_DELTA, MOOD_FAILURE_DELTA, MOOD_DECAY_PER_HOUR, MOOD_FLOOR, MOOD_CEIL } from './constants.js';

const clamp = (v) => Math.max(MOOD_FLOOR, Math.min(MOOD_CEIL, v));

export function moodAfterEvent(mood, eventType) {
  return clamp(mood + (MOOD_DELTA[eventType] || 0));
}

export function moodAfterFailure(mood) {
  return clamp(mood + MOOD_FAILURE_DELTA);
}

export function moodAfterDecay(mood, hoursIdle) {
  return clamp(Math.round(mood - MOOD_DECAY_PER_HOUR * (hoursIdle || 0)));
}

export function expressionFor({ mood, recentFailureActive }) {
  if (recentFailureActive) return 'worried';
  if (mood >= 80) return 'flow';
  if (mood >= 60) return 'happy';
  if (mood >= 35) return 'normal';
  if (mood >= 15) return 'sleepy';
  return 'bored';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/mood.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mood.js test/mood.test.js
git commit -m "feat: add mood transitions and expression bands"
```

---

### Task 7: Achievements (`src/achievements.js`)

**Files:**
- Create: `src/achievements.js`
- Test: `test/achievements.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/achievements.test.js`
Expected: FAIL — cannot find module `../src/achievements.js`.

- [ ] **Step 3: Write minimal implementation**

```js
export const ACHIEVEMENTS = [
  { id: 'first-hatch',   test: (p) => p.level >= 2 },
  { id: 'first-feat',    test: (p) => p.lifetime.features >= 1 },
  { id: 'first-green',   test: (p) => p.lifetime.testsPassed >= 1 },
  { id: 'first-release', test: (p) => p.lifetime.releases >= 1 },
  { id: 'week-streak',   test: (p) => p.streak.days >= 7 },
  { id: 'century',       test: (p) => p.lifetime.commits >= 100 },
];

export function unlockAchievements(pet) {
  const held = new Set((pet.achievements || []).map((a) => a.id));
  return ACHIEVEMENTS.filter((a) => !held.has(a.id) && a.test(pet)).map((a) => a.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/achievements.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/achievements.js test/achievements.test.js
git commit -m "feat: add achievement unlock rules"
```

---

### Task 8: Transcript usage parsing (`src/transcript.js`)

**Files:**
- Create: `src/transcript.js`
- Test: `test/transcript.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscriptUsage } from '../src/transcript.js';

const sample = [
  '{"type":"user","message":{"role":"user"}}',
  '{"type":"assistant","message":{"usage":{"input_tokens":1000,"output_tokens":200,"cache_read_input_tokens":3000}}}',
  'not json — should be skipped',
  '{"type":"assistant","message":{"usage":{"input_tokens":1500,"output_tokens":300,"cache_read_input_tokens":5000}}}',
].join('\n');

test('parseTranscriptUsage sums tokens and reports last context size', () => {
  const u = parseTranscriptUsage(sample);
  assert.equal(u.totalInputTokens, 2500);
  assert.equal(u.totalOutputTokens, 500);
  assert.equal(u.totalTokens, 3000);
  // last assistant message context ≈ input + cache tokens of the final usage
  assert.equal(u.lastContextTokens, 1500 + 5000);
});

test('parseTranscriptUsage tolerates empty input', () => {
  const u = parseTranscriptUsage('');
  assert.deepEqual(u, { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, lastContextTokens: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/transcript.test.js`
Expected: FAIL — cannot find module `../src/transcript.js`.

- [ ] **Step 3: Write minimal implementation**

```js
export function parseTranscriptUsage(jsonlText) {
  let totalInputTokens = 0, totalOutputTokens = 0, lastContextTokens = 0;
  for (const line of (jsonlText || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    const usage = obj?.message?.usage;
    if (!usage) continue;
    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    const cache = (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    totalInputTokens += input;
    totalOutputTokens += output;
    lastContextTokens = input + cache;
  }
  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    lastContextTokens,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/transcript.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/transcript.js test/transcript.test.js
git commit -m "feat: parse token usage from session transcript"
```

---

### Task 9: Read-only git snapshot (`src/git.js`)

**Files:**
- Create: `src/git.js`
- Test: `test/git.test.js`

`gitSnapshot` and `newCommitsSince` take an injected `runGit(args) => { code, stdout }` so tests never touch a real repo and the read-only invariant is provable. `runGit` only ever receives read-only subcommands. Fields are space-separated; since a git hash never contains a space, we split on the FIRST space only, so commit subjects that contain spaces stay intact.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/git.test.js`
Expected: FAIL — cannot find module `../src/git.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// git --format outputs "<hash> <field>"; a hash never contains a space, so we
// split on the FIRST space only and keep the rest (the commit subject) intact.
function splitFirst(line) {
  const i = line.indexOf(' ');
  return i === -1 ? [line, ''] : [line.slice(0, i), line.slice(i + 1)];
}

export function gitSnapshot(runGit, now = new Date()) {
  const inside = runGit(['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return { isRepo: false };

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const status = runGit(['status', '--porcelain']).stdout;
  const dirtyCount = status.split('\n').filter((l) => l.trim().length > 0).length;

  const log = runGit(['log', '-1', '--format=%H %ct']);
  let lastCommitHash = null, minsSinceLastCommit = null;
  if (log.code === 0 && log.stdout.trim()) {
    const [hash, ct] = splitFirst(log.stdout.trim());
    lastCommitHash = hash;
    minsSinceLastCommit = Math.round((now.getTime() / 1000 - Number(ct)) / 60);
  }
  return { isRepo: true, branch, dirtyCount, lastCommitHash, minsSinceLastCommit };
}

export function newCommitsSince(runGit, lastSeenHash) {
  const fmt = '--format=%H %s';
  if (!lastSeenHash) {
    const head = runGit(['log', '-1', fmt]);
    if (head.code !== 0 || !head.stdout.trim()) return [];
    const [hash, message] = splitFirst(head.stdout.trim());
    return [{ hash, message }];
  }
  const out = runGit(['log', `${lastSeenHash}..HEAD`, fmt]);
  if (out.code !== 0) return [];
  return out.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const [hash, message] = splitFirst(l);
      return { hash, message };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/git.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/git.js test/git.test.js
git commit -m "feat: add read-only git snapshot and new-commit detection"
```

---

### Task 10: State persistence (`src/state.js`)

**Files:**
- Create: `src/state.js`
- Test: `test/state.test.js`

Paths are rooted at `CLAUDE_PET_HOME` if set, else `~/.claude-pet`. Tests set `CLAUDE_PET_HOME` to a temp dir.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CLAUDE_PET_HOME = dir;
  return dir;
}

test('defaultPet is an unadopted egg', async () => {
  freshHome();
  const { defaultPet } = await import('../src/state.js?1');
  const p = defaultPet('2026-05-28T00:00:00Z');
  assert.equal(p.species, null);
  assert.equal(p.level, 1);
  assert.equal(p.stage, 'egg');
  assert.equal(p.xp, 0);
  assert.equal(p.mood, 80);
});

test('savePet then loadPet round-trips', async () => {
  freshHome();
  const { defaultPet, savePet, loadPet } = await import('../src/state.js?2');
  const p = defaultPet('2026-05-28T00:00:00Z');
  p.xp = 123;
  savePet(p);
  assert.equal(loadPet().xp, 123);
});

test('loadPet returns a default when no file exists', async () => {
  freshHome();
  const { loadPet } = await import('../src/state.js?3');
  assert.equal(loadPet().xp, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/state.test.js`
Expected: FAIL — cannot find module `../src/state.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA_VERSION, MOOD_INIT } from './constants.js';

export function baseDir() {
  return process.env.CLAUDE_PET_HOME || path.join(os.homedir(), '.claude-pet');
}
export const petPath = () => path.join(baseDir(), 'pet.json');
export const statusPath = () => path.join(baseDir(), 'status.json');

export function defaultPet(nowIso = new Date().toISOString()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    species: null,
    name: null,
    birthday: nowIso,
    xp: 0,
    level: 1,
    stage: 'egg',
    mood: MOOD_INIT,
    lastActivityAt: nowIso,
    recentFailureUntil: null,
    streak: { days: 1, lastActiveDate: nowIso.slice(0, 10) },
    achievements: [],
    lifetime: { linesAdded: 0, tokens: 0, sessions: 0, commits: 0, testsPassed: 0, features: 0, releases: 0 },
    repos: {},
  };
}

function writeAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function loadPet() { return readJson(petPath(), defaultPet()); }
export function savePet(pet) { writeAtomic(petPath(), pet); }
export function loadStatus() { return readJson(statusPath(), null); }
export function saveStatus(status) { writeAtomic(statusPath(), status); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/state.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state.js test/state.test.js
git commit -m "feat: add atomic pet/status persistence with CLAUDE_PET_HOME override"
```

---

### Task 11: Engine orchestration (`src/engine.js`)

**Files:**
- Create: `src/engine.js`
- Test: `test/engine.test.js`

`applyEvent(pet, sessionAcc, event, now)` is pure: it returns a new `{ pet, sessionAcc, unlocked }` without doing I/O. `sessionAcc` tracks per-session XP caps `{ linesXp, testXp }`. Recognized event types: `lines {count}`, `newFile`, `testPass`, `failure`, `commit {kind}`, `milestone`, `tokens {tokens}`, `idle` (applies decay only). `updateStreak(streak, now)` advances/resets daily streak. `buildStatus(snapshot, usage, now)` assembles `status.json` with `alerts`.

- [ ] **Step 1: Write the failing test**

```js
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

test('failure lowers mood and sets recentFailureUntil', () => {
  const { pet } = applyEvent(defaultPet(T0.toISOString()), acc(), { type: 'failure' }, T0);
  assert.equal(pet.mood, 72);
  assert.ok(new Date(pet.recentFailureUntil) > T0);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — cannot find module `../src/engine.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import { xpForEvent, applyStreakMultiplier } from './xp.js';
import { levelForXp, stageForLevel } from './levels.js';
import { moodAfterEvent, moodAfterFailure, moodAfterDecay } from './mood.js';
import { unlockAchievements } from './achievements.js';
import {
  LINE_XP_CAP_PER_SESSION, TEST_XP_CAP_PER_SESSION, FAILURE_WINDOW_MIN,
  CONTEXT_WINDOW_TOKENS, CONTEXT_ALERT_PCT, GIT_DIRTY_ALERT, COMMIT_AGE_ALERT_MIN, REST_ALERT_MIN,
} from './constants.js';

const MOOD_EVENT = { commit: 'commit', feat: 'feat', milestone: 'milestone', testPass: 'testPass', lines: 'activity', newFile: 'activity' };

function hoursBetween(aIso, bDate) {
  return Math.max(0, (bDate.getTime() - new Date(aIso).getTime()) / 3600000);
}

export function updateStreak(streak, now) {
  const today = now.toISOString().slice(0, 10);
  if (streak.lastActiveDate === today) return { ...streak };
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const days = streak.lastActiveDate === yesterday ? streak.days + 1 : 1;
  return { days, lastActiveDate: today };
}

export function applyEvent(pet, sessionAcc, event, now = new Date()) {
  const next = structuredClone(pet);
  const acc = { ...sessionAcc };
  const nowIso = now.toISOString();

  // Always decay mood for idle time elapsed since last activity, then apply event.
  next.mood = moodAfterDecay(next.mood, hoursBetween(next.lastActivityAt, now));

  if (event.type === 'idle') {
    return { pet: next, sessionAcc: acc, unlocked: [] };
  }

  // Streak + activity timestamp on any real activity.
  next.streak = updateStreak(next.streak, now);
  next.lastActivityAt = nowIso;

  // XP (with per-session caps for grindable sources), scaled by streak.
  let base = xpForEvent(event);
  if (event.type === 'lines') {
    const room = Math.max(0, LINE_XP_CAP_PER_SESSION - acc.linesXp);
    base = Math.min(base, room);
    acc.linesXp += base;
  } else if (event.type === 'testPass') {
    const room = Math.max(0, TEST_XP_CAP_PER_SESSION - acc.testXp);
    base = Math.min(base, room);
    acc.testXp += base;
  }
  next.xp += applyStreakMultiplier(base, next.streak.days);

  // Lifetime counters.
  if (event.type === 'lines') next.lifetime.linesAdded += event.count || 0;
  if (event.type === 'tokens') next.lifetime.tokens += event.tokens || 0;
  if (event.type === 'testPass') next.lifetime.testsPassed += 1;
  if (event.type === 'milestone') next.lifetime.releases += 1;
  if (event.type === 'commit') {
    next.lifetime.commits += 1;
    if (event.kind === 'feat') next.lifetime.features += 1;
  }

  // Mood.
  if (event.type === 'failure') {
    next.mood = moodAfterFailure(next.mood);
    next.recentFailureUntil = new Date(now.getTime() + FAILURE_WINDOW_MIN * 60000).toISOString();
  } else {
    const moodKey = event.type === 'commit' && event.kind === 'feat' ? 'feat' : MOOD_EVENT[event.type];
    if (moodKey) next.mood = moodAfterEvent(next.mood, moodKey);
  }

  // Level + stage.
  next.level = levelForXp(next.xp);
  next.stage = next.species === null && next.level < 2 ? 'egg' : stageForLevel(next.level);

  // Achievements.
  const unlocked = unlockAchievements(next);
  for (const id of unlocked) next.achievements.push({ id, at: nowIso });

  return { pet: next, sessionAcc: acc, unlocked };
}

export function buildStatus({ cwd, repo, snapshot, usage, costUsd, activeMins }, now = new Date()) {
  const contextUsedPct = Math.round((100 * (usage?.lastContextTokens || 0)) / CONTEXT_WINDOW_TOKENS);
  const alerts = [];
  if (contextUsedPct > CONTEXT_ALERT_PCT) alerts.push('context');
  if ((snapshot?.dirtyCount || 0) > GIT_DIRTY_ALERT || (snapshot?.minsSinceLastCommit || 0) > COMMIT_AGE_ALERT_MIN) alerts.push('git');
  if ((activeMins || 0) > REST_ALERT_MIN) alerts.push('rest');
  return {
    schemaVersion: 1,
    cwd,
    repo: repo || null,
    branch: snapshot?.branch || null,
    contextUsedPct,
    sessionCostUsd: costUsd || 0,
    sessionTokens: usage?.totalTokens || 0,
    gitDirtyCount: snapshot?.dirtyCount ?? null,
    minsSinceLastCommit: snapshot?.minsSinceLastCommit ?? null,
    alerts,
    updatedAt: now.toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat: compose pet state transitions and status building in engine"
```

---

### Task 12: Session accumulator persistence (`src/session.js`)

**Files:**
- Create: `src/session.js`
- Test: `test/session.test.js`

Per-session XP caps need a tiny per-`session_id` file so caps survive across the many hook invocations within one Claude session.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('session accumulator defaults to zero and round-trips', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { loadSession, saveSession } = await import('../src/session.js?1');
  assert.deepEqual(loadSession('sess-1'), { linesXp: 0, testXp: 0, startedAt: null, failures: 0 });
  saveSession('sess-1', { linesXp: 50, testXp: 0, startedAt: '2026-05-28T10:00:00Z', failures: 1 });
  assert.equal(loadSession('sess-1').linesXp, 50);
  assert.equal(loadSession('sess-2').linesXp, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/session.test.js`
Expected: FAIL — cannot find module `../src/session.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import fs from 'node:fs';
import path from 'node:path';
import { baseDir } from './state.js';

function sessionFile(id) {
  const safe = String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(baseDir(), `session-${safe}.json`);
}

export function loadSession(id) {
  try { return JSON.parse(fs.readFileSync(sessionFile(id), 'utf8')); }
  catch { return { linesXp: 0, testXp: 0, startedAt: null, failures: 0 }; }
}

export function saveSession(id, acc) {
  const file = sessionFile(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(acc));
  fs.renameSync(tmp, file);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/session.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/session.js test/session.test.js
git commit -m "feat: persist per-session XP accumulator"
```

---

### Task 13: Real git runner + hook entrypoint (`bin/hook.js`)

**Files:**
- Create: `src/run-git.js`
- Create: `bin/hook.js`
- Test: `test/hook.test.js`

`src/run-git.js` is the only place that spawns git — read-only by construction. `bin/hook.js` reads the hook JSON from stdin, derives an event, applies it, and persists. It always exits 0.

- [ ] **Step 1: Write `src/run-git.js`** (no test; exercised via integration)

```js
import { spawnSync } from 'node:child_process';

const ALLOWED = new Set(['rev-parse', 'status', 'log']);

export function makeGitRunner(cwd) {
  return function runGit(args) {
    if (!ALLOWED.has(args[0])) {
      throw new Error(`refusing non-read-only git subcommand: ${args[0]}`);
    }
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return { code: r.status ?? 1, stdout: r.stdout || '' };
  };
}
```

- [ ] **Step 2: Write the failing test** (`test/hook.test.js`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runHook(home, payload) {
  const r = spawnSync('node', ['bin/hook.js'], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });
  return r;
}

test('PostToolUse Write event adds line XP to pet.json and exits 0', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = runHook(home, {
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    cwd: home, // a dir that is not a git repo; snapshot stays read-only
    tool_name: 'Write',
    tool_input: { file_path: path.join(home, 'new.js'), content: 'a\nb\nc\n' },
    tool_response: {},
  });
  assert.equal(r.status, 0);
  const pet = JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8'));
  assert.ok(pet.xp > 0);
  assert.equal(pet.lifetime.linesAdded, 3);
});

test('PostToolUse MultiEdit counts lines across all edits', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = runHook(home, {
    hook_event_name: 'PostToolUse',
    session_id: 's1',
    cwd: home,
    tool_name: 'MultiEdit',
    tool_input: {
      file_path: path.join(home, 'x.js'),
      edits: [{ old_string: 'a', new_string: 'a\nb' }, { old_string: 'c', new_string: 'c\nd\ne' }],
    },
    tool_response: {},
  });
  assert.equal(r.status, 0);
  const pet = JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8'));
  assert.equal(pet.lifetime.linesAdded, 5); // 2 + 3 lines across the two edits
});

test('SessionStart bumps session count and exits 0', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = runHook(home, { hook_event_name: 'SessionStart', session_id: 's1', cwd: home, source: 'startup' });
  assert.equal(r.status, 0);
  const pet = JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8'));
  assert.equal(pet.lifetime.sessions, 1);
});

test('malformed stdin still exits 0 (never blocks Claude)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = spawnSync('node', ['bin/hook.js'], {
    input: 'not json',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });
  assert.equal(r.status, 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/hook.test.js`
Expected: FAIL — cannot find module `bin/hook.js`.

- [ ] **Step 4: Write minimal implementation** (`bin/hook.js`)

```js
#!/usr/bin/env node
import { loadPet, savePet, saveStatus } from '../src/state.js';
import { loadSession, saveSession } from '../src/session.js';
import { applyEvent, buildStatus } from '../src/engine.js';
import { makeGitRunner } from '../src/run-git.js';
import { gitSnapshot, newCommitsSince } from '../src/git.js';
import { classifyCommit } from '../src/commits.js';
import { isTestCommand, isTestSuccess } from '../src/tests-detect.js';
import { parseTranscriptUsage } from '../src/transcript.js';
import fs from 'node:fs';

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function countText(s) {
  return s ? s.split('\n').filter((l) => l.length > 0).length : 0;
}

function countLines(toolInput) {
  // MultiEdit carries an `edits` array; Write has `content`; Edit has `new_string`.
  if (Array.isArray(toolInput?.edits)) {
    return toolInput.edits.reduce((n, e) => n + countText(e.new_string), 0);
  }
  return countText(toolInput?.content ?? toolInput?.new_string);
}

function main() {
  const raw = readStdin();
  let hook;
  try { hook = JSON.parse(raw); } catch { return; } // exit 0
  const now = new Date();
  let pet = loadPet();
  let session = loadSession(hook.session_id);
  const events = [];

  const event = hook.hook_event_name;
  if (event === 'SessionStart') {
    pet.lifetime.sessions += 1;
    session.startedAt = now.toISOString();
  } else if (event === 'PostToolUse') {
    if (['Write', 'Edit', 'MultiEdit'].includes(hook.tool_name)) {
      events.push({ type: 'lines', count: countLines(hook.tool_input) });
    }
    if (hook.tool_name === 'Bash' && isTestCommand(hook.tool_input?.command)) {
      const out = `${hook.tool_response?.stdout || ''}${hook.tool_response?.stderr || ''}`;
      const code = hook.tool_response?.exit_code ?? hook.tool_response?.exitCode ?? null;
      events.push(isTestSuccess(out, code) ? { type: 'testPass' } : { type: 'failure' });
    }
  }

  // Read-only git: detect new commits since last seen, per repo.
  let snapshot = { isRepo: false };
  if (hook.cwd) {
    const runGit = makeGitRunner(hook.cwd);
    try {
      snapshot = gitSnapshot(runGit, now);
      if (snapshot.isRepo) {
        const repoKey = hook.cwd;
        pet.repos[repoKey] = pet.repos[repoKey] || { lastSeenCommit: null };
        const seen = pet.repos[repoKey].lastSeenCommit;
        const fresh = newCommitsSince(runGit, seen);
        if (seen) {
          for (const c of fresh) events.push({ type: 'commit', kind: classifyCommit(c.message) });
        }
        if (fresh[0]) pet.repos[repoKey].lastSeenCommit = fresh[0].hash;
      }
    } catch { /* read-only failure: ignore, exit 0 */ }
  }

  // token usage from transcript
  let usage = { totalTokens: 0, lastContextTokens: 0 };
  if (hook.transcript_path && fs.existsSync(hook.transcript_path)) {
    usage = parseTranscriptUsage(fs.readFileSync(hook.transcript_path, 'utf8'));
  }

  // Apply all derived events.
  let acc = session;
  if (events.length === 0) events.push({ type: 'idle' });
  for (const ev of events) {
    const res = applyEvent(pet, acc, ev, now);
    pet = res.pet;
    acc = { ...acc, ...res.sessionAcc };
  }
  session = acc;

  // Persist.
  savePet(pet);
  saveSession(hook.session_id, session);
  const activeMins = session.startedAt ? (now - new Date(session.startedAt)) / 60000 : 0;
  saveStatus(buildStatus({
    cwd: hook.cwd, repo: snapshot.isRepo ? hook.cwd : null,
    snapshot, usage, costUsd: 0, activeMins,
  }, now));
}

try { main(); } catch { /* never block Claude */ } finally { process.exit(0); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/hook.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/run-git.js bin/hook.js test/hook.test.js
git commit -m "feat: add read-only git runner and hook entrypoint"
```

---

### Task 14: Wire hooks (`hooks/hooks.json`)

**Files:**
- Create: `hooks/hooks.json`

- [ ] **Step 1: Create `hooks/hooks.json`**

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/hook.js\"" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write|MultiEdit|Bash",
        "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/hook.js\"" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/hook.js\"" } ] }
    ]
  }
}
```

- [ ] **Step 2: Sanity-check it is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat: wire SessionStart/PostToolUse/Stop hooks"
```

---

### Task 15: `/pet` CLI (`bin/pet.js`) + command

**Files:**
- Create: `bin/pet.js`
- Create: `commands/pet.md`
- Test: `test/pet-cli.test.js`

Subcommands: `status` (default), `adopt <species>`, `rename <name>`, `milestone <description>`. All write only to `~/.claude-pet/`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function pet(home, args, input) {
  return spawnSync('node', ['bin/pet.js', ...args], {
    encoding: 'utf8', input: input || '',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });
}

test('adopt sets species; status prints it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  assert.equal(pet(home, ['adopt', 'dragon']).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8')).species, 'dragon');
  const out = pet(home, ['status']).stdout;
  assert.match(out, /dragon/);
  assert.match(out, /Lv\s*1/i);
});

test('adopt rejects unknown species', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const r = pet(home, ['adopt', 'unicorn']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown species/i);
});

test('milestone awards 300 xp', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  pet(home, ['adopt', 'cat']);
  pet(home, ['milestone', 'shipped v1']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'pet.json'), 'utf8')).xp, 300);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pet-cli.test.js`
Expected: FAIL — cannot find module `bin/pet.js`.

- [ ] **Step 3: Write minimal implementation** (`bin/pet.js`)

```js
#!/usr/bin/env node
import { loadPet, savePet, loadStatus } from '../src/state.js';
import { applyEvent } from '../src/engine.js';

const SPECIES = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];
const [cmd = 'status', ...rest] = process.argv.slice(2);

function printStatus() {
  const pet = loadPet();
  const status = loadStatus();
  const name = pet.name || (pet.species ? pet.species : 'egg');
  console.log(`${name} — Lv ${pet.level} (${pet.stage}), mood ${pet.mood}, xp ${pet.xp}`);
  if (pet.species === null) console.log('Not adopted yet — run: /pet adopt <species>  (' + SPECIES.join(', ') + ')');
  console.log(`achievements: ${pet.achievements.map((a) => a.id).join(', ') || 'none'}`);
  if (status) {
    console.log(`project: ${status.repo || status.cwd} | context ${status.contextUsedPct}% | $${status.sessionCostUsd}`);
    if (status.alerts.length) console.log(`alerts: ${status.alerts.join(', ')}`);
  }
}

if (cmd === 'status') {
  printStatus();
} else if (cmd === 'adopt') {
  const species = rest[0];
  if (!SPECIES.includes(species)) {
    console.error(`unknown species: ${species}. choose one of: ${SPECIES.join(', ')}`);
    process.exit(1);
  }
  const pet = loadPet();
  pet.species = species;
  savePet(pet);
  console.log(`Adopted a ${species}! It will hatch as you code.`);
} else if (cmd === 'rename') {
  const name = rest.join(' ').trim();
  if (!name) { console.error('usage: /pet rename <name>'); process.exit(1); }
  const pet = loadPet();
  pet.name = name;
  savePet(pet);
  console.log(`Renamed to ${name}.`);
} else if (cmd === 'milestone') {
  const pet = loadPet();
  const { pet: updated } = applyEvent(pet, { linesXp: 0, testXp: 0 }, { type: 'milestone' }, new Date());
  savePet(updated);
  console.log(`Milestone logged: "${rest.join(' ')}" (+300 xp). Now Lv ${updated.level}.`);
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
```

- [ ] **Step 4: Create `commands/pet.md`**

```markdown
---
description: Show your claude-pet's status, or adopt/rename/log a milestone.
---

Run the pet CLI and show the user its output verbatim:

```
!node "${CLAUDE_PLUGIN_ROOT}/bin/pet.js" $ARGUMENTS
```

If `$ARGUMENTS` is empty, it defaults to `status`. Supported: `status`, `adopt <species>`, `rename <name>`, `milestone <description>`.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/pet-cli.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add bin/pet.js commands/pet.md test/pet-cli.test.js
git commit -m "feat: add /pet CLI (status/adopt/rename/milestone)"
```

---

### Task 16: Zero-side-effects invariant test

**Files:**
- Test: `test/no-side-effects.test.js`

Proves the engine never writes outside `CLAUDE_PET_HOME` and the git runner refuses mutating subcommands.

- [ ] **Step 1: Write the test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeGitRunner } from '../src/run-git.js';

test('git runner refuses mutating subcommands', () => {
  const runGit = makeGitRunner(process.cwd());
  for (const bad of ['commit', 'add', 'checkout', 'push', 'reset', 'tag']) {
    assert.throws(() => runGit([bad, '-x']), /non-read-only/);
  }
});

test('hook run leaves the project dir untouched, only writes under CLAUDE_PET_HOME', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));
  fs.writeFileSync(path.join(project, 'keep.txt'), 'original');
  const before = fs.readdirSync(project).sort();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));

  const r = spawnSync('node', ['bin/hook.js'], {
    input: JSON.stringify({
      hook_event_name: 'PostToolUse', session_id: 's1', cwd: project,
      tool_name: 'Edit', tool_input: { new_string: 'x\ny\n' }, tool_response: {},
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PET_HOME: home },
  });

  assert.equal(r.status, 0);
  assert.deepEqual(fs.readdirSync(project).sort(), before); // no new/removed files
  assert.equal(fs.readFileSync(path.join(project, 'keep.txt'), 'utf8'), 'original'); // unchanged
  assert.ok(fs.existsSync(path.join(home, 'pet.json'))); // state written here instead
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test test/no-side-effects.test.js`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add test/no-side-effects.test.js
git commit -m "test: assert engine has zero side-effects on the project"
```

---

### Task 17: Full suite green + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the whole suite**

Run: `node --test`
Expected: PASS — all files, 0 failures.

- [ ] **Step 2: Create `README.md`** (M1 scope only)

```markdown
# claude-pet (M1: state engine)

A Claude Code plugin that grows a virtual pet as you code. M1 is the read-only
state engine: hooks observe activity and write `~/.claude-pet/pet.json` and
`status.json`. The desktop widget arrives in M2.

## Invariant
The engine never modifies your project. It only writes under `~/.claude-pet/`
(override with `CLAUDE_PET_HOME`) and only runs read-only git commands.

## Try it
- `node --test` runs the suite.
- `node bin/pet.js adopt dragon` then `node bin/pet.js status`.

## Env
- `CLAUDE_PET_HOME` — state dir (default `~/.claude-pet`).
- `CLAUDE_PET_CONTEXT_WINDOW` — token count used to estimate context % (default 200000).
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add M1 README"
```

---

## Self-Review (completed during planning)

**Spec coverage (M1 portion):**
- Zero side-effects invariant (spec §2) → Tasks 13 (runner allowlist), 16 (proof test). ✔
- Two-stage architecture / state files (spec §3, §7) → Tasks 10, 11, 13. ✔
- Event-driven XP, commit classification, test detection, milestone (spec §8) → Tasks 3, 4, 5, 11, 15. ✔
- Levels & stages, egg-before-adoption (spec §5, §8) → Tasks 2, 11. ✔
- Mood incl. failure-empathy & idle decay (spec §8) → Task 6, 11. ✔
- Streak multiplier & achievements (spec §8) → Tasks 3, 7, 11. ✔
- Transcript token/context estimate (spec §7, risk §15) → Task 8, 11 (CONTEXT_WINDOW estimate, flagged). ✔
- Alerts: context/git/rest (spec §9) → Task 11 `buildStatus`. ✔
- `/pet` incl. adopt/rename/milestone (spec §4) → Task 15. ✔
- Hooks wired (spec §3) → Task 14.
- **Deferred to later milestones (correctly out of M1):** Electron widget + adoption UI (M2), bubbles/animations/idle live-decay rendering (M3), GPT Image 2.0 asset pipeline + packaging/marketplace + `monitors` auto-launch (M4). Cost (`sessionCostUsd`) is plumbed as 0 in M1 and filled in M4 when an optional statusline integration supplies it.

**Placeholder scan:** none — every step has runnable code/commands.

**Type consistency:** `applyEvent(pet, sessionAcc, event, now) => { pet, sessionAcc, unlocked }`, `buildStatus({...}) => status`, `gitSnapshot(runGit, now)`, `newCommitsSince(runGit, lastSeenHash)`, `xpForEvent(event)`, `classifyCommit(msg)`, `isTestSuccess(output, exitCode)`, `expressionFor({mood, recentFailureActive})` — names and shapes are used identically in the hook entrypoint (Task 13) and CLI (Task 15).

## Notes for M2–M4 (not part of this plan)
- M2: Electron transparent always-on-top window; first-run adoption screen; `fs.watch` on `pet.json`/`status.json`; fixture mode.
- M3: reminder bubbles from `status.alerts`, level-up + achievement animations, worried/empathy expression, live idle decay between events.
- M4: GPT Image 2.0 build-time asset pipeline; `plugin.json` finalize + `marketplace.json`; `monitors` auto-launch (verify capability) with SessionStart pidfile fallback; optional statusline integration for exact cost/context.

## Known M1 simplifications
- **Strict "≥3 consecutive failures":** DONE — `engine.applyEvent` now counts `sessionAcc.failures`, only drops mood / sets `recentFailureUntil` once it reaches `FAILURE_STREAK_THRESHOLD` (3), and resets the counter on a test pass. A lone failed test (normal TDD red) no longer saddens the pet.
- **`newFile` +15 bonus:** DONE — `hook.js` emits a `newFile` event when the Write `tool_response.type === 'create'`. (Heuristic: depends on Claude Code reporting `type:'create'` for new files; if the real field differs the bonus simply doesn't fire — no harm. Verify the actual `tool_response` shape against live runs.)
- **Git-tag auto-detection of releases (still deferred):** spec §8 lists a new `git tag` as a +300 milestone trigger; M1 only supports the manual `/pet milestone` path. Re-add a read-only `git tag` listing when wiring this up (revisit in a later milestone).
