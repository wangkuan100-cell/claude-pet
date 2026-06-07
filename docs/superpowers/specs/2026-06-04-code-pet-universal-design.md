# code-pet Universal Runtime — Design

- Date: 2026-06-04
- Status: implementation-ready
- Working copy: `/Users/kuan/Documents/Codex/claude-pet`

## Goal

Reboot `claude-pet` into a Codex + Claude Code compatible desktop pet without
throwing away the working pet engine, Electron widget, or generated art.

The v1 universal runtime keeps the current growth loop and visual identity, but
removes Claude-only assumptions from the state path, event ingestion, package
metadata, and user-facing docs.

## Local Game Studio Adaptation

This follows the local Claude Code Game Studio pattern used in the Cloud Kingdom
reboot: keep the original Claude-style production discipline, but implement it in
Codex as ordinary project docs, focused data modules, tests, and browser/widget
verification.

Studio responsibilities:

- Game Director: one desktop companion that grows from meaningful coding
  activity in either Codex or Claude Code.
- Gameplay Lead: preserve the current XP loop: edits, new files, tests, commits,
  milestones, streaks, mood, and achievements.
- Systems Designer: make platform adapters normalize activity into the same
  engine events, so platform choice does not change pet balance.
- Art Director: reuse the existing chibi PNG and Electron renderer for v1.
- QA Lead: protect the zero-project-side-effect invariant and add tests for both
  Claude and Codex event sources.

## Product Shape

The project becomes `code-pet`: a local desktop coding companion for agentic
coding tools.

Backward compatibility remains:

- Existing `~/.claude-pet` state continues to load.
- `CLAUDE_PET_HOME` remains supported.
- Claude Code plugin files remain usable.
- Current CLI commands keep working.

Universal behavior is added:

- `CODE_PET_HOME` is the preferred state directory override.
- Default state directory becomes `~/.code-pet` only when no legacy
  `~/.claude-pet/pet.json` exists.
- `status.json` records `provider`, currently `claude`, `codex`, or `manual`.
- Codex can drive the same engine through a CLI JSON event adapter.

## Architecture

```
Claude Code hooks          Codex event CLI          Manual CLI
      |                         |                       |
      v                         v                       v
  platform adapter ------> normalized activity events ----> engine
                                      |
                                      v
                         pet.json + status.json
                                      |
                                      v
                           Electron desktop pet
```

Core boundaries:

- `src/state.js`: resolves the universal state directory and reads/writes JSON.
- `src/activity.js`: normalizes Claude/Codex/manual payloads into engine events,
  git snapshots, transcript usage, and status input.
- `bin/hook.js`: Claude-compatible hook entry that delegates to `activity.js`.
- `bin/codex-hook.js`: Codex-compatible stdin JSON entry that delegates to the
  same activity path.
- `bin/pet.js`: manual CLI for status, rename, milestone, start, and stop.
- `widget/`: remains provider-agnostic and only reads state.

## Codex Event Contract

Codex events are newline/stdin JSON objects shaped for local adapters, not tied
to a private Codex API:

```json
{
  "provider": "codex",
  "event": "PostToolUse",
  "session_id": "codex-session",
  "cwd": "/path/to/project",
  "tool_name": "Edit",
  "tool_input": { "new_string": "a\nb\n" },
  "tool_response": {},
  "transcript_path": "/optional/transcript.jsonl"
}
```

The adapter also accepts a nested tool shape:

```json
{
  "provider": "codex",
  "event": "tool_result",
  "sessionId": "codex-session",
  "cwd": "/path/to/project",
  "tool": { "name": "Write", "input": { "content": "x\n" } },
  "result": { "type": "create" }
}
```

Supported normalized event names:

- `SessionStart`
- `PostToolUse`
- `Stop`

Supported tool names mirror Claude where possible:

- `Edit`
- `Write`
- `MultiEdit`
- `Bash`

Unknown events become idle updates and must never block the host tool.

## Zero Side Effects

The reboot keeps the original hard invariant:

- Never write into the user project `cwd`.
- Never run mutating git commands.
- Only write pet runtime state under the resolved pet home directory.
- Hook/adapter entrypoints swallow unexpected errors and exit successfully.

## Verification

Required automated checks:

- State directory resolution prefers `CODE_PET_HOME`, then `CLAUDE_PET_HOME`,
  then existing legacy `~/.claude-pet`, then `~/.code-pet`.
- Claude hook payloads still update pet state.
- Codex payloads update the same pet state and write `status.provider = "codex"`.
- Manual status still works.
- Existing no-side-effects tests still pass.

Local watcher requirement:

- `fs.watch` may emit `EMFILE` in this environment. The widget state watcher
  must keep a polling fallback so file updates still repaint reliably and tests
  remain deterministic.
