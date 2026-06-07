// Batch-generate pose3 + pose4 frames for all forms that already have pose2.
// At runtime the widget plays a ping-pong cycle through all available poses
// (0 → 1 → 2 → 3 → 2 → 1 → 0 → ...) so wings flap, tails sway, gems pulse with 4 keyframes
// instead of just 2.
//
// Same prompt strategy as art/gen-poses.mjs — re-describe the SAME character (color, gear,
// proportions kept from src/lines.js) with one articulation difference. pose3 and pose4 are
// intermediate motion phases between pose1 (existing form.png) and pose2 (existing form_pose2.png),
// chosen so a ping-pong cycle reads as continuous motion.
//
// Usage:  OPENAI_API_KEY=sk-... node art/gen-poses-extra.mjs            (all 24 frames)
//         OPENAI_API_KEY=sk-... node art/gen-poses-extra.mjs phoenix    (one species)
// Output: assets/<line>/<form>_pose3.png + assets/<line>/<form>_pose4.png
// Skips files that already exist (safe to resume after a billing-cap hit).

import fs from 'node:fs';
import path from 'node:path';
import { requestImage } from './generate.mjs';
import { STYLE } from './prompts.js';

// Per-species, per-form intermediate motion phases. pose3 = "mid-stroke" reading; pose4 = a
// distinct alternate position so the 4-frame ping-pong has visible variety. Each prompt
// explicitly references the SAME character identity to keep the model from drifting.
const POSES = {
  phoenix: {
    adolescent: {
      pose3: 'a chibi young phoenix with soft orange-red plumage, same gentle smile, head bigger than the body, but the small wings HALF-RAISED upward as if mid-flap, the flame mohawk leaning slightly to one side. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi young phoenix with soft orange-red plumage, same gentle smile, head bigger than the body, but the small wings PUSHED FORWARD in front of the body (mid-flap downstroke), the flame mohawk straight up. Same character identity, same color palette, same kawaii proportions',
    },
    adult: {
      pose3: 'a chibi phoenix mascot, glossy gold-orange feathers, same round happy face, but the small fluffy wings RAISED HIGH ABOVE the head with feather tips spread, the flame tail plume swept straight back. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi phoenix mascot, glossy gold-orange feathers, same round happy face, but the small fluffy wings SPREAD FORWARD in front of the body (mid-downstroke), the flame tail plume curling gently. Same character identity, same color palette, same kawaii proportions',
    },
    legendary: {
      pose3: 'a chibi legendary phoenix king, sparkling golden feathers, same small forehead gem, but the wings RAISED HIGH ABOVE the head with tiny sparkles falling, the fluffy flame halo behind the head MEDIUM brightness with curled tips. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi legendary phoenix king, sparkling golden feathers, same small forehead gem, but the wings SPREAD FORWARD in front of the body (mid-downstroke), the fluffy flame halo behind the head LARGE and dramatic with extra glow. Same character identity, same color palette, same kawaii proportions',
    },
  },
  dragon: {
    adult: {
      pose3: 'a chibi cute dragon mascot, soft green body, same small golden horns, same gentle smile, but the tiny wings HALF-RAISED upward (mid-flap), the plump tail straight behind. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi cute dragon mascot, soft green body, same small golden horns, but the tiny wings FORWARD-EXTENDED in front of the chest, the mouth slightly open in a happy gasp, the plump tail curled gently. Same character identity, same color palette, same kawaii proportions',
    },
    legendary: {
      pose3: 'a chibi legendary dragon king, bright emerald-green scales, same golden curly horns, but the wings HALF-RAISED and the tiny floating orb hovering directly IN FRONT of the chest with a soft glow. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi legendary dragon king, bright emerald-green scales, same golden curly horns, but the wings FULL-SPREAD upward and the tiny floating orb hovering BEHIND the head, slightly brighter. Same character identity, same color palette, same kawaii proportions',
    },
  },
  kitsune: {
    adolescent: {
      pose3: 'a chibi mystical fox with three fluffy tails, same forehead gem and sparkling eyes, but the three tails sweeping STRAIGHT UPWARD behind the head in a fan. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi mystical fox with three fluffy tails, same forehead gem and sparkling eyes, but the three tails CURLED FORWARD around the body, ear tips slightly twitched. Same character identity, same color palette, same kawaii proportions',
    },
    adult: {
      pose3: 'a chibi multi-tailed fox with five soft golden tails, same kawaii proportions, but the five floating tails arranged FANNED OUT HORIZONTALLY in a wide spread behind the body. Same character identity, same color palette',
      pose4: 'a chibi multi-tailed fox with five soft golden tails, same kawaii proportions, but the five floating tails CURLED INWARD around the body in a soft hug, ear tips slightly drooped. Same character identity, same color palette',
    },
    legendary: {
      pose3: 'a chibi legendary nine-tailed kitsune, nine fluffy golden tails fanning behind it, same red forehead mark, but the nine tails fanned STRAIGHT UPWARD in a tall peacock-style display. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi legendary nine-tailed kitsune, nine fluffy golden tails fanning behind it, same red forehead mark, but the nine tails BUNCHED TOGETHER in a tight upright bouquet behind the head, glowing brighter. Same character identity, same color palette, same kawaii proportions',
    },
  },
  cerberus: {
    legendary: {
      pose3: 'a chibi legendary three-headed pup king, three round happy puppy heads with tiny gold chains, but the MIDDLE head tilted UP looking at the sky with a tiny open mouth (mid-howl), the side heads still forward. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi legendary three-headed pup king, three round happy puppy heads with tiny gold chains, but all three heads tilted UP looking at the sky in unison, the mist puffs at the paws SLIGHTLY larger. Same character identity, same color palette, same kawaii proportions',
    },
  },
  sphinx: {
    adult: {
      pose3: 'a chibi baby sphinx, round head round body with tiny gold tiara, but the pair of small spread feathered wings FORWARD-EXTENDED in front of the chest, both front paws planted. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi baby sphinx, round head round body with tiny gold tiara, but the pair of small spread feathered wings RAISED HIGH ABOVE the head, head tilted slightly to one side with curious eyes. Same character identity, same color palette, same kawaii proportions',
    },
    legendary: {
      pose3: 'a chibi legendary sphinx mascot with miniature crown, same plump cute body, but the tiny spread golden wings FORWARD-EXTENDED and the lifted tail STRAIGHT UP. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi legendary sphinx mascot with miniature crown, same plump cute body, but the tiny spread golden wings RAISED HIGH ABOVE the head and the lifted tail CURLED around the body. Same character identity, same color palette, same kawaii proportions',
    },
  },
  golem: {
    legendary: {
      pose3: 'a chibi legendary crystal spirit king with a small crystal crown, soft jade-blue jelly body, but the glowing gem core inside the body MEDIUM brightness with a few small sparkles around it, the tiny round arms RAISED UPWARD. Same character identity, same color palette, same kawaii proportions',
      pose4: 'a chibi legendary crystal spirit king with a small crystal crown, soft jade-blue jelly body, but the glowing gem core PEAK BRIGHTNESS with light rays radiating outward and the tiny round arms SPREAD WIDE in an open pose. Same character identity, same color palette, same kawaii proportions',
    },
  },
};

const onlyLine = process.argv[2]; // optional: limit to one species
const lines = onlyLine ? [onlyLine] : Object.keys(POSES);

let total = 0;
for (const line of lines) {
  for (const form of Object.keys(POSES[line] || {})) total += Object.keys(POSES[line][form]).length;
}
console.log(`Generating up to ${total} pose3+pose4 frames (skipping any that already exist) …`);

let done = 0; let skipped = 0; let failed = 0;
for (const line of lines) {
  for (const [form, poses] of Object.entries(POSES[line] || {})) {
    const dir = path.join('assets', line);
    fs.mkdirSync(dir, { recursive: true });
    for (const [poseKey, art] of Object.entries(poses)) {
      const out = path.join(dir, `${form}_${poseKey}.png`);
      done += 1;
      if (fs.existsSync(out)) { skipped += 1; console.log(`  [${done}/${total}] skip ${out} (exists)`); continue; }
      try {
        const png = await requestImage(`${art}. ${STYLE}.`);
        fs.writeFileSync(out, png);
        console.log(`  [${done}/${total}] ✓ ${out}`);
      } catch (e) {
        failed += 1;
        console.error(`  [${done}/${total}] ✗ ${out}: ${e.message}`);
      }
    }
  }
}
console.log(`Done. generated=${done - skipped - failed}  skipped=${skipped}  failed=${failed}`);
