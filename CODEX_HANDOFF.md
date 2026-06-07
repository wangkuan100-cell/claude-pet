# Codex Handoff

This is the Codex-editable copy of `code-pet`, rebooted from `claude-pet`.

Original source location:

- `/Users/kuan/Projects/Superpowers`

Codex working copy:

- `/Users/kuan/Documents/Codex/claude-pet`

Runtime state resolution:

- `CODE_PET_HOME` wins when set.
- `CLAUDE_PET_HOME` remains supported for legacy Claude installs.
- Existing `/Users/kuan/.claude-pet/pet.json` keeps the local pet on the old path.
- New installs without legacy state default to `/Users/kuan/.code-pet/`.

Current runtime state:

- `/Users/kuan/.claude-pet/pet.json` stores the current pet state.
- `/Users/kuan/.claude-pet/widget.json` stores the widget window position.
- `/Users/kuan/.claude-pet/widget.pid` stores the last widget PID.
- `/Users/kuan/.claude-pet/widget-debug.log` stores widget interaction logs.

## Current Pet

The current local state reads:

```text
dragon -- Lv 1 (egg), mood 80, xp 0
achievements: none
```

`status.json` is currently absent, so there is no latest project/context alert snapshot.

## Common Commands

Run from this directory:

```sh
npm test
node bin/pet.js status
node bin/pet.js rename <name>
node bin/pet.js milestone "<description>"
node bin/pet.js start
node bin/pet.js stop
node bin/codex-hook.js
```

`node_modules` was intentionally not copied into this working copy. Run `npm install`
only if the Electron widget or dependency-backed local development needs it.

## Project Map

- `src/` contains the pure state engine: XP, levels, mood, achievements, git parsing,
  transcript usage, state I/O, and platform-neutral activity processing helpers.
- `bin/` contains the CLI, Claude hook entrypoint, Codex event entrypoint, widget
  launcher helper, and demos.
- `widget/` contains the Electron main process, renderer, sprite loading, position
  persistence, wander behavior, and paint-data logic.
- `assets/` contains generated pet PNGs. `assets/layers/` contains optional
  2.5D transparent-plane layer sets; currently `dragon/legendary`,
  `phoenix/legendary`, and `kitsune/legendary` have layered art.
- `art/` contains OpenAI image generation scripts and prompts. `art/build-2p5d-layers.py`
  rebuilds the current dragon, phoenix, and kitsune legendary layered prototypes
  (requires Pillow).
- `hooks/`, `commands/`, `skills/`, and `.claude-plugin/` contain the Claude Code
  plugin integration; `bin/codex-hook.js` is the Codex JSON adapter.
- `test/` contains the Node test suite.
- `docs/superpowers/` contains design specs and implementation plans.

## Verification Note

The test suite currently reports 102 passing tests in this environment.

`widget/state-source.js` keeps `fs.watch` for low-latency updates and also runs a
lightweight polling fallback. This avoids the local `EMFILE: too many open files,
watch` behavior seen earlier while keeping the widget responsive.

`widget/sprite-paint-assets.js` attaches both normal pose frames and optional
2.5D layer manifests to the paint payload. The three.js renderer prefers layers
when present and falls back to the pose animation when no manifest exists.

The current 2.5D art sets use a full `base-full` layer plus translucent animated
accent layers. Avoid returning to mutually cut-out body/head/tail layers; those
create visible background holes and white fringe when the planes drift.

## Editing Notes

- Keep project writes out of `/Users/kuan/.claude-pet/` unless intentionally testing
  runtime state changes.
- The hook path is intentionally read-only with respect to user projects; preserve
  that invariant.
- The current branch for Codex work is `codex/claude-pet-workspace`.
