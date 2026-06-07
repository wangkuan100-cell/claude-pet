import fs from 'node:fs';
import path from 'node:path';

const PRODUCTION_SKELETAL_ENGINES = new Set(['dragonbones', 'loongbones']);
const _dataUrlCache = new Map();

function rigPathFor(assetsDir, spriteKey) {
  if (!assetsDir || !spriteKey || spriteKey === 'egg' || spriteKey.indexOf('/') === -1) return null;
  return path.join(assetsDir, 'rigs', ...spriteKey.split('/'), 'rig.json');
}

function readJsonIfPresent(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function dataUrlFor(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  if (_dataUrlCache.has(filePath)) return _dataUrlCache.get(filePath);
  let out = null;
  try {
    out = 'data:image/png;base64,' + fs.readFileSync(filePath).toString('base64');
  } catch {
    out = null;
  }
  _dataUrlCache.set(filePath, out);
  return out;
}

function resolveRef(baseDir, ref) {
  if (!ref || typeof ref !== 'string') return null;
  return path.resolve(baseDir, ref);
}

function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function generatedLegendarySprite(assetsDir, spriteKey) {
  if (!assetsDir || !spriteKey) return null;
  const parts = spriteKey.split('/');
  if (parts.length !== 2 || parts[1] !== 'legendary') return null;
  const line = parts[0];
  const spritePath = path.join(assetsDir, line, 'legendary.png');
  return fs.existsSync(spritePath) ? { line, spritePath } : null;
}

function sharedLegendaryRuntime(assetsDir) {
  const phoenixRigPath = path.join(assetsDir, 'rigs', 'phoenix', 'legendary', 'rig.json');
  const phoenixRig = readJsonIfPresent(phoenixRigPath);
  const runtime = phoenixRig?.runtime;
  if (!runtime?.meshZones || !runtime?.animations) return null;
  return cloneJson(runtime);
}

function pascalCase(value) {
  return String(value || '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function generatedLegendarySkeleton(line, runtime) {
  const displayName = `${line}_full`;
  const animations = Object.entries(runtime?.animations || {}).map(([name, animation]) => ({
    name,
    duration: Math.max(1, Math.round((Number.isFinite(animation.duration) ? animation.duration : 1000) / 1000 * 24)),
    playTimes: animation.loop === false ? 1 : 0,
    bone: [],
  }));
  return {
    name: `code-pet-${line}-legendary`,
    version: '5.5',
    compatibleVersion: '5.5',
    frameRate: 24,
    armature: [
      {
        name: `${pascalCase(line)}Legendary`,
        type: 'Armature',
        aabb: { x: 0, y: 0, width: 256, height: 256 },
        bone: [
          { name: 'root', transform: { x: 0, y: 0 } },
          { name: 'body', parent: 'root', transform: { x: 128, y: 128 } },
          { name: 'leftWing', parent: 'body', transform: { x: 102, y: 125 } },
          { name: 'rightWing', parent: 'body', transform: { x: 154, y: 125 } },
          { name: 'feet', parent: 'body', transform: { x: 128, y: 202 } },
          { name: 'crest', parent: 'body', transform: { x: 128, y: 82 } },
          { name: 'leftEye', parent: 'body', transform: { x: 105, y: 120 } },
          { name: 'rightEye', parent: 'body', transform: { x: 151, y: 120 } },
        ],
        slot: [
          { name: 'whole-body', parent: 'body', displayIndex: 0, blendMode: 'normal' },
        ],
        skin: [
          {
            name: 'default',
            slot: [
              {
                name: 'whole-body',
                display: [
                  {
                    name: displayName,
                    path: displayName,
                    type: 'image',
                    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
                  },
                ],
              },
            ],
          },
        ],
        animation: animations,
      },
    ],
  };
}

function generatedLegendaryAtlas(line, textureRef) {
  return {
    name: `code-pet-${line}-legendary-texture`,
    imagePath: textureRef,
    width: 256,
    height: 256,
    SubTexture: [
      { name: `${line}_full`, x: 0, y: 0, width: 256, height: 256 },
    ],
  };
}

function generatedLegendaryRig(assetsDir, spriteKey) {
  const sprite = generatedLegendarySprite(assetsDir, spriteKey);
  if (!sprite) return null;
  const runtime = sharedLegendaryRuntime(assetsDir);
  if (!runtime) return null;
  const textureSrc = dataUrlFor(sprite.spritePath);
  if (!textureSrc) return null;
  const textureRef = `../../../${sprite.line}/legendary.png`;
  return {
    id: spriteKey,
    engine: 'dragonbones',
    version: 1,
    skeleton: `${sprite.line}_ske.generated.json`,
    atlas: `${sprite.line}_tex.generated.json`,
    texture: textureRef,
    sourceSprite: textureRef,
    runtime,
    skeletonData: generatedLegendarySkeleton(sprite.line, runtime),
    atlasData: generatedLegendaryAtlas(sprite.line, textureRef),
    textureSrc,
  };
}

export function isProductionSkeletalRig(rig, spriteKey = null) {
  if (!rig || typeof rig !== 'object') return false;
  if (spriteKey && rig.id !== spriteKey) return false;
  return PRODUCTION_SKELETAL_ENGINES.has(String(rig.engine || '').toLowerCase());
}

export function rigFor(assetsDir, spriteKey) {
  const rigPath = rigPathFor(assetsDir, spriteKey);
  if (!rigPath) return null;
  if (!fs.existsSync(rigPath)) return generatedLegendaryRig(assetsDir, spriteKey);
  try {
    const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
    if (!isProductionSkeletalRig(rig, spriteKey)) return null;
    const rigDir = path.dirname(rigPath);
    const skeletonPath = resolveRef(rigDir, rig.skeleton);
    const atlasPath = resolveRef(rigDir, rig.atlas);
    const texturePath = resolveRef(rigDir, rig.texture);
    const skeletonData = readJsonIfPresent(skeletonPath);
    const atlasData = readJsonIfPresent(atlasPath);
    const textureSrc = dataUrlFor(texturePath);
    return {
      ...rig,
      skeletonData,
      atlasData,
      textureSrc,
    };
  } catch {
    return null;
  }
}
