/**
 * @fileoverview Discipline Loader
 * @module @wundr/org-genesis/context-compiler/discipline-loader
 *
 * Loads and validates discipline definitions from configuration files,
 * resolving inheritance chains and merging role-specific configurations.
 * Supports loading from the registry or file system with caching capabilities.
 *
 * @packageDocumentation
 */

import * as fs from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';

import { validateDisciplinePack } from '../utils/validation.js';

import type { DisciplinePack, DisciplineCategory } from '../types/index.js';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base error class for discipline loader errors.
 *
 * @description
 * Provides a common base for all discipline-related errors with
 * additional context about the operation that failed.
 */
export class DisciplineLoaderError extends Error {
  /**
   * Creates a new DisciplineLoaderError.
   *
   * @param message - Human-readable error message
   * @param cause - Optional underlying error that caused this error
   */
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DisciplineLoaderError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when a discipline cannot be found.
 *
 * @description
 * Indicates that the requested discipline does not exist in the registry
 * or file system at the expected location.
 *
 * @example
 * ```typescript
 * throw new DisciplineNotFoundError('disc_eng_001', '/path/to/disciplines');
 * ```
 */
export class DisciplineNotFoundError extends DisciplineLoaderError {
  /**
   * Creates a new DisciplineNotFoundError.
   *
   * @param identifier - The ID or slug of the discipline that was not found
   * @param searchPath - The path that was searched
   */
  constructor(
    public readonly identifier: string,
    public readonly searchPath: string,
  ) {
    super(`Discipline not found: "${identifier}" in path "${searchPath}"`);
    this.name = 'DisciplineNotFoundError';
  }
}

/**
 * Error thrown when discipline validation fails.
 *
 * @description
 * Indicates that a discipline pack file was found but its contents
 * failed validation against the DisciplinePack schema.
 *
 * @example
 * ```typescript
 * throw new DisciplineValidationError('disc_eng_001', ['Missing required field: claudeMd']);
 * ```
 */
export class DisciplineValidationError extends DisciplineLoaderError {
  /**
   * Creates a new DisciplineValidationError.
   *
   * @param disciplineId - The ID of the discipline that failed validation
   * @param validationErrors - Array of validation error messages
   */
  constructor(
    public readonly disciplineId: string,
    public readonly validationErrors: string[],
  ) {
    super(
      `Discipline "${disciplineId}" validation failed: ${validationErrors.join('; ')}`,
    );
    this.name = 'DisciplineValidationError';
  }
}

/**
 * Error thrown when the discipline file cannot be parsed.
 *
 * @description
 * Indicates that a discipline pack file exists but could not be parsed
 * as valid JSON.
 */
export class DisciplineParseError extends DisciplineLoaderError {
  /**
   * Creates a new DisciplineParseError.
   *
   * @param filePath - The path to the file that failed to parse
   * @param cause - The underlying parse error
   */
  constructor(
    public readonly filePath: string,
    cause: Error,
  ) {
    super(`Failed to parse discipline file "${filePath}": ${cause.message}`, cause);
    this.name = 'DisciplineParseError';
  }
}

/**
 * Error thrown when file system operations fail.
 *
 * @description
 * Indicates a file system error occurred during discipline loading,
 * such as permission denied or disk errors.
 */
export class DisciplineFileSystemError extends DisciplineLoaderError {
  /**
   * Creates a new DisciplineFileSystemError.
   *
   * @param operation - The operation that failed (e.g., 'read', 'list')
   * @param filePath - The path involved in the failed operation
   * @param cause - The underlying file system error
   */
  constructor(
    public readonly operation: string,
    public readonly filePath: string,
    cause: Error,
  ) {
    super(
      `File system error during "${operation}" on "${filePath}": ${cause.message}`,
      cause,
    );
    this.name = 'DisciplineFileSystemError';
  }
}

// =============================================================================
// Configuration Interface
// =============================================================================

/**
 * Configuration options for the DisciplineLoader.
 *
 * @description
 * Defines the configuration parameters that control how disciplines
 * are loaded, cached, and validated.
 *
 * @example
 * ```typescript
 * const config: DisciplineLoaderConfig = {
 *   basePath: '/custom/path/to/disciplines',
 *   cacheEnabled: true,
 *   validateOnLoad: true,
 * };
 * ```
 */
export interface DisciplineLoaderConfig {
  /**
   * Base directory path where discipline files are stored.
   * Each discipline is expected to be in its own subdirectory.
   *
   * @default ~/.wundr/disciplines
   *
   * @example '/home/user/.wundr/disciplines'
   */
  basePath?: string;

  /**
   * Whether to cache loaded disciplines in memory.
   * When enabled, subsequent loads of the same discipline return the cached version.
   *
   * @default true
   */
  cacheEnabled?: boolean;

  /**
   * Whether to validate discipline data against the schema on load.
   * When enabled, invalid disciplines will throw DisciplineValidationError.
   *
   * @default true
   */
  validateOnLoad?: boolean;
}

/**
 * Default configuration values for DisciplineLoader.
 */
const DEFAULT_CONFIG: Required<DisciplineLoaderConfig> = {
  basePath: path.join(homedir(), '.wundr', 'disciplines'),
  cacheEnabled: true,
  validateOnLoad: true,
};

// =============================================================================
// DisciplineLoader Class
// =============================================================================

/**
 * Loads discipline packs from the registry or file system.
 *
 * @description
 * The DisciplineLoader provides a unified interface for loading discipline
 * configurations from the file system. It supports caching, validation,
 * and various lookup methods (by ID, slug, or category).
 *
 * Discipline files are expected to be stored as JSON files in the format:
 * `{basePath}/{discipline-slug}/discipline.json`
 *
 * @example
 * ```typescript
 * const loader = new DisciplineLoader({
 *   basePath: '/path/to/disciplines',
 *   cacheEnabled: true,
 * });
 *
 * // Load by ID
 * const discipline = await loader.loadById('disc_eng_001');
 *
 * // Load by slug
 * const discipline = await loader.loadBySlug('software-engineering');
 *
 * // Load all engineering disciplines
 * const engineeringDisciplines = await loader.loadByCategory('engineering');
 *
 * // Force reload from disk
 * const refreshed = await loader.reload('disc_eng_001');
 * ```
 */
export class DisciplineLoader {
  /**
   * In-memory cache of loaded disciplines.
   * Key is the discipline ID.
   */
  private readonly disciplineCache: Map<string, DisciplinePack>;

  /**
   * Index mapping slugs to discipline IDs.
   * Populated as disciplines are loaded.
   */
  private readonly slugIndex: Map<string, string>;

  /**
   * Base path where discipline files are stored.
   */
  private readonly basePath: string;

  /**
   * Whether caching is enabled.
   */
  private readonly cacheEnabled: boolean;

  /**
   * Whether validation is performed on load.
   */
  private readonly validateOnLoad: boolean;

  /**
   * Creates a new DisciplineLoader instance.
   *
   * @param config - Optional configuration options
   *
   * @example
   * ```typescript
   * // Use default configuration
   * const loader = new DisciplineLoader();
   *
   * // Custom configuration
   * const loader = new DisciplineLoader({
   *   basePath: '/custom/disciplines',
   *   cacheEnabled: false,
   * });
   * ```
   */
  constructor(config?: DisciplineLoaderConfig) {
    const resolvedConfig = { ...DEFAULT_CONFIG, ...config };

    this.basePath = resolvedConfig.basePath;
    this.cacheEnabled = resolvedConfig.cacheEnabled;
    this.validateOnLoad = resolvedConfig.validateOnLoad;
    this.disciplineCache = new Map();
    this.slugIndex = new Map();
  }

  /**
   * Load a discipline by its unique ID.
   *
   * @description
   * Loads a discipline pack from the file system or cache using its unique identifier.
   * The discipline is expected to be stored at `{basePath}/{slug}/discipline.json`.
   *
   * @param id - The unique discipline ID (e.g., 'disc_eng_001')
   * @returns Promise resolving to the loaded DisciplinePack
   *
   * @throws {DisciplineNotFoundError} If the discipline does not exist
   * @throws {DisciplineValidationError} If validation is enabled and the discipline is invalid
   * @throws {DisciplineParseError} If the discipline file cannot be parsed
   * @throws {DisciplineFileSystemError} If a file system error occurs
   *
   * @example
   * ```typescript
   * const discipline = await loader.loadById('disc_eng_001');
   * console.log(discipline.name); // 'Software Engineering'
   * ```
   */
  async loadById(id: string): Promise<DisciplinePack> {
    // Check cache first
    if (this.cacheEnabled && this.disciplineCache.has(id)) {
      return this.disciplineCache.get(id)!;
    }

    // Search for the discipline in the file system
    const discipline = await this.findDisciplineById(id);

    // Cache if enabled
    if (this.cacheEnabled) {
      this.disciplineCache.set(discipline.id, discipline);
      this.slugIndex.set(discipline.slug, discipline.id);
    }

    return discipline;
  }

  /**
   * Load a discipline by its URL-safe slug.
   *
   * @description
   * Loads a discipline pack using its slug for lookup. This is useful when
   * working with URLs or file paths where the full ID is not available.
   *
   * @param slug - The discipline slug (e.g., 'software-engineering')
   * @returns Promise resolving to the loaded DisciplinePack
   *
   * @throws {DisciplineNotFoundError} If the discipline does not exist
   * @throws {DisciplineValidationError} If validation is enabled and the discipline is invalid
   * @throws {DisciplineParseError} If the discipline file cannot be parsed
   * @throws {DisciplineFileSystemError} If a file system error occurs
   *
   * @example
   * ```typescript
   * const discipline = await loader.loadBySlug('software-engineering');
   * console.log(discipline.id); // 'disc_eng_001'
   * ```
   */
  async loadBySlug(slug: string): Promise<DisciplinePack> {
    // Check slug index for cached ID
    if (this.cacheEnabled && this.slugIndex.has(slug)) {
      const id = this.slugIndex.get(slug)!;
      return this.loadById(id);
    }

    // Try to load directly from slug path
    const disciplinePath = path.join(this.basePath, slug, 'discipline.json');
    const discipline = await this.loadFromFile(disciplinePath, slug);

    // Cache if enabled
    if (this.cacheEnabled) {
      this.disciplineCache.set(discipline.id, discipline);
      this.slugIndex.set(discipline.slug, discipline.id);
    }

    return discipline;
  }

  /**
   * Load all disciplines belonging to a specific category.
   *
   * @description
   * Scans all disciplines and returns those matching the specified category.
   * Useful for filtering disciplines by functional area (engineering, legal, etc.).
   *
   * @param category - The discipline category to filter by
   * @returns Promise resolving to an array of matching DisciplinePacks
   *
   * @throws {DisciplineFileSystemError} If a file system error occurs during scanning
   *
   * @example
   * ```typescript
   * const engineeringDisciplines = await loader.loadByCategory('engineering');
   * console.log(engineeringDisciplines.length); // 5
   * ```
   */
  async loadByCategory(category: DisciplineCategory): Promise<DisciplinePack[]> {
    const allDisciplines = await this.loadAll();
    return allDisciplines.filter((d) => d.category === category);
  }

  /**
   * Load all available disciplines.
   *
   * @description
   * Scans the base path directory and loads all valid discipline packs.
   * Invalid or unreadable disciplines are skipped with a warning logged.
   *
   * @returns Promise resolving to an array of all loaded DisciplinePacks
   *
   * @throws {DisciplineFileSystemError} If the base directory cannot be read
   *
   * @example
   * ```typescript
   * const allDisciplines = await loader.loadAll();
   * console.log(`Loaded ${allDisciplines.length} disciplines`);
   * ```
   */
  async loadAll(): Promise<DisciplinePack[]> {
    const disciplines: DisciplinePack[] = [];

    // Ensure base path exists
    try {
      await fs.access(this.basePath);
    } catch {
      // Base path doesn't exist, return empty array
      return disciplines;
    }

    // List all directories in base path
    let entries: string[];
    try {
      entries = await fs.readdir(this.basePath);
    } catch (error) {
      throw new DisciplineFileSystemError(
        'readdir',
        this.basePath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Load each discipline directory
    for (const entry of entries) {
      const entryPath = path.join(this.basePath, entry);

      try {
        const stat = await fs.stat(entryPath);
        if (!stat.isDirectory()) {
          continue;
        }

        const disciplinePath = path.join(entryPath, 'discipline.json');

        try {
          await fs.access(disciplinePath);
        } catch {
          // No discipline.json in this directory, skip
          continue;
        }

        try {
          const discipline = await this.loadBySlug(entry);
          disciplines.push(discipline);
        } catch (error) {
          // Log warning but continue loading other disciplines
          console.warn(
            `Warning: Failed to load discipline from "${entry}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } catch (error) {
        // Failed to stat entry, skip
        console.warn(
          `Warning: Failed to access "${entry}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return disciplines;
  }

  /**
   * Force reload a discipline from disk, bypassing the cache.
   *
   * @description
   * Clears the cached version (if any) and reloads the discipline from
   * the file system. Useful when you know the file has been updated.
   *
   * @param id - The unique discipline ID to reload
   * @returns Promise resolving to the freshly loaded DisciplinePack
   *
   * @throws {DisciplineNotFoundError} If the discipline does not exist
   * @throws {DisciplineValidationError} If validation is enabled and the discipline is invalid
   * @throws {DisciplineParseError} If the discipline file cannot be parsed
   * @throws {DisciplineFileSystemError} If a file system error occurs
   *
   * @example
   * ```typescript
   * // After external changes to the discipline file
   * const refreshed = await loader.reload('disc_eng_001');
   * ```
   */
  async reload(id: string): Promise<DisciplinePack> {
    // Remove from cache
    if (this.disciplineCache.has(id)) {
      const cached = this.disciplineCache.get(id)!;
      this.slugIndex.delete(cached.slug);
      this.disciplineCache.delete(id);
    }

    // Load fresh from disk
    return this.loadById(id);
  }

  /**
   * Clear all cached disciplines.
   *
   * @description
   * Removes all disciplines from the in-memory cache. Subsequent loads
   * will read from the file system.
   *
   * @example
   * ```typescript
   * loader.clearCache();
   * // All subsequent loads will read from disk
   * ```
   */
  clearCache(): void {
    this.disciplineCache.clear();
    this.slugIndex.clear();
  }

  /**
   * Check if a discipline exists.
   *
   * @description
   * Checks if a discipline with the given ID exists in the cache or file system.
   * Does not load or validate the full discipline.
   *
   * @param id - The unique discipline ID to check
   * @returns Promise resolving to true if the discipline exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await loader.exists('disc_eng_001')) {
   *   const discipline = await loader.loadById('disc_eng_001');
   * }
   * ```
   */
  async exists(id: string): Promise<boolean> {
    // Check cache first
    if (this.disciplineCache.has(id)) {
      return true;
    }

    // Try to find in file system
    try {
      await this.findDisciplineById(id);
      return true;
    } catch (error) {
      if (error instanceof DisciplineNotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if a discipline exists by slug.
   *
   * @description
   * Checks if a discipline with the given slug exists in the cache or file system.
   *
   * @param slug - The discipline slug to check
   * @returns Promise resolving to true if the discipline exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await loader.existsBySlug('software-engineering')) {
   *   const discipline = await loader.loadBySlug('software-engineering');
   * }
   * ```
   */
  async existsBySlug(slug: string): Promise<boolean> {
    // Check slug index first
    if (this.slugIndex.has(slug)) {
      return true;
    }

    // Check file system
    const disciplinePath = path.join(this.basePath, slug, 'discipline.json');
    try {
      await fs.access(disciplinePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the number of cached disciplines.
   *
   * @returns The number of disciplines currently in the cache
   *
   * @example
   * ```typescript
   * console.log(`${loader.cacheSize} disciplines cached`);
   * ```
   */
  get cacheSize(): number {
    return this.disciplineCache.size;
  }

  /**
   * Get the base path where disciplines are stored.
   *
   * @returns The configured base path for discipline files
   *
   * @example
   * ```typescript
   * console.log(`Disciplines stored at: ${loader.disciplinesPath}`);
   * ```
   */
  get disciplinesPath(): string {
    return this.basePath;
  }

  /**
   * Get all cached discipline IDs.
   *
   * @returns Array of discipline IDs currently in the cache
   *
   * @example
   * ```typescript
   * const cachedIds = loader.cachedIds;
   * console.log(`Cached: ${cachedIds.join(', ')}`);
   * ```
   */
  get cachedIds(): string[] {
    return Array.from(this.disciplineCache.keys());
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Find a discipline by ID in the file system.
   *
   * @param id - The discipline ID to find
   * @returns Promise resolving to the loaded DisciplinePack
   *
   * @throws {DisciplineNotFoundError} If the discipline cannot be found
   * @throws {DisciplineFileSystemError} If a file system error occurs
   */
  private async findDisciplineById(id: string): Promise<DisciplinePack> {
    // Ensure base path exists
    try {
      await fs.access(this.basePath);
    } catch {
      throw new DisciplineNotFoundError(id, this.basePath);
    }

    // List all directories and search for matching ID
    let entries: string[];
    try {
      entries = await fs.readdir(this.basePath);
    } catch (error) {
      throw new DisciplineFileSystemError(
        'readdir',
        this.basePath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    for (const entry of entries) {
      const disciplinePath = path.join(this.basePath, entry, 'discipline.json');

      try {
        await fs.access(disciplinePath);
      } catch {
        continue;
      }

      try {
        const discipline = await this.loadFromFile(disciplinePath, entry);
        if (discipline.id === id) {
          return discipline;
        }
      } catch {
        // Skip invalid disciplines while searching
        continue;
      }
    }

    throw new DisciplineNotFoundError(id, this.basePath);
  }

  /**
   * Load a discipline from a specific file path.
   *
   * @param filePath - The path to the discipline.json file
   * @param identifier - Identifier used for error messages (ID or slug)
   * @returns Promise resolving to the loaded DisciplinePack
   *
   * @throws {DisciplineNotFoundError} If the file does not exist
   * @throws {DisciplineParseError} If the file cannot be parsed
   * @throws {DisciplineValidationError} If validation fails
   */
  private async loadFromFile(
    filePath: string,
    identifier: string,
  ): Promise<DisciplinePack> {
    // Read file contents
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new DisciplineNotFoundError(identifier, filePath);
      }
      throw new DisciplineFileSystemError(
        'read',
        filePath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new DisciplineParseError(
        filePath,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Convert date strings to Date objects if needed
    const processedData = this.processDateFields(data);

    // Validate if enabled
    if (this.validateOnLoad) {
      try {
        return validateDisciplinePack(processedData);
      } catch (error) {
        if (error instanceof Error && 'errors' in error) {
          const validationError = error as {
            errors: { errors: Array<{ path: string[]; message: string }> };
          };
          const errorMessages = validationError.errors.errors.map(
            (e) => `${e.path.join('.')}: ${e.message}`,
          );
          throw new DisciplineValidationError(identifier, errorMessages);
        }
        throw new DisciplineValidationError(identifier, [error instanceof Error ? error.message : String(error)]);
      }
    }

    // Return without validation
    return processedData as DisciplinePack;
  }

  /**
   * Process date fields in the data, converting strings to Date objects.
   *
   * @param data - The parsed JSON data
   * @returns The data with date fields converted to Date objects
   */
  private processDateFields(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = { ...obj };

    // Convert known date fields
    if (typeof result['createdAt'] === 'string') {
      result['createdAt'] = new Date(result['createdAt']);
    }
    if (typeof result['updatedAt'] === 'string') {
      result['updatedAt'] = new Date(result['updatedAt']);
    }

    return result;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new DisciplineLoader instance.
 *
 * @description
 * Factory function for creating DisciplineLoader instances.
 * Provides a convenient way to create loaders without using `new`.
 *
 * @param config - Optional configuration options
 * @returns A new DisciplineLoader instance
 *
 * @example
 * ```typescript
 * // Create with default configuration
 * const loader = createDisciplineLoader();
 *
 * // Create with custom configuration
 * const loader = createDisciplineLoader({
 *   basePath: '/custom/path',
 *   cacheEnabled: false,
 * });
 * ```
 */
export function createDisciplineLoader(
  config?: DisciplineLoaderConfig,
): DisciplineLoader {
  return new DisciplineLoader(config);
}

// =============================================================================
// Exports
// =============================================================================

// Note: DisciplinePack and DisciplineCategory are imported from types module
// They should be accessed via '../types/index.js', not re-exported here
