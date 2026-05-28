#!/usr/bin/env node
import { loadPet, savePet, saveStatus } from '../src/state.js';
import { loadSession, saveSession } from '../src/session.js';
import { applyEvent, buildStatus } from '../src/engine.js';
import { makeGitRunner } from '../src/run-git.js';
import { gitSnapshot, newCommitsSince } from '../src/git.js';
import { classifyCommit } from '../src/commits.js';
import { isTestCommand, isTestSuccess } from '../src/tests-detect.js';
import { parseTranscriptUsage } from '../src/transcript.js';
import fs from 'node:fs';

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function countText(s) {
  return s ? s.split('\n').filter((l) => l.length > 0).length : 0;
}

function countLines(toolInput) {
  // MultiEdit carries an `edits` array; Write has `content`; Edit has `new_string`.
  if (Array.isArray(toolInput?.edits)) {
    return toolInput.edits.reduce((n, e) => n + countText(e.new_string), 0);
  }
  return countText(toolInput?.content ?? toolInput?.new_string);
}

function main() {
  const raw = readStdin();
  let hook;
  try { hook = JSON.parse(raw); } catch { return; } // exit 0
  const now = new Date();
  let pet = loadPet();
  let session = loadSession(hook.session_id);
  const events = [];

  const event = hook.hook_event_name;
  if (event === 'SessionStart') {
    pet.lifetime.sessions += 1;
    session.startedAt = now.toISOString();
  } else if (event === 'PostToolUse') {
    if (['Write', 'Edit', 'MultiEdit'].includes(hook.tool_name)) {
      events.push({ type: 'lines', count: countLines(hook.tool_input) });
    }
    if (hook.tool_name === 'Bash' && isTestCommand(hook.tool_input?.command)) {
      const out = `${hook.tool_response?.stdout || ''}${hook.tool_response?.stderr || ''}`;
      const code = hook.tool_response?.exit_code ?? hook.tool_response?.exitCode ?? null;
      events.push(isTestSuccess(out, code) ? { type: 'testPass' } : { type: 'failure' });
    }
  }

  // Read-only git: detect new commits since last seen, per repo.
  let snapshot = { isRepo: false };
  if (hook.cwd) {
    const runGit = makeGitRunner(hook.cwd);
    try {
      snapshot = gitSnapshot(runGit, now);
      if (snapshot.isRepo) {
        const repoKey = hook.cwd;
        pet.repos[repoKey] = pet.repos[repoKey] || { lastSeenCommit: null };
        const seen = pet.repos[repoKey].lastSeenCommit;
        const fresh = newCommitsSince(runGit, seen);
        if (seen) {
          for (const c of fresh) events.push({ type: 'commit', kind: classifyCommit(c.message) });
        }
        if (fresh[0]) pet.repos[repoKey].lastSeenCommit = fresh[0].hash;
      }
    } catch { /* read-only failure: ignore, exit 0 */ }
  }

  // token usage from transcript
  let usage = { totalTokens: 0, lastContextTokens: 0 };
  if (hook.transcript_path && fs.existsSync(hook.transcript_path)) {
    usage = parseTranscriptUsage(fs.readFileSync(hook.transcript_path, 'utf8'));
  }

  // Apply all derived events.
  let acc = session;
  if (events.length === 0) events.push({ type: 'idle' });
  for (const ev of events) {
    const res = applyEvent(pet, acc, ev, now);
    pet = res.pet;
    acc = { ...acc, ...res.sessionAcc };
  }
  session = acc;

  // Persist.
  savePet(pet);
  saveSession(hook.session_id, session);
  const activeMins = session.startedAt ? (now - new Date(session.startedAt)) / 60000 : 0;
  saveStatus(buildStatus({
    cwd: hook.cwd, repo: snapshot.isRepo ? hook.cwd : null,
    snapshot, usage, costUsd: 0, activeMins,
  }, now));
}

try { main(); } catch { /* never block Claude */ } finally { process.exit(0); }
