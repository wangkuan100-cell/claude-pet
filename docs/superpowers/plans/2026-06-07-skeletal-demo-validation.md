# Skeletal Demo Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated GitHub demo preview that proves true skeletal animation can flap wings and play non-breathing character motion before re-rigging `phoenix/legendary`.

**Architecture:** Store only remote evaluation manifests under `assets/skeletal-demo/spine-celeste/` and `assets/skeletal-demo/spineboy-run/`, pointing to official GitHub raw URLs and license/source metadata. Add a standalone renderer page under `widget/renderer/skeletal-demo.html` that loads both skeletons through Spine Player from CDN for visual validation only. Keep this out of the production pet renderer and keep the current PNG/Three.js fallback unchanged.

**Tech Stack:** Node `node:test`, static HTML preview, Spine official Celestial Circus and Spineboy examples from `EsotericSoftware/spine-runtimes`, Spine Player CDN for temporary evaluation.

**Boundary:** Do not vendor the third-party sample character. This demo is only a motion-quality reference before building the production `phoenix/legendary` rig in DragonBones or LoongBones.

---

### Task 1: Demo Asset Contract Test

**Files:**
- Create: `test/skeletal-demo-assets.test.js`

- [x] **Step 1: Write a failing test**

Assert that `assets/skeletal-demo/spine-celeste/manifest.json` and `assets/skeletal-demo/spineboy-run/manifest.json` exist, point to GitHub sources, keep sample files remote, and include `wings-and-feet` plus `run`.

- [x] **Step 2: Run the test**

Run: `npm test -- test/skeletal-demo-assets.test.js`

Expected before implementation: FAIL because `manifest.json` does not exist.

### Task 2: Remote Evaluation Manifest

**Files:**
- Create: `assets/skeletal-demo/spine-celeste/manifest.json`
- Create: `assets/skeletal-demo/spineboy-run/manifest.json`

- [x] **Step 1: Reference files from GitHub**

Use `raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3/examples/celestial-circus/export/` for wing motion and `raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3/examples/spineboy/export/` for run motion, plus their license URLs.

- [x] **Step 2: Write manifest**

Record source repository, branch, remote file URLs, license boundary, Celeste's known `wings-and-feet`, `eyeblink`, and `swing` animation names, plus Spineboy's `run`, `walk`, `idle`, and `jump` motions.

### Task 3: Standalone Preview Page

**Files:**
- Create: `widget/renderer/skeletal-demo.html`

- [x] **Step 1: Create preview page**

Add a standalone page with two canvas-sized player areas and direct motion controls. Load the skeletons and atlases through the remote URLs in `/assets/skeletal-demo/spine-celeste/manifest.json` and `/assets/skeletal-demo/spineboy-run/manifest.json`.

- [x] **Step 2: Keep production path untouched**

Do not import this page from `index.html`, `pet.js`, `pet3d.js`, or `main.cjs`.

### Task 4: Verification

**Files:**
- Test: `test/skeletal-demo-assets.test.js`

- [x] **Step 1: Run demo asset test**

Run: `npm test -- test/skeletal-demo-assets.test.js`

Expected after implementation: PASS.

- [x] **Step 2: Run full tests**

Run: `npm test`

Expected after implementation: all tests pass.

- [x] **Step 3: Browser preview**

Open `http://127.0.0.1:4319/skeletal-demo.html` and verify that the Spine player creates a canvas and exposes animation controls. If CDN loading is blocked, report that the local assets are ready but the runtime script needs to be vendored or allowed.

Observed after implementation: two Spine canvases were created, both panels reported `ready`, the full-page two-frame screenshot comparison changed by 73,830 bytes, Run/Walk controls switched without browser warnings or errors.
