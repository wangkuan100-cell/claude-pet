import { LINES, LINE_IDS, FORMS } from '../src/lines.js';

export const STYLE = 'cute cartoon 3D render, Pixar-style, big expressive eyes, soft rounded shapes, glossy smooth shading, soft studio lighting, subtle ambient occlusion, vibrant saturated colors, adorable mascot, centered single character, plain transparent background, no text, no drop shadow';

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
