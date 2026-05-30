// One-off: fill in the two pose2 PNGs that the earlier batch couldn't reach when the OpenAI
// account hit its billing cap (sphinx legendary + golem legendary). Skips any file that already
// exists so it's safe to re-run.
import fs from 'node:fs';
import path from 'node:path';
import { requestImage } from './generate.mjs';
import { STYLE } from './prompts.js';

const MISSING = [
  {
    line: 'sphinx', form: 'legendary',
    art: 'a chibi legendary sphinx mascot with miniature crown, same plump cute body and same color palette, but the tiny spread golden wings FOLDED CLOSED against the back and the lifted tail swung to the OTHER side. Maintain consistent kawaii proportions and the same character identity',
  },
  {
    line: 'golem', form: 'legendary',
    art: 'a chibi legendary crystal spirit king with a small crystal crown, soft jade-blue jelly body, but the glowing gem core inside the body MUCH BRIGHTER and slightly larger, and the tiny round arms RAISED in a different position. Maintain the same character identity and kawaii proportions',
  },
];

for (const m of MISSING) {
  const dir = path.join('assets', m.line);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${m.form}_pose2.png`);
  if (fs.existsSync(out)) { console.log(`  - skip ${out} (exists)`); continue; }
  const png = await requestImage(`${m.art}. ${STYLE}.`);
  fs.writeFileSync(out, png);
  console.log(`  ✓ ${out}`);
}
