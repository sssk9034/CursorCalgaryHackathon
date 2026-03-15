export enum NotificationType {
  Notification = "NOTIFICATION",
  Popup = "POPUP",
}

export enum SoundType {
  None = "NONE",
  Gong = "GONG",
  Blip = "BLIP",
  Bloop = "BLOOP",
  Ping = "PING",
  Scifi = "SCIFI",
}

export interface WorkingHoursRange {
  fromMinutes: number;
  toMinutes: number;
}

export interface WorkingHours {
  enabled: boolean;
  ranges: WorkingHoursRange[];
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
  showBackdrop: boolean;
  endBreakEnabled: boolean;
  postponeBreakEnabled: boolean;
  skipBreakEnabled: boolean;
  immediatelyStartBreaks: boolean;
  postponeSeconds: number;
  postponeLimit: number;
  idleResetLengthSeconds: number;
  gracePeriodSeconds: number;
  countdownSeconds: number;
  workingHoursEnabled: boolean;
  workingHoursMonday: WorkingHours;
  workingHoursTuesday: WorkingHours;
  workingHoursWednesday: WorkingHours;
  workingHoursThursday: WorkingHours;
  workingHoursFriday: WorkingHours;
  workingHoursSaturday: WorkingHours;
  workingHoursSunday: WorkingHours;
  breaksEnabled: boolean;
  idleResetEnabled: boolean;
  soundType: SoundType;
  breakSoundVolume: number;
  autoLaunch: boolean;
}

export const defaultWorkingRange: WorkingHoursRange = {
  fromMinutes: 9 * 60,
  toMinutes: 18 * 60,
};

export const defaultWorkingHours: WorkingHours = {
  enabled: true,
  ranges: [defaultWorkingRange],
};

export const defaultSettings: Settings = {
  breakFrequencySeconds: 1680,
  breakLengthSeconds: 120,
  backgroundColor: "#16a085",
  textColor: "#ffffff",
  breakTitle: "Time for a break.",
  breakMessage: "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
  notificationType: NotificationType.Popup,
  backdropOpacity: 0.7,
  showBackdrop: true,
  endBreakEnabled: true,
  postponeBreakEnabled: true,
  skipBreakEnabled: true,
  immediatelyStartBreaks: false,
  postponeSeconds: 300,
  postponeLimit: 0,
  idleResetLengthSeconds: 300,
  gracePeriodSeconds: 60,
  countdownSeconds: 60,
  workingHoursEnabled: true,
  workingHoursMonday: { ...defaultWorkingHours },
  workingHoursTuesday: { ...defaultWorkingHours },
  workingHoursWednesday: { ...defaultWorkingHours },
  workingHoursThursday: { ...defaultWorkingHours },
  workingHoursFriday: { ...defaultWorkingHours },
  workingHoursSaturday: { enabled: false, ranges: [defaultWorkingRange] },
  workingHoursSunday: { enabled: false, ranges: [defaultWorkingRange] },
  breaksEnabled: true,
  idleResetEnabled: true,
  soundType: SoundType.Gong,
  breakSoundVolume: 1,
  autoLaunch: false,
};

export enum IpcChannel {
  AuthLogin = "auth:login",
  BreakInit = "break:init",
  BreakStart = "break:start",
  BreakBegin = "break:begin",
  BreakEnd = "break:end",
  BreakClose = "break:close",
  BreakSkip = "break:skip",
  BreakPostpone = "break:postpone",
  BreakWindowResize = "break:resize",
  SettingsGet = "settings:get",
  SettingsSet = "settings:set",
}

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
  postponeCount: number;
  allowPostpone: boolean;
}

export interface DayConfig {
  key:
    | "workingHoursMonday"
    | "workingHoursTuesday"
    | "workingHoursWednesday"
    | "workingHoursThursday"
    | "workingHoursFriday"
    | "workingHoursSaturday"
    | "workingHoursSunday";
  label: string;
}

export const daysConfig: DayConfig[] = [
  { key: "workingHoursMonday", label: "Monday" },
  { key: "workingHoursTuesday", label: "Tuesday" },
  { key: "workingHoursWednesday", label: "Wednesday" },
  { key: "workingHoursThursday", label: "Thursday" },
  { key: "workingHoursFriday", label: "Friday" },
  { key: "workingHoursSaturday", label: "Saturday" },
  { key: "workingHoursSunday", label: "Sunday" },
];
