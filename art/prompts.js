import { LINES, LINE_IDS, FORMS } from '../src/lines.js';

export const STYLE = 'chibi mascot, super-deformed Q-style proportions, oversized round head, tiny round body, large sparkling expressive eyes, gentle smile, soft pastel palette, glossy smooth cel-shading with soft rim light, kawaii anime mascot, centered single character, plain fully transparent background, no text, no drop shadow under the character';

export function promptFor(line, form) {
  const art = LINES[line]?.forms?.[form]?.art || `${line} ${form}`;
  return `${art}. ${STYLE}.`;
}

export function spriteMatrix(lineList = LINE_IDS) {
  const out = [];
  for (const line of lineList) {
    for (const form of FORMS) {
      out.push({ line, form, key: `${line}/${form}` });
    }
  }
  return out;
}

export function outputPath(assetsDir, item) {
  return `${assetsDir}/${item.line}/${item.form}.png`;
}
