/**
 * @packageDocumentation
 * Hooks Registry - Manages lifecycle hooks and event handlers
 *
 * This module provides a centralized registry for managing hook configurations
 * across the organization. Hooks enable automated actions during agent lifecycle
 * events such as tool usage, commits, and other operational triggers.
 *
 * @module @wundr/org-genesis/registry/hooks-registry
 */

import { FileStorage } from './storage/file-storage.js';
import { MemoryStorage } from './storage/memory-storage.js';

import type { IRegistryStorage, StorageConfig } from './storage/storage-interface.js';
import type { HookConfig } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook event types supported by the registry.
 *
 * @description
 * These types represent the lifecycle events that can trigger hooks:
 * - `preToolUse` - Triggered before a tool is invoked
 * - `postToolUse` - Triggered after a tool completes execution
 * - `preCommit` - Triggered before a git commit is created
 * - `postCommit` - Triggered after a git commit is created
 */
export type HookEventType = 'preToolUse' | 'postToolUse' | 'preCommit' | 'postCommit';

/**
 * Hook registry entry representing a registered hook configuration.
 *
 * This interface extends the base HookConfig with registry-specific metadata
 * including unique identification, discipline associations, and lifecycle tracking.
 *
 * @example
 * ```typescript
 * const hookEntry: HookRegistryEntry = {
 *   id: 'hook-lint-001',
 *   name: 'Pre-Commit Linting',
 *   description: 'Run ESLint before committing code changes',
 *   config: {
 *     event: 'PreCommit',
 *     command: 'npm run lint',
 *     description: 'Lint check',
 *     blocking: true,
 *   },
 *   disciplineIds: ['frontend', 'backend'],
 *   priority: 10,
 *   enabled: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface HookRegistryEntry {
  /**
   * Unique identifier for the hook registry entry.
   * Typically a UUID or deterministic hash.
   */
  id: string;

  /**
   * Human-readable name for the hook.
   * Used for display and logging purposes.
   */
  name: string;

  /**
   * Detailed description of the hook's purpose and behavior.
   */
  description: string;

  /**
   * The underlying hook configuration defining the event trigger and command.
   */
  config: HookConfig;

  /**
   * Array of discipline IDs that this hook applies to.
   * An empty array indicates the hook applies globally.
   */
  disciplineIds: string[];

  /**
   * Priority order for hook execution.
   * Lower numbers execute first. Hooks with the same priority
   * execute in registration order.
   *
   * @default 100
   */
  priority: number;

  /**
   * Whether the hook is currently enabled.
   * Disabled hooks are not executed but remain in the registry.
   *
   * @default true
   */
  enabled: boolean;

  /**
   * Timestamp when the hook was registered.
   */
  createdAt: Date;

  /**
   * Timestamp when the hook was last updated.
   */
  updatedAt: Date;
}

/**
 * Configuration options for the HooksRegistry.
 *
 * @example
 * ```typescript
 * // File-based storage configuration
 * const config: HooksRegistryConfig = {
 *   storage: {
 *     type: 'file',
 *     basePath: './.wundr/registry',
 *     namespace: 'hooks',
 *   },
 * };
 *
 * // In-memory storage configuration
 * const memConfig: HooksRegistryConfig = {
 *   storage: {
 *     type: 'memory',
 *     namespace: 'hooks',
 *   },
 * };
 * ```
 */
export interface HooksRegistryConfig {
  /**
   * Storage configuration for persisting hook entries.
   */
  storage: StorageConfig;
}

// ============================================================================
// HooksRegistry Class
// ============================================================================

/**
 * Hooks Registry - Centralized management for lifecycle hooks.
 *
 * The HooksRegistry provides a comprehensive interface for registering,
 * managing, and querying hook configurations. It supports multiple storage
 * backends, enabling both persistent (file-based) and ephemeral (memory)
 * storage patterns.
 *
 * Key features:
 * - Register and manage hook configurations
 * - Filter hooks by discipline, type, or enabled status
 * - Priority-based hook ordering for execution
 * - Enable/disable hooks without removing them
 *
 * @example
 * ```typescript
 * // Create a hooks registry with file storage
 * const registry = new HooksRegistry({
 *   storage: {
 *     type: 'file',
 *     basePath: './.wundr/registry',
 *     namespace: 'hooks',
 *   },
 * });
 *
 * // Register a new hook
 * await registry.register({
 *   id: 'hook-001',
 *   name: 'Lint Check',
 *   description: 'Run linting before tool use',
 *   config: {
 *     event: 'PreToolUse',
 *     command: 'npm run lint',
 *     description: 'Lint check',
 *     blocking: true,
 *   },
 *   disciplineIds: ['engineering'],
 *   priority: 10,
 *   enabled: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // List all enabled hooks
 * const enabledHooks = await registry.listEnabled();
 *
 * // Get hooks for a specific discipline
 * const engineeringHooks = await registry.listByDiscipline('engineering');
 * ```
 */
export class HooksRegistry {
  /**
   * Internal storage backend for hook entries.
   */
  private readonly storage: IRegistryStorage<HookRegistryEntry>;

  /**
   * Creates a new HooksRegistry instance.
   *
   * @param config - Configuration options for the registry
   *
   * @example
   * ```typescript
   * const registry = new HooksRegistry({
   *   storage: {
   *     type: 'memory',
   *     namespace: 'hooks',
   *   },
   * });
   * ```
   */
  constructor(config: HooksRegistryConfig) {
    if (config.storage.type === 'file') {
      this.storage = new FileStorage<HookRegistryEntry>({
        basePath: config.storage.basePath ?? './.wundr/registry',
        namespace: config.storage.namespace ?? 'hooks',
      });
    } else {
      this.storage = new MemoryStorage<HookRegistryEntry>();
    }
  }

  /**
   * Registers a new hook entry in the registry.
   *
   * If a hook with the same ID already exists, it will be overwritten.
   *
   * @param entry - The hook registry entry to register
   * @returns Promise that resolves when the hook is registered
   * @throws {Error} If the storage operation fails
   *
   * @example
   * ```typescript
   * await registry.register({
   *   id: 'hook-pre-commit-001',
   *   name: 'Pre-Commit Tests',
   *   description: 'Run unit tests before commits',
   *   config: {
   *     event: 'PreCommit',
   *     command: 'npm test',
   *     description: 'Run tests',
   *     blocking: true,
   *   },
   *   disciplineIds: ['engineering'],
   *   priority: 20,
   *   enabled: true,
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  async register(entry: HookRegistryEntry): Promise<void> {
    await this.storage.set(entry.id, entry);
  }

  /**
   * Retrieves a hook entry by its unique identifier.
   *
   * @param id - The unique identifier of the hook to retrieve
   * @returns The hook entry if found, or null if not present
   *
   * @example
   * ```typescript
   * const hook = await registry.get('hook-pre-commit-001');
   * if (hook) {
   *   console.log(`Found hook: ${hook.name}`);
   * }
   * ```
   */
  async get(id: string): Promise<HookRegistryEntry | null> {
    return this.storage.get(id);
  }

  /**
   * Lists all hook entries in the registry.
   *
   * Results are sorted by priority (ascending) to support
   * execution order requirements.
   *
   * @returns Array of all registered hook entries, sorted by priority
   *
   * @example
   * ```typescript
   * const allHooks = await registry.list();
   * console.log(`Total hooks: ${allHooks.length}`);
   * ```
   */
  async list(): Promise<HookRegistryEntry[]> {
    const hooks = await this.storage.list();
    return this.sortByPriority(hooks);
  }

  /**
   * Lists all hook entries associated with a specific discipline.
   *
   * Returns hooks that either:
   * - Have the specified discipline ID in their disciplineIds array
   * - Have an empty disciplineIds array (global hooks)
   *
   * @param disciplineId - The discipline ID to filter by
   * @returns Array of hook entries for the discipline, sorted by priority
   *
   * @example
   * ```typescript
   * const frontendHooks = await registry.listByDiscipline('frontend');
   * for (const hook of frontendHooks) {
   *   console.log(`- ${hook.name} (priority: ${hook.priority})`);
   * }
   * ```
   */
  async listByDiscipline(disciplineId: string): Promise<HookRegistryEntry[]> {
    const hooks = await this.storage.query(
      (hook) =>
        hook.disciplineIds.length === 0 || hook.disciplineIds.includes(disciplineId),
    );
    return this.sortByPriority(hooks);
  }

  /**
   * Lists all hook entries of a specific event type.
   *
   * Maps the input type to the corresponding HookConfig event format.
   *
   * @param type - The hook event type to filter by
   * @returns Array of hook entries matching the type, sorted by priority
   *
   * @example
   * ```typescript
   * const preToolHooks = await registry.listByType('preToolUse');
   * console.log(`Found ${preToolHooks.length} pre-tool-use hooks`);
   * ```
   */
  async listByType(type: HookEventType): Promise<HookRegistryEntry[]> {
    const eventMapping: Record<HookEventType, HookConfig['event']> = {
      preToolUse: 'PreToolUse',
      postToolUse: 'PostToolUse',
      preCommit: 'PreCommit',
      postCommit: 'PostCommit',
    };

    const targetEvent = eventMapping[type];
    const hooks = await this.storage.query(
      (hook) => hook.config.event === targetEvent,
    );
    return this.sortByPriority(hooks);
  }

  /**
   * Lists all currently enabled hook entries.
   *
   * Filters to only include hooks where enabled === true.
   *
   * @returns Array of enabled hook entries, sorted by priority
   *
   * @example
   * ```typescript
   * const activeHooks = await registry.listEnabled();
   * console.log(`${activeHooks.length} hooks are currently enabled`);
   * ```
   */
  async listEnabled(): Promise<HookRegistryEntry[]> {
    const hooks = await this.storage.query((hook) => hook.enabled === true);
    return this.sortByPriority(hooks);
  }

  /**
   * Enables a hook by its identifier.
   *
   * Sets the enabled property to true and updates the timestamp.
   *
   * @param id - The unique identifier of the hook to enable
   * @returns Promise that resolves when the hook is enabled
   * @throws {Error} If the hook does not exist
   *
   * @example
   * ```typescript
   * await registry.enable('hook-pre-commit-001');
   * console.log('Hook enabled');
   * ```
   */
  async enable(id: string): Promise<void> {
    const hook = await this.storage.get(id);
    if (!hook) {
      throw new Error(`Hook not found: ${id}`);
    }

    hook.enabled = true;
    hook.updatedAt = new Date();
    await this.storage.set(id, hook);
  }

  /**
   * Disables a hook by its identifier.
   *
   * Sets the enabled property to false and updates the timestamp.
   * Disabled hooks remain in the registry but are not included
   * in listEnabled() results.
   *
   * @param id - The unique identifier of the hook to disable
   * @returns Promise that resolves when the hook is disabled
   * @throws {Error} If the hook does not exist
   *
   * @example
   * ```typescript
   * await registry.disable('hook-pre-commit-001');
   * console.log('Hook disabled');
   * ```
   */
  async disable(id: string): Promise<void> {
    const hook = await this.storage.get(id);
    if (!hook) {
      throw new Error(`Hook not found: ${id}`);
    }

    hook.enabled = false;
    hook.updatedAt = new Date();
    await this.storage.set(id, hook);
  }

  /**
   * Removes a hook entry from the registry.
   *
   * Permanently deletes the hook. Use disable() if you want to
   * temporarily deactivate a hook without removing it.
   *
   * @param id - The unique identifier of the hook to remove
   * @returns True if the hook was removed, false if it didn't exist
   *
   * @example
   * ```typescript
   * const removed = await registry.remove('hook-pre-commit-001');
   * if (removed) {
   *   console.log('Hook removed');
   * } else {
   *   console.log('Hook not found');
   * }
   * ```
   */
  async remove(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * Updates an existing hook entry with partial changes.
   *
   * Merges the provided updates with the existing hook entry.
   * The updatedAt timestamp is automatically set to the current time.
   *
   * @param id - The unique identifier of the hook to update
   * @param updates - Partial hook entry with fields to update
   * @returns The updated hook entry
   * @throws {Error} If the hook does not exist
   *
   * @example
   * ```typescript
   * const updated = await registry.update('hook-pre-commit-001', {
   *   name: 'Updated Hook Name',
   *   priority: 5,
   * });
   * console.log(`Updated: ${updated.name}`);
   * ```
   */
  async update(
    id: string,
    updates: Partial<HookRegistryEntry>,
  ): Promise<HookRegistryEntry> {
    const existingHook = await this.storage.get(id);
    if (!existingHook) {
      throw new Error(`Hook not found: ${id}`);
    }

    const updatedHook: HookRegistryEntry = {
      ...existingHook,
      ...updates,
      id: existingHook.id, // Prevent ID from being changed
      createdAt: existingHook.createdAt, // Preserve original creation time
      updatedAt: new Date(),
    };

    await this.storage.set(id, updatedHook);
    return updatedHook;
  }

  /**
   * Removes all hook entries from the registry.
   *
   * This is a destructive operation that cannot be undone.
   * Use with caution in production environments.
   *
   * @returns Promise that resolves when all hooks are cleared
   *
   * @example
   * ```typescript
   * await registry.clear();
   * console.log('All hooks removed');
   * ```
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Sorts hook entries by priority (ascending).
   *
   * @param hooks - Array of hook entries to sort
   * @returns Sorted array with lowest priority values first
   */
  private sortByPriority(hooks: HookRegistryEntry[]): HookRegistryEntry[] {
    return [...hooks].sort((a, b) => a.priority - b.priority);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Default configuration for the HooksRegistry.
 */
const DEFAULT_HOOKS_REGISTRY_CONFIG: HooksRegistryConfig = {
  storage: {
    type: 'memory',
    namespace: 'hooks',
  },
};

/**
 * Creates a new HooksRegistry instance with optional configuration.
 *
 * Factory function that provides a convenient way to create HooksRegistry
 * instances with sensible defaults.
 *
 * @param config - Optional configuration overrides
 * @returns A new HooksRegistry instance
 *
 * @example
 * ```typescript
 * // Create with default memory storage
 * const registry = createHooksRegistry();
 *
 * // Create with file storage
 * const persistentRegistry = createHooksRegistry({
 *   storage: {
 *     type: 'file',
 *     basePath: './.wundr/registry',
 *     namespace: 'hooks',
 *   },
 * });
 * ```
 */
export function createHooksRegistry(
  config?: Partial<HooksRegistryConfig>,
): HooksRegistry {
  const mergedConfig: HooksRegistryConfig = {
    storage: {
      ...DEFAULT_HOOKS_REGISTRY_CONFIG.storage,
      ...config?.storage,
    },
  };

  return new HooksRegistry(mergedConfig);
}
