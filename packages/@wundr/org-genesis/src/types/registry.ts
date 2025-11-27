/**
 * Registry Types
 *
 * Defines the Global Agent Registry interfaces for the org-genesis package.
 * The registry provides a centralized catalog of all organizational entities
 * including organizations, VPs, disciplines, agents, tools, and hooks.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/types/registry
 */

/**
 * Registry entry types representing all supported entity categories.
 *
 * - `organization`: Top-level organizational unit
 * - `vp`: Orchestrator domain (e.g., Orchestrator of Engineering, Orchestrator of Product)
 * - `discipline`: Specialized discipline within a Orchestrator domain
 * - `session-manager`: Session management entity for agent coordination
 * - `agent`: Individual AI agent instance
 * - `tool`: MCP tool or capability
 * - `hook`: Lifecycle hook for event handling
 */
export type RegistryEntryType =
  | 'organization'
  | 'vp'
  | 'discipline'
  | 'session-manager'
  | 'agent'
  | 'tool'
  | 'hook';

/**
 * Base registry entry interface.
 *
 * All entities in the registry inherit from this base interface,
 * providing consistent identification and metadata across all types.
 *
 * @example
 * ```typescript
 * const entry: RegistryEntry = {
 *   id: 'agent-001',
 *   type: 'agent',
 *   name: 'Code Reviewer',
 *   slug: 'code-reviewer',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   metadata: { version: '1.0.0' }
 * };
 * ```
 */
export interface RegistryEntry {
  /**
   * Unique identifier for the registry entry.
   * Typically a UUID or deterministic hash.
   */
  id: string;

  /**
   * The type category of this registry entry.
   */
  type: RegistryEntryType;

  /**
   * Human-readable display name for the entry.
   */
  name: string;

  /**
   * URL-safe slug identifier.
   * Used for routing and path-based lookups.
   */
  slug: string;

  /**
   * Timestamp when the entry was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the entry was last updated.
   */
  updatedAt: Date;

  /**
   * Optional arbitrary metadata associated with the entry.
   * Can store version info, tags, configuration, etc.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Query options for registry lookups.
 *
 * Provides flexible filtering, pagination, and sorting capabilities
 * for searching the registry.
 *
 * @example
 * ```typescript
 * const query: RegistryQuery = {
 *   type: 'agent',
 *   tags: ['engineering', 'code-review'],
 *   search: 'reviewer',
 *   limit: 10,
 *   offset: 0,
 *   sortBy: 'name',
 *   sortOrder: 'asc'
 * };
 * ```
 */
export interface RegistryQuery {
  /**
   * Filter by entry type.
   * When undefined, returns all types.
   */
  type?: RegistryEntryType;

  /**
   * Filter by specific entry IDs.
   * Returns entries matching any of the provided IDs.
   */
  ids?: string[];

  /**
   * Filter by specific slugs.
   * Returns entries matching any of the provided slugs.
   */
  slugs?: string[];

  /**
   * Filter by parent entity ID.
   * Used for hierarchical queries (e.g., agents under a discipline).
   */
  parentId?: string;

  /**
   * Filter by tags in metadata.
   * Returns entries containing all specified tags.
   */
  tags?: string[];

  /**
   * Full-text search across name and metadata.
   * Case-insensitive partial matching.
   */
  search?: string;

  /**
   * Maximum number of results to return.
   * @default 50
   */
  limit?: number;

  /**
   * Number of results to skip for pagination.
   * @default 0
   */
  offset?: number;

  /**
   * Field to sort results by.
   * @default 'name'
   */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';

  /**
   * Sort order direction.
   * @default 'asc'
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated registry query result.
 *
 * Wraps query results with pagination metadata for efficient
 * traversal of large result sets.
 *
 * @typeParam T - The type of items in the result set
 *
 * @example
 * ```typescript
 * const result: RegistryQueryResult<RegistryEntry> = {
 *   items: [entry1, entry2],
 *   total: 100,
 *   limit: 10,
 *   offset: 0,
 *   hasMore: true
 * };
 *
 * // Check for next page
 * if (result.hasMore) {
 *   const nextQuery = { ...query, offset: result.offset + result.limit };
 * }
 * ```
 */
export interface RegistryQueryResult<T> {
  /**
   * Array of matching items for the current page.
   */
  items: T[];

  /**
   * Total count of all matching items across all pages.
   */
  total: number;

  /**
   * Maximum items per page (from query limit).
   */
  limit: number;

  /**
   * Current offset position in the result set.
   */
  offset: number;

  /**
   * Whether more results exist beyond the current page.
   */
  hasMore: boolean;
}

/**
 * Registry statistics providing an overview of registered entities.
 *
 * Useful for dashboards, health checks, and capacity planning.
 *
 * @example
 * ```typescript
 * const stats: RegistryStats = {
 *   organizationCount: 3,
 *   orchestratorCount: 12,
 *   disciplineCount: 48,
 *   agentCount: 156,
 *   toolCount: 89,
 *   hookCount: 34,
 *   lastUpdated: new Date()
 * };
 * ```
 */
export interface RegistryStats {
  /**
   * Total number of registered organizations.
   */
  organizationCount: number;

  /**
   * Total number of registered Orchestrator domains.
   */
  orchestratorCount: number;

  /**
   * Total number of registered disciplines.
   */
  disciplineCount: number;

  /**
   * Total number of registered agents.
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

  /**
   * Timestamp of the last registry modification.
   */
  lastUpdated: Date;
}

/**
 * Registry event for change notifications.
 *
 * Emitted when registry entries are created, updated, or deleted.
 * Enables reactive patterns and cache invalidation.
 *
 * @example
 * ```typescript
 * const event: RegistryEvent = {
 *   type: 'created',
 *   entryType: 'agent',
 *   entryId: 'agent-001',
 *   timestamp: new Date(),
 *   changedBy: 'system'
 * };
 * ```
 */
export interface RegistryEvent {
  /**
   * The type of change that occurred.
   * - `created`: New entry added
   * - `updated`: Existing entry modified
   * - `deleted`: Entry removed
   */
  type: 'created' | 'updated' | 'deleted';

  /**
   * The category type of the affected entry.
   */
  entryType: RegistryEntryType;

  /**
   * The unique identifier of the affected entry.
   */
  entryId: string;

  /**
   * Timestamp when the change occurred.
   */
  timestamp: Date;

  /**
   * Optional identifier of the actor who made the change.
   * Could be a user ID, agent ID, or 'system'.
   */
  changedBy?: string;
}

/**
 * Registry event handler function type.
 *
 * Callback signature for subscribing to registry change events.
 * Supports both synchronous and asynchronous handlers.
 *
 * @param event - The registry event being handled
 * @returns void or Promise<void> for async handlers
 *
 * @example
 * ```typescript
 * const handler: RegistryEventHandler = async (event) => {
 *   console.log(`Entry ${event.entryId} was ${event.type}`);
 *   await notifySubscribers(event);
 * };
 * ```
 */
export type RegistryEventHandler = (event: RegistryEvent) => void | Promise<void>;

/**
 * Registry storage configuration options.
 *
 * Configures how the registry persists and manages its data store.
 *
 * @example
 * ```typescript
 * // File-based storage with auto-save
 * const fileConfig: RegistryStorageConfig = {
 *   type: 'file',
 *   basePath: './.wundr/registry',
 *   autoSave: true,
 *   autoSaveIntervalMs: 5000
 * };
 *
 * // In-memory storage for testing
 * const memoryConfig: RegistryStorageConfig = {
 *   type: 'memory'
 * };
 * ```
 */
export interface RegistryStorageConfig {
  /**
   * Storage backend type.
   * - `file`: Persist to filesystem (JSON files)
   * - `memory`: In-memory only (lost on restart)
   */
  type: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   * Only applicable when type is 'file'.
   * @default './.wundr/registry'
   */
  basePath?: string;

  /**
   * Whether to automatically save changes to disk.
   * Only applicable when type is 'file'.
   * @default true
   */
  autoSave?: boolean;

  /**
   * Interval in milliseconds between auto-save operations.
   * Only applicable when autoSave is true.
   * @default 5000
   */
  autoSaveIntervalMs?: number;
}

/**
 * Registry index for fast lookups by different keys.
 *
 * Internal data structure for optimizing registry queries.
 */
export interface RegistryIndex {
  /**
   * Map of entry IDs to entries for O(1) ID lookups.
   */
  byId: Map<string, RegistryEntry>;

  /**
   * Map of slugs to entry IDs for O(1) slug lookups.
   */
  bySlug: Map<string, string>;

  /**
   * Map of entry types to sets of entry IDs for type filtering.
   */
  byType: Map<RegistryEntryType, Set<string>>;

  /**
   * Map of parent IDs to sets of child entry IDs for hierarchy traversal.
   */
  byParent: Map<string, Set<string>>;
}

/**
 * Registry subscription handle for event listeners.
 *
 * Returned when subscribing to registry events, allows unsubscription.
 */
export interface RegistrySubscription {
  /**
   * Unique identifier for this subscription.
   */
  id: string;

  /**
   * Unsubscribe from registry events.
   */
  unsubscribe: () => void;
}

/**
 * Registry bulk operation result.
 *
 * Returned from bulk create/update/delete operations.
 */
export interface RegistryBulkResult {
  /**
   * Number of entries successfully processed.
   */
  successCount: number;

  /**
   * Number of entries that failed to process.
   */
  failureCount: number;

  /**
   * Array of error details for failed entries.
   */
  errors: Array<{
    /**
     * Entry ID that failed.
     */
    entryId: string;

    /**
     * Error message describing the failure.
     */
    message: string;
  }>;
}

/**
 * Registry health status.
 *
 * Provides diagnostic information about registry state.
 */
export interface RegistryHealthStatus {
  /**
   * Whether the registry is operational.
   */
  healthy: boolean;

  /**
   * Storage backend status.
   */
  storage: {
    /**
     * Whether storage is connected and accessible.
     */
    connected: boolean;

    /**
     * Storage type in use.
     */
    type: RegistryStorageConfig['type'];

    /**
     * Last successful save timestamp (for file storage).
     */
    lastSave?: Date;
  };

  /**
   * Index status.
   */
  index: {
    /**
     * Whether indexes are built and valid.
     */
    valid: boolean;

    /**
     * Total indexed entries.
     */
    entryCount: number;
  };

  /**
   * Timestamp of this health check.
   */
  checkedAt: Date;
}
