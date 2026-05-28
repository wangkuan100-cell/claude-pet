import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function assetUrlFor(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey.indexOf('/') === -1) return null; // 'egg' (pre-adopt) has no per-species art
  const file = path.join(assetsDir, ...spriteKey.split('/')) + '.png';
  return fs.existsSync(file) ? pathToFileURL(file).href : null;
}
