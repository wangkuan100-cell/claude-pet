// Batch-generate pose2 frames for all forms where wing/tail/limb movement adds value.
// At runtime the widget cross-fades pose1 (existing form.png) ↔ pose2 (form_pose2.png) every ~0.8s
// so the moving parts (wings flap, tails sway, etc.) read as natural motion.
//
// Each prompt re-describes the SAME character (color/style/feature dictionary kept consistent with
// src/lines.js) but with one or more articulation differences. Forms with no articulated parts
// (eggs, early hatchlings, static blobs) are intentionally skipped — they stay single-frame and
// just use the existing idle/hop CSS.
//
// Usage:  OPENAI_API_KEY=sk-... node art/gen-poses.mjs            (all 12 forms)
//         OPENAI_API_KEY=sk-... node art/gen-poses.mjs phoenix    (one species)
// Output: assets/<line>/<form>_pose2.png

import fs from 'node:fs';
import path from 'node:path';
import { requestImage } from './generate.mjs';
import { STYLE } from './prompts.js';

// Per-species shared character description, then per-form articulation variant.
// pose1 = the existing <form>.png (wings/tails in their "default" position).
// pose2 = the variant described below.
const POSES = {
  phoenix: {
    adolescent: 'a chibi young phoenix with soft orange-red plumage, same gentle smile, head bigger than the body, but the small wings FOLDED CLOSED against the back and the flame mohawk slightly LARGER as if puffed up',
    adult:      'a chibi phoenix mascot, glossy gold-orange feathers, same round happy face, but the small fluffy wings FOLDED DOWN against the body and the flame tail plume slightly tilted to the other side',
    legendary:  'a chibi legendary phoenix king, sparkling golden feathers, same small forehead gem, but the wings FOLDED CLOSED against the body and the fluffy flame halo behind the head DIMMER and tighter',
  },
  dragon: {
    adult:     'a chibi cute dragon mascot, soft green body, same small golden horns, same gentle smile, but the tiny wings FOLDED DOWN against the back and the plump tail curled to the OTHER side',
    legendary: 'a chibi legendary dragon king, bright emerald-green scales, same golden curly horns and tiny floating orb, but the wings FOLDED CLOSED against the back and tail in a different position',
  },
  kitsune: {
    adolescent: 'a chibi mystical fox with three fluffy tails, same forehead gem and sparkling eyes, but the three tails sweeping to the OPPOSITE side from before (mirrored sway)',
    adult:      'a chibi multi-tailed fox with five soft golden tails, same kawaii proportions, but the five floating tails arranged sweeping the OPPOSITE direction (mirrored)',
    legendary:  'a chibi legendary nine-tailed kitsune, nine fluffy golden tails fanning behind it, same red forehead mark, but the nine-tail fan tilted to the OPPOSITE direction (mirrored sweep)',
  },
  cerberus: {
    legendary: 'a chibi legendary three-headed pup king, three round happy puppy heads with tiny gold chains, but the LEFT and RIGHT heads turned slightly OUTWARD (away from center) and the soft mist puffs at the paws SLIGHTLY larger',
  },
  sphinx: {
    adult:     'a chibi baby sphinx, round head round body with tiny gold tiara, but the pair of small spread feathered wings FOLDED CLOSED against the back and one front paw RAISED slightly',
    legendary: 'a chibi legendary sphinx mascot with miniature crown, same plump cute body, but the tiny spread golden wings FOLDED CLOSED against the back and the lifted tail swung to the OTHER side',
  },
  golem: {
    legendary: 'a chibi legendary crystal spirit king with a small crystal crown, soft jade-blue jelly body, but the glowing gem core inside the body MUCH BRIGHTER and slightly larger, and the tiny round arms in a different position',
  },
};

const onlyLine = process.argv[2]; // optional: limit to one species
const lines = onlyLine ? [onlyLine] : Object.keys(POSES);

let total = 0;
for (const line of lines) total += Object.keys(POSES[line] || {}).length;
console.log(`Generating ${total} pose2 frames …`);

let done = 0;
for (const line of lines) {
  for (const [form, art] of Object.entries(POSES[line] || {})) {
    const dir = path.join('assets', line);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `${form}_pose2.png`);
    const png = await requestImage(`${art}. ${STYLE}.`);
    fs.writeFileSync(out, png);
    done += 1;
    console.log(`  [${done}/${total}] ${out}`);
  }
}
console.log('Done.');
