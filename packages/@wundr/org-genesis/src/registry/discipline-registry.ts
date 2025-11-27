/**
 * @packageDocumentation
 * Discipline Registry - Manages organizational disciplines and their metadata.
 *
 * This module provides a centralized registry for managing Discipline Packs within
 * the org-genesis system. Discipline Packs define the complete configuration for
 * specific work domains including CLAUDE.md settings, MCP servers, hooks, and
 * agent mappings.
 *
 * @module @wundr/org-genesis/registry/discipline-registry
 *
 * @example
 * ```typescript
 * import { createDisciplineRegistry, DisciplineRegistry } from '@wundr/org-genesis';
 *
 * // Create with file storage (default)
 * const registry = createDisciplineRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/disciplines',
 * });
 *
 * // Create with memory storage (for testing)
 * const testRegistry = createDisciplineRegistry({
 *   storageType: 'memory',
 * });
 *
 * // Register a new discipline
 * await registry.register(myDisciplinePack);
 *
 * // Query disciplines
 * const engineeringDisciplines = await registry.listByCategory('engineering');
 * ```
 */

import { FileStorage, type FileStorageConfig } from './storage/file-storage.js';
import { MemoryStorage } from './storage/memory-storage.js';

import type { IRegistryStorage } from './storage/storage-interface.js';
import type { DisciplinePack, DisciplineCategory } from '../types/index.js';

/**
 * Configuration options for creating a DisciplineRegistry instance.
 *
 * @description
 * Defines how the registry should persist its data. Choose between file-based
 * storage for persistent data across restarts, or memory storage for testing
 * and ephemeral use cases.
 *
 * @example
 * ```typescript
 * // File storage configuration
 * const fileConfig: DisciplineRegistryConfig = {
 *   storageType: 'file',
 *   basePath: './.wundr/registry/disciplines',
 * };
 *
 * // Memory storage configuration (for testing)
 * const memoryConfig: DisciplineRegistryConfig = {
 *   storageType: 'memory',
 * };
 * ```
 */
export interface DisciplineRegistryConfig {
  /**
   * The type of storage backend to use.
   *
   * - `file`: Persists data to the filesystem as JSON files. Data survives
   *   process restarts. Suitable for production and development.
   * - `memory`: Stores data in-memory only. Data is lost on process exit.
   *   Suitable for testing and temporary operations.
   *
   * @default 'memory'
   */
  storageType: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   *
   * Only applicable when `storageType` is `'file'`. The registry will create
   * this directory if it doesn't exist and store discipline data as JSON files.
   *
   * @default './.wundr/registry/disciplines'
   *
   * @example
   * ```typescript
   * // Relative path
   * basePath: './.wundr/disciplines'
   *
   * // Absolute path
   * basePath: '/var/lib/wundr/disciplines'
   * ```
   */
  basePath?: string;
}

/**
 * Default configuration values for the DisciplineRegistry.
 *
 * @internal
 */
const DEFAULT_CONFIG: DisciplineRegistryConfig = {
  storageType: 'memory',
  basePath: './.wundr/registry/disciplines',
};

/**
 * Centralized registry for managing Discipline Packs.
 *
 * @description
 * The DisciplineRegistry provides a unified interface for storing, retrieving,
 * and querying Discipline Packs within the org-genesis system. It supports
 * multiple storage backends (file, memory) and provides efficient lookup
 * operations by ID, slug, and category.
 *
 * Key features:
 * - CRUD operations for discipline packs
 * - Query by ID, slug, or category
 * - Pluggable storage backends
 * - Full type safety with DisciplinePack type
 *
 * @example
 * ```typescript
 * import { DisciplineRegistry, createDisciplineRegistry } from '@wundr/org-genesis';
 *
 * // Using the factory function (recommended)
 * const registry = createDisciplineRegistry({ storageType: 'memory' });
 *
 * // Register a discipline
 * await registry.register({
 *   id: 'disc_eng_001',
 *   name: 'Software Engineering',
 *   slug: 'software-engineering',
 *   category: 'engineering',
 *   description: 'Full-stack development discipline',
 *   claudeMd: {
 *     role: 'Software Engineer',
 *     context: 'Building web applications',
 *     rules: ['Follow TDD'],
 *     objectives: ['Deliver quality code'],
 *     constraints: ['No production access'],
 *   },
 *   mcpServers: [],
 *   hooks: [],
 *   agentIds: [],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * });
 *
 * // Retrieve by ID
 * const discipline = await registry.get('disc_eng_001');
 *
 * // List all engineering disciplines
 * const engineeringDisciplines = await registry.listByCategory('engineering');
 * ```
 */
export class DisciplineRegistry {
  /**
   * The underlying storage backend for discipline data.
   * @internal
   */
  private readonly storage: IRegistryStorage<DisciplinePack>;

  /**
   * Creates a new DisciplineRegistry instance.
   *
   * @param storage - The storage backend implementation to use
   *
   * @example
   * ```typescript
   * // Using MemoryStorage
   * const memoryStorage = new MemoryStorage<DisciplinePack>();
   * const registry = new DisciplineRegistry(memoryStorage);
   *
   * // Using FileStorage
   * const fileStorage = new FileStorage<DisciplinePack>('./.wundr/disciplines');
   * const registry = new DisciplineRegistry(fileStorage);
   * ```
   */
  constructor(storage: IRegistryStorage<DisciplinePack>) {
    this.storage = storage;
  }

  /**
   * Registers a new discipline pack in the registry.
   *
   * @description
   * Adds a discipline pack to the registry. If a discipline with the same ID
   * already exists, it will be overwritten. The discipline's `updatedAt`
   * timestamp will be set to the current time if not provided.
   *
   * @param discipline - The discipline pack to register
   * @throws {Error} If the discipline pack fails validation
   *
   * @example
   * ```typescript
   * await registry.register({
   *   id: 'disc_eng_001',
   *   name: 'Frontend Development',
   *   slug: 'frontend-development',
   *   category: 'engineering',
   *   description: 'React and TypeScript development',
   *   claudeMd: {
   *     role: 'Frontend Developer',
   *     context: 'Building modern web UIs',
   *     rules: ['Use TypeScript', 'Follow accessibility guidelines'],
   *     objectives: ['Create responsive interfaces'],
   *     constraints: ['No backend modifications'],
   *   },
   *   mcpServers: [],
   *   hooks: [],
   *   agentIds: [],
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  async register(discipline: DisciplinePack): Promise<void> {
    // Ensure the updatedAt timestamp is current
    const disciplineToStore: DisciplinePack = {
      ...discipline,
      updatedAt: new Date(),
    };

    await this.storage.set(discipline.id, disciplineToStore);
  }

  /**
   * Retrieves a discipline pack by its unique identifier.
   *
   * @param id - The unique identifier of the discipline pack
   * @returns The discipline pack if found, or null if not present
   *
   * @example
   * ```typescript
   * const discipline = await registry.get('disc_eng_001');
   * if (discipline) {
   *   console.log(`Found: ${discipline.name}`);
   *   console.log(`Category: ${discipline.category}`);
   * } else {
   *   console.log('Discipline not found');
   * }
   * ```
   */
  async get(id: string): Promise<DisciplinePack | null> {
    return this.storage.get(id);
  }

  /**
   * Retrieves a discipline pack by its URL-safe slug.
   *
   * @description
   * Looks up a discipline by its slug, which is typically a URL-safe
   * lowercase version of the discipline name (e.g., 'software-engineering').
   * This is useful for REST API endpoints and human-readable URLs.
   *
   * @param slug - The URL-safe slug of the discipline
   * @returns The discipline pack if found, or null if not present
   *
   * @example
   * ```typescript
   * // Retrieve by slug (e.g., from a URL parameter)
   * const discipline = await registry.getBySlug('software-engineering');
   * if (discipline) {
   *   console.log(`Found discipline: ${discipline.name}`);
   * }
   * ```
   */
  async getBySlug(slug: string): Promise<DisciplinePack | null> {
    const disciplines = await this.storage.query(
      (discipline) => discipline.slug === slug,
    );
    return disciplines.length > 0 ? disciplines[0] : null;
  }

  /**
   * Returns all discipline packs in the registry.
   *
   * @description
   * Retrieves all registered discipline packs. For large registries,
   * consider using `listByCategory` to filter results.
   *
   * @returns Array of all registered discipline packs
   *
   * @example
   * ```typescript
   * const allDisciplines = await registry.list();
   * console.log(`Total disciplines: ${allDisciplines.length}`);
   *
   * // Group by category
   * const grouped = allDisciplines.reduce((acc, d) => {
   *   acc[d.category] = acc[d.category] || [];
   *   acc[d.category].push(d);
   *   return acc;
   * }, {} as Record<string, DisciplinePack[]>);
   * ```
   */
  async list(): Promise<DisciplinePack[]> {
    return this.storage.list();
  }

  /**
   * Lists all discipline packs in a specific category.
   *
   * @description
   * Filters disciplines by their category, returning only those that match.
   * This is useful for organizing disciplines by department or functional area.
   *
   * @param category - The discipline category to filter by
   * @returns Array of discipline packs in the specified category
   *
   * @example
   * ```typescript
   * // Get all engineering disciplines
   * const engineeringDisciplines = await registry.listByCategory('engineering');
   * console.log(`Engineering disciplines: ${engineeringDisciplines.length}`);
   *
   * // Display each discipline
   * for (const discipline of engineeringDisciplines) {
   *   console.log(`- ${discipline.name}: ${discipline.description}`);
   * }
   *
   * // Get all legal disciplines
   * const legalDisciplines = await registry.listByCategory('legal');
   * ```
   */
  async listByCategory(category: DisciplineCategory): Promise<DisciplinePack[]> {
    return this.storage.query((discipline) => discipline.category === category);
  }

  /**
   * Removes a discipline pack from the registry.
   *
   * @description
   * Deletes a discipline pack by its ID. This operation is irreversible.
   * Returns true if a discipline was removed, false if no discipline
   * existed with the given ID.
   *
   * Note: This does not automatically remove associated agents or update
   * parent Orchestrator references. Ensure proper cleanup is performed by the caller.
   *
   * @param id - The unique identifier of the discipline to remove
   * @returns True if the discipline was removed, false if not found
   *
   * @example
   * ```typescript
   * const wasRemoved = await registry.remove('disc_eng_001');
   * if (wasRemoved) {
   *   console.log('Discipline removed successfully');
   * } else {
   *   console.log('Discipline not found');
   * }
   * ```
   */
  async remove(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }

  /**
   * Updates an existing discipline pack with partial changes.
   *
   * @description
   * Merges the provided updates into an existing discipline pack.
   * Only the fields specified in `updates` will be modified; all other
   * fields retain their original values. The `updatedAt` timestamp is
   * automatically set to the current time.
   *
   * @param id - The unique identifier of the discipline to update
   * @param updates - Partial discipline pack with fields to update
   * @returns The updated discipline pack
   * @throws {Error} If no discipline exists with the given ID
   *
   * @example
   * ```typescript
   * // Update the description
   * const updated = await registry.update('disc_eng_001', {
   *   description: 'Updated description for frontend development',
   * });
   *
   * // Update MCP servers
   * const withServers = await registry.update('disc_eng_001', {
   *   mcpServers: [
   *     {
   *       name: 'browser-tools',
   *       command: 'npx',
   *       args: ['@anthropic/browser-tools'],
   *       description: 'Browser automation',
   *     },
   *   ],
   * });
   *
   * // Update CLAUDE.md configuration
   * const withClaudeMd = await registry.update('disc_eng_001', {
   *   claudeMd: {
   *     role: 'Senior Frontend Developer',
   *     context: 'Building enterprise React applications',
   *     rules: ['Use TypeScript strict mode', 'Write unit tests'],
   *     objectives: ['Deliver accessible, performant UIs'],
   *     constraints: ['No direct database access'],
   *   },
   * });
   * ```
   */
  async update(id: string, updates: Partial<DisciplinePack>): Promise<DisciplinePack> {
    const existing = await this.storage.get(id);

    if (!existing) {
      throw new Error(`Discipline with id '${id}' not found`);
    }

    const updated: DisciplinePack = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
      createdAt: existing.createdAt, // Preserve original creation time
      updatedAt: new Date(), // Always update timestamp
    };

    await this.storage.set(id, updated);
    return updated;
  }

  /**
   * Checks if a discipline pack exists in the registry.
   *
   * @description
   * Efficiently checks whether a discipline with the given ID is registered,
   * without retrieving the full discipline data. Useful for validation and
   * duplicate detection.
   *
   * @param id - The unique identifier to check
   * @returns True if a discipline exists with the given ID, false otherwise
   *
   * @example
   * ```typescript
   * // Check before registration to avoid duplicates
   * if (await registry.exists('disc_eng_001')) {
   *   console.log('Discipline already registered');
   * } else {
   *   await registry.register(newDiscipline);
   * }
   *
   * // Validate discipline ID reference
   * const validateReference = async (disciplineId: string) => {
   *   if (!await registry.exists(disciplineId)) {
   *     throw new Error(`Invalid discipline reference: ${disciplineId}`);
   *   }
   * };
   * ```
   */
  async exists(id: string): Promise<boolean> {
    return this.storage.exists(id);
  }

  /**
   * Removes all discipline packs from the registry.
   *
   * @description
   * Clears all registered disciplines from the storage backend.
   * This is a destructive operation that cannot be undone.
   * Use with caution in production environments.
   *
   * Primarily useful for:
   * - Testing and test cleanup
   * - Development environment resets
   * - Migration scenarios
   *
   * @example
   * ```typescript
   * // Clear registry (typically in tests)
   * await registry.clear();
   *
   * // Verify registry is empty
   * const disciplines = await registry.list();
   * console.log(disciplines.length); // 0
   * ```
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }
}

/**
 * Factory function to create a configured DisciplineRegistry instance.
 *
 * @description
 * Creates a new DisciplineRegistry with the specified storage configuration.
 * This is the recommended way to instantiate a registry, as it handles
 * storage backend setup automatically.
 *
 * If no configuration is provided, defaults to in-memory storage.
 *
 * @param config - Optional configuration options
 * @returns A new DisciplineRegistry instance
 *
 * @example
 * ```typescript
 * // Create with default configuration (memory storage)
 * const registry = createDisciplineRegistry();
 *
 * // Create with file storage
 * const persistentRegistry = createDisciplineRegistry({
 *   storageType: 'file',
 *   basePath: './.wundr/registry/disciplines',
 * });
 *
 * // Create with memory storage (explicit)
 * const testRegistry = createDisciplineRegistry({
 *   storageType: 'memory',
 * });
 *
 * // Use the registry
 * await registry.register(myDiscipline);
 * const disciplines = await registry.list();
 * ```
 */
export function createDisciplineRegistry(
  config?: Partial<DisciplineRegistryConfig>,
): DisciplineRegistry {
  const resolvedConfig: DisciplineRegistryConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let storage: IRegistryStorage<DisciplinePack>;

  if (resolvedConfig.storageType === 'file') {
    const fileStorageConfig: FileStorageConfig = {
      type: 'file',
      basePath: resolvedConfig.basePath ?? DEFAULT_CONFIG.basePath ?? './.wundr/registry',
      namespace: 'disciplines',
      fileExtension: '.json',
    };
    storage = new FileStorage<DisciplinePack>(fileStorageConfig);
  } else {
    storage = new MemoryStorage<DisciplinePack>();
  }

  return new DisciplineRegistry(storage);
}
