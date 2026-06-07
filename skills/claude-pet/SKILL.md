---
name: claude-pet
description: Use when the user asks about their code-pet / claude-pet — its level, mood, achievements, project status — or wants to rename it, log a milestone, or start/stop the desktop widget.
---

# code-pet / claude-pet

A virtual desktop pet that grows from the user's coding activity in Codex or
Claude Code. State lives in `CODE_PET_HOME`, `CLAUDE_PET_HOME`, an existing
legacy `~/.claude-pet/`, or default `~/.code-pet/` (never in the project). Drive
it via the CLI:

- `node bin/pet.js status` — level, stage, mood, achievements, current project status
- `node bin/pet.js rename <name>`
- `node bin/pet.js milestone "<what shipped>"` — +300 XP and a milestone achievement
- `node bin/pet.js start` / `stop` — show/hide the floating Electron widget
- `node bin/codex-hook.js` — ingest Codex-style JSON activity from stdin

Everyone starts as an egg; it hatches into a RANDOM creature (the user does not
choose) once it grows past level 1. The pet grows from observed activity (lines,
tokens, conventional-commit types, passing tests, milestones); it shows reminder
bubbles for high context usage,
uncommitted changes, and long coding stretches. It is read-only with respect to
the user's project. Codex and Claude Code events are normalized through the same
engine. To regenerate art: `OPENAI_API_KEY=... npm run gen-art`.
