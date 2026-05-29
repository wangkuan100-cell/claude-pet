import { moodAfterDecay, expressionFor } from '../src/mood.js';
import { thresholdForLevel } from '../src/levels.js';
import { LINES, LINE_IDS } from '../src/lines.js';
import { spritePlaceholder } from './placeholders.js';

const EXPR_EMOJI = { flow: '🤩', happy: '😄', normal: '🙂', sleepy: '😴', bored: '🥱', worried: '😟' };

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

// The image is keyed by line/form; the mood is shown as a small overlay emoji,
// not baked into the sprite — so the key has no expression segment.
export function spriteKey(pet) {
  return pet.species ? `${pet.species}/${pet.stage}` : 'egg';
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
    name: pet.name || (LINES[pet.species]?.name) || pet.species || 'egg',
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
  if (!pet.species) {
    return { mode: 'adopt', lines: LINE_IDS.map((id) => ({ id, emoji: LINES[id].emoji, name: LINES[id].name })) };
  }
  const expr = currentExpression(pet, now);
  const sprite = spritePlaceholder(spriteKey(pet));
  sprite.expr = EXPR_EMOJI[expr] || null;
  let bubble = bubbleFor(status);
  if (!bubble && expr === 'worried') bubble = { kind: 'empathy', emoji: '🫂', text: '别灰心,我陪着你' };
  return { mode: 'pet', sprite, expression: expr, bubble, panel: panelData(pet, status, now) };
}

export function paintEvents(prevPanel, nextPanel) {
  if (!prevPanel || !nextPanel) {
    return {
      leveledUp: false, evolved: false,
      newLevel: nextPanel ? nextPanel.level : null,
      newStage: nextPanel ? nextPanel.stage : null,
      newAchievements: [],
    };
  }
  const prev = new Set(prevPanel.achievements || []);
  return {
    leveledUp: nextPanel.level > prevPanel.level,
    evolved: !!nextPanel.stage && nextPanel.stage !== prevPanel.stage,
    newLevel: nextPanel.level,
    newStage: nextPanel.stage,
    newAchievements: (nextPanel.achievements || []).filter((a) => !prev.has(a)),
  };
}
