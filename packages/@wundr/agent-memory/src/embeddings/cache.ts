/**
 * @wundr/agent-memory - In-Memory Embedding LRU Cache
 *
 * A fast, in-memory cache for computed embeddings with LRU eviction and
 * optional TTL. Keyed by a hash of (provider, model, text) so that the
 * same text embedded with different models produces distinct entries.
 *
 * This cache complements the SQLite-backed `EmbeddingCache` in
 * `backends/embedding-cache.ts` by providing a hot-path, zero-IO layer
 * for repeated queries within a single process lifetime.
 *
 * Inspired by OpenClaw's embedding_cache table design but implemented
 * as a pure in-memory doubly-linked-list LRU for O(1) get/put/evict.
 */

import {
  type EmbeddingCacheConfig,
  type EmbeddingResult,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
} from './provider';

// ============================================================================
// Types
// ============================================================================

/**
 * A single entry in the LRU cache.
 */
interface CacheNode {
  key: string;
  result: EmbeddingResult;
  createdAt: number;
  /** Links for the doubly-linked list. */
  prev: CacheNode | null;
  next: CacheNode | null;
}

/**
 * Statistics about the in-memory cache.
 */
export interface InMemoryCacheStats {
  enabled: boolean;
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

// ============================================================================
// InMemoryEmbeddingCache
// ============================================================================

/**
 * In-memory LRU cache for embedding results.
 *
 * Thread-safe within a single Node.js event loop (no concurrent mutation).
 * Evicts the least-recently-used entry when capacity is exceeded.
 *
 * Usage:
 * ```typescript
 * const cache = new InMemoryEmbeddingCache();
 *
 * const key = computeCacheKey(text, 'openai', 'text-embedding-3-small');
 * const cached = cache.get(key);
 * if (cached) {
 *   return cached;
 * }
 *
 * const result = await provider.embedText(text);
 * cache.set(key, result);
 * ```
 */
export class InMemoryEmbeddingCache {
  private readonly config: EmbeddingCacheConfig;
  private readonly map: Map<string, CacheNode> = new Map();

  // Sentinel nodes for the doubly-linked list (most recent at head, least at tail)
  private readonly head: CacheNode;
  private readonly tail: CacheNode;

  // Statistics
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(config?: Partial<EmbeddingCacheConfig>) {
    this.config = { ...DEFAULT_EMBEDDING_CACHE_CONFIG, ...config };

    // Initialize sentinel nodes
    this.head = {
      key: '',
      result: { embedding: [], tokenCount: 0 },
      createdAt: 0,
      prev: null,
      next: null,
    };
    this.tail = {
      key: '',
      result: { embedding: [], tokenCount: 0 },
      createdAt: 0,
      prev: null,
      next: null,
    };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Whether the cache is enabled.
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Current number of entries in the cache.
   */
  get size(): number {
    return this.map.size;
  }

  /**
   * Retrieve a cached embedding result.
   * Returns undefined on miss or if the entry has expired.
   * Promotes the entry to the head of the LRU list on hit.
   */
  get(key: string): EmbeddingResult | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const node = this.map.get(key);
    if (!node) {
      this.missCount++;
      return undefined;
    }

    // TTL check
    if (this.config.ttlMs > 0) {
      const age = Date.now() - node.createdAt;
      if (age > this.config.ttlMs) {
        this.removeNode(node);
        this.map.delete(key);
        this.missCount++;
        return undefined;
      }
    }

    // Promote to most-recently-used
    this.removeNode(node);
    this.addToHead(node);

    this.hitCount++;
    return node.result;
  }

  /**
   * Store an embedding result in the cache.
   * If the cache is full, evicts the least-recently-used entry.
   */
  set(key: string, result: EmbeddingResult): void {
    if (!this.config.enabled) {
      return;
    }

    // Update existing entry
    const existing = this.map.get(key);
    if (existing) {
      existing.result = result;
      existing.createdAt = Date.now();
      this.removeNode(existing);
      this.addToHead(existing);
      return;
    }

    // Create new entry
    const node: CacheNode = {
      key,
      result,
      createdAt: Date.now(),
      prev: null,
      next: null,
    };

    this.map.set(key, node);
    this.addToHead(node);

    // Evict if over capacity
    while (this.map.size > this.config.maxEntries) {
      const lru = this.tail.prev;
      if (lru && lru !== this.head) {
        this.removeNode(lru);
        this.map.delete(lru.key);
        this.evictionCount++;
      } else {
        break;
      }
    }
  }

  /**
   * Check if a key exists in the cache (without promoting it).
   */
  has(key: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const node = this.map.get(key);
    if (!node) {
      return false;
    }

    // TTL check
    if (this.config.ttlMs > 0) {
      const age = Date.now() - node.createdAt;
      if (age > this.config.ttlMs) {
        this.removeNode(node);
        this.map.delete(node.key);
        return false;
      }
    }

    return true;
  }

  /**
   * Remove a specific entry from the cache.
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
   * Clear all entries from the cache.
   */
  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Get cache statistics.
   */
  getStats(): InMemoryCacheStats {
    const totalLookups = this.hitCount + this.missCount;
    return {
      enabled: this.config.enabled,
      size: this.map.size,
      maxEntries: this.config.maxEntries,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: totalLookups > 0 ? this.hitCount / totalLookups : 0,
      evictions: this.evictionCount,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  /**
   * Export all cache entries as a flat array (for persistence).
   * Entries are ordered from most-recently-used to least-recently-used.
   */
  exportEntries(): Array<{
    key: string;
    result: EmbeddingResult;
    createdAt: number;
  }> {
    const entries: Array<{
      key: string;
      result: EmbeddingResult;
      createdAt: number;
    }> = [];
    let current = this.head.next;
    while (current && current !== this.tail) {
      entries.push({
        key: current.key,
        result: current.result,
        createdAt: current.createdAt,
      });
      current = current.next;
    }
    return entries;
  }

  /**
   * Import entries (e.g., from a previous persistence snapshot).
   * Entries are inserted from last (least-recent) to first (most-recent)
   * so that ordering is preserved.
   */
  importEntries(
    entries: Array<{ key: string; result: EmbeddingResult; createdAt: number }>
  ): void {
    // Insert in reverse so that the first entry ends up as most-recent
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]!;
      if (!this.map.has(entry.key)) {
        const node: CacheNode = {
          key: entry.key,
          result: entry.result,
          createdAt: entry.createdAt,
          prev: null,
          next: null,
        };
        this.map.set(entry.key, node);
        this.addToHead(node);
      }
    }

    // Evict excess
    while (this.map.size > this.config.maxEntries) {
      const lru = this.tail.prev;
      if (lru && lru !== this.head) {
        this.removeNode(lru);
        this.map.delete(lru.key);
        this.evictionCount++;
      } else {
        break;
      }
    }
  }

  // ==========================================================================
  // Doubly-Linked List Operations
  // ==========================================================================

  private addToHead(node: CacheNode): void {
    node.prev = this.head;
    node.next = this.head.next;
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }

  private removeNode(node: CacheNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = null;
  }
}
