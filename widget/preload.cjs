const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // main pushes paint-data; renderer subscribes.
  onPaint: (cb) => ipcRenderer.on('paint', (_e, data) => cb(data)),
  // renderer asks for an immediate repaint (e.g., on load).
  requestPaint: () => ipcRenderer.send('request-paint'),
  // user picked a species on the adoption screen.
  adopt: (species) => ipcRenderer.send('adopt', species),
  // tell main whether the pointer is over an interactive region (else clicks pass through)
  setInteractive: (on) => ipcRenderer.send('set-interactive', !!on),
  // manual window drag: screen mouse coords on start/move, then end
  dragStart: (p) => ipcRenderer.send('drag-start', p),
  dragMove: (p) => ipcRenderer.send('drag-move', p),
  dragEnd: () => ipcRenderer.send('drag-end'),
});
