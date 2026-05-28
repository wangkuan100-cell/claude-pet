import { moodAfterDecay, expressionFor } from '../src/mood.js';
import { thresholdForLevel } from '../src/levels.js';
import { SPECIES, spritePlaceholder } from './placeholders.js';

function hoursSince(iso, now) {
  return Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3600000);
}

export function currentMood(pet, now) {
  return moodAfterDecay(pet.mood, hoursSince(pet.lastActivityAt, now));
}

export function recentFailureActive(pet, now) {
  return !!pet.recentFailureUntil && new Date(pet.recentFailureUntil) > now;
}

export function currentExpression(pet, now) {
  return expressionFor({ mood: currentMood(pet, now), recentFailureActive: recentFailureActive(pet, now) });
}

export function spriteKey(pet, now) {
  if (!pet.species) return 'egg';
  return `${pet.species}/${pet.stage}/${currentExpression(pet, now)}`;
}

export function xpProgress(pet) {
  const base = thresholdForLevel(pet.level);
  const next = thresholdForLevel(pet.level + 1);
  const span = next - base;
  const intoLevel = pet.xp - base;
  const pct = span > 0 ? Math.min(100, Math.round((intoLevel / span) * 100)) : 100;
  return { level: pet.level, intoLevel, span, toNext: Math.max(0, next - pet.xp), pct };
}

const ALERT_BUBBLES = {
  context: { emoji: '🥵', text: '我撑住了…该 /compact 啦' },
  git: { emoji: '💾', text: '别忘了提交哦' },
  rest: { emoji: '🍵', text: '歇会儿?' },
};
export const ALERT_PRIORITY = ['context', 'git', 'rest'];

export function bubbleFor(status) {
  if (!status || !Array.isArray(status.alerts)) return null;
  for (const kind of ALERT_PRIORITY) {
    if (status.alerts.includes(kind)) return { kind, ...ALERT_BUBBLES[kind] };
  }
  return null;
}

export function panelData(pet, status, now) {
  const prog = xpProgress(pet);
  return {
    name: pet.name || pet.species || 'egg',
    level: pet.level,
    stage: pet.stage,
    mood: currentMood(pet, now),
    xp: pet.xp,
    xpPct: prog.pct,
    xpToNext: prog.toNext,
    achievements: (pet.achievements || []).map((a) => a.id),
    project: status ? {
      repo: status.repo || status.cwd || null,
      contextPct: status.contextUsedPct ?? null,
      cost: status.sessionCostUsd ?? 0,
      alerts: status.alerts || [],
    } : null,
  };
}

export function buildPaintData(pet, status, now = new Date()) {
  if (!pet.species) return { mode: 'adopt', species: SPECIES };
  const expr = currentExpression(pet, now);
  let bubble = bubbleFor(status);
  if (!bubble && expr === 'worried') bubble = { kind: 'empathy', emoji: '🫂', text: '别灰心,我陪着你' };
  return {
    mode: 'pet',
    sprite: spritePlaceholder(`${pet.species}/${pet.stage}/${expr}`),
    expression: expr,
    bubble,
    panel: panelData(pet, status, now),
  };
}

export function paintEvents(prevPanel, nextPanel) {
  if (!prevPanel || !nextPanel) {
    return { leveledUp: false, newLevel: nextPanel ? nextPanel.level : null, newAchievements: [] };
  }
  const prev = new Set(prevPanel.achievements || []);
  return {
    leveledUp: nextPanel.level > prevPanel.level,
    newLevel: nextPanel.level,
    newAchievements: (nextPanel.achievements || []).filter((a) => !prev.has(a)),
  };
}
