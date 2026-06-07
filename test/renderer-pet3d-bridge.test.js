import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererScript = path.join(__dirname, '..', 'widget', 'renderer', 'pet.js');

function fakeElement(id) {
  const classes = new Set();
  return {
    id,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    style: {},
    textContent: '',
    src: '',
    offsetWidth: 0,
    addEventListener() {},
    appendChild() {},
    remove() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 220, height: 220 }; },
  };
}

function rendererContext(fixture, pet3dCalls, apiHooks = null, live2dCalls = null) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, fakeElement(id));
      return elements.get(id);
    },
    querySelector(selector) {
      if (!selector.startsWith('#')) return null;
      return this.getElementById(selector.slice(1));
    },
    addEventListener() {},
    createElement(tag) { return fakeElement(tag); },
  };
  const window = {
    __FIXTURE__: fixture,
    addEventListener() {},
    Pet3D: {
      ready: false,
      init() { this.ready = true; },
      show(payload) { pet3dCalls.push(payload); },
      setMood() {},
      setMoving(dir) { pet3dCalls.push({ method: 'setMoving', dir }); },
      playAction(name) { pet3dCalls.push({ method: 'playAction', name }); },
      react() {},
    },
  };
  if (live2dCalls) {
    window.PetLive2D = {
      ready: false,
      init(_canvas, opts) {
        live2dCalls.push({ method: 'init', modelUrl: opts.modelUrl });
        this.ready = true;
        if (opts.onReady) opts.onReady();
      },
      show(payload) { live2dCalls.push({ method: 'show', payload }); },
      setMood(expr) { live2dCalls.push({ method: 'setMood', expr }); },
      react(type) { live2dCalls.push({ method: 'react', type }); },
      focus() {},
    };
  }
  if (apiHooks) {
    window.api = {
      onPaint(cb) { apiHooks.paint = cb; if (fixture) cb(fixture); },
      requestPaint() {},
      onWalk(cb) { apiHooks.walk = cb; },
      onHop(cb) { apiHooks.hop = cb; },
      setInteractive() {},
      dragStart() {},
      dragMove() {},
      dragEnd() {},
      feed() {},
      contextMenu() {},
    };
  }
  return {
    window,
    document,
    console,
    Math,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout: () => 1,
    clearTimeout() {},
  };
}

test('3D renderer bridge drops legacy 2.5D layers when no keyframed rig is present', () => {
  const layers = [{ id: 'body', src: 'data:image/png;base64,Qk9EWQ==', z: 0 }];
  const fixture = {
    expression: 'normal',
    sprite: {
      key: 'phoenix/legendary',
      base: '🔥',
      layers,
      layerCanvas: { width: 256, height: 256 },
      animationMode: 'still',
    },
    panel: {
      name: 'Ember',
      level: 6,
      stage: 'legendary',
      xp: 4500,
      xpToNext: 0,
      xpPct: 100,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pet3dCalls = [];
  vm.runInNewContext(fs.readFileSync(rendererScript, 'utf8'), rendererContext(fixture, pet3dCalls));

  assert.equal(pet3dCalls.length, 1);
  assert.equal(pet3dCalls[0].layers, null);
  assert.equal(pet3dCalls[0].layerCanvas, null);
  assert.equal(pet3dCalls[0].animationMode, 'still');
});

test('3D renderer bridge forwards keyframed rig metadata to Pet3D.show', () => {
  const layers = [{ id: 'body-core', src: 'data:image/png;base64,Qk9EWQ==', z: 0 }];
  const rig = { id: 'phoenix/legendary', animations: { run: { duration: 720 } } };
  const fixture = {
    expression: 'normal',
    sprite: {
      key: 'phoenix/legendary',
      base: '🔥',
      layers,
      layerCanvas: { width: 256, height: 256 },
      animationMode: 'rig',
      rig,
    },
    panel: {
      name: 'Ember',
      level: 6,
      stage: 'legendary',
      xp: 4500,
      xpToNext: 0,
      xpPct: 100,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pet3dCalls = [];
  vm.runInNewContext(fs.readFileSync(rendererScript, 'utf8'), rendererContext(fixture, pet3dCalls));

  assert.equal(pet3dCalls.length, 1);
  assert.equal(pet3dCalls[0].animationMode, 'rig');
  assert.deepEqual(pet3dCalls[0].rig, rig);
});

test('3D renderer bridge forwards DragonBones rig metadata without split layers', () => {
  const rig = { id: 'phoenix/legendary', engine: 'dragonbones', skeleton: 'phoenix_ske.json', atlas: 'phoenix_tex.json' };
  const fixture = {
    expression: 'normal',
    sprite: {
      key: 'phoenix/legendary',
      base: '🔥',
      imageSrc: 'data:image/png;base64,UEhPRU5JWA==',
      layers: [{ id: 'body-core', src: 'data:image/png;base64,Qk9EWQ==' }],
      layerCanvas: { width: 256, height: 256 },
      animationMode: 'dragonbones',
      rig,
    },
    panel: {
      name: 'Ember',
      level: 6,
      stage: 'legendary',
      xp: 4500,
      xpToNext: 0,
      xpPct: 100,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pet3dCalls = [];
  vm.runInNewContext(fs.readFileSync(rendererScript, 'utf8'), rendererContext(fixture, pet3dCalls));

  assert.equal(pet3dCalls.length, 1);
  assert.equal(pet3dCalls[0].animationMode, 'dragonbones');
  assert.deepEqual(pet3dCalls[0].rig, rig);
  assert.equal(pet3dCalls[0].layers, null);
  assert.equal(pet3dCalls[0].layerCanvas, null);
  assert.equal(pet3dCalls[0].imageSrc, 'data:image/png;base64,UEhPRU5JWA==');
});

test('renderer bridge lazily initializes Live2D when the sprite has a local model', () => {
  const fixture = {
    expression: 'happy',
    sprite: {
      key: 'phoenix/legendary',
      base: '🔥',
      poses: ['data:image/png;base64,UE9TRQ=='],
      live2d: { url: 'file:///assets/live2d/phoenix/legendary/model3.json', motions: ['Idle', 'Tap'], hasPhysics: true },
      animationMode: 'live2d',
    },
    panel: {
      name: 'Ember',
      level: 6,
      stage: 'legendary',
      xp: 4500,
      xpToNext: 0,
      xpPct: 100,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pet3dCalls = [];
  const live2dCalls = [];
  vm.runInNewContext(fs.readFileSync(rendererScript, 'utf8'), rendererContext(fixture, pet3dCalls, null, live2dCalls));

  assert.deepEqual(live2dCalls.map((call) => call.method), ['init', 'show', 'setMood']);
  assert.equal(live2dCalls[0].modelUrl, 'file:///assets/live2d/phoenix/legendary/model3.json');
  assert.equal(live2dCalls[1].payload.modelUrl, 'file:///assets/live2d/phoenix/legendary/model3.json');
  assert.equal(live2dCalls[1].payload.level, 6);
});

test('renderer bridge returns to 3D when the next sprite has no Live2D model', () => {
  const liveFixture = {
    expression: 'happy',
    sprite: {
      key: 'phoenix/legendary',
      base: '🔥',
      imageSrc: 'data:image/png;base64,UE9TRQ==',
      live2d: { url: 'file:///assets/live2d/phoenix/legendary/model3.json', motions: ['Idle'], hasPhysics: true },
      animationMode: 'live2d',
    },
    panel: {
      name: 'Ember',
      level: 6,
      stage: 'legendary',
      xp: 4500,
      xpToNext: 0,
      xpPct: 100,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pngFixture = {
    expression: 'normal',
    sprite: {
      key: 'kitsune/adult',
      base: '🦊',
      imageSrc: 'data:image/png;base64,S0lUU1VORQ==',
      animationMode: 'still',
    },
    panel: {
      name: 'Fox',
      level: 5,
      stage: 'adult',
      xp: 2200,
      xpToNext: 2300,
      xpPct: 52,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pet3dCalls = [];
  const live2dCalls = [];
  const apiHooks = {};
  const context = rendererContext(liveFixture, pet3dCalls, apiHooks, live2dCalls);
  vm.runInNewContext(fs.readFileSync(rendererScript, 'utf8'), context);

  assert.equal(context.document.getElementById('live2d').style.display, 'block');
  assert.equal(context.document.getElementById('stage3d').style.display, 'none');

  apiHooks.paint(pngFixture);

  assert.equal(context.document.getElementById('live2d').style.display, 'none');
  assert.equal(context.document.getElementById('stage3d').style.display, 'block');
  assert.equal(pet3dCalls.at(-1).imageSrc, 'data:image/png;base64,S0lUU1VORQ==');
});

test('3D renderer bridge forwards walk and hop events to Pet3D actions', () => {
  const fixture = {
    expression: 'normal',
    sprite: { key: 'phoenix/legendary', base: '🔥', poses: ['data:image/png;base64,UE9TRQ=='] },
    panel: {
      name: 'Ember',
      level: 6,
      stage: 'legendary',
      xp: 4500,
      xpToNext: 0,
      xpPct: 100,
      mood: 80,
      project: null,
      achievements: [],
    },
  };
  const pet3dCalls = [];
  const apiHooks = {};
  vm.runInNewContext(fs.readFileSync(rendererScript, 'utf8'), rendererContext(fixture, pet3dCalls, apiHooks));

  apiHooks.walk(1);
  apiHooks.walk(0);
  apiHooks.hop();

  assert.deepEqual(
    pet3dCalls.filter((call) => call.method),
    [
      { method: 'setMoving', dir: 1 },
      { method: 'setMoving', dir: 0 },
      { method: 'playAction', name: 'hop' },
    ],
  );
});
