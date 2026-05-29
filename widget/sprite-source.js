import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function assetUrlFor(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey.indexOf('/') === -1) return null; // 'egg' (pre-hatch) has no per-species art
  const file = path.join(assetsDir, ...spriteKey.split('/')) + '.png';
  return fs.existsSync(file) ? pathToFileURL(file).href : null;
}

// A base64 data URL for the sprite PNG. The 3D renderer needs this rather than a file:// URL,
// because WebGL refuses to upload file:// images as textures (origin-tainted). Cached by path.
const _dataUrlCache = new Map();
export function assetDataUrl(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey.indexOf('/') === -1) return null;
  const file = path.join(assetsDir, ...spriteKey.split('/')) + '.png';
  if (_dataUrlCache.has(file)) return _dataUrlCache.get(file);
  let out = null;
  try { out = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); } catch { out = null; }
  _dataUrlCache.set(file, out);
  return out;
}
