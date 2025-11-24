/**
 * @fileoverview Tools Registry - Manages MCP tool configurations
 *
 * This module provides a centralized registry for managing MCP (Model Context Protocol)
 * tool configurations in the Wundr organizational hierarchy. It supports both file-based
 * and in-memory storage backends for flexible deployment scenarios.
 *
 * Key Features:
 * - Register, retrieve, list, and remove tool configurations
 * - Query tools by discipline association
 * - Query tools by tag for flexible categorization
 * - Full-text search across tool metadata
 * - Pluggable storage backends (file or memory)
 * - Full TypeScript type safety
 *
 * @module @wundr/org-genesis/registry/tools-registry
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Create a file-based registry
 * const registry = createToolsRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/tools',
 * });
 *
 * // Register a tool
 * await registry.register({
 *   id: 'tool-github-001',
 *   name: 'GitHub Integration',
 *   description: 'Repository management and code review tools',
 *   config: {
 *     name: 'github',
 *     command: 'npx',
 *     args: ['@modelcontextprotocol/server-github'],
 *     env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
 *     description: 'GitHub MCP server',
 *   },
 *   disciplineIds: ['software-engineering', 'devops'],
 *   tags: ['vcs', 'code-review', 'ci-cd'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Search for tools
 * const vcsTools = await registry.listByTag('vcs');
 * ```
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';

import type { MCPServerConfig } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool registry entry representing a registered MCP tool configuration.
 *
 * Each entry contains the full MCP server configuration along with metadata
 * for organization, discovery, and relationship tracking.
 *
 * @example
 * ```typescript
 * const entry: ToolRegistryEntry = {
 *   id: 'tool-github-001',
 *   name: 'GitHub Integration',
 *   description: 'Repository management and code review tools',
 *   config: {
 *     name: 'github',
 *     command: 'npx',
 *     args: ['@modelcontextprotocol/server-github'],
 *     env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
 *     description: 'GitHub MCP server',
 *   },
 *   disciplineIds: ['software-engineering', 'devops'],
 *   tags: ['vcs', 'code-review', 'ci-cd'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export interface ToolRegistryEntry {
  /**
   * Unique identifier for the tool entry.
   * Format: `tool-{name}-{sequence}` or UUID.
   *
   * @example 'tool-github-001', 'tool-database-042'
   */
  id: string;

  /**
   * Human-readable name of the tool.
   *
   * @example 'GitHub Integration', 'Database Query Tools'
   */
  name: string;

  /**
   * Detailed description of the tool's purpose and capabilities.
   * Used for documentation and search indexing.
   */
  description: string;

  /**
   * The MCP server configuration for this tool.
   * Contains command, arguments, environment variables, and server metadata.
   */
  config: MCPServerConfig;

  /**
   * IDs of disciplines that use this tool.
   * Enables querying tools by discipline association.
   */
  disciplineIds: string[];

  /**
   * Tags for flexible categorization and discovery.
   * Examples: 'vcs', 'database', 'testing', 'deployment'
   */
  tags: string[];

  /**
   * Timestamp when the tool entry was created.
   */
  createdAt: Date;

  /**
   * Timestamp when the tool entry was last updated.
   */
  updatedAt: Date;
}

/**
 * Configuration options for the ToolsRegistry.
 *
 * Specifies the storage backend and optional configuration parameters.
 *
 * @example
 * ```typescript
 * // File-based storage
 * const fileConfig: ToolsRegistryConfig = {
 *   storageType: 'file',
 *   basePath: './.wundr/tools',
 * };
 *
 * // In-memory storage
 * const memoryConfig: ToolsRegistryConfig = {
 *   storageType: 'memory',
 * };
 * ```
 */
export interface ToolsRegistryConfig {
  /**
   * Type of storage backend to use.
   * - `file`: Persist tools as JSON files
   * - `memory`: Store tools in memory (ephemeral)
   */
  storageType: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   * Only applicable when storageType is 'file'.
   *
   * @default './.wundr/registry/tools'
   */
  basePath?: string;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Generic storage interface for tool registry entities.
 *
 * Provides a consistent API for storing and retrieving entities regardless
 * of the underlying storage mechanism. Implementations must support basic
 * CRUD operations with async/await pattern.
 *
 * @typeParam T - The type of entity being stored (must have an 'id' property)
 */
interface IToolStorage<T extends { id: string }> {
  /**
   * Store an entity by its ID.
   *
   * @param id - Unique identifier for the entity
   * @param entity - The entity to store
   * @returns Promise that resolves when storage is complete
   */
  set(id: string, entity: T): Promise<void>;

  /**
   * Retrieve an entity by its ID.
   *
   * @param id - Unique identifier of the entity to retrieve
   * @returns Promise resolving to the entity or null if not found
   */
  get(id: string): Promise<T | null>;

  /**
   * Retrieve all stored entities.
   *
   * @returns Promise resolving to an array of all entities
   */
  getAll(): Promise<T[]>;

  /**
   * Delete an entity by its ID.
   *
   * @param id - Unique identifier of the entity to delete
   * @returns Promise resolving to true if entity was deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if an entity exists.
   *
   * @param id - Unique identifier to check
   * @returns Promise resolving to true if entity exists
   */
  has(id: string): Promise<boolean>;

  /**
   * Clear all stored entities.
   *
   * @returns Promise that resolves when all entities are cleared
   */
  clear(): Promise<void>;

  /**
   * Get the count of stored entities.
   *
   * @returns Promise resolving to the number of stored entities
   */
  count(): Promise<number>;
}

// ============================================================================
// Memory Storage Implementation
// ============================================================================

/**
 * In-memory storage implementation for tool registry entries.
 *
 * Provides a fast, ephemeral storage backend suitable for testing,
 * development, and short-lived processes. Data is lost when the
 * process terminates.
 *
 * @typeParam T - The type of entity being stored
 *
 * @remarks
 * This implementation uses a Map for O(1) access patterns.
 * Not suitable for production scenarios requiring persistence.
 */
class ToolMemoryStorage<T extends { id: string }> implements IToolStorage<T> {
  /** Internal map storing entities by ID */
  private readonly store: Map<string, T> = new Map();

  /**
   * Store an entity in memory.
   *
   * @param id - Unique identifier for the entity
   * @param entity - The entity to store
   */
  async set(id: string, entity: T): Promise<void> {
    this.store.set(id, entity);
  }

  /**
   * Retrieve an entity from memory.
   *
   * @param id - Unique identifier of the entity to retrieve
   * @returns The entity or null if not found
   */
  async get(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  /**
   * Retrieve all entities from memory.
   *
   * @returns Array of all stored entities
   */
  async getAll(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  /**
   * Delete an entity from memory.
   *
   * @param id - Unique identifier of the entity to delete
   * @returns True if entity was deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * Check if an entity exists in memory.
   *
   * @param id - Unique identifier to check
   * @returns True if entity exists
   */
  async has(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  /**
   * Clear all entities from memory.
   */
  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Get the count of stored entities.
   *
   * @returns The number of stored entities
   */
  async count(): Promise<number> {
    return this.store.size;
  }
}

// ============================================================================
// File Storage Implementation
// ============================================================================

/**
 * File-based storage implementation for tool registry entries.
 *
 * Provides persistent storage by writing entities as individual JSON files.
 * Each entity is stored in its own file named after its ID, allowing for
 * efficient individual entity operations and easy debugging.
 *
 * @typeParam T - The type of entity being stored
 *
 * @remarks
 * File operations are atomic at the individual file level. The implementation
 * creates directories as needed and handles JSON serialization/deserialization
 * with proper Date object reconstruction.
 */
class ToolFileStorage<T extends { id: string }> implements IToolStorage<T> {
  /** Base directory path for storing entity files */
  private readonly basePath: string;

  /** In-memory cache for faster reads */
  private cache: Map<string, T> = new Map();

  /** Whether the cache has been initialized from disk */
  private cacheInitialized = false;

  /**
   * Create a new ToolFileStorage instance.
   *
   * @param basePath - Directory path where entity files will be stored
   */
  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Initialize the cache by loading all entities from disk.
   *
   * @remarks
   * This is called automatically on first access. Subsequent calls are no-ops.
   */
  private async initCache(): Promise<void> {
    if (this.cacheInitialized) {
      return;
    }

    try {
      await fs.mkdir(this.basePath, { recursive: true });
      const files = await fs.readdir(this.basePath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.basePath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entity = this.deserialize(content);
          this.cache.set(entity.id, entity);
        }
      }
    } catch (error) {
      // Directory doesn't exist yet or read error - start with empty cache
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    this.cacheInitialized = true;
  }

  /**
   * Get the file path for an entity.
   *
   * @param id - Entity ID
   * @returns Full file path for the entity
   */
  private getFilePath(id: string): string {
    // Sanitize ID for filesystem safety
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '_');
    return join(this.basePath, `${safeId}.json`);
  }

  /**
   * Serialize an entity to JSON with proper formatting.
   *
   * @param entity - Entity to serialize
   * @returns JSON string representation
   */
  private serialize(entity: T): string {
    return JSON.stringify(entity, null, 2);
  }

  /**
   * Deserialize JSON to an entity with Date reconstruction.
   *
   * @param content - JSON string to deserialize
   * @returns Deserialized entity with proper Date objects
   */
  private deserialize(content: string): T {
    return JSON.parse(content, (_key, value) => {
      // Reconstruct Date objects from ISO strings
      if (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      return value;
    }) as T;
  }

  /**
   * Store an entity to disk and cache.
   *
   * @param id - Unique identifier for the entity
   * @param entity - The entity to store
   */
  async set(id: string, entity: T): Promise<void> {
    await this.initCache();

    const filePath = this.getFilePath(id);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, this.serialize(entity), 'utf-8');

    this.cache.set(id, entity);
  }

  /**
   * Retrieve an entity from cache (or disk on cache miss).
   *
   * @param id - Unique identifier of the entity to retrieve
   * @returns The entity or null if not found
   */
  async get(id: string): Promise<T | null> {
    await this.initCache();
    return this.cache.get(id) ?? null;
  }

  /**
   * Retrieve all entities from cache.
   *
   * @returns Array of all stored entities
   */
  async getAll(): Promise<T[]> {
    await this.initCache();
    return Array.from(this.cache.values());
  }

  /**
   * Delete an entity from disk and cache.
   *
   * @param id - Unique identifier of the entity to delete
   * @returns True if entity was deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    await this.initCache();

    if (!this.cache.has(id)) {
      return false;
    }

    const filePath = this.getFilePath(id);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return this.cache.delete(id);
  }

  /**
   * Check if an entity exists.
   *
   * @param id - Unique identifier to check
   * @returns True if entity exists
   */
  async has(id: string): Promise<boolean> {
    await this.initCache();
    return this.cache.has(id);
  }

  /**
   * Clear all entities from disk and cache.
   */
  async clear(): Promise<void> {
    await this.initCache();

    for (const id of this.cache.keys()) {
      const filePath = this.getFilePath(id);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    this.cache.clear();
  }

  /**
   * Get the count of stored entities.
   *
   * @returns The number of stored entities
   */
  async count(): Promise<number> {
    await this.initCache();
    return this.cache.size;
  }
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration for the ToolsRegistry.
 */
const DEFAULT_CONFIG: ToolsRegistryConfig = {
  storageType: 'memory',
  basePath: './.wundr/registry/tools',
};

// ============================================================================
// ToolsRegistry Class
// ============================================================================

/**
 * ToolsRegistry - Centralized management of MCP tool configurations.
 *
 * The ToolsRegistry provides a unified interface for storing, retrieving,
 * and managing MCP tool configurations. It supports registration, querying
 * by discipline, tag-based filtering, and full-text search.
 *
 * Key Capabilities:
 * - **Tool Management**: Register, retrieve, list, update, and remove tool configurations
 * - **Discipline Queries**: Get tools associated with specific disciplines
 * - **Tag Filtering**: Filter tools by tags for flexible categorization
 * - **Full-Text Search**: Search tools by name and description
 * - **Pluggable Storage**: Switch between file and memory backends
 * - **Type Safety**: Full TypeScript support
 *
 * @example
 * ```typescript
 * // Create with file storage
 * const registry = new ToolsRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/tools',
 * });
 *
 * // Register a tool
 * await registry.register({
 *   id: 'tool-github-001',
 *   name: 'GitHub Integration',
 *   description: 'Repository management and code review tools',
 *   config: {
 *     name: 'github',
 *     command: 'npx',
 *     args: ['@modelcontextprotocol/server-github'],
 *     env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
 *     description: 'GitHub MCP server',
 *   },
 *   disciplineIds: ['software-engineering'],
 *   tags: ['vcs', 'code-review'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Query tools by discipline
 * const engTools = await registry.listByDiscipline('software-engineering');
 *
 * // Search for tools
 * const results = await registry.search('github');
 * ```
 */
export class ToolsRegistry {
  /** Storage backend for tool entries */
  private readonly storage: IToolStorage<ToolRegistryEntry>;

  /** Configuration for this registry instance */
  private readonly config: ToolsRegistryConfig;

  /**
   * Create a new ToolsRegistry instance.
   *
   * @param config - Configuration options for the registry
   *
   * @example
   * ```typescript
   * const registry = new ToolsRegistry({
   *   storageType: 'file',
   *   basePath: './data/tools',
   * });
   * ```
   */
  constructor(config: ToolsRegistryConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.storageType === 'file') {
      const basePath = this.config.basePath ?? DEFAULT_CONFIG.basePath!;
      this.storage = new ToolFileStorage<ToolRegistryEntry>(basePath);
    } else {
      this.storage = new ToolMemoryStorage<ToolRegistryEntry>();
    }
  }

  // ==========================================================================
  // Core CRUD Operations
  // ==========================================================================

  /**
   * Register a new tool entry.
   *
   * Stores the tool entry in the registry. If an entry with the same ID
   * already exists, it will be overwritten.
   *
   * @param entry - The tool entry to register
   * @returns Promise that resolves when registration is complete
   * @throws Error if the entry is invalid (missing required fields)
   *
   * @example
   * ```typescript
   * await registry.register({
   *   id: 'tool-github-001',
   *   name: 'GitHub Integration',
   *   description: 'Repository management tools',
   *   config: {
   *     name: 'github',
   *     command: 'npx',
   *     args: ['@modelcontextprotocol/server-github'],
   *     description: 'GitHub MCP server',
   *   },
   *   disciplineIds: ['software-engineering'],
   *   tags: ['vcs'],
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  async register(entry: ToolRegistryEntry): Promise<void> {
    this.validateEntry(entry);
    await this.storage.set(entry.id, entry);
  }

  /**
   * Retrieve a tool entry by ID.
   *
   * @param id - Unique identifier of the tool entry
   * @returns The tool entry or null if not found
   *
   * @example
   * ```typescript
   * const tool = await registry.get('tool-github-001');
   * if (tool) {
   *   console.log(`Found tool: ${tool.name}`);
   * }
   * ```
   */
  async get(id: string): Promise<ToolRegistryEntry | null> {
    return this.storage.get(id);
  }

  /**
   * List all registered tool entries.
   *
   * @returns Array of all tool entries
   *
   * @example
   * ```typescript
   * const tools = await registry.list();
   * console.log(`Total tools: ${tools.length}`);
   * tools.forEach(tool => console.log(`- ${tool.name}`));
   * ```
   */
  async list(): Promise<ToolRegistryEntry[]> {
    return this.storage.getAll();
  }

  /**
   * Remove a tool entry by ID.
   *
   * @param id - Unique identifier of the tool entry to remove
   * @returns True if the entry was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = await registry.remove('tool-github-001');
   * console.log(removed ? 'Tool removed' : 'Tool not found');
   * ```
   */
  async remove(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * Update an existing tool entry.
   *
   * Merges the provided updates with the existing entry. The `updatedAt`
   * timestamp is automatically set to the current time.
   *
   * @param id - Unique identifier of the tool entry to update
   * @param updates - Partial entry with fields to update
   * @returns The updated tool entry
   * @throws Error if the tool entry is not found
   *
   * @example
   * ```typescript
   * const updated = await registry.update('tool-github-001', {
   *   description: 'Updated description',
   *   tags: ['vcs', 'code-review', 'ci-cd'],
   * });
   * console.log(`Updated: ${updated.name}`);
   * ```
   */
  async update(
    id: string,
    updates: Partial<Omit<ToolRegistryEntry, 'id' | 'createdAt'>>,
  ): Promise<ToolRegistryEntry> {
    const existing = await this.storage.get(id);
    if (!existing) {
      throw new Error(`Tool entry not found: ${id}`);
    }

    const updated: ToolRegistryEntry = {
      ...existing,
      ...updates,
      id: existing.id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date(),
    };

    this.validateEntry(updated);
    await this.storage.set(id, updated);

    return updated;
  }

  /**
   * Clear all tool entries from the registry.
   *
   * Use with caution in production environments.
   *
   * @returns Promise that resolves when all entries are cleared
   *
   * @example
   * ```typescript
   * await registry.clear();
   * console.log('All tools removed');
   * ```
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * List all tools associated with a specific discipline.
   *
   * Filters tools by their `disciplineIds` array to return
   * only those associated with the specified discipline.
   *
   * @param disciplineId - The ID of the discipline
   * @returns Array of tool entries associated with the discipline
   *
   * @example
   * ```typescript
   * const engTools = await registry.listByDiscipline('software-engineering');
   * console.log(`Engineering discipline has ${engTools.length} tools`);
   * engTools.forEach(tool => {
   *   console.log(`- ${tool.name}: ${tool.config.command}`);
   * });
   * ```
   */
  async listByDiscipline(disciplineId: string): Promise<ToolRegistryEntry[]> {
    const allTools = await this.storage.getAll();
    return allTools.filter((tool) => tool.disciplineIds.includes(disciplineId));
  }

  /**
   * List all tools with a specific tag.
   *
   * Filters tools by their `tags` array to return
   * only those containing the specified tag.
   *
   * @param tag - The tag to filter by
   * @returns Array of tool entries with the specified tag
   *
   * @example
   * ```typescript
   * const vcsTools = await registry.listByTag('vcs');
   * console.log(`Found ${vcsTools.length} VCS tools`);
   * vcsTools.forEach(tool => {
   *   console.log(`- ${tool.name}`);
   * });
   * ```
   */
  async listByTag(tag: string): Promise<ToolRegistryEntry[]> {
    const allTools = await this.storage.getAll();
    return allTools.filter((tool) => tool.tags.includes(tag));
  }

  /**
   * Search for tools by name or description.
   *
   * Performs a case-insensitive search across tool names and descriptions.
   * Returns all tools where the query string appears in either field.
   *
   * @param query - The search query string
   * @returns Array of tool entries matching the search query
   *
   * @example
   * ```typescript
   * const results = await registry.search('github');
   * console.log(`Found ${results.length} tools matching 'github'`);
   * results.forEach(tool => {
   *   console.log(`- ${tool.name}: ${tool.description}`);
   * });
   * ```
   */
  async search(query: string): Promise<ToolRegistryEntry[]> {
    const allTools = await this.storage.getAll();
    const lowerQuery = query.toLowerCase();

    return allTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.description.toLowerCase().includes(lowerQuery) ||
        tool.config.name.toLowerCase().includes(lowerQuery) ||
        tool.config.description.toLowerCase().includes(lowerQuery),
    );
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a tool entry exists.
   *
   * @param id - Unique identifier to check
   * @returns True if the tool entry exists
   *
   * @example
   * ```typescript
   * if (await registry.has('tool-github-001')) {
   *   console.log('Tool exists');
   * }
   * ```
   */
  async has(id: string): Promise<boolean> {
    return this.storage.has(id);
  }

  /**
   * Get the count of registered tool entries.
   *
   * @returns The number of registered tool entries
   *
   * @example
   * ```typescript
   * const count = await registry.count();
   * console.log(`Total tools: ${count}`);
   * ```
   */
  async count(): Promise<number> {
    return this.storage.count();
  }

  /**
   * Get all unique tags across all registered tools.
   *
   * @returns Array of unique tag strings
   *
   * @example
   * ```typescript
   * const tags = await registry.getAllTags();
   * console.log('Available tags:', tags.join(', '));
   * ```
   */
  async getAllTags(): Promise<string[]> {
    const allTools = await this.storage.getAll();
    const tagSet = new Set<string>();

    for (const tool of allTools) {
      for (const tag of tool.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Get all unique discipline IDs across all registered tools.
   *
   * @returns Array of unique discipline ID strings
   *
   * @example
   * ```typescript
   * const disciplines = await registry.getAllDisciplineIds();
   * console.log('Disciplines with tools:', disciplines.join(', '));
   * ```
   */
  async getAllDisciplineIds(): Promise<string[]> {
    const allTools = await this.storage.getAll();
    const disciplineSet = new Set<string>();

    for (const tool of allTools) {
      for (const disciplineId of tool.disciplineIds) {
        disciplineSet.add(disciplineId);
      }
    }

    return Array.from(disciplineSet).sort();
  }

  /**
   * Get registry statistics.
   *
   * @returns Object containing tool count and unique counts
   *
   * @example
   * ```typescript
   * const stats = await registry.getStats();
   * console.log(`Tools: ${stats.toolCount}, Tags: ${stats.tagCount}, Disciplines: ${stats.disciplineCount}`);
   * ```
   */
  async getStats(): Promise<{
    toolCount: number;
    tagCount: number;
    disciplineCount: number;
  }> {
    const [toolCount, tags, disciplines] = await Promise.all([
      this.storage.count(),
      this.getAllTags(),
      this.getAllDisciplineIds(),
    ]);

    return {
      toolCount,
      tagCount: tags.length,
      disciplineCount: disciplines.length,
    };
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a tool entry for required fields and constraints.
   *
   * @param entry - The tool entry to validate
   * @throws Error if validation fails
   */
  private validateEntry(entry: ToolRegistryEntry): void {
    if (!entry.id || typeof entry.id !== 'string') {
      throw new Error('Tool entry must have a valid id');
    }
    if (!entry.name || typeof entry.name !== 'string') {
      throw new Error('Tool entry must have a valid name');
    }
    if (!entry.description || typeof entry.description !== 'string') {
      throw new Error('Tool entry must have a valid description');
    }
    if (!entry.config) {
      throw new Error('Tool entry must have a config');
    }
    if (!entry.config.name || typeof entry.config.name !== 'string') {
      throw new Error('Tool entry config must have a valid name');
    }
    if (!entry.config.command || typeof entry.config.command !== 'string') {
      throw new Error('Tool entry config must have a valid command');
    }
    if (!entry.config.description || typeof entry.config.description !== 'string') {
      throw new Error('Tool entry config must have a valid description');
    }
    if (!Array.isArray(entry.disciplineIds)) {
      throw new Error('Tool entry must have disciplineIds array');
    }
    if (!Array.isArray(entry.tags)) {
      throw new Error('Tool entry must have tags array');
    }
    if (!(entry.createdAt instanceof Date)) {
      throw new Error('Tool entry must have a valid createdAt Date');
    }
    if (!(entry.updatedAt instanceof Date)) {
      throw new Error('Tool entry must have a valid updatedAt Date');
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ToolsRegistry instance with the specified configuration.
 *
 * This is the recommended way to create registry instances, providing
 * sensible defaults when configuration is not specified.
 *
 * @param config - Optional configuration for the registry
 * @returns A new ToolsRegistry instance
 *
 * @example
 * ```typescript
 * // Create with defaults (memory storage)
 * const memoryRegistry = createToolsRegistry();
 *
 * // Create with file storage
 * const fileRegistry = createToolsRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/tools',
 * });
 *
 * // Create with specific configuration
 * const customRegistry = createToolsRegistry({
 *   storageType: 'file',
 *   basePath: '/var/lib/wundr/registry/tools',
 * });
 * ```
 */
export function createToolsRegistry(
  config?: Partial<ToolsRegistryConfig>,
): ToolsRegistry {
  const mergedConfig: ToolsRegistryConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return new ToolsRegistry(mergedConfig);
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type { MCPServerConfig };
