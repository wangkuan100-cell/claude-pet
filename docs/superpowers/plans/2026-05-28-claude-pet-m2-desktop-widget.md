# claude-pet M2: Desktop Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Electron desktop floating window that renders the pet from `~/.claude-pet/pet.json` + `status.json`: first-run species adoption, mood expression, reminder bubbles, and a click-to-expand stats panel — using emoji placeholder art (real GPT Image 2.0 art is M4).

**Architecture:** **All logic lives in the Electron main process (Node).** `render-logic.js` + `placeholders.js` (pure, unit-tested) turn `{pet, status, now}` into ready-to-paint data. `state-source.js` watches the M1 state files. `main.cjs` creates a transparent, frameless, always-on-top window, recomputes paint-data on file changes and on a 60s idle-decay timer, and pushes it to a **dumb renderer** over IPC. The renderer (`renderer/`) only paints what it receives and sends back `adopt` clicks. This keeps pet logic testable headlessly and lets the renderer be previewed in a browser with fixture data.

**Tech Stack:** Electron (new dev dependency), Node 22, ESM for logic modules + `.cjs` for the Electron main/preload (robust across Electron versions; main loads ESM modules via dynamic `import()`). Built on top of the M1 state engine.

**Spec:** `docs/superpowers/specs/2026-05-28-claude-pet-design.md` (milestone M2). **Depends on M1** (this branch is cut from `m1-state-engine`).

---

## Verifiability note (read before starting)

- Tasks 1–5 are pure logic / data → full TDD with `node --test`.
- Tasks 6–9 are Electron shell + DOM → verified by **launching** and **screenshotting the renderer with fixture data in a browser**, not by unit asserts. The transparent / always-on-top / draggable desktop behavior ultimately needs a human to eyeball; the plan's automated checks confirm "it launches without errors and paints the right content," and the executor must explicitly say what was and wasn't visually confirmed.

## File Structure

```
widget/
├── placeholders.js     pure: spriteKey string -> {base emoji, scale, expr emoji}
├── render-logic.js     pure: pet+status+now -> paint-data (mood/expression/sprite/bubble/panel/adopt)
├── state-source.js     Node: read + watch pet.json/status.json (reuses src/state.js)
├── main.cjs            Electron main: transparent window, watch+timer -> buildPaintData -> IPC; adopt IPC
├── preload.cjs         contextBridge: onPaint / adopt / requestPaint
└── renderer/
    ├── index.html      window markup
    ├── styles.css      transparent bg, pet, bubble, expand panel, adoption grid
    └── pet.js          classic script: paint paint-data, adoption clicks, expand toggle, fixture mode
src/levels.js           MODIFY: export thresholdForLevel (for the XP-progress bar)
package.json            MODIFY: add electron devDep + "widget" script + "main"
README.md               MODIFY: how to run the widget
test/
├── placeholders.test.js
├── render-logic.test.js
├── levels.test.js      MODIFY: add thresholdForLevel cases
└── state-source.test.js
```

---

### Task 1: Add Electron and widget scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add Electron as a dev dependency**

Run: `npm install --save-dev electron`
Expected: `electron` appears under `devDependencies` in `package.json`; `node_modules/` is created (already git-ignored).

- [ ] **Step 2: Add the `main` field and a `widget` script to `package.json`**

Edit `package.json` so it contains (merge with existing fields; keep `"type":"module"`, `"test"` script, etc.):

```json
{
  "main": "widget/main.cjs",
  "scripts": {
    "test": "node --test",
    "widget": "electron ."
  }
}
```

- [ ] **Step 3: Verify Electron is installed**

Run: `npx electron --version`
Expected: prints a version like `v3x.y.z` (any version, no error).

- [ ] **Step 4: Verify the test suite still passes (Electron didn't break M1)**

Run: `node --test`
Expected: PASS — 47 tests (M1 unchanged).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add electron dev dependency and widget script"
```

---

### Task 2: Export `thresholdForLevel` from `src/levels.js`

The XP-progress bar needs the per-level thresholds, which are currently private.

**Files:**
- Modify: `src/levels.js`
- Test: `test/levels.test.js` (add cases)

- [ ] **Step 1: Add the failing test** (append inside `test/levels.test.js`)

```js
import { thresholdForLevel } from '../src/levels.js';

test('thresholdForLevel returns cumulative-XP thresholds, doubling past the table', () => {
  assert.equal(thresholdForLevel(1), 0);
  assert.equal(thresholdForLevel(2), 150);
  assert.equal(thresholdForLevel(3), 450);
  assert.equal(thresholdForLevel(7), 9000);
  assert.equal(thresholdForLevel(8), 18000);
  assert.equal(thresholdForLevel(9), 36000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/levels.test.js`
Expected: FAIL — `thresholdForLevel` is not exported.

- [ ] **Step 3: Change `thresholdForLevel` to an export** in `src/levels.js`

Change the existing `function thresholdForLevel(level) {` line to `export function thresholdForLevel(level) {`. Leave the body and the rest of the file unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/levels.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/levels.js test/levels.test.js
git commit -m "feat: export thresholdForLevel for XP-progress display"
```

---

### Task 3: Placeholder art mapping (`widget/placeholders.js`)

**Files:**
- Create: `widget/placeholders.js`
- Test: `test/placeholders.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spritePlaceholder, SPECIES } from '../widget/placeholders.js';

test('SPECIES lists the adoptable starters', () => {
  assert.deepEqual(SPECIES, ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox']);
});

test('egg sprite is a small egg with no expression overlay', () => {
  assert.deepEqual(spritePlaceholder('egg'), { base: '🥚', scale: 0.7, expr: null });
});

test('species sprite maps base emoji, stage scale, and expression overlay', () => {
  assert.deepEqual(spritePlaceholder('dragon/child/flow'), { base: '🐉', scale: 1.0, expr: '🤩' });
  assert.deepEqual(spritePlaceholder('cat/adult/sleepy'), { base: '🐱', scale: 1.3, expr: '😴' });
});

test('evolved stages scale up; unknown parts fall back gracefully', () => {
  assert.equal(spritePlaceholder('fox/evolved2/happy').scale, 1.45);
  assert.equal(spritePlaceholder('zebra/child/happy').base, '🐾');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/placeholders.test.js`
Expected: FAIL — cannot find module `../widget/placeholders.js`.

- [ ] **Step 3: Write minimal implementation**

```js
export const SPECIES = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];

const SPECIES_EMOJI = { cat: '🐱', dog: '🐶', dragon: '🐉', slime: '🟢', bird: '🐦', fox: '🦊' };
const STAGE_SCALE = { egg: 0.7, hatchling: 0.85, child: 1.0, teen: 1.15, adult: 1.3 };
const EXPRESSION_EMOJI = { flow: '🤩', happy: '😄', normal: '🙂', sleepy: '😴', bored: '🥱', worried: '😟' };

export function spritePlaceholder(spriteKey) {
  if (spriteKey === 'egg') return { base: '🥚', scale: 0.7, expr: null };
  const [species, stage, expr] = spriteKey.split('/');
  const scale = STAGE_SCALE[stage] ?? (stage && stage.startsWith('evolved') ? 1.45 : 1.0);
  return {
    base: SPECIES_EMOJI[species] || '🐾',
    scale,
    expr: EXPRESSION_EMOJI[expr] || null,
  };
}

export { SPECIES_EMOJI, EXPRESSION_EMOJI };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/placeholders.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add widget/placeholders.js test/placeholders.test.js
git commit -m "feat: add emoji placeholder sprite mapping for the widget"
```

---

### Task 4: Render logic (`widget/render-logic.js`)

Pure functions that turn the M1 state into paint-data. Reuses `src/mood.js` and `src/levels.js` (so decay/expression/levels stay DRY).

**Files:**
- Create: `widget/render-logic.js`
- Test: `test/render-logic.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/render-logic.test.js`
Expected: FAIL — cannot find module `../widget/render-logic.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import { moodAfterDecay, expressionFor } from '../src/mood.js';
import { thresholdForLevel } from '../src/levels.js';
import { SPECIES, spritePlaceholder } from './placeholders.js';

function hoursSince(iso, now) {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3600000);
}

export function currentMood(pet, now) {
  return moodAfterDecay(pet.mood, hoursSince(pet.lastActivityAt, now));
}

export function recentFailureActive(pet, now) {
  return !!pet.recentFailureUntil && new Date(pet.recentFailureUntil) > now;
}

export function currentExpression(pet, now) {
  return expressionFor({ mood: currentMood(pet, now), recentFailureActive: recentFailureActive(pet, now) });
}

export function spriteKey(pet, now) {
  if (!pet.species) return 'egg';
  return `${pet.species}/${pet.stage}/${currentExpression(pet, now)}`;
}

export function xpProgress(pet) {
  const base = thresholdForLevel(pet.level);
  const next = thresholdForLevel(pet.level + 1);
  const span = next - base;
  const intoLevel = pet.xp - base;
  const pct = span > 0 ? Math.min(100, Math.round((intoLevel / span) * 100)) : 100;
  return { level: pet.level, intoLevel, span, toNext: Math.max(0, next - pet.xp), pct };
}

const ALERT_BUBBLES = {
  context: { emoji: '🥵', text: '我撑住了…该 /compact 啦' },
  git: { emoji: '💾', text: '别忘了提交哦' },
  rest: { emoji: '🍵', text: '歇会儿?' },
};
export const ALERT_PRIORITY = ['context', 'git', 'rest'];

export function bubbleFor(status) {
  if (!status || !Array.isArray(status.alerts)) return null;
  for (const kind of ALERT_PRIORITY) {
    if (status.alerts.includes(kind)) return { kind, ...ALERT_BUBBLES[kind] };
  }
  return null;
}

export function panelData(pet, status, now) {
  const prog = xpProgress(pet);
  return {
    name: pet.name || pet.species || 'egg',
    level: pet.level,
    stage: pet.stage,
    mood: currentMood(pet, now),
    xp: pet.xp,
    xpPct: prog.pct,
    xpToNext: prog.toNext,
    achievements: (pet.achievements || []).map((a) => a.id),
    project: status ? {
      repo: status.repo || status.cwd || null,
      contextPct: status.contextUsedPct ?? null,
      cost: status.sessionCostUsd ?? 0,
      alerts: status.alerts || [],
    } : null,
  };
}

export function buildPaintData(pet, status, now = new Date()) {
  if (!pet.species) return { mode: 'adopt', species: SPECIES };
  return {
    mode: 'pet',
    sprite: spritePlaceholder(spriteKey(pet, now)),
    bubble: bubbleFor(status),
    panel: panelData(pet, status, now),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/render-logic.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add widget/render-logic.js test/render-logic.test.js
git commit -m "feat: add pure render-logic that turns pet state into paint-data"
```

---

### Task 5: State source (`widget/state-source.js`)

Reads and watches the M1 state files. Reuses `src/state.js` for paths/loaders.

**Files:**
- Create: `widget/state-source.js`
- Test: `test/state-source.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('readState returns the current pet and status', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CLAUDE_PET_HOME = home;
  const { readState } = await import('../widget/state-source.js?1');
  // No files yet -> default pet, null status.
  const empty = readState();
  assert.equal(empty.pet.xp, 0);
  assert.equal(empty.status, null);
  // Write files -> reflected.
  fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify({ xp: 42, species: 'cat' }));
  fs.writeFileSync(path.join(home, 'status.json'), JSON.stringify({ repo: 'a/b' }));
  const s = readState();
  assert.equal(s.pet.xp, 42);
  assert.equal(s.status.repo, 'a/b');
});

test('watch invokes the callback after a file changes, and stop() cleans up', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  process.env.CLAUDE_PET_HOME = home;
  fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify({ xp: 1 }));
  const { watch } = await import('../widget/state-source.js?2');
  const seen = await new Promise((resolve) => {
    const stop = watch((state) => { stop(); resolve(state); });
    setTimeout(() => fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify({ xp: 2 })), 50);
  });
  assert.equal(seen.pet.xp, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/state-source.test.js`
Expected: FAIL — cannot find module `../widget/state-source.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import fs from 'node:fs';
import { loadPet, loadStatus, baseDir } from '../src/state.js';

export function readState() {
  return { pet: loadPet(), status: loadStatus() };
}

// Watches the state dir and calls onChange(readState()) shortly after any change,
// debounced so a burst of writes collapses into one repaint. Returns a stop fn.
export function watch(onChange, { debounceMs = 40 } = {}) {
  let timer = null;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(readState()), debounceMs);
  };
  let watcher;
  try {
    watcher = fs.watch(baseDir(), { persistent: true }, fire);
  } catch {
    watcher = null; // dir may not exist yet; caller can retry later
  }
  return function stop() {
    clearTimeout(timer);
    if (watcher) watcher.close();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/state-source.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add widget/state-source.js test/state-source.test.js
git commit -m "feat: add state-source that reads and watches the pet state files"
```

---

### Task 6: Preload bridge (`widget/preload.cjs`)

**Files:**
- Create: `widget/preload.cjs`

- [ ] **Step 1: Create `widget/preload.cjs`**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // main pushes paint-data; renderer subscribes.
  onPaint: (cb) => ipcRenderer.on('paint', (_e, data) => cb(data)),
  // renderer asks for an immediate repaint (e.g., on load).
  requestPaint: () => ipcRenderer.send('request-paint'),
  // user picked a species on the adoption screen.
  adopt: (species) => ipcRenderer.send('adopt', species),
});
```

- [ ] **Step 2: Syntax-check it loads as CommonJS**

Run: `node -e "require('module'); new Function(require('fs').readFileSync('widget/preload.cjs','utf8')); console.log('ok')"`
Expected: prints `ok` (parses; it won't run outside Electron, which is fine).

- [ ] **Step 3: Commit**

```bash
git add widget/preload.cjs
git commit -m "feat: add preload contextBridge for the widget renderer"
```

---

### Task 7: Renderer (`widget/renderer/`)

A **dumb painter**: it renders whatever paint-data it receives, shows the adoption grid in adopt mode, toggles the stats panel on pet click, and supports a **fixture mode** (`window.__FIXTURE__`) so it can be opened directly in a browser for visual checks.

**Files:**
- Create: `widget/renderer/index.html`
- Create: `widget/renderer/styles.css`
- Create: `widget/renderer/pet.js`

- [ ] **Step 1: Create `widget/renderer/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="app">
      <!-- Adoption screen -->
      <div id="adopt" class="hidden">
        <div class="adopt-title">领养一只宠物</div>
        <div id="species-grid"></div>
      </div>
      <!-- Pet view -->
      <div id="pet" class="hidden">
        <div id="bubble" class="hidden"></div>
        <div id="sprite" class="drag"><span id="sprite-base"></span><span id="sprite-expr"></span></div>
        <div id="panel" class="hidden">
          <div id="panel-name"></div>
          <div id="panel-level"></div>
          <div class="xpbar"><div id="xpfill"></div></div>
          <div id="panel-mood"></div>
          <div id="panel-project"></div>
          <div id="panel-ach"></div>
        </div>
      </div>
    </div>
    <script src="pet.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `widget/renderer/styles.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, system-ui, sans-serif; }
html, body { background: transparent; overflow: hidden; user-select: none; }
.hidden { display: none !important; }
#app { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }

.drag { -webkit-app-region: drag; }
#sprite { position: relative; cursor: pointer; text-align: center; line-height: 1; }
#sprite-base { font-size: 96px; display: inline-block; transition: transform .2s; }
#sprite-expr { position: absolute; right: -6px; top: -6px; font-size: 34px; }

#bubble {
  -webkit-app-region: no-drag;
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(30,30,40,.92); color: #fff; padding: 6px 10px; border-radius: 12px;
  font-size: 12px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,.3);
}

#panel {
  -webkit-app-region: no-drag;
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  width: 200px; background: rgba(20,20,28,.95); color: #eee; border-radius: 12px;
  padding: 10px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.4);
}
#panel > div { margin: 3px 0; }
#panel-name { font-weight: 600; font-size: 13px; }
.xpbar { height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
#xpfill { height: 100%; width: 0; background: linear-gradient(90deg,#5ad,#7e6); transition: width .3s; }
#panel-ach { color: #9c9; font-size: 11px; }

#adopt { -webkit-app-region: no-drag; text-align: center; color: #eee; background: rgba(20,20,28,.95); padding: 12px; border-radius: 12px; }
.adopt-title { font-size: 13px; margin-bottom: 8px; }
#species-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.species-btn { font-size: 32px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 10px; padding: 8px; cursor: pointer; }
.species-btn:hover { background: rgba(255,255,255,.16); }
```

- [ ] **Step 3: Create `widget/renderer/pet.js`** (classic script — no imports)

```js
(function () {
  const $ = (id) => document.getElementById(id);
  let panelOpen = false;

  function paint(data) {
    const adopt = $('adopt'), pet = $('pet');
    if (!data || data.mode === 'adopt') {
      adopt.classList.remove('hidden');
      pet.classList.add('hidden');
      renderSpecies((data && data.species) || []);
      return;
    }
    adopt.classList.add('hidden');
    pet.classList.remove('hidden');

    $('sprite-base').textContent = data.sprite.base;
    $('sprite-base').style.transform = `scale(${data.sprite.scale})`;
    $('sprite-expr').textContent = data.sprite.expr || '';

    const bubble = $('bubble');
    if (data.bubble) {
      bubble.textContent = `${data.bubble.emoji} ${data.bubble.text}`;
      bubble.classList.remove('hidden');
    } else {
      bubble.classList.add('hidden');
    }

    const p = data.panel;
    $('panel-name').textContent = `${p.name} · Lv ${p.level} (${p.stage})`;
    $('panel-level').textContent = `xp ${p.xp} · 距下一级 ${p.xpToNext}`;
    $('xpfill').style.width = `${p.xpPct}%`;
    $('panel-mood').textContent = `心情 ${p.mood}`;
    $('panel-project').textContent = p.project
      ? `项目 ${p.project.repo || '—'} · 上下文 ${p.project.contextPct ?? '—'}% · $${p.project.cost}`
      : '没有活跃项目';
    $('panel-ach').textContent = p.achievements.length ? `成就: ${p.achievements.join(', ')}` : '还没有成就';
    $('panel').classList.toggle('hidden', !panelOpen);
  }

  function renderSpecies(list) {
    const grid = $('species-grid');
    if (grid.childElementCount) return; // build once
    const EMOJI = { cat: '🐱', dog: '🐶', dragon: '🐉', slime: '🟢', bird: '🐦', fox: '🦊' };
    for (const sp of list) {
      const b = document.createElement('button');
      b.className = 'species-btn';
      b.textContent = EMOJI[sp] || '🐾';
      b.title = sp;
      b.onclick = () => window.api && window.api.adopt(sp);
      grid.appendChild(b);
    }
  }

  $('sprite').addEventListener('click', () => {
    panelOpen = !panelOpen;
    $('panel').classList.toggle('hidden', !panelOpen);
  });

  if (window.api) {
    window.api.onPaint(paint);
    window.api.requestPaint();
  } else if (window.__FIXTURE__) {
    paint(window.__FIXTURE__); // browser/preview fixture mode
  }
  window.__paint = paint; // exposed for preview-driven testing
})();
```

- [ ] **Step 4: Visually verify the renderer in a browser with fixtures**

The renderer must paint correctly without Electron. Open `widget/renderer/index.html` in a browser/preview with a fixture injected, e.g. set before load:

```js
window.__FIXTURE__ = { mode: 'pet',
  sprite: { base: '🐉', scale: 1.0, expr: '🤩' },
  bubble: { kind: 'context', emoji: '🥵', text: '我撑住了…该 /compact 啦' },
  panel: { name: 'dragon', level: 2, stage: 'hatchling', mood: 90, xp: 300, xpPct: 50, xpToNext: 150,
    achievements: ['first-hatch'], project: { repo: 'a/b', contextPct: 85, cost: 0.5, alerts: ['context'] } } };
```

Confirm by screenshot: dragon sprite with 🤩 overlay, a 🥵 bubble on top, and (after clicking the sprite, or calling `window.__paint` with panel open) the stats panel showing level/xp bar/mood/project/achievements. Then paint an `{mode:'adopt', species:[...]}` fixture and confirm the 6-species grid renders. **Report what you saw (screenshots).**

- [ ] **Step 5: Commit**

```bash
git add widget/renderer/index.html widget/renderer/styles.css widget/renderer/pet.js
git commit -m "feat: add dumb renderer (pet view, bubble, panel, adoption) with fixture mode"
```

---

### Task 8: Electron main process (`widget/main.cjs`)

**Files:**
- Create: `widget/main.cjs`

- [ ] **Step 1: Create `widget/main.cjs`**

```js
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

let win = null;
let logic = null;       // dynamically-imported ESM modules
let stateSource = null;
let stopWatch = null;
let decayTimer = null;

async function loadModules() {
  logic = await import('./render-logic.js');
  stateSource = await import('./state-source.js');
  return import('../src/state.js');
}

function repaint() {
  if (!win || win.isDestroyed() || !logic || !stateSource) return;
  const { pet, status } = stateSource.readState();
  win.webContents.send('paint', logic.buildPaintData(pet, status, new Date()));
}

async function createWindow() {
  const stateApi = await loadModules();

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 240, height: 300, x: width - 280, y: 80,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Repaint on state-file changes...
  stopWatch = stateSource.watch(() => repaint());
  // ...and on a timer so idle mood-decay shows even when nothing is happening.
  decayTimer = setInterval(repaint, 60000);

  ipcMain.on('request-paint', repaint);
  ipcMain.on('adopt', (_e, species) => {
    const pet = stateApi.loadPet();
    if (require('./placeholders-allowlist.cjs').includes(species)) { pet.species = species; stateApi.savePet(pet); }
    repaint();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { clearInterval(decayTimer); if (stopWatch) stopWatch(); app.quit(); });
```

NOTE: the `adopt` handler validates the species against an allowlist. Create `widget/placeholders-allowlist.cjs` so the CommonJS main can use it without importing ESM:

```js
module.exports = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];
```

- [ ] **Step 2: Create `widget/placeholders-allowlist.cjs`** (shown above).

- [ ] **Step 3: Launch and verify it starts without errors**

Run (with a fixture state dir so you don't touch the real pet):
```bash
export CLAUDE_PET_HOME=$(mktemp -d)
node bin/pet.js adopt dragon
echo '{"hook_event_name":"PostToolUse","session_id":"w","cwd":"'$CLAUDE_PET_HOME'","tool_name":"Write","tool_input":{"file_path":"'$CLAUDE_PET_HOME'/a.js","content":"a\nb\nc\n"},"tool_response":{}}' | node bin/hook.js
timeout 6 npm run widget 2>&1 | head -40 || true
```
Expected: Electron boots with no uncaught exceptions in the logged output (a window opens; in a headless/CI context it may warn about the display — that's fine). If on a Mac with a display, confirm a small dragon appears top-right. **Report the captured output and whether a window was visible.**

- [ ] **Step 4: Commit**

```bash
git add widget/main.cjs widget/placeholders-allowlist.cjs
git commit -m "feat: add electron main process (transparent always-on-top window, watch+timer repaint, adopt)"
```

---

### Task 9: End-to-end launch verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full suite still green**

Run: `node --test`
Expected: PASS — 47 (M1) + thresholdForLevel additions + placeholders (4) + render-logic (7) + state-source (2) = all green. Report the count.

- [ ] **Step 2: Manual end-to-end (document results)**

With a throwaway `CLAUDE_PET_HOME`: launch `npm run widget`, then in another shell drive the hook (simulate edits, a `feat:` commit via `git`, a `/pet milestone`) and confirm the widget repaints — pet grows, bubble appears when `status.alerts` is non-empty, clicking the pet shows the panel. Adopt from the grid if starting unadopted. **Write down exactly what was confirmed visually and what could not be (e.g., transparency/always-on-top need a human display).**

- [ ] **Step 3: Update `README.md`** — add a "Desktop widget (M2)" section:

```markdown
## Desktop widget (M2)
A floating Electron window shows your pet and reacts to coding activity.

- Run it: `npm run widget` (requires the M1 hooks to be writing `~/.claude-pet/`).
- First launch shows an adoption screen; pick a species. The pet then grows, changes
  expression with mood, shows reminder bubbles (context full / uncommitted / take-a-break),
  and a click opens a stats panel (level, XP, mood, project, achievements).
- Art is emoji placeholder for now; real generated art arrives in M4.
- `CLAUDE_PET_HOME` overrides the state dir (useful for a fixture/demo).
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the M2 desktop widget"
```

---

## Self-Review (completed during planning)

**Spec coverage (M2):**
- Electron transparent always-on-top window → Task 8. ✔
- First-run adoption (pick species) → renderer adopt mode (Task 7) + adopt IPC (Task 8). ✔
- `fs.watch` on pet.json/status.json → Task 5 + wired in Task 8. ✔
- Render pet by species/stage/mood + expression → Tasks 3, 4, 7. ✔
- Reminder bubbles from `status.alerts` (context/git/rest priority) → Task 4 `bubbleFor` + Task 7. ✔
- Click-to-expand panel (level/XP/mood/achievements/project) → Tasks 4, 7. ✔
- Local idle-decay between events → 60s repaint timer in Task 8 + `currentMood` decay in Task 4. ✔
- Fixture mode for headless/browser testing → Task 7 (`window.__FIXTURE__`). ✔
- Placeholder art now, real art M4 → Task 3 (emoji), forward-compatible sprite shape. ✔

**Placeholder scan:** none — every code step has complete content; Tasks 6–9 use launch/screenshot verification by design (documented in the Verifiability note), not fake asserts.

**Type consistency:** paint-data shape (`{mode, species?}` | `{mode:'pet', sprite:{base,scale,expr}, bubble:{kind,emoji,text}|null, panel:{name,level,stage,mood,xp,xpPct,xpToNext,achievements[],project|null}}`) is produced by `buildPaintData` (Task 4) and consumed identically by `pet.js` (Task 7). `spritePlaceholder` (Task 3) output `{base,scale,expr}` matches what `buildPaintData.sprite` returns and what the renderer reads. Adoption species list is the same array in `placeholders.js` (Task 3), `render-logic` adopt mode (Task 4), and `placeholders-allowlist.cjs` (Task 8).

## Notes for M3 / M4 (not part of this plan)
- M3: level-up celebration + achievement-unlock animation (renderer diffs previous vs next level), worried/empathy emphasis, smoother sprite animation, per-pixel click-through for the transparent regions.
- M4: GPT Image 2.0 sprite PNGs replace the emoji placeholders (paint-data gains an `imageSrc`; the renderer already centralizes sprite painting); `monitors`/SessionStart auto-launch of the widget; `/pet start|stop`; packaging + marketplace.
