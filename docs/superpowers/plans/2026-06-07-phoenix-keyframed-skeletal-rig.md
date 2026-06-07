# Phoenix Keyframed Skeletal Rig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local keyframed skeletal rig for `phoenix/legendary` so its run motion reads like the lower Spineboy reference: alternating feet, body weight transfer, wing counterbalance, and secondary motion.

**Architecture:** Add a data-only rig file under `assets/rigs/phoenix/legendary/rig.json`, a small runtime evaluator under `widget/renderer/petrig.js`, and a rig-source reader under `widget/rig-source.js`. Attach rig metadata from `sprite-paint-assets.js`, pass it through `pet.js`, and let `pet3d.js` use rig keyframes for existing layer groups while preserving the current layer and PNG fallbacks.

**Tech Stack:** Node `node:test`, JSON rig metadata, existing Three.js layer renderer, browser preview at `http://127.0.0.1:4319/`.

---

### Task 1: Phoenix Rig Contract

**Files:**
- Create: `test/phoenix-keyframed-rig.test.js`
- Create: `assets/rigs/phoenix/legendary/rig.json`

- [x] **Step 1: Write failing tests**

Add tests that read `assets/rigs/phoenix/legendary/rig.json` and assert:

```js
assert.equal(rig.id, 'phoenix/legendary');
assert.equal(rig.version, 1);
assert.deepEqual(Object.keys(rig.animations).sort(), ['flap', 'idle', 'run', 'tap']);
assert.deepEqual(rig.animations.run.contacts, [
  { time: 0, foot: 'footLeft' },
  { time: 0.5, foot: 'footRight' },
]);
```

Also assert every slot file exists under `assets/layers/phoenix/legendary/` and required bones exist: `root`, `body`, `crest`, `wingLeft`, `wingRight`, `footLeft`, `footRight`, `flameHalo`.

- [x] **Step 2: Verify red**

Run: `npm test -- test/phoenix-keyframed-rig.test.js`

Expected: FAIL because `rig.json` does not exist.

- [x] **Step 3: Add rig JSON**

Create `assets/rigs/phoenix/legendary/rig.json` with:

- `id: "phoenix/legendary"`
- `version: 1`
- `sourceLayers: "../../../layers/phoenix/legendary/manifest.json"`
- 256 by 256 canvas
- bones and slots for all seven phoenix layers
- `idle`, `run`, `flap`, and `tap` animations
- `run` duration `720`, `loop: true`, and alternating foot contacts at `0` and `0.5`

- [x] **Step 4: Verify green**

Run: `npm test -- test/phoenix-keyframed-rig.test.js`

Expected: PASS.

### Task 2: Keyframe Evaluator

**Files:**
- Create: `widget/renderer/petrig.js`
- Create: `test/pet-rig-runtime.test.js`

- [x] **Step 1: Write failing evaluator tests**

Test `evaluateRig(rig, clipName, elapsedMs, options)`:

```js
const pose0 = evaluateRig(rig, 'run', 0, { moving: true });
const poseHalf = evaluateRig(rig, 'run', 360, { moving: true });
assert.equal(pose0.clip, 'run');
assert.notEqual(pose0.transforms.footLeft.y, poseHalf.transforms.footLeft.y);
assert.notEqual(pose0.transforms.footRight.y, poseHalf.transforms.footRight.y);
```

Also test:

- looping clips wrap at `duration`
- unknown clips fall back to `idle`
- one-shot `tap` clamps after its duration
- `boneTransformsToLayerTransforms(rig, pose)` returns slot ids matching rig slots

- [x] **Step 2: Verify red**

Run: `npm test -- test/pet-rig-runtime.test.js`

Expected: FAIL because `widget/renderer/petrig.js` does not exist.

- [x] **Step 3: Implement evaluator**

Export:

- `evaluateRig(rig, clipName, elapsedMs, options = {})`
- `boneTransformsToLayerTransforms(rig, pose)`
- `normalizeClipTime(animation, elapsedMs)`

Support `linear`, `easeInOut`, and `hold` easing. Merge rest pose with keyed properties. Return transforms with `x`, `y`, `rotation`, `scaleX`, `scaleY`, `opacity`, and `z`.

- [x] **Step 4: Verify green**

Run: `npm test -- test/pet-rig-runtime.test.js`

Expected: PASS.

### Task 3: Rig Source And Paint Payload

**Files:**
- Create: `widget/rig-source.js`
- Modify: `widget/sprite-paint-assets.js`
- Modify: `widget/sprite-source.js`
- Modify: `test/sprite-paint-assets.test.js`
- Create: `test/rig-source.test.js`

- [x] **Step 1: Write failing tests**

Add `test/rig-source.test.js` asserting `rigFor(assetsDir, 'phoenix/legendary')` returns a rig with `id`, `animations`, and slots, and returns `null` for missing/bad keys.

Add a `test/sprite-paint-assets.test.js` case asserting that when `assetRig` returns a rig and `assetLayerSet` returns layers, `attachSpriteAssets` returns:

```js
assert.equal(result.animationMode, 'rig');
assert.deepEqual(result.rig, rig);
assert.deepEqual(result.layers, layerSet.layers);
```

- [x] **Step 2: Verify red**

Run: `npm test -- test/rig-source.test.js test/sprite-paint-assets.test.js`

Expected: FAIL because `widget/rig-source.js` and `assetRig` do not exist.

- [x] **Step 3: Implement source and attachment**

Implement `rigFor(assetsDir, spriteKey)` in `widget/rig-source.js` and export `assetRig` from `widget/sprite-source.js`. Update `attachSpriteAssets` so a rig plus layers takes priority over full PNG poses for `animationMode: "rig"`.

- [x] **Step 4: Verify green**

Run: `npm test -- test/rig-source.test.js test/sprite-paint-assets.test.js`

Expected: PASS.

### Task 4: Renderer Wiring

**Files:**
- Modify: `widget/renderer/index.html`
- Modify: `widget/renderer/pet.js`
- Modify: `widget/renderer/pet3d.js`
- Modify: `test/renderer-pet3d-bridge.test.js`

- [x] **Step 1: Write failing bridge tests**

Add a renderer bridge test asserting `sprite.rig` is forwarded into `Pet3D.show`.

- [x] **Step 2: Verify red**

Run: `npm test -- test/renderer-pet3d-bridge.test.js`

Expected: FAIL because `pet.js` does not forward `rig`.

- [x] **Step 3: Wire runtime**

Add `<script src="petrig.js"></script>` before `pet3d.js`. In `pet.js`, pass `rig: data.sprite.rig || null`. In `pet3d.js`, when `o.rig` exists and `window.PetRig` exists, evaluate `run` when moving, `tap` for pop/jump, otherwise `idle`, and apply rig slot transforms to the existing layer groups.

- [x] **Step 4: Verify green**

Run: `npm test -- test/renderer-pet3d-bridge.test.js test/pet-rig-runtime.test.js`

Expected: PASS.

### Task 5: Verification And Browser Preview

**Files:**
- Test: all changed tests
- Preview: `http://127.0.0.1:4319/`

- [x] **Step 1: Run full tests**

Run: `npm test`

Expected: PASS.

- [x] **Step 2: Browser verify phoenix**

Open `http://127.0.0.1:4319/`, confirm `phoenix/legendary` uses rig mode, trigger walk/run, and compare two screenshots during motion. Expected: visible alternating foot/body/wing motion and no browser console errors.

Observed after implementation: preview fixture reported `animationMode=rig`, browser canvas dataset reported `rig=phoenix/legendary` and `rigClip=run`, two sprite screenshots differed by 5,238 bytes, and there were no browser warnings or errors.
