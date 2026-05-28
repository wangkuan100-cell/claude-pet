import { xpForEvent, applyStreakMultiplier } from './xp.js';
import { levelForXp, stageForLevel } from './levels.js';
import { moodAfterEvent, moodAfterFailure, moodAfterDecay } from './mood.js';
import { unlockAchievements } from './achievements.js';
import {
  LINE_XP_CAP_PER_SESSION, TEST_XP_CAP_PER_SESSION, FAILURE_WINDOW_MIN, FAILURE_STREAK_THRESHOLD,
  CONTEXT_WINDOW_TOKENS, CONTEXT_ALERT_PCT, GIT_DIRTY_ALERT, COMMIT_AGE_ALERT_MIN, REST_ALERT_MIN,
} from './constants.js';

const MOOD_EVENT = { commit: 'commit', feat: 'feat', milestone: 'milestone', testPass: 'testPass', lines: 'activity', newFile: 'activity' };

function hoursBetween(aIso, bDate) {
  return Math.max(0, (bDate.getTime() - new Date(aIso).getTime()) / 3600000);
}

export function updateStreak(streak, now) {
  const today = now.toISOString().slice(0, 10);
  if (streak.lastActiveDate === today) return { ...streak };
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const days = streak.lastActiveDate === yesterday ? streak.days + 1 : 1;
  return { days, lastActiveDate: today };
}

export function applyEvent(pet, sessionAcc, event, now = new Date()) {
  const next = structuredClone(pet);
  const acc = { ...sessionAcc };
  const nowIso = now.toISOString();

  // Always decay mood for idle time elapsed since last activity, then apply event.
  next.mood = moodAfterDecay(next.mood, hoursBetween(next.lastActivityAt, now));

  if (event.type === 'idle') {
    return { pet: next, sessionAcc: acc, unlocked: [] };
  }

  // Streak + activity timestamp on any real activity.
  next.streak = updateStreak(next.streak, now);
  next.lastActivityAt = nowIso;

  // XP (with per-session caps for grindable sources), scaled by streak.
  let base = xpForEvent(event);
  if (event.type === 'lines') {
    const room = Math.max(0, LINE_XP_CAP_PER_SESSION - acc.linesXp);
    base = Math.min(base, room);
    acc.linesXp += base;
  } else if (event.type === 'testPass') {
    const room = Math.max(0, TEST_XP_CAP_PER_SESSION - acc.testXp);
    base = Math.min(base, room);
    acc.testXp += base;
  }
  next.xp += applyStreakMultiplier(base, next.streak.days);

  // Lifetime counters.
  if (event.type === 'lines') next.lifetime.linesAdded += event.count || 0;
  if (event.type === 'tokens') next.lifetime.tokens += event.tokens || 0;
  if (event.type === 'testPass') next.lifetime.testsPassed += 1;
  if (event.type === 'milestone') next.lifetime.releases += 1;
  if (event.type === 'commit') {
    next.lifetime.commits += 1;
    if (event.kind === 'feat') next.lifetime.features += 1;
  }

  // Mood. Per spec §8, drop mood (and show worried) only after >=3 consecutive
  // test failures in a session — a lone failure is the normal TDD red phase.
  if (event.type === 'failure') {
    acc.failures = (acc.failures || 0) + 1;
    if (acc.failures >= FAILURE_STREAK_THRESHOLD) {
      next.mood = moodAfterFailure(next.mood);
      next.recentFailureUntil = new Date(now.getTime() + FAILURE_WINDOW_MIN * 60000).toISOString();
    }
  } else {
    if (event.type === 'testPass') acc.failures = 0;
    const moodKey = event.type === 'commit' && event.kind === 'feat' ? 'feat' : MOOD_EVENT[event.type];
    if (moodKey) next.mood = moodAfterEvent(next.mood, moodKey);
  }

  // Level + stage.
  next.level = levelForXp(next.xp);
  next.stage = next.species === null && next.level < 2 ? 'egg' : stageForLevel(next.level);

  // Achievements.
  const unlocked = unlockAchievements(next);
  for (const id of unlocked) next.achievements.push({ id, at: nowIso });

  return { pet: next, sessionAcc: acc, unlocked };
}

export function buildStatus({ cwd, repo, snapshot, usage, costUsd, activeMins }, now = new Date()) {
  const contextUsedPct = Math.round((100 * (usage?.lastContextTokens || 0)) / CONTEXT_WINDOW_TOKENS);
  const alerts = [];
  if (contextUsedPct > CONTEXT_ALERT_PCT) alerts.push('context');
  if ((snapshot?.dirtyCount || 0) > GIT_DIRTY_ALERT || (snapshot?.minsSinceLastCommit || 0) > COMMIT_AGE_ALERT_MIN) alerts.push('git');
  if ((activeMins || 0) > REST_ALERT_MIN) alerts.push('rest');
  return {
    schemaVersion: 1,
    cwd,
    repo: repo || null,
    branch: snapshot?.branch || null,
    contextUsedPct,
    sessionCostUsd: costUsd || 0,
    sessionTokens: usage?.totalTokens || 0,
    gitDirtyCount: snapshot?.dirtyCount ?? null,
    minsSinceLastCommit: snapshot?.minsSinceLastCommit ?? null,
    alerts,
    updatedAt: now.toISOString(),
  };
}
