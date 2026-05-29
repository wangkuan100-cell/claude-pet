(function () {
  const $ = (id) => document.getElementById(id);
  let panelOpen = false;
  let drag = null;
  let clickTimer = null;
  let use3D = false;
  let useLive2D = false;
  let lastData = null;

  function paint(data) {
    const pet = $('pet');
    if (!data) { ensureParticles(false); return; }
    pet.classList.remove('hidden');
    lastData = data;

    if (useLive2D) {
      window.PetLive2D.show({ level: data.panel ? data.panel.level : 1 });
      window.PetLive2D.setMood(data.expression || 'normal');
    } else if (use3D) {
      const key = (data.sprite && data.sprite.key) || 'egg';
      const form = (key !== 'egg' && key.indexOf('/') > -1) ? key.split('/')[1] : 'egg';
      window.Pet3D.show({ imageSrc: data.sprite.imageSrc || null, emoji: data.sprite.base || '🥚', form });
      window.Pet3D.setMood(data.expression || 'normal');
    } else {
      const img = $('sprite-img'), base = $('sprite-base');
      if (data.sprite.imageSrc) {
        img.src = data.sprite.imageSrc; img.classList.remove('hidden'); base.classList.add('hidden');
      } else {
        img.classList.add('hidden'); base.classList.remove('hidden');
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

  // Prefer Live2D when it loads (from CDN; needs internet). Until/unless it's ready the 3D/2D pet
  // shows; on success we switch to it.
  if (window.PetLive2D) {
    window.PetLive2D.init($('live2d'), {
      onReady: () => {
        useLive2D = true;
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
  } else if (window.__FIXTURE__) {
    paint(window.__FIXTURE__);
  }
  window.__paint = paint;
})();
