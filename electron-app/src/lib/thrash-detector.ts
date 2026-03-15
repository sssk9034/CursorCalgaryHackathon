import { EventEmitter } from 'node:events';

interface TabEvent {
  url?: string;
  name?: string;
  time_utc: string;
  tabCount: number;
}

interface ThrashAlert {
  switchCount: number;
  uniqueTabs: number;
  windowSeconds: number;
  tabCount: number;
  timestamp: string;
}

// Sliding window that detects rapid context switching
const WINDOW_MS = 30_000;         // 30-second sliding window
const SWITCH_THRESHOLD = 5;       // switches in the window to trigger
const UNIQUE_TAB_THRESHOLD = 3;   // must be across 3+ different tabs (not just toggling two)
const COOLDOWN_MS = 30_000;       // don't re-alert for 30s after firing

export class ThrashDetector extends EventEmitter {
  private buffer: TabEvent[] = [];
  private lastAlertTime = 0;

  push(event: TabEvent) {
    this.buffer.push(event);
    this.pruneOldEvents();
    this.evaluate();
  }

  private pruneOldEvents() {
    const cutoff = Date.now() - WINDOW_MS;
    this.buffer = this.buffer.filter(
      (e) => new Date(e.time_utc).getTime() > cutoff
    );
  }

  private evaluate() {
    if (this.buffer.length < SWITCH_THRESHOLD) return;

    const uniqueUrls = new Set(this.buffer.map((e) => e.url).filter(Boolean));
    if (uniqueUrls.size < UNIQUE_TAB_THRESHOLD) return;

    const now = Date.now();
    if (now - this.lastAlertTime < COOLDOWN_MS) return;

    this.lastAlertTime = now;

    const latestEvent = this.buffer[this.buffer.length - 1];
    const alert: ThrashAlert = {
      switchCount: this.buffer.length,
      uniqueTabs: uniqueUrls.size,
      windowSeconds: WINDOW_MS / 1000,
      tabCount: latestEvent.tabCount,
      timestamp: new Date().toISOString(),
    };

    console.log('🚨 THRASH DETECTED:', JSON.stringify(alert));
    this.emit('thrash', alert);
  }
}
