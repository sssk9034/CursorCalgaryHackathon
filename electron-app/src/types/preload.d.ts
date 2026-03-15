import type { BreakBeginPayload, BreakInitPayload, Settings } from '../types';
import type { SourceSnapshot } from './harbour';

declare global {
  interface Window {
    breakApp?: {
      onBreakInit: (cb: (payload: BreakInitPayload) => void) => void;
      onBreakBegin: (cb: (payload: BreakBeginPayload) => void) => void;
      onBreakClose: (cb: () => void) => void;
      invokeBreakStart: (windowId: number) => Promise<void>;
      invokeBreakEnd: (breakStartTime: number) => Promise<void>;
      invokeBreakSkip: () => Promise<void>;
      invokeBreakPostpone: () => Promise<void>;
      invokeGetSettings: () => Promise<Settings>;
      invokeSetSettings: (settings: Settings) => Promise<void>;
    };
    harbourDesktop?: {
      getSources: () => Promise<SourceSnapshot>;
    };
  }
}

export {};
