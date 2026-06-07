import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function modelPathFor(assetsDir, spriteKey) {
  if (!spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) return null;
  return path.join(assetsDir, 'live2d', ...spriteKey.split('/'), 'model3.json');
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function refExists(modelDir, rel) {
  return typeof rel === 'string' && rel.length > 0 && fs.existsSync(path.join(modelDir, rel));
}

export function live2dModelFor(assetsDir, spriteKey) {
  const modelFile = modelPathFor(assetsDir, spriteKey);
  if (!modelFile || !fs.existsSync(modelFile)) return null;
  const model = readJson(modelFile);
  const refs = model?.FileReferences;
  const modelDir = path.dirname(modelFile);
  if (!refs || !refExists(modelDir, refs.Moc)) return null;
  const textures = Array.isArray(refs.Textures) ? refs.Textures : [];
  if (!textures.length || !textures.every((texture) => refExists(modelDir, texture))) return null;
  const motions = refs.Motions && typeof refs.Motions === 'object'
    ? Object.keys(refs.Motions).filter((group) => {
        const entries = refs.Motions[group];
        return Array.isArray(entries) && entries.every((entry) => !entry?.File || refExists(modelDir, entry.File));
      })
    : [];
  return {
    key: spriteKey,
    url: pathToFileURL(modelFile).href,
    motions,
    hasPhysics: refExists(modelDir, refs.Physics),
  };
}
