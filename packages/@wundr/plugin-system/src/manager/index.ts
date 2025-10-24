/**
 * Plugin manager implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

import {
  BaseWundrError,
  failure,
  getEventBus,
  getLogger,
  isFailure,
  success,
} from '@wundr.io/core';
import { valid as semverValid } from 'semver';

import { WundrHookRegistry } from '../hooks/index.js';
import { PLUGIN_EVENTS, PluginStatus } from '../types/index.js';

import type {
  PluginContext,
  PluginHookRegistry,
  PluginInfo,
  PluginManager,
  PluginManagerOptions,
  PluginManifest,
  PluginModule,
} from '../types/index.js';
import type { EventBus, Logger } from '@wundr.io/core';

export class PluginError extends BaseWundrError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PLUGIN_ERROR', context);
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

export class WundrPluginManager implements PluginManager {
  public readonly options: PluginManagerOptions;
  public readonly hookRegistry: PluginHookRegistry;

  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly plugins = new Map<string, PluginInfo>();
  private readonly loadingSemaphore = new Map<string, Promise<PluginInfo>>();
  private initialized = false;

  constructor(options: PluginManagerOptions) {
    this.options = {
      autoLoad: true,
      autoActivate: true,
      maxConcurrentLoads: 5,
      loadTimeout: 30000, // 30 seconds
      ...options,
    };

    this.logger = options.logger || getLogger();
    this.eventBus = options.eventBus || getEventBus();
    this.hookRegistry = new WundrHookRegistry();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing plugin manager', {
      pluginDir: this.options.pluginDir,
      dataDir: this.options.dataDir,
      autoLoad: this.options.autoLoad,
      autoActivate: this.options.autoActivate,
    });

    // Ensure directories exist
    await this.ensureDirectories();

    if (this.options.autoLoad) {
      await this.loadAll();
    }

    if (this.options.autoActivate) {
      await this.activateAll();
    }

    this.initialized = true;
    this.logger.info('Plugin manager initialized successfully');
  }

  async destroy(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Destroying plugin manager');

    await this.deactivateAll();

    // Unload all plugins
    for (const pluginId of this.plugins.keys()) {
      await this.unloadPlugin(pluginId);
    }

    this.hookRegistry.clear();
    this.plugins.clear();
    this.loadingSemaphore.clear();
    this.initialized = false;

    this.logger.info('Plugin manager destroyed');
  }

  async loadPlugin(pluginId: string): Promise<PluginInfo> {
    // Check if already loading
    const loadingPromise = this.loadingSemaphore.get(pluginId);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Check if already loaded
    const existing = this.plugins.get(pluginId);
    if (existing && existing.status !== PluginStatus.ERROR) {
      return existing;
    }

    const loadPromise = this.doLoadPlugin(pluginId);
    this.loadingSemaphore.set(pluginId, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingSemaphore.delete(pluginId);
      return result;
    } catch (error) {
      this.loadingSemaphore.delete(pluginId);
      throw error;
    }
  }

  private async doLoadPlugin(pluginId: string): Promise<PluginInfo> {
    const startTime = performance.now();

    this.logger.info(`Loading plugin: ${pluginId}`);
    this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_LOADING, { pluginId });

    try {
      // Update status to loading
      this.updatePluginStatus(pluginId, PluginStatus.LOADING);

      // Load manifest
      const manifest = await this.loadManifest(pluginId);

      // Validate manifest
      this.validateManifest(manifest);

      // Load plugin module
      const pluginModule = await this.loadPluginModule(pluginId, manifest);

      // Create plugin instance
      const PluginClass = pluginModule.default;
      const instance = new PluginClass();

      // Merge metadata
      const metadata = {
        ...manifest,
        ...pluginModule.metadata,
        ...instance.metadata,
      };

      // Create context
      const context = await this.createPluginContext(pluginId, manifest);

      // Initialize plugin
      await instance.initialize(context);

      const loadTime = performance.now() - startTime;

      const pluginInfo: PluginInfo = {
        id: pluginId,
        metadata,
        status: PluginStatus.LOADED,
        instance,
        context,
        loadTime,
      };

      this.plugins.set(pluginId, pluginInfo);

      this.logger.info(`Plugin loaded successfully: ${pluginId}`, {
        loadTime: `${loadTime.toFixed(2)}ms`,
      });

      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_LOADED, {
        pluginId,
        pluginInfo,
        loadTime,
      });

      return pluginInfo;
    } catch (error) {
      const pluginError =
        error instanceof Error
          ? error
          : new PluginError(`Failed to load plugin: ${pluginId}`, {
              pluginId,
              error,
            });

      const pluginInfo: PluginInfo = {
        id: pluginId,
        metadata: {
          name: pluginId,
          version: '0.0.0',
          description: 'Failed to load',
        },
        status: PluginStatus.ERROR,
        error: pluginError,
      };

      this.plugins.set(pluginId, pluginInfo);

      this.logger.error(`Plugin load failed: ${pluginId}`, {
        error: pluginError.message,
      });

      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_LOAD_ERROR, {
        pluginId,
        error: pluginError,
      });

      throw pluginError;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      return;
    }

    this.logger.info(`Unloading plugin: ${pluginId}`);
    this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_UNLOADING, { pluginId });

    try {
      // Deactivate if active
      if (pluginInfo.status === PluginStatus.ACTIVE) {
        await this.deactivatePlugin(pluginId);
      }

      // Call destroy if available
      if (pluginInfo.instance && pluginInfo.instance.destroy) {
        await pluginInfo.instance.destroy();
      }

      this.plugins.delete(pluginId);

      this.logger.info(`Plugin unloaded: ${pluginId}`);
      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_UNLOADED, { pluginId });
    } catch (error) {
      const pluginError = new PluginError(
        `Failed to unload plugin: ${pluginId}`,
        { pluginId, error }
      );

      this.logger.error(pluginError);
      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_ERROR, {
        pluginId,
        error: pluginError,
      });

      throw pluginError;
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      throw new PluginError(`Plugin not found: ${pluginId}`);
    }

    if (pluginInfo.status === PluginStatus.ACTIVE) {
      return; // Already active
    }

    if (pluginInfo.status !== PluginStatus.LOADED) {
      throw new PluginError(
        `Plugin must be loaded before activation: ${pluginId}`,
        { currentStatus: pluginInfo.status }
      );
    }

    const startTime = performance.now();

    this.logger.info(`Activating plugin: ${pluginId}`);
    this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_ACTIVATING, { pluginId });

    try {
      this.updatePluginStatus(pluginId, PluginStatus.ACTIVATING);

      await pluginInfo.instance!.activate();

      const activationTime = performance.now() - startTime;

      this.updatePluginInfo(pluginId, {
        status: PluginStatus.ACTIVE,
        activationTime,
      });

      this.logger.info(`Plugin activated: ${pluginId}`, {
        activationTime: `${activationTime.toFixed(2)}ms`,
      });

      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_ACTIVATED, {
        pluginId,
        activationTime,
      });
    } catch (error) {
      const pluginError = new PluginError(
        `Failed to activate plugin: ${pluginId}`,
        { pluginId, error }
      );

      this.updatePluginInfo(pluginId, {
        status: PluginStatus.ERROR,
        error: pluginError,
      });

      this.logger.error(pluginError);
      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_ACTIVATION_ERROR, {
        pluginId,
        error: pluginError,
      });

      throw pluginError;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const pluginInfo = this.plugins.get(pluginId);
    if (!pluginInfo) {
      return;
    }

    if (pluginInfo.status !== PluginStatus.ACTIVE) {
      return; // Not active
    }

    this.logger.info(`Deactivating plugin: ${pluginId}`);
    this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_DEACTIVATING, { pluginId });

    try {
      this.updatePluginStatus(pluginId, PluginStatus.DEACTIVATING);

      await pluginInfo.instance!.deactivate();

      this.updatePluginStatus(pluginId, PluginStatus.LOADED);

      this.logger.info(`Plugin deactivated: ${pluginId}`);
      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_DEACTIVATED, { pluginId });
    } catch (error) {
      const pluginError = new PluginError(
        `Failed to deactivate plugin: ${pluginId}`,
        { pluginId, error }
      );

      this.updatePluginInfo(pluginId, {
        status: PluginStatus.ERROR,
        error: pluginError,
      });

      this.logger.error(pluginError);
      this.eventBus.emit(PLUGIN_EVENTS.PLUGIN_DEACTIVATION_ERROR, {
        pluginId,
        error: pluginError,
      });

      throw pluginError;
    }
  }

  async reloadPlugin(pluginId: string): Promise<PluginInfo> {
    await this.unloadPlugin(pluginId);
    return this.loadPlugin(pluginId);
  }

  getPlugin(pluginId: string): PluginInfo | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }

  getActivePlugins(): PluginInfo[] {
    return this.getAllPlugins().filter(p => p.status === PluginStatus.ACTIVE);
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  async discoverPlugins(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.options.pluginDir, {
        withFileTypes: true,
      });
      const pluginIds: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(
            this.options.pluginDir,
            entry.name,
            'plugin.json'
          );
          try {
            await fs.access(manifestPath);
            pluginIds.push(entry.name);
          } catch {
            // No manifest file, skip
          }
        }
      }

      return pluginIds;
    } catch (error) {
      this.logger.warn('Failed to discover plugins', { error });
      return [];
    }
  }

  async validatePlugin(pluginId: string): Promise<boolean> {
    try {
      const manifest = await this.loadManifest(pluginId);
      this.validateManifest(manifest);
      return true;
    } catch {
      return false;
    }
  }

  async loadAll(): Promise<PluginInfo[]> {
    const pluginIds = await this.discoverPlugins();
    const results: PluginInfo[] = [];

    // Load plugins with concurrency control
    const loadPromises = pluginIds.map(async pluginId => {
      try {
        const result = await this.loadPlugin(pluginId);
        results.push(result);
        return success(result);
      } catch (error) {
        return failure(error as Error);
      }
    });

    const loadResults = await Promise.all(loadPromises);
    const failedLoads = loadResults.filter(isFailure);

    if (failedLoads.length > 0) {
      this.logger.warn(`Failed to load ${failedLoads.length} plugins`, {
        totalPlugins: pluginIds.length,
        successfulLoads: results.length,
      });
    }

    return results;
  }

  async activateAll(): Promise<void> {
    const loadedPlugins = this.getAllPlugins().filter(
      p => p.status === PluginStatus.LOADED
    );

    for (const pluginInfo of loadedPlugins) {
      try {
        await this.activatePlugin(pluginInfo.id);
      } catch (error) {
        this.logger.warn(`Failed to activate plugin: ${pluginInfo.id}`, {
          error,
        });
      }
    }
  }

  async deactivateAll(): Promise<void> {
    const activePlugins = this.getActivePlugins();

    // Deactivate in reverse order of activation
    for (const pluginInfo of activePlugins.reverse()) {
      try {
        await this.deactivatePlugin(pluginInfo.id);
      } catch (error) {
        this.logger.warn(`Failed to deactivate plugin: ${pluginInfo.id}`, {
          error,
        });
      }
    }
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.options.pluginDir, { recursive: true });
    await fs.mkdir(this.options.dataDir, { recursive: true });
  }

  private async loadManifest(pluginId: string): Promise<PluginManifest> {
    const manifestPath = path.join(
      this.options.pluginDir,
      pluginId,
      'plugin.json'
    );

    try {
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(manifestContent) as PluginManifest;
    } catch (error) {
      throw new PluginError(`Failed to load plugin manifest: ${pluginId}`, {
        error,
        manifestPath,
        pluginId,
      });
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    const requiredFields = ['name', 'version', 'description', 'main'];

    for (const field of requiredFields) {
      if (!(field in manifest) || !manifest[field as keyof PluginManifest]) {
        throw new PluginError(`Invalid plugin manifest: missing ${field}`, {
          manifest,
        });
      }
    }

    if (!semverValid(manifest.version)) {
      throw new PluginError(`Invalid plugin version: ${manifest.version}`, {
        manifest,
      });
    }
  }

  private async loadPluginModule(
    pluginId: string,
    manifest: PluginManifest
  ): Promise<PluginModule> {
    const pluginPath = path.join(
      this.options.pluginDir,
      pluginId,
      manifest.main
    );

    try {
      const moduleUrl = pathToFileURL(pluginPath).href;
      const module = await import(moduleUrl);

      if (!module.default || typeof module.default !== 'function') {
        throw new PluginError(
          `Plugin module must export a default constructor function: ${pluginId}`,
          { pluginId, pluginPath }
        );
      }

      return module as PluginModule;
    } catch (error) {
      throw new PluginError(`Failed to load plugin module: ${pluginId}`, {
        error,
        pluginId,
        pluginPath,
      });
    }
  }

  private async createPluginContext(
    pluginId: string,
    manifest: PluginManifest
  ): Promise<PluginContext> {
    const pluginDataDir = path.join(this.options.dataDir, pluginId);
    await fs.mkdir(pluginDataDir, { recursive: true });

    return {
      config: manifest.config || {},
      dataDir: pluginDataDir,
      eventBus: this.eventBus,
      logger: this.logger,
      pluginDir: path.join(this.options.pluginDir, pluginId),
    };
  }

  private updatePluginStatus(pluginId: string, status: PluginStatus): void {
    this.updatePluginInfo(pluginId, { status });
  }

  private updatePluginInfo(
    pluginId: string,
    updates: Partial<PluginInfo>
  ): void {
    const existing = this.plugins.get(pluginId);
    if (existing) {
      this.plugins.set(pluginId, { ...existing, ...updates });
    }
  }
}
