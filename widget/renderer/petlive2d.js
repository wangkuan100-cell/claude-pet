/* Live2D pet (Cubism 4 via PIXI + pixi-live2d-display).
 *
 * NOTE on licensing/assets: Live2D's Cubism Core is proprietary and must not be redistributed,
 * so it is NOT vendored — it (and PIXI, the plugin, and a free sample model) are loaded lazily
 * from their official CDNs at runtime. This means Live2D mode needs internet on first run and
 * uses a pre-made sample character (not the project's own creatures). If anything fails to load
 * (offline, blocked), init() calls onFail and the widget falls back to the three.js / 2D pet.
 *
 * Exposes window.PetLive2D = { init, ready, show, setMood, focus, react }.
 */
(function () {
  const API = { ready: false };
  window.PetLive2D = API;

  const CDN = {
    core: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    pixi: 'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
    plugin: 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
  };
  // A free Cubism-4 sample model from Live2D's official CubismWebSamples — "Hiyori", the cute
  // schoolgirl mascot. Override via window.__LIVE2D_MODEL__ to point at any other .model3.json.
  const MODEL_URL = (window.__LIVE2D_MODEL__) ||
    'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json';

  let canvas, app, model, baseScale = 1, level = 1;

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = () => res(); s.onerror = () => rej(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function sizeRenderer() {
    if (!app || !canvas) return;
    app.renderer.resize(canvas.clientWidth || 220, canvas.clientHeight || 260);
  }
  function layout() {
    if (!model || !app) return;
    const W = app.renderer.width, H = app.renderer.height;
    // Live2D models often pad their drawing bounds above the head for animation room. Anchor at
    // bottom-center and position at the canvas floor so the feet land at the bottom and the head
    // stays visible no matter how much empty padding lives above the head.
    model.anchor.set(0.5, 1.0);
    model.scale.set(1);
    const fit = Math.min(W / model.width, H / model.height);
    baseScale = fit * (window.__LIVE2D_FIT__ || 1.15);
    applyScale();
    model.position.set(W / 2, H - 4);
  }
  function applyScale() {
    if (model) model.scale.set(baseScale * (0.8 + Math.min(level, 6) * 0.034)); // grows a touch with level
  }

  API.init = async function (cnv, opts) {
    opts = opts || {};
    if (API.ready || !cnv) return;
    canvas = cnv;
    try {
      await loadScript(CDN.core);
      await loadScript(CDN.pixi);
      await loadScript(CDN.plugin);
      if (!window.PIXI || !window.PIXI.live2d) throw new Error('PIXI/live2d plugin unavailable');
    } catch (e) { if (opts.onFail) opts.onFail(e); return; }
    try {
      app = new window.PIXI.Application({ view: canvas, backgroundAlpha: 0, antialias: true, autoStart: true });
      sizeRenderer();
      model = await window.PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false });
      app.stage.addChild(model);
      model.anchor.set(0.5, 0.5);
      layout();
      window.addEventListener('resize', () => { sizeRenderer(); layout(); });
      API.ready = true;
      if (opts.onReady) opts.onReady();
    } catch (e) { if (opts.onFail) opts.onFail(e); }
  };

  // Blinking, breathing and idle motion are driven automatically by the model.
  API.show = function (o) {
    o = o || {};
    if (typeof o.level === 'number' && o.level !== level) { level = o.level; applyScale(); }
  };
  API.setMood = function (/* expr */) { /* expressions vary per model; idle motion carries mood for now */ };
  API.focus = function (x, y) { if (model) model.focus(x, y); }; // canvas-pixel coords → look toward point
  API.react = function (/* type */) {
    if (!model) return;
    try {
      const defs = model.internalModel.motionManager.definitions || {};
      const groups = Object.keys(defs);
      const g = groups.find((k) => /tap|flick|special|shake/i.test(k)) || groups.find((k) => !/idle/i.test(k)) || groups[0];
      if (g) model.motion(g);
    } catch (e) { /* model has no extra motions — ignore */ }
  };
})();
