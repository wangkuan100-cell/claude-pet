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
  const MOOD_TEMPO = { flow: 1.9, happy: 1.35, normal: 1.0, sleepy: 0.45, bored: 0.35, worried: 1.6 };

  let canvas, renderer, scene, camera, clock, texLoader;
  let root, plane, shadow;
  const state = {
    tempo: 1, worried: false, sleepy: false,
    action: null, actionT: 0, look: { x: 0, y: 0 }, scale: 1,
    curUrl: null, curEmoji: null,
  };

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

  function applyTexture(tex) {
    if (!plane) return;
    tex.anisotropy = 4;
    const old = plane.material.map;
    plane.material.map = tex;
    plane.material.needsUpdate = true;
    if (old && old !== tex) old.dispose();
  }

  function loadUrl(url) {
    texLoader.load(
      url,
      (tex) => { tex.encoding = THREE.sRGBEncoding; applyTexture(tex); },
      undefined,
      () => applyTexture(emojiTexture(state.curEmoji || '🥚')), // load error → emoji
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
    root.position.y = Math.sin(t * 1.7 * tempo) * 0.06;
    root.scale.setScalar(sc * (1 + Math.sin(t * 1.7 * tempo) * 0.03)); // gentle breathing

    // facing: small idle yaw + cursor lean; worried = nervous shake; sleepy = droopy tilt
    const idleYaw = Math.sin(t * 0.8 * tempo) * 0.13;
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
    plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: emojiTexture('🥚'), transparent: true, alphaTest: 0.06, depthWrite: false }),
    );
    root.add(plane);
    clock = new THREE.Clock();
    resize();
    window.addEventListener('resize', resize);
    API.ready = true;
    loop();
  };

  // o = { imageSrc (data URL or http), emoji (fallback glyph), form }
  API.show = function (o) {
    o = o || {};
    state.scale = FORM_SCALE[o.form] || 1;
    if (o.imageSrc) {
      if (o.imageSrc !== state.curUrl) { state.curUrl = o.imageSrc; state.curEmoji = o.emoji || null; if (API.ready) loadUrl(o.imageSrc); }
    } else {
      const em = o.emoji || '🥚';
      if (em !== state.curEmoji || state.curUrl) { state.curEmoji = em; state.curUrl = null; if (API.ready) applyTexture(emojiTexture(em)); }
    }
  };
  API.setMood = function (expr) {
    state.tempo = MOOD_TEMPO[expr] || 1;
    state.worried = expr === 'worried';
    state.sleepy = expr === 'sleepy' || expr === 'bored';
  };
  API.playAction = function (name) { state.action = name; state.actionT = 0; };
  API.setLook = function (x, y) { state.look.x = Math.max(-1, Math.min(1, x)); state.look.y = Math.max(-1, Math.min(1, y)); };
  API.react = function (type) {
    if (type === 'levelup' || type === 'evolve') API.playAction('pop');
    else if (type === 'feat' || type === 'feed') API.playAction('jump');
    else if (type === 'failure') API.playAction('dance');
  };
})();
