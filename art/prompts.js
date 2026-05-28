export const STYLE = 'cute chibi kawaii mascot, flat vector with bold clean outlines, vibrant colors, centered single character, plain transparent background, no text, no shadow';

const SPECIES_DESC = { cat: 'a round fluffy cat', dog: 'a happy puppy', dragon: 'a friendly baby dragon', slime: 'a glossy green slime blob with eyes', bird: 'a tiny round bird', fox: 'a small orange fox' };
const STAGE_DESC = { egg: 'as a speckled egg', hatchling: 'as a tiny just-hatched baby', child: 'as a small child form', teen: 'as an energetic teen form', adult: 'as a majestic grown-up form' };
const EXPR_DESC = { flow: 'thrilled, sparkling star-eyes', happy: 'smiling cheerfully', normal: 'calm and neutral', sleepy: 'drowsy with half-closed eyes', bored: 'unamused and bored', worried: 'worried but hopeful' };

export const SPECIES = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];
export const STAGES = ['egg', 'hatchling', 'child', 'teen', 'adult'];
export const EXPRESSIONS = ['flow', 'happy', 'normal', 'sleepy', 'bored', 'worried'];

export function promptFor(species, stage, expr) {
  return `${SPECIES_DESC[species] || species} ${STAGE_DESC[stage] || stage}, ${EXPR_DESC[expr] || expr}. ${STYLE}.`;
}

export function spriteMatrix(speciesList = SPECIES) {
  const out = [];
  for (const species of speciesList) {
    for (const stage of STAGES) {
      for (const expr of EXPRESSIONS) {
        out.push({ species, stage, expr, key: `${species}/${stage}/${expr}` });
      }
    }
  }
  return out;
}

export function outputPath(assetsDir, item) {
  return `${assetsDir}/${item.species}/${item.stage}/${item.expr}.png`;
}
