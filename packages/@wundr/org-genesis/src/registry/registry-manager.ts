/**
 * @fileoverview Registry Manager - Unified orchestrator for all registry components
 *
 * This module provides a centralized management interface for all registry types
 * in the org-genesis system. It coordinates CharterRegistry, DisciplineRegistry,
 * AgentRegistry, ToolsRegistry, and HooksRegistry, providing unified query,
 * export/import, and statistics functionality.
 *
 * Key Features:
 * - Unified access to all registry types through a single interface
 * - Cross-registry query capabilities with filtering and pagination
 * - Full export/import for backup, migration, and testing
 * - Aggregate statistics across all registry types
 * - Consistent configuration and storage management
 *
 * @module @wundr/org-genesis/registry/registry-manager
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * import { createRegistryManager, RegistryManager } from '@wundr/org-genesis';
 *
 * // Create with file-based storage
 * const manager = createRegistryManager({
 *   storageType: 'file',
 *   basePath: './.wundr/registry',
 * });
 *
 * // Initialize all registries
 * await manager.initialize();
 *
 * // Access individual registries
 * await manager.charters.registerVP(vpCharter);
 * await manager.disciplines.register(disciplinePack);
 * await manager.agents.register(agentDefinition);
 *
 * // Query across registries
 * const results = await manager.query({ type: 'agent', tags: ['engineering'] });
 *
 * // Export all data
 * const backup = await manager.exportAll();
 *
 * // Get aggregate statistics
 * const stats = await manager.getStats();
 * console.log(`Total VPs: ${stats.vpCount}, Agents: ${stats.agentCount}`);
 * ```
 */

import { AgentRegistry, createAgentRegistry } from './agent-registry.js';
import { CharterRegistry, createCharterRegistry } from './charter-registry.js';
import { DisciplineRegistry, createDisciplineRegistry } from './discipline-registry.js';
import {
  HooksRegistry,
  createHooksRegistry,
  type HookRegistryEntry,
} from './hooks-registry.js';
import {
  ToolsRegistry,
  createToolsRegistry,
  type ToolRegistryEntry,
} from './tools-registry.js';

import type {
  VPCharter,
  SessionManagerCharter,
  DisciplinePack,
  AgentDefinition,
  RegistryQuery,
  RegistryQueryResult,
  RegistryEntry,
  RegistryEntryType,
} from '../types/index.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the RegistryManager.
 *
 * @description
 * Specifies how all underlying registries should be configured, including
 * storage backend and base path for file storage.
 *
 * @example
 * ```typescript
 * // File-based storage for production
 * const prodConfig: RegistryManagerConfig = {
 *   storageType: 'file',
 *   basePath: './.wundr/registry',
 * };
 *
 * // In-memory storage for testing
 * const testConfig: RegistryManagerConfig = {
 *   storageType: 'memory',
 * };
 * ```
 */
export interface RegistryManagerConfig {
  /**
   * Type of storage backend to use for all registries.
   *
   * - `file`: Persist data to filesystem as JSON files. Data survives
   *   process restarts. Suitable for production and development.
   * - `memory`: Store data in-memory only. Data is lost on process exit.
   *   Suitable for testing and temporary operations.
   *
   * @default 'memory'
   */
  storageType: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   *
   * Only applicable when `storageType` is `'file'`. Each registry will
   * create its own subdirectory under this path.
   *
   * @default './.wundr/registry'
   *
   * @example
   * ```typescript
   * // Relative path
   * basePath: './.wundr/registry'
   *
   * // Absolute path
   * basePath: '/var/lib/wundr/registry'
   * ```
   */
  basePath?: string;
}

/**
 * Default configuration values for the RegistryManager.
 *
 * @internal
 */
const DEFAULT_CONFIG: Required<RegistryManagerConfig> = {
  storageType: 'memory',
  basePath: './.wundr/registry',
};

// ============================================================================
// Export/Import Types
// ============================================================================

/**
 * Complete registry export data structure.
 *
 * @description
 * Contains all data from all registries in a format suitable for backup,
 * migration, or testing. Includes version information and export timestamp.
 *
 * @example
 * ```typescript
 * const exportData: RegistryExport = {
 *   version: '1.0.0',
 *   exportedAt: '2024-06-20T14:30:00Z',
 *   charters: {
 *     vps: [...vpCharters],
 *     sessionManagers: [...sessionManagerCharters],
 *   },
 *   disciplines: [...disciplinePacks],
 *   agents: [...agentDefinitions],
 *   tools: [...toolEntries],
 *   hooks: [...hookEntries],
 * };
 * ```
 */
export interface RegistryExport {
  /**
   * Schema version of the export format.
   * Used for migration compatibility checks.
   */
  version: string;

  /**
   * ISO 8601 timestamp when the export was created.
   */
  exportedAt: string;

  /**
   * Charter registry data including VPs and Session Managers.
   */
  charters: {
    /**
     * All exported VP charters (Tier 1).
     */
    vps: VPCharter[];

    /**
     * All exported Session Manager charters (Tier 2).
     */
    sessionManagers: SessionManagerCharter[];
  };

  /**
   * All exported discipline packs.
   */
  disciplines: DisciplinePack[];

  /**
   * All exported agent definitions (Tier 3).
   */
  agents: AgentDefinition[];

  /**
   * All exported tool registry entries.
   */
  tools: ToolRegistryEntry[];

  /**
   * All exported hook registry entries.
   */
  hooks: HookRegistryEntry[];
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Aggregate statistics across all registries.
 *
 * @description
 * Provides a summary of entity counts across all registry types.
 * Useful for dashboards, health checks, and capacity planning.
 *
 * @example
 * ```typescript
 * const stats: RegistryStats = {
 *   vpCount: 5,
 *   sessionManagerCount: 15,
 *   disciplineCount: 25,
 *   agentCount: 100,
 *   toolCount: 50,
 *   hookCount: 30,
 * };
 *
 * console.log(`Total entities: ${
 *   stats.vpCount +
 *   stats.sessionManagerCount +
 *   stats.disciplineCount +
 *   stats.agentCount
 * }`);
 * ```
 */
export interface RegistryStats {
  /**
   * Total number of registered VP charters (Tier 1).
   */
  vpCount: number;

  /**
   * Total number of registered Session Manager charters (Tier 2).
   */
  sessionManagerCount: number;

  /**
   * Total number of registered discipline packs.
   */
  disciplineCount: number;

  /**
   * Total number of registered agent definitions (Tier 3).
   */
  agentCount: number;

  /**
   * Total number of registered tools.
   */
  toolCount: number;

  /**
   * Total number of registered hooks.
   */
  hookCount: number;
}

// ============================================================================
// Registry Manager Class
// ============================================================================

/**
 * RegistryManager - Unified orchestrator for all registry components.
 *
 * @description
 * The RegistryManager provides a centralized interface for managing all
 * registry types in the org-genesis system. It coordinates access to
 * CharterRegistry, DisciplineRegistry, AgentRegistry, ToolsRegistry,
 * and HooksRegistry while providing cross-registry operations.
 *
 * Key Capabilities:
 * - **Unified Access**: Single entry point to all registry types
 * - **Cross-Registry Queries**: Search and filter across multiple registries
 * - **Export/Import**: Full data backup and restoration
 * - **Statistics**: Aggregate counts and metrics across all registries
 * - **Consistent Configuration**: Shared storage configuration
 *
 * @example
 * ```typescript
 * // Create and initialize the registry manager
 * const manager = new RegistryManager({
 *   storageType: 'file',
 *   basePath: './.wundr/registry',
 * });
 * await manager.initialize();
 *
 * // Access individual registries
 * await manager.charters.registerVP(vpCharter);
 * await manager.disciplines.register(disciplinePack);
 *
 * // Cross-registry operations
 * const stats = await manager.getStats();
 * const backup = await manager.exportAll();
 * ```
 */
export class RegistryManager {
  /**
   * Charter registry managing VP and Session Manager charters.
   * Provides CRUD operations for Tier 1 (VP) and Tier 2 (Session Manager) entities.
   */
  public readonly charters: CharterRegistry;

  /**
   * Discipline registry managing discipline packs.
   * Provides CRUD operations for discipline configurations.
   */
  public readonly disciplines: DisciplineRegistry;

  /**
   * Agent registry managing agent definitions.
   * Provides CRUD operations for Tier 3 (Sub-Agent) entities.
   */
  public readonly agents: AgentRegistry;

  /**
   * Tools registry managing tool definitions.
   * Provides CRUD operations for MCP tools, built-in tools, and custom tools.
   */
  public readonly tools: ToolsRegistry;

  /**
   * Hooks registry managing lifecycle hooks.
   * Provides CRUD operations for event handlers and automated actions.
   */
  public readonly hooks: HooksRegistry;

  /**
   * Configuration for this registry manager instance.
   * @internal
   */
  private readonly config: Required<RegistryManagerConfig>;

  /**
   * Whether the manager has been initialized.
   * @internal
   */
  private initialized = false;

  /**
   * Create a new RegistryManager instance.
   *
   * @description
   * Initializes all underlying registries with the specified configuration.
   * Call `initialize()` after construction to ensure all storage backends
   * are ready for operations.
   *
   * @param config - Configuration options for the registry manager
   *
   * @example
   * ```typescript
   * // Create with file storage
   * const manager = new RegistryManager({
   *   storageType: 'file',
   *   basePath: './.wundr/registry',
   * });
   *
   * // Create with memory storage (for testing)
   * const testManager = new RegistryManager({
   *   storageType: 'memory',
   * });
   * ```
   */
  constructor(config: RegistryManagerConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize all registries with consistent configuration
    this.charters = createCharterRegistry({
      storageType: this.config.storageType,
      basePath: `${this.config.basePath}/charters`,
    });

    this.disciplines = createDisciplineRegistry({
      storageType: this.config.storageType,
      basePath: `${this.config.basePath}/disciplines`,
    });

    this.agents = createAgentRegistry({
      storageType: this.config.storageType,
      basePath: `${this.config.basePath}/agents`,
    });

    this.tools = createToolsRegistry({
      storageType: this.config.storageType,
      basePath: `${this.config.basePath}/tools`,
    });

    this.hooks = createHooksRegistry({
      storage: {
        type: this.config.storageType,
        basePath: this.config.basePath,
        namespace: 'hooks',
      },
    });
  }

  /**
   * Initialize all registry storage backends.
   *
   * @description
   * Ensures all underlying storage systems are ready for operations.
   * For file-based storage, this creates necessary directories and
   * loads any existing data into caches.
   *
   * This method is idempotent - calling it multiple times has no effect
   * after the first successful initialization.
   *
   * @returns Promise that resolves when all registries are initialized
   *
   * @example
   * ```typescript
   * const manager = new RegistryManager(config);
   *
   * // Must initialize before using registries
   * await manager.initialize();
   *
   * // Now safe to use registries
   * await manager.charters.registerVP(vpCharter);
   * ```
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize all registries in parallel for efficiency
    // Note: The individual registries handle their own initialization
    // lazily, but we can warm them up here
    await Promise.all([
      this.charters.listVPs(),
      this.disciplines.list(),
      this.agents.list(),
      this.tools.list(),
      this.hooks.list(),
    ]);

    this.initialized = true;
  }

  /**
   * Query across all registries with unified filtering.
   *
   * @description
   * Performs a search across all or specific registry types with support
   * for filtering by type, tags, search text, and pagination.
   *
   * @param query - Query options for filtering and pagination
   * @returns Paginated query results
   *
   * @example
   * ```typescript
   * // Query all agents
   * const agents = await manager.query({ type: 'agent' });
   *
   * // Query by tags
   * const engineeringItems = await manager.query({
   *   tags: ['engineering'],
   *   limit: 20,
   * });
   *
   * // Search across all types
   * const results = await manager.query({
   *   search: 'reviewer',
   *   sortBy: 'name',
   *   sortOrder: 'asc',
   * });
   * ```
   */
  async query(query: RegistryQuery): Promise<RegistryQueryResult<RegistryEntry>> {
    const items: RegistryEntry[] = [];
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Collect items based on type filter
    const types = query.type
      ? [query.type]
      : (['vp', 'session-manager', 'discipline', 'agent', 'tool', 'hook'] as RegistryEntryType[]);

    for (const type of types) {
      const typeItems = await this.getItemsByType(type);
      items.push(...typeItems);
    }

    // Apply filters
    let filtered = items;

    // Filter by IDs
    if (query.ids && query.ids.length > 0) {
      const idSet = new Set(query.ids);
      filtered = filtered.filter((item) => idSet.has(item.id));
    }

    // Filter by slugs
    if (query.slugs && query.slugs.length > 0) {
      const slugSet = new Set(query.slugs);
      filtered = filtered.filter((item) => slugSet.has(item.slug));
    }

    // Filter by tags (metadata)
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter((item) => {
        const itemTags = (item.metadata?.tags as string[]) ?? [];
        return query.tags!.every((tag) => itemTags.includes(tag));
      });
    }

    // Filter by search text
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          (item.metadata?.description as string)?.toLowerCase().includes(searchLower),
      );
    }

    // Sort results
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'createdAt') {
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortBy === 'updatedAt') {
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      items: paginated,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  /**
   * Export all registry data for backup or migration.
   *
   * @description
   * Creates a complete snapshot of all registry data in a format suitable
   * for backup, migration, or testing. The export includes version
   * information for compatibility checking during import.
   *
   * @returns Promise resolving to the complete registry export
   *
   * @example
   * ```typescript
   * // Create a full backup
   * const backup = await manager.exportAll();
   *
   * // Save to file
   * await fs.writeFile(
   *   'registry-backup.json',
   *   JSON.stringify(backup, null, 2)
   * );
   *
   * // Access specific data
   * console.log(`Exported ${backup.charters.vps.length} VPs`);
   * console.log(`Exported ${backup.agents.length} agents`);
   * ```
   */
  async exportAll(): Promise<RegistryExport> {
    // Fetch all data from all registries in parallel
    const [vps, sessionManagers, disciplines, agents, tools, hooks] = await Promise.all([
      this.charters.listVPs(),
      this.charters.listSessionManagers(),
      this.disciplines.list(),
      this.agents.list(),
      this.tools.list(),
      this.hooks.list(),
    ]);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      charters: {
        vps,
        sessionManagers,
      },
      disciplines,
      agents,
      tools,
      hooks,
    };
  }

  /**
   * Import registry data from an export.
   *
   * @description
   * Restores registry data from a previously created export. This operation
   * will add or update entities based on their IDs. Existing entities with
   * matching IDs will be overwritten.
   *
   * @param data - The registry export data to import
   * @returns Promise that resolves when import is complete
   * @throws Error if the export version is incompatible
   *
   * @example
   * ```typescript
   * // Load from file
   * const backup = JSON.parse(
   *   await fs.readFile('registry-backup.json', 'utf-8')
   * );
   *
   * // Import all data
   * await manager.importAll(backup);
   *
   * console.log('Registry restored successfully');
   * ```
   */
  async importAll(data: RegistryExport): Promise<void> {
    // Validate version compatibility
    if (!data.version || !data.version.startsWith('1.')) {
      throw new Error(`Incompatible export version: ${data.version}. Expected 1.x.x`);
    }

    // Import charters
    if (data.charters) {
      if (data.charters.vps) {
        for (const vp of data.charters.vps) {
          await this.charters.registerVP(vp);
        }
      }
      if (data.charters.sessionManagers) {
        for (const sm of data.charters.sessionManagers) {
          await this.charters.registerSessionManager(sm);
        }
      }
    }

    // Import disciplines
    if (data.disciplines) {
      for (const discipline of data.disciplines) {
        await this.disciplines.register(discipline);
      }
    }

    // Import agents
    if (data.agents) {
      for (const agent of data.agents) {
        await this.agents.register(agent);
      }
    }

    // Import tools
    if (data.tools) {
      for (const tool of data.tools) {
        await this.tools.register(tool);
      }
    }

    // Import hooks
    if (data.hooks) {
      for (const hook of data.hooks) {
        await this.hooks.register(hook);
      }
    }
  }

  /**
   * Clear all data from all registries.
   *
   * @description
   * Removes all data from all registry types. This is a destructive
   * operation that cannot be undone. Primarily useful for testing
   * and development environment resets.
   *
   * @returns Promise that resolves when all registries are cleared
   *
   * @example
   * ```typescript
   * // Clear all data (use with caution!)
   * await manager.clearAll();
   *
   * // Verify all registries are empty
   * const stats = await manager.getStats();
   * console.log(stats); // All counts should be 0
   * ```
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.charters.clear(),
      this.disciplines.clear(),
      this.agents.clear(),
      this.tools.clear(),
      this.hooks.clear(),
    ]);
  }

  /**
   * Get aggregate statistics across all registries.
   *
   * @description
   * Returns counts of all entity types across all registries.
   * Useful for dashboards, health checks, and capacity planning.
   *
   * @returns Promise resolving to aggregate statistics
   *
   * @example
   * ```typescript
   * const stats = await manager.getStats();
   *
   * console.log('Registry Statistics:');
   * console.log(`- VPs: ${stats.vpCount}`);
   * console.log(`- Session Managers: ${stats.sessionManagerCount}`);
   * console.log(`- Disciplines: ${stats.disciplineCount}`);
   * console.log(`- Agents: ${stats.agentCount}`);
   * console.log(`- Tools: ${stats.toolCount}`);
   * console.log(`- Hooks: ${stats.hookCount}`);
   *
   * const total = stats.vpCount + stats.sessionManagerCount +
   *   stats.disciplineCount + stats.agentCount +
   *   stats.toolCount + stats.hookCount;
   * console.log(`Total: ${total} entities`);
   * ```
   */
  async getStats(): Promise<RegistryStats> {
    const [charterStats, disciplines, agents, tools, hooks] = await Promise.all([
      this.charters.getStats(),
      this.disciplines.list(),
      this.agents.list(),
      this.tools.list(),
      this.hooks.list(),
    ]);

    return {
      vpCount: charterStats.vpCount,
      sessionManagerCount: charterStats.sessionManagerCount,
      disciplineCount: disciplines.length,
      agentCount: agents.length,
      toolCount: tools.length,
      hookCount: hooks.length,
    };
  }

  /**
   * Get registry items by type and convert to RegistryEntry format.
   *
   * @param type - The registry entry type to fetch
   * @returns Array of registry entries
   * @internal
   */
  private async getItemsByType(type: RegistryEntryType): Promise<RegistryEntry[]> {
    switch (type) {
      case 'vp': {
        const vps = await this.charters.listVPs();
        return vps.map((vp) => this.vpToRegistryEntry(vp));
      }
      case 'session-manager': {
        const sms = await this.charters.listSessionManagers();
        return sms.map((sm) => this.sessionManagerToRegistryEntry(sm));
      }
      case 'discipline': {
        const disciplines = await this.disciplines.list();
        return disciplines.map((d) => this.disciplineToRegistryEntry(d));
      }
      case 'agent': {
        const agents = await this.agents.list();
        return agents.map((a) => this.agentToRegistryEntry(a));
      }
      case 'tool': {
        const tools = await this.tools.list();
        return tools.map((t) => this.toolToRegistryEntry(t));
      }
      case 'hook': {
        const hooks = await this.hooks.list();
        return hooks.map((h) => this.hookToRegistryEntry(h));
      }
      case 'organization':
      default:
        return [];
    }
  }

  /**
   * Convert a VP charter to a registry entry.
   * @internal
   */
  private vpToRegistryEntry(vp: VPCharter): RegistryEntry {
    return {
      id: vp.id,
      type: 'vp',
      name: vp.identity.name,
      slug: vp.identity.slug,
      createdAt: vp.createdAt,
      updatedAt: vp.updatedAt,
      metadata: {
        tier: vp.tier,
        description: vp.coreDirective,
        tags: vp.disciplineIds ?? [],
      },
    };
  }

  /**
   * Convert a Session Manager charter to a registry entry.
   * @internal
   */
  private sessionManagerToRegistryEntry(sm: SessionManagerCharter): RegistryEntry {
    return {
      id: sm.id,
      type: 'session-manager',
      name: sm.identity.name,
      slug: sm.identity.slug,
      createdAt: sm.createdAt,
      updatedAt: sm.updatedAt,
      metadata: {
        tier: sm.tier,
        description: sm.coreDirective,
        parentVpId: sm.parentVpId,
        disciplineId: sm.disciplineId,
        tags: sm.agentIds ?? [],
      },
    };
  }

  /**
   * Convert a discipline pack to a registry entry.
   * @internal
   */
  private disciplineToRegistryEntry(discipline: DisciplinePack): RegistryEntry {
    return {
      id: discipline.id,
      type: 'discipline',
      name: discipline.name,
      slug: discipline.slug,
      createdAt: discipline.createdAt,
      updatedAt: discipline.updatedAt,
      metadata: {
        category: discipline.category,
        description: discipline.description,
        parentVpId: discipline.parentVpId,
        tags: discipline.agentIds ?? [],
      },
    };
  }

  /**
   * Convert an agent definition to a registry entry.
   * @internal
   */
  private agentToRegistryEntry(agent: AgentDefinition): RegistryEntry {
    return {
      id: agent.id,
      type: 'agent',
      name: agent.name,
      slug: agent.slug,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      metadata: {
        tier: agent.tier,
        scope: agent.scope,
        description: agent.description,
        model: agent.model,
        tags: agent.tags ?? [],
      },
    };
  }

  /**
   * Convert a tool registry entry to a registry entry.
   * @internal
   */
  private toolToRegistryEntry(tool: ToolRegistryEntry): RegistryEntry {
    return {
      id: tool.id,
      type: 'tool',
      name: tool.name,
      slug: tool.name.toLowerCase().replace(/\s+/g, '-'),
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
      metadata: {
        description: tool.description,
        config: tool.config,
        disciplineIds: tool.disciplineIds,
        tags: tool.tags ?? [],
      },
    };
  }

  /**
   * Convert a hook registry entry to a registry entry.
   * @internal
   */
  private hookToRegistryEntry(hook: HookRegistryEntry): RegistryEntry {
    return {
      id: hook.id,
      type: 'hook',
      name: hook.name,
      slug: hook.name.toLowerCase().replace(/\s+/g, '-'),
      createdAt: hook.createdAt,
      updatedAt: hook.updatedAt,
      metadata: {
        event: hook.config.event,
        command: hook.config.command,
        description: hook.description,
        blocking: hook.config.blocking,
        disciplineIds: hook.disciplineIds,
        priority: hook.priority,
        enabled: hook.enabled,
        tags: [],
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RegistryManager instance with the specified configuration.
 *
 * @description
 * Factory function for creating configured RegistryManager instances.
 * This is the recommended way to create registry managers, providing
 * sensible defaults when configuration is not specified.
 *
 * @param config - Optional configuration options
 * @returns A new RegistryManager instance
 *
 * @example
 * ```typescript
 * // Create with defaults (memory storage)
 * const memoryManager = createRegistryManager();
 *
 * // Create with file storage
 * const fileManager = createRegistryManager({
 *   storageType: 'file',
 *   basePath: './.wundr/registry',
 * });
 *
 * // Initialize and use
 * await fileManager.initialize();
 * await fileManager.charters.registerVP(vpCharter);
 * ```
 */
export function createRegistryManager(
  config?: Partial<RegistryManagerConfig>,
): RegistryManager {
  const mergedConfig: RegistryManagerConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return new RegistryManager(mergedConfig);
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export {
  CharterRegistry,
  DisciplineRegistry,
  AgentRegistry,
  ToolsRegistry,
  HooksRegistry,
};

export type { ToolRegistryEntry, HookRegistryEntry };
