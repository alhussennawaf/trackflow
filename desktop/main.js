// Windows desktop app: runs the web build (desktop/app) in an Electron window.
const { app, BrowserWindow, protocol, net, shell, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, 'app');
const SCHEME = 'jak';

// The Expo web build uses absolute paths (/_expo/...), so serve it from a private origin instead of file://.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: 'JAK - flowTracker',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    backgroundColor: '#F4F6FA',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.removeMenu();
  // Links to other sites open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`${SCHEME}://`)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://`)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  win.loadURL(`${SCHEME}://app/index.html`);
}

app.on('second-instance', () => {
  const [w] = BrowserWindow.getAllWindows();
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.jadahalkhozama.flowtracker');
  protocol.handle(SCHEME, (req) => {
    const { pathname } = new URL(req.url);
    let file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    if (pathname === '/' || !path.extname(file)) file = path.join(ROOT, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
  // Camera (site photos) and location (check-in) need permission inside the window.
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) =>
    cb(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(perm)),
  );
  createWindow();
});

app.on('window-all-closed', () => app.quit());
