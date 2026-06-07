/* Live2D pet runtime for local Cubism 3/4 model3.json assets.
 *
 * Cubism Core is proprietary and is not bundled in this repository. The runtime can load
 * library URLs from window.__LIVE2D_LIBS__ or fall back to CDN URLs; if any library or model
 * fails, pet.js keeps showing the existing PNG/Three.js pet.
 *
 * Exposes window.PetLive2D = { init, ready, show, setMood, focus, react }.
 */
(function () {
  const API = { ready: false };
  window.PetLive2D = API;

  const DEFAULT_LIBS = {
    core: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    pixi: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
    plugin: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
  };

  let canvas, app, model, currentModelUrl = null, baseScale = 1, level = 1, resizeWired = false;
  const loadedScripts = new Map();

  function libs() {
    return Object.assign({}, DEFAULT_LIBS, window.__LIVE2D_LIBS__ || {});
  }

  function loadScript(src) {
    if (!src) return Promise.resolve();
    if (loadedScripts.has(src)) return loadedScripts.get(src);
    const promise = new Promise((res, rej) => {
      const existing = Array.from(document.scripts).find((script) => script.src === src);
      if (existing) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = () => res();
      s.onerror = () => rej(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
    loadedScripts.set(src, promise);
    return promise;
  }

  async function ensureRuntime() {
    const src = libs();
    await loadScript(src.core);
    await loadScript(src.pixi);
    await loadScript(src.plugin);
    if (!window.PIXI || !window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) {
      throw new Error('Live2D runtime unavailable');
    }
  }

  function sizeRenderer() {
    if (!app || !canvas) return;
    app.renderer.resize(canvas.clientWidth || 220, canvas.clientHeight || 260);
  }

  function applyScale() {
    if (model) model.scale.set(baseScale * (0.84 + Math.min(level, 8) * 0.026));
  }

  function layout() {
    if (!model || !app) return;
    const W = app.renderer.width;
    const H = app.renderer.height;
    model.anchor.set(0.5, 1);
    model.scale.set(1);
    const fit = Math.min(W / Math.max(model.width, 1), H / Math.max(model.height, 1));
    baseScale = fit * (window.__LIVE2D_FIT__ || 1.42);
    applyScale();
    model.position.set(W / 2, H - 6);
  }

  function destroyModel() {
    if (!model) return;
    try {
      if (app && app.stage) app.stage.removeChild(model);
      if (model.destroy) model.destroy({ children: true, texture: false, baseTexture: false });
    } catch (e) { /* best-effort cleanup */ }
    model = null;
    currentModelUrl = null;
    API.ready = false;
  }

  async function loadModel(modelUrl) {
    if (!app) {
      app = new window.PIXI.Application({ view: canvas, backgroundAlpha: 0, antialias: true, autoStart: true });
      sizeRenderer();
      if (!resizeWired) {
        window.addEventListener('resize', () => { sizeRenderer(); layout(); });
        resizeWired = true;
      }
    }
    if (model && currentModelUrl === modelUrl) return;
    destroyModel();
    model = await window.PIXI.live2d.Live2DModel.from(modelUrl, { autoInteract: false });
    currentModelUrl = modelUrl;
    app.stage.addChild(model);
    layout();
    API.ready = true;
  }

  function motionGroups() {
    try {
      const defs = model?.internalModel?.motionManager?.definitions || {};
      return Object.keys(defs);
    } catch (e) {
      return [];
    }
  }

  function playFirst(patterns) {
    if (!model) return;
    const groups = motionGroups();
    const group = groups.find((name) => patterns.some((pattern) => pattern.test(name)))
      || groups.find((name) => !/idle/i.test(name))
      || groups[0];
    if (group) {
      try { model.motion(group); } catch (e) { /* optional model motion */ }
    }
  }

  API.init = async function (cnv, opts) {
    opts = opts || {};
    const modelUrl = opts.modelUrl;
    if (!cnv || !modelUrl) { if (opts.onFail) opts.onFail(new Error('missing Live2D modelUrl')); return; }
    canvas = cnv;
    try {
      await ensureRuntime();
      await loadModel(modelUrl);
      if (opts.onReady) opts.onReady();
    } catch (e) {
      destroyModel();
      if (opts.onFail) opts.onFail(e);
    }
  };

  API.show = function (o) {
    o = o || {};
    if (o.modelUrl && o.modelUrl !== currentModelUrl && canvas) API.init(canvas, { modelUrl: o.modelUrl });
    if (typeof o.level === 'number' && o.level !== level) { level = o.level; applyScale(); }
  };

  API.setMood = function (expr) {
    if (expr === 'happy' || expr === 'flow') playFirst([/happy/i, /smile/i, /tap/i]);
    else if (expr === 'sleepy' || expr === 'bored') playFirst([/sleep/i, /tired/i, /idle/i]);
    else if (expr === 'worried') playFirst([/worry/i, /sad/i, /shake/i]);
  };

  API.focus = function (x, y) {
    if (model && model.focus) model.focus(x, y);
  };

  API.react = function (type) {
    if (type === 'feed') playFirst([/feed/i, /eat/i, /tap/i, /happy/i]);
    else if (type === 'levelup' || type === 'evolve' || type === 'hop') playFirst([/jump/i, /special/i, /happy/i, /tap/i]);
    else if (type === 'failure') playFirst([/worry/i, /sad/i, /shake/i]);
    else playFirst([/tap/i, /special/i, /happy/i]);
  };
})();
