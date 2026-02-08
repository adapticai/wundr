/**
 * EmbeddingCache - Hash-keyed embedding cache with LRU eviction.
 *
 * Stores computed embeddings in a SQLite table keyed by (provider, model, hash).
 * On cache hit, the embedding is returned without re-computing via the provider
 * API. When the cache exceeds a configured maximum, the oldest entries (by
 * `updated_at`) are evicted.
 *
 * This directly mirrors OpenClaw's embedding_cache table design and LRU
 * pruning strategy.
 *
 * @module backends/embedding-cache
 */

import type { DatabaseHandle } from './sqlite-backend';
import { EMBEDDING_CACHE_TABLE } from './sqlite-backend';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the embedding cache.
 */
export interface EmbeddingCacheConfig {
  /** Whether caching is enabled. */
  enabled: boolean;
  /** Maximum number of cache entries before LRU eviction. 0 = unlimited. */
  maxEntries: number;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: EmbeddingCacheConfig = {
  enabled: true,
  maxEntries: 10_000,
};

/**
 * A single cache entry to upsert.
 */
export interface CacheEntry {
  hash: string;
  embedding: number[];
}

/**
 * Cache statistics for status reporting.
 */
export interface CacheStats {
  enabled: boolean;
  entries: number;
  maxEntries: number;
}

// ---------------------------------------------------------------------------
// EmbeddingCache
// ---------------------------------------------------------------------------

export class EmbeddingCache {
  private config: EmbeddingCacheConfig;
  private provider: string;
  private model: string;

  constructor(params: {
    config?: Partial<EmbeddingCacheConfig>;
    provider: string;
    model: string;
  }) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...params.config };
    this.provider = params.provider;
    this.model = params.model;
  }

  /**
   * Update the provider/model identity (e.g. after a fallback switch).
   */
  setIdentity(provider: string, model: string): void {
    this.provider = provider;
    this.model = model;
  }

  /**
   * Whether the cache is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // =========================================================================
  // Load
  // =========================================================================

  /**
   * Load cached embeddings for a batch of content hashes.
   *
   * Returns a Map from hash -> embedding vector for all cache hits.
   * Hashes not found in the cache are simply absent from the returned Map.
   *
   * Uses batched SQL queries (chunks of 400) to avoid hitting SQLite's
   * parameter limit.
   */
  load(db: DatabaseHandle, hashes: string[]): Map<string, number[]> {
    if (!this.config.enabled || hashes.length === 0) {
      return new Map();
    }

    // Deduplicate hashes
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const hash of hashes) {
      if (!hash || seen.has(hash)) {
        continue;
      }
      seen.add(hash);
      unique.push(hash);
    }

    if (unique.length === 0) {
      return new Map();
    }

    const out = new Map<string, number[]>();
    const baseParams = [this.provider, this.model];
    const batchSize = 400;

    for (let start = 0; start < unique.length; start += batchSize) {
      const batch = unique.slice(start, start + batchSize);
      const placeholders = batch.map(() => '?').join(', ');

      const rows = db
        .prepare(
          `SELECT hash, embedding FROM ${EMBEDDING_CACHE_TABLE}\n` +
            ` WHERE provider = ? AND model = ? AND hash IN (${placeholders})`
        )
        .all(...baseParams, ...batch) as Array<{
        hash: string;
        embedding: string;
      }>;

      for (const row of rows) {
        const embedding = parseEmbeddingJson(row.embedding);
        if (embedding.length > 0) {
          out.set(row.hash, embedding);
        }
      }
    }

    return out;
  }

  // =========================================================================
  // Upsert
  // =========================================================================

  /**
   * Insert or update a batch of cache entries.
   *
   * Each entry is keyed by (provider, model, hash). If an entry already
   * exists, its embedding and `updated_at` timestamp are refreshed (which
   * also moves it to the tail of the LRU order).
   */
  upsert(db: DatabaseHandle, entries: CacheEntry[]): void {
    if (!this.config.enabled || entries.length === 0) {
      return;
    }

    const now = Date.now();
    const stmt = db.prepare(
      `INSERT INTO ${EMBEDDING_CACHE_TABLE} (provider, model, hash, embedding, dims, updated_at)\n` +
        ` VALUES (?, ?, ?, ?, ?, ?)\n` +
        ` ON CONFLICT(provider, model, hash) DO UPDATE SET\n` +
        `   embedding=excluded.embedding,\n` +
        `   dims=excluded.dims,\n` +
        `   updated_at=excluded.updated_at`
    );

    for (const entry of entries) {
      const embedding = entry.embedding ?? [];
      stmt.run(
        this.provider,
        this.model,
        entry.hash,
        JSON.stringify(embedding),
        embedding.length,
        now
      );
    }
  }

  // =========================================================================
  // Eviction
  // =========================================================================

  /**
   * Prune the cache if it exceeds maxEntries.
   *
   * Deletes the oldest entries (by `updated_at`) to bring the count down
   * to maxEntries. This implements LRU eviction since `updated_at` is
   * refreshed on every cache hit during upsert.
   */
  pruneIfNeeded(db: DatabaseHandle): void {
    if (!this.config.enabled) {
      return;
    }
    const max = this.config.maxEntries;
    if (!max || max <= 0) {
      return;
    }

    const row = db
      .prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`)
      .get() as { c: number } | undefined;
    const count = row?.c ?? 0;

    if (count <= max) {
      return;
    }

    const excess = count - max;
    db.prepare(
      `DELETE FROM ${EMBEDDING_CACHE_TABLE}\n` +
        ` WHERE rowid IN (\n` +
        `   SELECT rowid FROM ${EMBEDDING_CACHE_TABLE}\n` +
        `   ORDER BY updated_at ASC\n` +
        `   LIMIT ?\n` +
        ` )`
    ).run(excess);
  }

  // =========================================================================
  // Seeding (for atomic reindex)
  // =========================================================================

  /**
   * Seed the cache in a target database from a source database.
   *
   * Used during atomic reindexing: the embedding cache from the old database
   * is copied into the new temp database so that unchanged chunks can reuse
   * their cached embeddings without re-computing.
   */
  seedFrom(targetDb: DatabaseHandle, sourceDb: DatabaseHandle): void {
    if (!this.config.enabled) {
      return;
    }

    let rows: Array<{
      provider: string;
      model: string;
      hash: string;
      embedding: string;
      dims: number | null;
      updated_at: number;
    }>;

    try {
      rows = sourceDb
        .prepare(
          `SELECT provider, model, hash, embedding, dims, updated_at FROM ${EMBEDDING_CACHE_TABLE}`
        )
        .all() as typeof rows;
    } catch {
      // Source DB may not have the cache table
      return;
    }

    if (!rows.length) {
      return;
    }

    const insert = targetDb.prepare(
      `INSERT INTO ${EMBEDDING_CACHE_TABLE} (provider, model, hash, embedding, dims, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, model, hash) DO UPDATE SET
         embedding=excluded.embedding,
         dims=excluded.dims,
         updated_at=excluded.updated_at`
    );

    targetDb.exec('BEGIN');
    try {
      for (const row of rows) {
        insert.run(
          row.provider,
          row.model,
          row.hash,
          row.embedding,
          row.dims,
          row.updated_at
        );
      }
      targetDb.exec('COMMIT');
    } catch (err) {
      try {
        targetDb.exec('ROLLBACK');
      } catch {
        // Rollback may fail
      }
      throw err;
    }
  }

  // =========================================================================
  // Statistics
  // =========================================================================

  /**
   * Get cache statistics for status reporting.
   */
  getStats(db: DatabaseHandle): CacheStats {
    if (!this.config.enabled) {
      return {
        enabled: false,
        entries: 0,
        maxEntries: this.config.maxEntries,
      };
    }

    const row = db
      .prepare(`SELECT COUNT(*) as c FROM ${EMBEDDING_CACHE_TABLE}`)
      .get() as { c: number } | undefined;

    return {
      enabled: true,
      entries: row?.c ?? 0,
      maxEntries: this.config.maxEntries,
    };
  }

  // =========================================================================
  // Batch Embedding Support
  // =========================================================================

  /**
   * Process a batch of chunks through the cache, returning embeddings for
   * cache hits and identifying chunks that need embedding computation.
   *
   * This is the primary integration point for the indexing pipeline:
   *
   * 1. Load cached embeddings for all chunk hashes.
   * 2. Return hits directly.
   * 3. Return the indices of misses so the caller can compute them.
   * 4. After computation, call `upsert()` with the new embeddings.
   *
   * @returns An object with:
   *   - `embeddings`: Array parallel to input chunks (empty array for misses)
   *   - `missingIndices`: Indices of chunks that need embedding computation
   */
  resolveBatch(
    db: DatabaseHandle,
    chunks: Array<{ hash: string; text: string }>
  ): {
    embeddings: number[][];
    missingIndices: number[];
  } {
    const embeddings: number[][] = Array.from({ length: chunks.length }, () => []);
    const missingIndices: number[] = [];

    if (!this.config.enabled) {
      for (let i = 0; i < chunks.length; i++) {
        missingIndices.push(i);
      }
      return { embeddings, missingIndices };
    }

    const cached = this.load(
      db,
      chunks.map((c) => c.hash)
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) {
        continue;
      }
      const hit = cached.get(chunk.hash);
      if (hit && hit.length > 0) {
        embeddings[i] = hit;
      } else {
        missingIndices.push(i);
      }
    }

    return { embeddings, missingIndices };
  }

  /**
   * Fill in computed embeddings for previously-missing chunks and persist
   * them to the cache.
   *
   * @param db - Database handle
   * @param chunks - The original chunk array (for hash lookup)
   * @param missingIndices - Indices that were missing (from resolveBatch)
   * @param computedEmbeddings - Computed embeddings parallel to missingIndices
   * @param targetEmbeddings - The full embeddings array to fill in
   */
  fillComputed(
    db: DatabaseHandle,
    chunks: Array<{ hash: string; text: string }>,
    missingIndices: number[],
    computedEmbeddings: number[][],
    targetEmbeddings: number[][]
  ): void {
    const toCache: CacheEntry[] = [];

    for (let i = 0; i < missingIndices.length; i++) {
      const chunkIndex = missingIndices[i]!;
      const embedding = computedEmbeddings[i] ?? [];
      const chunk = chunks[chunkIndex];

      targetEmbeddings[chunkIndex] = embedding;

      if (chunk && embedding.length > 0) {
        toCache.push({ hash: chunk.hash, embedding });
      }
    }

    this.upsert(db, toCache);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseEmbeddingJson(raw: string): number[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as number[];
    }
    return [];
  } catch {
    return [];
  }
}
