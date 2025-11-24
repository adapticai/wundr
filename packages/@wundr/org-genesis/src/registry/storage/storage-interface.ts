/**
 * @packageDocumentation
 * Storage interface definitions for the registry module.
 *
 * This module defines the contract that all storage implementations must follow,
 * enabling interchangeable storage backends (memory, file, database, etc.).
 *
 * @module @wundr/org-genesis/registry/storage/storage-interface
 */

/**
 * Generic storage interface for registry data persistence.
 *
 * Defines the contract for all storage implementations, allowing the registry
 * to work with different backends (in-memory, file-based, database, etc.)
 * without changing the core registry logic.
 *
 * All methods are async to support both synchronous (memory) and asynchronous
 * (file I/O, network) storage backends uniformly.
 *
 * @typeParam T - The type of values stored in the storage
 *
 * @example
 * ```typescript
 * // Using a storage implementation
 * const storage: IRegistryStorage<Agent> = new MemoryStorage<Agent>();
 *
 * // Basic CRUD operations
 * await storage.set('agent-001', agent);
 * const retrieved = await storage.get('agent-001');
 * await storage.delete('agent-001');
 * ```
 */
export interface IRegistryStorage<T> {
  /**
   * Retrieves a value by its unique identifier.
   *
   * @param id - The unique identifier of the item to retrieve
   * @returns The stored value if found, or null if not present
   *
   * @example
   * ```typescript
   * const agent = await storage.get('agent-001');
   * if (agent) {
   *   console.log('Found:', agent.name);
   * } else {
   *   console.log('Agent not found');
   * }
   * ```
   */
  get(id: string): Promise<T | null>;

  /**
   * Stores or updates a value with the given identifier.
   *
   * If an item with the same ID exists, it will be overwritten.
   * If the ID is new, a new entry will be created.
   *
   * @param id - The unique identifier for the item
   * @param value - The value to store
   *
   * @example
   * ```typescript
   * await storage.set('agent-001', {
   *   id: 'agent-001',
   *   name: 'Code Reviewer',
   *   // ... other properties
   * });
   * ```
   */
  set(id: string, value: T): Promise<void>;

  /**
   * Removes an item from storage by its identifier.
   *
   * @param id - The unique identifier of the item to delete
   * @returns True if an item was deleted, false if no item existed with that ID
   *
   * @example
   * ```typescript
   * const wasDeleted = await storage.delete('agent-001');
   * if (wasDeleted) {
   *   console.log('Agent removed');
   * } else {
   *   console.log('Agent did not exist');
   * }
   * ```
   */
  delete(id: string): Promise<boolean>;

  /**
   * Checks if an item exists in storage.
   *
   * @param id - The unique identifier to check
   * @returns True if an item exists with the given ID, false otherwise
   *
   * @example
   * ```typescript
   * if (await storage.exists('agent-001')) {
   *   console.log('Agent exists');
   * }
   * ```
   */
  exists(id: string): Promise<boolean>;

  /**
   * Returns all stored values as an array.
   *
   * The order of items in the returned array is not guaranteed.
   * For large datasets, consider using `query` with pagination instead.
   *
   * @returns Array of all stored values
   *
   * @example
   * ```typescript
   * const allAgents = await storage.list();
   * console.log(`Total agents: ${allAgents.length}`);
   * ```
   */
  list(): Promise<T[]>;

  /**
   * Queries stored items using a predicate function.
   *
   * Iterates through all stored items and returns those for which
   * the predicate returns true. Useful for filtering and searching.
   *
   * @param predicate - A function that takes an item and returns true if it should be included
   * @returns Array of items matching the predicate
   *
   * @example
   * ```typescript
   * // Find all active agents
   * const activeAgents = await storage.query(
   *   (agent) => agent.status === 'active'
   * );
   *
   * // Find agents by name pattern
   * const reviewers = await storage.query(
   *   (agent) => agent.name.toLowerCase().includes('reviewer')
   * );
   * ```
   */
  query(predicate: (item: T) => boolean): Promise<T[]>;

  /**
   * Removes all items from storage.
   *
   * This is a destructive operation that cannot be undone.
   * Use with caution in production environments.
   *
   * @example
   * ```typescript
   * await storage.clear();
   * const remaining = await storage.list();
   * console.log(remaining.length); // 0
   * ```
   */
  clear(): Promise<void>;
}

/**
 * Configuration options for registry storage backends.
 *
 * Defines the settings for initializing a storage instance,
 * including the backend type and any type-specific options.
 *
 * @example
 * ```typescript
 * // File-based storage configuration
 * const fileConfig: StorageConfig = {
 *   type: 'file',
 *   basePath: './.wundr/registry',
 *   namespace: 'agents'
 * };
 *
 * // In-memory storage configuration (for testing)
 * const memoryConfig: StorageConfig = {
 *   type: 'memory',
 *   namespace: 'test-agents'
 * };
 * ```
 */
export interface StorageConfig {
  /**
   * The storage backend type.
   *
   * - `file`: Persists data to the filesystem as JSON files.
   *   Suitable for development and single-instance deployments.
   * - `memory`: Stores data in-memory only.
   *   Data is lost when the process exits. Ideal for testing.
   */
  type: 'file' | 'memory';

  /**
   * Base directory path for file storage.
   *
   * Only applicable when `type` is `'file'`.
   * The directory will be created if it doesn't exist.
   *
   * @default './.wundr/registry'
   */
  basePath?: string;

  /**
   * Optional namespace for isolating storage data.
   *
   * When provided, creates a logical separation within the storage backend.
   * For file storage, this creates a subdirectory.
   * For memory storage, this prefixes keys.
   *
   * Useful for multi-tenant scenarios or separating different entity types.
   *
   * @example
   * ```typescript
   * // Creates storage at './.wundr/registry/agents/'
   * { type: 'file', basePath: './.wundr/registry', namespace: 'agents' }
   * ```
   */
  namespace?: string;
}

/**
 * Custom error class for storage-related errors.
 *
 * Thrown when storage operations fail due to I/O errors, permission issues,
 * serialization problems, or other storage-specific failures.
 *
 * Extends the standard Error class with additional context about the failed operation.
 *
 * @example
 * ```typescript
 * try {
 *   await storage.set('agent-001', agent);
 * } catch (error) {
 *   if (error instanceof StorageError) {
 *     console.error(`Storage operation failed: ${error.message}`);
 *     console.error(`Operation: ${error.operation}`);
 *     if (error.cause) {
 *       console.error(`Caused by: ${error.cause.message}`);
 *     }
 *   }
 *   throw error;
 * }
 * ```
 */
export class StorageError extends Error {
  /**
   * The name of the error type.
   * Always set to 'StorageError' for error identification.
   */
  public override readonly name = 'StorageError';

  /**
   * The storage operation that failed.
   *
   * One of: 'get', 'set', 'delete', 'exists', 'list', 'query', 'clear', 'init'
   */
  public readonly operation: string;

  /**
   * Optional identifier of the item involved in the failed operation.
   */
  public readonly itemId?: string;

  /**
   * The underlying error that caused this storage error, if any.
   */
  public readonly cause?: Error;

  /**
   * Creates a new StorageError instance.
   *
   * @param message - Human-readable description of the error
   * @param operation - The storage operation that failed
   * @param itemId - Optional identifier of the item involved
   * @param cause - Optional underlying error that caused this error
   *
   * @example
   * ```typescript
   * throw new StorageError(
   *   'Failed to write agent to disk',
   *   'set',
   *   'agent-001',
   *   ioError
   * );
   * ```
   */
  constructor(message: string, operation: string, itemId?: string, cause?: Error) {
    super(message);
    this.operation = operation;
    this.itemId = itemId;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StorageError);
    }

    // Ensure prototype chain is properly set for instanceof checks
    Object.setPrototypeOf(this, StorageError.prototype);
  }

  /**
   * Returns a detailed string representation of the error.
   *
   * @returns Formatted error string including operation and item details
   */
  public override toString(): string {
    let result = `${this.name}: ${this.message} (operation: ${this.operation}`;
    if (this.itemId) {
      result += `, itemId: ${this.itemId}`;
    }
    result += ')';
    if (this.cause) {
      result += `\nCaused by: ${this.cause.message}`;
    }
    return result;
  }

  /**
   * Converts the error to a plain object for serialization.
   *
   * Useful for logging and error reporting systems.
   *
   * @returns Plain object representation of the error
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      operation: this.operation,
      itemId: this.itemId,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }
}
