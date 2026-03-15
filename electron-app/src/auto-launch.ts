import AutoLaunch from "auto-launch";

const appName = "my-app";

const appConfig: { name: string; path?: string } = { name: appName };
if (process.env.APPIMAGE) {
  appConfig.path = process.env.APPIMAGE;
}

const appLauncher = new AutoLaunch(appConfig);

export function setAutoLaunch(enabled: boolean): void {
  if (process.env.NODE_ENV !== "development") {
    if (enabled) {
      appLauncher.enable();
    } else {
      appLauncher.disable();
    }
  }
}
