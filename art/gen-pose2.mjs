// Pose 2 for dragon/legendary — same character, wings FOLDED (the first pose has wings spread).
// CSS animation will rapidly swap pose1 ↔ pose2 to make the wings appear to flap.
//
// The trick: describe the WHOLE character (chibi gpt-image-1's strong suit), and only the wing
// position differs between the two poses. Everything else stays consistent.

import fs from 'node:fs';
import { requestImage } from './generate.mjs';
import { STYLE } from './prompts.js';

const ART =
  'a chibi legendary dragon king mascot — same bright emerald-green scales, same golden curly horns ' +
  'on top of the head, same green frilly cheeks, same big sparkling eyes, same gentle smile, plump rounded body, ' +
  'small curled green tail visible beside the body. ' +
  'BUT show the wings FOLDED DOWN tucked against the back ' +
  '(not spread wide) — wings barely peek from behind the shoulders. ' +
  'A tiny glowing orb floats beside it. ' +
  'Big-head-small-body kawaii proportions, front-facing standing pose, centered, ' +
  'matching the same chibi style as before for evolution-line consistency';

const png = await requestImage(`${ART}. ${STYLE}.`);
fs.writeFileSync('assets/dragon/legendary_pose2.png', png);
console.log('Generated assets/dragon/legendary_pose2.png');
