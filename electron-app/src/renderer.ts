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

import './index.css';
import type { BreakInitPayload, BreakBeginPayload } from './types';

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
  const windowId = parseInt(params.get('windowId') ?? '0', 10);

  // Grace + countdown durations (ms)
  const GRACE_MS = 60_000;
  const COUNTDOWN_MS = 60_000;

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
    } = settings;

    const allowPostpone =
      postponeBreakEnabled &&
      !immediatelyStartBreaks &&
      (postponeLimit === 0 || postponeCount < postponeLimit);
    const allowSkip = skipBreakEnabled && !immediatelyStartBreaks;

    document.body.className = 'break-notification-body';
    document.body.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'break-card break-card-enter';
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

    const startBtn = makeOutlineBtn('Start', textColor, () => {
      window.breakApp.invokeBreakStart(windowId);
    });

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
          window.breakApp.invokeBreakStart(windowId);
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
    const { settings, breakEndTime, breakStartTime } = payload;
    const {
      backgroundColor,
      textColor,
      breakTitle,
      breakMessage,
      backdropOpacity,
      endBreakEnabled,
      breakLengthSeconds,
    } = settings;

    document.body.className = 'break-progress-body';

    // Full-screen backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'break-backdrop';
    backdrop.style.backgroundColor = darkenColor(
      backgroundColor,
      0.3,
      backdropOpacity,
    );

    // Card
    const card = document.createElement('div');
    card.className = 'break-progress-card break-progress-enter';
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

    // End Break button row
    const footer = document.createElement('div');
    footer.className = 'break-progress-footer';

    if (endBreakEnabled) {
      const endBtn = makeOutlineBtn('Cancel Break', textColor, () => {
        window.breakApp.invokeBreakEnd(breakStartTime);
      });
      endBtn.className = 'break-btn break-end-btn';
      endBtn.style.borderColor = textColor;
      endBtn.style.color = textColor;
      footer.appendChild(endBtn);

      // After 50% of break time, change label
      const halfMs = breakLengthSeconds * 500;
      setTimeout(() => {
        endBtn.textContent = 'End Break';
      }, halfMs);
    }

    card.appendChild(header);
    card.appendChild(msgEl);
    card.appendChild(progressWrap);
    card.appendChild(footer);

    document.body.innerHTML = '';
    document.body.appendChild(backdrop);
    document.body.appendChild(card);

    const totalMs = breakLengthSeconds * 1000;

    function tickProgress() {
      const remaining = Math.max(0, breakEndTime - Date.now());
      const elapsed = totalMs - remaining;
      const pct = Math.min(100, (elapsed / totalMs) * 100);

      timer.textContent = formatCountdown(remaining);
      progressBar.style.width = `${pct}%`;

      if (remaining <= 0) {
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
    renderBreakProgress(payload);
  });

  window.breakApp.onBreakClose(() => {
    window.close();
  });
}
