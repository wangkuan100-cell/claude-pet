# claude-pet (M1: state engine)

A Claude Code plugin that grows a virtual pet as you code. M1 is the read-only
state engine: hooks observe activity and write `~/.claude-pet/pet.json` and
`status.json`. The desktop widget arrives in M2.

## Invariant
The engine never modifies your project. It only writes under `~/.claude-pet/`
(override with `CLAUDE_PET_HOME`) and only runs read-only git commands.

## Try it
- `node --test` runs the suite.
- `node bin/pet.js adopt dragon` then `node bin/pet.js status`.

## Env
- `CLAUDE_PET_HOME` — state dir (default `~/.claude-pet`).
- `CLAUDE_PET_CONTEXT_WINDOW` — token count used to estimate context % (default 200000).
