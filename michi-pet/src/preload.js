const { contextBridge, ipcRenderer } = require('electron');
let ground = Number(new URLSearchParams(location.search).get('ground')) || 0;
contextBridge.exposeInMainWorld('michipetHost', {
  getGround: () => ground || window.innerHeight - 4,
  setOverCat: v => ipcRenderer.send('over-cat', v),
  setGrab: v => ipcRenderer.send('grab', v),
  setHits: list => ipcRenderer.send('hits', list),
  onCommand: fn => ipcRenderer.on('cmd', (_e, c) => fn(c)),
  onLayout: fn => ipcRenderer.on('layout', (_e, g) => { ground = g; fn(); })
});
