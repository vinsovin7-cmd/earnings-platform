import {app, BrowserWindow, ipcMain, protocol} from 'electron';
import path from 'path';
import {autoUpdater} from 'electron-updater';
import log from 'electron-log';
import {existsSync} from 'fs';

// Configure logging for electron-updater
// electron-log transports are already set up by electron-updater
// autoUpdater.logger = log;
autoUpdater.logger = {
  info: (message: string) => log.info('[AutoUpdater] ' + message),
  warn: (message: string) => log.warn('[AutoUpdater] ' + message),
  error: (message: string) => log.error('[AutoUpdater] ' + message),
  debug: (message: string) => log.debug('[AutoUpdater] ' + message)
};

// Global reference to the main window
let mainWindow: BrowserWindow | null = null;

// Track if an update is available and downloaded
let updateAvailable = false;
let updateDownloaded = false;

async function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Telegram Web K',
    webPreferences: {
      // Security best practices
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      // Preload script for secure IPC communication
      preload: path.join(__dirname, 'preload.js'),
      // Enable remote content (needed for Telegram's CDN)
      webgl: true,
      // Allow running insecure content (http in https)
      allowRunningInsecureContent: true
    },
    // Window frame
    frame: true,
    // Window controls
    autoHideMenuBar: false,
    // Icon (will be set based on platform)
    icon: path.join(__dirname, '..', 'public', 'assets', 'img', 'favicon.ico')
  });

  // Load the appropriate URL based on environment
  const isDev = process.env.NODE_ENV === 'development' || process.env.IS_DEV === 'true';
  
  // Determine the entry point (default to index.html, but can be cinema.html or rewards-preview.html)
  const entryPoint = process.env.ENTRY_POINT || 'index.html';
  
  if (isDev) {
    // In development, load the Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:8080';
    console.log(`[Electron] Loading dev server from: ${devServerUrl} with entry: ${entryPoint}`);
    mainWindow.loadURL(`${devServerUrl}/${entryPoint}`);
    
    // Open DevTools in development
    mainWindow.webContents.openDevTools({mode: 'detach'});
  } else {
    // In production, load the built files
    // The dist folder is located next to the main.js file
    const distPath = path.join(__dirname, '..', 'dist');
    const entryPath = path.join(distPath, entryPoint);
    console.log(`[Electron] Loading production build from: ${entryPath}`);
    
    // Check if the entry file exists
    const exists = existsSync(entryPath);
    
    if (exists) {
      mainWindow.loadFile(entryPath);
    } else {
      console.error(`[Electron] Entry point not found: ${entryPath}`);
      // Fallback to index.html
      mainWindow.loadFile(path.join(distPath, 'index.html'));
    }
  }

  // Handle window closing
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up auto-updater event listeners
  setupAutoUpdater();
}

function setupAutoUpdater() {
  // Only enable auto-updater in production
  const isDev = process.env.NODE_ENV === 'development' || process.env.IS_DEV === 'true';
  
  if (isDev) {
    console.log('[Electron] Auto-updater disabled in development mode');
    return;
  }

  // Also check periodically
  setInterval(() => {
    checkForUpdates();
  }, 3600000); // Check every hour

  // Listen for manual update check from renderer
  ipcMain.on('check-for-updates', () => {
    checkForUpdates();
  });

  // Listen for download update request from renderer
  ipcMain.on('download-update', () => {
    if (updateAvailable) {
      console.log('[Electron] Starting update download...');
      autoUpdater.downloadUpdate();
    }
  });

  // Listen for restart request from renderer
  ipcMain.on('restart-app', () => {
    console.log('[Electron] Restarting application...');
    autoUpdater.quitAndInstall();
  });

  // Handle get app version request
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Check for updates 5 seconds after window is created
  setTimeout(() => {
    checkForUpdates();
  }, 5000);
}

function checkForUpdates() {
  console.log('[Electron] Checking for updates...');
  
  // Configure feed URL
  const feedUrl = process.env.UPDATE_FEED_URL || 
    'https://github.com/morethanwords/tweb/releases/latest/download';
  
  // Use the default feed mechanism (GitHub releases)
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'morethanwords',
    repo: 'tweb',
    token: process.env.GITHUB_TOKEN // Optional: for private repos
  });

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('[Electron] Update check failed:', error);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', error.message || 'Unknown error');
    }
  });

  // Event listeners
  autoUpdater.on('update-available', (info) => {
    console.log('[Electron] Update available:', info.version);
    updateAvailable = true;
    updateDownloaded = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info.version);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Electron] Update downloaded:', info.version);
    updateAvailable = true;
    updateDownloaded = true;
    
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info.version);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Electron] No update available:', info);
    updateAvailable = false;
  });

  autoUpdater.on('error', (error) => {
    console.error('[Electron] Auto-updater error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', error.message || 'Unknown error');
    }
  });
}

// Handle app activation (for macOS)
app.on('activate', async () => {
  if (mainWindow === null) {
    await createWindow();
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app ready event
app.whenReady().then(async () => {
  // Set up custom protocol for local files (optional)
  protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = request.url.replace('file:///', '');
    callback(pathname);
  });

  await createWindow();
});

// Handle uncaught exceptions
app.on('render-process-gone', (event, webContents, details) => {
  console.error('[Electron] Renderer process crashed:', details);
  // Restart the window if it crashes
  if (mainWindow) {
    setTimeout(() => {
      mainWindow?.reload();
    }, 1000);
  }
});

// Handle uncaught exceptions in main process
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception in main process:', error);
  // Recreate window if it was destroyed
  if (mainWindow === null) {
    createWindow().catch(console.error);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Electron] Unhandled rejection:', reason);
});
