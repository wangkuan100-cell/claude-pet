# claude-pet M4: Art Pipeline, Auto-Launch, Packaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship-ready the plugin: a GPT Image 2.0 art-generation **script** (run once by the author with their key), the renderer plumbing to use real PNGs (with emoji fallback), `/pet start|stop` + opt-in auto-launch of the widget, and packaging (`plugin.json` / `marketplace.json` / a skill).

**Architecture:** A pure `art/prompts.js` builds the prompt matrix; `art/generate.mjs` is a dev CLI whose network call is injectable so the loop/file-writing is unit-tested without hitting the API. A `widget/launcher.js` manages a detached Electron process via a pidfile (injectable spawn → testable). `widget/sprite-source.js` resolves `assets/<key>.png` if present; main merges `imageSrc` into paint-data and the renderer shows `<img>` else the emoji. Packaging finalizes the plugin manifest + marketplace + a skill.

**Tech Stack:** Node 22 (built-in `fetch` for the OpenAI Images API — no SDK dependency), Electron (existing), ESM logic + `.cjs` Electron files. Builds on `m3-polish`.

**Spec:** `docs/superpowers/specs/2026-05-28-claude-pet-design.md` (§6 art pipeline, §10 auto-launch, §12 packaging). Depends on M3.

---

## BLOCKER / scope honesty (read first)
- **No `OPENAI_API_KEY` is available in this environment, and "GPT Image 2.0" post-dates the assistant's knowledge cutoff.** Therefore this plan BUILDS the generation script (parameterized model id, mock-tested logic) but does NOT run real generation. Producing the PNGs is a documented one-time author step (`OPENAI_API_KEY=... npm run gen-art`). The exact OpenAI Images model id / params may need a one-line adjustment against current docs — the script centralizes that.
- Until art is generated, the widget keeps using emoji placeholders (the `imageSrc` plumbing falls back automatically). So M4 is fully functional now; real art is a drop-in later.

## Verifiability note
- Tasks 1, 3, 4 logic → TDD (`node --test`, with mocked spawn/fetch/fs).
- `/pet start|stop` → exercised via the CLI with an injected/duped state dir; the real Electron spawn is guarded so tests don't open windows.
- Renderer `<img>` branch → browser-preview screenshot with a data-URI fixture.
- Packaging files → JSON-validity + `claude plugin validate` if available.

## File Structure
```
art/prompts.js              pure: style + prompt matrix + output paths
art/generate.mjs            dev CLI: loops matrix, calls injectable requestImage, writes PNGs
widget/launcher.js          start/stop/isRunning/ensureRunning via ~/.claude-pet/widget.pid (injectable spawn)
widget/sprite-source.js     resolve assets/<key>.png -> file URL if it exists (else null)
bin/pet.js                  MODIFY: add start | stop subcommands
bin/pet-autolaunch.js       SessionStart helper: ensureRunning() when CLAUDE_PET_AUTOLAUNCH=1
widget/main.cjs             MODIFY: merge sprite.imageSrc when an asset exists
widget/renderer/index.html  MODIFY: add <img id="sprite-img">
widget/renderer/styles.css  MODIFY: #sprite-img sizing
widget/renderer/pet.js      MODIFY: show <img> when sprite.imageSrc else emoji
hooks/hooks.json            MODIFY: add the autolaunch SessionStart hook entry
.claude-plugin/plugin.json  MODIFY: finalize manifest
marketplace.json            NEW: marketplace listing
skills/claude-pet/SKILL.md  NEW: teach Claude about the pet
package.json                MODIFY: add "gen-art" script
README.md                   MODIFY: install + gen-art + start/stop docs
assets/.gitkeep             NEW: where generated PNGs land
test/*                      new tests for prompts, launcher, sprite-source, generate
```

---

### Task 1: Widget launcher (`widget/launcher.js`)

**Files:**
- Create: `widget/launcher.js`
- Test: `test/launcher.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

test('start spawns once, writes a pidfile; isRunning detects it; stop clears it', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { start, stop, isRunning } = await import('../widget/launcher.js?1');

  assert.equal(isRunning(), false);

  const spawned = [];
  const fakeSpawn = (cmd, args, opts) => { spawned.push({ cmd, args, opts }); return { pid: process.pid, unref() {} }; };
  const r = start({ spawn: fakeSpawn, electronPath: '/fake/electron' });
  assert.equal(r.started, true);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].cmd, '/fake/electron');
  assert.deepEqual(spawned[0].args, ['.']);
  assert.equal(spawned[0].opts.detached, true);
  // pidfile written with our live pid -> isRunning true
  assert.equal(isRunning(), true);

  // second start is a no-op while running
  const r2 = start({ spawn: fakeSpawn, electronPath: '/fake/electron' });
  assert.equal(r2.started, false);
  assert.equal(spawned.length, 1);

  stop();
  assert.equal(isRunning(), false);
});

test('isRunning is false for a stale/dead pid', async () => {
  process.env.CLAUDE_PET_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const { isRunning } = await import('../widget/launcher.js?2');
  fs.writeFileSync(path.join(process.env.CLAUDE_PET_HOME, 'widget.pid'), '2147483646'); // unlikely live pid
  assert.equal(isRunning(), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/launcher.test.js`
Expected: FAIL — cannot find `../widget/launcher.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import { spawn as realSpawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseDir } from '../src/state.js';

const require = createRequire(import.meta.url);
const pidPath = () => path.join(baseDir(), 'widget.pid');
const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function isRunning() {
  try {
    const pid = Number(fs.readFileSync(pidPath(), 'utf8').trim());
    if (!pid) return false;
    process.kill(pid, 0); // signal 0 = liveness check; throws if dead
    return true;
  } catch { return false; }
}

export function start(deps = {}) {
  if (isRunning()) return { started: false, reason: 'already running' };
  const spawn = deps.spawn || realSpawn;
  const electronPath = deps.electronPath || require('electron');
  const child = spawn(electronPath, ['.'], { cwd: pluginRoot, detached: true, stdio: 'ignore' });
  child.unref();
  fs.mkdirSync(baseDir(), { recursive: true });
  fs.writeFileSync(pidPath(), String(child.pid));
  return { started: true, pid: child.pid };
}

export function stop() {
  try {
    const pid = Number(fs.readFileSync(pidPath(), 'utf8').trim());
    if (pid) { try { process.kill(pid); } catch {} }
    fs.rmSync(pidPath(), { force: true });
    return { stopped: true };
  } catch { return { stopped: false }; }
}

export function ensureRunning(deps) { return isRunning() ? { started: false, reason: 'already running' } : start(deps); }
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/launcher.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add widget/launcher.js test/launcher.test.js
git commit -m "feat: add widget launcher (detached electron + pidfile)"
```

---

### Task 2: `/pet start|stop` + opt-in auto-launch

**Files:**
- Modify: `bin/pet.js`
- Create: `bin/pet-autolaunch.js`
- Modify: `hooks/hooks.json`
- Test: `test/pet-cli.test.js` (add a start/stop case using a fake)

- [ ] **Step 1: Add a failing CLI test** (append to `test/pet-cli.test.js`)

```js
test('start reports running, stop reports stopped (no real electron)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  // Pre-write a pidfile pointing at THIS process so isRunning() is true and `start` won't spawn electron.
  fs.writeFileSync(path.join(home, 'widget.pid'), String(process.pid));
  const started = pet(home, ['start']);
  assert.equal(started.status, 0);
  assert.match(started.stdout, /already running|started/i);
  const stopped = pet(home, ['stop']);
  assert.equal(stopped.status, 0);
  assert.match(stopped.stdout, /stopped|not running/i);
});
```

(Note: `stop` will `process.kill(process.pid)` with the default SIGTERM — that would kill the test runner. To avoid that, the CLI test writes the pidfile but `bin/pet.js stop` must tolerate kill failures; AND the test uses a pid we don't actually want signalled. Use a guaranteed-dead pid for `start`'s liveness instead: rewrite the test to assert `start` *spawns* via a stubbed env. Simpler + safe: see Step 1b.)

- [ ] **Step 1b: Use this SAFE test instead** (replace Step 1's snippet) — drive `start` with `CLAUDE_PET_FAKE_ELECTRON` so no real window opens and no real pid is signalled:

```js
test('start launches via the configured electron path; stop clears the pidfile', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-'));
  const start = pet(home, ['start'], '', { CLAUDE_PET_FAKE_ELECTRON: '/usr/bin/true' });
  assert.equal(start.status, 0);
  assert.match(start.stdout, /started|already running/i);
  assert.ok(fs.existsSync(path.join(home, 'widget.pid')));
  const stop = pet(home, ['stop'], '', { CLAUDE_PET_FAKE_ELECTRON: '/usr/bin/true' });
  assert.equal(stop.status, 0);
  assert.equal(fs.existsSync(path.join(home, 'widget.pid')), false);
});
```

Update the `pet()` helper at the top of `test/pet-cli.test.js` to accept an env overlay:

```js
function pet(home, args, input, extraEnv = {}) {
  return spawnSync('node', ['bin/pet.js', ...args], {
    encoding: 'utf8', input: input || '',
    env: { ...process.env, CLAUDE_PET_HOME: home, ...extraEnv },
  });
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/pet-cli.test.js`
Expected: FAIL — `start`/`stop` unknown command.

- [ ] **Step 3: Wire `start`/`stop` into `bin/pet.js`.** Add these branches to the command `if/else` chain (before the final `else`):

```js
} else if (cmd === 'start') {
  const { start } = await import('../widget/launcher.js');
  const electronPath = process.env.CLAUDE_PET_FAKE_ELECTRON || undefined;
  const r = start(electronPath ? { electronPath } : {});
  console.log(r.started ? `Widget started (pid ${r.pid}).` : `Widget ${r.reason}.`);
} else if (cmd === 'stop') {
  const { stop } = await import('../widget/launcher.js');
  const r = stop();
  console.log(r.stopped ? 'Widget stopped.' : 'Widget was not running.');
```

(`bin/pet.js` is an ESM module; top-level `await import(...)` inside the `if`-chain is valid in Node 22.)

- [ ] **Step 4: Create `bin/pet-autolaunch.js`**

```js
#!/usr/bin/env node
// SessionStart helper: only launches when the user opted in.
import { ensureRunning } from '../widget/launcher.js';
if (process.env.CLAUDE_PET_AUTOLAUNCH === '1') {
  try { ensureRunning(); } catch { /* never block the session */ }
}
```

- [ ] **Step 5: Add the autolaunch hook to `hooks/hooks.json`** — add a second command to the existing `SessionStart` array entry's `hooks` list (keep the existing `bin/hook.js` command):

```json
{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/bin/pet-autolaunch.js\"" }
```

- [ ] **Step 6: Run to verify pass**

Run: `node --test test/pet-cli.test.js`
Expected: PASS. Then validate the JSON: `node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'));console.log('ok')"` → `ok`.

- [ ] **Step 7: Commit**

```bash
git add bin/pet.js bin/pet-autolaunch.js hooks/hooks.json test/pet-cli.test.js
git commit -m "feat: /pet start|stop and opt-in SessionStart auto-launch"
```

---

### Task 3: GPT Image 2.0 generation pipeline (mock-tested; real run deferred)

**Files:**
- Create: `art/prompts.js`
- Create: `art/generate.mjs`
- Create: `assets/.gitkeep`
- Modify: `package.json` (add `gen-art` script)
- Test: `test/art.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { promptFor, spriteMatrix, outputPath } from '../art/prompts.js';
import { generateAll } from '../art/generate.mjs';

test('promptFor includes species, stage, expression and the shared style', () => {
  const p = promptFor('dragon', 'child', 'happy');
  assert.match(p, /dragon/i);
  assert.match(p, /transparent background/i);
});

test('spriteMatrix covers every species x stage x expression and builds key paths', () => {
  const m = spriteMatrix(['dragon']);
  assert.ok(m.length >= 5 * 6); // 5 stages x 6 expressions (at least)
  assert.ok(m.every((i) => i.key === `${i.species}/${i.stage}/${i.expr}`));
  assert.equal(outputPath('/A', { species: 'dragon', stage: 'child', expr: 'happy' }), '/A/dragon/child/happy.png');
});

test('generateAll writes a PNG per item using the injected requestImage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  const calls = [];
  const requestImage = async (prompt) => { calls.push(prompt); return Buffer.from('PNGDATA'); };
  const items = [{ species: 'dragon', stage: 'child', expr: 'happy', key: 'dragon/child/happy' }];
  const res = await generateAll(items, { assetsDir: dir, requestImage });
  assert.equal(res.written, 1);
  assert.equal(calls.length, 1);
  const file = path.join(dir, 'dragon', 'child', 'happy.png');
  assert.ok(fs.existsSync(file));
  assert.equal(fs.readFileSync(file, 'utf8'), 'PNGDATA');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/art.test.js`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `art/prompts.js`**

```js
export const STYLE = 'cute chibi kawaii mascot, flat vector with bold clean outlines, vibrant colors, centered single character, plain transparent background, no text, no shadow';

const SPECIES_DESC = { cat: 'a round fluffy cat', dog: 'a happy puppy', dragon: 'a friendly baby dragon', slime: 'a glossy green slime blob with eyes', bird: 'a tiny round bird', fox: 'a small orange fox' };
const STAGE_DESC = { egg: 'as a speckled egg', hatchling: 'as a tiny just-hatched baby', child: 'as a small child form', teen: 'as an energetic teen form', adult: 'as a majestic grown-up form' };
const EXPR_DESC = { flow: 'thrilled, sparkling star-eyes', happy: 'smiling cheerfully', normal: 'calm and neutral', sleepy: 'drowsy with half-closed eyes', bored: 'unamused and bored', worried: 'worried but hopeful' };

export const SPECIES = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];
export const STAGES = ['egg', 'hatchling', 'child', 'teen', 'adult'];
export const EXPRESSIONS = ['flow', 'happy', 'normal', 'sleepy', 'bored', 'worried'];

export function promptFor(species, stage, expr) {
  return `${SPECIES_DESC[species] || species} ${STAGE_DESC[stage] || stage}, ${EXPR_DESC[expr] || expr}. ${STYLE}.`;
}

export function spriteMatrix(speciesList = SPECIES) {
  const out = [];
  for (const species of speciesList) {
    for (const stage of STAGES) {
      for (const expr of EXPRESSIONS) {
        out.push({ species, stage, expr, key: `${species}/${stage}/${expr}` });
      }
    }
  }
  return out;
}

export function outputPath(assetsDir, item) {
  return `${assetsDir}/${item.species}/${item.stage}/${item.expr}.png`;
}
```

- [ ] **Step 4: Write `art/generate.mjs`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { promptFor, spriteMatrix, outputPath, SPECIES } from './prompts.js';

// Real OpenAI Images call. Model id is configurable because "GPT Image 2.0" may
// be `gpt-image-2` or similar — set OPENAI_IMAGE_MODEL to match current docs.
// Returns a Buffer of PNG bytes. Requires OPENAI_API_KEY.
export async function requestImage(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required to generate art');
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: '1024x1024', background: 'transparent', n: 1 }),
  });
  if (!res.ok) throw new Error(`image API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}

export async function generateAll(items, { assetsDir, requestImage: req = requestImage } = {}) {
  let written = 0;
  for (const item of items) {
    const out = outputPath(assetsDir, item);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const png = await req(promptFor(item.species, item.stage, item.expr), item);
    fs.writeFileSync(out, png);
    written += 1;
  }
  return { written };
}

// CLI entry: `OPENAI_API_KEY=... npm run gen-art [species]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  const items = spriteMatrix(only ? [only] : SPECIES);
  const assetsDir = path.resolve('assets');
  console.log(`Generating ${items.length} sprites into ${assetsDir} …`);
  generateAll(items, { assetsDir }).then((r) => console.log(`Done: ${r.written} PNGs.`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 5: Create `assets/.gitkeep`** (empty file) so the assets dir exists in git.

- [ ] **Step 6: Add the `gen-art` script to `package.json`**

```json
  "gen-art": "node art/generate.mjs"
```

- [ ] **Step 7: Run to verify pass**

Run: `node --test test/art.test.js`
Expected: PASS (3 tests). (Real generation is NOT run — no API key.)

- [ ] **Step 8: Commit**

```bash
git add art/prompts.js art/generate.mjs assets/.gitkeep package.json test/art.test.js
git commit -m "feat: add GPT Image 2.0 sprite-generation pipeline (mock-tested; real run via npm run gen-art)"
```

---

### Task 4: Use real PNGs when present (imageSrc plumbing)

**Files:**
- Create: `widget/sprite-source.js`
- Test: `test/sprite-source.test.js`
- Modify: `widget/main.cjs`
- Modify: `widget/renderer/index.html`, `widget/renderer/styles.css`, `widget/renderer/pet.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { assetUrlFor } from '../widget/sprite-source.js';

test('assetUrlFor returns a file URL when the PNG exists, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'dragon', 'child'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dragon', 'child', 'happy.png'), 'x');
  assert.match(assetUrlFor(dir, 'dragon/child/happy'), /^file:\/\/.*dragon\/child\/happy\.png$/);
  assert.equal(assetUrlFor(dir, 'dragon/child/sleepy'), null);
  assert.equal(assetUrlFor(dir, 'egg'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/sprite-source.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Write `widget/sprite-source.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function assetUrlFor(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey.indexOf('/') === -1) return null; // 'egg' (pre-adopt) has no per-species art
  const file = path.join(assetsDir, ...spriteKey.split('/')) + '.png';
  return fs.existsSync(file) ? pathToFileURL(file).href : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/sprite-source.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Merge `imageSrc` in `widget/main.cjs`.** At the top of `createWindow` (or module top), compute the assets dir; in `repaint()`, after building pet-mode data, attach `imageSrc`:

In `loadModules()`, also import the resolver:
```js
async function loadModules() {
  logic = await import('./render-logic.js');
  stateSource = await import('./state-source.js');
  spriteSource = await import('./sprite-source.js');
  return import('../src/state.js');
}
```
Add `let spriteSource = null;` with the other module globals, and in `repaint()` inside the `if (data.mode === 'pet')` block add:
```js
    const assetsDir = path.join(__dirname, '..', 'assets');
    const url = spriteSource.assetUrlFor(assetsDir, `${pet.species}/${pet.stage}/${logic.currentExpression(pet, new Date())}`);
    if (url) data.sprite.imageSrc = url;
```

- [ ] **Step 6: Renderer `<img>` branch.**
  - `index.html`: change the sprite line to include an image element:
    ```html
        <div id="sprite" class="drag"><img id="sprite-img" class="hidden" /><span id="sprite-base"></span><span id="sprite-expr"></span></div>
    ```
  - `styles.css` (append): `#sprite-img { width: 120px; height: 120px; object-fit: contain; display: block; }`
  - `pet.js`: in `paint`, where the sprite is set, branch on `data.sprite.imageSrc`:
    ```js
    const img = $('sprite-img'), base = $('sprite-base');
    if (data.sprite.imageSrc) {
      img.src = data.sprite.imageSrc; img.classList.remove('hidden'); base.classList.add('hidden');
    } else {
      img.classList.add('hidden'); base.classList.remove('hidden');
      base.textContent = data.sprite.base;
      base.style.transform = `scale(${data.sprite.scale})`;
    }
    $('sprite-expr').textContent = data.sprite.expr || '';
    ```
    (Replace the previous three `sprite-base` lines with the block above.)

- [ ] **Step 7: Visually verify the `<img>` branch** in the browser preview: paint a fixture whose `sprite.imageSrc` is a tiny data URI (e.g. a 1x1 colored PNG data URI); confirm the `<img>` shows and the emoji is hidden. Then paint without `imageSrc` and confirm the emoji returns. Report screenshots. Run `node --test` (expect all green).

- [ ] **Step 8: Commit**

```bash
git add widget/sprite-source.js test/sprite-source.test.js widget/main.cjs widget/renderer/index.html widget/renderer/styles.css widget/renderer/pet.js
git commit -m "feat: render generated PNG sprites when present, emoji fallback otherwise"
```

---

### Task 5: Packaging — manifest, marketplace, skill, README

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Create: `marketplace.json`
- Create: `skills/claude-pet/SKILL.md`
- Modify: `README.md`

- [ ] **Step 1: Finalize `.claude-plugin/plugin.json`**

```json
{
  "name": "claude-pet",
  "displayName": "Claude Pet",
  "version": "0.4.0",
  "description": "A desktop pet that grows as you code with Claude Code — read-only state engine, Electron widget, reminders, and achievements.",
  "author": { "name": "kuan" },
  "repository": "https://github.com/wangkuan100-cell/claude-pet"
}
```

- [ ] **Step 2: Create `marketplace.json`**

```json
{
  "name": "claude-pet-marketplace",
  "owner": { "name": "kuan" },
  "plugins": [
    {
      "name": "claude-pet",
      "source": "./",
      "description": "A desktop pet that grows as you code. Hooks track activity (read-only), an Electron widget shows a floating pet that levels up, changes mood, and reminds you about context/commits/breaks.",
      "version": "0.4.0"
    }
  ]
}
```

- [ ] **Step 3: Create `skills/claude-pet/SKILL.md`**

```markdown
---
name: claude-pet
description: Use when the user asks about their claude-pet — its level, mood, achievements, project status — or wants to adopt/rename it, log a milestone, or start/stop the desktop widget.
---

# claude-pet

A virtual desktop pet that grows from the user's coding activity. State lives in
`~/.claude-pet/` (never in the project). Drive it via the CLI:

- `node bin/pet.js status` — level, stage, mood, achievements, current project status
- `node bin/pet.js adopt <cat|dog|dragon|slime|bird|fox>` — first-time adoption
- `node bin/pet.js rename <name>`
- `node bin/pet.js milestone "<what shipped>"` — +300 XP and a milestone achievement
- `node bin/pet.js start` / `stop` — show/hide the floating Electron widget

The pet grows from observed activity (lines, tokens, conventional-commit types,
passing tests, milestones); it shows reminder bubbles for high context usage,
uncommitted changes, and long coding stretches. It is read-only with respect to
the user's project. To regenerate art: `OPENAI_API_KEY=... npm run gen-art`.
```

- [ ] **Step 4: Update `README.md`** — add an Install + Commands section:

```markdown
## Install
Add this repo as a plugin marketplace, then install `claude-pet`:
```
/plugin marketplace add wangkuan100-cell/claude-pet
/plugin install claude-pet
```
Or clone and point Claude Code at the local plugin dir.

## Pet commands
- `/pet` (or `node bin/pet.js status`) — status
- `/pet adopt <species>`, `/pet rename <name>`, `/pet milestone "<text>"`
- `/pet start` / `/pet stop` — show/hide the widget
- Opt into auto-launch on session start: set `CLAUDE_PET_AUTOLAUNCH=1`

## Generating art (one-time, author)
The widget ships with emoji placeholders. To generate real sprites with GPT Image 2.0:
```
OPENAI_API_KEY=sk-... OPENAI_IMAGE_MODEL=gpt-image-2 npm run gen-art
```
PNGs land in `assets/<species>/<stage>/<expression>.png` and are picked up automatically.
```

- [ ] **Step 5: Validate**

Run: `node -e "for (const f of ['.claude-plugin/plugin.json','marketplace.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('json ok')"`
Expected: `json ok`. If the `claude` CLI is available: `claude plugin validate .` (report output; non-blocking if the CLI isn't present).

- [ ] **Step 6: Full suite + commit**

Run: `node --test` (report count). Then:
```bash
git add .claude-plugin/plugin.json marketplace.json skills/claude-pet/SKILL.md README.md
git commit -m "feat: finalize plugin manifest, marketplace, skill, and docs"
```

---

## Self-Review (completed during planning)
- Art pipeline (spec §6): `art/prompts.js` matrix + `art/generate.mjs` with injectable `requestImage` (mock-tested); real run gated on `OPENAI_API_KEY` + configurable model — documented BLOCKER. ✔
- Real-PNG rendering with emoji fallback (spec §6 / M3 note): `sprite-source.assetUrlFor` + main merge + renderer `<img>` branch (Task 4). With no assets yet, always falls back to emoji — safe. ✔
- Auto-launch (spec §10): `/pet start|stop` (launcher + CLI) and opt-in SessionStart via `bin/pet-autolaunch.js` gated by `CLAUDE_PET_AUTOLAUNCH` — avoids forcing a GUI on every session; `monitors` left as a future option. ✔
- Packaging (spec §12): `plugin.json` finalize, `marketplace.json`, `skills/claude-pet/SKILL.md`, README install/commands. ✔
- Invariant preserved: launcher writes only the pidfile under `~/.claude-pet`; spawning the widget is not a project side-effect; no `src/*` engine/hook M1 logic changed except the additive autolaunch hook entry. ✔
- **Type consistency:** `assetUrlFor(assetsDir, spriteKey)` consumes the same `species/stage/expr` key shape used by `render-logic.spriteKey`; main sets `data.sprite.imageSrc`, renderer reads it. `launcher.start({spawn, electronPath})` deps match the CLI (`CLAUDE_PET_FAKE_ELECTRON`) and autolaunch (`ensureRunning`). `generateAll(items, {assetsDir, requestImage})` matches the test + CLI.
- Placeholder scan: real art generation is the only deferred step, explicitly flagged; everything else is built + tested.

## Notes / follow-ups
- Verify the exact GPT Image 2.0 model id and Images API params against current OpenAI docs before the first real `gen-art` run; the call is centralized in `requestImage`.
- Reference-image character consistency (a base portrait per species reused as an edit reference) is a future refinement; v1 relies on a strong shared style prompt.
- `monitors`-based auto-launch (if the plugin runtime supports it) could replace the opt-in SessionStart spawn later.
