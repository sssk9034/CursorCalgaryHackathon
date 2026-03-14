# Break Notification Analysis — BreakTimer App

## Overview

BreakTimer is an Electron-based desktop app that periodically reminds users to take breaks. It supports **two distinct notification modes**, both triggered by the same scheduling engine but presenting very differently to the user.

---

## 1. How the Break Notification Is Created

### 1.1 Scheduling Engine (`app/main/lib/breaks.ts`)

A `setInterval` tick fires **every second** (`initBreaks()` → `tick()`). On each tick, the system:

1. Checks working hours and idle state.
2. If `breakTime` has passed, calls `doBreak()`.

`scheduleNextBreak()` sets `breakTime = moment().add(seconds, "seconds")` where `seconds` is `breakFrequencySeconds` (default: **28 minutes**, i.e. 1680 s).

```ts
tickInterval = setInterval(tick, 1000);
```

### 1.2 Two Notification Types (`NotificationType` enum)

```ts
export enum NotificationType {
  Notification = "NOTIFICATION",  // OS-native toast
  Popup = "POPUP",                // custom Electron window (default)
}
```

#### Type A — OS Notification (`NotificationType.Notification`)
Handled entirely in `doBreak()`:

```ts
showNotification("Time for a break!", stripHtml(settings.breakMessage));
```

`showNotification()` (`app/main/lib/notifications.ts`) wraps Electron's `new Notification(...)`:
- Sets `icon` to the tray icon PNG (non-macOS only).
- Sets `silent: true` on non-Windows (Windows uses its own sound).
- Auto-closes after **5 seconds** on non-macOS via `setTimeout`.
- Fires an optional `onClick` callback.
- After showing, immediately marks the break as completed and reschedules — **no window is created**.

#### Type B — Popup (`NotificationType.Popup`) — default
`doBreak()` calls `createBreakWindows()` (`app/main/lib/windows.ts`), which spawns **one `BrowserWindow` per display**.

Each window is:
- **Frameless**, **transparent**, **non-focusable**, `resizable: false`
- Initially sized **80 px tall**, **450–550 px wide** (width scales with how many action buttons are shown)
- Positioned **50 px from the top**, horizontally centered on its display
- `setAlwaysOnTop(true)`, `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
- Loads the renderer with `?page=break&windowId=N`

```ts
const breakWindow = new BrowserWindow({
  frame: false, transparent: true, focusable: false,
  x: display.bounds.x + display.bounds.width / 2 - notificationWidth / 2,
  y: display.bounds.y + 50,
  width: notificationWidth, height: 80,
  ...
});
breakWindow.setAlwaysOnTop(true);
breakWindow.showInactive(); // doesn't steal focus
```

---

## 2. How the Break Notification Looks

### 2.1 Phase 1 — Pre-break Banner (`BreakNotification` component)

**File:** `app/renderer/components/break/break-notification.tsx`

A rounded pill/card (`rounded-xl`) that slides in from below with a fade+scale animation (Framer Motion):

```
┌────────────────────────────────────────────────────────────────┐
│  Start your break when ready...          [ Start ] [ Snooze ]  │
│  28m since last break                                           │
└────────────────────────────────────────────────────────────────┘
```

- **Background color**: from `settings.backgroundColor` (default `#16a085` — teal).
- **Text color**: from `settings.textColor` (default `#ffffff` — white).
- **Headline**: "Start your break when ready..." (grace phase) or "Break starting in Xs..." (countdown phase).
- **Sub-line**: time since last break (e.g. "28m since last break"), formatted by `formatTimeSinceLastBreak()`.
- **Buttons** (transparent outline style with subtle hover effect):
  - **Start** — always visible
  - **Snooze** — shown if `postponeBreakEnabled && allowPostpone && !immediatelyStartBreaks`
  - **Skip** — shown if `skipBreakEnabled && !immediatelyStartBreaks`
- **Progress fill**: during the countdown phase a semi-transparent overlay (`opacity: 0.15`) fills in from left to right, showing how close to automatic break start the user is.

Entrance animation:
```ts
initial={{ opacity: 0, scale: 0.9, y: 10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
transition={{ duration: 0.3 }}
```

### 2.2 Phase 2 — Full-screen Break (`BreakProgress` component)

**File:** `app/renderer/components/break/break-progress.tsx`

When the break actually starts (countdown over, or user clicks Start), the window resizes via IPC (`BreakWindowResize`):
- **With backdrop**: fullscreen on the display.
- **Without backdrop**: centered 500×300 px window.

The card itself is `w-[500px] rounded-xl` centered on screen, rendered as:

```
┌──────────────────────────────────────────────┐
│  Time for a break.                [End Break] │
│                                               │
│  Rest your eyes.                              │
│  Stretch your legs.                           │
│  Breathe. Relax.                              │
│                                               │
│                                     02 : 00  │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└──────────────────────────────────────────────┘
```

- **Title** (`breakTitle`): large (`text-3xl font-semibold`), default "Time for a break."
- **Message** (`breakMessage`): medium (`text-lg opacity-80`), supports newlines, default:
  ```
  Rest your eyes.
  Stretch your legs.
  Breathe. Relax.
  ```
- **Timer**: `MM : SS` countdown in monospace-style (`tabular-nums`), top-right.
- **Progress bar**: thin (`h-2 rounded-full`), fills left→right as break elapses; background is `rgba(255,255,255,0.2)`, fill uses `textColor`.
- **Backdrop**: full-screen overlay using `createDarkerRgba()` (multiplies each RGB channel by 0.3) at `settings.backdropOpacity` (default 0.7).
- **End Break button**: label is "Cancel Break" for the first 50% of the break, then "End Break" — only shown if `endBreakEnabled`.

Fade-in animation:
```ts
initial={{ opacity: 0, y: -20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
```

---

## 3. How the Break Notification Functions

### 3.1 State Machine

```
[tick() every 1s]
       │
       ▼
 breakTime passed?  ──No──▶ (wait)
       │Yes
       ▼
   doBreak()
       │
   ┌───┴───────────┐
   │Notification   │ Popup (default)
   │(OS toast)     │
   │               ▼
   │        createBreakWindows()
   │               │
   │               ▼
   │      BreakNotification shown
   │      (phase="grace", 60s)
   │               │
   │               ▼
   │      phase="countdown" (60s more)
   │      auto-start countdown fills
   │               │
   │        User action or timer
   │         ┌─────┴──────┐──────────┐
   │       Start         Snooze     Skip
   │         │             │          │
   │         ▼             ▼          ▼
   │    BreakProgress  scheduleNext  scheduleNext
   │    (full-screen)  (postpone)    (normal freq)
   │         │
   │   Timer counts down
   │   (breakLengthSeconds, default 2 min)
   │         │
   │         ▼
   │    onEndBreak() → invokeBreakEnd()
   │    → sendIpc(BreakEnd) → windows close
   │
   ▼
scheduleNextBreak()
```

### 3.2 Two-Phase Pre-break Timer

`BreakNotification` runs its own interval (100 ms ticks):

| Time | Phase | UX |
|------|-------|----|
| 0–60 s | `grace` | "Start your break when ready..." — no urgency |
| 60–120 s | `countdown` | "Break starting in Xs..." + fill animation |
| 120 s | — | `onCountdownOver()` fires → break starts automatically |

### 3.3 Multi-Display Synchronization

- One `BrowserWindow` is created per connected display.
- When user clicks **Start**, window `0` calls `ipcRenderer.invokeBreakStart()`.
- Main process computes `breakEndTime = Date.now() + breakLengthMs` and broadcasts it via `sendIpc(BreakEnd)` to **all** windows, so every display's timer is synchronized to the same end time.
- Similarly, `invokeBreakEnd()` broadcasts to all windows to close simultaneously.

### 3.4 Sound

Sounds are played by a hidden `soundsWindow` (`BrowserWindow`). The primary window (`windowId === "0"`) triggers sound via IPC:
- **Start sound**: played when `BreakProgress` mounts.
- **End sound**: played when break ends, via `invokeEndSound()`.

Available sound types: `Gong`, `Blip`, `Bloop`, `Ping`, `Scifi`, `None`.

### 3.5 Break Completion Tracking

A break only counts as "completed" if the user stayed for at least **50% of `breakLengthSeconds`**. This is enforced in `completeBreakTracking()`:

```ts
if (breakDurationMs >= halfRequiredDuration) {
  markBreakCompleted(...);  // resets lastCompletedBreakTime
}
```

The tray icon and "time since last break" display are updated accordingly.

### 3.6 Idle/Sleep Detection

- If the system goes **idle** for `idleResetLengthSeconds` (default 5 min), the break timer resets — the app considers this an automatic break.
- If the computer **sleeps** for longer than `breakFrequencySeconds`, the break is silently skipped.
- An optional "Break automatically detected" OS notification can be shown on idle reset.

### 3.7 Postpone / Skip Limits

`postponeLimit` (default 0 = unlimited) caps how many times Snooze can be used per break cycle. Once the limit is reached, the Snooze button is hidden from the notification.

---

## Key Files Reference

| File | Role |
|------|------|
| `app/main/lib/breaks.ts` | Break scheduling, tick loop, idle/sleep detection |
| `app/main/lib/notifications.ts` | OS-native `Notification` wrapper |
| `app/main/lib/windows.ts` | `createBreakWindows()` — Electron window creation |
| `app/main/lib/ipc.ts` | IPC handlers bridging main ↔ renderer |
| `app/renderer/components/break.tsx` | Top-level break renderer, state machine |
| `app/renderer/components/break/break-notification.tsx` | Pre-break banner UI (grace + countdown) |
| `app/renderer/components/break/break-progress.tsx` | Full-screen break UI (timer + progress bar) |
| `app/renderer/components/break/utils.ts` | Color helpers, time formatting |
| `app/types/settings.ts` | `Settings` interface + `defaultSettings` |
| `app/types/ipc.ts` | `IpcChannel` enum |
