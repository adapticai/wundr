/**
 * @genesis/core - Local Storage Service
 *
 * Service for managing local storage with support for IndexedDB (web)
 * and SQLite (mobile via Capacitor). Provides key-value storage,
 * bulk operations, and cache management.
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';
import {
  DEFAULT_LOCAL_STORAGE_CONFIG,
  type LocalStorageConfig,
  type StorageMetadata,
  type StoredItem,
  type StorageOptions,
  type StorageStats,
  type PruneResult,
} from '../types/offline';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown for local storage operations.
 */
export class LocalStorageError extends GenesisError {
  constructor(
    message: string,
    code: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, 500, metadata);
    this.name = 'LocalStorageError';
  }
}

/**
 * Error thrown when storage is not available.
 */
export class StorageUnavailableError extends LocalStorageError {
  constructor(backend: string) {
    super(
      `Storage backend '${backend}' is not available`,
      'STORAGE_UNAVAILABLE',
      { backend }
    );
    this.name = 'StorageUnavailableError';
  }
}

/**
 * Error thrown when storage quota is exceeded.
 */
export class StorageQuotaExceededError extends LocalStorageError {
  constructor(requiredSize: number, availableSize: number) {
    super(
      `Storage quota exceeded: required ${requiredSize} bytes, available ${availableSize} bytes`,
      'STORAGE_QUOTA_EXCEEDED',
      { requiredSize, availableSize }
    );
    this.name = 'StorageQuotaExceededError';
  }
}

/**
 * Error thrown when storage operation fails.
 */
export class StorageOperationError extends LocalStorageError {
  constructor(operation: string, key: string, originalError?: Error) {
    super(
      `Storage operation '${operation}' failed for key '${key}': ${originalError?.message ?? 'Unknown error'}`,
      'STORAGE_OPERATION_FAILED',
      { operation, key, originalError: originalError?.message }
    );
    this.name = 'StorageOperationError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for local storage operations.
 */
export interface LocalStorageService {
  /**
   * Gets a value by key.
   *
   * @param key - The storage key
   * @returns The stored value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Sets a value for a key.
   *
   * @param key - The storage key
   * @param value - The value to store
   * @param options - Storage options
   */
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;

  /**
   * Deletes a key.
   *
   * @param key - The storage key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Checks if a key exists.
   *
   * @param key - The storage key
   * @returns Whether the key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Gets multiple values by keys.
   *
   * @param keys - Array of storage keys
   * @returns Map of key to value
   */
  getMany<T>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Sets multiple key-value pairs.
   *
   * @param entries - Map of key to value
   * @param options - Storage options for all entries
   */
  setMany<T>(entries: Map<string, T>, options?: StorageOptions): Promise<void>;

  /**
   * Deletes multiple keys.
   *
   * @param keys - Array of storage keys to delete
   */
  deleteMany(keys: string[]): Promise<void>;

  /**
   * Gets all keys matching a prefix.
   *
   * @param prefix - Key prefix to match
   * @returns Array of matching keys
   */
  getKeys(prefix?: string): Promise<string[]>;

  /**
   * Gets the total size of the cache.
   *
   * @returns Cache size in bytes
   */
  getCacheSize(): Promise<number>;

  /**
   * Clears all stored data.
   */
  clearCache(): Promise<void>;

  /**
   * Removes data older than the specified age.
   *
   * @param maxAge - Maximum age in milliseconds
   * @returns Number of items removed
   */
  pruneOldData(maxAge: number): Promise<PruneResult>;

  /**
   * Removes expired items.
   *
   * @returns Prune result
   */
  pruneExpired(): Promise<PruneResult>;

  /**
   * Gets storage statistics.
   *
   * @returns Storage statistics
   */
  getStats(): Promise<StorageStats>;

  /**
   * Gets the item with metadata.
   *
   * @param key - The storage key
   * @returns The stored item with metadata or null
   */
  getWithMetadata<T>(key: string): Promise<StoredItem<T> | null>;

  /**
   * Initializes the storage backend.
   */
  initialize(): Promise<void>;

  /**
   * Closes the storage connection.
   */
  close(): Promise<void>;
}

// =============================================================================
// IndexedDB Storage Backend
// =============================================================================

/** IndexedDB store names */
const STORE_NAME = 'keyvalue';
const METADATA_STORE_NAME = 'metadata';

/**
 * IndexedDB-based storage backend.
 */
class IndexedDBStorageBackend {
  private db: IDBDatabase | null = null;
  private readonly config: LocalStorageConfig;

  constructor(config: LocalStorageConfig) {
    this.config = config;
  }

  /**
   * Opens the IndexedDB database.
   */
  async open(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new StorageUnavailableError('indexeddb');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => {
        reject(
          new LocalStorageError(
            `Failed to open IndexedDB: ${request.error?.message ?? 'Unknown error'}`,
            'INDEXEDDB_OPEN_FAILED'
          )
        );
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores if they don't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }

        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          const metaStore = db.createObjectStore(METADATA_STORE_NAME);
          metaStore.createIndex('expiresAt', 'expiresAt', { unique: false });
          metaStore.createIndex('storedAt', 'storedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Ensures the database is open.
   */
  private ensureOpen(): IDBDatabase {
    if (!this.db) {
      throw new LocalStorageError(
        'IndexedDB not initialized. Call initialize() first.',
        'INDEXEDDB_NOT_INITIALIZED'
      );
    }
    return this.db;
  }

  /**
   * Gets a value by key.
   */
  async get<T>(key: string): Promise<StoredItem<T> | null> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_NAME, METADATA_STORE_NAME],
        'readonly'
      );
      const store = transaction.objectStore(STORE_NAME);
      const metaStore = transaction.objectStore(METADATA_STORE_NAME);

      const valueRequest = store.get(key);
      const metaRequest = metaStore.get(key);

      transaction.onerror = () => {
        reject(
          new StorageOperationError('get', key, transaction.error ?? undefined)
        );
      };

      transaction.oncomplete = () => {
        if (valueRequest.result === undefined) {
          resolve(null);
          return;
        }

        const metadata = metaRequest.result as StorageMetadata | undefined;

        // Check if expired
        if (metadata?.expiresAt && new Date(metadata.expiresAt) < new Date()) {
          // Item is expired, delete it asynchronously
          this.delete(key).catch(() => {
            // Ignore deletion errors
          });
          resolve(null);
          return;
        }

        resolve({
          value: valueRequest.result as T,
          metadata: metadata ?? {
            storedAt: new Date(),
            version: 1,
            size: 0,
          },
        });
      };
    });
  }

  /**
   * Sets a value for a key.
   */
  async set<T>(
    key: string,
    value: T,
    metadata: StorageMetadata
  ): Promise<void> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_NAME, METADATA_STORE_NAME],
        'readwrite'
      );
      const store = transaction.objectStore(STORE_NAME);
      const metaStore = transaction.objectStore(METADATA_STORE_NAME);

      store.put(value, key);
      metaStore.put(metadata, key);

      transaction.onerror = () => {
        reject(
          new StorageOperationError('set', key, transaction.error ?? undefined)
        );
      };

      transaction.oncomplete = () => {
        resolve();
      };
    });
  }

  /**
   * Deletes a key.
   */
  async delete(key: string): Promise<void> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_NAME, METADATA_STORE_NAME],
        'readwrite'
      );
      const store = transaction.objectStore(STORE_NAME);
      const metaStore = transaction.objectStore(METADATA_STORE_NAME);

      store.delete(key);
      metaStore.delete(key);

      transaction.onerror = () => {
        reject(
          new StorageOperationError(
            'delete',
            key,
            transaction.error ?? undefined
          )
        );
      };

      transaction.oncomplete = () => {
        resolve();
      };
    });
  }

  /**
   * Checks if a key exists.
   */
  async has(key: string): Promise<boolean> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count(key);

      request.onerror = () => {
        reject(
          new StorageOperationError('has', key, request.error ?? undefined)
        );
      };

      request.onsuccess = () => {
        resolve(request.result > 0);
      };
    });
  }

  /**
   * Gets all keys.
   */
  async getAllKeys(): Promise<string[]> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => {
        reject(
          new LocalStorageError(
            `Failed to get all keys: ${request.error?.message ?? 'Unknown error'}`,
            'GET_ALL_KEYS_FAILED'
          )
        );
      };

      request.onsuccess = () => {
        resolve(request.result.map((k: IDBValidKey) => String(k)));
      };
    });
  }

  /**
   * Gets all metadata entries.
   */
  async getAllMetadata(): Promise<Map<string, StorageMetadata>> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE_NAME], 'readonly');
      const store = transaction.objectStore(METADATA_STORE_NAME);
      const request = store.openCursor();
      const result = new Map<string, StorageMetadata>();

      request.onerror = () => {
        reject(
          new LocalStorageError(
            `Failed to get all metadata: ${request.error?.message ?? 'Unknown error'}`,
            'GET_ALL_METADATA_FAILED'
          )
        );
      };

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          result.set(String(cursor.key), cursor.value as StorageMetadata);
          cursor.continue();
        } else {
          resolve(result);
        }
      };
    });
  }

  /**
   * Clears all data.
   */
  async clear(): Promise<void> {
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_NAME, METADATA_STORE_NAME],
        'readwrite'
      );
      const store = transaction.objectStore(STORE_NAME);
      const metaStore = transaction.objectStore(METADATA_STORE_NAME);

      store.clear();
      metaStore.clear();

      transaction.onerror = () => {
        reject(
          new LocalStorageError(
            `Failed to clear storage: ${transaction.error?.message ?? 'Unknown error'}`,
            'CLEAR_STORAGE_FAILED'
          )
        );
      };

      transaction.oncomplete = () => {
        resolve();
      };
    });
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// =============================================================================
// In-Memory Storage Backend (for testing and SSR)
// =============================================================================

/**
 * In-memory storage backend.
 */
class MemoryStorageBackend {
  private readonly store = new Map<string, unknown>();
  private readonly metadata = new Map<string, StorageMetadata>();

  async get<T>(key: string): Promise<StoredItem<T> | null> {
    const value = this.store.get(key);
    if (value === undefined) {
      return null;
    }

    const meta = this.metadata.get(key);

    // Check if expired
    if (meta?.expiresAt && new Date(meta.expiresAt) < new Date()) {
      await this.delete(key);
      return null;
    }

    return {
      value: value as T,
      metadata: meta ?? {
        storedAt: new Date(),
        version: 1,
        size: 0,
      },
    };
  }

  async set<T>(
    key: string,
    value: T,
    metadata: StorageMetadata
  ): Promise<void> {
    this.store.set(key, value);
    this.metadata.set(key, metadata);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async getAllMetadata(): Promise<Map<string, StorageMetadata>> {
    return new Map(this.metadata);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.metadata.clear();
  }

  close(): void {
    // No-op for memory backend
  }

  async open(): Promise<void> {
    // No-op for memory backend
  }
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Local storage service implementation.
 */
export class LocalStorageServiceImpl implements LocalStorageService {
  private readonly config: LocalStorageConfig;
  private backend: IndexedDBStorageBackend | MemoryStorageBackend | null = null;
  private initialized = false;

  /**
   * Creates a new LocalStorageServiceImpl instance.
   *
   * @param config - Storage configuration
   */
  constructor(config: Partial<LocalStorageConfig> = {}) {
    this.config = { ...DEFAULT_LOCAL_STORAGE_CONFIG, ...config };
  }

  /**
   * Initializes the storage backend.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.config.backend === 'indexeddb') {
      // Check if IndexedDB is available
      if (typeof indexedDB !== 'undefined') {
        this.backend = new IndexedDBStorageBackend(this.config);
        await this.backend.open();
      } else {
        // Fall back to memory backend
        this.backend = new MemoryStorageBackend();
        await this.backend.open();
      }
    } else if (this.config.backend === 'memory') {
      this.backend = new MemoryStorageBackend();
      await this.backend.open();
    } else {
      // SQLite support would be implemented here for mobile
      // For now, fall back to memory
      this.backend = new MemoryStorageBackend();
      await this.backend.open();
    }

    this.initialized = true;
  }

  /**
   * Ensures the backend is initialized.
   */
  private ensureInitialized(): IndexedDBStorageBackend | MemoryStorageBackend {
    if (!this.backend) {
      throw new LocalStorageError(
        'LocalStorageService not initialized. Call initialize() first.',
        'SERVICE_NOT_INITIALIZED'
      );
    }
    return this.backend;
  }

  /**
   * Gets a value by key.
   */
  async get<T>(key: string): Promise<T | null> {
    const backend = this.ensureInitialized();
    const item = await backend.get<T>(key);
    return item?.value ?? null;
  }

  /**
   * Gets a value with metadata.
   */
  async getWithMetadata<T>(key: string): Promise<StoredItem<T> | null> {
    const backend = this.ensureInitialized();
    return backend.get<T>(key);
  }

  /**
   * Sets a value for a key.
   */
  async set<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    const backend = this.ensureInitialized();

    const serialized = JSON.stringify(value);
    const size = new TextEncoder().encode(serialized).length;

    const metadata: StorageMetadata = {
      storedAt: new Date(),
      expiresAt: options.ttl ? new Date(Date.now() + options.ttl) : undefined,
      version: 1,
      size,
    };

    // Get existing metadata to increment version
    const existing = await backend.get<T>(key);
    if (existing) {
      metadata.version = existing.metadata.version + 1;
    }

    // Check quota if max size is configured
    if (this.config.maxStorageSize) {
      const currentSize = await this.getCacheSize();
      const availableSize =
        this.config.maxStorageSize -
        currentSize +
        (existing?.metadata.size ?? 0);

      if (size > availableSize) {
        throw new StorageQuotaExceededError(size, availableSize);
      }
    }

    await backend.set(key, value, metadata);
  }

  /**
   * Deletes a key.
   */
  async delete(key: string): Promise<void> {
    const backend = this.ensureInitialized();
    await backend.delete(key);
  }

  /**
   * Checks if a key exists.
   */
  async has(key: string): Promise<boolean> {
    const backend = this.ensureInitialized();
    return backend.has(key);
  }

  /**
   * Gets multiple values by keys.
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const backend = this.ensureInitialized();
    const result = new Map<string, T>();

    await Promise.all(
      keys.map(async key => {
        const item = await backend.get<T>(key);
        if (item !== null) {
          result.set(key, item.value);
        }
      })
    );

    return result;
  }

  /**
   * Sets multiple key-value pairs.
   */
  async setMany<T>(
    entries: Map<string, T>,
    options: StorageOptions = {}
  ): Promise<void> {
    const backend = this.ensureInitialized();

    const setPromises: Promise<void>[] = [];

    for (const [key, value] of entries) {
      const serialized = JSON.stringify(value);
      const size = new TextEncoder().encode(serialized).length;

      const metadata: StorageMetadata = {
        storedAt: new Date(),
        expiresAt: options.ttl ? new Date(Date.now() + options.ttl) : undefined,
        version: 1,
        size,
      };

      setPromises.push(backend.set(key, value, metadata));
    }

    await Promise.all(setPromises);
  }

  /**
   * Deletes multiple keys.
   */
  async deleteMany(keys: string[]): Promise<void> {
    const backend = this.ensureInitialized();
    await Promise.all(keys.map(key => backend.delete(key)));
  }

  /**
   * Gets all keys matching a prefix.
   */
  async getKeys(prefix?: string): Promise<string[]> {
    const backend = this.ensureInitialized();
    const allKeys = await backend.getAllKeys();

    if (!prefix) {
      return allKeys;
    }

    return allKeys.filter(key => key.startsWith(prefix));
  }

  /**
   * Gets the total cache size.
   */
  async getCacheSize(): Promise<number> {
    const backend = this.ensureInitialized();
    const metadata = await backend.getAllMetadata();

    let totalSize = 0;
    for (const meta of metadata.values()) {
      totalSize += meta.size;
    }

    return totalSize;
  }

  /**
   * Clears all stored data.
   */
  async clearCache(): Promise<void> {
    const backend = this.ensureInitialized();
    await backend.clear();
  }

  /**
   * Removes data older than the specified age.
   */
  async pruneOldData(maxAge: number): Promise<PruneResult> {
    const backend = this.ensureInitialized();
    const startTime = Date.now();

    const metadata = await backend.getAllMetadata();
    const cutoffDate = new Date(Date.now() - maxAge);

    const keysToDelete: string[] = [];
    let bytesFreed = 0;

    for (const [key, meta] of metadata) {
      if (new Date(meta.storedAt) < cutoffDate) {
        keysToDelete.push(key);
        bytesFreed += meta.size;
      }
    }

    await Promise.all(keysToDelete.map(key => backend.delete(key)));

    return {
      removedCount: keysToDelete.length,
      bytesFreed,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Removes expired items.
   */
  async pruneExpired(): Promise<PruneResult> {
    const backend = this.ensureInitialized();
    const startTime = Date.now();

    const metadata = await backend.getAllMetadata();
    const now = new Date();

    const keysToDelete: string[] = [];
    let bytesFreed = 0;

    for (const [key, meta] of metadata) {
      if (meta.expiresAt && new Date(meta.expiresAt) < now) {
        keysToDelete.push(key);
        bytesFreed += meta.size;
      }
    }

    await Promise.all(keysToDelete.map(key => backend.delete(key)));

    return {
      removedCount: keysToDelete.length,
      bytesFreed,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Gets storage statistics.
   */
  async getStats(): Promise<StorageStats> {
    const backend = this.ensureInitialized();

    const metadata = await backend.getAllMetadata();
    const now = new Date();

    let totalSize = 0;
    let expiredCount = 0;
    let oldestItemAt: Date | undefined;

    for (const meta of metadata.values()) {
      totalSize += meta.size;

      if (meta.expiresAt && new Date(meta.expiresAt) < now) {
        expiredCount++;
      }

      if (!oldestItemAt || new Date(meta.storedAt) < oldestItemAt) {
        oldestItemAt = new Date(meta.storedAt);
      }
    }

    const availableQuota = this.config.maxStorageSize;
    const usedPercentage = availableQuota
      ? (totalSize / availableQuota) * 100
      : 0;

    return {
      itemCount: metadata.size,
      totalSize,
      availableQuota,
      usedPercentage,
      expiredCount,
      oldestItemAt,
    };
  }

  /**
   * Closes the storage connection.
   */
  async close(): Promise<void> {
    if (this.backend) {
      this.backend.close();
      this.backend = null;
    }
    this.initialized = false;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new local storage service instance.
 *
 * @param config - Storage configuration
 * @returns Local storage service instance
 *
 * @example
 * ```typescript
 * const storageService = createLocalStorageService();
 * await storageService.initialize();
 *
 * // Store a value
 * await storageService.set('user:123', { name: 'John' }, { ttl: 3600000 });
 *
 * // Retrieve a value
 * const user = await storageService.get<{ name: string }>('user:123');
 *
 * // Clean up old data
 * const result = await storageService.pruneOldData(7 * 24 * 60 * 60 * 1000);
 * console.log(`Removed ${result.removedCount} items`);
 * ```
 */
export function createLocalStorageService(
  config: Partial<LocalStorageConfig> = {}
): LocalStorageServiceImpl {
  return new LocalStorageServiceImpl(config);
}

/**
 * Creates a memory-only storage service for testing.
 *
 * @returns Local storage service instance using memory backend
 */
export function createMemoryStorageService(): LocalStorageServiceImpl {
  return new LocalStorageServiceImpl({ backend: 'memory' });
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultStorageService: LocalStorageServiceImpl | null = null;

/**
 * Gets the default local storage service instance.
 * Creates one if it doesn't exist.
 *
 * @returns Local storage service instance
 */
export function getLocalStorageService(): LocalStorageServiceImpl {
  if (!defaultStorageService) {
    defaultStorageService = createLocalStorageService();
  }
  return defaultStorageService;
}

/**
 * Default local storage service instance.
 * Note: Call initialize() before using.
 */
export const localStorageService = getLocalStorageService();

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generates a unique storage key.
 *
 * @param prefix - Key prefix
 * @param parts - Additional key parts
 * @returns Generated key
 */
export function generateStorageKey(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join(':');
}

/**
 * Parses a storage key into its parts.
 *
 * @param key - The storage key
 * @returns Array of key parts
 */
export function parseStorageKey(key: string): string[] {
  return key.split(':');
}

/**
 * Creates a namespaced storage wrapper.
 *
 * @param service - The storage service
 * @param namespace - The namespace prefix
 * @returns Namespaced storage operations
 */
export function createNamespacedStorage(
  service: LocalStorageService,
  namespace: string
): {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, options?: StorageOptions) => Promise<void>;
  delete: (key: string) => Promise<void>;
  getKeys: () => Promise<string[]>;
  clear: () => Promise<void>;
} {
  const prefix = `${namespace}:`;

  return {
    get: <T>(key: string) => service.get<T>(`${prefix}${key}`),
    set: <T>(key: string, value: T, options?: StorageOptions) =>
      service.set(`${prefix}${key}`, value, options),
    delete: (key: string) => service.delete(`${prefix}${key}`),
    getKeys: async () => {
      const keys = await service.getKeys(prefix);
      return keys.map(k => k.slice(prefix.length));
    },
    clear: async () => {
      const keys = await service.getKeys(prefix);
      await service.deleteMany(keys);
    },
  };
}
