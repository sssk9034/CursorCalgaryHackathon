import dotenv from "dotenv";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  Tray,
} from "electron";
import path from "node:path";
import { execFile } from "node:child_process";

// Load .env from repo root (two levels up from electron-app/)
dotenv.config({ path: path.resolve(app.getAppPath(), "..", ".env") });
import started from "electron-squirrel-startup";
import {
  NotificationType,
  IpcChannel,
  Settings,
  BreakInitPayload,
  BreakBeginPayload,
} from "./types";
import { getSettings, setSettings, getDisableEndTime, setDisableEndTime } from "./store";
import { initDb } from "./lib/db";
import { startEventServer } from "./lib/event-server";
import { getSourceSnapshot } from "./lib/linear";

if (started) {
  app.quit();
}

// ── State ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
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

function loadRendererWindow(
  win: BrowserWindow,
  query?: Record<string, string>,
) {
  const queryString = query
    ? new URLSearchParams(query).toString()
    : "";

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = queryString
      ? `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?${queryString}`
      : MAIN_WINDOW_VITE_DEV_SERVER_URL;
    void win.loadURL(url);
    return;
  }

  const filePath = path.join(
    __dirname,
    `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
  );

  if (query) {
    void win.loadFile(filePath, { query });
    return;
  }

  void win.loadFile(filePath);
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: "#f7f7f8",
    title: "Harbour",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    trafficLightPosition:
      process.platform === "darwin" ? { x: 14, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  loadRendererWindow(mainWindow);

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  return mainWindow;
}

ipcMain.handle("harbour:get-sources", async () => {
  return getSourceSnapshot();
});

// ── Break Windows ─────────────────────────────────────────────────────────────

function createBreakWindow(
  display: Electron.Display,
  windowId: number,
  settings: Settings,
): BrowserWindow {
  const notificationWidth =
    settings.postponeBreakEnabled || settings.skipBreakEnabled ? 550 : 450;
  // On Linux, use workArea (excludes top panel/taskbar) so the window appears at
  // the top of the visible area; some WMs ignore initial position, so we also
  // call setPosition after show.
  const area =
    process.platform === "linux" ? display.workArea : display.bounds;
  const x = Math.round(
    area.x + area.width / 2 - notificationWidth / 2,
  );
  const y = area.y + (process.platform === "linux" ? 10 : 0);

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

  loadRendererWindow(win, Object.fromEntries(params));

  win.showInactive();

  // On Linux, re-apply position after show; some window managers ignore initial bounds
  if (process.platform === "linux") {
    win.setPosition(x, y);
  }

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

  loadRendererWindow(settingsWindow, Object.fromEntries(params));

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

// ── Thrash Sound ─────────────────────────────────────────────────────────────

function getThrashSoundPath(): string {
  const settings = getSettings();
  const soundName = settings.soundType.toLowerCase() || "gong";
  // In dev: app.getAppPath() → electron-app/
  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, "sounds")
    : path.join(app.getAppPath(), "public", "sounds");
  return path.join(baseDir, `${soundName}_start.wav`);
}

function playThrashSound(): void {
  const settings = getSettings();
  if (settings.soundType === "NONE") return;

  const soundPath = getThrashSoundPath();
  console.log("Playing thrash sound from:", soundPath);
  if (process.platform === "darwin") {
    execFile("afplay", [soundPath], (err) => {
      if (err) console.error("Failed to play thrash sound:", err);
    });
  } else if (process.platform === "win32") {
    execFile("powershell", ["-c", `(New-Object Media.SoundPlayer '${soundPath}').PlaySync()`], (err) => {
      if (err) console.error("Failed to play thrash sound:", err);
    });
  } else {
    // Linux: try aplay (ALSA), fall back to paplay (PulseAudio)
    execFile("aplay", [soundPath], (err) => {
      if (err) {
        execFile("paplay", [soundPath], (err2) => {
          if (err2) console.error("Failed to play thrash sound:", err2);
        });
      }
    });
  }
}

/** Like doBreak() but skips the working-hours check — thrash should always alert */
function doThrashBreak() {
  if (breakActive) return;
  const settings = getSettings();

  if (!settings.breaksEnabled) return;
  if (getDisableEndTime()) return;
  // Intentionally skip checkInWorkingHours()

  breakActive = true;

  if (settings.notificationType === NotificationType.Notification) {
    showOsNotification();
  } else {
    doCreateBreakWindows();
  }
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

// Match renderer card animation (0.5s) so window and card move as one
const CENTER_ANIMATION_MS = 500;
const CENTER_ANIMATION_FRAME_MS = 16;

/** Ease-out: matches renderer cubic-bezier(0.25, 0.46, 0.45, 0.94) for unified feel */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function animateWindowToCenter(
  win: BrowserWindow,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  onComplete: () => void,
): void {
  const startBounds = win.getBounds();
  const startX = startBounds.x;
  const startY = startBounds.y;
  const startTime = Date.now();

  const tick = () => {
    if (win.isDestroyed()) {
      onComplete();
      return;
    }
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / CENTER_ANIMATION_MS, 1);
    const eased = easeOutCubic(t);
    const x = Math.round(startX + (centerX - startX) * eased);
    const y = Math.round(startY + (centerY - startY) * eased);
    win.setBounds({ x, y, width, height });

    if (t >= 1) {
      onComplete();
      return;
    }
    setTimeout(tick, CENTER_ANIMATION_FRAME_MS);
  };
  tick();
}

ipcMain.handle(IpcChannel.BreakStart, (_event, windowId: number) => {
  if (windowId !== 0) return;

  const settings = getSettings();
  breakStartTime = Date.now();
  const breakEndTime = breakStartTime + settings.breakLengthSeconds * 1000;

  const displays = screen.getAllDisplays();

  // Animate each break window to the center of its display
  const targets: { win: BrowserWindow; centerX: number; centerY: number; width: number; height: number }[] = [];
  breakWindows.forEach((win) => {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    const centerX = Math.round(area.x + area.width / 2 - bounds.width / 2);
    const centerY = Math.round(area.y + area.height / 2 - bounds.height / 2);
    targets.push({
      win,
      centerX,
      centerY,
      width: bounds.width,
      height: bounds.height,
    });
  });

  if (targets.length === 0) return;

  let completed = 0;
  const maybeFinish = () => {
    completed += 1;
    if (completed < targets.length) return;

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

    breakWindows.forEach((win, i) => {
      if (win.isDestroyed()) return;
      const display = displays[i] ?? displays[0];
      const showBackdrop = settings.showBackdrop && settings.backdropOpacity > 0;
      win.setFocusable(true);
      if (showBackdrop) {
        win.setBounds({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
        });
      } else {
        win.setBounds({
          x: Math.round(display.bounds.x + display.bounds.width / 2 - 250),
          y: Math.round(display.bounds.y + display.bounds.height / 2 - 150),
          width: 500,
          height: 300,
        });
      }
    });

    sendToBreakWindows(IpcChannel.BreakBegin, payload);
  };

  targets.forEach(({ win, centerX, centerY, width, height }) => {
    animateWindowToCenter(win, centerX, centerY, width, height, maybeFinish);
  });
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

function getTrayIconPath(): string {
  const baseDir = app.isPackaged
    ? process.resourcesPath
    : app.getAppPath();
  return path.join(baseDir, "image.png");
}

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

const TRAY_ICON_FALLBACK =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z0ABYBw1gGE0EhiGAQwMDAwAARgAAT4GAdyAAAAASUVORK5CYII=";

/** Menubar/tray icon size; 22px fits macOS/Linux, scales on Windows */
const TRAY_ICON_SIZE = 22;

function initTray() {
  const iconPath = getTrayIconPath();
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createFromDataURL(
      `data:image/png;base64,${TRAY_ICON_FALLBACK}`,
    );
  }
  const resized = icon.resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  tray = new Tray(resized.isEmpty() ? icon : resized);

  if (process.platform === "win32") {
    tray.on("click", () => tray?.popUpContextMenu());
  }

  buildTray();
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.on("ready", () => {
  initDb();
  startEventServer({
    onThrash: () => {
      playThrashSound();
      doThrashBreak();
    },
  });

  const settings = getSettings();
  breakTime = Date.now() + settings.breakFrequencySeconds * 1000;

  initTray();
  createMainWindow();
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
  createMainWindow();
});
