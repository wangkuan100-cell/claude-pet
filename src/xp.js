import {
  LINE_XP_PER, LINE_XP_CAP_PER_EVENT, NEW_FILE_XP, TEST_PASS_XP,
  MILESTONE_XP, TOKENS_XP_PER_100K, COMMIT_XP, STREAK_STEP, STREAK_MAX_MULT,
} from './constants.js';

export function xpForEvent(event) {
  switch (event.type) {
    case 'lines':
      return Math.min((event.count || 0) * LINE_XP_PER, LINE_XP_CAP_PER_EVENT);
    case 'newFile': return NEW_FILE_XP;
    case 'testPass': return TEST_PASS_XP;
    case 'milestone': return MILESTONE_XP;
    case 'commit': return COMMIT_XP[event.kind] ?? COMMIT_XP.other;
    case 'tokens': return Math.floor((event.tokens || 0) / 100000) * TOKENS_XP_PER_100K;
    default: return 0;
  }
}

export function applyStreakMultiplier(baseXp, streakDays) {
  const days = Math.max(1, streakDays || 1);
  const mult = Math.min(1 + STREAK_STEP * (days - 1), STREAK_MAX_MULT);
  return Math.round(baseXp * mult);
}
