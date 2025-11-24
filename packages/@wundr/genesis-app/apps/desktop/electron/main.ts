import * as path from 'path';

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  shell,
  dialog,
  type IpcMainInvokeEvent,
} from 'electron';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';

// Types
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

interface GenesisConfig {
  windowState: WindowState;
  theme: 'light' | 'dark' | 'system';
  autoUpdate: boolean;
  lastOpenedOrg?: string;
}

// Store for persistent configuration
const store = new Store<GenesisConfig>({
  defaults: {
    windowState: {
      width: 1400,
      height: 900,
    },
    theme: 'system',
    autoUpdate: true,
  },
});

// Global references
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Constants
const isDev = process.env.NODE_ENV === 'development';
const PROTOCOL_NAME = 'genesis';

/**
 * Create the main application window
 */
function createWindow(): void {
  const windowState = store.get('windowState');

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1024,
    minHeight: 768,
    title: 'Genesis',
    icon: getAppIcon(),
    show: false, // Show when ready to prevent flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Save window state on close
  mainWindow.on('close', event => {
    if (!isQuitting && process.platform === 'darwin') {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowState', {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: mainWindow.isMaximized(),
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.origin !== 'http://localhost:5173' &&
      !url.startsWith('file://')
    ) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

/**
 * Get the application icon
 */
function getAppIcon(): Electron.NativeImage {
  const iconPath = isDev
    ? path.join(__dirname, '../assets/icon.png')
    : path.join(process.resourcesPath, 'assets/icon.png');

  try {
    return nativeImage.createFromPath(iconPath);
  } catch {
    return nativeImage.createEmpty();
  }
}

/**
 * Create system tray icon
 */
function createTray(): void {
  const trayIcon = getAppIcon().resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Genesis',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'New Organization',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('menu:new-organization');
      },
    },
    {
      label: 'Open Recent',
      submenu: [{ label: 'No recent organizations', enabled: false }],
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Genesis',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Genesis');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

/**
 * Create application menu
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('menu:preferences');
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Organization',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-organization');
          },
        },
        {
          label: 'Open Organization...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-organization');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu:save');
          },
        },
        {
          label: 'Export...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('menu:export');
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://docs.adaptic.ai/genesis');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/adaptic-ai/genesis/issues');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Register IPC handlers
 */
function registerIpcHandlers(): void {
  // Configuration
  ipcMain.handle(
    'config:get',
    (_event: IpcMainInvokeEvent, key: keyof GenesisConfig) => {
      return store.get(key);
    },
  );

  ipcMain.handle(
    'config:set',
    (_event: IpcMainInvokeEvent, key: keyof GenesisConfig, value: unknown) => {
      store.set(key, value as GenesisConfig[keyof GenesisConfig]);
      return true;
    },
  );

  ipcMain.handle('config:getAll', () => {
    return store.store;
  });

  // Dialog operations
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    'dialog:openFile',
    async (_event: IpcMainInvokeEvent, filters?: Electron.FileFilter[]) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openFile'],
        filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      });
      return result.canceled ? null : result.filePaths[0];
    },
  );

  ipcMain.handle(
    'dialog:saveFile',
    async (
      _event: IpcMainInvokeEvent,
      defaultPath?: string,
      filters?: Electron.FileFilter[],
    ) => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath,
        filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      });
      return result.canceled ? null : result.filePath;
    },
  );

  ipcMain.handle(
    'dialog:message',
    async (_event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
      const result = await dialog.showMessageBox(mainWindow!, options);
      return result.response;
    },
  );

  // Shell operations
  ipcMain.handle(
    'shell:openExternal',
    (_event: IpcMainInvokeEvent, url: string) => {
      return shell.openExternal(url);
    },
  );

  ipcMain.handle(
    'shell:openPath',
    (_event: IpcMainInvokeEvent, path: string) => {
      return shell.openPath(path);
    },
  );

  ipcMain.handle(
    'shell:showItemInFolder',
    (_event: IpcMainInvokeEvent, path: string) => {
      shell.showItemInFolder(path);
      return true;
    },
  );

  // App info
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle(
    'app:getPath',
    (
      _event: IpcMainInvokeEvent,
      name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents',
    ) => {
      return app.getPath(name);
    },
  );

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  // Window operations
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
    return true;
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
    return mainWindow?.isMaximized();
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
    return true;
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized();
  });

  // Updates
  ipcMain.handle('updates:check', () => {
    return autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle('updates:download', () => {
    return autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updates:install', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall();
    return true;
  });
}

/**
 * Setup deep link handling
 */
function setupDeepLinks(): void {
  // Register as protocol handler
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME);
  }

  // Handle protocol on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Handle protocol on Windows/Linux (second instance)
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL_NAME}://`));
    if (url) {
      handleDeepLink(url);
    }

    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

/**
 * Handle deep link URL
 */
function handleDeepLink(url: string): void {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    const params = Object.fromEntries(parsedUrl.searchParams);

    mainWindow?.webContents.send('deep-link', { path, params });
  } catch (error) {
    console.error('Failed to parse deep link:', error);
  }
}

/**
 * Setup auto-updater
 */
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', info => {
    mainWindow?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update:not-available');
  });

  autoUpdater.on('download-progress', progress => {
    mainWindow?.webContents.send('update:progress', progress);
  });

  autoUpdater.on('update-downloaded', info => {
    mainWindow?.webContents.send('update:downloaded', info);
  });

  autoUpdater.on('error', error => {
    mainWindow?.webContents.send('update:error', error.message);
  });

  // Check for updates on startup (if enabled)
  if (store.get('autoUpdate') && !isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 10000);
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // App lifecycle
  app.whenReady().then(() => {
    setupDeepLinks();
    createWindow();
    createTray();
    createMenu();
    registerIpcHandlers();
    setupAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Security: Prevent web contents from loading insecure content
  app.on('web-contents-created', (_event, contents) => {
    // Disable navigation to external URLs
    contents.on('will-navigate', (navEvent, url) => {
      const parsedUrl = new URL(url);
      if (
        parsedUrl.origin !== 'http://localhost:5173' &&
        !url.startsWith('file://')
      ) {
        navEvent.preventDefault();
      }
    });

    // Disable new window creation (popups)
    contents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
  });
}
