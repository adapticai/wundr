/**
 * Plugin system type definitions
 */

import { EventBus, Logger } from '@wundr.io/core';

export interface PluginMetadata {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly license?: string;
  readonly keywords?: string[];
  readonly repository?: string;
  readonly homepage?: string;
  readonly dependencies?: string[];
  readonly peerDependencies?: string[];
}

export interface PluginContext {
  readonly logger: Logger;
  readonly eventBus: EventBus;
  readonly config: Record<string, any>;
  readonly pluginDir: string;
  readonly dataDir: string;
}

export interface Plugin {
  readonly metadata: PluginMetadata;
  initialize(context: PluginContext): Promise<void> | void;
  activate(): Promise<void> | void;
  deactivate(): Promise<void> | void;
  destroy?(): Promise<void> | void;
}

export interface PluginConstructor {
  new (): Plugin;
}

export interface PluginModule {
  default: PluginConstructor;
  metadata?: Partial<PluginMetadata>;
}

export interface PluginManifest extends PluginMetadata {
  readonly main: string;
  readonly enabled?: boolean;
  readonly config?: Record<string, any>;
}

export interface PluginInfo {
  readonly id: string;
  readonly metadata: PluginMetadata;
  readonly status: PluginStatus;
  readonly instance?: Plugin;
  readonly context?: PluginContext;
  readonly error?: Error;
  readonly loadTime?: number;
  readonly activationTime?: number;
}

export enum PluginStatus {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  ERROR = 'error',
}

export interface PluginHook<T = any> {
  readonly name: string;
  readonly description?: string;
  execute(...args: any[]): T | Promise<T>;
}

export interface PluginHookRegistry {
  register<T>(name: string, hook: PluginHook<T>): void;
  unregister(name: string, hook: PluginHook): void;
  execute<T>(name: string, ...args: any[]): Promise<T[]>;
  executeSync<T>(name: string, ...args: any[]): T[];
  has(name: string): boolean;
  getHooks(name: string): PluginHook[];
  clear(name?: string): void;
}

export interface PluginManagerOptions {
  pluginDir: string;
  dataDir: string;
  autoLoad?: boolean;
  autoActivate?: boolean;
  maxConcurrentLoads?: number;
  loadTimeout?: number;
  logger?: Logger;
  eventBus?: EventBus;
}

export interface PluginManager {
  readonly options: PluginManagerOptions;
  readonly hookRegistry: PluginHookRegistry;
  
  // Plugin lifecycle
  loadPlugin(pluginId: string): Promise<PluginInfo>;
  unloadPlugin(pluginId: string): Promise<void>;
  activatePlugin(pluginId: string): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  reloadPlugin(pluginId: string): Promise<PluginInfo>;
  
  // Plugin management
  getPlugin(pluginId: string): PluginInfo | undefined;
  getAllPlugins(): PluginInfo[];
  getActivePlugins(): PluginInfo[];
  hasPlugin(pluginId: string): boolean;
  
  // Plugin discovery
  discoverPlugins(): Promise<string[]>;
  validatePlugin(pluginId: string): Promise<boolean>;
  
  // Batch operations
  loadAll(): Promise<PluginInfo[]>;
  activateAll(): Promise<void>;
  deactivateAll(): Promise<void>;
  
  // Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

// Plugin events
export const PLUGIN_EVENTS = {
  PLUGIN_LOADING: 'plugin:loading',
  PLUGIN_LOADED: 'plugin:loaded',
  PLUGIN_LOAD_ERROR: 'plugin:load:error',
  PLUGIN_ACTIVATING: 'plugin:activating',
  PLUGIN_ACTIVATED: 'plugin:activated',
  PLUGIN_ACTIVATION_ERROR: 'plugin:activation:error',
  PLUGIN_DEACTIVATING: 'plugin:deactivating',
  PLUGIN_DEACTIVATED: 'plugin:deactivated',
  PLUGIN_DEACTIVATION_ERROR: 'plugin:deactivation:error',
  PLUGIN_UNLOADING: 'plugin:unloading',
  PLUGIN_UNLOADED: 'plugin:unloaded',
  PLUGIN_ERROR: 'plugin:error',
  HOOK_REGISTERED: 'plugin:hook:registered',
  HOOK_UNREGISTERED: 'plugin:hook:unregistered',
  HOOK_EXECUTED: 'plugin:hook:executed',
} as const;

export type PluginEventType = typeof PLUGIN_EVENTS[keyof typeof PLUGIN_EVENTS];

// Hook system types
export interface HookExecutionContext {
  readonly hookName: string;
  readonly args: any[];
  readonly plugin: PluginInfo;
  readonly timestamp: Date;
}

export interface HookResult<T = any> {
  readonly plugin: PluginInfo;
  readonly result: T;
  readonly duration: number;
  readonly error?: Error;
}

// Plugin configuration schema
export interface PluginConfigSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, PluginConfigSchema>;
  items?: PluginConfigSchema;
  required?: string[];
  default?: any;
  description?: string;
  examples?: any[];
}