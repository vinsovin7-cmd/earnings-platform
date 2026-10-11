import {createEffect, createSignal, onCleanup, Show} from 'solid-js';
import classNames from '@helpers/string/classNames';

// Declare the electronAPI interface for TypeScript
declare global {
  interface Window {
    electronAPI?: {
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      removeAllUpdateListeners: () => void;
      checkForUpdates: () => void;
      downloadUpdate: () => void;
      restartApp: () => void;
      getAppVersion: () => Promise<string>;
    };
  }
}

export default function ElectronUpdateIndicator(props: {
  class?: string;
}) {
  const [updateAvailable, setUpdateAvailable] = createSignal(false);
  const [updateDownloaded, setUpdateDownloaded] = createSignal(false);
  const [appVersion, setAppVersion] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  // Check if we're running in Electron
  const isElectron = () => {
    return typeof window !== 'undefined' && window.electronAPI;
  };

  // Set up update listeners when component mounts
  createEffect(() => {
    if (!isElectron()) return;

    const electronAPI = window.electronAPI!;

    // Register update listeners
    electronAPI.onUpdateAvailable(() => {
      console.log('[Update] Update available');
      setUpdateAvailable(true);
      setUpdateDownloaded(false);
      setError(null);
    });

    electronAPI.onUpdateDownloaded(() => {
      console.log('[Update] Update downloaded');
      setUpdateAvailable(true);
      setUpdateDownloaded(true);
      setError(null);
    });

    electronAPI.onUpdateError((err: string) => {
      console.error('[Update] Error:', err);
      setError(err);
    });

    // Get current app version
    electronAPI.getAppVersion().then(setAppVersion).catch((err) => {
      console.error('[Update] Failed to get version:', err);
      setAppVersion('Unknown');
    });

    // Initial check for updates
    setTimeout(() => {
      electronAPI.checkForUpdates();
    }, 1000);

    // Clean up listeners when component unmounts
    onCleanup(() => {
      electronAPI.removeAllUpdateListeners();
    });
  });

  const handleDownloadUpdate = () => {
    if (!isElectron()) return;
    window.electronAPI?.downloadUpdate();
  };

  const handleRestartApp = () => {
    if (!isElectron()) return;
    window.electronAPI?.restartApp();
  };

  return (
    <Show when={isElectron() && (updateAvailable() || error())}>
      <div
        class={classNames('electron-update-indicator', props.class)}
        role="status"
        aria-live="polite"
      >
        <Show when={error()}>
          <div class="electron-update-error">
            <i class="icon icon-error" />
            <span>Update Error: {error()}</span>
            <button
              class="btn-icon electron-retry-btn"
              onClick={() => window.electronAPI?.checkForUpdates()}
              aria-label="Retry update check"
            >
              <i class="icon icon-refresh" />
            </button>
          </div>
        </Show>

        <Show when={!error() && updateAvailable()}>
          <div class="electron-update-available">
            <Show when={!updateDownloaded()}>
              <span class="update-notice">
                <i class="icon icon-download" />
                Update Available (v{appVersion()}) - Click to download
              </span>
              <button
                class="btn-icon electron-download-btn"
                onClick={handleDownloadUpdate}
                aria-label="Download update"
              >
                <i class="icon icon-download" />
              </button>
            </Show>

            <Show when={updateDownloaded()}>
              <span class="update-notice">
                <i class="icon icon-check" />
                Update Downloaded - Click to restart
              </span>
              <button
                class="btn-icon electron-restart-btn"
                onClick={handleRestartApp}
                aria-label="Restart to apply update"
              >
                <i class="icon icon-restart" />
              </button>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
