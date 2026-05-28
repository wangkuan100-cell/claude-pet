const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // main pushes paint-data; renderer subscribes.
  onPaint: (cb) => ipcRenderer.on('paint', (_e, data) => cb(data)),
  // renderer asks for an immediate repaint (e.g., on load).
  requestPaint: () => ipcRenderer.send('request-paint'),
  // user picked a species on the adoption screen.
  adopt: (species) => ipcRenderer.send('adopt', species),
});
