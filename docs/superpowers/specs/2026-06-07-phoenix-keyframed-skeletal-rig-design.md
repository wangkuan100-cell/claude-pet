# Phoenix Legendary Keyframed Skeletal Rig Design

## Goal

Make `phoenix/legendary` move closer to the lower Spineboy run demo: a pet-like keyframed gait with real leg alternation, body weight transfer, wing counterbalance, and expressive secondary motion. This replaces the current "split parts and wiggle them" feel for phoenix legendary without shipping third-party Spine assets.

## Success Criteria

- `run` reads as a looped gait, not idle breathing.
- Left and right feet alternate contact and lift phases.
- Body center of mass bobs and pitches in sync with foot contact.
- Wings react to the run as balance surfaces and can also play a stronger flap loop.
- Crest and flame halo lag slightly behind body motion.
- The existing PNG fallback and Live2D-ready path keep working.
- The demo remains compatible with a future DragonBones or LoongBones export workflow.

## Selected Approach

Use an in-repo keyframed skeletal rig format first, then map it to DragonBones or LoongBones once the motion standard is proven.

I considered three routes:

1. **Direct DragonBones runtime now**
   - Best long-term standard.
   - Higher setup risk because the current assets are PNG layers, not a complete DragonBones armature export.

2. **Spritesheet run strip**
   - Very natural when generated well.
   - Harder to preserve the exact phoenix identity frame-to-frame, and less flexible for idle, tap, mood, and future forms.

3. **Local keyframed rig first**
   - Best next step.
   - Uses the existing phoenix layers, establishes real gait timing, and keeps the data close to DragonBones concepts: bones, slots, pivots, keyframes, easing, and named animations.

The selected route is option 3.

## Rig Data Model

Create `assets/rigs/phoenix/legendary/rig.json`.

Top-level fields:

- `id`: `phoenix/legendary`
- `version`: rig schema version, initially `1`
- `sourceLayers`: points to `assets/layers/phoenix/legendary/manifest.json`
- `canvas`: source coordinate system, using the current 256 by 256 layer canvas
- `bones`: named transform hierarchy
- `slots`: image layer bindings to bones
- `animations`: named keyframed clips

Bone hierarchy:

- `root`
- `body`
- `head`
- `crest`
- `wingLeft`
- `wingRight`
- `footLeft`
- `footRight`
- `flameHalo`

Slots bind the current PNG pieces:

- `body-core.png` on `body`
- `crest-front.png` on `crest`
- `wing-left.png` on `wingLeft`
- `wing-right.png` on `wingRight`
- `foot-left.png` on `footLeft`
- `foot-right.png` on `footRight`
- `flame-halo.png` on `flameHalo`

Each bone has a rest pose:

- `parent`
- `pivot`
- `x`, `y`
- `rotation`
- `scaleX`, `scaleY`
- `z`

Each keyframe stores:

- `time`
- `x`, `y`
- `rotation`
- `scaleX`, `scaleY`
- `ease`

## Motion Design

### Run

`run` is a 720 ms loop with 8 timing beats.

Beat intent:

- `0.000`: left foot contact, right foot passing back, body low
- `0.125`: body rises, left foot pushes, wings counter-rotate
- `0.250`: right foot swing forward, body highest
- `0.375`: right foot prepares contact, head lags
- `0.500`: right foot contact, left foot passing back, body low
- `0.625`: body rises, right foot pushes, wings counter-rotate
- `0.750`: left foot swing forward, body highest
- `0.875`: left foot prepares contact, head lags

The feet use x/y translation plus rotation so the motion reads as planted and lifted, not a pendulum.

Body motion:

- y bob: low on contact, high during passing phase
- rotation: small forward pitch at contact, slight recovery at airborne/passing

Wing motion:

- wings open slightly during body low points
- wings tuck and rotate during push-off
- left and right use mirrored rotations

Secondary motion:

- crest follows head with small delay
- flame halo follows body with slower y bob and opacity pulse

### Idle

`idle` is a calm 1800 ms loop:

- small breathing bob on body
- slow wing settling
- subtle crest and halo drift
- feet stay planted

### Flap

`flap` is a 560 ms loop:

- stronger wing arcs than `run`
- body lifts on downstroke
- feet compress slightly on landing

### Tap

`tap` is a 500 ms one-shot:

- head/crest perk forward
- wings open slightly
- halo brightens

## Renderer Integration

Add a rig runtime beside the current layer renderer instead of replacing everything at once.

Recommended files:

- `widget/renderer/petrig.js`
  - load rig JSON
  - evaluate animation time
  - interpolate keyframes
  - produce per-layer transforms

- `widget/renderer/pet3d.js`
  - when `sprite.rig` exists, use `petrig.js` transforms for layer groups
  - keep existing layer motion as fallback

- `widget/sprite-paint-assets.js`
  - attach rig metadata for `phoenix/legendary` when `assets/rigs/phoenix/legendary/rig.json` exists

- `test/pet-rig-runtime.test.js`
  - verify keyframe interpolation, looping, and one-shot clip behavior

- `test/phoenix-keyframed-rig.test.js`
  - verify the rig has required bones, slots, and `idle/run/flap/tap`

## Data Flow

1. State chooses `phoenix/legendary`.
2. `sprite-paint-assets.js` attaches PNG layers as it already does.
3. If a rig file exists, it also attaches `sprite.rig`.
4. `pet.js` passes `rig` into `Pet3D.show`.
5. `pet3d.js` asks `petrig.js` for current transforms each frame.
6. The existing Three layer groups receive those transforms.
7. If rig loading fails, the current layer animation or full PNG fallback still renders.

## Error Handling

- Missing rig file: ignore and use current layer path.
- Missing bone or slot: fail validation in tests; at runtime skip the bad slot and log once.
- Unknown animation: fall back to `idle`.
- Bad keyframe values: clamp to rest pose defaults.
- Remote or third-party assets: not used for production phoenix rig.

## Testing

Unit tests:

- rig schema has required bones and slots
- every slot references an existing phoenix layer PNG
- `run` has alternating foot contact metadata
- interpolation returns exact endpoints at keyframe times
- looping clips wrap time correctly
- one-shot clips clamp at their end

Browser validation:

- preview `phoenix/legendary` in the existing local widget page
- trigger walk/run state
- compare two screenshots during `run` to confirm motion changes
- visually compare against the lower Spineboy demo for gait readability

## Implementation Order

1. Add rig metadata and tests.
2. Add keyframe evaluator.
3. Attach rig metadata to phoenix legendary sprite data.
4. Wire rig transforms into the current Three layer renderer.
5. Tune `run`, then `idle`, then `flap`, then `tap`.
6. Browser-verify the phoenix result against the Spineboy run reference.

## Out Of Scope

- Shipping Spine runtime or Spine sample assets in production.
- Building a full DragonBones editor/export tool in this pass.
- Re-rigging every species before phoenix legendary is proven.
- Generating a new visual identity for phoenix.

