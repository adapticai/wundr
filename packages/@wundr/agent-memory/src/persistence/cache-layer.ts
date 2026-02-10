/**
 * @wundr.io/agent-memory - LRU Cache Layer
 *
 * Generic LRU (Least Recently Used) cache that sits in front of SQLite
 * for hot data. Implements O(1) get/put/evict using a doubly-linked list
 * backed by a Map. Supports write-through semantics, transparent cache-miss
 * loading, and hit/miss statistics.
 */

// ============================================================================
// Doubly-Linked List Node
// ============================================================================

interface CacheNode<T> {
  key: string;
  value: T;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

// ============================================================================
// Configuration & Statistics
// ============================================================================

/**
 * Configuration options for the cache layer.
 */
export interface CacheLayerOptions {
  /** Maximum number of entries in the cache (default: 500) */
  maxEntries?: number;
  /** Enable hit/miss statistics tracking (default: true) */
  trackStatistics?: boolean;
}

/**
 * Cache performance statistics.
 */
export interface CacheStatistics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Current number of entries in the cache */
  size: number;
  /** Maximum capacity */
  maxEntries: number;
  /** Hit rate as a ratio (0-1), NaN if no requests */
  hitRate: number;
  /** Total evictions due to capacity */
  evictions: number;
}

// ============================================================================
// CacheLayer Implementation
// ============================================================================

/**
 * Generic LRU cache with O(1) operations and optional statistics tracking.
 *
 * The cache uses a doubly-linked list to maintain access order and a Map
 * for O(1) key lookups. The most recently accessed entry is always at the
 * head of the list; eviction removes from the tail.
 *
 * @typeParam T - Type of cached values
 *
 * @example
 * ```typescript
 * const cache = new CacheLayer<Memory>({ maxEntries: 100 });
 *
 * // Direct get/set
 * cache.set('mem_123', memory);
 * const hit = cache.get('mem_123');
 *
 * // Transparent load-on-miss
 * const result = cache.getOrLoad('mem_456', () => {
 *   return sqliteStore.getEpisodic('mem_456');
 * });
 * ```
 */
export class CacheLayer<T> {
  private readonly maxEntries: number;
  private readonly trackStatistics: boolean;
  private readonly map: Map<string, CacheNode<T>> = new Map();
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;

  // Statistics counters
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;

  /**
   * Creates a new CacheLayer instance.
   *
   * @param options - Cache configuration
   */
  constructor(options: CacheLayerOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 500);
    this.trackStatistics = options.trackStatistics ?? true;
  }

  /**
   * Retrieves a value from the cache.
   * Moves the accessed entry to the head (most recently used).
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found
   */
  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) {
      if (this.trackStatistics) {
        this._misses++;
      }
      return undefined;
    }

    if (this.trackStatistics) {
      this._hits++;
    }

    // Move to head (most recently used)
    this.moveToHead(node);
    return node.value;
  }

  /**
   * Stores a value in the cache.
   * If the key already exists, the value is updated and moved to the head.
   * If the cache is full, the least recently used entry is evicted.
   *
   * @param key - Cache key
   * @param value - Value to store
   */
  set(key: string, value: T): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }

    const node: CacheNode<T> = {
      key,
      value,
      prev: null,
      next: null,
    };

    this.map.set(key, node);
    this.addToHead(node);

    // Evict if over capacity
    if (this.map.size > this.maxEntries) {
      this.evictTail();
    }
  }

  /**
   * Removes a value from the cache.
   *
   * @param key - Cache key
   * @returns True if the key existed and was removed
   */
  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  /**
   * Checks whether a key exists in the cache.
   * Does NOT count as an access for LRU ordering.
   *
   * @param key - Cache key
   * @returns True if the key is in the cache
   */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /**
   * Clears all entries from the cache.
   * Resets statistics counters.
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  /**
   * Gets a value from the cache, or loads it using the provided function
   * if not present. The loaded value is automatically cached.
   *
   * This is the recommended way to use the cache with a backing store,
   * as it provides transparent cache-miss handling.
   *
   * @param key - Cache key
   * @param loader - Function to load the value if not cached. Return null if not found.
   * @returns The cached or loaded value, or null if the loader returned null
   */
  getOrLoad(key: string, loader: () => T | null): T | null {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const loaded = loader();
    if (loaded !== null) {
      this.set(key, loaded);
    }
    return loaded;
  }

  /**
   * Returns the current number of entries in the cache.
   */
  get size(): number {
    return this.map.size;
  }

  /**
   * Returns cache performance statistics.
   *
   * @returns Statistics snapshot
   */
  getStatistics(): CacheStatistics {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.map.size,
      maxEntries: this.maxEntries,
      hitRate: total > 0 ? this._hits / total : NaN,
      evictions: this._evictions,
    };
  }

  /**
   * Returns all keys currently in the cache, ordered from most recently
   * used to least recently used.
   *
   * @returns Array of cache keys in LRU order
   */
  keys(): string[] {
    const result: string[] = [];
    let current = this.head;
    while (current) {
      result.push(current.key);
      current = current.next;
    }
    return result;
  }

  // ============================================================================
  // Private: Linked List Operations
  // ============================================================================

  /**
   * Adds a node to the head of the list.
   */
  private addToHead(node: CacheNode<T>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Removes a node from the list.
   */
  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  /**
   * Moves an existing node to the head (most recently used).
   */
  private moveToHead(node: CacheNode<T>): void {
    if (this.head === node) {
      return;
    }
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Evicts the tail node (least recently used).
   */
  private evictTail(): void {
    if (!this.tail) {
      return;
    }

    const evicted = this.tail;
    this.removeNode(evicted);
    this.map.delete(evicted.key);

    if (this.trackStatistics) {
      this._evictions++;
    }
  }
}
