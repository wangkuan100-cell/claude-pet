const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
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
let idleHopTimer = null;
let lastFeed = 0;
let prefs = { wander: true, reminders: true, alwaysOnTop: true };

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
    // data URL (not file://) so the 3D renderer can upload it as a WebGL texture; <img> in the
    // 2D fallback accepts it too. Use the spriteKey from buildPaintData — it's 'egg' pre-hatch
    // (resolving to the generic egg.png) or 'line/form' after hatching.
    const url = spriteSource.assetDataUrl(assetsDir, data.sprite.key);
    if (url) data.sprite.imageSrc = url;
    // When reminders are toggled off, hide the nag bubbles (context/git/rest) but keep the
    // supportive empathy bubble.
    if (!prefs.reminders && data.bubble && data.bubble.kind !== 'empathy') data.bubble = null;
  } else {
    lastPanel = null;
  }
  win.webContents.send('paint', data);
}

async function createWindow() {
  const stateApi = await loadModules();

  const savedPrefs = winPos.loadPrefs();
  prefs = {
    wander: savedPrefs.wander ?? (process.env.CLAUDE_PET_WANDER !== '0'),
    reminders: savedPrefs.reminders ?? true,
    alwaysOnTop: savedPrefs.alwaysOnTop ?? true,
  };

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const saved = winPos.loadPos();
  win = new BrowserWindow({
    width: 240, height: 300, x: saved ? saved.x : width - 280, y: saved ? saved.y : 80,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  });
  win.setAlwaysOnTop(!!prefs.alwaysOnTop, 'screen-saver');
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

  // Right-click the pet → a native menu of feature toggles (checkboxes) + quit.
  ipcMain.on('context-menu', () => {
    if (!win || win.isDestroyed()) return;
    const menu = Menu.buildFromTemplate([
      { label: '溜达', type: 'checkbox', checked: !!prefs.wander, click: () => toggle('wander') },
      { label: '提醒气泡', type: 'checkbox', checked: !!prefs.reminders, click: () => toggle('reminders') },
      { label: '窗口置顶', type: 'checkbox', checked: !!prefs.alwaysOnTop, click: () => toggle('alwaysOnTop') },
      { type: 'separator' },
      { label: '退出宠物', click: () => app.quit() },
    ]);
    menu.popup({ window: win });
  });

  if (prefs.wander) { startWander(); startIdleHops(); }
}

// Every ~25s the pet bounces to a new spot on the bottom edge — physically hopping (parabolic
// arcs) instead of sliding. Toggled at runtime from the right-click menu (prefs.wander);
// CLAUDE_PET_WANDER=0 only sets the initial default.
function startWander() {
  if (wanderTimer) return;
  wanderTimer = setInterval(() => {
    if (!win || win.isDestroyed() || dragOrigin) return; // paused while dragging
    const wa = screen.getPrimaryDisplay().workAreaSize;
    const [w, h] = win.getSize();
    const from = win.getPosition();
    const to = wander.pickWanderTarget(wa, { width: w, height: h });
    const path = wander.hopPath(from, [to.x, to.y], 5, 28, 9); // 5 hops, peak 28px
    const send = (m) => { if (win && !win.isDestroyed()) win.webContents.send('walk', m); };
    send(to.x >= from[0] ? 1 : -1);
    let i = 0;
    const step = setInterval(() => {
      if (!win || win.isDestroyed() || dragOrigin) { clearInterval(step); send(0); return; }
      win.setPosition(path[i][0], path[i][1]);
      if (++i >= path.length) { clearInterval(step); if (winPos) winPos.savePos(win.getPosition()); send(0); }
    }, 40);
  }, 25000);
}
function stopWander() {
  if (wanderTimer) { clearInterval(wanderTimer); wanderTimer = null; }
}

// Random in-place hop: every 10–20s, jittered, the renderer plays a little squash-and-stretch
// jump animation on the sprite. Skipped while dragging.
function startIdleHops() {
  if (idleHopTimer) return;
  const schedule = () => {
    const ms = 10000 + Math.random() * 10000;
    idleHopTimer = setTimeout(() => {
      if (win && !win.isDestroyed() && !dragOrigin) win.webContents.send('hop');
      schedule();
    }, ms);
  };
  schedule();
}
function stopIdleHops() {
  if (idleHopTimer) { clearTimeout(idleHopTimer); idleHopTimer = null; }
}

// Apply the current prefs to live window state; toggle() flips+persists one switch and re-applies.
function applyPrefs() {
  if (prefs.wander) { startWander(); startIdleHops(); } else { stopWander(); stopIdleHops(); }
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(!!prefs.alwaysOnTop, 'screen-saver');
}
function toggle(key) {
  prefs[key] = !prefs[key];
  if (winPos) winPos.savePrefs(prefs);
  applyPrefs();
  repaint();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { clearInterval(decayTimer); clearInterval(wanderTimer); clearTimeout(idleHopTimer); if (stopWatch) stopWatch(); app.quit(); });
