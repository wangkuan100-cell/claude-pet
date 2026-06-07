(function () {
  const $ = (id) => document.getElementById(id);
  let panelOpen = false;
  let drag = null;
  let clickTimer = null;
  let use3D = false;
  let useLive2D = false;
  let live2dModelUrl = null;
  let live2dFailedUrl = null;
  let lastData = null;

  function live2dPayload(data) {
    const model = data && data.sprite && data.sprite.live2d;
    if (!model || !model.url || !window.PetLive2D) return null;
    return {
      modelUrl: model.url,
      motions: Array.isArray(model.motions) ? model.motions : [],
      hasPhysics: !!model.hasPhysics,
      level: data.panel ? data.panel.level : 1,
      expression: data.expression || 'normal',
    };
  }

  function deactivateLive2D() {
    if (!useLive2D && !live2dModelUrl) return;
    useLive2D = false;
    live2dModelUrl = null;
    const l = $('live2d'); if (l) l.style.display = 'none';
    const c = $('stage3d'); if (c) c.style.display = use3D ? 'block' : 'none';
    const st = $('sprite-stage'); if (st) st.style.display = use3D ? 'none' : 'block';
  }

  function activateLive2D(payload) {
    if (!payload || payload.modelUrl === live2dFailedUrl) return false;
    if (useLive2D && window.PetLive2D.ready && live2dModelUrl === payload.modelUrl) return true;
    window.PetLive2D.init($('live2d'), {
      modelUrl: payload.modelUrl,
      onReady: () => {
        useLive2D = true;
        live2dModelUrl = payload.modelUrl;
        const l = $('live2d'); if (l) l.style.display = 'block';
        const c = $('stage3d'); if (c) c.style.display = 'none';
        const st = $('sprite-stage'); if (st) st.style.display = 'none';
        setTimeout(() => { if (lastData) paint(lastData); }, 0);
      },
      onFail: () => {
        live2dFailedUrl = payload.modelUrl;
        deactivateLive2D();
      },
    });
    return !!window.PetLive2D.ready;
  }

  function paint(data) {
    const pet = $('pet');
    if (!data) { ensureParticles(false); return; }
    pet.classList.remove('hidden');
    lastData = data;

    const live2d = live2dPayload(data);
    if (!live2d) deactivateLive2D();
    if (live2d && activateLive2D(live2d)) {
      window.PetLive2D.show(live2d);
      window.PetLive2D.setMood(data.expression || 'normal');
    } else if (use3D) {
      const key = (data.sprite && data.sprite.key) || 'egg';
      const form = (key !== 'egg' && key.indexOf('/') > -1) ? key.split('/')[1] : 'egg';
      const rig = data.sprite.rig && typeof data.sprite.rig === 'object' ? data.sprite.rig : null;
      const skeletalRig = rig && (rig.engine === 'dragonbones' || rig.engine === 'loongbones');
      const rigLayers = rig && !skeletalRig && Array.isArray(data.sprite.layers) ? data.sprite.layers : null;
      window.Pet3D.show({
        // Split layers are only for real keyed rigs; older layer-only payloads fall back to the stable PNG.
        poses: Array.isArray(data.sprite.poses) ? data.sprite.poses : null,
        layers: rigLayers,
        layerCanvas: rigLayers ? (data.sprite.layerCanvas || null) : null,
        rig,
        animationMode: data.sprite.animationMode || null,
        imageSrc: data.sprite.imageSrc || null,
        imageSrcPose2: data.sprite.animationMode === 'poses' ? (data.sprite.imageSrcPose2 || null) : null,
        emoji: data.sprite.base || '🥚',
        form,
      });
      window.Pet3D.setMood(data.expression || 'normal');
    } else {
      const img = $('sprite-img'), img2 = $('sprite-img2'), base = $('sprite-base');
      if (data.sprite.imageSrc) {
        img.src = data.sprite.imageSrc; img.classList.remove('hidden'); base.classList.add('hidden');
        if (data.sprite.animationMode === 'poses' && data.sprite.imageSrcPose2) {
          img2.src = data.sprite.imageSrcPose2; img2.classList.remove('hidden');
          img.classList.add('frame-a'); img2.classList.add('frame-b');
        } else {
          img2.src = '';
          img2.classList.add('hidden');
          img.classList.remove('frame-a');
          img2.classList.remove('frame-b');
        }
      } else {
        img.classList.add('hidden'); img2.classList.add('hidden'); base.classList.remove('hidden');
        img.classList.remove('frame-a'); img2.classList.remove('frame-b');
        base.textContent = data.sprite.base;
        base.style.transform = `scale(${data.sprite.scale})`;
      }
      $('sprite-stage').className = 'mood-' + (data.expression || 'normal');
    }
    ensureParticles(true);

    const bubble = $('bubble');
    if (data.bubble) {
      bubble.textContent = `${data.bubble.emoji} ${data.bubble.text}`;
      bubble.classList.remove('hidden');
      bubble.classList.toggle('bubble-empathy', data.bubble.kind === 'empathy');
    } else {
      bubble.classList.add('hidden');
    }

    const p = data.panel;
    $('panel-name').textContent = `${p.name} · Lv ${p.level} (${p.stage})`;
    $('panel-level').textContent = `xp ${p.xp} · 距下一级 ${p.xpToNext}`;
    $('xpfill').style.width = `${p.xpPct}%`;
    $('panel-mood').textContent = `心情 ${p.mood}`;
    $('panel-project').textContent = p.project
      ? `项目 ${p.project.repo || '—'} · 上下文 ${p.project.contextPct ?? '—'}% · $${p.project.cost}`
      : '没有活跃项目';
    $('panel-ach').textContent = p.achievements.length ? `成就: ${p.achievements.join(', ')}` : '还没有成就';
    $('panel').classList.toggle('hidden', !panelOpen);

    // Animate transitions main computed for us.
    const ev = data.events;
    const react = (t) => { if (useLive2D) window.PetLive2D.react(t); else if (use3D) window.Pet3D.react(t); };
    if (ev && ev.evolved) { react('evolve'); evolve(ev.newStage); }
    else if (ev && ev.leveledUp) { react('levelup'); celebrate(`Lv ${ev.newLevel}!`); }
    else if (ev && ev.newAchievements && ev.newAchievements.length) toast(`🏆 ${ev.newAchievements[0]}`);
  }

  function celebrate(label) {
    const c = $('celebrate'), s = $('sprite');
    c.classList.remove('hidden', 'show'); void c.offsetWidth; c.classList.add('show');
    s.classList.remove('celebrate'); void s.offsetWidth; s.classList.add('celebrate');
    toast(label);
  }

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden', 'show'); void t.offsetWidth; t.classList.add('show');
  }

  function evolve(stage) {
    const c = $('celebrate'), app = $('app');
    c.textContent = '✨'; c.classList.remove('hidden', 'show'); void c.offsetWidth; c.classList.add('show');
    app.classList.remove('evolving'); void app.offsetWidth; app.classList.add('evolving');
    toast(`进化! → ${stage}`);
    setTimeout(() => { c.textContent = '🎉'; }, 1500);
  }

  let particleTimer = null;
  function spawnParticle() {
    const layer = $('particles');
    if (!layer) return;
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = Math.random() < 0.5 ? '✨' : '·';
    p.style.left = (15 + Math.random() * 70) + '%';
    p.style.animationDuration = (1.8 + Math.random() * 1.2) + 's';
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3200);
  }
  function ensureParticles(on) {
    if (on && !particleTimer) particleTimer = setInterval(spawnParticle, 850);
    if (!on && particleTimer) { clearInterval(particleTimer); particleTimer = null; const l = $('particles'); if (l) l.innerHTML = ''; }
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    $('panel').classList.toggle('hidden', !panelOpen);
    const st = $('sprite-stage');
    if (st) { st.classList.add('pop'); setTimeout(() => st.classList.remove('pop'), 320); }
  }

  // Drag the pet to move the window; a press that doesn't move is a click → toggle the panel.
  // Left button only — right-click is reserved for the context menu (below).
  $('sprite').addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    drag = { sx: e.screenX, sy: e.screenY, moved: false };
    if (window.api) window.api.dragStart({ sx: e.screenX, sy: e.screenY });
    e.preventDefault();
  });

  // Right-click the pet → native feature-toggle menu (handled in main).
  $('sprite').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.api && window.api.contextMenu) window.api.contextMenu();
  });
  document.addEventListener('mousemove', (e) => {
    if (!drag) return;
    if (Math.abs(e.screenX - drag.sx) + Math.abs(e.screenY - drag.sy) > 4) drag.moved = true;
    if (drag.moved && window.api) window.api.dragMove({ sx: e.screenX, sy: e.screenY });
  });
  document.addEventListener('mouseup', () => {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    if (window.api) window.api.dragEnd();
    if (!wasDrag) handleClick();
  });

  // Live2D eye/head tracking: look toward the cursor while it's over the pet.
  document.addEventListener('mousemove', (e) => {
    if (!useLive2D || !window.PetLive2D) return;
    const l = $('live2d'); if (!l) return;
    const r = l.getBoundingClientRect();
    window.PetLive2D.focus(e.clientX - r.left, e.clientY - r.top);
  });

  // Single click → panel (after a short delay); a 2nd click within 280ms → double-click → feed.
  function handleClick() {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; feed(); }
    else { clickTimer = setTimeout(() => { clickTimer = null; togglePanel(); }, 280); }
  }
  function feed() {
    if (window.api) window.api.feed();
    if (useLive2D && window.PetLive2D) window.PetLive2D.react('feed');
    else if (use3D && window.Pet3D) window.Pet3D.react('feed');
    const st = $('sprite-stage');
    if (st) { st.classList.remove('eat'); void st.offsetWidth; st.classList.add('eat'); setTimeout(() => st.classList.remove('eat'), 640); }
    for (let i = 0; i < 3; i++) spawnHeart();
  }
  function spawnHeart() {
    const layer = $('particles');
    if (!layer) return;
    const h = document.createElement('div');
    h.className = 'particle heart';
    h.textContent = Math.random() < 0.5 ? '❤️' : '😋';
    h.style.left = (30 + Math.random() * 40) + '%';
    layer.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
  function walk(dir) {
    const st = $('sprite-stage');
    if (st) st.classList.toggle('walking', dir !== 0);
    if (use3D && window.Pet3D && window.Pet3D.setMoving) window.Pet3D.setMoving(dir);
  }
  function hop() {
    const st = $('sprite-stage');
    if (!st) return;
    st.classList.remove('hopping'); void st.offsetWidth; st.classList.add('hopping');
    setTimeout(() => st.classList.remove('hopping'), 620);
    if (use3D && window.Pet3D && window.Pet3D.playAction) window.Pet3D.playAction('hop');
  }

  // Capture the mouse only while the pointer is over real UI; otherwise clicks pass through.
  (function wireInteractive() {
    const set = (on) => window.api && window.api.setInteractive(on);
    for (const sel of ['#sprite', '#panel', '#bubble', '#toast']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.addEventListener('mouseenter', () => set(true));
      el.addEventListener('mouseleave', () => { if (!drag) set(false); });
    }
  })();

  // Initialize the real-3D pet; fall back to the 2D sprite if WebGL/three.js is unavailable.
  if (window.Pet3D) {
    window.Pet3D.init($('stage3d'));
    if (window.Pet3D.ready) { use3D = true; const st = $('sprite-stage'); if (st) st.style.display = 'none'; }
    else { const c = $('stage3d'); if (c) c.style.display = 'none'; }
  } else { const c = $('stage3d'); if (c) c.style.display = 'none'; }

  // Live2D can still be forced for manual experiments, but production mode initializes lazily
  // from sprite.live2d only when a local model exists.
  if (window.PetLive2D && window.__LIVE2D__ && window.__LIVE2D_MODEL__) {
    window.PetLive2D.init($('live2d'), {
      modelUrl: window.__LIVE2D_MODEL__,
      onReady: () => {
        useLive2D = true;
        live2dModelUrl = window.__LIVE2D_MODEL__;
        const l = $('live2d'); if (l) l.style.display = 'block';
        const c = $('stage3d'); if (c) c.style.display = 'none';
        const st = $('sprite-stage'); if (st) st.style.display = 'none';
        if (lastData) paint(lastData);
      },
    });
  }

  if (window.api) {
    window.api.onPaint(paint);
    window.api.requestPaint();
    if (window.api.onWalk) window.api.onWalk(walk);
    if (window.api.onHop) window.api.onHop(hop);
  } else if (window.__FIXTURE__) {
    paint(window.__FIXTURE__);
  }
  window.__paint = paint;
})();
