/**
 * Configuration manager implementation
 */

// EventEmitter not used - removed
import { 
  getLogger, 
  getEventBus, 
  Logger, 
  EventBus, 
  BaseWundrError, 
  getNestedValue, 
  setNestedValue, 
  deepMerge,
  debounceAsync 
} from '@wundr.io/core';
import {
  ConfigSource,
  ConfigManager,
  ConfigOptions,
  ValidationRule,
  ValidationResult,
  ValidationError,
  CONFIG_EVENTS,
} from '../types/index.js';

export class ConfigError extends BaseWundrError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context);
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class WundrConfigManager implements ConfigManager {
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly sources: ConfigSource[] = [];
  private readonly validationRules: ValidationRule[] = [];
  private readonly options: Required<ConfigOptions>;
  private config: Record<string, any> = {};
  private watchers = new Map<string, Array<(value: any, oldValue: any) => void>>();
  private globalWatchers: Array<(config: Record<string, any>) => void> = [];
  private sourceWatchers = new Map<string, () => void>();
  private readonly debouncedSave: () => Promise<void>;
  private readonly debouncedReload: () => Promise<void>;
  private initialized = false;

  constructor(options: ConfigOptions = {}) {
    this.options = {
      sources: [],
      validationRules: [],
      autoReload: true,
      autoSave: false,
      debounceMs: 300,
      freezeConfig: false,
      ...options,
    };

    this.logger = getLogger();
    this.eventBus = getEventBus();

    // Add initial sources
    for (const source of this.options.sources) {
      this.addSource(source);
    }

    // Add initial validation rules
    this.validationRules.push(...this.options.validationRules);

    // Create debounced functions
    this.debouncedSave = debounceAsync(
      this.doSave.bind(this),
      this.options.debounceMs
    );
    
    this.debouncedReload = debounceAsync(
      this.doReload.bind(this),
      this.options.debounceMs
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing configuration manager', {
      sources: this.sources.length,
      autoReload: this.options.autoReload,
      autoSave: this.options.autoSave,
    });

    await this.reload();
    
    if (this.options.autoReload) {
      this.setupSourceWatchers();
    }

    this.initialized = true;
    this.logger.info('Configuration manager initialized');
  }

  get<T = any>(key: string, defaultValue?: T): T {
    const value = getNestedValue(this.config, key, defaultValue);
    return value as T;
  }

  set(key: string, value: any): void {
    const oldValue = this.get(key);
    setNestedValue(this.config, key, value);
    
    this.logger.debug(`Configuration set: ${key}`, {
      key,
      valueType: typeof value,
      hasOldValue: oldValue !== undefined,
    });

    // Notify watchers
    this.notifyWatchers(key, value, oldValue);
    this.notifyGlobalWatchers();

    // Emit change event
    this.eventBus.emit(CONFIG_EVENTS.CONFIG_CHANGED, {
      key,
      value,
      oldValue,
    });

    // Auto-save if enabled
    if (this.options.autoSave) {
      this.debouncedSave().catch(error => {
        this.logger.error('Auto-save failed', { error });
      });
    }
  }

  has(key: string): boolean {
    return getNestedValue(this.config, key) !== undefined;
  }

  delete(key: string): void {
    const oldValue = this.get(key);
    const keys = key.split('.');
    const lastKey = keys.pop()!;
    
    let current = this.config;
    for (const k of keys) {
      if (!(k in current) || typeof current[k] !== 'object') {
        return; // Key doesn't exist
      }
      current = current[k];
    }

    delete current[lastKey];
    
    this.logger.debug(`Configuration deleted: ${key}`, { key });

    // Notify watchers
    this.notifyWatchers(key, undefined, oldValue);
    this.notifyGlobalWatchers();

    // Emit change event
    this.eventBus.emit(CONFIG_EVENTS.CONFIG_CHANGED, {
      key,
      value: undefined,
      oldValue,
      deleted: true,
    });

    // Auto-save if enabled
    if (this.options.autoSave) {
      this.debouncedSave().catch(error => {
        this.logger.error('Auto-save failed', { error });
      });
    }
  }

  clear(): void {
    const oldConfig = { ...this.config };
    this.config = {};
    
    this.logger.info('Configuration cleared');

    // Notify all watchers
    for (const [key] of this.watchers) {
      this.notifyWatchers(key, undefined, getNestedValue(oldConfig, key));
    }
    this.notifyGlobalWatchers();

    // Emit change event
    this.eventBus.emit(CONFIG_EVENTS.CONFIG_CHANGED, {
      cleared: true,
      oldConfig,
    });

    // Auto-save if enabled
    if (this.options.autoSave) {
      this.debouncedSave().catch(error => {
        this.logger.error('Auto-save failed', { error });
      });
    }
  }

  getAll(): Record<string, any> {
    return this.options.freezeConfig 
      ? Object.freeze({ ...this.config })
      : { ...this.config };
  }

  async reload(): Promise<void> {
    await this.debouncedReload();
  }

  async save(): Promise<void> {
    await this.doSave();
  }

  watch(key: string, callback: (value: any, oldValue: any) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }
    
    const keyWatchers = this.watchers.get(key)!;
    keyWatchers.push(callback);
    
    this.logger.debug(`Added watcher for key: ${key}`);

    return () => {
      const index = keyWatchers.indexOf(callback);
      if (index !== -1) {
        keyWatchers.splice(index, 1);
        
        if (keyWatchers.length === 0) {
          this.watchers.delete(key);
        }
        
        this.logger.debug(`Removed watcher for key: ${key}`);
      }
    };
  }

  watchAll(callback: (config: Record<string, any>) => void): () => void {
    this.globalWatchers.push(callback);
    
    this.logger.debug('Added global configuration watcher');

    return () => {
      const index = this.globalWatchers.indexOf(callback);
      if (index !== -1) {
        this.globalWatchers.splice(index, 1);
        this.logger.debug('Removed global configuration watcher');
      }
    };
  }

  addSource(source: ConfigSource): void {
    // Check for duplicate names
    if (this.sources.some(s => s.name === source.name)) {
      throw new ConfigError(`Configuration source already exists: ${source.name}`);
    }

    this.sources.push(source);
    
    // Sort by priority (higher priority first)
    this.sources.sort((a, b) => b.priority - a.priority);
    
    this.logger.info(`Added configuration source: ${source.name}`, {
      priority: source.priority,
      totalSources: this.sources.length,
    });

    this.eventBus.emit(CONFIG_EVENTS.SOURCE_ADDED, {
      sourceName: source.name,
      priority: source.priority,
    });

    // Setup watcher if auto-reload is enabled and we're initialized
    if (this.options.autoReload && this.initialized && source.watch) {
      this.setupSourceWatcher(source);
    }
  }

  removeSource(sourceName: string): void {
    const index = this.sources.findIndex(s => s.name === sourceName);
    if (index === -1) {
      return;
    }

    this.sources.splice(index, 1);
    
    // Remove watcher
    const unwatch = this.sourceWatchers.get(sourceName);
    if (unwatch) {
      unwatch();
      this.sourceWatchers.delete(sourceName);
    }
    
    this.logger.info(`Removed configuration source: ${sourceName}`);

    this.eventBus.emit(CONFIG_EVENTS.SOURCE_REMOVED, {
      sourceName,
    });
  }

  getSources(): ConfigSource[] {
    return [...this.sources];
  }

  validate(): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of this.validationRules) {
      const value = this.get(rule.key);
      const exists = this.has(rule.key);

      // Check required fields
      if (rule.required && !exists) {
        errors.push({
          key: rule.key,
          message: `Required configuration key missing: ${rule.key}`,
          value: undefined,
        });
        continue;
      }

      // Skip validation for optional missing keys
      if (!exists) {
        continue;
      }

      // Run validator
      try {
        const result = rule.validator(value);
        if (result !== true) {
          errors.push({
            key: rule.key,
            message: typeof result === 'string' 
              ? result 
              : `Validation failed for key: ${rule.key}`,
            value,
          });
        }
      } catch (error) {
        errors.push({
          key: rule.key,
          message: `Validation error for key ${rule.key}: ${error instanceof Error ? error.message : String(error)}`,
          value,
        });
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };

    if (!result.valid) {
      this.logger.warn(`Configuration validation failed`, {
        errorCount: errors.length,
        errors: errors.map(e => ({ key: e.key, message: e.message })),
      });

      this.eventBus.emit(CONFIG_EVENTS.VALIDATION_FAILED, {
        errors,
      });
    }

    return result;
  }

  private async doReload(): Promise<void> {
    this.logger.debug('Reloading configuration from all sources');
    
    const configs: Record<string, any>[] = [];
    
    // Load from all sources
    for (const source of this.sources) {
      try {
        const sourceConfig = await source.load();
        configs.push(sourceConfig);
        
        this.logger.debug(`Loaded configuration from source: ${source.name}`, {
          keyCount: Object.keys(sourceConfig).length,
        });
      } catch (error) {
        this.logger.error(`Failed to load from source: ${source.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        this.eventBus.emit(CONFIG_EVENTS.CONFIG_ERROR, {
          sourceName: source.name,
          error,
        });
        
        // Continue with other sources
      }
    }

    // Merge configurations (lower priority sources first)
    const oldConfig = { ...this.config };
    this.config = deepMerge({}, ...configs.reverse());
    
    this.logger.info('Configuration reloaded', {
      sources: this.sources.length,
      totalKeys: Object.keys(this.config).length,
    });

    // Notify watchers of changes
    this.notifyAllWatchersOfChanges(oldConfig, this.config);
    this.notifyGlobalWatchers();

    this.eventBus.emit(CONFIG_EVENTS.CONFIG_LOADED, {
      config: this.getAll(),
      sources: this.sources.length,
    });
  }

  private async doSave(): Promise<void> {
    this.logger.debug('Saving configuration to writable sources');
    
    const writableSources = this.sources.filter(s => typeof s.save === 'function');
    
    if (writableSources.length === 0) {
      this.logger.warn('No writable configuration sources available');
      return;
    }

    const config = this.getAll();
    
    for (const source of writableSources) {
      try {
        await source.save!(config);
        
        this.logger.debug(`Saved configuration to source: ${source.name}`);
      } catch (error) {
        this.logger.error(`Failed to save to source: ${source.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        this.eventBus.emit(CONFIG_EVENTS.CONFIG_ERROR, {
          sourceName: source.name,
          error,
          operation: 'save',
        });
      }
    }

    this.eventBus.emit(CONFIG_EVENTS.CONFIG_SAVED, {
      config,
      writableSources: writableSources.length,
    });
    
    this.logger.info('Configuration saved', {
      writableSources: writableSources.length,
    });
  }

  private setupSourceWatchers(): void {
    for (const source of this.sources) {
      this.setupSourceWatcher(source);
    }
  }

  private setupSourceWatcher(source: ConfigSource): void {
    if (!source.watch) {
      return;
    }

    const unwatch = source.watch(() => {
      this.logger.debug(`Configuration change detected from source: ${source.name}`);
      this.debouncedReload().catch(error => {
        this.logger.error('Failed to reload configuration after source change', {
          sourceName: source.name,
          error,
        });
      });
    });

    this.sourceWatchers.set(source.name, unwatch);
    
    this.logger.debug(`Setup watcher for configuration source: ${source.name}`);
  }

  private notifyWatchers(key: string, value: any, oldValue: any): void {
    const keyWatchers = this.watchers.get(key);
    if (!keyWatchers) {
      return;
    }

    for (const callback of keyWatchers) {
      try {
        callback(value, oldValue);
      } catch (error) {
        this.logger.error(`Error in configuration watcher for key: ${key}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private notifyGlobalWatchers(): void {
    const config = this.getAll();
    
    for (const callback of this.globalWatchers) {
      try {
        callback(config);
      } catch (error) {
        this.logger.error('Error in global configuration watcher', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private notifyAllWatchersOfChanges(
    oldConfig: Record<string, any>,
    newConfig: Record<string, any>
  ): void {
    // Find all keys that changed
    const allKeys = new Set([
      ...this.getAllNestedKeys(oldConfig),
      ...this.getAllNestedKeys(newConfig),
    ]);

    for (const key of allKeys) {
      const oldValue = getNestedValue(oldConfig, key);
      const newValue = getNestedValue(newConfig, key);
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        this.notifyWatchers(key, newValue, oldValue);
      }
    }
  }

  private getAllNestedKeys(obj: Record<string, any>, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this.getAllNestedKeys(value, fullKey));
      }
    }
    
    return keys;
  }
}