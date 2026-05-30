import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Resolve a sprite key to a PNG path. Special-case: 'egg' maps to the GENERIC pre-hatch egg
// (assets/egg.png) — every pet sees the same neutral egg before it hatches, so the species
// inside cannot be guessed. After hatching, the key is 'line/form' (e.g. 'phoenix/legendary').
function filePathFor(assetsDir, spriteKey) {
  if (!spriteKey) return null;
  if (spriteKey === 'egg') return path.join(assetsDir, 'egg.png');
  if (spriteKey.indexOf('/') === -1) return null;
  return path.join(assetsDir, ...spriteKey.split('/')) + '.png';
}

export function assetUrlFor(assetsDir, spriteKey) {
  const file = filePathFor(assetsDir, spriteKey);
  return file && fs.existsSync(file) ? pathToFileURL(file).href : null;
}

// A base64 data URL for the sprite PNG. The 3D renderer needs this rather than a file:// URL,
// because WebGL refuses to upload file:// images as textures (origin-tainted). Cached by path.
const _dataUrlCache = new Map();
function dataUrlFor(file) {
  if (!file) return null;
  if (_dataUrlCache.has(file)) return _dataUrlCache.get(file);
  let out = null;
  try { out = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); } catch { out = null; }
  _dataUrlCache.set(file, out);
  return out;
}

export function assetDataUrl(assetsDir, spriteKey) {
  return dataUrlFor(filePathFor(assetsDir, spriteKey));
}

// Optional second-pose PNG for the same sprite key. When present, the renderer cross-fades the
// two images (~0.8s) so wings flap / tails sway / cores glow. Returns null if no pose2 file exists.
export function assetDataUrlPose2(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) return null;
  const file = path.join(assetsDir, ...spriteKey.split('/')) + '_pose2.png';
  if (!fs.existsSync(file)) return null;
  return dataUrlFor(file);
}
