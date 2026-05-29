import fs from 'node:fs';
import path from 'node:path';
import { promptFor, spriteMatrix, outputPath } from './prompts.js';
import { LINE_IDS } from '../src/lines.js';

// Real OpenAI Images call. Model id is configurable because "GPT Image 2.0" may
// be `gpt-image-2` or similar — set OPENAI_IMAGE_MODEL to match current docs.
// Returns a Buffer of PNG bytes. Requires OPENAI_API_KEY.
export async function requestImage(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required to generate art');
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, size: '1024x1024', background: 'transparent', n: 1 }),
  });
  if (!res.ok) throw new Error(`image API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}

export async function generateAll(items, { assetsDir, requestImage: req = requestImage } = {}) {
  let written = 0;
  for (const item of items) {
    const out = outputPath(assetsDir, item);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const png = await req(promptFor(item.line, item.form), item);
    fs.writeFileSync(out, png);
    written += 1;
  }
  return { written };
}

// CLI entry: `OPENAI_API_KEY=... npm run gen-art [species]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  const items = spriteMatrix(only ? [only] : LINE_IDS);
  const assetsDir = path.resolve('assets');
  console.log(`Generating ${items.length} sprites into ${assetsDir} …`);
  generateAll(items, { assetsDir }).then((r) => console.log(`Done: ${r.written} PNGs.`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
