/**
 * Config Modules: Per-Module Lazy-Loaded Config Sections
 *
 * Provides a registry of config module accessors that lazily extract and
 * cache their section from the root config. Modules can register validators,
 * change listeners, and reload handlers for their config section.
 *
 * @module @wundr/orchestrator-daemon/config/config-modules
 */

import type { WundrConfig } from './schemas';
import type { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

export interface ConfigModuleDefinition<T = unknown> {
  /** Module identifier (matches top-level config key) */
  id: string;
  /** Dot-path to the config section (default: same as id) */
  configPath?: string;
  /** Zod schema for this module's config section */
  schema?: z.ZodType<T>;
  /** Called when this module's config section changes during hot-reload */
  onReload?: (next: T, prev: T) => void | Promise<void>;
  /** Whether this module requires a daemon restart on config change */
  requiresRestart?: boolean;
  /** Human-readable module description */
  description?: string;
}

export interface ConfigModule<T = unknown> {
  /** Module identifier */
  readonly id: string;
  /** Get the current config value for this module (lazy, cached) */
  get: () => T;
  /** Force refresh from root config */
  refresh: () => T;
  /** Validate a partial config against this module's schema */
  validate: (value: unknown) => { ok: boolean; error?: string };
  /** Module definition */
  readonly definition: ConfigModuleDefinition<T>;
}

export interface ConfigModuleRegistry {
  /** Register a config module */
  register: <T>(definition: ConfigModuleDefinition<T>) => ConfigModule<T>;
  /** Get a registered module by ID */
  get: <T = unknown>(id: string) => ConfigModule<T> | undefined;
  /** List all registered module IDs */
  list: () => string[];
  /** Update the root config (invalidates all caches) */
  updateRoot: (config: WundrConfig) => void;
  /** Notify modules of config change; returns modules that handled the reload */
  notifyChange: (
    changedPaths: string[],
    newConfig: WundrConfig,
    oldConfig: WundrConfig
  ) => Promise<string[]>;
  /** Get modules that require restart for given changed paths */
  getRestartRequired: (changedPaths: string[]) => string[];
  /** Reset the registry (for testing) */
  reset: () => void;
}

// =============================================================================
// Utilities
// =============================================================================

function getNestedValue(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function pathMatchesModule(changedPath: string, modulePath: string): boolean {
  return changedPath === modulePath || changedPath.startsWith(`${modulePath}.`);
}

// =============================================================================
// Module Factory
// =============================================================================

function createConfigModule<T>(
  definition: ConfigModuleDefinition<T>,
  getRootConfig: () => WundrConfig
): ConfigModule<T> {
  const configPath = definition.configPath ?? definition.id;
  let cached: { value: T; rootRef: WundrConfig } | null = null;

  function extract(): T {
    const root = getRootConfig();

    // Check cache
    if (cached && cached.rootRef === root) {
      return cached.value;
    }

    const raw = getNestedValue(root, configPath);

    // Validate with schema if provided
    if (definition.schema) {
      const result = definition.schema.safeParse(raw);
      if (result.success) {
        cached = { value: result.data, rootRef: root };
        return result.data;
      }
      // Fall through to raw value with a warning
    }

    const value = raw as T;
    cached = { value, rootRef: root };
    return value;
  }

  return {
    id: definition.id,
    definition,
    get: () => extract(),
    refresh: () => {
      cached = null;
      return extract();
    },
    validate: (value: unknown) => {
      if (!definition.schema) {
        return { ok: true };
      }
      const result = definition.schema.safeParse(value);
      if (result.success) {
        return { ok: true };
      }
      const message = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return { ok: false, error: message };
    },
  };
}

// =============================================================================
// Registry Factory
// =============================================================================

/**
 * Create a config module registry.
 *
 * The registry manages per-module config accessors with lazy loading,
 * caching, validation, and change notification.
 */
export function createConfigModuleRegistry(
  initialConfig: WundrConfig
): ConfigModuleRegistry {
  let rootConfig = initialConfig;
  const modules = new Map<string, ConfigModule<unknown>>();
  const definitions = new Map<string, ConfigModuleDefinition<unknown>>();

  function register<T>(definition: ConfigModuleDefinition<T>): ConfigModule<T> {
    if (modules.has(definition.id)) {
      throw new Error(`Config module "${definition.id}" is already registered`);
    }

    const module = createConfigModule(definition, () => rootConfig);
    modules.set(definition.id, module as ConfigModule<unknown>);
    definitions.set(
      definition.id,
      definition as ConfigModuleDefinition<unknown>
    );

    return module;
  }

  function get<T = unknown>(id: string): ConfigModule<T> | undefined {
    return modules.get(id) as ConfigModule<T> | undefined;
  }

  function list(): string[] {
    return Array.from(modules.keys());
  }

  function updateRoot(config: WundrConfig): void {
    rootConfig = config;
    // Invalidate all caches by clearing (they will lazy-reload on next access)
    for (const module of modules.values()) {
      module.refresh();
    }
  }

  async function notifyChange(
    changedPaths: string[],
    newConfig: WundrConfig,
    oldConfig: WundrConfig
  ): Promise<string[]> {
    const handled: string[] = [];

    for (const [id, def] of definitions) {
      const modulePath = def.configPath ?? id;
      const affected = changedPaths.some(p => pathMatchesModule(p, modulePath));

      if (!affected) {
        continue;
      }
      if (def.requiresRestart) {
        continue;
      }
      if (!def.onReload) {
        continue;
      }

      const prevValue = getNestedValue(oldConfig, modulePath);
      const nextValue = getNestedValue(newConfig, modulePath);

      try {
        await def.onReload(nextValue, prevValue);
        handled.push(id);
      } catch (err) {
        // Log but don't fail other modules
        console.error(
          `Config module "${id}" reload handler failed: ${String(err)}`
        );
      }
    }

    return handled;
  }

  function getRestartRequired(changedPaths: string[]): string[] {
    const result: string[] = [];

    for (const [id, def] of definitions) {
      if (!def.requiresRestart) {
        continue;
      }

      const modulePath = def.configPath ?? id;
      const affected = changedPaths.some(p => pathMatchesModule(p, modulePath));

      if (affected) {
        result.push(id);
      }
    }

    return result;
  }

  function reset(): void {
    modules.clear();
    definitions.clear();
  }

  return {
    register,
    get,
    list,
    updateRoot,
    notifyChange,
    getRestartRequired,
    reset,
  };
}

// =============================================================================
// Built-in Module Definitions
// =============================================================================

/**
 * Pre-defined module definitions for standard config sections.
 * Import and register these with your module registry at startup.
 */
export const BUILTIN_MODULE_DEFINITIONS: ConfigModuleDefinition<unknown>[] = [
  {
    id: 'daemon',
    description: 'Daemon server configuration',
    requiresRestart: true,
  },
  {
    id: 'openai',
    description: 'OpenAI provider configuration',
    requiresRestart: true,
  },
  {
    id: 'anthropic',
    description: 'Anthropic provider configuration',
    requiresRestart: true,
  },
  {
    id: 'agents',
    description: 'Agent definitions and defaults',
    requiresRestart: false,
  },
  {
    id: 'memory',
    description: 'Memory backend and compaction',
    requiresRestart: false,
  },
  {
    id: 'security',
    description: 'Security, auth, CORS, rate limiting',
    requiresRestart: false,
  },
  {
    id: 'channels',
    description: 'Messaging channel configurations',
    requiresRestart: false,
  },
  {
    id: 'models',
    description: 'Multi-provider model routing',
    requiresRestart: false,
  },
  {
    id: 'plugins',
    description: 'Plugin loading and configuration',
    requiresRestart: true,
  },
  {
    id: 'hooks',
    description: 'Lifecycle hooks',
    requiresRestart: false,
  },
  {
    id: 'monitoring',
    description: 'Metrics, health checks, tracing',
    requiresRestart: false,
  },
  {
    id: 'logging',
    description: 'Log level, format, rotation',
    requiresRestart: false,
  },
  {
    id: 'distributed',
    description: 'Clustering and load balancing',
    requiresRestart: true,
  },
  {
    id: 'redis',
    description: 'Redis connection',
    requiresRestart: true,
  },
  {
    id: 'database',
    description: 'Database connection',
    requiresRestart: true,
  },
  {
    id: 'tokenBudget',
    description: 'Token usage budget and alerts',
    requiresRestart: false,
  },
  {
    id: 'neolith',
    description: 'Neolith platform integration',
    requiresRestart: true,
  },
];

/**
 * Register all built-in module definitions with a registry.
 */
export function registerBuiltinModules(registry: ConfigModuleRegistry): void {
  for (const def of BUILTIN_MODULE_DEFINITIONS) {
    registry.register(def);
  }
}
