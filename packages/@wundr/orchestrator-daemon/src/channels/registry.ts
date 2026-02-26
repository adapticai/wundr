/**
 * Channel Registry
 *
 * Manages registration, lookup, and lifecycle of channel adapters.
 * Inspired by OpenClaw's two-tier registry (built-in + plugins) with alias
 * resolution and normalization.
 *
 * @packageDocumentation
 */

import type {
  ChannelId,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelMeta,
  ChannelPlugin,
} from './types.js';

// ---------------------------------------------------------------------------
// Registry Entry
// ---------------------------------------------------------------------------

/**
 * Internal entry wrapping a registered channel plugin with metadata.
 */
interface RegistryEntry {
  readonly plugin: ChannelPlugin;
  readonly registeredAt: Date;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Registry Options
// ---------------------------------------------------------------------------

export interface ChannelRegistryOptions {
  /** Logger instance for the registry. */
  logger?: ChannelLogger;
}

// ---------------------------------------------------------------------------
// ChannelRegistry
// ---------------------------------------------------------------------------

/**
 * Central registry for channel plugins. Provides:
 *
 * - Registration and unregistration of channel adapters
 * - Alias resolution (e.g., "tg" -> "telegram")
 * - Normalized case-insensitive lookup
 * - Health monitoring across all registered channels
 * - Ordered listing for UI display
 */
export class ChannelRegistry {
  private readonly entries = new Map<ChannelId, RegistryEntry>();
  private readonly aliases = new Map<string, ChannelId>();
  private readonly logger: ChannelLogger;

  constructor(options?: ChannelRegistryOptions) {
    this.logger = options?.logger ?? {
      info: (msg, ...args) => console.log(`[ChannelRegistry] ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[ChannelRegistry] ${msg}`, ...args),
      error: (msg, ...args) =>
        console.error(`[ChannelRegistry] ${msg}`, ...args),
      debug: (msg, ...args) =>
        console.debug(`[ChannelRegistry] ${msg}`, ...args),
    };
  }

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------

  /**
   * Register a channel plugin.
   *
   * @param plugin - The channel plugin to register.
   * @throws Error if a plugin with the same ID is already registered.
   */
  register(plugin: ChannelPlugin): void {
    const id = normalizeKey(plugin.id);
    if (this.entries.has(id)) {
      throw new Error(
        `Channel "${id}" is already registered. Unregister it first.`
      );
    }

    this.entries.set(id, {
      plugin,
      registeredAt: new Date(),
      enabled: true,
    });

    // Register aliases
    if (plugin.meta.aliases) {
      for (const alias of plugin.meta.aliases) {
        const normalizedAlias = normalizeKey(alias);
        if (this.aliases.has(normalizedAlias)) {
          this.logger.warn(
            `Alias "${normalizedAlias}" already maps to "${this.aliases.get(normalizedAlias)}"; ` +
              `overwriting with "${id}".`
          );
        }
        this.aliases.set(normalizedAlias, id);
      }
    }

    this.logger.info(`Registered channel: ${plugin.meta.label} (${id})`);
  }

  /**
   * Register multiple channel plugins at once.
   */
  registerAll(plugins: readonly ChannelPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * Unregister a channel plugin by ID.
   *
   * @param id - The channel ID to unregister.
   * @returns True if the channel was found and removed.
   */
  unregister(id: ChannelId): boolean {
    const normalizedId = normalizeKey(id);
    const entry = this.entries.get(normalizedId);
    if (!entry) {
      return false;
    }

    // Remove aliases pointing to this channel.
    if (entry.plugin.meta.aliases) {
      for (const alias of entry.plugin.meta.aliases) {
        const normalizedAlias = normalizeKey(alias);
        if (this.aliases.get(normalizedAlias) === normalizedId) {
          this.aliases.delete(normalizedAlias);
        }
      }
    }

    this.entries.delete(normalizedId);
    this.logger.info(`Unregistered channel: ${normalizedId}`);
    return true;
  }

  // -----------------------------------------------------------------------
  // Lookup
  // -----------------------------------------------------------------------

  /**
   * Resolve an alias or ID to a canonical ChannelId.
   * Returns null if the input does not match any registered channel.
   */
  resolve(aliasOrId: string | null | undefined): ChannelId | null {
    const key = normalizeKey(aliasOrId ?? '');
    if (!key) {
      return null;
    }

    // Direct match.
    if (this.entries.has(key)) {
      return key;
    }

    // Alias match.
    const aliased = this.aliases.get(key);
    if (aliased && this.entries.has(aliased)) {
      return aliased;
    }

    return null;
  }

  /**
   * Get a channel plugin by ID or alias.
   * Returns undefined if not found.
   */
  get(idOrAlias: string): ChannelPlugin | undefined {
    const resolved = this.resolve(idOrAlias);
    if (!resolved) {
      return undefined;
    }
    return this.entries.get(resolved)?.plugin;
  }

  /**
   * Get a channel plugin, throwing if not found.
   */
  require(idOrAlias: string): ChannelPlugin {
    const plugin = this.get(idOrAlias);
    if (!plugin) {
      throw new Error(
        `Channel "${idOrAlias}" is not registered. ` +
          `Available: ${this.listIds().join(', ') || '(none)'}`
      );
    }
    return plugin;
  }

  /**
   * Check whether a channel is registered.
   */
  has(idOrAlias: string): boolean {
    return this.resolve(idOrAlias) !== null;
  }

  // -----------------------------------------------------------------------
  // Listing
  // -----------------------------------------------------------------------

  /**
   * List all registered channel IDs.
   */
  listIds(): ChannelId[] {
    return Array.from(this.entries.keys());
  }

  /**
   * List all registered channel plugins, sorted by their declared order.
   */
  list(): ChannelPlugin[] {
    const sorted = Array.from(this.entries.values()).sort((a, b) => {
      const orderA = a.plugin.meta.order ?? 999;
      const orderB = b.plugin.meta.order ?? 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.plugin.id.localeCompare(b.plugin.id);
    });
    return sorted.map(entry => entry.plugin);
  }

  /**
   * List metadata for all registered channels (lightweight, no plugin ref).
   */
  listMeta(): ChannelMeta[] {
    return this.list().map(plugin => plugin.meta);
  }

  /**
   * List only channels that are currently enabled.
   */
  listEnabled(): ChannelPlugin[] {
    return this.list().filter(plugin => {
      const entry = this.entries.get(normalizeKey(plugin.id));
      return entry?.enabled ?? false;
    });
  }

  /**
   * List only channels that are currently connected.
   */
  listConnected(): ChannelPlugin[] {
    return this.list().filter(plugin => plugin.isConnected());
  }

  /**
   * List all registered aliases and what they map to.
   */
  listAliases(): ReadonlyMap<string, ChannelId> {
    return this.aliases;
  }

  // -----------------------------------------------------------------------
  // Enable / Disable
  // -----------------------------------------------------------------------

  /**
   * Enable or disable a channel. Disabled channels remain registered but
   * are excluded from listEnabled().
   */
  setEnabled(idOrAlias: string, enabled: boolean): boolean {
    const resolved = this.resolve(idOrAlias);
    if (!resolved) {
      return false;
    }
    const entry = this.entries.get(resolved);
    if (!entry) {
      return false;
    }
    entry.enabled = enabled;
    this.logger.info(`Channel ${resolved} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Check whether a channel is enabled.
   */
  isEnabled(idOrAlias: string): boolean {
    const resolved = this.resolve(idOrAlias);
    if (!resolved) {
      return false;
    }
    return this.entries.get(resolved)?.enabled ?? false;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Disconnect all connected channels. Used during graceful shutdown.
   */
  async disconnectAll(): Promise<void> {
    const connected = this.listConnected();
    const results = await Promise.allSettled(
      connected.map(async plugin => {
        this.logger.info(`Disconnecting channel: ${plugin.id}`);
        await plugin.disconnect();
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Error disconnecting channel: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
      }
    }
  }

  /**
   * Run health checks on all registered channels.
   */
  async healthCheckAll(): Promise<ChannelHealthStatus[]> {
    const results = await Promise.allSettled(
      this.list().map(plugin => plugin.healthCheck())
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const plugin = this.list()[index];
      return {
        channelId: plugin?.id ?? 'unknown',
        healthy: false,
        connected: false,
        lastError:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    });
  }

  // -----------------------------------------------------------------------
  // Size
  // -----------------------------------------------------------------------

  /**
   * Number of registered channels.
   */
  get size(): number {
    return this.entries.size;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Singleton Factory
// ---------------------------------------------------------------------------

let defaultRegistry: ChannelRegistry | null = null;

/**
 * Get or create the default global channel registry.
 * Use this for the common case where a single registry is shared across
 * the Orchestrator daemon.
 */
export function getDefaultRegistry(): ChannelRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ChannelRegistry();
  }
  return defaultRegistry;
}

/**
 * Replace the default global registry. Useful for testing.
 */
export function setDefaultRegistry(registry: ChannelRegistry | null): void {
  defaultRegistry = registry;
}
