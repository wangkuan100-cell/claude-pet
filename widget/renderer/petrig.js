(function (root) {
  const NUMERIC_PROPS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'z', 'opacity'];

  function num(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function easeValue(kind, t) {
    const x = clamp01(t);
    if (kind === 'hold') return 0;
    if (kind === 'easeInOut') return x * x * (3 - 2 * x);
    return x;
  }

  function normalizeClipTime(animation, elapsedMs) {
    const duration = Math.max(1, num(animation?.duration, 1));
    const elapsed = num(elapsedMs, 0);
    if (animation?.loop) {
      return (((elapsed % duration) + duration) % duration) / duration;
    }
    return clamp01(elapsed / duration);
  }

  function sortedKeyframes(track) {
    return Array.isArray(track?.keyframes)
      ? track.keyframes.slice().sort((a, b) => num(a.time, 0) - num(b.time, 0))
      : [];
  }

  function restTransform(bone) {
    return {
      x: num(bone?.x, 0),
      y: num(bone?.y, 0),
      rotation: num(bone?.rotation, 0),
      scaleX: num(bone?.scaleX, 1),
      scaleY: num(bone?.scaleY, 1),
      z: num(bone?.z, 0),
      opacity: num(bone?.opacity, 1),
      contact: false,
    };
  }

  function frameValue(frame, prop, fallback) {
    return num(frame?.[prop], fallback);
  }

  function sampleTrack(bone, track, time) {
    const base = restTransform(bone);
    const frames = sortedKeyframes(track);
    if (!frames.length) return base;
    if (time <= num(frames[0].time, 0)) return mergeFrame(base, frames[0]);
    if (time >= num(frames[frames.length - 1].time, 1)) return mergeFrame(base, frames[frames.length - 1]);

    let prev = frames[0];
    let next = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i += 1) {
      const a = frames[i];
      const b = frames[i + 1];
      if (time >= num(a.time, 0) && time <= num(b.time, 1)) {
        prev = a;
        next = b;
        break;
      }
    }

    const span = Math.max(0.000001, num(next.time, 1) - num(prev.time, 0));
    const pct = easeValue(next.ease || prev.ease, (time - num(prev.time, 0)) / span);
    const out = { ...base };
    for (const prop of NUMERIC_PROPS) {
      const from = frameValue(prev, prop, base[prop]);
      const to = frameValue(next, prop, base[prop]);
      out[prop] = from + (to - from) * pct;
    }
    out.contact = time >= num(next.time, 1) ? next.contact === true : prev.contact === true;
    return out;
  }

  function mergeFrame(base, frame) {
    const out = { ...base };
    for (const prop of NUMERIC_PROPS) {
      if (Number.isFinite(frame?.[prop])) out[prop] = frame[prop];
    }
    if (typeof frame?.contact === 'boolean') out.contact = frame.contact;
    return out;
  }

  function combine(parent, local) {
    if (!parent) return { ...local };
    return {
      x: parent.x + local.x,
      y: parent.y + local.y,
      rotation: parent.rotation + local.rotation,
      scaleX: parent.scaleX * local.scaleX,
      scaleY: parent.scaleY * local.scaleY,
      z: parent.z + local.z,
      opacity: parent.opacity * local.opacity,
      contact: local.contact,
    };
  }

  function evaluateRig(rig, clipName, elapsedMs, options) {
    const animations = rig?.animations || {};
    const requested = animations[clipName] ? clipName : 'idle';
    const animation = animations[requested] || { duration: 1, loop: true, tracks: {} };
    const time = normalizeClipTime(animation, elapsedMs);
    const bones = rig?.bones || {};
    const local = {};
    const world = {};

    for (const id of Object.keys(bones)) {
      local[id] = sampleTrack(bones[id], animation.tracks?.[id], time);
    }

    const visiting = new Set();
    function resolve(id) {
      if (world[id]) return world[id];
      if (!bones[id]) return restTransform(null);
      if (visiting.has(id)) return local[id] || restTransform(bones[id]);
      visiting.add(id);
      const parentId = bones[id].parent;
      const parent = parentId ? resolve(parentId) : null;
      world[id] = combine(parent, local[id] || restTransform(bones[id]));
      visiting.delete(id);
      return world[id];
    }

    for (const id of Object.keys(bones)) resolve(id);
    return {
      clip: requested,
      time,
      duration: num(animation.duration, 1),
      loop: animation.loop === true,
      transforms: world,
      options: options || {},
    };
  }

  function boneTransformsToLayerTransforms(rig, pose) {
    const slots = Array.isArray(rig?.slots) ? rig.slots : [];
    return slots.map((slot, index) => {
      const transform = pose?.transforms?.[slot.bone] || restTransform(rig?.bones?.[slot.bone]);
      return {
        id: slot.id,
        bone: slot.bone,
        file: slot.file,
        x: transform.x,
        y: transform.y,
        z: Number.isFinite(slot.z) ? slot.z : transform.z + index * 0.0005,
        rotation: transform.rotation,
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
        opacity: num(slot.opacity, 1) * num(transform.opacity, 1),
        contact: transform.contact === true,
      };
    });
  }

  root.PetRig = {
    evaluateRig,
    boneTransformsToLayerTransforms,
    normalizeClipTime,
  };
})(typeof window !== 'undefined' ? window : globalThis);
