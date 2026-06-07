# Phoenix Legendary Live2D Export Checklist

This folder is a source package for Live2D Cubism Editor. It is not a runtime model yet.

Do not create placeholder `.moc3` files. The real `phoenix.moc3` must be exported by Cubism Editor.

## Source Inputs

- Source sprite: `../../../../phoenix/legendary.png`
- Layer source: `layers/`
- Rig map: `rig-map.json`
- Motion spec: `motion-spec.json`

Canonical layers:

- `layers/body-core.png`
- `layers/wing-left.png`
- `layers/wing-right.png`
- `layers/foot-left.png`
- `layers/foot-right.png`
- `layers/flame-halo.png`
- `layers/crest-front.png`

## Cubism Editor Setup

1. Create a new Cubism model with a 256 x 256 source canvas.
2. Import each PNG in `layers/` as its own ArtMesh.
3. Name parts and deformers exactly as listed in `rig-map.json`.
4. Keep `flame-halo` behind the body and wings. Keep `crest-front` above the face.
5. Mesh the wings with enough vertices along the outer feathers so flapping bends through the feather shape instead of rotating the whole image as a flat card.
6. Mesh `body-core` with stable face vertices around eyes, cheeks, and mouth. Body motion must stay subtle.
7. Add parameters from `rig-map.json`: `ParamAngleX`, `ParamAngleY`, `ParamBodyAngleZ`, `ParamBreath`, `ParamWingL`, `ParamWingR`, `ParamFootL`, `ParamFootR`, `ParamFlame`, `ParamCrest`, `ParamEyeOpen`, and `ParamMouthForm`.
8. Add physics for breathing, wing follow-through, crest bounce, and flame pulse. Export it as `phoenix.physics3.json`.

## Motion Groups

Create and export these Cubism motion groups:

- `Idle` -> `motions/idle.motion3.json`
- `Run` -> `motions/run.motion3.json`
- `Fly` -> `motions/fly.motion3.json`
- `Tap` -> `motions/tap.motion3.json`
- `Happy` -> `motions/happy.motion3.json`
- `Worried` -> `motions/worried.motion3.json`

Use `motion-spec.json` for timing and parameter intent.

Looping motions:

- `Idle`
- `Run`
- `Fly`
- `Worried`

One-shot reactions:

- `Tap`
- `Happy`

## Runtime Export Target

After Cubism export, the runtime directory should look like this:

```text
assets/live2d/phoenix/legendary/
├── model3.json
├── phoenix.moc3
├── phoenix.physics3.json
├── textures/
│   └── texture_00.png
├── motions/
│   ├── idle.motion3.json
│   ├── run.motion3.json
│   ├── fly.motion3.json
│   ├── tap.motion3.json
│   ├── happy.motion3.json
│   └── worried.motion3.json
└── _source/
    ├── EXPORT_CHECKLIST.md
    ├── motion-spec.json
    ├── rig-map.json
    └── layers/
```

`model3.json` must reference:

- `Moc`: `phoenix.moc3`
- `Textures`: `["textures/texture_00.png"]`
- `Physics`: `phoenix.physics3.json`
- `Motions.Idle`: `motions/idle.motion3.json`
- `Motions.Run`: `motions/run.motion3.json`
- `Motions.Fly`: `motions/fly.motion3.json`
- `Motions.Tap`: `motions/tap.motion3.json`
- `Motions.Happy`: `motions/happy.motion3.json`
- `Motions.Worried`: `motions/worried.motion3.json`

## Acceptance Check

1. `npm test -- test/live2d-source.test.js test/live2d-phoenix-source-package.test.js` passes.
2. `assets/live2d/phoenix/legendary/model3.json` exists only after a real Cubism export.
3. The widget falls back to PNG/Three.js until the real `model3.json`, `.moc3`, textures, and motions exist.
4. In preview, wings bend from the shoulder, feet alternate on `Run`, flame pulse does not cover the face, and `Worried` reads as concerned instead of broken.

