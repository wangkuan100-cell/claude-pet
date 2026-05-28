export const SPECIES = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];

const SPECIES_EMOJI = { cat: '🐱', dog: '🐶', dragon: '🐉', slime: '🟢', bird: '🐦', fox: '🦊' };
const STAGE_SCALE = { egg: 0.7, hatchling: 0.85, child: 1.0, teen: 1.15, adult: 1.3 };
const EXPRESSION_EMOJI = { flow: '🤩', happy: '😄', normal: '🙂', sleepy: '😴', bored: '🥱', worried: '😟' };

export function spritePlaceholder(spriteKey) {
  if (spriteKey === 'egg') return { base: '🥚', scale: 0.7, expr: null };
  const [species, stage, expr] = spriteKey.split('/');
  const scale = STAGE_SCALE[stage] ?? (stage && stage.startsWith('evolved') ? 1.45 : 1.0);
  return {
    base: SPECIES_EMOJI[species] || '🐾',
    scale,
    expr: EXPRESSION_EMOJI[expr] || null,
  };
}

export { SPECIES_EMOJI, EXPRESSION_EMOJI };
