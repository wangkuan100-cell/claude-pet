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

  let canvas, renderer, scene, camera, clock, texLoader;
  let root, plane, plane2, shadow;
  const state = {
    tempo: 1, bobAmp: 0.06, yawAmp: 0.13,
    worried: false, sleepy: false,
    action: null, actionT: 0, look: { x: 0, y: 0 }, scale: 1,
    curUrl: null, curUrl2: null, curEmoji: null, hasPose2: false,
  };
  // Cross-fade period for pose1 ↔ pose2 (seconds). Matches the 2D fallback CSS keyframes.
  const POSE_PERIOD = 0.85;

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

  function resize() {
    if (!renderer || !canvas) return;
    const w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta(), t = clock.getElapsedTime(), tempo = state.tempo, sc = state.scale;

    root.position.x = 0;
    root.position.y = Math.sin(t * 1.7 * tempo) * state.bobAmp;
    root.scale.setScalar(sc * (1 + Math.sin(t * 1.7 * tempo) * 0.03)); // gentle breathing

    // facing: small idle yaw + cursor lean; worried = nervous shake; sleepy = droopy tilt
    const idleYaw = Math.sin(t * 0.8 * tempo) * state.yawAmp;
    root.rotation.y = (state.worried ? Math.sin(t * 7) * 0.12 : idleYaw) + state.look.x * 0.4;
    root.rotation.x = (state.sleepy ? 0.12 : 0) - state.look.y * 0.25;
    root.rotation.z = state.sleepy ? 0.14 : 0;

    if (state.action) {
      state.actionT += dt; const p = state.actionT;
      if (state.action === 'jump') { root.position.y += Math.max(0, Math.sin((p / 0.45) * Math.PI)) * 0.5; if (p > 0.45) state.action = null; }
      else if (state.action === 'pop') { root.scale.multiplyScalar(1 + Math.sin(Math.min(p / 0.4, 1) * Math.PI) * 0.28); if (p > 0.4) state.action = null; }
      else if (state.action === 'dance') { root.rotation.z += Math.sin(p * 16) * 0.2; root.position.x = Math.sin(p * 11) * 0.12; if (p > 1.3) state.action = null; }
    }

    shadow.scale.setScalar(sc * (1 + Math.sin(t * 1.7 * tempo) * 0.05));

    // Pose1 ↔ pose2 cross-fade for wing/tail/core motion. Cycle speed is mood-driven via tempo
    // (flow & worried flap fast, sleepy & bored flap slow, matching the idle bob tempo). When no
    // pose2 is loaded the second plane is hidden, so plane1 stays fully visible and nothing flickers.
    if (state.hasPose2) {
      const phase = (t / POSE_PERIOD) * tempo * Math.PI * 2;
      const a = 0.5 + 0.5 * Math.cos(phase); // 1 → 0 → 1 sine
      plane.material.opacity = a;
      plane2.material.opacity = 1 - a;
    } else if (plane.material.opacity !== 1) {
      plane.material.opacity = 1;
    }

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
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.12; scene.add(shadow);
    root = new THREE.Group(); scene.add(root);
    const geo = new THREE.PlaneGeometry(2, 2);
    plane = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: emojiTexture('🥚'), transparent: true, alphaTest: 0.06, depthWrite: false }),
    );
    root.add(plane);
    // Second plane for pose2 (wings flap / tails sway). Hidden until show() supplies imageSrcPose2.
    plane2 = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: emojiTexture('🥚'), transparent: true, alphaTest: 0.06, depthWrite: false, opacity: 0 }),
    );
    plane2.position.z = 0.002; // tiny offset to enforce draw order (drawn after plane)
    plane2.visible = false;
    root.add(plane2);
    clock = new THREE.Clock();
    resize();
    window.addEventListener('resize', resize);
    API.ready = true;
    loop();
  };

  // o = { imageSrc (data URL or http), imageSrcPose2 (optional second frame), emoji, form }
  API.show = function (o) {
    o = o || {};
    state.scale = FORM_SCALE[o.form] || 1;
    if (o.imageSrc) {
      if (o.imageSrc !== state.curUrl) { state.curUrl = o.imageSrc; state.curEmoji = o.emoji || null; if (API.ready) loadUrlInto(o.imageSrc, plane); }
    } else {
      const em = o.emoji || '🥚';
      if (em !== state.curEmoji || state.curUrl) { state.curEmoji = em; state.curUrl = null; if (API.ready) applyTextureTo(plane, emojiTexture(em)); }
    }
    // Optional second pose: when present, load into plane2 and enable the cross-fade.
    if (o.imageSrcPose2) {
      if (o.imageSrcPose2 !== state.curUrl2) { state.curUrl2 = o.imageSrcPose2; if (API.ready) loadUrlInto(o.imageSrcPose2, plane2); }
      state.hasPose2 = true; if (plane2) plane2.visible = true;
    } else {
      state.curUrl2 = null; state.hasPose2 = false; if (plane2) plane2.visible = false;
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
  API.setLook = function (x, y) { state.look.x = Math.max(-1, Math.min(1, x)); state.look.y = Math.max(-1, Math.min(1, y)); };
  API.react = function (type) {
    if (type === 'levelup' || type === 'evolve') API.playAction('pop');
    else if (type === 'feat' || type === 'feed') API.playAction('jump');
    else if (type === 'failure') API.playAction('dance');
  };
})();
