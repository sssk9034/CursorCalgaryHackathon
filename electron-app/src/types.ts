export enum NotificationType {
  Notification = "NOTIFICATION",
  Popup = "POPUP",
}

export enum IpcChannel {
  BreakInit = "break:init",
  BreakStart = "break:start",
  BreakBegin = "break:begin",
  BreakEnd = "break:end",
  BreakClose = "break:close",
  BreakSkip = "break:skip",
  BreakPostpone = "break:postpone",
  BreakWindowResize = "break:resize",
}

export interface Settings {
  breakFrequencySeconds: number;
  breakLengthSeconds: number;
  backgroundColor: string;
  textColor: string;
  breakTitle: string;
  breakMessage: string;
  notificationType: NotificationType;
  backdropOpacity: number;
  endBreakEnabled: boolean;
  postponeBreakEnabled: boolean;
  skipBreakEnabled: boolean;
  immediatelyStartBreaks: boolean;
  postponeSeconds: number;
  postponeLimit: number;
  idleResetLengthSeconds: number;
}

export const defaultSettings: Settings = {
  breakFrequencySeconds: 1680,
  breakLengthSeconds: 120,
  backgroundColor: "#16a085",
  textColor: "#ffffff",
  breakTitle: "Time for a break.",
  breakMessage: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
  notificationType: NotificationType.Popup,
  backdropOpacity: 0.7,
  endBreakEnabled: true,
  postponeBreakEnabled: true,
  skipBreakEnabled: true,
  immediatelyStartBreaks: false,
  postponeSeconds: 300,
  postponeLimit: 0,
  idleResetLengthSeconds: 300,
};

export interface BreakInitPayload {
  settings: Settings;
  timeSinceLastBreak: string;
  windowId: number;
  postponeCount: number;
}

export interface BreakBeginPayload {
  breakEndTime: number;
  breakStartTime: number;
  settings: Settings;
}
