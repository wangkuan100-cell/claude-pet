import { MOOD_DELTA, MOOD_FAILURE_DELTA, MOOD_DECAY_PER_HOUR, MOOD_FLOOR, MOOD_CEIL } from './constants.js';

const clamp = (v) => Math.max(MOOD_FLOOR, Math.min(MOOD_CEIL, v));

export function moodAfterEvent(mood, eventType) {
  return clamp(mood + (MOOD_DELTA[eventType] || 0));
}

export function moodAfterFailure(mood) {
  return clamp(mood + MOOD_FAILURE_DELTA);
}

export function moodAfterDecay(mood, hoursIdle) {
  return clamp(Math.round(mood - MOOD_DECAY_PER_HOUR * (hoursIdle || 0)));
}

export function expressionFor({ mood, recentFailureActive }) {
  if (recentFailureActive) return 'worried';
  if (mood >= 80) return 'flow';
  if (mood >= 60) return 'happy';
  if (mood >= 35) return 'normal';
  if (mood >= 15) return 'sleepy';
  return 'bored';
}
