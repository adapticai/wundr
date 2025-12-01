import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

/**
 * Type definitions for the Neolith Desktop API
 */

// Configuration types
export interface NeolithConfig {
  windowState: WindowState;
  theme: 'light' | 'dark' | 'system';
  autoUpdate: boolean;
  lastOpenedOrg?: string;
}

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

// Dialog types
export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  cancelId?: number;
}

// Deep link types
export interface DeepLinkData {
  path: string;
  params: Record<string, string>;
}

// Update types
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

// Event callback types
type EventCallback<T = void> = T extends void ? () => void : (data: T) => void;

/**
 * Neolith Desktop API
 * Exposed to the renderer process via contextBridge
 */
const neolithAPI = {
  // ============================================
  // Configuration
  // ============================================
  config: {
    get: <K extends keyof NeolithConfig>(key: K): Promise<NeolithConfig[K]> => {
      return ipcRenderer.invoke('config:get', key);
    },
    set: <K extends keyof NeolithConfig>(
      key: K,
      value: NeolithConfig[K]
    ): Promise<boolean> => {
      return ipcRenderer.invoke('config:set', key, value);
    },
    getAll: (): Promise<NeolithConfig> => {
      return ipcRenderer.invoke('config:getAll');
    },
  },

  // ============================================
  // Dialog Operations
  // ============================================
  dialog: {
    openDirectory: (): Promise<string | null> => {
      return ipcRenderer.invoke('dialog:openDirectory');
    },
    openFile: (filters?: FileFilter[]): Promise<string | null> => {
      return ipcRenderer.invoke('dialog:openFile', filters);
    },
    saveFile: (
      defaultPath?: string,
      filters?: FileFilter[]
    ): Promise<string | null> => {
      return ipcRenderer.invoke('dialog:saveFile', defaultPath, filters);
    },
    message: (options: MessageBoxOptions): Promise<number> => {
      return ipcRenderer.invoke('dialog:message', options);
    },
  },

  // ============================================
  // Shell Operations
  // ============================================
  shell: {
    openExternal: (url: string): Promise<void> => {
      return ipcRenderer.invoke('shell:openExternal', url);
    },
    openPath: (path: string): Promise<string> => {
      return ipcRenderer.invoke('shell:openPath', path);
    },
    showItemInFolder: (path: string): Promise<boolean> => {
      return ipcRenderer.invoke('shell:showItemInFolder', path);
    },
  },

  // ============================================
  // Application Info
  // ============================================
  app: {
    getVersion: (): Promise<string> => {
      return ipcRenderer.invoke('app:getVersion');
    },
    getPath: (
      name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents'
    ): Promise<string> => {
      return ipcRenderer.invoke('app:getPath', name);
    },
    getPlatform: (): Promise<NodeJS.Platform> => {
      return ipcRenderer.invoke('app:getPlatform');
    },
  },

  // ============================================
  // Window Operations
  // ============================================
  window: {
    minimize: (): Promise<boolean> => {
      return ipcRenderer.invoke('window:minimize');
    },
    maximize: (): Promise<boolean> => {
      return ipcRenderer.invoke('window:maximize');
    },
    close: (): Promise<boolean> => {
      return ipcRenderer.invoke('window:close');
    },
    isMaximized: (): Promise<boolean> => {
      return ipcRenderer.invoke('window:isMaximized');
    },
  },

  // ============================================
  // Auto Updates
  // ============================================
  updates: {
    check: (): Promise<void> => {
      return ipcRenderer.invoke('updates:check');
    },
    download: (): Promise<void> => {
      return ipcRenderer.invoke('updates:download');
    },
    install: (): Promise<boolean> => {
      return ipcRenderer.invoke('updates:install');
    },
  },

  // ============================================
  // Event Listeners
  // ============================================
  on: {
    // Menu events
    newOrganization: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:new-organization', handler);
      return () => ipcRenderer.removeListener('menu:new-organization', handler);
    },
    openOrganization: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:open-organization', handler);
      return () =>
        ipcRenderer.removeListener('menu:open-organization', handler);
    },
    save: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:save', handler);
      return () => ipcRenderer.removeListener('menu:save', handler);
    },
    export: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:export', handler);
      return () => ipcRenderer.removeListener('menu:export', handler);
    },
    preferences: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('menu:preferences', handler);
      return () => ipcRenderer.removeListener('menu:preferences', handler);
    },

    // Deep link events
    deepLink: (callback: EventCallback<DeepLinkData>): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: DeepLinkData) =>
        callback(data);
      ipcRenderer.on('deep-link', handler);
      return () => ipcRenderer.removeListener('deep-link', handler);
    },

    // Update events
    updateChecking: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('update:checking', handler);
      return () => ipcRenderer.removeListener('update:checking', handler);
    },
    updateAvailable: (callback: EventCallback<UpdateInfo>): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: UpdateInfo) =>
        callback(info);
      ipcRenderer.on('update:available', handler);
      return () => ipcRenderer.removeListener('update:available', handler);
    },
    updateNotAvailable: (callback: EventCallback): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('update:not-available', handler);
      return () => ipcRenderer.removeListener('update:not-available', handler);
    },
    updateProgress: (callback: EventCallback<UpdateProgress>): (() => void) => {
      const handler = (_event: IpcRendererEvent, progress: UpdateProgress) =>
        callback(progress);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },
    updateDownloaded: (callback: EventCallback<UpdateInfo>): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: UpdateInfo) =>
        callback(info);
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
    updateError: (callback: EventCallback<string>): (() => void) => {
      const handler = (_event: IpcRendererEvent, error: string) =>
        callback(error);
      ipcRenderer.on('update:error', handler);
      return () => ipcRenderer.removeListener('update:error', handler);
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('neolith', neolithAPI);

// Type declaration for the renderer process
export type NeolithAPI = typeof neolithAPI;

// Declare the global type for TypeScript
declare global {
  interface Window {
    neolith: NeolithAPI;
  }
}
