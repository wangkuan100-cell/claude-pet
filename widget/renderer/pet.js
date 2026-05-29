(function () {
  const $ = (id) => document.getElementById(id);
  let panelOpen = false;

  function paint(data) {
    const adopt = $('adopt'), pet = $('pet');
    if (!data || data.mode === 'adopt') {
      adopt.classList.remove('hidden');
      pet.classList.add('hidden');
      renderSpecies((data && data.lines) || []);
      return;
    }
    adopt.classList.add('hidden');
    pet.classList.remove('hidden');

    const img = $('sprite-img'), base = $('sprite-base');
    if (data.sprite.imageSrc) {
      img.src = data.sprite.imageSrc; img.classList.remove('hidden'); base.classList.add('hidden');
    } else {
      img.classList.add('hidden'); base.classList.remove('hidden');
      base.textContent = data.sprite.base;
      base.style.transform = `scale(${data.sprite.scale})`;
    }
    $('sprite-expr').textContent = data.sprite.expr || '';
    $('sprite').classList.toggle('worried', data.expression === 'worried');

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
    if (ev && ev.evolved) evolve(ev.newStage);
    else if (ev && ev.leveledUp) celebrate(`Lv ${ev.newLevel}!`);
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

  function renderSpecies(list) {
    const grid = $('species-grid');
    if (grid.childElementCount) return;
    for (const line of list) {
      const b = document.createElement('button');
      b.className = 'species-btn';
      b.textContent = line.emoji || '🐾';
      b.title = line.name || line.id;
      b.onclick = () => window.api && window.api.adopt(line.id);
      grid.appendChild(b);
    }
  }

  $('sprite').addEventListener('click', () => {
    panelOpen = !panelOpen;
    $('panel').classList.toggle('hidden', !panelOpen);
  });

  // Capture the mouse only while the pointer is over real UI; otherwise clicks pass through.
  (function wireInteractive() {
    const set = (on) => window.api && window.api.setInteractive(on);
    for (const sel of ['#sprite', '#panel', '#adopt', '#bubble', '#toast']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.addEventListener('mouseenter', () => set(true));
      el.addEventListener('mouseleave', () => set(false));
    }
  })();

  if (window.api) {
    window.api.onPaint(paint);
    window.api.requestPaint();
  } else if (window.__FIXTURE__) {
    paint(window.__FIXTURE__);
  }
  window.__paint = paint;
})();
