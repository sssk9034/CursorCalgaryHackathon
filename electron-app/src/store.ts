import Store from "electron-store";
import { setAutoLaunch } from "./auto-launch";
import { defaultSettings, Settings } from "./types";

const store = new Store({
  defaults: {
    settings: defaultSettings,
    disableEndTime: null as number | null,
  },
});

export function getSettings(): Settings {
  const stored = store.get("settings") as Partial<Settings> | undefined;
  return Object.assign({}, defaultSettings, stored) as Settings;
}

export function setSettings(settings: Settings): void {
  const current = getSettings();
  if (current.autoLaunch !== settings.autoLaunch) {
    setAutoLaunch(settings.autoLaunch);
  }
  store.set("settings", settings);
}

export function setDisableEndTime(endTime: number | null): void {
  store.set("disableEndTime", endTime);
}

export function getDisableEndTime(): number | null {
  return store.get("disableEndTime") as number | null;
}
