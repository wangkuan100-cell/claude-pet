(function () {
  const $ = (id) => document.getElementById(id);
  let panelOpen = false;

  function paint(data) {
    const adopt = $('adopt'), pet = $('pet');
    if (!data || data.mode === 'adopt') {
      adopt.classList.remove('hidden');
      pet.classList.add('hidden');
      renderSpecies((data && data.species) || []);
      return;
    }
    adopt.classList.add('hidden');
    pet.classList.remove('hidden');

    $('sprite-base').textContent = data.sprite.base;
    $('sprite-base').style.transform = `scale(${data.sprite.scale})`;
    $('sprite-expr').textContent = data.sprite.expr || '';

    const bubble = $('bubble');
    if (data.bubble) {
      bubble.textContent = `${data.bubble.emoji} ${data.bubble.text}`;
      bubble.classList.remove('hidden');
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
  }

  function renderSpecies(list) {
    const grid = $('species-grid');
    if (grid.childElementCount) return; // build once
    const EMOJI = { cat: '🐱', dog: '🐶', dragon: '🐉', slime: '🟢', bird: '🐦', fox: '🦊' };
    for (const sp of list) {
      const b = document.createElement('button');
      b.className = 'species-btn';
      b.textContent = EMOJI[sp] || '🐾';
      b.title = sp;
      b.onclick = () => window.api && window.api.adopt(sp);
      grid.appendChild(b);
    }
  }

  $('sprite').addEventListener('click', () => {
    panelOpen = !panelOpen;
    $('panel').classList.toggle('hidden', !panelOpen);
  });

  if (window.api) {
    window.api.onPaint(paint);
    window.api.requestPaint();
  } else if (window.__FIXTURE__) {
    paint(window.__FIXTURE__); // browser/preview fixture mode
  }
  window.__paint = paint; // exposed for preview-driven testing
})();
