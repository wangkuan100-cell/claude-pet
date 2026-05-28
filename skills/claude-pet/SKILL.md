---
name: claude-pet
description: Use when the user asks about their claude-pet — its level, mood, achievements, project status — or wants to adopt/rename it, log a milestone, or start/stop the desktop widget.
---

# claude-pet

A virtual desktop pet that grows from the user's coding activity. State lives in
`~/.claude-pet/` (never in the project). Drive it via the CLI:

- `node bin/pet.js status` — level, stage, mood, achievements, current project status
- `node bin/pet.js adopt <cat|dog|dragon|slime|bird|fox>` — first-time adoption
- `node bin/pet.js rename <name>`
- `node bin/pet.js milestone "<what shipped>"` — +300 XP and a milestone achievement
- `node bin/pet.js start` / `stop` — show/hide the floating Electron widget

The pet grows from observed activity (lines, tokens, conventional-commit types,
passing tests, milestones); it shows reminder bubbles for high context usage,
uncommitted changes, and long coding stretches. It is read-only with respect to
the user's project. To regenerate art: `OPENAI_API_KEY=... npm run gen-art`.
