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
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import {
  NotificationType,
  IpcChannel,
  Settings,
  BreakInitPayload,
  BreakBeginPayload,
} from "./types";
import { getSettings, setSettings, getDisableEndTime, setDisableEndTime } from "./store";

if (started) {
  app.quit();
}

// ── State ────────────────────────────────────────────────────────────────────

let tray: Tray | null = null;
let breakWindows: BrowserWindow[] = [];
let settingsWindow: BrowserWindow | null = null;
let breakTime = 0;
let lastCompletedBreakTime: number = Date.now();
let postponeCount = 0;
let breakActive = false;
let breakStartTime = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
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
  const settings = getSettings();
  const delay = delaySec ?? settings.breakFrequencySeconds;
  breakTime = Date.now() + delay * 1000;
  breakActive = false;
  postponeCount = 0;
  updateTrayTooltip();
}

function completeBreakTracking() {
  const settings = getSettings();
  const elapsed = Date.now() - breakStartTime;
  const halfRequired = settings.breakLengthSeconds * 500;
  if (elapsed >= halfRequired) {
    lastCompletedBreakTime = Date.now();
  }
}

function updateTrayTooltip() {
  if (!tray) return;
  const settings = getSettings();
  if (!settings.breaksEnabled) {
    const disableEnd = getDisableEndTime();
    if (disableEnd) {
      const remain = Math.max(0, disableEnd - Date.now());
      const min = Math.ceil(remain / 60000);
      tray.setToolTip(`BreakTimer — disabled for ${min}m`);
    } else {
      tray.setToolTip("BreakTimer — breaks disabled");
    }
    return;
  }
  const remainMs = Math.max(0, breakTime - Date.now());
  const remainMin = Math.ceil(remainMs / 60000);
  tray.setToolTip(`BreakTimer — next break in ${remainMin}m`);
}

function checkDisableTimeout() {
  const disableEnd = getDisableEndTime();
  if (disableEnd && Date.now() >= disableEnd) {
    setDisableEndTime(null);
    const settings = getSettings();
    setSettings({ ...settings, breaksEnabled: true });
    buildTray();
  }
}

// ── Break Windows ─────────────────────────────────────────────────────────────

function createBreakWindow(
  display: Electron.Display,
  windowId: number,
  settings: Settings,
): BrowserWindow {
  const notificationWidth =
    settings.postponeBreakEnabled || settings.skipBreakEnabled ? 550 : 450;
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
    movable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const params = new URLSearchParams({
    page: "break",
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

  win.on("closed", () => {
    breakWindows = breakWindows.filter((w) => w !== win);
  });

  return win;
}

function doCreateBreakWindows() {
  closeBreakWindows();
  const settings = getSettings();
  const displays = screen.getAllDisplays();
  displays.forEach((display, i) => {
    const win = createBreakWindow(display, i, settings);
    breakWindows.push(win);
  });

  breakWindows.forEach((win, i) => {
    win.webContents.once("did-finish-load", () => {
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

// ── Settings Window ───────────────────────────────────────────────────────────

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    title: "BreakTimer — Settings",
    width: 580,
    minWidth: 580,
    height: 650,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const params = new URLSearchParams({ page: "settings" });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${params.toString()}`,
    );
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { query: Object.fromEntries(params) },
    );
  }

  settingsWindow.on("ready-to-show", () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

// ── OS Notification ───────────────────────────────────────────────────────────

function showOsNotification() {
  const settings = getSettings();
  const notification = new Notification({
    title: settings.breakTitle || "Time for a break!",
    body: stripHtml(settings.breakMessage),
    silent: process.platform !== "win32",
  });
  notification.show();
  if (process.platform !== "darwin") {
    setTimeout(() => notification.close(), 5000);
  }
  lastCompletedBreakTime = Date.now();
  scheduleNextBreak();
}

// ── Working Hours ──────────────────────────────────────────────────────────────

function checkInWorkingHours(): boolean {
  const settings = getSettings();
  if (!settings.workingHoursEnabled) return true;

  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  const dayKeys: (keyof Settings)[] = [
    "workingHoursSunday",
    "workingHoursMonday",
    "workingHoursTuesday",
    "workingHoursWednesday",
    "workingHoursThursday",
    "workingHoursFriday",
    "workingHoursSaturday",
  ];
  const daySettings = settings[dayKeys[day]] as { enabled: boolean; ranges: { fromMinutes: number; toMinutes: number }[] };
  if (!daySettings?.enabled) return false;

  return daySettings.ranges.some(
    (r) => minutes >= r.fromMinutes && minutes <= r.toMinutes,
  );
}

// ── Scheduling Engine ─────────────────────────────────────────────────────────

function doBreak() {
  if (breakActive) return;
  const settings = getSettings();

  if (!settings.breaksEnabled) return;
  if (getDisableEndTime()) return;
  if (!checkInWorkingHours()) return;

  breakActive = true;

  if (settings.notificationType === NotificationType.Notification) {
    showOsNotification();
  } else {
    doCreateBreakWindows();
  }
}

function tick() {
  const settings = getSettings();

  if (getDisableEndTime()) {
    checkDisableTimeout();
    return;
  }

  if (!settings.breaksEnabled) return;
  if (!checkInWorkingHours()) return;

  const idleTime = powerMonitor.getSystemIdleTime();
  if (
    settings.idleResetEnabled &&
    idleTime >= settings.idleResetLengthSeconds &&
    !breakActive
  ) {
    lastCompletedBreakTime = Date.now();
    scheduleNextBreak();
    return;
  }

  if (!breakActive && breakTime > 0 && Date.now() >= breakTime) {
    doBreak();
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle(IpcChannel.SettingsGet, () => getSettings());

ipcMain.handle(IpcChannel.SettingsSet, (_event, newSettings: Settings) => {
  setSettings(newSettings);
  buildTray();
});

ipcMain.handle(IpcChannel.BreakStart, (_event, windowId: number) => {
  if (windowId !== 0) return;

  const settings = getSettings();
  breakStartTime = Date.now();
  const breakEndTime = breakStartTime + settings.breakLengthSeconds * 1000;

  const displays = screen.getAllDisplays();
  breakWindows.forEach((win, i) => {
    if (win.isDestroyed()) return;
    const display = displays[i] ?? displays[0];
    const showBackdrop = settings.showBackdrop && settings.backdropOpacity > 0;
    if (showBackdrop) {
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

  const allowPostpone =
    settings.postponeBreakEnabled &&
    (settings.postponeLimit === 0 || postponeCount < settings.postponeLimit);

  const payload: BreakBeginPayload = {
    breakEndTime,
    breakStartTime,
    settings,
    postponeCount,
    allowPostpone,
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
  const settings = getSettings();
  postponeCount++;
  closeBreakWindows();
  scheduleNextBreak(settings.postponeSeconds);
});

// ── Tray ──────────────────────────────────────────────────────────────────────

const TRAY_ICON_DATA =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z0ABYBw1gGE0EhiGAQwMDAwAARgAAT4GAdyAAAAASUVORK5CYII=";

function buildTray() {
  if (!tray) return;

  const settings = getSettings();
  const disableEnd = getDisableEndTime();
  const inWorkingHours = checkInWorkingHours();
  const idleTime = powerMonitor.getSystemIdleTime();
  const idle =
    settings.idleResetEnabled &&
    idleTime >= settings.idleResetLengthSeconds;

  const getDisableTimeRemaining = (): string => {
    if (!disableEnd) return "";
    const remain = Math.max(0, disableEnd - Date.now());
    const min = Math.floor(remain / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (min < 1) return "<1m";
    if (h > 0) return `${h}h ${m}m`;
    return `${min}m`;
  };

  const setBreaksEnabled = (enabled: boolean) => {
    const s = getSettings();
    setSettings({ ...s, breaksEnabled: enabled });
    if (enabled) setDisableEndTime(null);
    else if (breakActive) closeBreakWindows();
    buildTray();
  };

  const disableFor = (ms: number) => {
    setBreaksEnabled(false);
    setDisableEndTime(Date.now() + ms);
    buildTray();
  };

  const nextBreakLabel =
    breakTime > 0 && settings.breaksEnabled && inWorkingHours && !breakActive
      ? `Next break in ${Math.max(1, Math.ceil((breakTime - Date.now()) / 60000))}m`
      : "";

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: nextBreakLabel,
      visible: !!nextBreakLabel,
      enabled: false,
    },
    {
      label: `Disabled for ${getDisableTimeRemaining()}`,
      visible: !!disableEnd && !settings.breaksEnabled,
      enabled: false,
    },
    {
      label: "Outside of working hours",
      visible: !inWorkingHours && settings.breaksEnabled,
      enabled: false,
    },
    {
      label: "Idle",
      visible: idle && settings.breaksEnabled,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Enable",
      click: () => setBreaksEnabled(true),
      visible: !settings.breaksEnabled,
    },
    {
      label: "Disable...",
      visible: settings.breaksEnabled,
      submenu: [
        { label: "Indefinitely", click: () => setBreaksEnabled(false) },
        { label: "30 minutes", click: () => disableFor(30 * 60 * 1000) },
        { label: "1 hour", click: () => disableFor(60 * 60 * 1000) },
        { label: "2 hours", click: () => disableFor(2 * 60 * 60 * 1000) },
        { label: "4 hours", click: () => disableFor(4 * 60 * 60 * 1000) },
        {
          label: "Rest of day",
          click: () => {
            const now = new Date();
            const end = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59,
            );
            disableFor(end.getTime() - now.getTime());
          },
        },
      ],
    },
    {
      label: "Take a Break Now",
      visible: settings.breaksEnabled && inWorkingHours && !breakActive,
      click: () => doBreak(),
    },
    {
      label: "Reset Timer",
      click: () => scheduleNextBreak(),
    },
    { type: "separator" },
    { label: "Settings...", click: createSettingsWindow },
    { label: "Quit", click: () => app.quit() },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
  updateTrayTooltip();
}

function initTray() {
  const icon = nativeImage.createFromDataURL(
    `data:image/png;base64,${TRAY_ICON_DATA}`,
  );
  tray = new Tray(icon);

  if (process.platform === "win32") {
    tray.on("click", () => tray?.popUpContextMenu());
  }

  buildTray();
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.on("ready", () => {
  const settings = getSettings();
  breakTime = Date.now() + settings.breakFrequencySeconds * 1000;

  initTray();
  setInterval(tick, 1000);
  setInterval(() => {
    checkDisableTimeout();
    updateTrayTooltip();
    buildTray();
  }, 5000);
});

app.on("window-all-closed", () => {
  /* App lives in tray */
});

app.on("activate", () => {
  createSettingsWindow();
});
