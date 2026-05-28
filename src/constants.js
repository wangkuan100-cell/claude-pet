export const SCHEMA_VERSION = 1;

// XP per event (base, before streak multiplier)
export const LINE_XP_PER = 1;
export const LINE_XP_CAP_PER_EVENT = 30;
export const LINE_XP_CAP_PER_SESSION = 200;
export const NEW_FILE_XP = 15;
export const TEST_PASS_XP = 40;
export const TEST_XP_CAP_PER_SESSION = 160;
export const MILESTONE_XP = 300;
export const TOKENS_XP_PER_100K = 5;
export const COMMIT_XP = {
  feat: 120, fix: 60, refactor: 50, perf: 50,
  test: 40, docs: 40, chore: 40, other: 40,
};

// Levels: index i (0-based) => minimum cumulative XP for level i+1
export const LEVEL_THRESHOLDS = [0, 150, 450, 1000, 2200, 4500, 9000];

// Streak
export const STREAK_STEP = 0.05;
export const STREAK_MAX_MULT = 2.0;

// Mood
export const MOOD_INIT = 80;
export const MOOD_FLOOR = 10;
export const MOOD_CEIL = 100;
export const MOOD_DELTA = { feat: 10, milestone: 15, testPass: 6, commit: 2, activity: 2 };
export const MOOD_FAILURE_DELTA = -8;
export const MOOD_DECAY_PER_HOUR = 5;
export const FAILURE_WINDOW_MIN = 30;
export const FAILURE_STREAK_THRESHOLD = 3;

// Status alert thresholds
export const CONTEXT_ALERT_PCT = 80;
export const GIT_DIRTY_ALERT = 15;
export const COMMIT_AGE_ALERT_MIN = 120;
export const REST_ALERT_MIN = 90;

// Context window size used to estimate contextUsedPct from token counts.
export const CONTEXT_WINDOW_TOKENS = Number(process.env.CLAUDE_PET_CONTEXT_WINDOW || 200000);
