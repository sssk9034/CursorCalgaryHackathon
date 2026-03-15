import { contextBridge, ipcRenderer } from "electron";
import {
  IpcChannel,
  BreakInitPayload,
  BreakBeginPayload,
  Settings,
} from "./types";

contextBridge.exposeInMainWorld("breakApp", {
  /** Renderer → main: open Google login via WorkOS */
  invokeLogin: () => ipcRenderer.invoke(IpcChannel.AuthLogin),

  /** Main → renderer: initial settings + context for the break window */
  onBreakInit: (cb: (payload: BreakInitPayload) => void) => {
    ipcRenderer.on(IpcChannel.BreakInit, (_event, payload: BreakInitPayload) =>
      cb(payload),
    );
  },

  /** Main → renderer: break has started, begin BreakProgress phase */
  onBreakBegin: (cb: (payload: BreakBeginPayload) => void) => {
    ipcRenderer.on(
      IpcChannel.BreakBegin,
      (_event, payload: BreakBeginPayload) => cb(payload),
    );
  },

  /** Main → renderer: close window immediately */
  onBreakClose: (cb: () => void) => {
    ipcRenderer.on(IpcChannel.BreakClose, () => cb());
  },

  /** Renderer → main: user clicked "Start" (windowId 0 only drives state) */
  invokeBreakStart: (windowId: number) =>
    ipcRenderer.invoke(IpcChannel.BreakStart, windowId),

  /** Renderer → main: break timer finished or user clicked "End Break" */
  invokeBreakEnd: (breakStartTime: number) =>
    ipcRenderer.invoke(IpcChannel.BreakEnd, breakStartTime),

  /** Renderer → main: user clicked "Skip" */
  invokeBreakSkip: () => ipcRenderer.invoke(IpcChannel.BreakSkip),

  /** Renderer → main: user clicked "Snooze" */
  invokeBreakPostpone: () => ipcRenderer.invoke(IpcChannel.BreakPostpone),

  /** Settings */
  invokeGetSettings: () =>
    ipcRenderer.invoke(IpcChannel.SettingsGet) as Promise<Settings>,
  invokeSetSettings: (settings: Settings) =>
    ipcRenderer.invoke(IpcChannel.SettingsSet, settings),
});
