import {contextBridge, ipcRenderer} from 'electron';

// Whitelist of safe IPC channels for the renderer process
const SAFE_CHANNELS = [
  'update-available',
  'update-downloaded',
  'update-error',
  'check-for-updates',
  'download-update',
  'restart-app',
  'get-app-version'
];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // Update related APIs
    onUpdateAvailable: (callback: () => void) => {
      ipcRenderer.on('update-available', callback);
    },
    onUpdateDownloaded: (callback: () => void) => {
      ipcRenderer.on('update-downloaded', callback);
    },
    onUpdateError: (callback: (error: string) => void) => {
      ipcRenderer.on('update-error', (_, error: string) => callback(error));
    },
    removeAllUpdateListeners: () => {
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('update-downloaded');
      ipcRenderer.removeAllListeners('update-error');
    },
    checkForUpdates: () => {
      ipcRenderer.send('check-for-updates');
    },
    downloadUpdate: () => {
      ipcRenderer.send('download-update');
    },
    restartApp: () => {
      ipcRenderer.send('restart-app');
    },
    getAppVersion: (): Promise<string> => {
      return ipcRenderer.invoke('get-app-version');
    }
  }
);

// Also expose a simple version check for the UI
export {};
