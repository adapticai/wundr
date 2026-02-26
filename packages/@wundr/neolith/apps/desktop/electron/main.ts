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

interface NeolithConfig {
  windowState: WindowState;
  theme: 'light' | 'dark' | 'system';
  autoUpdate: boolean;
  lastOpenedOrg?: string;
  userType?: 'human' | 'orchestrator';
  daemonEndpoint?: string;
}

// Store for persistent configuration
const store = new Store<NeolithConfig>({
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
let nextServer: any = null;

// Constants
const isDev = !app.isPackaged;
const PROTOCOL_NAME = 'neolith';

// OAuth providers that should be allowed to navigate within Electron
const ALLOWED_OAUTH_HOSTS = [
  'accounts.google.com',
  'github.com',
  'api.github.com',
  'oauth.github.com',
  'localhost',
];

/**
 * Check if URL is an allowed OAuth or local URL
 */
function isAllowedUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Allow localhost
    if (parsedUrl.hostname === 'localhost') {
      return true;
    }
    // Allow file:// URLs
    if (parsedUrl.protocol === 'file:') {
      return true;
    }
    // Allow OAuth providers
    if (ALLOWED_OAUTH_HOSTS.some(host => parsedUrl.hostname.endsWith(host))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

console.log('Neolith Desktop starting...');
console.log('isDev:', isDev);
console.log('isPackaged:', app.isPackaged);
console.log('__dirname:', __dirname);

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
    title: 'Neolith',
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
  console.log('Loading app, isDev:', isDev);

  if (isDev) {
    // In dev mode, load from Next.js dev server
    const devUrl = 'http://localhost:3000';
    console.log('Loading dev URL:', devUrl);

    // Add error handling for page load
    mainWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
      }
    );

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Page finished loading');
    });

    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      console.log('Renderer console:', message);
    });

    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, start the Next.js production server
    const webAppDir = path.join(__dirname, '..');
    console.log('Production mode - starting Next.js server');
    console.log('Web app directory:', webAppDir);

    try {
      // Start the Next.js production server using next-server
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { spawn } = require('child_process');

      // Use next start command which requires next to be installed in the web app
      // Or directly run the server via Node
      nextServer = spawn('next', ['start', '-p', '3000'], {
        env: {
          ...process.env,
          NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: webAppDir,
      });

      let serverReady = false;

      nextServer.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('[Next.js Server]', output);
        if (output.includes('ready - started server') && !serverReady) {
          serverReady = true;
          mainWindow?.loadURL('http://localhost:3000');
        }
      });

      nextServer.stderr?.on('data', (data: Buffer) => {
        console.error('[Next.js Server Error]', data.toString());
      });

      nextServer.on('error', (error: Error) => {
        console.error('Failed to start Next.js server:', error);
        // Fallback: try to load from file if server fails
        const indexPath = path.join(webAppDir, 'out', 'index.html');
        console.log(
          'Server failed, attempting to load static file:',
          indexPath
        );
        mainWindow?.loadFile(indexPath);
      });

      // Timeout to ensure window loads even if server is slow
      setTimeout(() => {
        if (!serverReady) {
          console.log('Server timeout, attempting to connect anyway');
          mainWindow?.loadURL('http://localhost:3000');
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to spawn Next.js server:', error);
      // Fallback: try to load from static files
      const indexPath = path.join(webAppDir, 'out', 'index.html');
      console.log('Fallback: attempting to load static file:', indexPath);
      mainWindow?.loadFile(indexPath);
    }
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

  // Handle external links - only open truly external URLs in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      // Allow OAuth popups to open in a new Electron window
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 700,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }
    // Open other external URLs in system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to truly external URLs, but allow OAuth
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
    // OAuth URLs are allowed to navigate within the window
  });
}

/**
 * Get the application icon
 */
function getAppIcon(): Electron.NativeImage {
  // Use app.getAppPath() which gives us the correct base path
  const appPath = app.getAppPath();
  const iconPath = path.join(appPath, 'assets', 'icons', 'icon.png');

  console.log('App path:', appPath);
  console.log('Loading icon from:', iconPath);

  try {
    const icon = nativeImage.createFromPath(iconPath);
    console.log('Icon isEmpty:', icon.isEmpty());
    console.log('Icon size:', icon.getSize());

    if (icon.isEmpty()) {
      // Try icns for macOS
      const icnsPath = path.join(appPath, 'assets', 'icons', 'icon.icns');
      console.log('Trying icns:', icnsPath);
      const icnsIcon = nativeImage.createFromPath(icnsPath);
      if (!icnsIcon.isEmpty()) {
        return icnsIcon;
      }

      // Fallback to build directory
      const fallbackPath = path.join(appPath, 'build', 'icon.png');
      console.log('Trying fallback:', fallbackPath);
      return nativeImage.createFromPath(fallbackPath);
    }
    return icon;
  } catch (error) {
    console.error('Failed to load icon:', error);
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
      label: 'Open Neolith',
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
      label: 'Quit Neolith',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Neolith');
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
            shell.openExternal('https://docs.adaptic.ai/neolith');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/adaptic-ai/neolith/issues');
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
    (_event: IpcMainInvokeEvent, key: keyof NeolithConfig) => {
      return store.get(key);
    }
  );

  ipcMain.handle(
    'config:set',
    (_event: IpcMainInvokeEvent, key: keyof NeolithConfig, value: unknown) => {
      store.set(key, value as NeolithConfig[keyof NeolithConfig]);
      return true;
    }
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
    }
  );

  ipcMain.handle(
    'dialog:saveFile',
    async (
      _event: IpcMainInvokeEvent,
      defaultPath?: string,
      filters?: Electron.FileFilter[]
    ) => {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath,
        filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      });
      return result.canceled ? null : result.filePath;
    }
  );

  ipcMain.handle(
    'dialog:message',
    async (_event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
      const result = await dialog.showMessageBox(mainWindow!, options);
      return result.response;
    }
  );

  // Shell operations
  ipcMain.handle(
    'shell:openExternal',
    (_event: IpcMainInvokeEvent, url: string) => {
      return shell.openExternal(url);
    }
  );

  ipcMain.handle(
    'shell:openPath',
    (_event: IpcMainInvokeEvent, path: string) => {
      return shell.openPath(path);
    }
  );

  ipcMain.handle(
    'shell:showItemInFolder',
    (_event: IpcMainInvokeEvent, path: string) => {
      shell.showItemInFolder(path);
      return true;
    }
  );

  // App info
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle(
    'app:getPath',
    (
      _event: IpcMainInvokeEvent,
      name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents'
    ) => {
      return app.getPath(name);
    }
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

  // User type management
  ipcMain.handle('get-user-type', async () => {
    return store.get('userType') ?? null;
  });

  ipcMain.handle(
    'set-user-type',
    async (_event: IpcMainInvokeEvent, userType: 'human' | 'orchestrator') => {
      store.set('userType', userType);

      if (userType === 'orchestrator') {
        if (tray) {
          tray.setToolTip('Neolith - Orchestrator Mode');
        }
      } else {
        if (tray) {
          tray.setToolTip('Neolith');
        }
      }

      return { success: true };
    }
  );

  ipcMain.handle('get-daemon-status', async () => {
    const userType = store.get('userType');
    if (userType !== 'orchestrator') {
      return { connected: false, reason: 'Not in orchestrator mode' };
    }
    return {
      connected: true,
      mode: 'orchestrator',
      daemonEndpoint: store.get('daemonEndpoint', 'http://localhost:3847'),
    };
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
    // Set dock icon on macOS
    if (process.platform === 'darwin') {
      const dockIcon = getAppIcon();
      if (!dockIcon.isEmpty()) {
        app.dock.setIcon(dockIcon);
        console.log('Dock icon set successfully');
      }
    }

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
    // Kill Next.js server process if running
    if (nextServer) {
      try {
        process.kill(-nextServer.pid!);
        console.log('Next.js server process terminated');
      } catch (error) {
        console.error('Failed to kill server process:', error);
      }
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Security: Prevent web contents from loading insecure content
  app.on('web-contents-created', (_event, contents) => {
    // Allow navigation to OAuth providers, block other external URLs
    contents.on('will-navigate', (navEvent, url) => {
      if (!isAllowedUrl(url)) {
        navEvent.preventDefault();
        shell.openExternal(url);
      }
    });

    // Allow OAuth popups, deny other new windows
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedUrl(url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 700,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
            },
          },
        };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    });
  });
}
