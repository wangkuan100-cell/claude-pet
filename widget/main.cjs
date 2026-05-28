const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');

let win = null;
let logic = null;       // dynamically-imported ESM modules
let stateSource = null;
let stopWatch = null;
let decayTimer = null;

async function loadModules() {
  logic = await import('./render-logic.js');
  stateSource = await import('./state-source.js');
  return import('../src/state.js');
}

function repaint() {
  if (!win || win.isDestroyed() || !logic || !stateSource) return;
  const { pet, status } = stateSource.readState();
  win.webContents.send('paint', logic.buildPaintData(pet, status, new Date()));
}

async function createWindow() {
  const stateApi = await loadModules();

  const { width } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 240, height: 300, x: width - 280, y: 80,
    frame: false, transparent: true, resizable: false, alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

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
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { clearInterval(decayTimer); if (stopWatch) stopWatch(); app.quit(); });
