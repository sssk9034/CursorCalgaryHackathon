import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  login: () => ipcRenderer.invoke('login'),
  onAuthSuccess: (callback: (data: any) => void) =>
    ipcRenderer.on('auth-success', (_event, data) => callback(data)),
  onUserProfile: (callback: (profile: any) => void) =>
    ipcRenderer.on('user-profile', (_event, profile) => callback(profile)),
});