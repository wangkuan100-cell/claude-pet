import { LINES, LINE_IDS, FORMS } from '../src/lines.js';

const FORM_SCALE = { egg: 0.7, hatchling: 0.8, juvenile: 0.95, adolescent: 1.1, adult: 1.25, legendary: 1.4 };

export function spritePlaceholder(spriteKey) {
  if (!spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) {
    return { base: '🥚', scale: 0.7, expr: null };
  }
  const [line, form] = spriteKey.split('/');
  const base = LINES[line]?.forms?.[form]?.emoji || '🐾';
  return { base, scale: FORM_SCALE[form] || 1.0, expr: null };
}

export { LINE_IDS, FORMS };
