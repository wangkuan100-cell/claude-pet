// Generate per-part layered PNGs for one species+form (pilot for "layered animation" approach).
//
// Each species defines which body parts can move independently. We generate ONE PNG per part
// (body / wings / tail / etc.), all on a transparent background, sized 1024x1024. The widget
// composites them at runtime and animates each layer with CSS (wings flap, tail sways, body
// breathes), giving the pet much more "alive" motion than a single static sprite ever can.
//
// Usage:  OPENAI_API_KEY=sk-... node art/gen-layers.mjs <line> <form>
// Output: assets/<line>/<form>_<part>.png  (one PNG per part)

import fs from 'node:fs';
import path from 'node:path';
import { requestImage } from './generate.mjs';
import { STYLE } from './prompts.js';

// Per-species layer config. `prompt` is the SUBJECT — STYLE is appended automatically.
// Keep the same color/style language as the corresponding form in src/lines.js so the layers
// look like the same character. Each layer ends with the strong negative spec so the API
// returns ONLY that part on transparent bg.
const ONLY_ON_TRANSPARENT =
  ' Show ONLY this element fully isolated on a plain transparent background, nothing else in the image, no body, no character, no other parts, no shadow. Centered.';

const LAYERS = {
  dragon: {
    legendary: [
      { name: 'body',  prompt:
        'a chibi legendary dragon king BODY ONLY — bright emerald-green plump body, golden curly horns on the head, big sparkling eyes, gentle smile, tiny round arms and short legs, no wings, no tail. Front-facing standing pose.' },
      { name: 'wings', prompt:
        'a SYMMETRIC PAIR of small spread chibi dragon wings, bright emerald-green membrane with golden inner edges, glossy cel-shading.' + ONLY_ON_TRANSPARENT },
      { name: 'tail',  prompt:
        'a chibi dragon tail — a single plump emerald-green curled tail with a darker green tip, viewed from behind, glossy.' + ONLY_ON_TRANSPARENT },
    ],
    adult: [
      { name: 'body',  prompt:
        'a chibi cute dragon mascot BODY ONLY — soft green body, small golden horns, plump belly, gentle smile, big round eyes, short legs and tiny arms, no wings, no tail. Front-facing standing pose.' },
      { name: 'wings', prompt:
        'a SYMMETRIC PAIR of small spread chibi dragon wings, soft jade-green membrane.' + ONLY_ON_TRANSPARENT },
      { name: 'tail',  prompt:
        'a chibi dragon plump tail, soft jade-green with a darker tip, curled gently.' + ONLY_ON_TRANSPARENT },
    ],
  },
  // (other species will be filled in once we confirm the dragon pilot looks acceptable)
};

const [line, form] = process.argv.slice(2);
if (!line || !form) {
  console.error('Usage: OPENAI_API_KEY=... node art/gen-layers.mjs <line> <form>');
  process.exit(1);
}
const layers = LAYERS[line]?.[form];
if (!layers) {
  console.error(`No layer config defined for ${line}/${form}. Add it to LAYERS in this file.`);
  process.exit(1);
}

console.log(`Generating ${layers.length} layers for ${line}/${form} …`);
const dir = path.join('assets', line);
fs.mkdirSync(dir, { recursive: true });
for (const layer of layers) {
  const prompt = `${layer.prompt}. ${STYLE}.`;
  const png = await requestImage(prompt);
  const out = path.join(dir, `${form}_${layer.name}.png`);
  fs.writeFileSync(out, png);
  console.log(`  ✓ ${out}`);
}
console.log('Done. Open _layers.html in the preview to compose + animate.');
