/**
 * @fileoverview Charter Registry - Manages VP and Session Manager charters
 *
 * This module provides a centralized registry for managing Virtual Persona (VP) and
 * Session Manager charters in the Wundr organizational hierarchy. It supports both
 * file-based and in-memory storage backends for flexible deployment scenarios.
 *
 * Key Features:
 * - Register, retrieve, list, and remove VP charters (Tier 1)
 * - Register, retrieve, list, and remove Session Manager charters (Tier 2)
 * - Query Session Managers by parent VP
 * - Pluggable storage backends (file or memory)
 * - Full TypeScript type safety
 *
 * @module @wundr/org-genesis/registry/charter-registry
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Create a file-based registry
 * const registry = createCharterRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/charters',
 * });
 *
 * // Register a VP charter
 * await registry.registerVP(vpCharter);
 *
 * // List all VPs
 * const vps = await registry.listVPs();
 *
 * // Get Session Managers for a specific VP
 * const sessionManagers = await registry.getSessionManagersByVP('vp-001');
 * ```
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';

import type { VPCharter, SessionManagerCharter } from '../types/index.js';

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Generic storage interface for registry entities.
 *
 * Provides a consistent API for storing and retrieving entities regardless
 * of the underlying storage mechanism. Implementations must support basic
 * CRUD operations with async/await pattern.
 *
 * @typeParam T - The type of entity being stored (must have an 'id' property)
 *
 * @example
 * ```typescript
 * class CustomStorage implements IRegistryStorage<VPCharter> {
 *   async set(id: string, entity: VPCharter): Promise<void> {
 *     // Custom storage logic
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface IRegistryStorage<T extends { id: string }> {
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
 * In-memory storage implementation for registry entities.
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
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorage<VPCharter>();
 * await storage.set('vp-001', vpCharter);
 * const charter = await storage.get('vp-001');
 * ```
 */
export class MemoryStorage<T extends { id: string }> implements IRegistryStorage<T> {
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
 * File-based storage implementation for registry entities.
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
 *
 * @example
 * ```typescript
 * const storage = new FileStorage<VPCharter>('./.wundr/charters/vp');
 * await storage.set('vp-001', vpCharter);
 * const charter = await storage.get('vp-001');
 * ```
 */
export class FileStorage<T extends { id: string }> implements IRegistryStorage<T> {
  /** Base directory path for storing entity files */
  private readonly basePath: string;

  /** In-memory cache for faster reads */
  private cache: Map<string, T> = new Map();

  /** Whether the cache has been initialized from disk */
  private cacheInitialized = false;

  /**
   * Create a new FileStorage instance.
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

    const ids = Array.from(this.cache.keys());
    for (const id of ids) {
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
// Charter Registry Configuration
// ============================================================================

/**
 * Configuration options for the CharterRegistry.
 *
 * Specifies the storage backend and optional configuration parameters.
 *
 * @example
 * ```typescript
 * // File-based storage
 * const fileConfig: CharterRegistryConfig = {
 *   storageType: 'file',
 *   basePath: './.wundr/charters',
 * };
 *
 * // In-memory storage
 * const memoryConfig: CharterRegistryConfig = {
 *   storageType: 'memory',
 * };
 * ```
 */
export interface CharterRegistryConfig {
  /**
   * Type of storage backend to use.
   * - `file`: Persist charters as JSON files
   * - `memory`: Store charters in memory (ephemeral)
   */
  storageType: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   * Only applicable when storageType is 'file'.
   * VP charters stored in `{basePath}/vp/`
   * Session Manager charters stored in `{basePath}/session-manager/`
   *
   * @default './.wundr/registry/charters'
   */
  basePath?: string;
}

/**
 * Default configuration for the CharterRegistry.
 */
const DEFAULT_CONFIG: CharterRegistryConfig = {
  storageType: 'memory',
  basePath: './.wundr/registry/charters',
};

// ============================================================================
// Charter Registry Class
// ============================================================================

/**
 * CharterRegistry - Centralized management of VP and Session Manager charters.
 *
 * The CharterRegistry provides a unified interface for storing, retrieving,
 * and managing organizational charters. It supports both VP (Tier 1) and
 * Session Manager (Tier 2) charters with relationship tracking.
 *
 * Key Capabilities:
 * - **VP Management**: Register, retrieve, list, and remove VP charters
 * - **Session Manager Management**: Full CRUD operations for Session Manager charters
 * - **Relationship Queries**: Get Session Managers by their parent VP
 * - **Pluggable Storage**: Switch between file and memory backends
 * - **Type Safety**: Full TypeScript support with discriminated unions
 *
 * @example
 * ```typescript
 * // Create with file storage
 * const registry = new CharterRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/charters',
 * });
 *
 * // Register a VP
 * await registry.registerVP({
 *   id: 'vp-engineering-001',
 *   tier: 1,
 *   identity: { name: 'Engineering VP', slug: 'eng-vp', persona: 'Technical leader' },
 *   coreDirective: 'Ensure code quality',
 *   capabilities: ['context_compilation', 'session_spawning'],
 *   mcpTools: ['github_swarm'],
 *   resourceLimits: { maxConcurrentSessions: 10, tokenBudgetPerHour: 500000, maxMemoryMB: 1024, maxCpuPercent: 50 },
 *   objectives: { responseTimeTarget: 10, taskCompletionRate: 90, qualityScore: 85 },
 *   constraints: { forbiddenCommands: [], forbiddenPaths: [], forbiddenActions: [], requireApprovalFor: [] },
 *   disciplineIds: ['frontend', 'backend'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Query Session Managers for a VP
 * const sessionManagers = await registry.getSessionManagersByVP('vp-engineering-001');
 * ```
 */
export class CharterRegistry {
  /** Storage backend for VP charters */
  private readonly vpStorage: IRegistryStorage<VPCharter>;

  /** Storage backend for Session Manager charters */
  private readonly sessionManagerStorage: IRegistryStorage<SessionManagerCharter>;

  /** Configuration for this registry instance */
  private readonly config: CharterRegistryConfig;

  /**
   * Create a new CharterRegistry instance.
   *
   * @param config - Configuration options for the registry
   *
   * @example
   * ```typescript
   * const registry = new CharterRegistry({
   *   storageType: 'file',
   *   basePath: './data/charters',
   * });
   * ```
   */
  constructor(config: CharterRegistryConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.storageType === 'file') {
      const basePath = this.config.basePath ?? DEFAULT_CONFIG.basePath!;
      this.vpStorage = new FileStorage<VPCharter>(join(basePath, 'vp'));
      this.sessionManagerStorage = new FileStorage<SessionManagerCharter>(
        join(basePath, 'session-manager'),
      );
    } else {
      this.vpStorage = new MemoryStorage<VPCharter>();
      this.sessionManagerStorage = new MemoryStorage<SessionManagerCharter>();
    }
  }

  // ==========================================================================
  // VP Charter Operations
  // ==========================================================================

  /**
   * Register a new VP charter.
   *
   * Stores the VP charter in the registry. If a charter with the same ID
   * already exists, it will be overwritten.
   *
   * @param charter - The VP charter to register
   * @returns Promise that resolves when registration is complete
   * @throws Error if the charter is invalid (missing required fields)
   *
   * @example
   * ```typescript
   * await registry.registerVP({
   *   id: 'vp-engineering-001',
   *   tier: 1,
   *   identity: { name: 'Engineering VP', slug: 'eng-vp', persona: 'Technical leader' },
   *   // ... other required fields
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  async registerVP(charter: VPCharter): Promise<void> {
    this.validateVPCharter(charter);
    await this.vpStorage.set(charter.id, charter);
  }

  /**
   * Retrieve a VP charter by ID.
   *
   * @param id - Unique identifier of the VP charter
   * @returns The VP charter or null if not found
   *
   * @example
   * ```typescript
   * const vp = await registry.getVP('vp-engineering-001');
   * if (vp) {
   *   console.log(`Found VP: ${vp.identity.name}`);
   * }
   * ```
   */
  async getVP(id: string): Promise<VPCharter | null> {
    return this.vpStorage.get(id);
  }

  /**
   * List all registered VP charters.
   *
   * @returns Array of all VP charters
   *
   * @example
   * ```typescript
   * const vps = await registry.listVPs();
   * console.log(`Total VPs: ${vps.length}`);
   * vps.forEach(vp => console.log(`- ${vp.identity.name}`));
   * ```
   */
  async listVPs(): Promise<VPCharter[]> {
    return this.vpStorage.getAll();
  }

  /**
   * Remove a VP charter by ID.
   *
   * @param id - Unique identifier of the VP charter to remove
   * @returns True if the charter was removed, false if not found
   *
   * @remarks
   * This does NOT cascade delete Session Managers. You should
   * remove or reassign Session Managers before removing their parent VP.
   *
   * @example
   * ```typescript
   * const removed = await registry.removeVP('vp-engineering-001');
   * console.log(removed ? 'VP removed' : 'VP not found');
   * ```
   */
  async removeVP(id: string): Promise<boolean> {
    return this.vpStorage.delete(id);
  }

  /**
   * Check if a VP charter exists.
   *
   * @param id - Unique identifier to check
   * @returns True if the VP charter exists
   *
   * @example
   * ```typescript
   * if (await registry.hasVP('vp-engineering-001')) {
   *   console.log('VP exists');
   * }
   * ```
   */
  async hasVP(id: string): Promise<boolean> {
    return this.vpStorage.has(id);
  }

  /**
   * Get the count of registered VP charters.
   *
   * @returns The number of registered VP charters
   *
   * @example
   * ```typescript
   * const count = await registry.countVPs();
   * console.log(`Total VPs: ${count}`);
   * ```
   */
  async countVPs(): Promise<number> {
    return this.vpStorage.count();
  }

  // ==========================================================================
  // Session Manager Charter Operations
  // ==========================================================================

  /**
   * Register a new Session Manager charter.
   *
   * Stores the Session Manager charter in the registry. If a charter with
   * the same ID already exists, it will be overwritten.
   *
   * @param charter - The Session Manager charter to register
   * @returns Promise that resolves when registration is complete
   * @throws Error if the charter is invalid (missing required fields)
   *
   * @example
   * ```typescript
   * await registry.registerSessionManager({
   *   id: 'sm-frontend-001',
   *   tier: 2,
   *   identity: { name: 'Frontend SM', slug: 'frontend-sm', persona: 'React specialist' },
   *   coreDirective: 'Coordinate frontend tasks',
   *   disciplineId: 'frontend',
   *   parentVpId: 'vp-engineering-001',
   *   mcpTools: ['code_review'],
   *   agentIds: [],
   *   objectives: { responseTimeTarget: 5, taskCompletionRate: 95, qualityScore: 90 },
   *   constraints: { forbiddenCommands: [], forbiddenPaths: [], forbiddenActions: [], requireApprovalFor: [] },
   *   memoryBankPath: '/memory/frontend',
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  async registerSessionManager(charter: SessionManagerCharter): Promise<void> {
    this.validateSessionManagerCharter(charter);
    await this.sessionManagerStorage.set(charter.id, charter);
  }

  /**
   * Retrieve a Session Manager charter by ID.
   *
   * @param id - Unique identifier of the Session Manager charter
   * @returns The Session Manager charter or null if not found
   *
   * @example
   * ```typescript
   * const sm = await registry.getSessionManager('sm-frontend-001');
   * if (sm) {
   *   console.log(`Found Session Manager: ${sm.identity.name}`);
   * }
   * ```
   */
  async getSessionManager(id: string): Promise<SessionManagerCharter | null> {
    return this.sessionManagerStorage.get(id);
  }

  /**
   * List all registered Session Manager charters.
   *
   * @returns Array of all Session Manager charters
   *
   * @example
   * ```typescript
   * const sessionManagers = await registry.listSessionManagers();
   * console.log(`Total Session Managers: ${sessionManagers.length}`);
   * ```
   */
  async listSessionManagers(): Promise<SessionManagerCharter[]> {
    return this.sessionManagerStorage.getAll();
  }

  /**
   * Get all Session Managers belonging to a specific VP.
   *
   * Filters Session Managers by their `parentVpId` field to return
   * only those managed by the specified VP.
   *
   * @param vpId - The ID of the parent VP
   * @returns Array of Session Manager charters belonging to the VP
   *
   * @example
   * ```typescript
   * const sessionManagers = await registry.getSessionManagersByVP('vp-engineering-001');
   * console.log(`Engineering VP has ${sessionManagers.length} session managers`);
   * sessionManagers.forEach(sm => {
   *   console.log(`- ${sm.identity.name} (${sm.disciplineId})`);
   * });
   * ```
   */
  async getSessionManagersByVP(vpId: string): Promise<SessionManagerCharter[]> {
    const allSessionManagers = await this.sessionManagerStorage.getAll();
    return allSessionManagers.filter((sm) => sm.parentVpId === vpId);
  }

  /**
   * Get all Session Managers for a specific discipline.
   *
   * Filters Session Managers by their `disciplineId` field to return
   * only those managing the specified discipline.
   *
   * @param disciplineId - The ID of the discipline
   * @returns Array of Session Manager charters for the discipline
   *
   * @example
   * ```typescript
   * const sessionManagers = await registry.getSessionManagersByDiscipline('frontend');
   * console.log(`Frontend discipline has ${sessionManagers.length} session managers`);
   * ```
   */
  async getSessionManagersByDiscipline(
    disciplineId: string,
  ): Promise<SessionManagerCharter[]> {
    const allSessionManagers = await this.sessionManagerStorage.getAll();
    return allSessionManagers.filter((sm) => sm.disciplineId === disciplineId);
  }

  /**
   * Remove a Session Manager charter by ID.
   *
   * @param id - Unique identifier of the Session Manager charter to remove
   * @returns True if the charter was removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = await registry.removeSessionManager('sm-frontend-001');
   * console.log(removed ? 'Session Manager removed' : 'Session Manager not found');
   * ```
   */
  async removeSessionManager(id: string): Promise<boolean> {
    return this.sessionManagerStorage.delete(id);
  }

  /**
   * Check if a Session Manager charter exists.
   *
   * @param id - Unique identifier to check
   * @returns True if the Session Manager charter exists
   *
   * @example
   * ```typescript
   * if (await registry.hasSessionManager('sm-frontend-001')) {
   *   console.log('Session Manager exists');
   * }
   * ```
   */
  async hasSessionManager(id: string): Promise<boolean> {
    return this.sessionManagerStorage.has(id);
  }

  /**
   * Get the count of registered Session Manager charters.
   *
   * @returns The number of registered Session Manager charters
   *
   * @example
   * ```typescript
   * const count = await registry.countSessionManagers();
   * console.log(`Total Session Managers: ${count}`);
   * ```
   */
  async countSessionManagers(): Promise<number> {
    return this.sessionManagerStorage.count();
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Clear all charters from the registry.
   *
   * Removes both VP and Session Manager charters from storage.
   * Use with caution in production environments.
   *
   * @returns Promise that resolves when all charters are cleared
   *
   * @example
   * ```typescript
   * // Clear all data (useful for testing)
   * await registry.clear();
   * ```
   */
  async clear(): Promise<void> {
    await Promise.all([this.vpStorage.clear(), this.sessionManagerStorage.clear()]);
  }

  /**
   * Get registry statistics.
   *
   * @returns Object containing counts of VPs and Session Managers
   *
   * @example
   * ```typescript
   * const stats = await registry.getStats();
   * console.log(`VPs: ${stats.vpCount}, Session Managers: ${stats.sessionManagerCount}`);
   * ```
   */
  async getStats(): Promise<{ vpCount: number; sessionManagerCount: number }> {
    const [vpCount, sessionManagerCount] = await Promise.all([
      this.vpStorage.count(),
      this.sessionManagerStorage.count(),
    ]);

    return { vpCount, sessionManagerCount };
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a VP charter for required fields and constraints.
   *
   * @param charter - The VP charter to validate
   * @throws Error if validation fails
   */
  private validateVPCharter(charter: VPCharter): void {
    if (!charter.id || typeof charter.id !== 'string') {
      throw new Error('VP charter must have a valid id');
    }
    if (charter.tier !== 1) {
      throw new Error('VP charter must have tier = 1');
    }
    if (!charter.identity || !charter.identity.name || !charter.identity.slug) {
      throw new Error('VP charter must have a valid identity with name and slug');
    }
    if (!charter.coreDirective || typeof charter.coreDirective !== 'string') {
      throw new Error('VP charter must have a valid coreDirective');
    }
    if (!Array.isArray(charter.capabilities)) {
      throw new Error('VP charter must have capabilities array');
    }
    if (!charter.resourceLimits) {
      throw new Error('VP charter must have resourceLimits');
    }
    if (!charter.objectives) {
      throw new Error('VP charter must have objectives');
    }
    if (!charter.constraints) {
      throw new Error('VP charter must have constraints');
    }
  }

  /**
   * Validate a Session Manager charter for required fields and constraints.
   *
   * @param charter - The Session Manager charter to validate
   * @throws Error if validation fails
   */
  private validateSessionManagerCharter(charter: SessionManagerCharter): void {
    if (!charter.id || typeof charter.id !== 'string') {
      throw new Error('Session Manager charter must have a valid id');
    }
    if (charter.tier !== 2) {
      throw new Error('Session Manager charter must have tier = 2');
    }
    if (!charter.identity || !charter.identity.name || !charter.identity.slug) {
      throw new Error(
        'Session Manager charter must have a valid identity with name and slug',
      );
    }
    if (!charter.coreDirective || typeof charter.coreDirective !== 'string') {
      throw new Error('Session Manager charter must have a valid coreDirective');
    }
    if (!charter.disciplineId || typeof charter.disciplineId !== 'string') {
      throw new Error('Session Manager charter must have a valid disciplineId');
    }
    if (!charter.parentVpId || typeof charter.parentVpId !== 'string') {
      throw new Error('Session Manager charter must have a valid parentVpId');
    }
    if (!charter.memoryBankPath || typeof charter.memoryBankPath !== 'string') {
      throw new Error('Session Manager charter must have a valid memoryBankPath');
    }
    if (!charter.objectives) {
      throw new Error('Session Manager charter must have objectives');
    }
    if (!charter.constraints) {
      throw new Error('Session Manager charter must have constraints');
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new CharterRegistry instance with the specified configuration.
 *
 * This is the recommended way to create registry instances, providing
 * sensible defaults when configuration is not specified.
 *
 * @param config - Optional configuration for the registry
 * @returns A new CharterRegistry instance
 *
 * @example
 * ```typescript
 * // Create with defaults (memory storage)
 * const memoryRegistry = createCharterRegistry();
 *
 * // Create with file storage
 * const fileRegistry = createCharterRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/charters',
 * });
 *
 * // Create with specific configuration
 * const customRegistry = createCharterRegistry({
 *   storageType: 'file',
 *   basePath: '/var/lib/wundr/registry/charters',
 * });
 * ```
 */
export function createCharterRegistry(
  config?: Partial<CharterRegistryConfig>,
): CharterRegistry {
  const mergedConfig: CharterRegistryConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return new CharterRegistry(mergedConfig);
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type { VPCharter, SessionManagerCharter };
