/**
 * Configuration management type definitions
 */

import { BaseConfig } from '@wundr.io/core';

export interface ConfigSource {
  readonly name: string;
  readonly priority: number;
  load(): Promise<Record<string, any>> | Record<string, any>;
  save?(config: Record<string, any>): Promise<void> | void;
  watch?(callback: (config: Record<string, any>) => void): () => void;
}

export interface ConfigManager {
  get<T = any>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  getAll(): Record<string, any>;
  reload(): Promise<void>;
  save(): Promise<void>;
  watch(key: string, callback: (value: any, oldValue: any) => void): () => void;
  watchAll(callback: (config: Record<string, any>) => void): () => void;
  addSource(source: ConfigSource): void;
  removeSource(sourceName: string): void;
  getSources(): ConfigSource[];
  validate(): ValidationResult;
}

export interface ValidationRule {
  readonly key: string;
  readonly validator: (value: any) => boolean | string;
  readonly required?: boolean;
  readonly description?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ValidationError[];
}

export interface ValidationError {
  readonly key: string;
  readonly message: string;
  readonly value: any;
}

export interface ConfigOptions {
  sources?: ConfigSource[];
  validationRules?: ValidationRule[];
  autoReload?: boolean;
  autoSave?: boolean;
  debounceMs?: number;
  freezeConfig?: boolean;
}

export interface WundrConfig extends BaseConfig {
  readonly core?: {
    logLevel?: string;
    logFormat?: 'json' | 'simple' | 'detailed';
    maxMemory?: number;
    tempDir?: string;
  };
  readonly plugins?: {
    enabled?: boolean;
    directory?: string;
    autoLoad?: boolean;
    autoActivate?: boolean;
    maxConcurrentLoads?: number;
  };
  readonly security?: {
    encryptionKey?: string;
    secretsProvider?: string;
    auditEnabled?: boolean;
    rbacEnabled?: boolean;
  };
  readonly performance?: {
    monitoring?: boolean;
    metricsInterval?: number;
    benchmarking?: boolean;
    cacheSize?: number;
  };
  readonly integrations?: {
    github?: {
      token?: string;
      baseUrl?: string;
      timeout?: number;
    };
    claude?: {
      apiKey?: string;
      model?: string;
      maxTokens?: number;
    };
  };
}

// Default configuration structure
export const DEFAULT_CONFIG: WundrConfig = {
  version: '1.0.0',
  environment: 'development',
  debug: false,
  core: {
    logLevel: 'info',
    logFormat: 'detailed',
    maxMemory: 1024 * 1024 * 512, // 512MB
  },
  plugins: {
    enabled: true,
    autoLoad: true,
    autoActivate: true,
    maxConcurrentLoads: 5,
  },
  security: {
    auditEnabled: true,
    rbacEnabled: false,
  },
  performance: {
    monitoring: true,
    metricsInterval: 60000, // 1 minute
    benchmarking: false,
    cacheSize: 100,
  },
};

// Configuration events
export const CONFIG_EVENTS = {
  CONFIG_LOADED: 'config:loaded',
  CONFIG_CHANGED: 'config:changed',
  CONFIG_SAVED: 'config:saved',
  CONFIG_ERROR: 'config:error',
  SOURCE_ADDED: 'config:source:added',
  SOURCE_REMOVED: 'config:source:removed',
  VALIDATION_FAILED: 'config:validation:failed',
} as const;

export type ConfigEventType =
  (typeof CONFIG_EVENTS)[keyof typeof CONFIG_EVENTS];
