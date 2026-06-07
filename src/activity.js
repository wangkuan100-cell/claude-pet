import fs from 'node:fs';
import { loadPet, savePet, saveStatus } from './state.js';
import { loadSession, saveSession } from './session.js';
import { applyEvent, buildStatus } from './engine.js';
import { makeGitRunner } from './run-git.js';
import { gitSnapshot, newCommitsSince } from './git.js';
import { classifyCommit } from './commits.js';
import { isTestCommand, isTestSuccess } from './tests-detect.js';
import { parseTranscriptUsage } from './transcript.js';

function countText(s) {
  return s ? String(s).split('\n').filter((l) => l.length > 0).length : 0;
}

function countLines(toolInput) {
  if (Array.isArray(toolInput?.edits)) {
    return toolInput.edits.reduce((n, e) => n + countText(e.new_string), 0);
  }
  return countText(toolInput?.content ?? toolInput?.new_string);
}

function normalizeEventName(raw, toolName) {
  const event = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
  if (event === 'sessionstart') return 'SessionStart';
  if (event === 'posttooluse' || event === 'toolresult' || event === 'tooluse') return 'PostToolUse';
  if (event === 'stop' || event === 'sessionend') return 'Stop';
  return toolName ? 'PostToolUse' : 'Stop';
}

export function normalizeActivityPayload(payload, defaultProvider = 'claude') {
  const tool = payload?.tool || {};
  const toolName = payload?.tool_name ?? payload?.toolName ?? tool.name ?? null;
  const toolInput = payload?.tool_input ?? payload?.toolInput ?? tool.input ?? payload?.input ?? {};
  const toolResponse = payload?.tool_response ?? payload?.toolResponse ?? payload?.result ?? tool.result ?? {};
  const provider = String(payload?.provider || defaultProvider || 'manual').toLowerCase();
  return {
    provider,
    event: normalizeEventName(payload?.hook_event_name ?? payload?.event ?? payload?.type, toolName),
    sessionId: payload?.session_id ?? payload?.sessionId ?? 'unknown',
    cwd: payload?.cwd ?? null,
    toolName,
    toolInput,
    toolResponse,
    transcriptPath: payload?.transcript_path ?? payload?.transcriptPath ?? null,
  };
}

function eventsForActivity(activity, pet, session, now) {
  const events = [];
  if (activity.event === 'SessionStart') {
    pet.lifetime.sessions += 1;
    session.startedAt = now.toISOString();
  } else if (activity.event === 'PostToolUse') {
    if (['Write', 'Edit', 'MultiEdit'].includes(activity.toolName)) {
      events.push({ type: 'lines', count: countLines(activity.toolInput) });
    }
    if (activity.toolName === 'Write' && activity.toolResponse?.type === 'create') {
      events.push({ type: 'newFile' });
    }
    if (activity.toolName === 'Bash' && isTestCommand(activity.toolInput?.command)) {
      const out = `${activity.toolResponse?.stdout || ''}${activity.toolResponse?.stderr || ''}`;
      const code = activity.toolResponse?.exit_code ?? activity.toolResponse?.exitCode ?? null;
      events.push(isTestSuccess(out, code) ? { type: 'testPass' } : { type: 'failure' });
    }
  }
  return events;
}

function readOnlySnapshot(activity, pet, now) {
  let snapshot = { isRepo: false };
  if (!activity.cwd) return snapshot;
  const runGit = makeGitRunner(activity.cwd);
  try {
    snapshot = gitSnapshot(runGit, now);
    if (snapshot.isRepo) {
      const repoKey = activity.cwd;
      pet.repos[repoKey] = pet.repos[repoKey] || { lastSeenCommit: null };
      const seen = pet.repos[repoKey].lastSeenCommit;
      const fresh = newCommitsSince(runGit, seen);
      if (seen) {
        snapshot.freshEvents = fresh.map((c) => ({ type: 'commit', kind: classifyCommit(c.message) }));
      }
      if (fresh[0]) pet.repos[repoKey].lastSeenCommit = fresh[0].hash;
    }
  } catch {
    snapshot = { isRepo: false };
  }
  return snapshot;
}

function readUsage(activity) {
  if (activity.transcriptPath && fs.existsSync(activity.transcriptPath)) {
    return parseTranscriptUsage(fs.readFileSync(activity.transcriptPath, 'utf8'));
  }
  return { totalTokens: 0, lastContextTokens: 0 };
}

export function processActivityPayload(payload, options = {}) {
  const activity = normalizeActivityPayload(payload, options.defaultProvider);
  const now = options.now || new Date();
  let pet = loadPet();
  let session = loadSession(activity.sessionId);

  const snapshot = readOnlySnapshot(activity, pet, now);
  const events = [
    ...eventsForActivity(activity, pet, session, now),
    ...(snapshot.freshEvents || []),
  ];

  let acc = session;
  const applied = events.length ? events : [{ type: 'idle' }];
  for (const ev of applied) {
    const res = applyEvent(pet, acc, ev, now);
    pet = res.pet;
    acc = { ...acc, ...res.sessionAcc };
  }
  session = acc;

  savePet(pet);
  saveSession(activity.sessionId, session);
  const activeMins = session.startedAt ? (now - new Date(session.startedAt)) / 60000 : 0;
  const usage = readUsage(activity);
  saveStatus(buildStatus({
    provider: activity.provider,
    cwd: activity.cwd,
    repo: snapshot.isRepo ? activity.cwd : null,
    snapshot,
    usage,
    costUsd: 0,
    activeMins,
  }, now));

  return { activity, pet, session, statusProvider: activity.provider };
}
