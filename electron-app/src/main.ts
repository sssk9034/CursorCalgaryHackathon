import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  screen,
  ipcMain,
  Notification,
  powerMonitor,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  defaultSettings,
  NotificationType,
  IpcChannel,
  Settings,
  BreakInitPayload,
  BreakBeginPayload,
} from './types';

if (started) {
  app.quit();
}

// ── State ────────────────────────────────────────────────────────────────────

const settings: Settings = { ...defaultSettings };
let tray: Tray | null = null;
let breakWindows: BrowserWindow[] = [];
let breakTime: number = Date.now() + settings.breakFrequencySeconds * 1000;
let lastCompletedBreakTime: number = Date.now();
let postponeCount = 0;
let breakActive = false;
let breakStartTime = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function formatTimeSinceLastBreak(): string {
  const seconds = Math.floor((Date.now() - lastCompletedBreakTime) / 1000);
  if (seconds < 60) return `${seconds}s since last break`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m since last break`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m since last break`;
}

function closeBreakWindows() {
  for (const win of breakWindows) {
    if (!win.isDestroyed()) win.close();
  }
  breakWindows = [];
}

function sendToBreakWindows(channel: string, ...args: unknown[]) {
  for (const win of breakWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

function scheduleNextBreak(delaySec?: number) {
  const delay = delaySec ?? settings.breakFrequencySeconds;
  breakTime = Date.now() + delay * 1000;
  breakActive = false;
  postponeCount = 0;
  updateTrayTooltip();
}

function completeBreakTracking() {
  const elapsed = Date.now() - breakStartTime;
  const halfRequired = settings.breakLengthSeconds * 500;
  if (elapsed >= halfRequired) {
    lastCompletedBreakTime = Date.now();
  }
}

function updateTrayTooltip() {
  if (tray) {
    const remainMs = Math.max(0, breakTime - Date.now());
    const remainMin = Math.ceil(remainMs / 60000);
    tray.setToolTip(`BreakTimer — next break in ${remainMin}m`);
  }
}

// ── Break Windows ─────────────────────────────────────────────────────────────

function createBreakWindow(
  display: Electron.Display,
  windowId: number,
): BrowserWindow {
  const notificationWidth = settings.postponeBreakEnabled || settings.skipBreakEnabled ? 550 : 450;
  const x = Math.round(
    display.bounds.x + display.bounds.width / 2 - notificationWidth / 2,
  );
  const y = display.bounds.y + 50;

  const win = new BrowserWindow({
    width: notificationWidth,
    height: 80,
    x,
    y,
    frame: false,
    transparent: true,
    focusable: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const params = new URLSearchParams({
    page: 'break',
    windowId: String(windowId),
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${params.toString()}`);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { query: Object.fromEntries(params) },
    );
  }

  win.showInactive();

  win.on('closed', () => {
    breakWindows = breakWindows.filter((w) => w !== win);
  });

  return win;
}

function doCreateBreakWindows() {
  closeBreakWindows();
  const displays = screen.getAllDisplays();
  displays.forEach((display, i) => {
    const win = createBreakWindow(display, i);
    breakWindows.push(win);
  });

  // Send init payload once each window has loaded
  breakWindows.forEach((win, i) => {
    win.webContents.once('did-finish-load', () => {
      const payload: BreakInitPayload = {
        settings,
        timeSinceLastBreak: formatTimeSinceLastBreak(),
        windowId: i,
        postponeCount,
      };
      win.webContents.send(IpcChannel.BreakInit, payload);
    });
  });
}

// ── OS Notification ───────────────────────────────────────────────────────────

function showOsNotification() {
  const notification = new Notification({
    title: 'Time for a break!',
    body: stripHtml(settings.breakMessage),
    silent: process.platform !== 'win32',
  });
  notification.show();
  if (process.platform !== 'darwin') {
    setTimeout(() => notification.close(), 5000);
  }
  lastCompletedBreakTime = Date.now();
  scheduleNextBreak();
}

// ── Scheduling Engine ─────────────────────────────────────────────────────────

function doBreak() {
  if (breakActive) return;
  breakActive = true;

  if (settings.notificationType === NotificationType.Notification) {
    showOsNotification();
  } else {
    doCreateBreakWindows();
  }
}

function tick() {
  // Idle detection — treat idle as a natural break and reset the timer
  const idleTime = powerMonitor.getSystemIdleTime();
  if (idleTime >= settings.idleResetLengthSeconds && !breakActive) {
    lastCompletedBreakTime = Date.now();
    scheduleNextBreak();
    return;
  }

  if (!breakActive && Date.now() >= breakTime) {
    doBreak();
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle(IpcChannel.BreakStart, (_event, windowId: number) => {
  // Only window 0 drives the state change; all windows follow
  if (windowId !== 0) return;

  breakStartTime = Date.now();
  const breakEndTime = breakStartTime + settings.breakLengthSeconds * 1000;

  const displays = screen.getAllDisplays();
  breakWindows.forEach((win, i) => {
    if (win.isDestroyed()) return;
    const display = displays[i] ?? displays[0];
    if (settings.backdropOpacity > 0) {
      win.setFocusable(true);
      win.setBounds({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      });
    } else {
      win.setFocusable(true);
      win.setBounds({
        x: Math.round(display.bounds.x + display.bounds.width / 2 - 250),
        y: Math.round(display.bounds.y + display.bounds.height / 2 - 150),
        width: 500,
        height: 300,
      });
    }
  });

  const payload: BreakBeginPayload = {
    breakEndTime,
    breakStartTime,
    settings,
  };
  sendToBreakWindows(IpcChannel.BreakBegin, payload);
});

ipcMain.handle(IpcChannel.BreakEnd, (_event, bStartTime: number) => {
  breakStartTime = bStartTime;
  completeBreakTracking();
  closeBreakWindows();
  scheduleNextBreak();
});

ipcMain.handle(IpcChannel.BreakSkip, () => {
  closeBreakWindows();
  scheduleNextBreak();
});

ipcMain.handle(IpcChannel.BreakPostpone, () => {
  postponeCount++;
  closeBreakWindows();
  scheduleNextBreak(settings.postponeSeconds);
});

// ── Tray ──────────────────────────────────────────────────────────────────────

// Minimal 16×16 teal PNG tray icon
const TRAY_ICON_DATA =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z0ABYBw1gGE0EhiGAQwMDAwAARgAAT4GAdyAAAAASUVORK5CYII=';

function initTray() {
  const icon = nativeImage.createFromDataURL(
    `data:image/png;base64,${TRAY_ICON_DATA}`,
  );
  tray = new Tray(icon);
  updateTrayTooltip();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Take a Break Now',
      click: () => {
        if (!breakActive) doBreak();
      },
    },
    {
      label: 'Reset Timer',
      click: () => scheduleNextBreak(),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on('ready', () => {
  initTray();
  // Start scheduling engine
  setInterval(tick, 1000);
  // Update tooltip every minute
  setInterval(updateTrayTooltip, 60_000);
});

// Keep app alive in tray when all windows are closed
app.on('window-all-closed', () => {
  // intentionally empty — app lives in tray
});

app.on('activate', () => {
  // macOS: nothing to do, no main settings window
});
