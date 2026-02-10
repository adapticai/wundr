/**
 * Tests for InMemoryEmbeddingCache (src/embeddings/cache.ts).
 *
 * Covers:
 *  - Basic get/set/has/delete operations
 *  - LRU eviction behavior
 *  - Cache hit and miss tracking
 *  - TTL expiration
 *  - Disabled cache behavior
 *  - Export/import round-trip
 *  - Statistics and reset
 *  - Capacity enforcement
 *  - Updating existing entries
 */

import { InMemoryEmbeddingCache } from '../../embeddings/cache';
import { computeCacheKey, type EmbeddingResult } from '../../embeddings/provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(dims = 3, fill = 0.5): EmbeddingResult {
  return {
    embedding: new Array(dims).fill(fill),
    tokenCount: 10,
  };
}

function makeKey(text: string): string {
  return computeCacheKey(text, 'openai', 'text-embedding-3-small');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryEmbeddingCache', () => {
  let cache: InMemoryEmbeddingCache;

  beforeEach(() => {
    cache = new InMemoryEmbeddingCache({ maxEntries: 5, ttlMs: 0 });
  });

  // =========================================================================
  // Basic Operations
  // =========================================================================

  describe('basic operations', () => {
    it('should store and retrieve an embedding result', () => {
      const key = makeKey('hello');
      const result = makeResult();

      cache.set(key, result);

      const retrieved = cache.get(key);
      expect(retrieved).toBeDefined();
      expect(retrieved!.embedding).toEqual(result.embedding);
      expect(retrieved!.tokenCount).toBe(result.tokenCount);
    });

    it('should return undefined for cache miss', () => {
      const result = cache.get(makeKey('nonexistent'));
      expect(result).toBeUndefined();
    });

    it('should report correct size', () => {
      expect(cache.size).toBe(0);

      cache.set(makeKey('a'), makeResult());
      expect(cache.size).toBe(1);

      cache.set(makeKey('b'), makeResult());
      expect(cache.size).toBe(2);
    });

    it('should check existence with has()', () => {
      const key = makeKey('test');

      expect(cache.has(key)).toBe(false);
      cache.set(key, makeResult());
      expect(cache.has(key)).toBe(true);
    });

    it('should delete entries', () => {
      const key = makeKey('delete-me');
      cache.set(key, makeResult());

      const deleted = cache.delete(key);
      expect(deleted).toBe(true);
      expect(cache.has(key)).toBe(false);
      expect(cache.size).toBe(0);
    });

    it('should return false when deleting nonexistent key', () => {
      expect(cache.delete(makeKey('nonexistent'))).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set(makeKey('a'), makeResult());
      cache.set(makeKey('b'), makeResult());
      cache.set(makeKey('c'), makeResult());

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get(makeKey('a'))).toBeUndefined();
    });
  });

  // =========================================================================
  // LRU Eviction
  // =========================================================================

  describe('LRU eviction', () => {
    it('should evict the least-recently-used entry when capacity is exceeded', () => {
      // Cache capacity is 5
      for (let i = 0; i < 5; i++) {
        cache.set(makeKey(`item-${i}`), makeResult(3, i));
      }
      expect(cache.size).toBe(5);

      // Adding a 6th should evict item-0 (the oldest, never accessed since insert)
      cache.set(makeKey('item-5'), makeResult(3, 5));

      expect(cache.size).toBe(5);
      expect(cache.get(makeKey('item-0'))).toBeUndefined(); // Evicted
      expect(cache.get(makeKey('item-5'))).toBeDefined(); // Present
    });

    it('should promote accessed entries (no eviction of recently accessed)', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(makeKey(`item-${i}`), makeResult(3, i));
      }

      // Access item-0 to promote it to the head
      cache.get(makeKey('item-0'));

      // Add a new entry -- item-1 should be evicted (now the LRU)
      cache.set(makeKey('item-5'), makeResult(3, 5));

      expect(cache.get(makeKey('item-0'))).toBeDefined(); // Promoted, not evicted
      expect(cache.get(makeKey('item-1'))).toBeUndefined(); // Evicted (was LRU)
    });

    it('should track eviction count in stats', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(makeKey(`item-${i}`), makeResult());
      }

      // Trigger 3 evictions
      cache.set(makeKey('extra-1'), makeResult());
      cache.set(makeKey('extra-2'), makeResult());
      cache.set(makeKey('extra-3'), makeResult());

      const stats = cache.getStats();
      expect(stats.evictions).toBe(3);
    });

    it('should not exceed maxEntries', () => {
      for (let i = 0; i < 20; i++) {
        cache.set(makeKey(`item-${i}`), makeResult());
      }

      expect(cache.size).toBe(5);
    });
  });

  // =========================================================================
  // Hit and Miss Tracking
  // =========================================================================

  describe('hit/miss tracking', () => {
    it('should count hits', () => {
      const key = makeKey('tracked');
      cache.set(key, makeResult());

      cache.get(key);
      cache.get(key);
      cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should count misses', () => {
      cache.get(makeKey('miss-1'));
      cache.get(makeKey('miss-2'));

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      const key = makeKey('hr');
      cache.set(key, makeResult());

      cache.get(key); // hit
      cache.get(key); // hit
      cache.get(makeKey('nope')); // miss

      const stats = cache.getStats();
      // 2 hits / 3 lookups = 0.6667
      expect(stats.hitRate).toBeCloseTo(2 / 3, 4);
    });

    it('should report 0 hit rate when no lookups', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should reset stats', () => {
      const key = makeKey('reset');
      cache.set(key, makeResult());
      cache.get(key);
      cache.get(makeKey('miss'));

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  // =========================================================================
  // TTL Expiration
  // =========================================================================

  describe('TTL expiration', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      jest.useFakeTimers();

      const ttlCache = new InMemoryEmbeddingCache({ maxEntries: 100, ttlMs: 1000 });
      const key = makeKey('ttl-test');
      ttlCache.set(key, makeResult());

      // Before expiration
      expect(ttlCache.get(key)).toBeDefined();

      // Advance past TTL
      jest.advanceTimersByTime(1500);

      expect(ttlCache.get(key)).toBeUndefined();
    });

    it('should count TTL expiration as a miss', () => {
      jest.useFakeTimers();

      const ttlCache = new InMemoryEmbeddingCache({ maxEntries: 100, ttlMs: 500 });
      const key = makeKey('ttl-miss');
      ttlCache.set(key, makeResult());

      jest.advanceTimersByTime(600);
      ttlCache.get(key); // Should be expired

      const stats = ttlCache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('should remove expired entries from the map on get', () => {
      jest.useFakeTimers();

      const ttlCache = new InMemoryEmbeddingCache({ maxEntries: 100, ttlMs: 500 });
      const key = makeKey('ttl-remove');
      ttlCache.set(key, makeResult());

      jest.advanceTimersByTime(600);
      ttlCache.get(key);

      expect(ttlCache.size).toBe(0);
    });

    it('should expire entries on has() check', () => {
      jest.useFakeTimers();

      const ttlCache = new InMemoryEmbeddingCache({ maxEntries: 100, ttlMs: 500 });
      const key = makeKey('ttl-has');
      ttlCache.set(key, makeResult());

      jest.advanceTimersByTime(600);

      expect(ttlCache.has(key)).toBe(false);
      expect(ttlCache.size).toBe(0);
    });

    it('should not expire entries when TTL is 0 (disabled)', () => {
      jest.useFakeTimers();

      const noTtlCache = new InMemoryEmbeddingCache({ maxEntries: 100, ttlMs: 0 });
      const key = makeKey('no-ttl');
      noTtlCache.set(key, makeResult());

      jest.advanceTimersByTime(999_999);

      expect(noTtlCache.get(key)).toBeDefined();
    });
  });

  // =========================================================================
  // Disabled Cache
  // =========================================================================

  describe('disabled cache', () => {
    let disabledCache: InMemoryEmbeddingCache;

    beforeEach(() => {
      disabledCache = new InMemoryEmbeddingCache({ enabled: false });
    });

    it('should report enabled=false', () => {
      expect(disabledCache.enabled).toBe(false);
    });

    it('should not store entries when disabled', () => {
      disabledCache.set(makeKey('disabled'), makeResult());

      expect(disabledCache.size).toBe(0);
    });

    it('should always return undefined from get when disabled', () => {
      // Force an entry via internals would be cheating, so just test the API
      expect(disabledCache.get(makeKey('anything'))).toBeUndefined();
    });

    it('should return false from has when disabled', () => {
      expect(disabledCache.has(makeKey('anything'))).toBe(false);
    });
  });

  // =========================================================================
  // Updating Existing Entries
  // =========================================================================

  describe('updating existing entries', () => {
    it('should update an existing entry in place', () => {
      const key = makeKey('update');
      cache.set(key, makeResult(3, 0.1));

      const updated = makeResult(3, 0.9);
      cache.set(key, updated);

      expect(cache.size).toBe(1);
      const retrieved = cache.get(key);
      expect(retrieved!.embedding[0]).toBe(0.9);
    });

    it('should promote updated entries to the head', () => {
      // Fill the cache
      for (let i = 0; i < 5; i++) {
        cache.set(makeKey(`item-${i}`), makeResult());
      }

      // Update item-0 (should promote to head)
      cache.set(makeKey('item-0'), makeResult(3, 0.99));

      // Add a new entry -- item-1 should be evicted (LRU)
      cache.set(makeKey('new'), makeResult());

      expect(cache.get(makeKey('item-0'))).toBeDefined();
      expect(cache.get(makeKey('item-1'))).toBeUndefined();
    });
  });

  // =========================================================================
  // Cache Key Generation
  // =========================================================================

  describe('cache key generation', () => {
    it('should produce different keys for different texts', () => {
      const k1 = computeCacheKey('hello', 'openai', 'model-a');
      const k2 = computeCacheKey('world', 'openai', 'model-a');

      expect(k1).not.toBe(k2);
    });

    it('should produce different keys for different providers', () => {
      const k1 = computeCacheKey('hello', 'openai', 'model-a');
      const k2 = computeCacheKey('hello', 'voyage', 'model-a');

      expect(k1).not.toBe(k2);
    });

    it('should produce different keys for different models', () => {
      const k1 = computeCacheKey('hello', 'openai', 'model-a');
      const k2 = computeCacheKey('hello', 'openai', 'model-b');

      expect(k1).not.toBe(k2);
    });

    it('should produce same key for same inputs', () => {
      const k1 = computeCacheKey('deterministic', 'openai', 'model-x');
      const k2 = computeCacheKey('deterministic', 'openai', 'model-x');

      expect(k1).toBe(k2);
    });

    it('should return a non-empty string', () => {
      const key = computeCacheKey('test', 'openai', 'model');
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });
  });

  // =========================================================================
  // Export / Import
  // =========================================================================

  describe('export/import', () => {
    it('should export entries in MRU-to-LRU order', () => {
      cache.set(makeKey('first'), makeResult(3, 0.1));
      cache.set(makeKey('second'), makeResult(3, 0.2));
      cache.set(makeKey('third'), makeResult(3, 0.3));

      const exported = cache.exportEntries();

      expect(exported).toHaveLength(3);
      // Most recent first
      expect(exported[0].key).toBe(makeKey('third'));
      expect(exported[2].key).toBe(makeKey('first'));
    });

    it('should import entries and restore order', () => {
      cache.set(makeKey('a'), makeResult(3, 0.1));
      cache.set(makeKey('b'), makeResult(3, 0.2));

      const exported = cache.exportEntries();

      const newCache = new InMemoryEmbeddingCache({ maxEntries: 5 });
      newCache.importEntries(exported);

      expect(newCache.size).toBe(2);
      expect(newCache.get(makeKey('a'))).toBeDefined();
      expect(newCache.get(makeKey('b'))).toBeDefined();
    });

    it('should preserve MRU ordering after import', () => {
      cache.set(makeKey('first'), makeResult(3, 0.1));
      cache.set(makeKey('second'), makeResult(3, 0.2));

      const exported = cache.exportEntries();

      const newCache = new InMemoryEmbeddingCache({ maxEntries: 5 });
      newCache.importEntries(exported);

      const reExported = newCache.exportEntries();
      expect(reExported[0].key).toBe(exported[0].key);
    });

    it('should evict excess during import', () => {
      const smallCache = new InMemoryEmbeddingCache({ maxEntries: 2 });

      const entries = [
        { key: makeKey('a'), result: makeResult(), createdAt: Date.now() },
        { key: makeKey('b'), result: makeResult(), createdAt: Date.now() },
        { key: makeKey('c'), result: makeResult(), createdAt: Date.now() },
      ];

      smallCache.importEntries(entries);

      expect(smallCache.size).toBe(2);
    });

    it('should skip duplicate keys during import', () => {
      cache.set(makeKey('existing'), makeResult(3, 0.1));

      const entries = [
        { key: makeKey('existing'), result: makeResult(3, 0.9), createdAt: Date.now() },
        { key: makeKey('new'), result: makeResult(), createdAt: Date.now() },
      ];

      cache.importEntries(entries);

      // Original entry should remain (not overwritten)
      expect(cache.get(makeKey('existing'))!.embedding[0]).toBe(0.1);
      expect(cache.get(makeKey('new'))).toBeDefined();
    });

    it('should export empty array when cache is empty', () => {
      const exported = cache.exportEntries();
      expect(exported).toHaveLength(0);
    });
  });

  // =========================================================================
  // Stats
  // =========================================================================

  describe('getStats', () => {
    it('should return comprehensive stats', () => {
      cache.set(makeKey('a'), makeResult());
      cache.get(makeKey('a')); // hit
      cache.get(makeKey('b')); // miss

      const stats = cache.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(1);
      expect(stats.maxEntries).toBe(5);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
      expect(stats.evictions).toBe(0);
    });
  });
});
