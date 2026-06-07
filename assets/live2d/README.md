# Live2D Assets

Put exported Cubism 3/4 pet models here. The widget discovers models by sprite key:

```text
assets/live2d/<line>/<form>/model3.json
```

For the first Phoenix prototype:

```text
assets/live2d/phoenix/legendary/
├── _source/
│   ├── rig-map.json
│   ├── motion-spec.json
│   ├── EXPORT_CHECKLIST.md
│   └── layers/
├── model3.json
├── phoenix.moc3
├── phoenix.physics3.json
├── textures/
│   └── texture_00.png
└── motions/
    ├── idle.motion3.json
    ├── run.motion3.json
    ├── fly.motion3.json
    ├── tap.motion3.json
    ├── happy.motion3.json
    └── worried.motion3.json
```

The current renderer checks that `model3.json`, its `Moc`, and all listed `Textures` exist before enabling Live2D. If anything is missing, the pet falls back to the existing PNG/Three.js renderer.

Recommended motion group names:

- `Idle` for breathing, blinking, and quiet pet-like presence
- `Run` for ground movement and tiny alternating foot steps
- `Fly` for real wing beats, flow state, and evolve moments
- `Tap` for double-click feeding and short pet reactions
- `Happy` for successful work, achievements, or level-up reactions
- `Worried` for test failures or worried moods

`_source/` is the Cubism Editor handoff package. It is not a runtime model. A real `model3.json` and `.moc3` should appear only after exporting from Live2D Cubism Editor.

Runtime note: Cubism Core is proprietary and is not stored in this repository. `widget/renderer/petlive2d.js` can load Cubism Web runtime scripts from `window.__LIVE2D_LIBS__` or from its default URLs. For offline shipping, vendor the allowed runtime files separately and point `window.__LIVE2D_LIBS__` at those local paths.
