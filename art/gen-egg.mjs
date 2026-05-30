// Generate the single generic pre-hatch egg image. Everyone sees the SAME egg before hatching;
// the species hidden inside is decided randomly at hatch time, so the egg must not hint at any
// specific creature.
import fs from 'node:fs';
import { requestImage } from './generate.mjs';
import { STYLE } from './prompts.js';

const ART =
  'a round speckled pale-cream egg with a cute happy face, big sparkling round eyes, a gentle smile, blushy cheeks, ' +
  'tiny round feet poking out below the shell, soft glossy smooth surface. ' +
  'IMPORTANT: a neutral generic egg — NO flames, NO scales, NO horns, NO wings, NO crystal, NO fox ears, NO paws — ' +
  'it must not hint at any specific creature; just a friendly mystery egg waiting to hatch into something random';

const prompt = `${ART}. ${STYLE}.`;
const png = await requestImage(prompt);
fs.writeFileSync('assets/egg.png', png);
console.log('Generated assets/egg.png');
