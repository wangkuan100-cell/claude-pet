import { isProductionSkeletalRig } from './rig-source.js';

export function attachSpriteAssets(sprite, spriteSource, assetsDir, live2dSource = null) {
  const out = sprite;
  const poses = spriteSource.assetDataUrls(assetsDir, out.key);
  const layerSet = spriteSource.assetLayerSet(assetsDir, out.key);
  const candidateRig = spriteSource.assetRig?.(assetsDir, out.key);
  const rig = isProductionSkeletalRig(candidateRig, out.key) ? candidateRig : null;
  if (poses.length) {
    out.poses = [poses[0]];
    out.imageSrc = poses[0];
    delete out.imageSrcPose2;
    const live2d = live2dSource?.live2dModelFor?.(assetsDir, out.key);
    if (live2d) {
      out.animationMode = 'live2d';
      out.live2d = live2d;
      delete out.layers;
      delete out.layerCanvas;
      delete out.rig;
      return out;
    }
    delete out.live2d;
    if (rig) {
      out.animationMode = rig.engine;
      out.rig = rig;
      delete out.layers;
      delete out.layerCanvas;
    } else {
      out.animationMode = 'still';
      delete out.layers;
      delete out.layerCanvas;
      delete out.rig;
    }
    return out;
  }
  if (rig) {
    out.animationMode = rig.engine;
    out.rig = rig;
    delete out.layers;
    delete out.layerCanvas;
  } else {
    delete out.layers;
    delete out.layerCanvas;
    delete out.rig;
  }
  return out;
}
