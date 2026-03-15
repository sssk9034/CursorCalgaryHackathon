/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";
import { animate } from "framer-motion/dom";
import type { BreakInitPayload, BreakBeginPayload, Settings } from "./types";
import {
  defaultSettings,
  daysConfig,
  NotificationType,
  SoundType,
} from "./types";

function playSound(
  type: string,
  isStart: boolean,
  volume = 1,
): void {
  if (type === SoundType.None) return;
  const name = `${type.toLowerCase()}_${isStart ? "start" : "end"}.wav`;
  const url = `./sounds/${name}`;
  try {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => {
      /* ignore playback errors */
    });
  } catch {
    // ignore
  }
}

async function loadSettings(): Promise<Settings> {
  return (await window.breakApp.invokeGetSettings()) ?? defaultSettings;
}

function secToInput(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function inputToSec(val: string): number {
  const [h, m] = val.split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}

function renderSettingsPage(s: Settings) {
  document.body.className = "settings-body";
  document.body.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "settings-wrap";

  const title = document.createElement("h1");
  title.className = "settings-title";
  title.textContent = "BreakTimer Settings";
  wrap.appendChild(title);

  const form = document.createElement("form");
  form.className = "settings-form";

  const section = (heading: string) => {
    const sec = document.createElement("section");
    sec.className = "settings-section";
    const h2 = document.createElement("h2");
    h2.textContent = heading;
    sec.appendChild(h2);
    return sec;
  };

  const addRow = (parent: HTMLElement, label: string, el: HTMLElement) => {
    const row = document.createElement("div");
    row.className = "settings-row";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(el);
    parent.appendChild(row);
  };

  const addToggle = (
    parent: HTMLElement,
    label: string,
    getVal: () => boolean,
    setVal: (v: boolean) => void,
  ) => {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = getVal();
    cb.addEventListener("change", () => setVal(cb.checked));
    addRow(parent, label, cb);
  };

  const addTime = (
    parent: HTMLElement,
    label: string,
    getVal: () => number,
    setVal: (v: number) => void,
  ) => {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = secToInput(getVal());
    inp.placeholder = "HH:MM";
    inp.addEventListener("change", () => {
      setVal(Math.max(60, inputToSec(inp.value)));
    });
    addRow(parent, label, inp);
  };

  const addSelect = (
    parent: HTMLElement,
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
  ) => {
    const sel = document.createElement("select");
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => onChange(sel.value));
    addRow(parent, label, sel);
  };

  const addColor = (
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => {
    const inp = document.createElement("input");
    inp.type = "color";
    inp.value = value;
    inp.addEventListener("input", () => onChange(inp.value));
    addRow(parent, label, inp);
  };

  const addNumber = (
    parent: HTMLElement,
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
  ) => {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.value = String(value);
    inp.min = String(min);
    inp.max = String(max);
    inp.addEventListener("change", () => {
      onChange(Math.min(max, Math.max(min, Number(inp.value) || min)));
    });
    addRow(parent, label, inp);
  };

  // Breaks
  const breaksSec = section("Breaks");
  addToggle(breaksSec, "Breaks enabled", () => s.breaksEnabled, (v) => (s.breaksEnabled = v));
  addTime(
    breaksSec,
    "Break every (HH:MM)",
    () => s.breakFrequencySeconds,
    (v) => (s.breakFrequencySeconds = v),
  );
  addTime(
    breaksSec,
    "Break length (HH:MM)",
    () => s.breakLengthSeconds,
    (v) => (s.breakLengthSeconds = v),
  );
  addSelect(
    breaksSec,
    "Notification type",
    s.notificationType,
    [
      { value: NotificationType.Popup, label: "Popup window" },
      { value: NotificationType.Notification, label: "OS notification" },
    ],
    (v) => (s.notificationType = v as typeof s.notificationType),
  );
  addToggle(
    breaksSec,
    "Postpone enabled",
    () => s.postponeBreakEnabled,
    (v) => (s.postponeBreakEnabled = v),
  );
  addTime(
    breaksSec,
    "Postpone length (HH:MM)",
    () => s.postponeSeconds,
    (v) => (s.postponeSeconds = v),
  );
  addNumber(
    breaksSec,
    "Postpone limit (0=unlimited)",
    s.postponeLimit,
    0,
    10,
    (v) => (s.postponeLimit = v),
  );
  addToggle(breaksSec, "Skip enabled", () => s.skipBreakEnabled, (v) => (s.skipBreakEnabled = v));
  addToggle(
    breaksSec,
    "Immediately start breaks",
    () => s.immediatelyStartBreaks,
    (v) => (s.immediatelyStartBreaks = v),
  );
  addNumber(
    breaksSec,
    "Grace period (seconds)",
    s.gracePeriodSeconds,
    0,
    300,
    (v) => (s.gracePeriodSeconds = v),
  );
  addNumber(
    breaksSec,
    "Countdown (seconds)",
    s.countdownSeconds,
    0,
    300,
    (v) => (s.countdownSeconds = v),
  );
  form.appendChild(breaksSec);

  // Smart breaks
  const smartSec = section("Smart Breaks");
  addToggle(
    smartSec,
    "Idle reset enabled",
    () => s.idleResetEnabled,
    (v) => (s.idleResetEnabled = v),
  );
  addTime(
    smartSec,
    "Idle reset after (HH:MM)",
    () => s.idleResetLengthSeconds || 300,
    (v) => (s.idleResetLengthSeconds = v),
  );
  form.appendChild(smartSec);

  // Working hours
  const whSec = section("Working Hours");
  addToggle(
    whSec,
    "Working hours enabled",
    () => s.workingHoursEnabled,
    (v) => (s.workingHoursEnabled = v),
  );
  daysConfig.forEach(({ key, label }) => {
    addToggle(
      whSec,
      label,
      () => (s[key] as { enabled: boolean }).enabled,
      (v) => ((s[key] as { enabled: boolean }).enabled = v),
    );
  });
  form.appendChild(whSec);

  // Customization
  const custSec = section("Customization");
  addRow(
    custSec,
    "Break title",
    (() => {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = s.breakTitle;
      inp.addEventListener("input", () => (s.breakTitle = inp.value));
      return inp;
    })(),
  );
  addRow(
    custSec,
    "Break message",
    (() => {
      const ta = document.createElement("textarea");
      ta.value = s.breakMessage;
      ta.rows = 3;
      ta.addEventListener("input", () => (s.breakMessage = ta.value));
      return ta;
    })(),
  );
  addColor(custSec, "Background", s.backgroundColor, (v) => (s.backgroundColor = v));
  addColor(custSec, "Text", s.textColor, (v) => (s.textColor = v));
  addToggle(custSec, "Show backdrop", () => s.showBackdrop, (v) => (s.showBackdrop = v));
  addNumber(
    custSec,
    "Backdrop opacity (0-100)",
    Math.round(s.backdropOpacity * 100),
    0,
    100,
    (v) => (s.backdropOpacity = v / 100),
  );
  addSelect(
    custSec,
    "Sound",
    s.soundType,
    [
      { value: SoundType.None, label: "None" },
      { value: SoundType.Gong, label: "Gong" },
      { value: SoundType.Blip, label: "Blip" },
      { value: SoundType.Bloop, label: "Bloop" },
      { value: SoundType.Ping, label: "Ping" },
      { value: SoundType.Scifi, label: "Scifi" },
    ],
    (v) => (s.soundType = v as typeof s.soundType),
  );
  addNumber(
    custSec,
    "Sound volume (0-100)",
    Math.round(s.breakSoundVolume * 100),
    0,
    100,
    (v) => (s.breakSoundVolume = v / 100),
  );
  form.appendChild(custSec);

  // System
  const sysSec = section("System");
  addToggle(sysSec, "Launch at startup", () => s.autoLaunch, (v) => (s.autoLaunch = v));
  form.appendChild(sysSec);

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.textContent = "Save";
  saveBtn.className = "settings-save-btn";
  form.appendChild(saveBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await window.breakApp.invokeSetSettings(s);
    const msg = document.createElement("div");
    msg.className = "settings-saved";
    msg.textContent = "Settings saved.";
    form.appendChild(msg);
    animate(msg, { opacity: [0, 1], y: [-4, 0] }, {
      duration: 0.25,
      ease: "easeOut",
    });
    setTimeout(() => msg.remove(), 2000);
  });

  wrap.appendChild(form);
  document.body.appendChild(wrap);

  animate(wrap, { opacity: [0, 1], y: [8, 0] }, {
    duration: 0.4,
    ease: "easeOut",
  });
  const sections = form.querySelectorAll(".settings-section");
  sections.forEach((el, i) => {
    animate(el as HTMLElement, { opacity: [0, 1], y: [12, 0] }, {
      duration: 0.35,
      delay: 0.05 + i * 0.04,
      ease: "easeOut",
    });
  });
}

// ── Type augmentation for contextBridge API ───────────────────────────────────

declare global {
  interface Window {
    breakApp: {
      onBreakInit: (cb: (payload: BreakInitPayload) => void) => void;
      onBreakBegin: (cb: (payload: BreakBeginPayload) => void) => void;
      onBreakClose: (cb: () => void) => void;
      invokeBreakStart: (windowId: number) => Promise<void>;
      invokeBreakEnd: (breakStartTime: number) => Promise<void>;
      invokeBreakSkip: () => Promise<void>;
      invokeBreakPostpone: () => Promise<void>;
      invokeGetSettings: () => Promise<import("./types").Settings>;
      invokeSetSettings: (s: import("./types").Settings) => Promise<void>;
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)} : ${pad2(s)}`;
}

/** Darken each RGB channel by factor (mimics createDarkerRgba) */
function darkenColor(hex: string, factor = 0.3, opacity = 0.7): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${opacity})`;
}

// ── Break-page renderer ───────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const page = params.get('page');

if (page === 'break') {
  const windowId = parseInt(params.get("windowId") ?? "0", 10);

  // ── Phase 1 & 2: BreakNotification ─────────────────────────────────────────

  const renderBreakNotification = (payload: BreakInitPayload) => {
    const { settings, timeSinceLastBreak, postponeCount } = payload;
    const {
      backgroundColor,
      textColor,
      postponeBreakEnabled,
      skipBreakEnabled,
      immediatelyStartBreaks,
      postponeLimit,
      gracePeriodSeconds = 60,
      countdownSeconds = 60,
    } = settings;

    const GRACE_MS = gracePeriodSeconds * 1000;
    const COUNTDOWN_MS = countdownSeconds * 1000;

    const allowPostpone =
      postponeBreakEnabled &&
      !immediatelyStartBreaks &&
      (postponeLimit === 0 || postponeCount < postponeLimit);
    const allowSkip = skipBreakEnabled && !immediatelyStartBreaks;

    document.body.className = 'break-notification-body';
    document.body.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'break-card';
    card.style.backgroundColor = backgroundColor;
    card.style.color = textColor;

    // Progress fill overlay (for countdown phase)
    const fill = document.createElement('div');
    fill.className = 'break-card-fill';
    fill.style.backgroundColor = textColor;
    card.appendChild(fill);

    // Content row
    const content = document.createElement('div');
    content.className = 'break-card-content';

    const textBlock = document.createElement('div');
    textBlock.className = 'break-card-text';

    const headline = document.createElement('div');
    headline.className = 'break-headline';

    const subline = document.createElement('div');
    subline.className = 'break-subline';
    subline.style.opacity = '0.75';
    subline.textContent = timeSinceLastBreak;

    textBlock.appendChild(headline);
    textBlock.appendChild(subline);
    content.appendChild(textBlock);

    // Buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'break-btn-group';

    let startBreakRequested = false;
    const startBreak = () => {
      if (startBreakRequested) return;
      startBreakRequested = true;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      card.style.transformOrigin = "center center";
      const cardWidth = card.offsetWidth;
      const cardHeight = card.offsetHeight;
      const size = Math.min(cardWidth, cardHeight);
      const circleX = centerX - size / 2;
      const circleY = centerY - size / 2;
      // Phase 1: collapse card into a perfect circle at center (square + scale + round + move to center)
      animate(content, { opacity: [1, 0] }, {
        duration: 0.2,
        ease: "easeOut",
      });
      animate(
        card,
        {
          x: [0, circleX],
          y: [0, circleY],
          width: [cardWidth, size],
          height: [cardHeight, size],
          scale: [1, 0.24],
          borderRadius: ["12px", "50%"],
        },
        {
          duration: 0.35,
          ease: [0.25, 0.46, 0.45, 0.94],
        },
      ).then(() => {
        // Phase 2: window moves to center of screen (circle is already centered in viewport)
        window.breakApp.invokeBreakStart(windowId);
      });
    };

    const startBtn = makeOutlineBtn('Start', textColor, startBreak);

    btnGroup.appendChild(startBtn);

    if (allowPostpone) {
      const snoozeBtn = makeOutlineBtn('Snooze', textColor, () => {
        window.breakApp.invokeBreakPostpone();
      });
      btnGroup.appendChild(snoozeBtn);
    }

    if (allowSkip) {
      const skipBtn = makeOutlineBtn('Skip', textColor, () => {
        window.breakApp.invokeBreakSkip();
      });
      btnGroup.appendChild(skipBtn);
    }

    content.appendChild(btnGroup);
    card.appendChild(content);
    document.body.appendChild(card);

    // Expanding circle reveal + slide down
    content.style.opacity = "0";
    card.style.clipPath = "circle(0% at 50% 50%)";

    animate(card, { y: [-120, 0] }, {
      duration: 0.4,
      ease: "easeOut",
    });

    animate(card, {
      clipPath: ["circle(0% at 50% 50%)", "circle(150% at 50% 50%)"],
    }, {
      duration: 1.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    });

    animate(content, { opacity: [0, 1] }, {
      duration: 0.3,
      delay: 0.7,
      ease: "easeOut",
    });

    // ── Two-phase timer ─────────────────────────────────────────────────────

    const startMs = Date.now();
    let phase: 'grace' | 'countdown' = immediatelyStartBreaks
      ? 'countdown'
      : 'grace';

    function tickNotification() {
      const elapsed = Date.now() - startMs;

      if (phase === 'grace') {
        headline.textContent = 'Start your break when ready\u2026';
        fill.style.width = '0%';

        if (elapsed >= GRACE_MS) {
          phase = 'countdown';
        }
      }

      if (phase === 'countdown') {
        const countdownElapsed = Math.max(0, elapsed - GRACE_MS);
        const remaining = Math.max(
          0,
          COUNTDOWN_MS - countdownElapsed,
        );
        const secs = Math.ceil(remaining / 1000);
        headline.textContent = `Break starting in ${secs}s\u2026`;

        const pct = ((COUNTDOWN_MS - remaining) / COUNTDOWN_MS) * 100;
        fill.style.width = `${pct}%`;

        if (remaining <= 0) {
          startBreak();
          return; // stop ticking
        }
      }

      requestAnimationFrame(tickNotification);
    }

    requestAnimationFrame(tickNotification);
  }

  const makeOutlineBtn = (
    label: string,
    color: string,
    onClick: () => void,
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = 'break-btn';
    btn.textContent = label;
    btn.style.borderColor = color;
    btn.style.color = color;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ── Phase 3: BreakProgress ──────────────────────────────────────────────────

  const renderBreakProgress = (payload: BreakBeginPayload) => {
    const { settings, breakEndTime, breakStartTime, allowPostpone } = payload;
    const {
      backgroundColor,
      textColor,
      breakTitle,
      breakMessage,
      showBackdrop,
      backdropOpacity,
      endBreakEnabled,
      breakLengthSeconds,
      postponeBreakEnabled,
    } = settings;

    document.body.className = "break-progress-body";

    // Full-screen backdrop (only when showBackdrop)
    const backdrop = document.createElement("div");
    backdrop.className = "break-backdrop";
    if (showBackdrop && backdropOpacity > 0) {
      backdrop.style.backgroundColor = darkenColor(
        backgroundColor,
        0.3,
        backdropOpacity,
      );
    } else {
      backdrop.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    }

    // Card
    const card = document.createElement('div');
    card.className = 'break-progress-card';
    card.style.backgroundColor = backgroundColor;
    card.style.color = textColor;

    // Header row: title + timer + end button
    const header = document.createElement('div');
    header.className = 'break-progress-header';

    const title = document.createElement('div');
    title.className = 'break-progress-title';
    title.textContent = breakTitle;

    const timer = document.createElement('div');
    timer.className = 'break-progress-timer';

    header.appendChild(title);
    header.appendChild(timer);

    // Message
    const msgEl = document.createElement('div');
    msgEl.className = 'break-progress-message';
    msgEl.innerHTML = breakMessage
      .split('\n')
      .map((line) => `<div>${line}</div>`)
      .join('');

    // Progress bar
    const progressWrap = document.createElement('div');
    progressWrap.className = 'break-progress-bar-wrap';
    const progressBar = document.createElement('div');
    progressBar.className = 'break-progress-bar';
    progressBar.style.backgroundColor = textColor;
    progressWrap.appendChild(progressBar);

    // End Break / Snooze button row
    const footer = document.createElement("div");
    footer.className = "break-progress-footer";

    if (allowPostpone && postponeBreakEnabled) {
      const snoozeBtn = makeOutlineBtn("Snooze", textColor, () => {
        window.breakApp.invokeBreakPostpone();
      });
      snoozeBtn.className = "break-btn break-end-btn";
      snoozeBtn.style.borderColor = textColor;
      snoozeBtn.style.color = textColor;
      footer.appendChild(snoozeBtn);
    }

    if (endBreakEnabled) {
      const endBtn = makeOutlineBtn("Cancel Break", textColor, () => {
        const isPrimary = windowId === 0;
        if (isPrimary && settings.soundType !== SoundType.None) {
          playSound(settings.soundType, false, settings.breakSoundVolume);
        }
        window.breakApp.invokeBreakEnd(breakStartTime);
      });
      endBtn.className = "break-btn break-end-btn";
      endBtn.style.borderColor = textColor;
      endBtn.style.color = textColor;
      footer.appendChild(endBtn);

      const halfMs = breakLengthSeconds * 500;
      setTimeout(() => {
        endBtn.textContent = "End Break";
      }, halfMs);
    }

    card.appendChild(header);
    card.appendChild(msgEl);
    card.appendChild(progressWrap);
    card.appendChild(footer);

    document.body.innerHTML = '';
    document.body.appendChild(backdrop);
    document.body.appendChild(card);

    // Fade in card content as it expands (avoids squished text during scale)
    const cardContent = [header, msgEl, progressWrap, footer];
    cardContent.forEach((el) => ((el as HTMLElement).style.opacity = "0"));

    animate(backdrop, { opacity: [0, 1] }, {
      duration: 0.35,
      ease: "easeOut",
    });

    // Expanding circle reveal: clip from center so the card is revealed as the circle grows
    card.style.clipPath = "circle(0% at 50% 50%)";
    card.style.transformOrigin = "center center";
    animate(
      card,
      {
        clipPath: ["circle(0% at 50% 50%)", "circle(150% at 50% 50%)"],
      },
      {
        duration: 1.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    );
    cardContent.forEach((el, i) => {
      animate(el as HTMLElement, { opacity: [0, 1] }, {
        duration: 0.3,
        delay: 0.7 + i * 0.03,
        ease: "easeOut",
      });
    });

    const totalMs = breakLengthSeconds * 1000;

    function tickProgress() {
      const remaining = Math.max(0, breakEndTime - Date.now());
      const elapsed = totalMs - remaining;
      const pct = Math.min(100, (elapsed / totalMs) * 100);

      timer.textContent = formatCountdown(remaining);
      progressBar.style.width = `${pct}%`;

      if (remaining <= 0) {
        const isPrimary = windowId === 0;
        if (isPrimary && settings.soundType !== SoundType.None) {
          playSound(settings.soundType, false, settings.breakSoundVolume);
        }
        window.breakApp.invokeBreakEnd(breakStartTime);
        return;
      }

      requestAnimationFrame(tickProgress);
    }

    requestAnimationFrame(tickProgress);
  }

  // ── Wire up IPC listeners ───────────────────────────────────────────────────

  window.breakApp.onBreakInit((payload) => {
    renderBreakNotification(payload);
  });

  window.breakApp.onBreakBegin((payload) => {
    const isPrimary = windowId === 0;
    if (isPrimary && payload.settings.soundType !== SoundType.None) {
      playSound(
        payload.settings.soundType,
        true,
        payload.settings.breakSoundVolume,
      );
    }
    renderBreakProgress(payload);
  });

  window.breakApp.onBreakClose(() => {
    window.close();
  });
} else if (page === "settings") {
  loadSettings().then(renderSettingsPage);
} else {
  document.body.innerHTML = "<p>BreakTimer</p>";
}
