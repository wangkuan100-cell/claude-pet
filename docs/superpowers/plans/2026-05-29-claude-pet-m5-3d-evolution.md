# claude-pet M5: 3D-Cartoon Art + Evolution Chains — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restructure the pet into **6 evolution lines × 6 forms** (egg → … → legendary), render **cute cartoon-3D** generated PNGs (emoji fallback), and add an **evolution animation** when a form changes. Then generate the art (36 PNGs) — phoenix sample first.

**Architecture:** A new `src/lines.js` is the single source of the 6 lines and their 6 forms (display name, fallback emoji, art-prompt description). `src/levels.js` maps a level to one of the 6 form tiers. Art keys move from `species/stage/expression` → `line/form` (one neutral 3D base per form; mood stays an emoji overlay). Renderer is still the dumb painter; main computes an `evolved` event on form change for a special animation. All built on `m4-art-packaging`.

**Tech Stack:** Node 22, Electron, ESM logic + `.cjs` Electron files, built-in `fetch` for image gen. Builds on M4.

**Spec:** `docs/superpowers/specs/2026-05-29-claude-pet-m5-3d-evolution-design.md`. Depends on M4.

---

## Verifiability note
- Tasks 1–6 logic → TDD (`node --test`). Task 7 renderer + Task 8 art are visual — the controller verifies via browser-preview screenshots and real generation.

## File Structure
```
src/lines.js                NEW: 6 lines × 6 forms {name, emoji, art}; LINE_IDS, FORMS, lineFor
src/levels.js               MODIFY: stageForLevel -> 6 form tiers
widget/placeholders.js      MODIFY: spritePlaceholder keyed by line/form via lines.js
art/prompts.js              MODIFY: cartoon-3D STYLE; matrix line×form; promptFor(line,form); outputPath <line>/<form>.png
art/generate.mjs            MODIFY: spriteMatrix(lines) shape; CLI arg = line id
widget/sprite-source.js     MODIFY: assetUrlFor accepts a 2-segment line/form key
widget/render-logic.js      MODIFY: spriteKey = line/form (drop expr from key); paintEvents adds `evolved`
widget/main.cjs             MODIFY: imageSrc uses line/form; events already include form via panel.stage
widget/renderer/index.html  MODIFY: (none required beyond M4) — uses existing #celebrate/#toast
widget/renderer/styles.css  MODIFY: add an .evolving flash
widget/renderer/pet.js      MODIFY: adoption shows 6 lines; play evolution animation on events.evolved
test/*                      MODIFY/ADD: lines, levels, art, placeholders, sprite-source, render-logic
README.md                   MODIFY: evolution lines + cartoon-3D note
```

---

### Task 1: Evolution lines config (`src/lines.js`)

**Files:** Create `src/lines.js`; Test `test/lines.test.js`

- [ ] **Step 1: Failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, LINE_IDS, FORMS, lineFor } from '../src/lines.js';

test('there are 6 lines, each with all 6 forms', () => {
  assert.equal(LINE_IDS.length, 6);
  assert.deepEqual(FORMS, ['egg', 'hatchling', 'juvenile', 'adolescent', 'adult', 'legendary']);
  for (const id of LINE_IDS) {
    const line = LINES[id];
    assert.ok(line.name && line.emoji);
    for (const form of FORMS) {
      assert.ok(line.forms[form], `${id} missing ${form}`);
      assert.ok(line.forms[form].emoji, `${id}/${form} missing emoji`);
      assert.ok(line.forms[form].art.length > 5, `${id}/${form} missing art`);
    }
  }
});

test('phoenix line matches the spec example and lineFor works', () => {
  assert.equal(lineFor('phoenix').name, '凤凰');
  assert.equal(lineFor('phoenix').forms.legendary.emoji, '🔥');
  assert.equal(lineFor('nope'), null);
});
```

- [ ] **Step 2: Run → fail.** `node --test test/lines.test.js` → cannot find module.

- [ ] **Step 3: Implement `src/lines.js`**

```js
// Six evolution lines, each with six forms (egg -> ... -> legendary).
// `art` is the creature description fed to the image model (joined with STYLE).
// `emoji` is the placeholder shown until a generated PNG exists.
export const FORMS = ['egg', 'hatchling', 'juvenile', 'adolescent', 'adult', 'legendary'];

export const LINES = {
  phoenix: {
    name: '凤凰', emoji: '🔥',
    forms: {
      egg:        { emoji: '🥚', art: 'a warm orange speckled egg with tiny flame motifs' },
      hatchling:  { emoji: '🐣', art: 'a tiny fluffy orange chick hatching, soft embers around it' },
      juvenile:   { emoji: '🐤', art: 'a plump little chick with small glowing orange feathers' },
      adolescent: { emoji: '🐦', art: 'a young firebird with growing fiery plumage and bright eyes' },
      adult:      { emoji: '🦅', art: 'a majestic fire-hawk with blazing orange-gold wings' },
      legendary:  { emoji: '🔥', art: 'a glorious phoenix wreathed in radiant golden flames with long tail feathers' },
    },
  },
  dragon: {
    name: '龙王', emoji: '🐉',
    forms: {
      egg:        { emoji: '🥚', art: 'a green scaly egg with faint golden cracks' },
      hatchling:  { emoji: '🥚', art: 'a tiny green baby dragon poking out of its cracked shell' },
      juvenile:   { emoji: '🦎', art: 'a small round green dragon with stubby wings and big eyes' },
      adolescent: { emoji: '🐲', art: 'a young dragon with growing horns and bigger wings' },
      adult:      { emoji: '🐉', art: 'a strong adult dragon with full wings and curved horns' },
      legendary:  { emoji: '🐉', art: 'a mighty dragon king with golden horns, glowing aura and huge wings' },
    },
  },
  kitsune: {
    name: '九尾狐', emoji: '✨',
    forms: {
      egg:        { emoji: '🥚', art: 'a white egg with a soft pink swirl' },
      hatchling:  { emoji: '🐾', art: 'a tiny white fox kit with one little tail and big eyes' },
      juvenile:   { emoji: '🦊', art: 'a small fluffy fox with two tails' },
      adolescent: { emoji: '🦊', art: 'a young mystical fox with three softly glowing tails' },
      adult:      { emoji: '🦊', art: 'an elegant fox with several flowing glowing tails' },
      legendary:  { emoji: '✨', art: 'a divine nine-tailed kitsune with shimmering golden tails and a glowing forehead mark' },
    },
  },
  cerberus: {
    name: '地狱犬', emoji: '🐺',
    forms: {
      egg:        { emoji: '🥚', art: 'a dark grey egg with a faint red glow' },
      hatchling:  { emoji: '🐶', art: 'a tiny black puppy with big round eyes' },
      juvenile:   { emoji: '🐕', art: 'a small black dog with a little glowing collar' },
      adolescent: { emoji: '🐕', art: 'a young muscular hound with faint ember eyes' },
      adult:      { emoji: '🐺', art: 'a powerful black wolf-dog with glowing red eyes' },
      legendary:  { emoji: '🐺', art: 'a cute-but-fierce three-headed hellhound with ember-glowing maws' },
    },
  },
  sphinx: {
    name: '狮身兽', emoji: '🦁',
    forms: {
      egg:        { emoji: '🥚', art: 'a sandy egg with a small gold marking' },
      hatchling:  { emoji: '🐱', art: 'a tiny sandy kitten with big curious eyes' },
      juvenile:   { emoji: '🐱', art: 'a small cat with faint golden markings' },
      adolescent: { emoji: '🐈', art: 'a young cat with tiny feathered wing-buds' },
      adult:      { emoji: '🦁', art: 'a regal winged cat with a small mane and gold jewelry' },
      legendary:  { emoji: '🦁', art: 'a majestic winged sphinx-cat with a flowing mane and golden headdress' },
    },
  },
  golem: {
    name: '魔像王', emoji: '💎',
    forms: {
      egg:        { emoji: '🥚', art: 'a translucent green jelly egg' },
      hatchling:  { emoji: '🟢', art: 'a tiny glossy green slime droplet with sparkly eyes' },
      juvenile:   { emoji: '🟢', art: 'a round bouncy green slime with a happy face' },
      adolescent: { emoji: '🟩', art: 'a bigger green slime with small crystal shards forming inside' },
      adult:      { emoji: '💠', art: 'a large crystalline slime with a glowing gem core' },
      legendary:  { emoji: '💎', art: 'a towering crystal golem-king of gemstone slime with a glowing crown core' },
    },
  },
};

export const LINE_IDS = Object.keys(LINES);
export function lineFor(id) { return LINES[id] || null; }
```

- [ ] **Step 4: Run → pass** (2 tests). **Step 5: Commit** `git add src/lines.js test/lines.test.js && git commit -m "feat: define 6 evolution lines x 6 forms with cartoon-3D art prompts"`

---

### Task 2: Level → form tiers (`src/levels.js`)

**Files:** Modify `src/levels.js`; Modify `test/levels.test.js`

- [ ] **Step 1: Replace the `stageForLevel` cases in `test/levels.test.js`.** Find the existing `stageForLevel` test and replace its body with:

```js
test('stageForLevel maps levels to the six evolution form tiers', () => {
  assert.equal(stageForLevel(1), 'egg');
  assert.equal(stageForLevel(2), 'hatchling');
  assert.equal(stageForLevel(3), 'juvenile');
  assert.equal(stageForLevel(4), 'adolescent');
  assert.equal(stageForLevel(5), 'adult');
  assert.equal(stageForLevel(6), 'legendary');
  assert.equal(stageForLevel(9), 'legendary');
});
```

- [ ] **Step 2: Run → fail** (`node --test test/levels.test.js`): old mapping returns 'hatchling' etc. mismatched at juvenile/adolescent/legendary.

- [ ] **Step 3: Replace `stageForLevel` in `src/levels.js`** with:

```js
export function stageForLevel(level) {
  const forms = { 1: 'egg', 2: 'hatchling', 3: 'juvenile', 4: 'adolescent', 5: 'adult' };
  return forms[level] || 'legendary';
}
```

- [ ] **Step 4: Run → pass.** Then full `node --test` and fix any caller expectations (engine.test.js asserts `stage` values — e.g. a milestone test expecting `'hatchling'` at Lv2 still holds; a test expecting `'evolved1'`/`'child'` must be updated to the new tiers). Report which tests changed.

- [ ] **Step 5: Commit** `git add src/levels.js test/levels.test.js [+ any engine test] && git commit -m "feat: map levels to six evolution form tiers (egg..legendary)"`

---

### Task 3: Art prompts → cartoon-3D, line×form (`art/prompts.js`, `art/generate.mjs`)

**Files:** Modify `art/prompts.js`, `art/generate.mjs`; Modify `test/art.test.js`

- [ ] **Step 1: Update `test/art.test.js`** — replace the prompt/matrix/path cases:

```js
import { promptFor, spriteMatrix, outputPath, STYLE } from '../art/prompts.js';

test('STYLE is cartoon 3D and promptFor includes the line form art + style', () => {
  assert.match(STYLE, /cartoon 3D/i);
  const p = promptFor('phoenix', 'legendary');
  assert.match(p, /phoenix/i);
  assert.match(p, /transparent background/i);
});

test('spriteMatrix covers lines x forms; outputPath is <line>/<form>.png', () => {
  const m = spriteMatrix(['phoenix']);
  assert.equal(m.length, 6); // 6 forms
  assert.ok(m.every((i) => i.key === `${i.line}/${i.form}`));
  assert.equal(outputPath('/A', { line: 'phoenix', form: 'legendary' }), '/A/phoenix/legendary.png');
});
```

(Also update the `generateAll` test to use `{ line, form, key }` items and assert it writes `<dir>/phoenix/legendary.png`.)

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Rewrite `art/prompts.js`**

```js
import { LINES, LINE_IDS, FORMS } from '../src/lines.js';

export const STYLE = 'cute cartoon 3D render, Pixar-style, big expressive eyes, soft rounded shapes, glossy smooth shading, soft studio lighting, subtle ambient occlusion, vibrant saturated colors, adorable mascot, centered single character, plain transparent background, no text, no drop shadow';

export function promptFor(line, form) {
  const art = LINES[line]?.forms?.[form]?.art || `${line} ${form}`;
  return `${art}. ${STYLE}.`;
}

export function spriteMatrix(lineList = LINE_IDS) {
  const out = [];
  for (const line of lineList) for (const form of FORMS) out.push({ line, form, key: `${line}/${form}` });
  return out;
}

export function outputPath(assetsDir, item) {
  return `${assetsDir}/${item.line}/${item.form}.png`;
}
```

- [ ] **Step 4: Update `art/generate.mjs`** — `generateAll` calls `promptFor(item.line, item.form)`; the CLI builds `spriteMatrix(only ? [only] : LINE_IDS)` (import `LINE_IDS` from `../src/lines.js`). Keep `requestImage` unchanged.

- [ ] **Step 5: Run → pass.** **Step 6: Commit** `git add art/prompts.js art/generate.mjs test/art.test.js && git commit -m "feat: cartoon-3D prompts over line x form matrix"`

---

### Task 4: placeholders + sprite-source re-keyed (`widget/placeholders.js`, `widget/sprite-source.js`)

**Files:** Modify `widget/placeholders.js`, `widget/sprite-source.js`; Modify their tests

- [ ] **Step 1: Update `test/placeholders.test.js`** — replace with line/form behavior:

```js
import { spritePlaceholder, LINE_IDS } from '../widget/placeholders.js';

test('LINE_IDS exposes the six adoptable lines', () => {
  assert.equal(LINE_IDS.length, 6);
});

test('spritePlaceholder returns the per-line/form emoji and scale', () => {
  assert.equal(spritePlaceholder('phoenix/legendary').base, '🔥');
  assert.equal(spritePlaceholder('phoenix/egg').base, '🥚');
  assert.equal(spritePlaceholder('egg').base, '🥚'); // pre-adoption generic egg
  const adult = spritePlaceholder('dragon/adult');
  assert.ok(adult.scale >= 1.0);
});
```

- [ ] **Step 2: Run → fail. Step 3: Rewrite `widget/placeholders.js`**

```js
import { LINES, LINE_IDS, FORMS } from '../src/lines.js';

const FORM_SCALE = { egg: 0.7, hatchling: 0.8, juvenile: 0.95, adolescent: 1.1, adult: 1.25, legendary: 1.4 };

export function spritePlaceholder(spriteKey) {
  if (!spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) {
    return { base: '🥚', scale: 0.7, expr: null };
  }
  const [line, form] = spriteKey.split('/');
  const base = LINES[line]?.forms?.[form]?.emoji || '🐾';
  return { base, scale: FORM_SCALE[form] || 1.0, expr: null };
}

export { LINE_IDS, FORMS };
```

(Note: the expression emoji overlay is applied by the renderer from `data.sprite.expr`, which render-logic still sets — see Task 5. `spritePlaceholder` only supplies the base + scale.)

- [ ] **Step 4: Update `test/sprite-source.test.js`** — the key is now `line/form` (two segments); a single-segment `'egg'` returns null:

```js
test('assetUrlFor returns a file URL for an existing <line>/<form>.png, else null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  fs.mkdirSync(path.join(dir, 'phoenix'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'phoenix', 'legendary.png'), 'x');
  assert.match(assetUrlFor(dir, 'phoenix/legendary'), /phoenix\/legendary\.png$/);
  assert.equal(assetUrlFor(dir, 'phoenix/adult'), null);
  assert.equal(assetUrlFor(dir, 'egg'), null);
});
```

`widget/sprite-source.js` already splits on `/` and requires a `/` — it works for `line/form` unchanged. Verify; only adjust if the test fails.

- [ ] **Step 5: Run → pass (placeholders + sprite-source). Step 6: Commit** `git add widget/placeholders.js widget/sprite-source.js test/placeholders.test.js test/sprite-source.test.js && git commit -m "feat: re-key placeholders and asset resolver by line/form"`

---

### Task 5: render-logic — line/form sprite key + `evolved` event (`widget/render-logic.js`)

**Files:** Modify `widget/render-logic.js`, `widget/main.cjs`; Modify `test/render-logic.test.js`

- [ ] **Step 1: Add/replace tests** in `test/render-logic.test.js`:

```js
test('spriteKey is the line/form (expression is an overlay, not in the key)', () => {
  assert.equal(spriteKey(pet({ species: 'phoenix', stage: 'legendary' }), NOW), 'phoenix/legendary');
  assert.equal(spriteKey(pet({ species: null, stage: 'egg' }), NOW), 'egg');
});

test('paintEvents flags an evolution when the form (stage) changes', () => {
  assert.equal(paintEvents({ level: 5, stage: 'adult' }, { level: 6, stage: 'legendary' }).evolved, true);
  assert.equal(paintEvents({ level: 2, stage: 'hatchling' }, { level: 2, stage: 'hatchling' }).evolved, false);
  assert.equal(paintEvents(null, { level: 1, stage: 'egg' }).evolved, false);
});
```

(Adjust the existing `spriteKey` test that expected `dragon/hatchling/flow` → now `dragon/hatchling`. Ensure `panelData` includes `stage` so `paintEvents` can compare it — add `stage: pet.stage` to the panel object if not already present; the panel already has `stage`.)

- [ ] **Step 2: Run → fail. Step 3: Edit `widget/render-logic.js`:**
  - `spriteKey`: `return pet.species ? \`${pet.species}/${pet.stage}\` : 'egg';`
  - `buildPaintData`: keep `sprite: spritePlaceholder(spriteKey(pet, now))` and still set `expression`/`sprite.expr` via the existing expression-emoji logic (so the overlay still works). Set `sprite.expr` to the expression-emoji: import the existing `EXPRESSION_EMOJI`? Simpler: keep `spritePlaceholder` returning `expr:null` and have `buildPaintData` attach the overlay emoji from a small map. To avoid a new dependency, add to render-logic:
    ```js
    const EXPR_EMOJI = { flow: '🤩', happy: '😄', normal: '🙂', sleepy: '😴', bored: '🥱', worried: '😟' };
    ```
    and in `buildPaintData` after computing `expr`: `const sprite = spritePlaceholder(spriteKey(pet, now)); sprite.expr = EXPR_EMOJI[expr] || null;`
  - `paintEvents`: add `evolved`:
    ```js
    export function paintEvents(prevPanel, nextPanel) {
      if (!prevPanel || !nextPanel) return { leveledUp: false, evolved: false, newLevel: nextPanel ? nextPanel.level : null, newAchievements: [], newStage: nextPanel ? nextPanel.stage : null };
      const prev = new Set(prevPanel.achievements || []);
      return {
        leveledUp: nextPanel.level > prevPanel.level,
        evolved: !!nextPanel.stage && nextPanel.stage !== prevPanel.stage,
        newLevel: nextPanel.level,
        newStage: nextPanel.stage,
        newAchievements: (nextPanel.achievements || []).filter((a) => !prev.has(a)),
      };
    }
    ```

- [ ] **Step 4: `widget/main.cjs`** — the `imageSrc` line already uses `${pet.species}/${pet.stage}/...expression` from M4; change it to the 2-segment key: `spriteSource.assetUrlFor(assetsDir, \`${pet.species}/${pet.stage}\`)`. (Remove the expression segment.)

- [ ] **Step 5: Run full `node --test` → pass.** Step 6: Commit `git add widget/render-logic.js widget/main.cjs test/render-logic.test.js && git commit -m "feat: line/form sprite key + evolution (form-change) event"`

---

### Task 6: Renderer — adopt 6 lines + evolution animation (`widget/renderer/*`)

**Files:** Modify `widget/renderer/pet.js`, `widget/renderer/styles.css`

- [ ] **Step 1: `pet.js` adoption** — `renderSpecies` should show the 6 LINES (final-form emoji + name), sending the line id to `adopt`. Replace the hardcoded `EMOJI` map with line data passed in `data.species` (which main will fill with line ids). Build buttons whose label is the line's legendary emoji and `title` is the line name. Since the renderer can't import `lines.js` (file:// ESM), main must include line display info in the adopt paint-data: change buildPaintData adopt branch to `{ mode:'adopt', species: LINE_IDS, lines: LINES-display }`. SIMPLER: have `buildPaintData` return `lines: LINE_IDS.map(id => ({ id, emoji: LINES[id].emoji, name: LINES[id].name }))` and `renderSpecies(data.lines)` builds buttons from it.
  - Update `buildPaintData` adopt branch (render-logic, Task 5) to: `return { mode: 'adopt', lines: LINE_IDS.map((id) => ({ id, emoji: LINES[id].emoji, name: LINES[id].name })) };` (import `LINES, LINE_IDS` from `../src/lines.js` in render-logic).
  - `renderSpecies(list)` iterates `list` (objects `{id,emoji,name}`), button text = `emoji`, title = `name`, `onclick = () => window.api.adopt(id)`.

- [ ] **Step 2: `pet.js` evolution animation** — in `paint`, before the level-up check:
    ```js
    const ev = data.events;
    if (ev && ev.evolved) evolve(ev.newStage);
    else if (ev && ev.leveledUp) celebrate(`Lv ${ev.newLevel}!`);
    else if (ev && ev.newAchievements && ev.newAchievements.length) toast(`🏆 ${ev.newAchievements[0]}`);
    ```
    Add an `evolve(stage)` function: a white flash + bigger pop + a "进化!" banner:
    ```js
    function evolve(stage) {
      const c = $('celebrate');
      c.textContent = '✨'; c.classList.remove('hidden','show'); void c.offsetWidth; c.classList.add('show');
      document.getElementById('app').classList.remove('evolving'); void document.body.offsetWidth;
      document.getElementById('app').classList.add('evolving');
      toast(`进化! → ${stage}`);
      setTimeout(() => { c.textContent = '🎉'; }, 1500);
    }
    ```

- [ ] **Step 3: `styles.css`** — add the evolution flash:
    ```css
    #app.evolving { animation: evoflash 1.2s ease-out; }
    @keyframes evoflash { 0% { filter: brightness(3) blur(2px); } 40% { filter: brightness(2); } 100% { filter: none; } }
    ```

- [ ] **Step 4: Visually verify** in browser preview (controller): paint adopt-mode with `lines:[…6…]` → 6 line buttons (final emojis + names); paint with `events:{evolved:true,newStage:'legendary'}` → white flash + ✨ + "进化! → legendary" toast; paint a normal pet → base renders. Screenshots.

- [ ] **Step 5: Commit** `git add widget/renderer/pet.js widget/renderer/styles.css && git commit -m "feat: adopt one of 6 evolution lines + evolution flash animation"`

---

### Task 7: Generate the cartoon-3D art (controller-run; billing now active)

**Files:** writes `assets/<line>/<form>.png`

- [ ] **Step 1: Phoenix sample (6 PNGs).** Run `OPENAI_API_KEY=… OPENAI_IMAGE_MODEL=gpt-image-2 node art/generate.mjs phoenix`. Confirm 6 PNGs under `assets/phoenix/`. Open a couple in the widget/preview to confirm the cartoon-3D look + egg→…→phoenix coherence. (Controller eyeballs; iterate the STYLE/art strings if needed before the full run.)
- [ ] **Step 2: Full run (36 PNGs).** `OPENAI_API_KEY=… OPENAI_IMAGE_MODEL=gpt-image-2 npm run gen-art`. Confirm `assets/<line>/<form>.png` for all 6 lines × 6 forms.
- [ ] **Step 3: Commit the assets** `git add assets && git commit -m "assets: generated cartoon-3D sprites for all 6 evolution lines"`. (If the user prefers not to commit binaries, gitignore `assets/*.png` instead — decide with the user.)

---

### Task 8: README + end-to-end + full suite

- [ ] **Step 1:** `node --test` all green (report count).
- [ ] **Step 2:** End-to-end: throwaway `CLAUDE_PET_HOME`, `node bin/pet.js adopt phoenix`, drive a hook, `npm run widget` (or preview the renderer) → confirm the phoenix form renders from the generated PNG (or emoji fallback if art skipped) and evolving across levels works.
- [ ] **Step 3:** Update `README.md`: replace the species list with the 6 evolution lines; note cartoon-3D art + 6-form evolution + the evolution animation.
- [ ] **Step 4: Commit** `git add README.md && git commit -m "docs: document 6 evolution lines and cartoon-3D art"`

---

## Self-Review (completed during planning)
- 6 lines × 6 forms in one source (`lines.js`); levels → 6 tiers; art/placeholders/sprite-source/render-logic all re-keyed to `line/form`; renderer adopts lines + plays an evolution animation; art generated cartoon-3D (sample → full). Matches spec §2–5. ✔
- Cost/scale: one neutral base per form (36 total), mood via existing emoji overlay (render-logic sets `sprite.expr`). ✔
- Emoji fallback preserved (placeholders by line/form; no PNG → emoji), so code works before/without art. ✔
- Evolution moment: `paintEvents.evolved` on form (stage) change → `evolve()` animation, distinct from ordinary level-up. ✔
- **Type consistency:** sprite key `line/form` produced by `spriteKey`, consumed by `spritePlaceholder`, `assetUrlFor`, and main's `imageSrc`. `paintEvents` reads `panel.stage` (present in `panelData`). Adopt paint-data carries `lines:[{id,emoji,name}]`, consumed by `renderSpecies`. `promptFor(line,form)`/`outputPath`/`spriteMatrix` align across `art/*` + tests.
- Invariant preserved: no `bin/hook.js`/`run-git.js` changes; still read-only on the project.

## Notes / follow-ups
- Confirm `gpt-image-2` model id + cost on the first sample run; iterate STYLE if the look isn't "cute cartoon 3D" enough.
- Decide whether to commit generated PNGs or gitignore them (binary size).
- Reference-image consistency across a line's 6 forms is a future refinement (v1 uses per-form prompts + shared STYLE).
