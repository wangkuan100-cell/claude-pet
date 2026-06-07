import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rigFor } from './rig-source.js';

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
// because WebGL refuses to upload file:// images as textures (origin-tainted).
const _dataUrlCache = new Map();
function cacheStamp(file) {
  try {
    const stat = fs.statSync(file);
    return `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return null;
  }
}

function dataUrlFor(file) {
  if (!file) return null;
  const stamp = cacheStamp(file);
  if (!stamp) return null;
  const cached = _dataUrlCache.get(file);
  if (cached?.stamp === stamp) return cached.value;
  let out = null;
  try { out = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); } catch { out = null; }
  _dataUrlCache.set(file, { stamp, value: out });
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

// All available pose frames for the sprite key, in order: [pose1, pose2, pose3, ...].
// pose1 = the base PNG (no suffix); poseN (N≥2) = `${form}_poseN.png`. Auto-discovers however
// many poses exist on disk and stops at the first gap (so adding pose3 later doesn't require any
// code change — just drop the file into assets/<line>/). The renderer ping-pongs through the
// returned array (0 → 1 → ... → N-1 → N-2 → ... → 1 → 0 → ...) at mood-driven tempo so wings
// flap / tails sway through N keyframes instead of just 2.
// Returns at most MAX_POSES entries to bound memory; empty array if the base sprite is missing.
const MAX_POSES = 8;
export function assetDataUrls(assetsDir, spriteKey) {
  const base = filePathFor(assetsDir, spriteKey);
  if (!base || !fs.existsSync(base)) return [];
  const out = [dataUrlFor(base)];
  // egg.png and any single-token key have no pose variants (they're stage-locked).
  if (!spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) return out;
  const prefix = path.join(assetsDir, ...spriteKey.split('/'));
  for (let i = 2; i <= MAX_POSES; i++) {
    const f = `${prefix}_pose${i}.png`;
    if (!fs.existsSync(f)) break; // gap-stop: no pose5 if pose4 is missing
    out.push(dataUrlFor(f));
  }
  return out;
}

function layerManifestPath(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) return null;
  return path.join(assetsDir, 'layers', ...spriteKey.split('/'), 'manifest.json');
}

function num(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function point(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return undefined;
  return { x: value.x, y: value.y };
}

function objectValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value;
}

export function assetLayerSet(assetsDir, spriteKey) {
  const manifestFile = layerManifestPath(assetsDir, spriteKey);
  if (!manifestFile || !fs.existsSync(manifestFile)) return null;
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch { return null; }
  if (!Array.isArray(manifest.layers) || manifest.layers.length === 0) return null;
  const manifestDir = path.dirname(manifestFile);
  const layers = [];
  for (const layer of manifest.layers) {
    if (!layer?.id || !layer?.file) return null;
    const file = path.join(manifestDir, layer.file);
    if (!fs.existsSync(file)) return null;
    const out = {
      id: String(layer.id),
      src: dataUrlFor(file),
      z: num(layer.z, 0),
      x: num(layer.x, 0),
      y: num(layer.y, 0),
      scale: num(layer.scale, 1),
      opacity: num(layer.opacity, 1),
      sway: num(layer.sway, 0),
      tilt: num(layer.tilt, 0),
      phase: num(layer.phase, 0),
    };
    const pivot = point(layer.pivot);
    if (pivot) out.pivot = pivot;
    if (typeof layer.motion === 'string') out.motion = layer.motion;
    if (typeof layer.part === 'string') out.part = layer.part;
    if (Number.isFinite(layer.direction)) out.direction = layer.direction;
    const clip = objectValue(layer.clip);
    if (clip) out.clip = clip;
    layers.push(out);
  }
  return {
    key: spriteKey,
    canvas: {
      width: num(manifest.canvas?.width, 256),
      height: num(manifest.canvas?.height, 256),
    },
    layers,
  };
}

export function assetRig(assetsDir, spriteKey) {
  return rigFor(assetsDir, spriteKey);
}
