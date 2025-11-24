/**
 * @packageDocumentation
 * In-memory storage implementation for the registry.
 *
 * Provides a fast, simple storage backend using JavaScript's Map data structure.
 * Ideal for development, testing, and scenarios where persistence across
 * restarts is not required.
 *
 * @module @wundr/org-genesis/registry/storage/memory-storage
 */

import type { IRegistryStorage } from './storage-interface.js';

/**
 * In-memory implementation of the registry storage interface.
 *
 * Uses a JavaScript Map for O(1) key lookups and efficient iteration.
 * Data is stored only in memory and will be lost when the process ends.
 *
 * This implementation is thread-safe for single-threaded JavaScript execution
 * but does not provide atomic operations for concurrent access scenarios.
 *
 * @typeParam T - The type of values stored in the storage
 *
 * @example
 * ```typescript
 * // Create a memory storage for agents
 * const agentStorage = new MemoryStorage<Agent>();
 *
 * // Store an agent
 * await agentStorage.set('agent-001', {
 *   id: 'agent-001',
 *   name: 'Code Reviewer',
 *   type: 'agent',
 *   // ... other properties
 * });
 *
 * // Retrieve the agent
 * const agent = await agentStorage.get('agent-001');
 *
 * // Query agents by criteria
 * const reviewers = await agentStorage.query(
 *   (a) => a.name.includes('Reviewer')
 * );
 * ```
 */
export class MemoryStorage<T> implements IRegistryStorage<T> {
  /**
   * Internal Map storing the key-value pairs.
   * Keys are string identifiers, values are of type T.
   */
  private readonly store: Map<string, T>;

  /**
   * Creates a new MemoryStorage instance.
   *
   * Initializes an empty Map for storing data.
   *
   * @example
   * ```typescript
   * const storage = new MemoryStorage<User>();
   * ```
   */
  constructor() {
    this.store = new Map<string, T>();
  }

  /**
   * Retrieves a value by its unique identifier.
   *
   * Time complexity: O(1)
   *
   * @param id - The unique identifier of the item to retrieve
   * @returns The stored value if found, or null if not present
   *
   * @example
   * ```typescript
   * const agent = await storage.get('agent-001');
   * if (agent !== null) {
   *   console.log('Found:', agent.name);
   * }
   * ```
   */
  async get(id: string): Promise<T | null> {
    const value = this.store.get(id);
    return value ?? null;
  }

  /**
   * Stores or updates a value with the given identifier.
   *
   * Time complexity: O(1)
   *
   * If an item with the same ID exists, it will be overwritten.
   * If the ID is new, a new entry will be created.
   *
   * @param id - The unique identifier for the item
   * @param value - The value to store
   *
   * @example
   * ```typescript
   * await storage.set('agent-001', myAgent);
   * ```
   */
  async set(id: string, value: T): Promise<void> {
    this.store.set(id, value);
  }

  /**
   * Removes an item from storage by its identifier.
   *
   * Time complexity: O(1)
   *
   * @param id - The unique identifier of the item to delete
   * @returns True if an item was deleted, false if no item existed with that ID
   *
   * @example
   * ```typescript
   * const wasDeleted = await storage.delete('agent-001');
   * console.log(wasDeleted ? 'Removed' : 'Not found');
   * ```
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * Checks if an item exists in storage.
   *
   * Time complexity: O(1)
   *
   * @param id - The unique identifier to check
   * @returns True if an item exists with the given ID, false otherwise
   *
   * @example
   * ```typescript
   * if (await storage.exists('agent-001')) {
   *   // Agent exists, safe to proceed
   * }
   * ```
   */
  async exists(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  /**
   * Returns all stored values as an array.
   *
   * Time complexity: O(n) where n is the number of stored items
   *
   * The order of items corresponds to their insertion order
   * (Map iteration order in JavaScript).
   *
   * @returns Array of all stored values
   *
   * @example
   * ```typescript
   * const allAgents = await storage.list();
   * for (const agent of allAgents) {
   *   console.log(agent.name);
   * }
   * ```
   */
  async list(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  /**
   * Queries stored items using a predicate function.
   *
   * Time complexity: O(n) where n is the number of stored items
   *
   * Iterates through all stored items and returns those for which
   * the predicate returns true.
   *
   * @param predicate - A function that takes an item and returns true if it should be included
   * @returns Array of items matching the predicate
   *
   * @example
   * ```typescript
   * // Find active agents
   * const active = await storage.query((a) => a.status === 'active');
   *
   * // Find by partial name match
   * const matches = await storage.query(
   *   (a) => a.name.toLowerCase().includes('test')
   * );
   * ```
   */
  async query(predicate: (item: T) => boolean): Promise<T[]> {
    const results: T[] = [];
    for (const value of this.store.values()) {
      if (predicate(value)) {
        results.push(value);
      }
    }
    return results;
  }

  /**
   * Removes all items from storage.
   *
   * Time complexity: O(1)
   *
   * This operation cannot be undone. All stored data will be permanently lost.
   *
   * @example
   * ```typescript
   * await storage.clear();
   * console.log(storage.size()); // 0
   * ```
   */
  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Returns the current number of items in storage.
   *
   * Time complexity: O(1)
   *
   * This is a synchronous helper method for convenience.
   * Unlike the interface methods, it does not return a Promise.
   *
   * @returns The number of items currently stored
   *
   * @example
   * ```typescript
   * const count = storage.size();
   * console.log(`Storage contains ${count} items`);
   * ```
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Creates a snapshot copy of the internal store.
   *
   * Time complexity: O(n) where n is the number of stored items
   *
   * Returns a shallow copy of the internal Map. Useful for testing,
   * debugging, and creating backups. Modifications to the returned
   * Map will not affect the storage.
   *
   * Note: While the Map is a copy, the values themselves are references
   * to the original objects. Deep cloning is not performed.
   *
   * @returns A new Map containing all key-value pairs
   *
   * @example
   * ```typescript
   * // Create a snapshot for inspection
   * const snapshot = storage.snapshot();
   * console.log('Snapshot size:', snapshot.size);
   *
   * // Iterate over snapshot
   * for (const [id, value] of snapshot) {
   *   console.log(id, value);
   * }
   *
   * // Original storage is unaffected by snapshot modifications
   * snapshot.clear();
   * console.log(storage.size()); // Still has all items
   * ```
   */
  snapshot(): Map<string, T> {
    return new Map(this.store);
  }
}
