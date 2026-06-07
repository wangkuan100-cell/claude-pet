/* The pet's 2D art, staged in a real 3D scene (three.js, loaded as the global THREE).
 * "Paper-Mario" style: the existing sprite is a textured plane that lives in 3D — it bobs,
 * leans, jumps, and casts a soft shadow, but always faces the camera so the art reads cleanly.
 * Exposes window.Pet3D = { init, ready, show, setMood, playAction, setLook, react }. */
(function () {
  const THREE = window.THREE;
  const API = { ready: false };
  window.Pet3D = API;
  if (!THREE) return; // graceful fallback: pet.js keeps the 2D sprite

  const FORM_SCALE = { egg: 0.82, hatchling: 0.9, juvenile: 1.0, adolescent: 1.12, adult: 1.24, legendary: 1.4 };
  // tempo = how FAST things move; bob = how MUCH the body bobs; yaw = how MUCH it swivels
  const MOOD_TEMPO = { flow: 1.9,  happy: 1.35, normal: 1.0,  sleepy: 0.45, bored: 0.35, worried: 1.6 };
  const MOOD_BOB   = { flow: 0.10, happy: 0.08, normal: 0.06, sleepy: 0.04, bored: 0.025, worried: 0.05 };
  const MOOD_YAW   = { flow: 0.18, happy: 0.15, normal: 0.13, sleepy: 0.06, bored: 0.04,  worried: 0.10 };
  const SKELETAL_ENGINES = new Set(['dragonbones', 'loongbones']);

  let canvas, renderer, scene, camera, clock, texLoader;
  let root, shadow;
  const planes = [];             // textured planes, one per pose frame; lazily allocated up to MAX_POSES
  const planeUrls = [];          // currently-loaded data URL per plane (cache to avoid re-decoding)
  const layerMeshes = [];        // 2.5D paper-doll layers, loaded from assets/layers/<line>/<form>/manifest.json
  const layerGroups = [];        // pivot groups; each layer plane is offset inside its own hinge group
  const layerUrls = [];
  const layerConfigs = [];
  const MAX_POSES = 8;
  const PLANE_GEO = () => new THREE.PlaneGeometry(2, 2, 24, 24);
  const state = {
    tempo: 1, bobAmp: 0.06, yawAmp: 0.13,
    worried: false, sleepy: false,
    action: null, actionT: 0, look: { x: 0, y: 0 }, scale: 1,
    movingDir: 0, moveBlend: 0,
    actionLift: 0, groundLift: 0, groundContact: 1,
    attentionLook: { x: 0, y: 0 }, headTilt: 0,
    wasAirborne: false, landingRebound: 0,
    skeletalClip: null, skeletalFrame: null, transitionFromFrame: null, transitionElapsedMs: 0,
    poseCount: 0, curEmoji: null, layerMode: false, animationMode: 'still', rig: null,
  };
  // Per-transition duration at tempo=1 (seconds). For N poses, the full ping-pong cycle takes
  // 2*(N-1) * TRANSITION seconds. With TRANSITION=0.425s this matches the original 2-pose cycle
  // length (0.85s) when N=2, and gives ~2.55s/cycle for N=4 — about 0.4 flaps/sec at normal mood.
  const TRANSITION = 0.425;
  const TRANSITION_BLEND_MS = 160;
  const SHADOW_GROUND_Y = -1.22;
  const EYE_LOOK_X = 0.01;
  const EYE_LOOK_Y = 0.007;
  const EYE_BLINK_X = 0.025;
  const EYE_BLINK_Y = 0.52;
  const FRAME_DEFAULTS = {
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    wingLift: 0, wingCurl: 0, footStride: 0, footPlant: 1,
    crestSway: 0, hopSquash: 0, blink: 0,
    eyeShiftX: 0, eyeShiftY: 0, headTilt: 0, landingRebound: 0,
  };
  const FRAME_FIELDS = Object.keys(FRAME_DEFAULTS);

  function emojiTexture(emoji) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.font = '190px -apple-system, "Apple Color Emoji", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji || '🥚', 128, 140);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function applyTextureTo(mesh, tex) {
    if (!mesh) return;
    tex.anisotropy = 4;
    const old = mesh.material.map;
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
    if (old && old !== tex) old.dispose();
  }

  function loadUrlInto(url, mesh) {
    texLoader.load(
      url,
      (tex) => { tex.encoding = THREE.sRGBEncoding; applyTextureTo(mesh, tex); },
      undefined,
      () => applyTextureTo(mesh, emojiTexture(state.curEmoji || '🥚')), // load error → emoji
    );
  }

  function rememberBaseGeometry(mesh) {
    const attr = mesh?.geometry?.attributes?.position;
    if (!attr || mesh.userData.basePositions) return;
    mesh.userData.basePositions = Float32Array.from(attr.array);
  }

  function isSkeletalRig(rig) {
    return rig && typeof rig === 'object' && SKELETAL_ENGINES.has(String(rig.engine || '').toLowerCase());
  }

  function num(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smooth01(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  function pseudoRandomSigned(seed) {
    const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return (raw - Math.floor(raw)) * 2 - 1;
  }

  function petAttentionFrame(t, tempo) {
    const phase = (t * Math.max(tempo, 0.45)) / 3.1;
    const step = Math.floor(phase);
    const pct = smooth01(phase - step);
    const fromX = pseudoRandomSigned(step + 1.7);
    const toX = pseudoRandomSigned(step + 2.7);
    const fromY = pseudoRandomSigned(step + 7.3);
    const toY = pseudoRandomSigned(step + 8.3);
    const fromTilt = pseudoRandomSigned(step + 13.9);
    const toTilt = pseudoRandomSigned(step + 14.9);
    return {
      attentionLook: {
        x: lerp(fromX, toX, pct) * 0.055,
        y: lerp(fromY, toY, pct) * 0.024,
      },
      headTilt: lerp(fromTilt, toTilt, pct) * 0.045,
    };
  }

  function zoneWeight(x, y, zone) {
    if (!zone) return 0;
    const xMin = num(zone.xMin, -1);
    const xMax = num(zone.xMax, 1);
    const yMin = num(zone.yMin, -1);
    const yMax = num(zone.yMax, 1);
    if (x < xMin || x > xMax || y < yMin || y > yMax) return 0;
    const width = Math.max(0.0001, xMax - xMin);
    const height = Math.max(0.0001, yMax - yMin);
    const edge = Math.min(
      (x - xMin) / width,
      (xMax - x) / width,
      (y - yMin) / height,
      (yMax - y) / height,
    );
    return smooth01(edge * 4);
  }

  function zoneProgress(x, y, zone) {
    if (!zone) return 0;
    const side = num(zone.side, x < 0 ? -1 : 1);
    const pivotX = num(zone.pivotX, 0);
    if (side < 0) {
      return clamp01((pivotX - x) / Math.max(0.0001, pivotX - num(zone.xMin, -1)));
    }
    return clamp01((x - pivotX) / Math.max(0.0001, num(zone.xMax, 1) - pivotX));
  }

  function hingeDelta(x, y, zone, angle, weight) {
    if (!weight || !zone || !angle) return { x: 0, y: 0 };
    const px = num(zone.pivotX, 0);
    const py = num(zone.pivotY, 0);
    const dx = x - px;
    const dy = y - py;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: ((dx * cos - dy * sin) - dx) * weight,
      y: ((dx * sin + dy * cos) - dy) * weight,
    };
  }

  // Lazily create the i-th pose plane. All planes share root; later planes get a tiny z-offset so
  // alpha-blending has a stable draw order. Initial opacity 0 except the first plane (so before
  // show() runs the renderer has something visible).
  function getOrCreatePlane(i) {
    while (planes.length <= i) {
      const idx = planes.length;
      const mesh = new THREE.Mesh(
        PLANE_GEO(),
        new THREE.MeshBasicMaterial({
          map: emojiTexture('🥚'), transparent: true, alphaTest: 0.06, depthWrite: false,
          opacity: idx === 0 ? 1 : 0,
        }),
      );
      rememberBaseGeometry(mesh);
      mesh.renderOrder = idx + 10;
      mesh.position.z = idx * 0.002; // stable draw order: later poses draw after earlier ones
      mesh.userData.baseZ = mesh.position.z;
      mesh.visible = idx === 0;
      root.add(mesh);
      planes.push(mesh);
      planeUrls.push(null);
    }
    return planes[i];
  }

  function getOrCreateLayer(i) {
    while (layerMeshes.length <= i) {
      const idx = layerMeshes.length;
      const group = new THREE.Group();
      group.visible = false;
      const mesh = new THREE.Mesh(
        PLANE_GEO(),
        new THREE.MeshBasicMaterial({
          map: emojiTexture('🥚'), transparent: true, alphaTest: 0.04, depthWrite: false,
          opacity: 1,
        }),
      );
      mesh.renderOrder = idx + 10;
      mesh.visible = true;
      group.add(mesh);
      root.add(group);
      layerGroups.push(group);
      layerMeshes.push(mesh);
      layerUrls.push(null);
      layerConfigs.push({});
    }
    return { group: layerGroups[i], mesh: layerMeshes[i] };
  }

  function hideLayers() {
    for (let i = 0; i < layerMeshes.length; i++) {
      layerGroups[i].visible = false;
      layerMeshes[i].material.opacity = 0;
      layerUrls[i] = null;
      layerConfigs[i] = {};
    }
  }

  function resize() {
    if (!renderer || !canvas) return;
    const w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function updateShadow(t, sc) {
    if (!shadow) return;
    const lift = clamp01(state.groundLift / 0.42);
    const contact = clamp01(state.groundContact);
    const breath = Math.sin(t * 1.7 * state.tempo);
    const width = sc * (1 + contact * 0.08 - lift * 0.18 + breath * 0.025);
    const depth = sc * (0.78 + contact * 0.04 - lift * 0.24 + breath * 0.01);
    shadow.scale.set(width, depth, 1);
    shadow.material.opacity = 0.14 * (0.65 + contact * 0.35) * (1 - lift * 0.45);
  }

  function normalizedPivot(pivot, canvasInfo) {
    const w = canvasInfo?.width || 256;
    const h = canvasInfo?.height || 256;
    if (!pivot || !Number.isFinite(pivot.x) || !Number.isFinite(pivot.y)) return { x: 0, y: 0 };
    return {
      x: ((pivot.x / w) - 0.5) * 2,
      y: (0.5 - (pivot.y / h)) * 2,
    };
  }

  function resetPlane(mesh) {
    const attr = mesh?.geometry?.attributes?.position;
    const base = mesh?.userData?.basePositions;
    if (!attr || !base) return;
    attr.array.set(base);
    attr.needsUpdate = true;
  }

  function resetPlaneTransform(mesh) {
    if (!mesh) return;
    mesh.position.x = 0;
    mesh.position.y = 0;
    mesh.position.z = Number.isFinite(mesh.userData.baseZ) ? mesh.userData.baseZ : 0;
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
  }

  function rigClipName() {
    if (state.action === 'blink') return 'blink';
    if (state.action === 'hop' || state.action === 'jump') return 'hop';
    if (state.action === 'flap' || state.action === 'fly') return 'flap';
    if (state.action === 'pop' || state.action === 'dance' || state.action === 'happy') return 'happy';
    if (state.action === 'worried') return 'worried';
    if (state.action === 'tap') return 'tap';
    if (state.moveBlend > 0.08) return state.tempo > 1.2 ? 'run' : 'walk';
    return 'idle';
  }

  function rigLayerMap(t) {
    if (!state.rig || !window.PetRig) return null;
    const pose = window.PetRig.evaluateRig(state.rig, rigClipName(), t * 1000, {
      moving: state.moveBlend > 0.08,
    });
    if (canvas) {
      canvas.dataset.animationMode = state.animationMode;
      canvas.dataset.rig = state.rig.id || '';
      canvas.dataset.rigClip = pose.clip;
    }
    const layers = window.PetRig.boneTransformsToLayerTransforms(state.rig, pose);
    const out = new Map();
    for (const layer of layers) out.set(layer.id, layer);
    return out;
  }

  function sortedRuntimeFrames(animation) {
    return Array.isArray(animation?.keyframes)
      ? animation.keyframes.slice().sort((a, b) => num(a.time, 0) - num(b.time, 0))
      : [];
  }

  function sampleRuntimeFrame(animation, elapsedMs) {
    const frames = sortedRuntimeFrames(animation);
    if (!frames.length) return null;
    const duration = Math.max(1, num(animation.duration, 1000));
    const normalized = animation.loop === false
      ? Math.max(0, Math.min(1, elapsedMs / duration))
      : ((((elapsedMs % duration) + duration) % duration) / duration);
    if (normalized <= num(frames[0].time, 0)) return frames[0];
    if (normalized >= num(frames[frames.length - 1].time, 1)) return frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) {
      const a = frames[i];
      const b = frames[i + 1];
      const at = num(a.time, 0);
      const bt = num(b.time, 1);
      if (normalized >= at && normalized <= bt) {
        const pct = Math.max(0, Math.min(1, (normalized - at) / Math.max(0.000001, bt - at)));
        const eased = pct * pct * (3 - 2 * pct);
        const out = {};
        for (const field of FRAME_FIELDS) {
          const fallback = FRAME_DEFAULTS[field];
          out[field] = num(a[field], fallback) + (num(b[field], fallback) - num(a[field], fallback)) * eased;
        }
        return out;
      }
    }
    return frames[0];
  }

  function normalizeRuntimeFrame(frame) {
    if (!frame) return null;
    const out = {};
    for (const field of FRAME_FIELDS) out[field] = num(frame[field], FRAME_DEFAULTS[field]);
    return out;
  }

  function blendRuntimeFrames(fromFrame, toFrame, amount) {
    const from = normalizeRuntimeFrame(fromFrame);
    const to = normalizeRuntimeFrame(toFrame);
    if (!from) return to;
    if (!to) return from;
    const blend = smooth01(amount);
    const out = {};
    for (const field of FRAME_FIELDS) out[field] = from[field] + (to[field] - from[field]) * blend;
    return out;
  }

  function doubleBlinkAmount(t) {
    const phase = (((t + 1.1) % 11.5) + 11.5) % 11.5;
    const firstBlink = phase < 0.13 ? Math.sin((phase / 0.13) * Math.PI) : 0;
    const secondBlink = phase > 0.24 && phase < 0.37
      ? Math.sin(((phase - 0.24) / 0.13) * Math.PI) * 0.86
      : 0;
    return Math.max(firstBlink, secondBlink);
  }

  function automaticBlinkAmount(t) {
    const phase = (((t + 0.7) % 4.2) + 4.2) % 4.2;
    const mainBlink = phase < 0.16 ? Math.sin((phase / 0.16) * Math.PI) : 0;
    return Math.max(mainBlink, doubleBlinkAmount(t));
  }

  function applySkeletalMeshZones(mesh, frame) {
    const attr = mesh?.geometry?.attributes?.position;
    const base = mesh?.userData?.basePositions;
    const zones = state.rig?.runtime?.meshZones || null;
    if (!attr || !base || !zones || !frame) return;

    const wingLift = num(frame.wingLift, 0);
    const wingCurl = num(frame.wingCurl, 0);
    const footStride = num(frame.footStride, 0);
    const footPlant = clamp01(num(frame.footPlant, 0));
    const airborne = 1 - footPlant;
    const crestSway = num(frame.crestSway, 0);
    const blinkAmount = clamp01(num(frame.blink, 0));
    const eyeShiftX = num(frame.eyeShiftX, 0);
    const eyeShiftY = num(frame.eyeShiftY, 0);
    const arr = attr.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const y = base[i + 1];
      let dx = 0;
      let dy = 0;

      const faceGuard = Math.max(
        zoneWeight(x, y, zones.face),
        zoneWeight(x, y, zones.leftEye),
        zoneWeight(x, y, zones.rightEye),
      );

      const rawLeftWing = zoneWeight(x, y, zones.leftWing);
      const leftWing = rawLeftWing * (1 - faceGuard);
      if (leftWing) {
        const tip = zoneProgress(x, y, zones.leftWing);
        const d = hingeDelta(x, y, zones.leftWing, -wingLift * 0.42, leftWing);
        dx += d.x - leftWing * wingLift * 0.035;
        dy += d.y + leftWing * Math.max(wingLift, 0) * 0.06;
        dx += leftWing * tip * wingCurl * -0.045;
        dy += leftWing * tip * wingCurl * 0.055;
      }

      const rawRightWing = zoneWeight(x, y, zones.rightWing);
      const rightWing = rawRightWing * (1 - faceGuard);
      if (rightWing) {
        const tip = zoneProgress(x, y, zones.rightWing);
        const d = hingeDelta(x, y, zones.rightWing, wingLift * 0.42, rightWing);
        dx += d.x + rightWing * wingLift * 0.035;
        dy += d.y + rightWing * Math.max(wingLift, 0) * 0.06;
        dx += rightWing * tip * wingCurl * 0.045;
        dy += rightWing * tip * wingCurl * 0.055;
      }

      const feet = zoneWeight(x, y, zones.feet);
      if (feet) {
        const side = x < 0 ? -1 : 1;
        const lift = Math.max(0, side * footStride);
        const planted = Math.max(0, 1 - lift) * footPlant;
        dx += feet * side * footStride * 0.045;
        dy += feet * lift * 0.065;
        dx += feet * side * planted * 0.018;
        dy -= feet * planted * 0.012;
        dy += feet * airborne * 0.026;
      }

      const crest = zoneWeight(x, y, zones.crest);
      if (crest) {
        const d = hingeDelta(x, y, zones.crest, crestSway * 0.24, crest);
        dx += d.x;
        dy += d.y;
      }

      const leftEye = zoneWeight(x, y, zones.leftEye);
      if (leftEye) {
        const px = num(zones.leftEye.pivotX, -0.18);
        const py = num(zones.leftEye.pivotY, 0.17);
        dx += leftEye * eyeShiftX * EYE_LOOK_X;
        dy += leftEye * eyeShiftY * EYE_LOOK_Y;
        dx += leftEye * (x - px) * blinkAmount * EYE_BLINK_X;
        dy += leftEye * (py - y) * blinkAmount * EYE_BLINK_Y;
      }

      const rightEye = zoneWeight(x, y, zones.rightEye);
      if (rightEye) {
        const px = num(zones.rightEye.pivotX, 0.18);
        const py = num(zones.rightEye.pivotY, 0.17);
        dx += rightEye * eyeShiftX * EYE_LOOK_X;
        dy += rightEye * eyeShiftY * EYE_LOOK_Y;
        dx += rightEye * (x - px) * blinkAmount * EYE_BLINK_X;
        dy += rightEye * (py - y) * blinkAmount * EYE_BLINK_Y;
      }

      arr[i] = x + dx;
      arr[i + 1] = y + dy;
      arr[i + 2] = base[i + 2];
    }
    attr.needsUpdate = true;
  }

  function applySkeletalPlaneMotion(mesh, t, tempo, dt) {
    resetPlane(mesh);
    resetPlaneTransform(mesh);
    if (!isSkeletalRig(state.rig)) return;
    const clip = rigClipName();
    const animations = state.rig.runtime?.animations || {};
    const animation = animations[clip] || animations.idle;
    if (canvas) {
      canvas.dataset.animationMode = state.animationMode;
      canvas.dataset.rig = state.rig.id || '';
      canvas.dataset.rigClip = animation ? clip : '';
    }
    const clipElapsedMs = state.action && (animation.loop === false || clip === 'flap')
      ? state.actionT * 1000
      : t * 1000 * Math.max(tempo, 0.2);
    const sampledFrame = normalizeRuntimeFrame(sampleRuntimeFrame(animation, clipElapsedMs));
    if (state.skeletalClip !== clip) {
      if (state.skeletalFrame) {
        state.transitionFromFrame = { ...state.skeletalFrame };
        state.transitionElapsedMs = 0;
      }
      state.skeletalClip = clip;
    }
    let frame = sampledFrame ? { ...sampledFrame } : null;
    if (!frame || !mesh) return;
    if (state.transitionFromFrame) {
      state.transitionElapsedMs = Math.min(TRANSITION_BLEND_MS, state.transitionElapsedMs + Math.max(0, dt || 0) * 1000);
      const transitionBlend = clamp01(state.transitionElapsedMs / TRANSITION_BLEND_MS);
      frame = blendRuntimeFrames(state.transitionFromFrame, frame, transitionBlend);
      if (canvas) canvas.dataset.transitionBlend = transitionBlend.toFixed(3);
      if (transitionBlend >= 1) state.transitionFromFrame = null;
    } else if (canvas) {
      canvas.dataset.transitionBlend = '1.000';
    }
    frame.blink = Math.max(num(frame.blink, 0), clip === 'blink' ? 0 : automaticBlinkAmount(t));
    frame.eyeShiftX = num(frame.eyeShiftX, 0) + state.attentionLook.x;
    frame.eyeShiftY = num(frame.eyeShiftY, 0) + state.attentionLook.y;
    frame.headTilt = num(frame.headTilt, 0) + state.headTilt * 0.45;
    if (canvas) canvas.dataset.blink = frame.blink.toFixed(3);
    mesh.position.x += num(frame.x, 0);
    mesh.position.y += num(frame.y, 0);
    state.groundLift = Math.max(0, state.actionLift + num(frame.y, 0));
    state.groundContact = clamp01(num(frame.footPlant, state.moveBlend > 0.08 ? 0.55 : 1));
    if (state.groundContact < 0.28) state.wasAirborne = true;
    if (state.wasAirborne && state.groundContact > 0.82) {
      state.landingRebound = Math.max(state.landingRebound, 1);
      state.wasAirborne = false;
    }
    frame.landingRebound = Math.max(num(frame.landingRebound, 0), state.landingRebound);
    if (canvas) {
      canvas.dataset.groundLift = state.groundLift.toFixed(3);
      canvas.dataset.groundContact = state.groundContact.toFixed(3);
      canvas.dataset.landingRebound = state.landingRebound.toFixed(3);
    }
    const landingRebound = num(frame.landingRebound, 0);
    mesh.position.y += landingRebound * 0.022;
    mesh.rotation.z = num(frame.rotation, 0) + num(frame.headTilt, 0);
    const hopSquash = num(frame.hopSquash, 0);
    mesh.scale.set(
      num(frame.scaleX, 1) * (1 + hopSquash * 0.025 - landingRebound * 0.012),
      num(frame.scaleY, 1) * (1 - hopSquash * 0.018 + landingRebound * 0.02),
      1,
    );
    mesh.material.opacity = num(frame.opacity, 1);
    applySkeletalMeshZones(mesh, frame);
    state.skeletalFrame = { ...frame };
    state.landingRebound *= Math.max(0, 1 - Math.max(0, dt || 0) * 7.5);
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta(), t = clock.getElapsedTime(), tempo = state.tempo, sc = state.scale;
    const moveTarget = state.movingDir ? 1 : 0;
    state.moveBlend += (moveTarget - state.moveBlend) * Math.min(1, dt * 6);
    state.actionLift = 0;
    state.groundLift = 0;
    state.groundContact = 1;

    const attention = petAttentionFrame(t, tempo);
    const attentionStrength = (state.sleepy ? 0.42 : 1) * (state.worried ? 0.55 : 1);
    const actionCalm = state.action === 'flap' || state.action === 'fly' || state.action === 'dance' ? 0.45 : 1;
    const attentionEase = Math.min(1, dt * 2.4);
    state.attentionLook.x += (attention.attentionLook.x * attentionStrength - state.attentionLook.x) * attentionEase;
    state.attentionLook.y += (attention.attentionLook.y * attentionStrength - state.attentionLook.y) * attentionEase;
    state.headTilt += (attention.headTilt * attentionStrength * actionCalm * (1 - state.moveBlend * 0.45) - state.headTilt) * attentionEase;
    if (canvas) {
      canvas.dataset.attention = state.attentionLook.x.toFixed(3);
      canvas.dataset.headTilt = state.headTilt.toFixed(3);
    }

    root.position.x = 0;
    root.position.y = Math.sin(t * 1.7 * tempo) * state.bobAmp;
    root.scale.setScalar(sc * (1 + Math.sin(t * 1.7 * tempo) * 0.03)); // gentle breathing

    // facing: small idle yaw + cursor lean; worried = nervous shake; sleepy = droopy tilt
    const idleYaw = Math.sin(t * 0.8 * tempo) * state.yawAmp;
    root.rotation.y = (state.worried ? Math.sin(t * 7) * 0.12 : idleYaw) + state.look.x * 0.4 + state.attentionLook.x * 0.55;
    root.rotation.x = (state.sleepy ? 0.12 : 0) - state.look.y * 0.25 + state.attentionLook.y * 0.35;
    root.rotation.z = (state.sleepy ? 0.14 : 0) + state.headTilt;

    if (state.action) {
      state.actionT += dt; const p = state.actionT;
      if (state.action === 'jump') {
        const lift = Math.max(0, Math.sin((p / 0.52) * Math.PI));
        state.actionLift = lift * 0.44;
        root.position.y += state.actionLift;
        if (p > 0.52) state.action = null;
      }
      else if (state.action === 'hop') {
        const k = Math.max(0, Math.sin((p / 0.76) * Math.PI));
        state.actionLift = k * 0.28;
        root.position.y += state.actionLift;
        root.scale.multiplyScalar(1 + k * 0.08);
        if (p > 0.76) state.action = null;
      }
      else if (state.action === 'flap' || state.action === 'fly') {
        const k = Math.max(0, Math.sin((p / 0.92) * Math.PI));
        const flutter = Math.sin(p * 26) * 0.018;
        state.actionLift = 0.06 + k * 0.24 + flutter;
        root.position.y += state.actionLift;
        root.rotation.z += Math.sin(p * 9) * 0.04;
        root.scale.multiplyScalar(1 + k * 0.035);
        if (p > 0.92) state.action = null;
      }
      else if (state.action === 'pop') { root.scale.multiplyScalar(1 + Math.sin(Math.min(p / 0.4, 1) * Math.PI) * 0.28); if (p > 0.4) state.action = null; }
      else if (state.action === 'dance') { root.rotation.z += Math.sin(p * 16) * 0.2; root.position.x = Math.sin(p * 11) * 0.12; if (p > 1.3) state.action = null; }
      else if (state.action === 'tap') { if (p > 0.5) state.action = null; }
      else if (state.action === 'blink') { if (p > 0.24) state.action = null; }
      else if (state.action === 'happy') { if (p > 1.2) state.action = null; }
      else if (state.action === 'worried') { if (p > 1.0) state.action = null; }
    }

    if (state.layerMode) {
      const rigLayers = rigLayerMap(t);
      for (let i = 0; i < layerMeshes.length; i++) {
        const group = layerGroups[i];
        const mesh = layerMeshes[i];
        if (!group.visible) continue;
        const cfg = layerConfigs[i] || {};
        const pivot = cfg.pivotPlane || { x: 0, y: 0 };
        const rigMotion = rigLayers?.get(cfg.id);
        if (rigMotion) {
          group.position.x = (cfg.x || 0) + pivot.x + rigMotion.x;
          group.position.y = (cfg.y || 0) + pivot.y + rigMotion.y;
          group.position.z = (cfg.z || 0) + rigMotion.z;
          group.rotation.z = rigMotion.rotation;
          group.scale.set(
            (cfg.scale || 1) * (rigMotion.scaleX || 1),
            (cfg.scale || 1) * (rigMotion.scaleY || 1),
            (cfg.scale || 1),
          );
          mesh.material.opacity = rigMotion.opacity ?? (cfg.opacity ?? 1);
        } else {
          group.position.x = (cfg.x || 0) + pivot.x;
          group.position.y = (cfg.y || 0) + pivot.y;
          group.position.z = cfg.z || 0;
          group.rotation.z = 0;
          group.scale.setScalar(cfg.scale || 1);
          mesh.material.opacity = cfg.opacity ?? 1;
        }
        mesh.position.x = -pivot.x;
        mesh.position.y = -pivot.y;
        mesh.position.z = 0;
      }
      updateShadow(t, sc);
      renderer.render(scene, camera);
      return;
    }

    // N-pose ping-pong cross-fade. With N keyframes (N≥2) the cycle visits 0→1→...→N-1→N-2→...→1→0
    // so wings flap, tails sway, gem cores pulse through 4 (or however many) keyframes instead of 2.
    // Cross-fade adjacent frames over each transition so motion reads as continuous, not stop-motion.
    // When N=1 (egg / hatchling / juvenile) the single plane stays fully visible; everything else
    // is hidden. Cycle speed is mood-driven (flow & worried flap fast, sleepy & bored flap slow).
    const N = state.poseCount;
    if (N <= 1) {
      for (let i = 0; i < planes.length; i++) planes[i].material.opacity = (i === 0) ? 1 : 0;
      if (isSkeletalRig(state.rig)) applySkeletalPlaneMotion(planes[0], t, tempo, dt);
      else { resetPlane(planes[0]); resetPlaneTransform(planes[0]); }
    } else {
      for (let i = 0; i < planes.length; i++) { resetPlane(planes[i]); resetPlaneTransform(planes[i]); }
      const cycle = 2 * (N - 1); // ping-pong cycle length
      const cyclePhase = ((t / TRANSITION) * tempo) % cycle;
      const idx = Math.floor(cyclePhase);
      const frac = cyclePhase - idx;
      const nextIdx = (idx + 1) % cycle;
      // Ping-pong: cycle index i in [0, cycle) → pose index in [0, N).
      // 0..N-1 maps to 0..N-1; N..cycle-1 maps to N-2..1 (mirror).
      const poseAt = (i) => (i < N ? i : (cycle - i));
      const fromPose = poseAt(idx);
      const toPose = poseAt(nextIdx);
      // Zero everything, then write the two active poses. Cheap — N is small (≤MAX_POSES).
      for (let i = 0; i < planes.length; i++) planes[i].material.opacity = 0;
      if (fromPose === toPose) {
        planes[fromPose].material.opacity = 1; // degenerate (shouldn't happen for N≥2 / cycle≥2)
      } else {
        planes[fromPose].material.opacity = 1 - frac;
        planes[toPose].material.opacity = frac;
      }
    }

    updateShadow(t, sc);
    renderer.render(scene, camera);
  }

  API.init = function (cnv) {
    if (API.ready || !cnv) return;
    canvas = cnv;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 4.6); camera.lookAt(0, 0, 0);
    texLoader = new THREE.TextureLoader();
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14, depthWrite: false }));
    shadow.renderOrder = -10;
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = SHADOW_GROUND_Y; scene.add(shadow);
    root = new THREE.Group(); scene.add(root);
    // Allocate the first plane eagerly so something is visible before show() runs. Additional
    // planes (for pose2, pose3, ...) are allocated lazily when show() receives a poses array.
    getOrCreatePlane(0);
    state.poseCount = 1;
    clock = new THREE.Clock();
    resize();
    window.addEventListener('resize', resize);
    API.ready = true;
    loop();
  };

  // o = { poses: string[] (ordered data URLs for pose1, pose2, ...),
  //       imageSrc, imageSrcPose2 (legacy single-URL fallback),
  //       emoji (used when no poses at all), form }
  API.show = function (o) {
    o = o || {};
    state.scale = FORM_SCALE[o.form] || 1;
    const skeletalRig = isSkeletalRig(o.rig) ? o.rig : null;
    const hasRigLayers = !skeletalRig && o.rig && typeof o.rig === 'object' && Array.isArray(o.layers) && o.layers.length;
    if (hasRigLayers) {
      state.layerMode = true;
      state.animationMode = 'rig';
      state.rig = o.rig;
      if (canvas) {
        canvas.dataset.animationMode = state.animationMode;
        canvas.dataset.rig = state.rig?.id || '';
        canvas.dataset.rigClip = '';
      }
      state.curEmoji = o.emoji || null;
      for (let i = 0; i < planes.length; i++) { planes[i].visible = false; planes[i].material.opacity = 0; }
      const layerCanvas = o.layerCanvas || { width: 256, height: 256 };
      const N = Math.min(o.layers.length, MAX_POSES);
      for (let i = 0; i < N; i++) {
        const layer = o.layers[i] || {};
        const { group, mesh } = getOrCreateLayer(i);
        group.visible = true;
        layerConfigs[i] = {
          id: typeof layer.id === 'string' ? layer.id : `layer-${i}`,
          x: Number.isFinite(layer.x) ? layer.x : 0,
          y: Number.isFinite(layer.y) ? layer.y : 0,
          z: Number.isFinite(layer.z) ? layer.z : i * 0.018,
          scale: Number.isFinite(layer.scale) ? layer.scale : 1,
          opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1,
          sway: Number.isFinite(layer.sway) ? layer.sway : 0,
          tilt: Number.isFinite(layer.tilt) ? layer.tilt : 0,
          phase: Number.isFinite(layer.phase) ? layer.phase : i * 0.7,
          pivotPlane: normalizedPivot(layer.pivot, layerCanvas),
          motion: typeof layer.motion === 'string' ? layer.motion : 'float',
          part: typeof layer.part === 'string' ? layer.part : layer.id,
          direction: Number.isFinite(layer.direction) ? layer.direction : 1,
          clip: layer.clip && typeof layer.clip === 'object' ? layer.clip : null,
        };
        if (layerUrls[i] !== layer.src) { layerUrls[i] = layer.src; if (API.ready) loadUrlInto(layer.src, mesh); }
      }
      for (let i = N; i < layerMeshes.length; i++) {
        layerGroups[i].visible = false;
        layerMeshes[i].material.opacity = 0;
        layerUrls[i] = null;
        layerConfigs[i] = {};
      }
      state.poseCount = 0;
      return;
    }
    state.layerMode = false;
    state.rig = skeletalRig;
    if (skeletalRig) state.animationMode = skeletalRig.engine;
    else state.animationMode = typeof o.animationMode === 'string' ? o.animationMode : 'still';
    if (canvas) {
      canvas.dataset.animationMode = state.animationMode;
      canvas.dataset.rig = skeletalRig?.id || '';
      canvas.dataset.rigClip = '';
    }
    hideLayers();
    // Accept either the new poses[] array or the old imageSrc/imageSrcPose2 pair.
    let urls = Array.isArray(o.poses) ? o.poses.filter(Boolean) : [];
    if (!urls.length) {
      if (o.imageSrc) urls.push(o.imageSrc);
      else if (skeletalRig?.textureSrc) urls.push(skeletalRig.textureSrc);
      if (o.animationMode === 'poses' && o.imageSrcPose2) urls.push(o.imageSrcPose2);
    }
    if (urls.length) {
      state.curEmoji = o.emoji || null;
      // Load each URL into its plane (allocating as needed). Cap to MAX_POSES for safety.
      const N = Math.min(urls.length, MAX_POSES);
      for (let i = 0; i < N; i++) {
        const mesh = getOrCreatePlane(i);
        mesh.visible = true;
        if (planeUrls[i] !== urls[i]) { planeUrls[i] = urls[i]; if (API.ready) loadUrlInto(urls[i], mesh); }
      }
      // Hide any planes from a previous (longer) animation so they don't leak through.
      for (let i = N; i < planes.length; i++) { planes[i].visible = false; planes[i].material.opacity = 0; planeUrls[i] = null; }
      state.poseCount = N;
    } else {
      // No image — use the emoji texture on plane[0], hide the rest.
      const em = o.emoji || '🥚';
      if (em !== state.curEmoji || planeUrls[0] != null) {
        state.curEmoji = em; planeUrls[0] = null;
        if (API.ready) applyTextureTo(getOrCreatePlane(0), emojiTexture(em));
      }
      for (let i = 1; i < planes.length; i++) { planes[i].visible = false; planes[i].material.opacity = 0; planeUrls[i] = null; }
      resetPlane(getOrCreatePlane(0));
      state.poseCount = 1;
    }
  };
  API.setMood = function (expr) {
    state.tempo  = MOOD_TEMPO[expr] || 1;
    state.bobAmp = MOOD_BOB[expr]   || 0.06;
    state.yawAmp = MOOD_YAW[expr]   || 0.13;
    state.worried = expr === 'worried';
    state.sleepy  = expr === 'sleepy' || expr === 'bored';
  };
  API.playAction = function (name) { state.action = name; state.actionT = 0; };
  API.setMoving = function (dir) { state.movingDir = dir < 0 ? -1 : (dir > 0 ? 1 : 0); };
  API.setLook = function (x, y) { state.look.x = Math.max(-1, Math.min(1, x)); state.look.y = Math.max(-1, Math.min(1, y)); };
  API.react = function (type) {
    if (type === 'levelup' || type === 'evolve') API.playAction('hop');
    else if (type === 'feat' || type === 'feed') API.playAction('hop');
    else if (type === 'failure') API.playAction('worried');
  };
})();
