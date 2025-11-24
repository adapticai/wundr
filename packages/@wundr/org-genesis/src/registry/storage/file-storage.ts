/**
 * File-Based Storage Implementation
 *
 * Provides persistent storage for registry data using the filesystem.
 * Supports atomic writes, caching, and proper error handling.
 *
 * @packageDocumentation
 * @module @wundr/org-genesis/registry/storage/file-storage
 */

import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { StorageError } from './storage-interface.js';

import type { IRegistryStorage } from './storage-interface.js';

/**
 * Configuration options for file-based storage.
 *
 * Defines the settings for initializing a file storage instance,
 * including base path, namespace, and optional caching configuration.
 *
 * @example
 * ```typescript
 * const config: FileStorageConfig = {
 *   basePath: './.wundr/registry',
 *   namespace: 'agents',
 *   cacheEnabled: true,
 *   cacheTtlMs: 60000,
 *   fileExtension: '.json'
 * };
 * ```
 */
export interface FileStorageConfig {
  /**
   * Storage type identifier.
   * This field is optional and used for compatibility with generic storage configuration.
   * When provided, it should always be 'file' for FileStorage.
   */
  type?: 'file';

  /**
   * Base directory path for storing files.
   * The namespace will be appended to create the full storage path.
   */
  basePath: string;

  /**
   * Namespace for organizing stored items.
   * Used to partition data within the storage by creating a subdirectory.
   */
  namespace: string;

  /**
   * Whether to enable caching for read operations.
   * When enabled, items are cached in memory after being read.
   * @default false
   */
  cacheEnabled?: boolean;

  /**
   * Cache TTL (Time To Live) in milliseconds.
   * Cached items are invalidated after this duration.
   * Only applicable when cacheEnabled is true.
   * @default 60000 (1 minute)
   */
  cacheTtlMs?: number;

  /**
   * File extension for stored files.
   * @default '.json'
   */
  fileExtension?: string;
}

/**
 * Cache entry with timestamp for TTL management.
 */
interface CacheEntry<T> {
  /**
   * The cached value.
   */
  value: T;

  /**
   * Timestamp when the entry was cached.
   */
  timestamp: number;
}

/**
 * File-based storage implementation for registry data.
 *
 * Stores each item as a separate JSON file in a directory structure.
 * Supports atomic writes using temp files and rename operations.
 * Optionally provides in-memory caching for improved read performance.
 *
 * Directory structure:
 * ```
 * {basePath}/
 *   {namespace}/
 *     {item-id}.json
 *     {item-id}.json
 *     ...
 * ```
 *
 * @typeParam T - The type of items to store
 *
 * @example
 * ```typescript
 * // Create a file storage for agents
 * const storage = new FileStorage<Agent>({
 *   basePath: './.wundr/registry',
 *   namespace: 'agents',
 *   cacheEnabled: true
 * });
 *
 * // Store an agent
 * await storage.set('agent-001', {
 *   id: 'agent-001',
 *   name: 'Code Reviewer',
 *   type: 'agent'
 * });
 *
 * // Retrieve the agent
 * const agent = await storage.get('agent-001');
 * ```
 */
export class FileStorage<T> implements IRegistryStorage<T> {
  /**
   * Base path for storage files.
   */
  private readonly basePath: string;

  /**
   * Namespace for this storage instance.
   */
  private readonly namespace: string;

  /**
   * File extension for stored files.
   */
  private readonly fileExtension: string;

  /**
   * Optional in-memory cache for read performance.
   */
  private readonly cache: Map<string, CacheEntry<T>>;

  /**
   * Whether caching is enabled.
   */
  private readonly cacheEnabled: boolean;

  /**
   * Cache TTL in milliseconds.
   */
  private readonly cacheTtlMs: number;

  /**
   * Flag indicating if directory has been initialized.
   */
  private directoryInitialized: boolean = false;

  /**
   * Creates a new FileStorage instance.
   *
   * @param config - Configuration options for file storage
   *
   * @example
   * ```typescript
   * const storage = new FileStorage<Agent>({
   *   basePath: './.wundr/registry',
   *   namespace: 'agents',
   *   cacheEnabled: true,
   *   cacheTtlMs: 60000
   * });
   * ```
   */
  constructor(config: FileStorageConfig) {
    this.basePath = config.basePath;
    this.namespace = config.namespace;
    this.fileExtension = config.fileExtension ?? '.json';
    this.cacheEnabled = config.cacheEnabled ?? false;
    this.cacheTtlMs = config.cacheTtlMs ?? 60000;
    this.cache = new Map();
  }

  /**
   * Retrieves an item by its unique identifier.
   *
   * Checks the cache first if caching is enabled, then falls back
   * to reading from the filesystem.
   *
   * @param id - The unique identifier of the item to retrieve
   * @returns The stored value if found, or null if not present
   * @throws {StorageError} If the read operation fails
   *
   * @example
   * ```typescript
   * const agent = await storage.get('agent-001');
   * if (agent) {
   *   console.log('Found:', agent.name);
   * }
   * ```
   */
  async get(id: string): Promise<T | null> {
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getFromCache(id);
      if (cached !== null) {
        return cached;
      }
    }

    await this.ensureDirectory();
    const filePath = this.getFilePath(id);

    try {
      const content = await readFile(filePath, 'utf-8');
      const value = this.deserialize(content, id);

      // Update cache
      if (this.cacheEnabled) {
        this.setCache(id, value);
      }

      return value;
    } catch (error) {
      if (this.isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      throw new StorageError(
        'Failed to read item from storage',
        'get',
        id,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Stores or updates an item with atomic write support.
   *
   * Uses a write-to-temp-then-rename strategy to ensure atomic writes.
   * If the write fails, the original file (if any) remains intact.
   *
   * @param id - The unique identifier for the item
   * @param value - The value to store
   * @throws {StorageError} If the write operation fails
   *
   * @example
   * ```typescript
   * await storage.set('agent-001', {
   *   id: 'agent-001',
   *   name: 'Code Reviewer',
   *   type: 'agent'
   * });
   * ```
   */
  async set(id: string, value: T): Promise<void> {
    await this.ensureDirectory();

    const filePath = this.getFilePath(id);
    const tempPath = this.getTempFilePath(id);

    try {
      const content = this.serialize(value, id);

      // Write to temp file first (atomic write pattern)
      await writeFile(tempPath, content, 'utf-8');

      // Rename temp file to target (atomic operation on most filesystems)
      await rename(tempPath, filePath);

      // Update cache
      if (this.cacheEnabled) {
        this.setCache(id, value);
      }
    } catch (error) {
      // Attempt to clean up temp file on failure
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new StorageError(
        'Failed to write item to storage',
        'set',
        id,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Removes an item from storage.
   *
   * Deletes both the file and the cache entry (if caching is enabled).
   *
   * @param id - The unique identifier of the item to delete
   * @returns True if an item was deleted, false if it didn't exist
   * @throws {StorageError} If the delete operation fails
   *
   * @example
   * ```typescript
   * const deleted = await storage.delete('agent-001');
   * if (deleted) {
   *   console.log('Agent removed');
   * }
   * ```
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureDirectory();

    const filePath = this.getFilePath(id);

    // Remove from cache
    if (this.cacheEnabled) {
      this.cache.delete(id);
    }

    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      if (this.isNodeError(error) && error.code === 'ENOENT') {
        return false;
      }
      throw new StorageError(
        'Failed to delete item from storage',
        'delete',
        id,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Checks if an item exists in storage.
   *
   * Checks cache first if enabled, then falls back to filesystem check.
   *
   * @param id - The unique identifier to check
   * @returns True if an item exists with the given ID, false otherwise
   * @throws {StorageError} If the check operation fails
   *
   * @example
   * ```typescript
   * if (await storage.exists('agent-001')) {
   *   console.log('Agent exists');
   * }
   * ```
   */
  async exists(id: string): Promise<boolean> {
    // Check cache first
    if (this.cacheEnabled && this.getFromCache(id) !== null) {
      return true;
    }

    await this.ensureDirectory();
    const filePath = this.getFilePath(id);

    try {
      await readFile(filePath);
      return true;
    } catch (error) {
      if (this.isNodeError(error) && error.code === 'ENOENT') {
        return false;
      }
      throw new StorageError(
        'Failed to check existence of item',
        'exists',
        id,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Lists all stored items.
   *
   * Reads all files in the storage directory and deserializes them.
   * Results are not guaranteed to be in any particular order.
   *
   * @returns Array of all stored values
   * @throws {StorageError} If the list operation fails
   *
   * @example
   * ```typescript
   * const allAgents = await storage.list();
   * console.log(`Total agents: ${allAgents.length}`);
   * ```
   */
  async list(): Promise<T[]> {
    await this.ensureDirectory();
    const directoryPath = this.getDirectoryPath();

    try {
      const files = await readdir(directoryPath);
      const items: T[] = [];

      for (const file of files) {
        if (file.endsWith(this.fileExtension) && !file.startsWith('.')) {
          const id = this.getIdFromFilename(file);
          const item = await this.get(id);
          if (item !== null) {
            items.push(item);
          }
        }
      }

      return items;
    } catch (error) {
      if (this.isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw new StorageError(
        'Failed to list items from storage',
        'list',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Queries stored items using a predicate function.
   *
   * Loads all items and filters them using the provided predicate.
   * For large datasets, consider implementing a more efficient query mechanism.
   *
   * @param predicate - A function that takes an item and returns true if it should be included
   * @returns Array of items matching the predicate
   * @throws {StorageError} If the query operation fails
   *
   * @example
   * ```typescript
   * // Find all active agents
   * const activeAgents = await storage.query(
   *   (agent) => agent.status === 'active'
   * );
   * ```
   */
  async query(predicate: (item: T) => boolean): Promise<T[]> {
    const items = await this.list();
    return items.filter(predicate);
  }

  /**
   * Removes all items from storage.
   *
   * Deletes the entire storage directory and recreates it empty.
   * Also clears the in-memory cache if enabled.
   *
   * @throws {StorageError} If the clear operation fails
   *
   * @example
   * ```typescript
   * await storage.clear();
   * const remaining = await storage.list();
   * console.log(remaining.length); // 0
   * ```
   */
  async clear(): Promise<void> {
    const directoryPath = this.getDirectoryPath();

    // Clear cache
    if (this.cacheEnabled) {
      this.cache.clear();
    }

    try {
      // Remove directory recursively
      await rm(directoryPath, { recursive: true, force: true });
      // Reset initialization flag so directory will be recreated on next operation
      this.directoryInitialized = false;
    } catch (error) {
      throw new StorageError(
        'Failed to clear storage',
        'clear',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Gets the full directory path for this storage instance.
   *
   * @returns The full directory path
   */
  private getDirectoryPath(): string {
    return join(this.basePath, this.namespace);
  }

  /**
   * Gets the full file path for an item.
   *
   * @param id - The item identifier
   * @returns The full file path
   */
  private getFilePath(id: string): string {
    const safeId = this.sanitizeId(id);
    return join(this.getDirectoryPath(), `${safeId}${this.fileExtension}`);
  }

  /**
   * Gets a temporary file path for atomic writes.
   *
   * @param id - The item identifier
   * @returns The temporary file path
   */
  private getTempFilePath(id: string): string {
    const safeId = this.sanitizeId(id);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return join(this.getDirectoryPath(), `.${safeId}.${timestamp}.${random}.tmp`);
  }

  /**
   * Extracts the item ID from a filename.
   *
   * @param filename - The filename to parse
   * @returns The item ID
   */
  private getIdFromFilename(filename: string): string {
    return filename.slice(0, -this.fileExtension.length);
  }

  /**
   * Sanitizes an ID for use as a filename.
   *
   * Replaces characters that are not safe for filesystems.
   *
   * @param id - The ID to sanitize
   * @returns A filesystem-safe ID
   */
  private sanitizeId(id: string): string {
    // Replace unsafe filesystem characters with underscores
    // First replace common unsafe chars, then filter control characters via char code check
    let result = id.replace(/[<>:"/\\|?*]/g, '_');
    // Remove control characters (0x00-0x1f) by filtering
    result = result
      .split('')
      .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
      .join('');
    return result;
  }

  /**
   * Ensures the storage directory exists.
   *
   * Creates the directory recursively if it doesn't exist.
   * Only runs once per instance unless clear() is called.
   *
   * @throws {StorageError} If directory creation fails
   */
  private async ensureDirectory(): Promise<void> {
    if (this.directoryInitialized) {
      return;
    }

    const directoryPath = this.getDirectoryPath();

    try {
      await mkdir(directoryPath, { recursive: true });
      this.directoryInitialized = true;
    } catch (error) {
      throw new StorageError(
        `Failed to create storage directory: ${directoryPath}`,
        'init',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Serializes a value to JSON string.
   *
   * @param value - The value to serialize
   * @param id - The item ID (for error messages)
   * @returns The JSON string
   * @throws {StorageError} If serialization fails
   */
  private serialize(value: T, id: string): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      throw new StorageError(
        'Failed to serialize value',
        'set',
        id,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Deserializes a JSON string to a value.
   *
   * @param content - The JSON string to deserialize
   * @param id - The item ID (for error messages)
   * @returns The deserialized value
   * @throws {StorageError} If deserialization fails
   */
  private deserialize(content: string, id: string): T {
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new StorageError(
        'Failed to deserialize item',
        'get',
        id,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Gets a value from the cache if valid.
   *
   * @param id - The item ID
   * @returns The cached value or null if not found or expired
   */
  private getFromCache(id: string): T | null {
    const entry = this.cache.get(id);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(id);
      return null;
    }

    return entry.value;
  }

  /**
   * Sets a value in the cache.
   *
   * @param id - The item ID
   * @param value - The value to cache
   */
  private setCache(id: string, value: T): void {
    this.cache.set(id, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Type guard for Node.js error objects.
   *
   * @param error - The error to check
   * @returns True if the error is a Node.js error with a code property
   */
  private isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
  }
}
