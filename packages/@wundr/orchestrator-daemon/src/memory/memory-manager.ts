/**
 * Memory Manager - MemGPT-inspired tiered memory architecture with SQLite persistence
 *
 * Three-tier design:
 *   1. Scratchpad  - working memory for the current session (key-value)
 *   2. Episodic    - autobiographical memories of recent interactions
 *   3. Semantic    - long-term consolidated knowledge
 *
 * Persistence features (inspired by OpenClaw's MemoryIndexManager):
 *   - SQLite backend via better-sqlite3 (with in-memory fallback)
 *   - FTS5 full-text search integration
 *   - Hybrid search (FTS keyword + cosine similarity vector ranking)
 *   - Batch insert/upsert operations
 *   - Session transcript indexing with delta tracking
 *   - Memory compaction with summarization archival
 *   - LRU cache for frequently accessed memories
 *   - Atomic operations via SQLite transactions
 *   - Memory statistics and health reporting
 *   - JSON import/export for snapshots
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import { Logger } from '../utils/logger';

import type {
  MemoryContext,
  MemoryEntry,
  MemoryTier,
  MemoryConfig,
} from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the SQLite persistence backend.
 */
export interface PersistenceConfig {
  /** File path for the SQLite database. Use ':memory:' for in-memory only. */
  dbPath: string;
  /** Enable FTS5 full-text search. Defaults to true. */
  ftsEnabled: boolean;
  /** Maximum LRU cache entries. 0 disables the cache. */
  lruCacheSize: number;
  /** Enable WAL mode for concurrent readers. Defaults to true. */
  walMode: boolean;
}

/**
 * A scored search result combining keyword and vector relevance.
 */
export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  tier: MemoryTier;
  matchType: 'keyword' | 'vector' | 'hybrid';
}

/**
 * Batch operation result.
 */
export interface BatchResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Session transcript entry for delta indexing.
 */
export interface SessionTranscriptEntry {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  turnNumber: number;
}

/**
 * Delta tracking state for session transcript indexing.
 */
interface SessionDeltaState {
  lastIndexedTurn: number;
  lastIndexedAt: number;
  pendingTurns: number;
}

/**
 * Result of a compaction operation.
 */
export interface CompactionResult {
  archived: number;
  summariesCreated: number;
  entriesBefore: number;
  entriesAfter: number;
}

/**
 * Health and statistics report for the memory subsystem.
 */
export interface MemoryHealthReport {
  status: 'healthy' | 'degraded' | 'error';
  backend: 'sqlite' | 'in-memory';
  fts: { enabled: boolean; available: boolean; error?: string };
  tiers: {
    scratchpad: { size: number };
    episodic: { count: number; dbCount: number };
    semantic: { count: number; dbCount: number };
  };
  lruCache: { size: number; maxSize: number; hitRate: number };
  dbSizeBytes: number;
  lastCompactionAt?: number;
  errors: string[];
}

/**
 * Serializable snapshot for import/export.
 */
export interface MemorySnapshot {
  version: string;
  exportedAt: string;
  scratchpad: Record<string, unknown>;
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  sessionDeltas: Record<string, SessionDeltaState>;
}

// ---------------------------------------------------------------------------
// LRU Cache
// ---------------------------------------------------------------------------

/**
 * Minimal LRU cache with O(1) get/set via a Map + doubly-linked list.
 * Map iteration order in V8 is insertion order, so we re-insert on access.
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value === undefined) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.maxSize > 0 && this.cache.size >= this.maxSize) {
      // Evict the least recently used (first key)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

// ---------------------------------------------------------------------------
// SQLite helpers (lazy-loaded)
// ---------------------------------------------------------------------------

/**
 * Minimal interface for the subset of better-sqlite3 we use.
 * This allows the code to compile even when better-sqlite3 is not installed.
 */
interface SqliteDatabase {
  run(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
  pragma(pragma: string): unknown;
  inTransaction: boolean;
}

interface SqliteStatement {
  run(...params: unknown[]): {
    changes: number;
    lastInsertRowid: number | bigint;
  };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

type BetterSqlite3Constructor = new (
  filename: string,
  options?: Record<string, unknown>
) => SqliteDatabase;

let _BetterSqlite3: BetterSqlite3Constructor | null | undefined = undefined;

function loadBetterSqlite3(): BetterSqlite3Constructor | null {
  if (_BetterSqlite3 !== undefined) {
    return _BetterSqlite3;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('better-sqlite3') as BetterSqlite3Constructor;
    _BetterSqlite3 = mod;
    return mod;
  } catch {
    _BetterSqlite3 = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory SQLite polyfill
// ---------------------------------------------------------------------------

/**
 * Extremely lightweight in-memory store that implements the SqliteDatabase
 * interface for the subset of SQL this module uses. Used as a fallback when
 * better-sqlite3 is not available.
 */
class InMemoryDatabase implements SqliteDatabase {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();
  inTransaction = false;

  run(_sql: string): void {
    // No-op for DDL/pragmas in the fallback path.
  }

  prepare(sql: string): SqliteStatement {
    return new InMemoryStatement(this, sql);
  }

  close(): void {
    this.tables.clear();
  }

  pragma(_pragma: string): unknown {
    return undefined;
  }

  // -- Internal helpers used by InMemoryStatement --

  _getTable(name: string): Map<string, Record<string, unknown>> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  _allTables(): Map<string, Map<string, Record<string, unknown>>> {
    return this.tables;
  }
}

class InMemoryStatement implements SqliteStatement {
  constructor(
    private db: InMemoryDatabase,
    private sql: string
  ) {}

  run(...params: unknown[]): {
    changes: number;
    lastInsertRowid: number | bigint;
  } {
    // Parse simple INSERT/UPDATE/DELETE for the tables we use
    const sql = this.sql.trim();

    // INSERT OR REPLACE INTO memories ...
    if (/^INSERT/i.test(sql)) {
      const tableMatch = /INTO\s+(\w+)/i.exec(sql);
      const tableName = tableMatch?.[1] ?? 'memories';
      const table = this.db._getTable(tableName);
      const id =
        (params[0] as string) ??
        `auto_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const row: Record<string, unknown> = { id };
      // Map positional params to columns based on the SQL
      const colMatch = /\(([^)]+)\)\s*VALUES/i.exec(sql);
      if (colMatch) {
        const cols = colMatch[1]!.split(',').map(c => c.trim());
        for (let i = 0; i < cols.length; i++) {
          row[cols[i]!] = params[i];
        }
      }
      table.set(id, row);
      return { changes: 1, lastInsertRowid: table.size };
    }

    if (/^DELETE/i.test(sql)) {
      const tableMatch = /FROM\s+(\w+)/i.exec(sql);
      const tableName = tableMatch?.[1] ?? 'memories';
      const table = this.db._getTable(tableName);
      if (params.length > 0) {
        const id = params[0] as string;
        const deleted = table.delete(id);
        return { changes: deleted ? 1 : 0, lastInsertRowid: 0 };
      }
      const size = table.size;
      table.clear();
      return { changes: size, lastInsertRowid: 0 };
    }

    return { changes: 0, lastInsertRowid: 0 };
  }

  get(...params: unknown[]): unknown {
    const sql = this.sql.trim();
    const tableMatch = /FROM\s+(\w+)/i.exec(sql);
    const tableName = tableMatch?.[1] ?? 'memories';
    const table = this.db._getTable(tableName);

    // COUNT(*)
    if (/COUNT\(\*\)/i.test(sql)) {
      return { count: table.size };
    }

    // Simple ID lookup
    if (params.length > 0) {
      return table.get(params[0] as string) ?? null;
    }

    return null;
  }

  all(...params: unknown[]): unknown[] {
    const sql = this.sql.trim();
    const tableMatch = /FROM\s+(\w+)/i.exec(sql);
    const tableName = tableMatch?.[1] ?? 'memories';
    const table = this.db._getTable(tableName);

    // If a WHERE clause with tier filter
    if (params.length > 0 && /tier\s*=/i.test(sql)) {
      const tier = params[0] as string;
      return Array.from(table.values()).filter(r => r['tier'] === tier);
    }

    return Array.from(table.values());
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  dbPath: ':memory:',
  ftsEnabled: true,
  lruCacheSize: 500,
  walMode: true,
};

const MEMORIES_TABLE = 'memories';
const FTS_TABLE = 'memories_fts';
const META_TABLE = 'memory_meta';
const SESSION_DELTAS_TABLE = 'session_deltas';
const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// MemoryManager
// ---------------------------------------------------------------------------

export class MemoryManager {
  private logger: Logger;
  private config: MemoryConfig;
  private persistenceConfig: PersistenceConfig;
  private scratchpad: Map<string, unknown>;
  private episodic: MemoryEntry[];
  private semantic: MemoryEntry[];
  private db: SqliteDatabase | null = null;
  private dbBackend: 'sqlite' | 'in-memory' = 'in-memory';
  private ftsAvailable = false;
  private ftsError?: string;
  private lruCache: LRUCache<string, MemoryEntry>;
  private sessionDeltas: Map<string, SessionDeltaState> = new Map();
  private lastCompactionAt?: number;
  private errors: string[] = [];
  private closed = false;

  constructor(config: MemoryConfig, persistence?: Partial<PersistenceConfig>) {
    this.logger = new Logger('MemoryManager');
    this.config = config;
    this.persistenceConfig = { ...DEFAULT_PERSISTENCE_CONFIG, ...persistence };
    this.scratchpad = new Map();
    this.episodic = [];
    this.semantic = [];
    this.lruCache = new LRUCache<string, MemoryEntry>(
      this.persistenceConfig.lruCacheSize
    );

    this.initializeDatabase();
  }

  // -------------------------------------------------------------------------
  // Database Initialization
  // -------------------------------------------------------------------------

  /**
   * Attempt to open a better-sqlite3 database. Falls back to an in-memory
   * polyfill if the native module is not available.
   */
  private initializeDatabase(): void {
    const BetterSqlite3 = loadBetterSqlite3();

    if (BetterSqlite3) {
      try {
        this.db = new BetterSqlite3(this.persistenceConfig.dbPath, {
          verbose: undefined,
        });
        this.dbBackend = 'sqlite';

        if (this.persistenceConfig.walMode) {
          this.db.pragma('journal_mode = WAL');
        }
        this.db.pragma('busy_timeout = 5000');
        this.db.pragma('foreign_keys = ON');

        this.logger.info(
          `SQLite database opened: ${this.persistenceConfig.dbPath}`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.errors.push(`SQLite open failed: ${message}`);
        this.logger.warn(
          `Failed to open SQLite database, using in-memory fallback: ${message}`
        );
        this.db = new InMemoryDatabase();
        this.dbBackend = 'in-memory';
      }
    } else {
      this.logger.info(
        'better-sqlite3 not available, using in-memory fallback'
      );
      this.db = new InMemoryDatabase();
      this.dbBackend = 'in-memory';
    }

    this.ensureSchema();
    this.loadPersistedEntries();
  }

  /**
   * Create all required tables and indexes if they do not exist.
   */
  private ensureSchema(): void {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return;
    }

    try {
      this.execSql(`
        CREATE TABLE IF NOT EXISTS ${META_TABLE} (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      this.execSql(`
        CREATE TABLE IF NOT EXISTS ${MEMORIES_TABLE} (
          id         TEXT PRIMARY KEY,
          tier       TEXT NOT NULL CHECK(tier IN ('episodic', 'semantic')),
          content    TEXT NOT NULL,
          type       TEXT NOT NULL,
          timestamp  INTEGER NOT NULL,
          metadata   TEXT,
          embedding  TEXT,
          hash       TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
        );
      `);

      this.execSql(`
        CREATE INDEX IF NOT EXISTS idx_memories_tier
          ON ${MEMORIES_TABLE}(tier);
        CREATE INDEX IF NOT EXISTS idx_memories_timestamp
          ON ${MEMORIES_TABLE}(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_memories_type
          ON ${MEMORIES_TABLE}(tier, type);
        CREATE INDEX IF NOT EXISTS idx_memories_hash
          ON ${MEMORIES_TABLE}(hash);
      `);

      this.execSql(`
        CREATE TABLE IF NOT EXISTS ${SESSION_DELTAS_TABLE} (
          session_id        TEXT PRIMARY KEY,
          last_indexed_turn INTEGER NOT NULL DEFAULT 0,
          last_indexed_at   INTEGER NOT NULL DEFAULT 0,
          pending_turns     INTEGER NOT NULL DEFAULT 0
        );
      `);

      // FTS5 virtual table
      if (this.persistenceConfig.ftsEnabled) {
        try {
          this.execSql(`
            CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE}
              USING fts5(
                content,
                id UNINDEXED,
                tier UNINDEXED,
                type UNINDEXED,
                content_rowid='rowid'
              );
          `);
          this.ftsAvailable = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.ftsError = message;
          this.ftsAvailable = false;
          this.logger.warn(`FTS5 not available: ${message}`);
        }
      }

      // Store schema version
      this.db
        .prepare(
          `INSERT OR REPLACE INTO ${META_TABLE} (key, value) VALUES (?, ?)`
        )
        .run('schema_version', String(SCHEMA_VERSION));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.errors.push(`Schema creation failed: ${message}`);
      this.logger.error(`Failed to create schema: ${message}`);
    }
  }

  /**
   * Load persisted episodic and semantic entries from SQLite into
   * the in-memory arrays on startup.
   */
  private loadPersistedEntries(): void {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return;
    }

    try {
      const episodicRows = this.db
        .prepare(
          `SELECT id, content, type, timestamp, metadata
         FROM ${MEMORIES_TABLE}
         WHERE tier = ?
         ORDER BY timestamp DESC`
        )
        .all('episodic') as Array<{
        id: string;
        content: string;
        type: string;
        timestamp: number;
        metadata: string | null;
      }>;

      this.episodic = episodicRows.map(row => this.rowToEntry(row));

      const semanticRows = this.db
        .prepare(
          `SELECT id, content, type, timestamp, metadata
         FROM ${MEMORIES_TABLE}
         WHERE tier = ?
         ORDER BY timestamp DESC`
        )
        .all('semantic') as Array<{
        id: string;
        content: string;
        type: string;
        timestamp: number;
        metadata: string | null;
      }>;

      this.semantic = semanticRows.map(row => this.rowToEntry(row));

      // Load session deltas
      const deltaRows = this.db
        .prepare(
          `SELECT session_id, last_indexed_turn, last_indexed_at, pending_turns
         FROM ${SESSION_DELTAS_TABLE}`
        )
        .all() as Array<{
        session_id: string;
        last_indexed_turn: number;
        last_indexed_at: number;
        pending_turns: number;
      }>;

      for (const row of deltaRows) {
        this.sessionDeltas.set(row.session_id, {
          lastIndexedTurn: row.last_indexed_turn,
          lastIndexedAt: row.last_indexed_at,
          pendingTurns: row.pending_turns,
        });
      }

      this.logger.info(
        `Loaded ${this.episodic.length} episodic and ${this.semantic.length} semantic memories from SQLite`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.errors.push(`Load failed: ${message}`);
      this.logger.error(`Failed to load persisted entries: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Context Initialization (backward-compatible)
  // -------------------------------------------------------------------------

  /**
   * Initialize memory context for a new session.
   */
  initializeContext(): MemoryContext {
    return {
      scratchpad: {},
      episodic: [],
      semantic: [],
    };
  }

  // -------------------------------------------------------------------------
  // Scratchpad (Working Memory) - Tier 1
  // -------------------------------------------------------------------------

  /**
   * Store data in scratchpad (working memory).
   */
  storeScratchpad(key: string, value: unknown): void {
    this.scratchpad.set(key, value);
    this.logger.debug(`Stored in scratchpad: ${key}`);
  }

  /**
   * Retrieve from scratchpad.
   */
  retrieveScratchpad(key: string): unknown {
    return this.scratchpad.get(key);
  }

  /**
   * Clear scratchpad (session working memory).
   */
  clearScratchpad(): void {
    this.scratchpad.clear();
    this.logger.debug('Scratchpad cleared');
  }

  // -------------------------------------------------------------------------
  // Episodic Memory - Tier 2
  // -------------------------------------------------------------------------

  /**
   * Add episodic memory (recent interactions). Persists to SQLite.
   */
  addEpisodic(entry: Omit<MemoryEntry, 'id'>): MemoryEntry {
    const memoryEntry: MemoryEntry = {
      id: this.generateId(),
      ...entry,
    };

    this.episodic.push(memoryEntry);
    this.persistEntry(memoryEntry, 'episodic');
    this.lruCache.set(memoryEntry.id, memoryEntry);
    this.logger.debug(`Added episodic memory: ${memoryEntry.id}`);

    // Trigger compaction if needed
    if (this.episodic.length > this.config.retrieval.maxResults * 2) {
      this.compactEpisodic();
    }

    return memoryEntry;
  }

  // -------------------------------------------------------------------------
  // Semantic Memory - Tier 3
  // -------------------------------------------------------------------------

  /**
   * Add semantic memory (long-term knowledge). Persists to SQLite.
   */
  addSemantic(entry: Omit<MemoryEntry, 'id'>): MemoryEntry {
    const memoryEntry: MemoryEntry = {
      id: this.generateId(),
      ...entry,
    };

    this.semantic.push(memoryEntry);
    this.persistEntry(memoryEntry, 'semantic');
    this.lruCache.set(memoryEntry.id, memoryEntry);
    this.logger.debug(`Added semantic memory: ${memoryEntry.id}`);

    return memoryEntry;
  }

  // -------------------------------------------------------------------------
  // Retrieval (backward-compatible + enhanced)
  // -------------------------------------------------------------------------

  /**
   * Retrieve relevant memories based on query (keyword match).
   * Backward compatible with the original API.
   */
  retrieve(query: string, tier: MemoryTier = 'episodic'): MemoryEntry[] {
    const memories = tier === 'episodic' ? this.episodic : this.semantic;

    const relevant = memories.filter(entry =>
      entry.content.toLowerCase().includes(query.toLowerCase())
    );

    relevant.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return relevant.slice(0, this.config.retrieval.maxResults);
  }

  /**
   * Hybrid search combining FTS5 keyword search with optional vector similarity.
   *
   * When FTS5 is available, this performs a full-text query via the FTS index.
   * Results from both keyword and vector channels are merged using weighted
   * reciprocal rank fusion, following the same pattern as OpenClaw's
   * mergeHybridResults.
   */
  hybridSearch(
    query: string,
    options?: {
      maxResults?: number;
      minScore?: number;
      tiers?: MemoryTier[];
      queryEmbedding?: number[];
      vectorWeight?: number;
      textWeight?: number;
    }
  ): MemorySearchResult[] {
    const maxResults = options?.maxResults ?? this.config.retrieval.maxResults;
    const minScore = options?.minScore ?? 0;
    const tiers = options?.tiers ?? ['episodic', 'semantic'];
    const vectorWeight = options?.vectorWeight ?? 0.6;
    const textWeight = options?.textWeight ?? 0.4;

    const keywordResults = this.searchKeyword(query, tiers, maxResults * 3);
    const vectorResults = options?.queryEmbedding
      ? this.searchVector(options.queryEmbedding, tiers, maxResults * 3)
      : [];

    if (keywordResults.length === 0 && vectorResults.length === 0) {
      return [];
    }

    if (vectorResults.length === 0) {
      return keywordResults
        .filter(r => r.score >= minScore)
        .slice(0, maxResults);
    }

    if (keywordResults.length === 0) {
      return vectorResults
        .filter(r => r.score >= minScore)
        .slice(0, maxResults);
    }

    // Reciprocal rank fusion
    const merged = this.mergeHybridResults(
      keywordResults,
      vectorResults,
      textWeight,
      vectorWeight
    );

    return merged.filter(r => r.score >= minScore).slice(0, maxResults);
  }

  /**
   * Search using FTS5 full-text index (keyword search).
   */
  private searchKeyword(
    query: string,
    tiers: MemoryTier[],
    limit: number
  ): MemorySearchResult[] {
    if (!this.ftsAvailable || !this.db || this.dbBackend !== 'sqlite') {
      // Fallback to in-memory substring search
      return this.searchKeywordFallback(query, tiers, limit);
    }

    const ftsQuery = this.buildFtsQuery(query);
    if (!ftsQuery) {
      return this.searchKeywordFallback(query, tiers, limit);
    }

    try {
      const tierPlaceholders = tiers.map(() => '?').join(', ');
      const rows = this.db
        .prepare(
          `SELECT f.id, f.tier, f.type, rank
         FROM ${FTS_TABLE} f
         WHERE ${FTS_TABLE} MATCH ?
           AND f.tier IN (${tierPlaceholders})
         ORDER BY rank
         LIMIT ?`
        )
        .all(ftsQuery, ...tiers, limit) as Array<{
        id: string;
        tier: string;
        type: string;
        rank: number;
      }>;

      const results: MemorySearchResult[] = [];
      for (const row of rows) {
        const entry = this.getEntryById(row.id);
        if (!entry) {
          continue;
        }

        // Convert BM25 rank to a 0-1 score
        const score = this.bm25RankToScore(row.rank);
        results.push({
          entry,
          score,
          tier: row.tier as MemoryTier,
          matchType: 'keyword',
        });
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`FTS search failed, falling back: ${message}`);
      return this.searchKeywordFallback(query, tiers, limit);
    }
  }

  /**
   * Fallback keyword search when FTS5 is not available.
   */
  private searchKeywordFallback(
    query: string,
    tiers: MemoryTier[],
    limit: number
  ): MemorySearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);
    const results: MemorySearchResult[] = [];

    const allMemories: Array<{ entry: MemoryEntry; tier: MemoryTier }> = [];
    if (tiers.includes('episodic')) {
      for (const entry of this.episodic) {
        allMemories.push({ entry, tier: 'episodic' });
      }
    }
    if (tiers.includes('semantic')) {
      for (const entry of this.semantic) {
        allMemories.push({ entry, tier: 'semantic' });
      }
    }

    for (const { entry, tier } of allMemories) {
      const contentLower = entry.content.toLowerCase();

      // Calculate a simple TF-based score
      let matchedTerms = 0;
      let totalOccurrences = 0;
      for (const term of queryTerms) {
        let idx = -1;
        let count = 0;
        while ((idx = contentLower.indexOf(term, idx + 1)) !== -1) {
          count++;
        }
        if (count > 0) {
          matchedTerms++;
          totalOccurrences += count;
        }
      }

      if (matchedTerms === 0) {
        continue;
      }

      // Score: fraction of matched terms + small boost for frequency
      const termCoverage =
        queryTerms.length > 0 ? matchedTerms / queryTerms.length : 0;
      const frequencyBoost = Math.min(0.3, totalOccurrences * 0.02);
      const score = Math.min(1.0, termCoverage * 0.7 + frequencyBoost + 0.1);

      results.push({ entry, score, tier, matchType: 'keyword' });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Search using cosine similarity against stored embeddings.
   */
  private searchVector(
    queryEmbedding: number[],
    tiers: MemoryTier[],
    limit: number
  ): MemorySearchResult[] {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return [];
    }

    try {
      const tierPlaceholders = tiers.map(() => '?').join(', ');
      const rows = this.db
        .prepare(
          `SELECT id, tier, type, embedding
         FROM ${MEMORIES_TABLE}
         WHERE tier IN (${tierPlaceholders})
           AND embedding IS NOT NULL
           AND embedding != ''`
        )
        .all(...tiers) as Array<{
        id: string;
        tier: string;
        type: string;
        embedding: string;
      }>;

      const results: MemorySearchResult[] = [];
      for (const row of rows) {
        let storedEmbedding: number[];
        try {
          storedEmbedding = JSON.parse(row.embedding) as number[];
        } catch {
          continue;
        }

        const similarity = this.cosineSimilarity(
          queryEmbedding,
          storedEmbedding
        );
        if (similarity <= 0) {
          continue;
        }

        const entry = this.getEntryById(row.id);
        if (!entry) {
          continue;
        }

        results.push({
          entry,
          score: similarity,
          tier: row.tier as MemoryTier,
          matchType: 'vector',
        });
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Merge keyword and vector results using reciprocal rank fusion (RRF).
   * Follows the hybrid result merging pattern from OpenClaw.
   */
  private mergeHybridResults(
    keywordResults: MemorySearchResult[],
    vectorResults: MemorySearchResult[],
    textWeight: number,
    vectorWeight: number
  ): MemorySearchResult[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<
      string,
      {
        entry: MemoryEntry;
        tier: MemoryTier;
        score: number;
      }
    >();

    for (let i = 0; i < keywordResults.length; i++) {
      const result = keywordResults[i]!;
      const rrfScore = textWeight / (k + i + 1);
      const existing = scoreMap.get(result.entry.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.entry.id, {
          entry: result.entry,
          tier: result.tier,
          score: rrfScore,
        });
      }
    }

    for (let i = 0; i < vectorResults.length; i++) {
      const result = vectorResults[i]!;
      const rrfScore = vectorWeight / (k + i + 1);
      const existing = scoreMap.get(result.entry.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.entry.id, {
          entry: result.entry,
          tier: result.tier,
          score: rrfScore,
        });
      }
    }

    const merged = Array.from(scoreMap.values());
    merged.sort((a, b) => b.score - a.score);

    // Normalize scores to 0-1 range
    const maxScore = merged[0]?.score ?? 1;
    return merged.map(item => ({
      entry: item.entry,
      score: maxScore > 0 ? item.score / maxScore : 0,
      tier: item.tier,
      matchType: 'hybrid' as const,
    }));
  }

  // -------------------------------------------------------------------------
  // Batch Operations
  // -------------------------------------------------------------------------

  /**
   * Insert or update multiple memory entries in a single transaction.
   * Follows the batch embedding pattern from OpenClaw.
   */
  batchUpsert(
    entries: Array<Omit<MemoryEntry, 'id'> & { id?: string }>,
    tier: MemoryTier
  ): BatchResult {
    const result: BatchResult = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    if (tier === 'scratchpad') {
      result.errors.push(
        'Batch operations are not supported for the scratchpad tier'
      );
      result.failed = entries.length;
      return result;
    }

    const tierArray = tier === 'episodic' ? this.episodic : this.semantic;

    if (this.db && this.dbBackend === 'sqlite') {
      try {
        this.execSql('BEGIN TRANSACTION');

        for (const rawEntry of entries) {
          try {
            const id = rawEntry.id ?? this.generateId();
            const entry: MemoryEntry = { ...rawEntry, id };

            const existing = tierArray.find(e => e.id === id);
            if (existing) {
              Object.assign(existing, entry);
              result.updated++;
            } else {
              tierArray.push(entry);
              result.inserted++;
            }

            this.persistEntry(entry, tier);
            this.lruCache.set(entry.id, entry);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            result.errors.push(message);
            result.failed++;
          }
        }

        this.execSql('COMMIT');
      } catch (err) {
        try {
          this.execSql('ROLLBACK');
        } catch {
          /* ignore rollback errors */
        }
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Transaction failed: ${message}`);
        result.failed = entries.length;
        result.inserted = 0;
        result.updated = 0;
      }
    } else {
      // In-memory fallback: no transaction needed
      for (const rawEntry of entries) {
        try {
          const id = rawEntry.id ?? this.generateId();
          const entry: MemoryEntry = { ...rawEntry, id };

          const existing = tierArray.find(e => e.id === id);
          if (existing) {
            Object.assign(existing, entry);
            result.updated++;
          } else {
            tierArray.push(entry);
            result.inserted++;
          }
          this.lruCache.set(entry.id, entry);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          result.errors.push(message);
          result.failed++;
        }
      }
    }

    this.logger.info(
      `Batch upsert to ${tier}: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed`
    );

    return result;
  }

  // -------------------------------------------------------------------------
  // Session Transcript Indexing
  // -------------------------------------------------------------------------

  /**
   * Index session transcript entries with delta tracking.
   *
   * Only indexes turns beyond the last indexed turn for the given session,
   * following the session delta tracking pattern from OpenClaw.
   */
  indexSessionTranscript(
    sessionId: string,
    entries: SessionTranscriptEntry[]
  ): { indexed: number; skipped: number } {
    let delta = this.sessionDeltas.get(sessionId);
    if (!delta) {
      delta = { lastIndexedTurn: 0, lastIndexedAt: 0, pendingTurns: 0 };
      this.sessionDeltas.set(sessionId, delta);
    }

    const newEntries = entries.filter(
      e => e.turnNumber > delta!.lastIndexedTurn
    );
    if (newEntries.length === 0) {
      return { indexed: 0, skipped: entries.length };
    }

    // Convert transcript entries to memory entries
    const memoryEntries: Array<Omit<MemoryEntry, 'id'> & { id?: string }> =
      newEntries.map(e => ({
        content: `[${e.role}] ${e.content}`,
        timestamp: e.timestamp,
        type: 'interaction' as const,
        metadata: {
          sessionId: e.sessionId,
          role: e.role,
          turnNumber: e.turnNumber,
          source: 'transcript',
        },
      }));

    const batchResult = this.batchUpsert(memoryEntries, 'episodic');

    // Update delta state
    const maxTurn = newEntries.reduce(
      (max, e) => Math.max(max, e.turnNumber),
      0
    );
    delta.lastIndexedTurn = maxTurn;
    delta.lastIndexedAt = Date.now();
    delta.pendingTurns = 0;
    this.persistSessionDelta(sessionId, delta);

    return {
      indexed: batchResult.inserted + batchResult.updated,
      skipped: entries.length - newEntries.length,
    };
  }

  /**
   * Get the delta tracking state for a session.
   */
  getSessionDelta(sessionId: string): SessionDeltaState | undefined {
    return this.sessionDeltas.get(sessionId);
  }

  // -------------------------------------------------------------------------
  // Memory Compaction with Summarization
  // -------------------------------------------------------------------------

  /**
   * Compact episodic memory by summarizing old entries.
   * Archives older entries to semantic memory with a summary.
   */
  private compactEpisodic(): void {
    if (!this.config.compaction.enabled) {
      return;
    }

    const threshold = Math.floor(
      this.episodic.length * this.config.compaction.threshold
    );

    if (this.episodic.length > threshold) {
      this.logger.info('Compacting episodic memory...');

      const toArchive = this.episodic.slice(
        0,
        this.episodic.length - this.config.retrieval.maxResults
      );

      const summary: MemoryEntry = {
        id: this.generateId(),
        content: `Archived summary of ${toArchive.length} interactions`,
        timestamp: new Date(),
        type: 'knowledge',
        metadata: {
          archived: toArchive.length,
          period: {
            start: toArchive[0]?.timestamp,
            end: toArchive[toArchive.length - 1]?.timestamp,
          },
        },
      };

      this.semantic.push(summary);
      this.persistEntry(summary, 'semantic');

      // Remove archived entries from DB
      for (const entry of toArchive) {
        this.deletePersistedEntry(entry.id);
        this.lruCache.delete(entry.id);
      }

      this.episodic = this.episodic.slice(-this.config.retrieval.maxResults);
      this.lastCompactionAt = Date.now();

      this.logger.info(
        `Compaction complete. Archived ${toArchive.length} entries.`
      );
    }
  }

  /**
   * Run a full compaction pass across all tiers. Returns statistics.
   *
   * This is the explicit compaction API (as opposed to the automatic
   * compaction triggered by addEpisodic).
   */
  runCompaction(options?: { targetEpisodicSize?: number }): CompactionResult {
    const entriesBefore = this.episodic.length;
    const targetSize =
      options?.targetEpisodicSize ?? this.config.retrieval.maxResults;

    if (this.episodic.length <= targetSize) {
      return {
        archived: 0,
        summariesCreated: 0,
        entriesBefore,
        entriesAfter: this.episodic.length,
      };
    }

    const toArchive = this.episodic.slice(0, this.episodic.length - targetSize);

    // Group by type for better summaries
    const byType = new Map<string, MemoryEntry[]>();
    for (const entry of toArchive) {
      const group = byType.get(entry.type) ?? [];
      group.push(entry);
      byType.set(entry.type, group);
    }

    let summariesCreated = 0;
    for (const [type, group] of byType) {
      const summary: MemoryEntry = {
        id: this.generateId(),
        content: this.buildCompactionSummary(group),
        timestamp: new Date(),
        type: 'knowledge',
        metadata: {
          compactionSource: type,
          archived: group.length,
          period: {
            start: group[0]?.timestamp,
            end: group[group.length - 1]?.timestamp,
          },
        },
      };

      this.semantic.push(summary);
      this.persistEntry(summary, 'semantic');
      summariesCreated++;
    }

    // Remove archived entries
    for (const entry of toArchive) {
      this.deletePersistedEntry(entry.id);
      this.lruCache.delete(entry.id);
    }

    this.episodic = this.episodic.slice(-targetSize);
    this.lastCompactionAt = Date.now();

    return {
      archived: toArchive.length,
      summariesCreated,
      entriesBefore,
      entriesAfter: this.episodic.length,
    };
  }

  /**
   * Build a human-readable summary from a group of archived entries.
   */
  private buildCompactionSummary(entries: MemoryEntry[]): string {
    if (entries.length === 0) {
      return 'Empty archive';
    }

    const firstTimestamp = entries[0]?.timestamp;
    const lastTimestamp = entries[entries.length - 1]?.timestamp;
    const types = new Set(entries.map(e => e.type));
    const uniqueTypes = Array.from(types).join(', ');

    // Extract key phrases from content (first 3 entries preview)
    const previews = entries
      .slice(0, 3)
      .map(e => e.content.slice(0, 100))
      .join('; ');

    const parts = [
      `Archived summary of ${entries.length} ${uniqueTypes} entries`,
    ];

    if (firstTimestamp && lastTimestamp) {
      const startStr =
        firstTimestamp instanceof Date
          ? firstTimestamp.toISOString().split('T')[0]
          : String(firstTimestamp);
      const endStr =
        lastTimestamp instanceof Date
          ? lastTimestamp.toISOString().split('T')[0]
          : String(lastTimestamp);
      parts.push(`from ${startStr} to ${endStr}`);
    }

    parts.push(`Preview: ${previews}`);

    return parts.join('. ');
  }

  // -------------------------------------------------------------------------
  // Entry Lookup
  // -------------------------------------------------------------------------

  /**
   * Get a single memory entry by ID, checking the LRU cache first.
   */
  getEntryById(id: string): MemoryEntry | null {
    // Check LRU cache first
    const cached = this.lruCache.get(id);
    if (cached) {
      return cached;
    }

    // Check in-memory arrays
    const episodic = this.episodic.find(e => e.id === id);
    if (episodic) {
      this.lruCache.set(id, episodic);
      return episodic;
    }

    const semantic = this.semantic.find(e => e.id === id);
    if (semantic) {
      this.lruCache.set(id, semantic);
      return semantic;
    }

    // Check SQLite
    if (this.db && this.dbBackend === 'sqlite') {
      try {
        const row = this.db
          .prepare(
            `SELECT id, content, type, timestamp, metadata
           FROM ${MEMORIES_TABLE}
           WHERE id = ?`
          )
          .get(id) as {
          id: string;
          content: string;
          type: string;
          timestamp: number;
          metadata: string | null;
        } | null;

        if (row) {
          const entry = this.rowToEntry(row);
          this.lruCache.set(id, entry);
          return entry;
        }
      } catch {
        // Silently fall through
      }
    }

    return null;
  }

  /**
   * Delete a memory entry by ID from all stores.
   */
  deleteEntry(id: string): boolean {
    let found = false;

    const episodicIdx = this.episodic.findIndex(e => e.id === id);
    if (episodicIdx >= 0) {
      this.episodic.splice(episodicIdx, 1);
      found = true;
    }

    const semanticIdx = this.semantic.findIndex(e => e.id === id);
    if (semanticIdx >= 0) {
      this.semantic.splice(semanticIdx, 1);
      found = true;
    }

    this.deletePersistedEntry(id);
    this.lruCache.delete(id);

    return found;
  }

  // -------------------------------------------------------------------------
  // Statistics and Health
  // -------------------------------------------------------------------------

  /**
   * Get memory statistics (backward compatible).
   */
  getStats() {
    return {
      scratchpadSize: this.scratchpad.size,
      episodicCount: this.episodic.length,
      semanticCount: this.semantic.length,
    };
  }

  /**
   * Get a detailed health report of the memory subsystem.
   */
  getHealthReport(): MemoryHealthReport {
    let dbEpisodicCount = this.episodic.length;
    let dbSemanticCount = this.semantic.length;
    let dbSizeBytes = 0;

    if (this.db && this.dbBackend === 'sqlite') {
      try {
        const epCount = this.db
          .prepare(
            `SELECT COUNT(*) as count FROM ${MEMORIES_TABLE} WHERE tier = ?`
          )
          .get('episodic') as { count: number } | null;
        dbEpisodicCount = epCount?.count ?? this.episodic.length;

        const semCount = this.db
          .prepare(
            `SELECT COUNT(*) as count FROM ${MEMORIES_TABLE} WHERE tier = ?`
          )
          .get('semantic') as { count: number } | null;
        dbSemanticCount = semCount?.count ?? this.semantic.length;

        const pageCountResult = this.db.pragma('page_count') as
          | Array<{ page_count: number }>
          | number;
        const pageSizeResult = this.db.pragma('page_size') as
          | Array<{ page_size: number }>
          | number;

        const pageCount = Array.isArray(pageCountResult)
          ? (pageCountResult[0]?.page_count ?? 0)
          : typeof pageCountResult === 'number'
            ? pageCountResult
            : 0;
        const pageSize = Array.isArray(pageSizeResult)
          ? (pageSizeResult[0]?.page_size ?? 4096)
          : typeof pageSizeResult === 'number'
            ? pageSizeResult
            : 4096;
        dbSizeBytes = pageCount * pageSize;
      } catch {
        // Keep defaults
      }
    }

    const hasErrors = this.errors.length > 0;

    return {
      status: hasErrors ? 'degraded' : 'healthy',
      backend: this.dbBackend,
      fts: {
        enabled: this.persistenceConfig.ftsEnabled,
        available: this.ftsAvailable,
        error: this.ftsError,
      },
      tiers: {
        scratchpad: { size: this.scratchpad.size },
        episodic: { count: this.episodic.length, dbCount: dbEpisodicCount },
        semantic: { count: this.semantic.length, dbCount: dbSemanticCount },
      },
      lruCache: {
        size: this.lruCache.size,
        maxSize: this.persistenceConfig.lruCacheSize,
        hitRate: this.lruCache.hitRate,
      },
      dbSizeBytes,
      lastCompactionAt: this.lastCompactionAt,
      errors: [...this.errors],
    };
  }

  // -------------------------------------------------------------------------
  // Import / Export
  // -------------------------------------------------------------------------

  /**
   * Export memory context (backward compatible).
   */
  exportContext(): MemoryContext {
    return {
      scratchpad: Object.fromEntries(this.scratchpad),
      episodic: [...this.episodic],
      semantic: [...this.semantic],
    };
  }

  /**
   * Import memory context (backward compatible).
   */
  importContext(context: MemoryContext): void {
    this.scratchpad = new Map(Object.entries(context.scratchpad));
    this.episodic = [...context.episodic];
    this.semantic = [...context.semantic];

    // Persist imported entries to SQLite
    if (this.db && this.dbBackend === 'sqlite') {
      try {
        this.execSql('BEGIN TRANSACTION');
        for (const entry of this.episodic) {
          this.persistEntry(entry, 'episodic');
        }
        for (const entry of this.semantic) {
          this.persistEntry(entry, 'semantic');
        }
        this.execSql('COMMIT');
      } catch (err) {
        try {
          this.execSql('ROLLBACK');
        } catch {
          /* ignore */
        }
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to persist imported context: ${message}`);
      }
    }

    this.logger.info('Memory context imported');
  }

  /**
   * Export a full snapshot including persistence metadata.
   */
  exportSnapshot(): MemorySnapshot {
    const deltas: Record<string, SessionDeltaState> = {};
    for (const [key, value] of this.sessionDeltas) {
      deltas[key] = { ...value };
    }

    return {
      version: String(SCHEMA_VERSION),
      exportedAt: new Date().toISOString(),
      scratchpad: Object.fromEntries(this.scratchpad),
      episodic: this.episodic.map(e => ({
        ...e,
        timestamp:
          e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp),
      })),
      semantic: this.semantic.map(e => ({
        ...e,
        timestamp:
          e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp),
      })),
      sessionDeltas: deltas,
    };
  }

  /**
   * Import a full snapshot, replacing all current state.
   */
  importSnapshot(snapshot: MemorySnapshot): void {
    // Clear existing state
    this.scratchpad.clear();
    this.episodic = [];
    this.semantic = [];
    this.lruCache.clear();
    this.sessionDeltas.clear();

    if (this.db && this.dbBackend === 'sqlite') {
      try {
        this.execSql(`DELETE FROM ${MEMORIES_TABLE}`);
        if (this.ftsAvailable) {
          this.execSql(`DELETE FROM ${FTS_TABLE}`);
        }
        this.execSql(`DELETE FROM ${SESSION_DELTAS_TABLE}`);
      } catch {
        // Best effort
      }
    }

    // Import scratchpad
    this.scratchpad = new Map(Object.entries(snapshot.scratchpad));

    // Import episodic
    const episodicEntries = snapshot.episodic.map(e => ({
      ...e,
      timestamp:
        e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp),
    }));
    this.episodic = episodicEntries;

    // Import semantic
    const semanticEntries = snapshot.semantic.map(e => ({
      ...e,
      timestamp:
        e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp),
    }));
    this.semantic = semanticEntries;

    // Import session deltas
    for (const [key, value] of Object.entries(snapshot.sessionDeltas)) {
      this.sessionDeltas.set(key, { ...value });
    }

    // Persist everything
    if (this.db && this.dbBackend === 'sqlite') {
      try {
        this.execSql('BEGIN TRANSACTION');
        for (const entry of this.episodic) {
          this.persistEntry(entry, 'episodic');
        }
        for (const entry of this.semantic) {
          this.persistEntry(entry, 'semantic');
        }
        for (const [sessionId, delta] of this.sessionDeltas) {
          this.persistSessionDelta(sessionId, delta);
        }
        this.execSql('COMMIT');
      } catch (err) {
        try {
          this.execSql('ROLLBACK');
        } catch {
          /* ignore */
        }
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to persist snapshot: ${message}`);
      }
    }

    this.logger.info(
      `Snapshot imported: ${this.episodic.length} episodic, ${this.semantic.length} semantic`
    );
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Close the database connection and release resources.
   */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (this.db) {
      try {
        this.db.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Error closing database: ${message}`);
      }
      this.db = null;
    }

    this.lruCache.clear();
    this.logger.info('Memory manager closed');
  }

  // -------------------------------------------------------------------------
  // Store an embedding for a memory entry
  // -------------------------------------------------------------------------

  /**
   * Attach an embedding vector to an existing memory entry.
   * This enables vector similarity search via hybridSearch.
   */
  storeEmbedding(id: string, embedding: number[]): boolean {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return false;
    }

    try {
      const result = this.db
        .prepare(
          `UPDATE ${MEMORIES_TABLE}
         SET embedding = ?, updated_at = unixepoch('now')
         WHERE id = ?`
        )
        .run(JSON.stringify(embedding), id);

      return result.changes > 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to store embedding: ${message}`);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Private: SQL execution wrapper
  // -------------------------------------------------------------------------

  /**
   * Execute raw SQL on the database. This wraps the underlying db.run()
   * method (for better-sqlite3, the method is called exec; for our
   * InMemoryDatabase, it is run). We unify through this helper.
   */
  private execSql(sql: string): void {
    if (!this.db) {
      return;
    }

    // better-sqlite3 Database has an `exec` method for raw SQL.
    // We stored a reference whose interface calls it `run`, but the actual
    // better-sqlite3 object exposes `exec`. We use a type assertion here
    // because our minimal SqliteDatabase interface intentionally only
    // declares `run` to stay compatible with the InMemoryDatabase polyfill.
    const dbAny = this.db as unknown as {
      exec?: (sql: string) => void;
      run: (sql: string) => void;
    };
    if (typeof dbAny.exec === 'function') {
      dbAny.exec(sql);
    } else {
      dbAny.run(sql);
    }
  }

  // -------------------------------------------------------------------------
  // Private: Persistence Helpers
  // -------------------------------------------------------------------------

  /**
   * Persist a single memory entry to SQLite.
   */
  private persistEntry(entry: MemoryEntry, tier: MemoryTier): void {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return;
    }

    try {
      const timestamp =
        entry.timestamp instanceof Date
          ? entry.timestamp.getTime()
          : entry.timestamp;
      const metadata = entry.metadata ? JSON.stringify(entry.metadata) : null;
      const hash = this.hashContent(entry.content);

      this.db
        .prepare(
          `INSERT OR REPLACE INTO ${MEMORIES_TABLE}
           (id, tier, content, type, timestamp, metadata, hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'))`
        )
        .run(
          entry.id,
          tier,
          entry.content,
          entry.type,
          timestamp,
          metadata,
          hash
        );

      // Update FTS index
      if (this.ftsAvailable) {
        try {
          // Delete old FTS entry if exists
          this.db
            .prepare(`DELETE FROM ${FTS_TABLE} WHERE id = ?`)
            .run(entry.id);

          this.db
            .prepare(
              `INSERT INTO ${FTS_TABLE} (content, id, tier, type)
             VALUES (?, ?, ?, ?)`
            )
            .run(entry.content, entry.id, tier, entry.type);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.debug(`FTS insert failed for ${entry.id}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.errors.push(`Persist failed for ${entry.id}: ${message}`);
      this.logger.warn(`Failed to persist entry ${entry.id}: ${message}`);
    }
  }

  /**
   * Delete a persisted entry from SQLite.
   */
  private deletePersistedEntry(id: string): void {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return;
    }

    try {
      this.db.prepare(`DELETE FROM ${MEMORIES_TABLE} WHERE id = ?`).run(id);

      if (this.ftsAvailable) {
        try {
          this.db.prepare(`DELETE FROM ${FTS_TABLE} WHERE id = ?`).run(id);
        } catch {
          // Best effort
        }
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Persist session delta tracking state to SQLite.
   */
  private persistSessionDelta(
    sessionId: string,
    delta: SessionDeltaState
  ): void {
    if (!this.db || this.dbBackend !== 'sqlite') {
      return;
    }

    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO ${SESSION_DELTAS_TABLE}
           (session_id, last_indexed_turn, last_indexed_at, pending_turns)
         VALUES (?, ?, ?, ?)`
        )
        .run(
          sessionId,
          delta.lastIndexedTurn,
          delta.lastIndexedAt,
          delta.pendingTurns
        );
    } catch {
      // Best effort
    }
  }

  // -------------------------------------------------------------------------
  // Private: Helpers
  // -------------------------------------------------------------------------

  /**
   * Convert a database row to a MemoryEntry.
   */
  private rowToEntry(row: {
    id: string;
    content: string;
    type: string;
    timestamp: number;
    metadata: string | null;
  }): MemoryEntry {
    let metadata: Record<string, unknown> | undefined;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        metadata = undefined;
      }
    }

    return {
      id: row.id,
      content: row.content,
      type: row.type as MemoryEntry['type'],
      timestamp: new Date(row.timestamp),
      metadata,
    };
  }

  /**
   * Generate unique ID for memory entries.
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Compute a content hash for deduplication and change detection.
   */
  private hashContent(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Build a safe FTS5 query from a raw search string.
   * Escapes special characters and handles multi-word queries.
   * Follows the pattern from OpenClaw's buildFtsQuery.
   */
  private buildFtsQuery(raw: string): string | null {
    const cleaned = raw.trim();
    if (!cleaned) {
      return null;
    }

    // Tokenize, escape double quotes, wrap each token
    const tokens = cleaned
      .split(/\s+/)
      .filter(t => t.length > 0)
      .map(t => `"${t.replace(/"/g, '""')}"`)
      .slice(0, 20); // Limit tokens

    if (tokens.length === 0) {
      return null;
    }

    return tokens.join(' OR ');
  }

  /**
   * Convert BM25 rank (negative, lower = better) to a 0-1 score.
   * Follows OpenClaw's bm25RankToScore normalization.
   */
  private bm25RankToScore(rank: number): number {
    // FTS5 rank is negative; more negative = more relevant
    const absRank = Math.abs(rank);
    // Sigmoid-like normalization
    return absRank / (absRank + 1);
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const ai = a[i]!;
      const bi = b[i]!;
      dotProduct += ai * bi;
      normA += ai * ai;
      normB += bi * bi;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}
