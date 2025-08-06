/**
 * Plugin System for Consumer Dashboard Integration
 * Enables consumers to add custom pages, components, and functionality
 */

import { Component } from 'react';
import { NextPage } from 'next';
import path from 'path';
import { readdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';

// Plugin Types and Interfaces
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  type: 'page' | 'component' | 'service' | 'middleware' | 'analysis';
  dependencies?: string[];
  permissions?: PluginPermission[];
  config?: Record<string, any>;
}

export interface PluginPermission {
  type: 'filesystem' | 'network' | 'process' | 'environment';
  scope: string[];
  reason: string;
}

export interface PluginContext {
  config: any;
  api: PluginAPI;
  logger: PluginLogger;
  hooks: PluginHooks;
}

export interface PluginAPI {
  getAnalysisData: () => Promise<any>;
  updateAnalysis: (data: any) => Promise<void>;
  executeScript: (command: string, options?: any) => Promise<any>;
  getProjectInfo: () => Promise<any>;
  addRoute: (path: string, component: any) => void;
  addMenuItem: (item: MenuItem) => void;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  path: string;
  group?: string;
  order?: number;
}

export interface PluginLogger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

export interface PluginHooks {
  beforeAnalysis: (callback: () => void) => void;
  afterAnalysis: (callback: (data: any) => void) => void;
  beforeRender: (callback: () => void) => void;
  onConfigChange: (callback: (config: any) => void) => void;
}

export interface Plugin {
  manifest: PluginManifest;
  initialize: (context: PluginContext) => Promise<void>;
  cleanup?: () => Promise<void>;
  component?: React.ComponentType<any>;
  page?: NextPage<any>;
  middleware?: (req: any, res: any, next: any) => void;
  analysis?: (projectPath: string) => Promise<any>;
}

/**
 * Plugin Registry manages loaded plugins
 */
export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private routes = new Map<string, any>();
  private menuItems: MenuItem[] = [];
  private hooks = {
    beforeAnalysis: [] as Array<() => void>,
    afterAnalysis: [] as Array<(data: any) => void>,
    beforeRender: [] as Array<() => void>,
    onConfigChange: [] as Array<(config: any) => void>,
  };

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.manifest.name)) {
      throw new Error(`Plugin ${plugin.manifest.name} is already registered`);
    }

    this.plugins.set(plugin.manifest.name, plugin);
  }

  unregister(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin && plugin.cleanup) {
      plugin.cleanup();
    }
    this.plugins.delete(name);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsByType(type: string): Plugin[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.manifest.type === type
    );
  }

  addRoute(path: string, component: any): void {
    this.routes.set(path, component);
  }

  getRoutes(): Map<string, any> {
    return new Map(this.routes);
  }

  addMenuItem(item: MenuItem): void {
    const existingIndex = this.menuItems.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      this.menuItems[existingIndex] = item;
    } else {
      this.menuItems.push(item);
    }
    this.sortMenuItems();
  }

  getMenuItems(): MenuItem[] {
    return [...this.menuItems];
  }

  private sortMenuItems(): void {
    this.menuItems.sort((a, b) => (a.order || 999) - (b.order || 999));
  }

  // Hook system
  registerHook(event: keyof typeof this.hooks, callback: any): void {
    this.hooks[event].push(callback);
  }

  triggerHook(event: keyof typeof this.hooks, ...args: any[]): void {
    const callbacks = this.hooks[event];
    callbacks.forEach((callback: (...args: any[]) => void) => {
      callback(...args);
    });
  }
}

/**
 * Plugin Loader handles discovering and loading plugins
 */
export class PluginLoader {
  private registry: PluginRegistry;
  private pluginPaths: string[] = [];

  constructor(registry: PluginRegistry) {
    this.registry = registry;
  }

  addPluginPath(pluginPath: string): void {
    if (!this.pluginPaths.includes(pluginPath)) {
      this.pluginPaths.push(pluginPath);
    }
  }

  async discoverPlugins(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    for (const pluginPath of this.pluginPaths) {
      if (!existsSync(pluginPath)) continue;

      const items = await readdir(pluginPath);
      for (const item of items) {
        const itemPath = path.join(pluginPath, item);
        const itemStat = await stat(itemPath);

        if (itemStat.isDirectory()) {
          const manifestPath = path.join(itemPath, 'plugin.json');
          if (existsSync(manifestPath)) {
            try {
              const manifestContent = await readFile(manifestPath, 'utf-8');
              const manifest = JSON.parse(manifestContent) as PluginManifest;
              manifests.push(manifest);
            } catch (error) {
              console.warn(`Failed to load plugin manifest at ${manifestPath}:`, error);
            }
          }
        }
      }
    }

    return manifests;
  }

  async loadPlugin(manifest: PluginManifest, pluginDir: string): Promise<Plugin> {
    const mainPath = path.join(pluginDir, manifest.main);
    
    if (!existsSync(mainPath)) {
      throw new Error(`Plugin main file not found: ${mainPath}`);
    }

    try {
      // Dynamic import for ES modules or require for CommonJS
      let pluginModule;
      if (mainPath.endsWith('.mjs') || mainPath.endsWith('.esm.js')) {
        pluginModule = await import(mainPath);
      } else {
        pluginModule = require(mainPath);
      }

      const plugin: Plugin = {
        manifest,
        ...pluginModule.default || pluginModule,
      };

      // Validate plugin structure
      if (!plugin.initialize) {
        throw new Error(`Plugin ${manifest.name} must export an initialize function`);
      }

      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin ${manifest.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadAllPlugins(): Promise<void> {
    const manifests = await this.discoverPlugins();

    // Sort by dependencies (simple topological sort)
    const sortedManifests = this.sortByDependencies(manifests);

    for (const manifest of sortedManifests) {
      try {
        const pluginDir = this.getPluginDirectory(manifest.name);
        const plugin = await this.loadPlugin(manifest, pluginDir);
        
        // Initialize plugin with context
        const context = this.createPluginContext(plugin);
        await plugin.initialize(context);
        
        this.registry.register(plugin);
        
        console.log(`Loaded plugin: ${manifest.name} v${manifest.version}`);
      } catch (error) {
        console.error(`Failed to load plugin ${manifest.name}:`, error);
      }
    }
  }

  private getPluginDirectory(pluginName: string): string {
    for (const pluginPath of this.pluginPaths) {
      const pluginDir = path.join(pluginPath, pluginName);
      if (existsSync(pluginDir)) {
        return pluginDir;
      }
    }
    throw new Error(`Plugin directory not found for ${pluginName}`);
  }

  private sortByDependencies(manifests: PluginManifest[]): PluginManifest[] {
    const sorted: PluginManifest[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (manifest: PluginManifest) => {
      if (visiting.has(manifest.name)) {
        throw new Error(`Circular dependency detected involving ${manifest.name}`);
      }
      if (visited.has(manifest.name)) return;

      visiting.add(manifest.name);

      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          const depManifest = manifests.find(m => m.name === dep);
          if (depManifest) {
            visit(depManifest);
          }
        }
      }

      visiting.delete(manifest.name);
      visited.add(manifest.name);
      sorted.push(manifest);
    };

    manifests.forEach(visit);
    return sorted;
  }

  private createPluginContext(plugin: Plugin): PluginContext {
    return {
      config: plugin.manifest.config || {},
      api: this.createPluginAPI(),
      logger: this.createPluginLogger(plugin.manifest.name),
      hooks: this.createPluginHooks(),
    };
  }

  private createPluginAPI(): PluginAPI {
    return {
      getAnalysisData: async () => {
        // Implementation would connect to analysis service
        return {};
      },
      updateAnalysis: async (data: any) => {
        // Implementation would update analysis data
      },
      executeScript: async (command: string, options?: any) => {
        // Implementation would execute scripts safely
        return {};
      },
      getProjectInfo: async () => {
        // Implementation would return project information
        return {};
      },
      addRoute: (path: string, component: any) => {
        this.registry.addRoute(path, component);
      },
      addMenuItem: (item: MenuItem) => {
        this.registry.addMenuItem(item);
      },
    };
  }

  private createPluginLogger(pluginName: string): PluginLogger {
    const prefix = `[Plugin:${pluginName}]`;
    return {
      info: (message: string, meta?: any) => console.log(prefix, message, meta || ''),
      warn: (message: string, meta?: any) => console.warn(prefix, message, meta || ''),
      error: (message: string, meta?: any) => console.error(prefix, message, meta || ''),
      debug: (message: string, meta?: any) => console.debug(prefix, message, meta || ''),
    };
  }

  private createPluginHooks(): PluginHooks {
    return {
      beforeAnalysis: (callback: () => void) => {
        this.registry.registerHook('beforeAnalysis', callback);
      },
      afterAnalysis: (callback: (data: any) => void) => {
        this.registry.registerHook('afterAnalysis', callback);
      },
      beforeRender: (callback: () => void) => {
        this.registry.registerHook('beforeRender', callback);
      },
      onConfigChange: (callback: (config: any) => void) => {
        this.registry.registerHook('onConfigChange', callback);
      },
    };
  }
}

/**
 * Plugin System Manager
 */
export class PluginSystem {
  private registry: PluginRegistry;
  private loader: PluginLoader;

  constructor() {
    this.registry = new PluginRegistry();
    this.loader = new PluginLoader(this.registry);
  }

  async initialize(pluginPaths: string[]): Promise<void> {
    // Add default plugin paths
    pluginPaths.forEach(path => this.loader.addPluginPath(path));
    
    // Load all plugins
    await this.loader.loadAllPlugins();
  }

  getRegistry(): PluginRegistry {
    return this.registry;
  }

  getLoader(): PluginLoader {
    return this.loader;
  }

  async shutdown(): Promise<void> {
    const plugins = this.registry.getAllPlugins();
    for (const plugin of plugins) {
      if (plugin.cleanup) {
        await plugin.cleanup();
      }
    }
  }
}

export default PluginSystem;