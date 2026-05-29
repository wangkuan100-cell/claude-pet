/* Real-3D pet rendered with three.js (loaded as the global THREE via vendor/three.min.js).
 * The engine/state code is untouched; this only draws what paint() tells it to.
 * Exposes window.Pet3D = { init, ready, setForm, setMood, playAction, setLook, react, blink }. */
(function () {
  const THREE = window.THREE;
  const API = { ready: false };
  window.Pet3D = API;
  if (!THREE) return; // graceful fallback: pet.js keeps the 2D sprite

  // Per-line identity: body color, accent, and a procedural "topper" feature.
  const LINE = {
    phoenix:  { body: 0xff8a3d, accent: 0xffd27f, feature: 'crest' },
    dragon:   { body: 0x49c06a, accent: 0xe6e36b, feature: 'horns' },
    kitsune:  { body: 0xf3ece1, accent: 0xff9ec7, feature: 'ears' },
    cerberus: { body: 0x5b5670, accent: 0xff5a4d, feature: 'spikes' },
    sphinx:   { body: 0xe2c074, accent: 0x6ad0ff, feature: 'headdress' },
    golem:    { body: 0x8aa0b5, accent: 0x9fe6ff, feature: 'crystal' },
  };
  const FORM_SCALE = { egg: 0.78, hatchling: 0.86, juvenile: 0.98, adolescent: 1.12, adult: 1.28, legendary: 1.45 };
  const MOOD_TEMPO = { flow: 1.8, happy: 1.3, normal: 1.0, sleepy: 0.45, bored: 0.35, worried: 1.5 };

  let canvas, renderer, scene, camera, clock;
  let root;          // bobs/rotates (the whole pet)
  let creature;      // swapped when the form changes
  let shadow;        // fake contact shadow on the ground
  let eyes = [];     // [{group, baseScaleY}] for blink
  const state = {
    line: null, form: 'egg', tempo: 1.0, worried: false,
    blinkAt: 1.2, action: null, actionT: 0, look: { x: 0, y: 0 },
  };

  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.05 }, opts || {}));
  }
  function disposeTree(obj) {
    obj.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose());
    });
  }

  function buildEgg() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 24), mat(0xf1e9d6, { roughness: 0.7 }));
    shell.scale.set(0.82, 1.05, 0.82);
    g.add(shell);
    const speck = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), mat(0xe7d9bd, { roughness: 0.8 }));
    speck.scale.set(0.84, 0.6, 0.84); speck.position.y = -0.18;
    g.add(speck);
    eyes = [];
    return g;
  }

  function buildEye(side) {
    const grp = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), mat(0xffffff, { roughness: 0.3 }));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat(0x222633, { roughness: 0.2 }));
    pupil.position.z = 0.12;
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.04, 0.05, 0.18);
    grp.add(white, pupil, glint);
    grp.position.set(side * 0.3, 0.16, 0.74);
    return grp;
  }

  function addFeature(g, kind, accent, body) {
    const cone = (r, h, c) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat(c));
    if (kind === 'horns') {
      for (const s of [-1, 1]) { const m = cone(0.12, 0.34, accent); m.position.set(s * 0.28, 0.86, -0.05); m.rotation.z = -s * 0.5; g.add(m); }
    } else if (kind === 'ears') {
      for (const s of [-1, 1]) { const m = cone(0.16, 0.42, body); m.position.set(s * 0.34, 0.9, 0); m.rotation.z = -s * 0.25; g.add(m); const inr = cone(0.08, 0.24, accent); inr.position.set(s * 0.34, 0.92, 0.05); inr.rotation.z = -s * 0.25; g.add(inr); }
    } else if (kind === 'crest') {
      for (let i = -1; i <= 1; i++) { const m = cone(0.1, 0.3 + Math.abs(i === 0 ? 0.18 : 0), i === 0 ? accent : 0xff6a2c); m.position.set(i * 0.2, 0.92, -0.1); m.rotation.z = i * 0.3; g.add(m); }
    } else if (kind === 'spikes') {
      for (const x of [-0.26, 0, 0.26]) { const m = cone(0.09, 0.26, accent); m.position.set(x, 0.88, 0); g.add(m); }
    } else if (kind === 'headdress') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 12, 28), mat(accent, { metalness: 0.4, roughness: 0.3 }));
      band.rotation.x = Math.PI / 2; band.position.y = 0.5; band.scale.set(1, 1, 0.5); g.add(band);
    } else if (kind === 'crystal') {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat(accent, { metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.9 }));
      c.position.y = 1.04; g.add(c); c.userData.spin = true;
    }
  }

  function buildCreature(lineId) {
    const g = new THREE.Group();
    const s = LINE[lineId] || LINE.phoenix;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 36, 28), mat(s.body));
    body.scale.set(1, 0.92, 0.92);
    g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 22), mat(lighten(s.body, 0.35), { roughness: 0.6 }));
    belly.scale.set(0.8, 0.7, 0.5); belly.position.set(0, -0.16, 0.52);
    g.add(belly);
    const eL = buildEye(-1), eR = buildEye(1);
    g.add(eL, eR);
    eyes = [{ g: eL, sy: eL.scale.y }, { g: eR, sy: eR.scale.y }];
    // little feet
    for (const x of [-0.34, 0.34]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(lighten(s.body, -0.1))); f.scale.set(1, 0.6, 1.1); f.position.set(x, -0.82, 0.18); g.add(f); }
    addFeature(g, s.feature, s.accent, s.body);
    return g;
  }

  function lighten(hex, amt) {
    const c = new THREE.Color(hex);
    if (amt >= 0) c.lerp(new THREE.Color(0xffffff), amt); else c.lerp(new THREE.Color(0x000000), -amt);
    return c.getHex();
  }

  function setCreature() {
    if (creature) { root.remove(creature); disposeTree(creature); }
    creature = state.line ? buildCreature(state.line) : buildEgg();
    root.add(creature);
    const sc = FORM_SCALE[state.form] || 1;
    root.scale.setScalar(sc);
    if (shadow) shadow.scale.setScalar(sc);
  }

  function resize() {
    if (!renderer || !canvas) return;
    const w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();
    const tempo = state.tempo;

    // idle: vertical bob + gentle 3D yaw, plus a worried side-sway
    root.position.y = Math.sin(t * 1.7 * tempo) * 0.06;
    const baseYaw = Math.sin(t * 0.9 * tempo) * 0.28 + state.look.x * 0.5;
    root.rotation.y = state.worried ? Math.sin(t * 6) * 0.18 : baseYaw;
    root.rotation.x = (-0.04 + Math.sin(t * 1.7 * tempo) * 0.03) + state.look.y * 0.25;

    // blink
    state.blinkAt -= dt;
    let blink = 1;
    if (state.blinkAt < 0.12) { blink = Math.max(0.08, Math.abs(state.blinkAt) / 0.12); if (state.blinkAt < -0.06) state.blinkAt = 2 + Math.random() * 3; }
    for (const e of eyes) e.g.scale.y = e.sy * (state.worried ? 0.6 : blink);

    // one-shot actions (jump / spin / dance)
    if (state.action) {
      state.actionT += dt;
      const p = state.actionT;
      if (state.action === 'jump') { root.position.y += Math.max(0, Math.sin(p * Math.PI / 0.5)) * 0.5; if (p > 0.5) state.action = null; }
      else if (state.action === 'spin') { root.rotation.y = p * Math.PI * 4; if (p > 0.5) state.action = null; }
      else if (state.action === 'dance') { root.rotation.z = Math.sin(p * 14) * 0.2; root.position.x = Math.sin(p * 10) * 0.15; if (p > 1.4) { root.rotation.z = 0; root.position.x = 0; state.action = null; } }
    }

    // spin any crystal feature
    if (creature) creature.traverse((n) => { if (n.userData && n.userData.spin) n.rotation.y += dt * 1.5; });

    renderer.render(scene, camera);
  }

  API.init = function (cnv) {
    if (API.ready || !cnv) return;
    canvas = cnv;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) { return; } // no WebGL → stay not-ready, 2D fallback wins
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 4.4);
    camera.lookAt(0, 0.05, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(2.5, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x99ccff, 0.5); rim.position.set(-3, 1.5, -2); scene.add(rim);
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.0; scene.add(shadow);
    root = new THREE.Group(); scene.add(root);
    clock = new THREE.Clock();
    setCreature();
    resize();
    window.addEventListener('resize', resize);
    API.ready = true;
    loop();
  };

  API.setForm = function (line, form) {
    const l = line || null, f = form || 'egg';
    if (l === state.line && f === state.form) return;
    state.line = l; state.form = f;
    if (API.ready) setCreature();
  };
  API.setMood = function (expr) {
    state.tempo = MOOD_TEMPO[expr] || 1.0;
    state.worried = expr === 'worried';
  };
  API.playAction = function (name) { state.action = name; state.actionT = 0; };
  API.setLook = function (x, y) { state.look.x = Math.max(-1, Math.min(1, x)); state.look.y = Math.max(-1, Math.min(1, y)); };
  API.react = function (type) {
    if (type === 'levelup' || type === 'evolve') API.playAction('spin');
    else if (type === 'feat' || type === 'feed') API.playAction('jump');
    else if (type === 'failure') API.playAction('dance'); // brief shake stands in for a fret
  };
})();
