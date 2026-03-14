import { app, BrowserWindow, Tray, Menu, nativeImage, screen } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let tray: Tray | null = null;
let countdownWindow: BrowserWindow | null = null;

const createCountdownWindow = () => {
  // Close existing countdown window if open
  if (countdownWindow && !countdownWindow.isDestroyed()) {
    countdownWindow.close();
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  countdownWindow = new BrowserWindow({
    width,
    height: 36,
    x: 0,
    y: 0,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const url = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}#countdown`
    : undefined;

  if (url) {
    countdownWindow.loadURL(url);
  } else {
    countdownWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: 'countdown' },
    );
  }

  countdownWindow.on('closed', () => {
    countdownWindow = null;
  });
};

// Minimal 16x16 PNG for tray icon (light grey square)
const TRAY_ICON_DATA =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z0ABYBw1gGE0EhiGAQwMDAwAARgAAT4GAdyAAAAASUVORK5CYII=';

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Create tray icon with context menu (only once)
  if (!tray) {
    const icon = nativeImage.createFromDataURL(
      `data:image/png;base64,${TRAY_ICON_DATA}`,
    );
    tray = new Tray(icon);
    tray.setToolTip('My App');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Trigger', click: () => createCountdownWindow() },
      {
        label: 'Show',
        click: () => {
          // Show the main window if it exists, otherwise create a new one
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            const win = windows[0];
            win.show();
            win.focus();
          } else {
            createWindow();
          }
        },
      },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setContextMenu(contextMenu);
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Keep app running when all windows are closed (tray-only mode).
// User can quit via the tray menu "Quit" option.
app.on('window-all-closed', () => {
  // Do not quit - app stays running with tray icon
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
