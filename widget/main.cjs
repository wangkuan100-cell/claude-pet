const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

let win = null;
let logic = null;       // dynamically-imported ESM modules
let stateSource = null;
let spriteSource = null;
let winPos = null;
let engine = null;
let wander = null;
let dragOrigin = null;
let stopWatch = null;
let decayTimer = null;
let wanderTimer = null;
let lastFeed = 0;

async function loadModules() {
  logic = await import('./render-logic.js');
  stateSource = await import('./state-source.js');
  spriteSource = await import('./sprite-source.js');
  winPos = await import('./window-pos.js');
  engine = await import('../src/engine.js');
  wander = await import('./wander.js');
  return import('../src/state.js');
}

let lastPanel = null;
function repaint() {
  if (!win || win.isDestroyed() || !logic || !stateSource) return;
  const { pet, status } = stateSource.readState();
  const data = logic.buildPaintData(pet, status, new Date());
  if (data.mode === 'pet') {
    data.events = logic.paintEvents(lastPanel, data.panel);
    lastPanel = data.panel;
    const assetsDir = path.join(__dirname, '..', 'assets');
    const url = spriteSource.assetUrlFor(assetsDir, `${pet.species}/${pet.stage}`);
    if (url) data.sprite.imageSrc = url;
  } else {
    lastPanel = null;
  }
  win.webContents.send('paint', data);
}

async function createWindow() {
  const stateApi = await loadModules();

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const saved = winPos.loadPos();
  win = new BrowserWindow({
    width: 240, height: 300, x: saved ? saved.x : width - 280, y: saved ? saved.y : 80,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Click-through everywhere by default; the renderer re-enables hits while the
  // pointer is over the pet/panel/adoption UI (see 'set-interactive').
  win.setIgnoreMouseEvents(true, { forward: true });

  // Repaint on state-file changes...
  stopWatch = stateSource.watch(() => repaint());
  // ...and on a timer so idle mood-decay shows even when nothing is happening.
  decayTimer = setInterval(repaint, 60000);

  ipcMain.on('request-paint', repaint);
  ipcMain.on('adopt', (_e, species) => {
    const pet = stateApi.loadPet();
    if (require('./placeholders-allowlist.cjs').includes(species)) { pet.species = species; stateApi.savePet(pet); }
    repaint();
  });
  ipcMain.on('set-interactive', (_e, on) => {
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true });
  });
  // Manual window drag: the renderer reports screen mouse coords; move the window by the same delta.
  ipcMain.on('drag-start', (_e, p) => { if (win && !win.isDestroyed()) dragOrigin = { sx: p.sx, sy: p.sy, pos: win.getPosition() }; });
  ipcMain.on('drag-move', (_e, p) => {
    if (!win || win.isDestroyed() || !dragOrigin) return;
    win.setPosition(Math.round(dragOrigin.pos[0] + p.sx - dragOrigin.sx), Math.round(dragOrigin.pos[1] + p.sy - dragOrigin.sy));
  });
  ipcMain.on('drag-end', () => { if (win && !win.isDestroyed() && winPos) winPos.savePos(win.getPosition()); dragOrigin = null; });

  // Double-click feeding (light cooldown so it can't be spammed).
  ipcMain.on('feed', () => {
    const t = Date.now();
    if (t - lastFeed < 3000) return;
    lastFeed = t;
    const pet = stateApi.loadPet();
    const { pet: updated } = engine.applyEvent(pet, { linesXp: 0, testXp: 0 }, { type: 'feed' }, new Date());
    stateApi.savePet(updated);
    repaint();
  });

  startWander();
}

// Default ON (opt out with CLAUDE_PET_WANDER=0): every ~40s the pet strolls to a new spot on
// the bottom edge — at any stage, the egg included (there is no stage gate).
function startWander() {
  if (process.env.CLAUDE_PET_WANDER === '0') return;
  wanderTimer = setInterval(() => {
    if (!win || win.isDestroyed() || dragOrigin) return; // paused while dragging
    const wa = screen.getPrimaryDisplay().workAreaSize;
    const [w, h] = win.getSize();
    const from = win.getPosition();
    const to = wander.pickWanderTarget(wa, { width: w, height: h });
    const path = wander.glidePath(from, [to.x, to.y], 30);
    const send = (m) => { if (win && !win.isDestroyed()) win.webContents.send('walk', m); };
    send(to.x >= from[0] ? 1 : -1);
    let i = 0;
    const step = setInterval(() => {
      if (!win || win.isDestroyed() || dragOrigin) { clearInterval(step); send(0); return; }
      win.setPosition(path[i][0], path[i][1]);
      if (++i >= path.length) { clearInterval(step); if (winPos) winPos.savePos(win.getPosition()); send(0); }
    }, 50);
  }, 40000);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { clearInterval(decayTimer); clearInterval(wanderTimer); if (stopWatch) stopWatch(); app.quit(); });
