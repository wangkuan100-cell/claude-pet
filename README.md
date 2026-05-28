# claude-pet

A Claude Code plugin that grows a virtual desktop pet as you code. Hooks observe
your activity (read-only) and write `~/.claude-pet/pet.json` and `status.json`;
an Electron widget reads those and shows a floating pet that levels up, changes
mood, and reminds you about your project.

## Invariant
The engine never modifies your project. It only writes under `~/.claude-pet/`
(override with `CLAUDE_PET_HOME`) and only runs read-only git commands.

## Try it
- `node --test` runs the suite.
- `node bin/pet.js adopt dragon` then `node bin/pet.js status`.

## Desktop widget (M2)
A floating Electron window shows your pet and reacts to coding activity.

- Run it: `npm run widget` (requires the M1 hooks to be writing `~/.claude-pet/`).
- First launch shows an adoption screen; pick a species. The pet then grows, changes
  expression with mood, shows reminder bubbles (context full / uncommitted / take-a-break),
  and a click opens a stats panel (level, XP, mood, project, achievements).
- Art is emoji placeholder for now; real generated art arrives in M4.
- `CLAUDE_PET_HOME` overrides the state dir (useful for a fixture/demo).

## Env
- `CLAUDE_PET_HOME` — state dir (default `~/.claude-pet`).
- `CLAUDE_PET_CONTEXT_WINDOW` — token count used to estimate context % (default 200000).
