# claude-pet M3: Animations, Empathy, Click-Through — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the M2 widget feel alive: a level-up celebration, achievement-unlock toasts, a "don't give up" empathy bubble + gentle worried animation when the pet is sad, and proper mouse **click-through** so the transparent window doesn't block the desktop behind it.

**Architecture:** Keep the M2 split — all logic in the Electron **main** process, renderer stays a **dumb painter**. `render-logic.js` gains a pure `paintEvents(prev, next)` (what changed between two paints → level-up? new achievements?) and an empathy bubble in `buildPaintData`. **Main** remembers the last panel, computes `events` with `paintEvents`, and includes them in the paint-data; the renderer triggers CSS animations from `data.events` (NO module imports in the renderer — Chromium blocks ESM over `file://`). The renderer reports pointer enter/leave so main toggles `setIgnoreMouseEvents`.

**Tech Stack:** Same as M2 (Electron, ESM logic + `.cjs` main/preload, classic-script renderer). Builds on `m2-desktop-widget`.

**Spec:** `docs/superpowers/specs/2026-05-28-claude-pet-design.md` (M3 = §9 expression priority "升级动画 > 提醒气泡 > 失败打气 > 心情表情" + polish). Depends on M2.

---

## Verifiability note
- Task 1 is pure logic → TDD (`node --test`).
- Tasks 2–4 are Electron/DOM/CSS → verified by browser-preview screenshots (animations/empathy, by injecting a fixture `data.events`) and an Electron launch (click-through). On-screen click-through ultimately needs a human display.

## File Structure
```
widget/render-logic.js     MODIFY: empathy bubble in buildPaintData; add paintEvents()
widget/main.cjs            MODIFY: track lastPanel, attach data.events; click-through + 'set-interactive' IPC
widget/preload.cjs         MODIFY: add setInteractive(bool)
widget/renderer/index.html MODIFY: add #celebrate overlay + #toast
widget/renderer/styles.css MODIFY: keyframes (celebrate, bounce, toast, sway) + empathy bubble
widget/renderer/pet.js     MODIFY: animate from data.events; worried class; empathy bubble class; pointer enter/leave -> setInteractive
test/render-logic.test.js  MODIFY: add empathy + paintEvents cases
README.md                  MODIFY: note M3 polish
```

---

### Task 1: render-logic — empathy bubble + paintEvents (pure, TDD)

**Files:**
- Modify: `widget/render-logic.js`
- Modify: `test/render-logic.test.js`

- [ ] **Step 1: Add failing tests** (append to `test/render-logic.test.js`)

```js
import { paintEvents } from '../widget/render-logic.js';

test('buildPaintData shows an empathy bubble when worried and no alert outranks it', () => {
  const failing = pet({ mood: 90, recentFailureUntil: '2026-05-28T12:10:00Z' }); // worried at NOW
  const data = buildPaintData(failing, { alerts: [] }, NOW);
  assert.equal(data.expression, 'worried');
  assert.equal(data.bubble.kind, 'empathy');
  assert.match(data.bubble.text, /别灰心/);
});

test('an alert bubble outranks the empathy bubble', () => {
  const failing = pet({ mood: 90, recentFailureUntil: '2026-05-28T12:10:00Z' });
  const data = buildPaintData(failing, { alerts: ['context'] }, NOW);
  assert.equal(data.bubble.kind, 'context');
});

test('paintEvents reports level-ups and newly unlocked achievements', () => {
  assert.deepEqual(paintEvents(null, { level: 2, achievements: ['a'] }), { leveledUp: false, newLevel: 2, newAchievements: [] });
  assert.deepEqual(paintEvents({ level: 1, achievements: [] }, { level: 2, achievements: ['first-hatch'] }), { leveledUp: true, newLevel: 2, newAchievements: ['first-hatch'] });
  assert.deepEqual(paintEvents({ level: 2, achievements: ['a'] }, { level: 2, achievements: ['a', 'b'] }), { leveledUp: false, newLevel: 2, newAchievements: ['b'] });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/render-logic.test.js`
Expected: FAIL — `paintEvents` not exported; `data.expression`/empathy bubble undefined.

- [ ] **Step 3: Edit `widget/render-logic.js`** — replace the existing `buildPaintData` with this and add `paintEvents`:

```js
export function buildPaintData(pet, status, now = new Date()) {
  if (!pet.species) return { mode: 'adopt', species: SPECIES };
  const expr = currentExpression(pet, now);
  let bubble = bubbleFor(status);
  if (!bubble && expr === 'worried') bubble = { kind: 'empathy', emoji: '🫂', text: '别灰心,我陪着你' };
  return {
    mode: 'pet',
    sprite: spritePlaceholder(`${pet.species}/${pet.stage}/${expr}`),
    expression: expr,
    bubble,
    panel: panelData(pet, status, now),
  };
}

export function paintEvents(prevPanel, nextPanel) {
  if (!prevPanel || !nextPanel) {
    return { leveledUp: false, newLevel: nextPanel ? nextPanel.level : null, newAchievements: [] };
  }
  const prev = new Set(prevPanel.achievements || []);
  return {
    leveledUp: nextPanel.level > prevPanel.level,
    newLevel: nextPanel.level,
    newAchievements: (nextPanel.achievements || []).filter((a) => !prev.has(a)),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/render-logic.test.js`
Expected: PASS (10 tests: original 7 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add widget/render-logic.js test/render-logic.test.js
git commit -m "feat: add empathy bubble and paint-diff events to render-logic"
```

---

### Task 2: Main computes events + click-through; preload `setInteractive`

**Files:**
- Modify: `widget/main.cjs`
- Modify: `widget/preload.cjs`

- [ ] **Step 1: Edit `widget/main.cjs` — attach `data.events` in `repaint()`.** Replace the existing `repaint` function with:

```js
let lastPanel = null;
function repaint() {
  if (!win || win.isDestroyed() || !logic || !stateSource) return;
  const { pet, status } = stateSource.readState();
  const data = logic.buildPaintData(pet, status, new Date());
  if (data.mode === 'pet') {
    data.events = logic.paintEvents(lastPanel, data.panel);
    lastPanel = data.panel;
  } else {
    lastPanel = null;
  }
  win.webContents.send('paint', data);
}
```

- [ ] **Step 2: Edit `widget/main.cjs` — click-through.** In `createWindow`, immediately after `win.loadFile(...)`, add:

```js
  // Click-through everywhere by default; the renderer re-enables hits while the
  // pointer is over the pet/panel/adoption UI (see 'set-interactive').
  win.setIgnoreMouseEvents(true, { forward: true });
```

And alongside the other `ipcMain.on(...)` handlers, add:

```js
  ipcMain.on('set-interactive', (_e, on) => {
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true });
  });
```

- [ ] **Step 3: Add `setInteractive` to `widget/preload.cjs`** — inside the `exposeInMainWorld('api', { ... })` object (keep existing props):

```js
  setInteractive: (on) => ipcRenderer.send('set-interactive', !!on),
```

- [ ] **Step 4: Syntax-check both files**

Run: `node -e "new Function(require('fs').readFileSync('widget/preload.cjs','utf8')); new Function(require('fs').readFileSync('widget/main.cjs','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add widget/main.cjs widget/preload.cjs
git commit -m "feat: main computes paint-diff events; window click-through except over the pet"
```

---

### Task 3: Renderer — animations, empathy styling, worried sway, hit-testing

**Files:**
- Modify: `widget/renderer/index.html`
- Modify: `widget/renderer/styles.css`
- Modify: `widget/renderer/pet.js`

- [ ] **Step 1: Edit `widget/renderer/index.html`** — inside `#pet`, right after the `#bubble` line, add:

```html
        <div id="celebrate" class="hidden">🎉</div>
        <div id="toast" class="hidden"></div>
```

- [ ] **Step 2: Append to `widget/renderer/styles.css`**

```css
/* worried: gentle empathetic sway */
#sprite.worried #sprite-base { animation: sway 1.2s ease-in-out infinite; }
@keyframes sway { 0%,100% { rotate: -4deg; } 50% { rotate: 4deg; } }

/* level-up celebration */
#celebrate { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 80px; pointer-events: none; }
#celebrate.show { animation: pop 1.4s ease-out; }
@keyframes pop { 0% { transform: scale(.2); opacity: 0; } 30% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
#sprite.celebrate #sprite-base { animation: bounce .5s ease 3; }
@keyframes bounce { 0%,100% { translate: 0 0; } 50% { translate: 0 -18px; } }

/* achievement / level toast */
#toast {
  -webkit-app-region: no-drag;
  position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(90deg,#7e6,#5ad); color: #061; font-weight: 700;
  padding: 6px 12px; border-radius: 12px; font-size: 12px; white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0,0,0,.35);
}
#toast.show { animation: toastIn 2.6s ease both; }
@keyframes toastIn { 0% { opacity: 0; transform: translate(-50%,12px); } 12%,80% { opacity: 1; transform: translate(-50%,0); } 100% { opacity: 0; transform: translate(-50%,-8px); } }
.bubble-empathy { background: rgba(80,40,90,.92) !important; }
```

(Note: `sway`/`bounce` use the `rotate`/`translate` CSS properties so they compose with the inline `transform: scale(...)` on `#sprite-base` without clobbering it.)

- [ ] **Step 3: Replace `widget/renderer/pet.js`** with:

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
    $('sprite').classList.toggle('worried', data.expression === 'worried');

    const bubble = $('bubble');
    if (data.bubble) {
      bubble.textContent = `${data.bubble.emoji} ${data.bubble.text}`;
      bubble.classList.remove('hidden');
      bubble.classList.toggle('bubble-empathy', data.bubble.kind === 'empathy');
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

    // Animate transitions main computed for us.
    const ev = data.events;
    if (ev && ev.leveledUp) celebrate(`Lv ${ev.newLevel}!`);
    else if (ev && ev.newAchievements && ev.newAchievements.length) toast(`🏆 ${ev.newAchievements[0]}`);
  }

  function celebrate(label) {
    const c = $('celebrate'), s = $('sprite');
    c.classList.remove('hidden', 'show'); void c.offsetWidth; c.classList.add('show');
    s.classList.remove('celebrate'); void s.offsetWidth; s.classList.add('celebrate');
    toast(label);
  }

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden', 'show'); void t.offsetWidth; t.classList.add('show');
  }

  function renderSpecies(list) {
    const grid = $('species-grid');
    if (grid.childElementCount) return;
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

  // Capture the mouse only while the pointer is over real UI; otherwise clicks pass through.
  (function wireInteractive() {
    const set = (on) => window.api && window.api.setInteractive(on);
    for (const sel of ['#sprite', '#panel', '#adopt', '#bubble', '#toast']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.addEventListener('mouseenter', () => set(true));
      el.addEventListener('mouseleave', () => set(false));
    }
  })();

  if (window.api) {
    window.api.onPaint(paint);
    window.api.requestPaint();
  } else if (window.__FIXTURE__) {
    paint(window.__FIXTURE__);
  }
  window.__paint = paint;
})();
```

- [ ] **Step 4: Visually verify in the browser** (preview server on `widget/renderer`). Inject fixtures via `window.__paint`:
  - Level-up: paint a pet fixture with `events:{leveledUp:true,newLevel:3,newAchievements:[]}` → confirm 🎉 overlay pops, sprite bounces, `Lv 3!` toast.
  - Achievement: `events:{leveledUp:false,newLevel:3,newAchievements:['first-feat']}` → confirm `🏆 first-feat` toast.
  - Worried: `expression:'worried'`, `bubble:{kind:'empathy',emoji:'🫂',text:'别灰心,我陪着你'}` → confirm purple empathy bubble + gentle sway.
  Report screenshots.

- [ ] **Step 5: Commit**

```bash
git add widget/renderer/index.html widget/renderer/styles.css widget/renderer/pet.js
git commit -m "feat: level-up/achievement animations, empathy bubble, worried sway, interactive hit-testing"
```

---

### Task 4: End-to-end + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full suite green**

Run: `node --test`
Expected: PASS (M2's 64 + 3 new render-logic = 67). Report the count.

- [ ] **Step 2: Electron launch smoke.** With a throwaway `CLAUDE_PET_HOME` (adopt + a hook write), run `timeout 8 npm run widget 2>&1 | head -40`. Confirm no errors from our code. Document that on-screen click-through needs a human display to fully confirm.

- [ ] **Step 3: Update `README.md`** — under the "Desktop widget" section add:

```markdown
- M3 polish: level-up celebration + achievement toasts, an empathy bubble when tests keep failing, and click-through so the window never blocks what's behind it.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: note M3 polish (animations, empathy, click-through)"
```

---

## Self-Review (completed during planning)
- Spec §9 expression priority (level-up animation > alert bubble > empathy > mood expression): level-up via `paintEvents`→main `data.events`→`celebrate` (Tasks 1–3); alert-vs-empathy ordering in `buildPaintData` (Task 1); mood expression via existing `currentExpression`. ✔
- Empathy "别灰心,我陪着你" matches spec wording. ✔
- Click-through: `setIgnoreMouseEvents(true,{forward:true})` default + pointer-driven toggle (Tasks 2–3). ✔
- **Renderer imports nothing** — main computes `events`; avoids Chromium's `file://` ESM/CORS block. ✔ (No `src/constants.js` change needed.)
- CSS animations use `rotate`/`translate` properties so they don't clobber the inline `scale` transform. ✔
- **Type consistency:** `paintEvents(prevPanel,nextPanel)` consumes the `panel` shape from `buildPaintData`; main passes `lastPanel`/`data.panel`. `data.events` produced in main (Task 2), read in `pet.js` (Task 3). `bubble.kind==='empathy'` produced (Task 1), styled (Tasks 2/3). `setInteractive` defined in preload (Task 2), called in pet.js (Task 3).
- Placeholder scan: animations/click-through verified visually/by launch per the Verifiability note.

## Notes for M4 (not part of this plan)
- Replace emoji placeholders with GPT Image 2.0 PNGs (paint-data sprite gains `imageSrc`; renderer adds an `<img>` branch).
- `/pet start|stop` + auto-launch (monitors/SessionStart); packaging (`plugin.json` finalize + `marketplace.json`).
