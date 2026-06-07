# Live2D-Ready Pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Live2D-ready runtime path so real Cubism pet models can replace the PNG renderer when local model assets exist.

**Architecture:** Discover local Live2D `model3.json` assets in `assets/live2d/<line>/<form>/`, attach model metadata to the existing paint payload, and let the renderer lazily initialize Live2D only when a model is available. Existing PNG/Three.js rendering remains the fallback when no model exists or Live2D libraries fail to load.

**Tech Stack:** Electron renderer, existing `pet.js` renderer bridge, `petlive2d.js`, Live2D Cubism Web-compatible `model3.json` assets.

---

### Task 1: Local Live2D Model Discovery

**Files:**
- Create: `widget/live2d-source.js`
- Test: `test/live2d-source.test.js`

- [ ] Write tests for discovering `assets/live2d/phoenix/legendary/model3.json`.
- [ ] Validate that referenced `.moc3` and texture files exist before returning a model.
- [ ] Return a file URL, motion group names, and physics availability.

### Task 2: Paint Payload Integration

**Files:**
- Modify: `widget/sprite-paint-assets.js`
- Modify: `widget/main.cjs`
- Test: `test/sprite-paint-assets.test.js`

- [ ] Pass `live2dSource` into `attachSpriteAssets`.
- [ ] Attach `sprite.live2d` and set `animationMode: "live2d"` when a valid model exists.
- [ ] Keep `imageSrc` and `poses` as fallback even when Live2D is available.

### Task 3: Renderer Live2D Selection

**Files:**
- Modify: `widget/renderer/pet.js`
- Modify: `widget/renderer/petlive2d.js`
- Test: `test/renderer-pet3d-bridge.test.js`

- [ ] Initialize Live2D lazily from `sprite.live2d.url`.
- [ ] Route mood, cursor focus, feed, hop, wander, and level reactions to Live2D when active.
- [ ] Automatically fall back to Three.js/PNG if Live2D initialization fails.

### Task 4: Handoff Docs and Verification

**Files:**
- Create: `assets/live2d/README.md`
- Modify: `README.md`

- [ ] Document the required Live2D directory structure.
- [ ] Run `npm test`.
- [ ] Verify the local preview still loads when no Live2D models are present.
