# Phoenix Live2D Source Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cubism Editor handoff package for `phoenix/legendary` so a real `.moc3` can be exported without inventing invalid runtime files.

**Architecture:** Keep runtime-discoverable Live2D exports under `assets/live2d/phoenix/legendary/`, and put editable source materials under `assets/live2d/phoenix/legendary/_source/`. The source package contains copied transparent layers, a rig map with pivots and parameter intent, a motion spec for the six requested actions, and an export checklist that names the exact files the existing runtime expects after Cubism export.

**Tech Stack:** Node `node:test`, existing PNG layer assets, JSON source manifests, Live2D Cubism 3/4 model export convention.

---

### Task 1: Source Package Structure Test

**Files:**
- Create: `test/live2d-phoenix-source-package.test.js`

- [ ] **Step 1: Write the failing test**

Create a Node test that asserts the source package exists, every canonical phoenix layer is present, and `rig-map.json` plus `motion-spec.json` expose the expected layer ids and motion names.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/live2d-phoenix-source-package.test.js`

Expected before implementation: FAIL because `assets/live2d/phoenix/legendary/_source/rig-map.json` does not exist.

### Task 2: Cubism Source Package Files

**Files:**
- Create: `assets/live2d/phoenix/legendary/_source/layers/body-core.png`
- Create: `assets/live2d/phoenix/legendary/_source/layers/wing-left.png`
- Create: `assets/live2d/phoenix/legendary/_source/layers/wing-right.png`
- Create: `assets/live2d/phoenix/legendary/_source/layers/foot-left.png`
- Create: `assets/live2d/phoenix/legendary/_source/layers/foot-right.png`
- Create: `assets/live2d/phoenix/legendary/_source/layers/flame-halo.png`
- Create: `assets/live2d/phoenix/legendary/_source/layers/crest-front.png`
- Create: `assets/live2d/phoenix/legendary/_source/rig-map.json`
- Create: `assets/live2d/phoenix/legendary/_source/motion-spec.json`
- Create: `assets/live2d/phoenix/legendary/_source/EXPORT_CHECKLIST.md`

- [ ] **Step 1: Copy canonical transparent PNG layers**

Copy the no-suffix layer files named by `assets/layers/phoenix/legendary/manifest.json` into `_source/layers/`. Do not copy duplicate `" 2.png"` alternates.

- [ ] **Step 2: Write `rig-map.json`**

Include canvas size, source image path, layer order, pivots, Cubism part ids, recommended deformer ids, suggested parameters, and physics intent.

- [ ] **Step 3: Write `motion-spec.json`**

Define exactly these motion groups: `Idle`, `Run`, `Fly`, `Tap`, `Happy`, `Worried`. Each group states duration, loop behavior, expression intent, and per-parameter keyframe intent.

- [ ] **Step 4: Write `EXPORT_CHECKLIST.md`**

Document the Cubism Editor import steps and final export structure:
`model3.json`, `phoenix.moc3`, `phoenix.physics3.json`, `textures/texture_00.png`, and six `motions/*.motion3.json` files.

### Task 3: Verification

**Files:**
- Test: `test/live2d-phoenix-source-package.test.js`

- [ ] **Step 1: Run source package test**

Run: `npm test -- test/live2d-phoenix-source-package.test.js`

Expected after implementation: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected after implementation: all tests pass.

- [ ] **Step 3: Browser preview smoke check**

Open `http://127.0.0.1:4319/` and verify that the current lack of runtime `.moc3` keeps the pet on the existing 3D/PNG fallback.

