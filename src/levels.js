import { LEVEL_THRESHOLDS } from './constants.js';

export function thresholdForLevel(level) {
  // level is 1-based. Use table where available, else double the last entry.
  if (level <= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[level - 1];
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return last * Math.pow(2, level - LEVEL_THRESHOLDS.length);
}

export function levelForXp(xp) {
  let level = 1;
  while (xp >= thresholdForLevel(level + 1)) level++;
  return level;
}

export function stageForLevel(level) {
  const forms = { 1: 'egg', 2: 'hatchling', 3: 'juvenile', 4: 'adolescent', 5: 'adult' };
  return forms[level] || 'legendary';
}
