const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, powerMonitor } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null, tray = null, over = false, grabbing = false, paused = false, sound = true, hidden = false;
let hits = [];           // zonas del gatito y del ovillo, en coordenadas de la ventana
let lastIgnore = null;

function bounds() {
  const d = screen.getPrimaryDisplay();
  return { b: d.bounds, ground: d.workArea.y + d.workArea.height - d.bounds.y - 2 };
}
function updateMouse(force) {
  if (!win) return;
  const ignore = !(over || grabbing);
  if (!force && ignore === lastIgnore) return;
  lastIgnore = ignore;
  win.setIgnoreMouseEvents(ignore, { forward: true });
}
// Vigila el mouse desde aquí (no depende de los avisos de Windows, que se cortan tras suspender el PC)
function watchCursor() {
  if (!win || hidden || win.isDestroyed()) return;
  const p = screen.getCursorScreenPoint(), b = win.getBounds();
  const x = p.x - b.x, y = p.y - b.y;
  const inside = hits.some(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
  if (inside !== over) { over = inside; updateMouse(); }
}
function recover() {             // al volver de suspensión o desbloquear la sesión
  if (!win || win.isDestroyed()) return;
  grabbing = false; over = false; lastIgnore = null;
  relayout();
  if (!hidden) { win.showInactive(); win.setAlwaysOnTop(true, 'screen-saver'); }
  send('reset-input');
  updateMouse(true);
}
function createWindow() {
  const { b, ground } = bounds();
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, fullscreenable: false,
    backgroundColor: '#00000000', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'pet.html'), { query: { ground: String(ground) } });
  win.once('ready-to-show', () => { win.showInactive(); updateMouse(); });
  // vuelve a ponerse encima si otra ventana "siempre visible" lo tapa
  setInterval(() => { if (win && !hidden) win.setAlwaysOnTop(true, 'screen-saver'); }, 4000);
}
function relayout() {
  if (!win) return;
  const { b, ground } = bounds();
  win.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  win.webContents.send('layout', ground);
}
function send(c) { if (win) win.webContents.send('cmd', c); }
function buildMenu() {
  const auto = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: 'Michi Pet 🐾', enabled: false },
    { type: 'separator' },
    { label: 'Llamar a Michi Pet', click: () => { if (hidden) toggleHide(); send('call'); } },
    { label: 'Mandarlo a dormir', click: () => send('sleep') },
    { label: 'Dar el ovillo de lana', click: () => { if (hidden) toggleHide(); send('yarn'); } },
    { label: 'Guardar el ovillo', click: () => send('yarn-away') },
    { type: 'separator' },
    { label: hidden ? 'Mostrar a Michi Pet' : 'Esconder a Michi Pet', click: toggleHide },
    { label: paused ? 'Reanudar' : 'Pausar', click: () => { paused = !paused; send(paused ? 'pause' : 'resume'); tray.setContextMenu(buildMenu()); } },
    { label: 'Sonidos', type: 'checkbox', checked: sound, click: i => { sound = i.checked; send(sound ? 'sound-on' : 'sound-off'); } },
    { label: 'Iniciar con Windows', type: 'checkbox', checked: auto, click: i => { app.setLoginItemSettings({ openAtLogin: i.checked }); } },
    { type: 'separator' },
    { label: 'Cerrar Michi Pet', click: () => app.quit() }
  ]);
}
function toggleHide() {
  hidden = !hidden;
  if (hidden) win.hide(); else { win.showInactive(); win.setAlwaysOnTop(true, 'screen-saver'); }
  tray.setContextMenu(buildMenu());
}
app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('app.michipet.gatito');
  // Iniciar con Windows es opcional: se activa desde el menú del ícono junto al reloj
  createWindow();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
  tray.setToolTip('Michi Pet');
  tray.setContextMenu(buildMenu());
  tray.on('click', () => tray.popUpContextMenu());
  ipcMain.on('over-cat', (_e, v) => { if (v) { over = true; updateMouse(); } });
  ipcMain.on('grab', (_e, v) => { grabbing = !!v; updateMouse(); });
  ipcMain.on('hits', (_e, list) => { if (Array.isArray(list)) hits = list.filter(h => h && isFinite(h.x) && isFinite(h.y) && h.w > 0 && h.h > 0); });
  setInterval(watchCursor, 40);
  for (const ev of ['resume', 'unlock-screen', 'user-did-become-active']) {
    try { powerMonitor.on(ev, () => { setTimeout(recover, 800); setTimeout(recover, 3000); }); } catch (e) {}
  }
  screen.on('display-metrics-changed', relayout);
  screen.on('display-added', relayout);
  screen.on('display-removed', relayout);
});
app.on('second-instance', () => { if (hidden) toggleHide(); send('call'); });
app.on('window-all-closed', () => app.quit());
