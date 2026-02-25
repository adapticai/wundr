/**
 * SQLiteBackend - Persistent storage layer for the tiered memory system.
 *
 * Provides SQLite-backed persistence for chunks, files, memories, and metadata
 * with support for atomic reindexing via temp-DB swap. Inspired by OpenClaw's
 * MemoryIndexManager but adapted for Wundr's MemGPT three-tier architecture.
 *
 * @module backends/sqlite-backend
 */

import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Index metadata stored in the `meta` table. Used to detect when a full
 * reindex is required (e.g. when the embedding model changes).
 */
export interface IndexMeta {
  model: string;
  provider: string;
  chunkTokens: number;
  chunkOverlap: number;
  vectorDims?: number;
}

/**
 * A tracked file record (memory files or session transcripts).
 */
export interface FileRecord {
  path: string;
  source: MemorySource;
  hash: string;
  mtime: number;
  size: number;
}

/**
 * A single chunk record with its embedding stored as a JSON string.
 */
export interface ChunkRecord {
  id: string;
  path: string;
  source: MemorySource;
  startLine: number;
  endLine: number;
  hash: string;
  model: string;
  text: string;
  embedding: string;
  updatedAt: number;
}

/**
 * A persisted memory entry from any tier.
 */
export interface SerializedMemory {
  id: string;
  tier: MemoryTier;
  content: string;
  tokenCount: number;
  metadata: string;
  embedding: string | null;
  linkedMemories: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Session delta tracking state for incremental indexing.
 */
export interface SessionDelta {
  lastSize: number;
  pendingBytes: number;
  pendingMessages: number;
}

/**
 * Context handle for an in-progress atomic reindex operation.
 */
export interface TempDatabaseContext {
  tempDbPath: string;
  tempDb: DatabaseHandle;
  originalDbPath: string;
}

export type MemorySource = 'memory' | 'sessions' | 'scratchpad';
export type MemoryTier = 'scratchpad' | 'episodic' | 'semantic';

/**
 * Options for opening the SQLite database.
 */
export interface OpenOptions {
  /** Enable loading native extensions (required for sqlite-vec). */
  allowExtension?: boolean;
  /** Enable WAL journal mode for concurrent read access. */
  walMode?: boolean;
}

// ---------------------------------------------------------------------------
// Internal abstraction over node:sqlite
// ---------------------------------------------------------------------------

/**
 * Minimal interface over `node:sqlite`'s `DatabaseSync` so that callers do
 * not need to import the built-in module directly.
 */
export interface DatabaseHandle {
  exec(sql: string): void;
  prepare(sql: string): StatementHandle;
  close(): void;
  enableLoadExtension?(allow: boolean): void;
  loadExtension?(path: string): void;
}

interface StatementHandle {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

const META_KEY = 'memory_index_meta_v1';
const VECTOR_TABLE = 'chunks_vec';
const FTS_TABLE = 'chunks_fts';
const EMBEDDING_CACHE_TABLE = 'embedding_cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// SQLiteBackend
// ---------------------------------------------------------------------------

export class SQLiteBackend {
  private db: DatabaseHandle | null = null;
  private dbPath: string = '';
  private allowExtension: boolean = false;
  private ftsAvailable: boolean = false;
  private ftsError?: string;
  private sessionDeltas: Map<string, SessionDelta> = new Map();

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Open or create a SQLite database at the given path.
   *
   * Creates the parent directory if it does not exist and applies WAL journal
   * mode by default for better concurrent-read performance.
   */
  open(dbPath: string, options: OpenOptions = {}): void {
    this.dbPath = path.resolve(dbPath);
    this.allowExtension = options.allowExtension ?? false;
    ensureDir(path.dirname(this.dbPath));

    const { DatabaseSync } = requireNodeSqlite();
    this.db = new DatabaseSync(this.dbPath, {
      allowExtension: this.allowExtension,
    }) as unknown as DatabaseHandle;

    if (options.walMode !== false) {
      this.db.exec('PRAGMA journal_mode=WAL');
    }
    this.db.exec('PRAGMA busy_timeout = 5000');
  }

  /**
   * Close the database connection and release resources.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Return the underlying database handle (for vector-search / hybrid-search
   * modules that need direct access).
   */
  getDb(): DatabaseHandle {
    if (!this.db) {
      throw new Error('SQLiteBackend: database is not open');
    }
    return this.db;
  }

  /**
   * Return the resolved database file path.
   */
  getDbPath(): string {
    return this.dbPath;
  }

  // =========================================================================
  // Schema
  // =========================================================================

  /**
   * Create all required tables and indexes if they do not already exist.
   *
   * FTS5 creation is attempted but non-fatal -- the `ftsAvailable` flag
   * records whether it succeeded.
   */
  ensureSchema(): { ftsAvailable: boolean; ftsError?: string } {
    const db = this.requireDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        source TEXT NOT NULL DEFAULT 'memory',
        hash TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        size INTEGER NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'memory',
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        hash TEXT NOT NULL,
        model TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);');

    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        tier TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        metadata TEXT NOT NULL,
        embedding TEXT,
        linked_memories TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);');
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);'
    );

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${EMBEDDING_CACHE_TABLE} (
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        hash TEXT NOT NULL,
        embedding TEXT NOT NULL,
        dims INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (provider, model, hash)
      );
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at ON ${EMBEDDING_CACHE_TABLE}(updated_at);`
    );

    // Attempt FTS5 creation -- may fail on some SQLite builds
    try {
      db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(\n` +
          `  text,\n` +
          `  id UNINDEXED,\n` +
          `  path UNINDEXED,\n` +
          `  source UNINDEXED,\n` +
          `  model UNINDEXED,\n` +
          `  start_line UNINDEXED,\n` +
          `  end_line UNINDEXED\n` +
          `);`
      );
      this.ftsAvailable = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.ftsAvailable = false;
      this.ftsError = message;
    }

    return {
      ftsAvailable: this.ftsAvailable,
      ...(this.ftsError ? { ftsError: this.ftsError } : {}),
    };
  }

  /**
   * Whether FTS5 is available after schema initialization.
   */
  isFtsAvailable(): boolean {
    return this.ftsAvailable;
  }

  // =========================================================================
  // Meta
  // =========================================================================

  /**
   * Read the index metadata from the `meta` table. Returns `null` if no
   * metadata is stored (first run or after a reset).
   */
  readMeta(): IndexMeta | null {
    const db = this.requireDb();
    const row = db
      .prepare('SELECT value FROM meta WHERE key = ?')
      .get(META_KEY) as { value: string } | undefined;
    if (!row?.value) {
      return null;
    }
    try {
      return JSON.parse(row.value) as IndexMeta;
    } catch {
      return null;
    }
  }

  /**
   * Write index metadata. Uses upsert semantics so it works on both first
   * write and subsequent updates.
   */
  writeMeta(meta: IndexMeta): void {
    const db = this.requireDb();
    const value = JSON.stringify(meta);
    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    ).run(META_KEY, value);
  }

  // =========================================================================
  // Chunk Operations
  // =========================================================================

  /**
   * Upsert a batch of chunks for a given file path and source.
   *
   * Existing chunks for the same path/source are deleted first, then the new
   * chunks are inserted along with their FTS and vector index entries.
   */
  upsertChunks(
    filePath: string,
    source: MemorySource,
    model: string,
    chunks: ChunkRecord[],
    options?: {
      ftsEnabled?: boolean;
      vectorInsert?: (id: string, embedding: number[]) => void;
    }
  ): void {
    const db = this.requireDb();

    // Delete existing chunks for this path/source
    db.prepare('DELETE FROM chunks WHERE path = ? AND source = ?').run(
      filePath,
      source
    );

    if (this.ftsAvailable && options?.ftsEnabled !== false) {
      try {
        db.prepare(
          `DELETE FROM ${FTS_TABLE} WHERE path = ? AND source = ? AND model = ?`
        ).run(filePath, source, model);
      } catch {
        // FTS delete may fail if table was never populated
      }
    }

    const insertChunk = db.prepare(
      `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         hash=excluded.hash,
         model=excluded.model,
         text=excluded.text,
         embedding=excluded.embedding,
         updated_at=excluded.updated_at`
    );

    const insertFts =
      this.ftsAvailable && options?.ftsEnabled !== false
        ? db.prepare(
            `INSERT INTO ${FTS_TABLE} (text, id, path, source, model, start_line, end_line)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
        : null;

    db.exec('BEGIN');
    try {
      for (const chunk of chunks) {
        insertChunk.run(
          chunk.id,
          chunk.path,
          chunk.source,
          chunk.startLine,
          chunk.endLine,
          chunk.hash,
          chunk.model,
          chunk.text,
          chunk.embedding,
          chunk.updatedAt
        );

        if (insertFts) {
          insertFts.run(
            chunk.text,
            chunk.id,
            chunk.path,
            chunk.source,
            chunk.model,
            chunk.startLine,
            chunk.endLine
          );
        }

        if (options?.vectorInsert) {
          try {
            const embeddingArray = JSON.parse(chunk.embedding) as number[];
            if (embeddingArray.length > 0) {
              options.vectorInsert(chunk.id, embeddingArray);
            }
          } catch {
            // Skip vector insert on parse failure
          }
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Rollback may fail if transaction was already aborted
      }
      throw err;
    }
  }

  /**
   * Delete all chunks (and associated FTS/vector entries) for a given
   * path and source.
   */
  deleteChunksForPath(filePath: string, source: MemorySource): void {
    const db = this.requireDb();
    db.prepare('DELETE FROM chunks WHERE path = ? AND source = ?').run(
      filePath,
      source
    );
    if (this.ftsAvailable) {
      try {
        db.prepare(
          `DELETE FROM ${FTS_TABLE} WHERE path = ? AND source = ?`
        ).run(filePath, source);
      } catch {
        // Non-fatal
      }
    }
  }

  /**
   * List all chunks for a given model and optional source filter.
   */
  listChunks(model: string, source?: MemorySource): ChunkRecord[] {
    const db = this.requireDb();
    const sourceClause = source ? ' AND source = ?' : '';
    const params: unknown[] = [model];
    if (source) {
      params.push(source);
    }

    const rows = db
      .prepare(
        `SELECT id, path, source, start_line, end_line, hash, model, text, embedding, updated_at
         FROM chunks WHERE model = ?${sourceClause}`
      )
      .all(...params) as Array<{
      id: string;
      path: string;
      source: MemorySource;
      start_line: number;
      end_line: number;
      hash: string;
      model: string;
      text: string;
      embedding: string;
      updated_at: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      path: row.path,
      source: row.source,
      startLine: row.start_line,
      endLine: row.end_line,
      hash: row.hash,
      model: row.model,
      text: row.text,
      embedding: row.embedding,
      updatedAt: row.updated_at,
    }));
  }

  // =========================================================================
  // File Tracking
  // =========================================================================

  /**
   * Look up a tracked file by its relative path.
   */
  getFileRecord(filePath: string): FileRecord | null {
    const db = this.requireDb();
    const row = db
      .prepare(
        'SELECT path, source, hash, mtime, size FROM files WHERE path = ?'
      )
      .get(filePath) as
      | {
          path: string;
          source: MemorySource;
          hash: string;
          mtime: number;
          size: number;
        }
      | undefined;
    if (!row) {
      return null;
    }
    return {
      path: row.path,
      source: row.source,
      hash: row.hash,
      mtime: row.mtime,
      size: row.size,
    };
  }

  /**
   * Insert or update a file tracking record.
   */
  upsertFileRecord(record: FileRecord): void {
    const db = this.requireDb();
    db.prepare(
      `INSERT INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         source=excluded.source,
         hash=excluded.hash,
         mtime=excluded.mtime,
         size=excluded.size`
    ).run(record.path, record.source, record.hash, record.mtime, record.size);
  }

  /**
   * Delete file records (and their chunks) that are no longer in the active
   * file set for a given source. This garbage-collects deleted files.
   */
  deleteStaleFiles(activePaths: Set<string>, source: MemorySource): void {
    const db = this.requireDb();
    const staleRows = db
      .prepare('SELECT path FROM files WHERE source = ?')
      .all(source) as Array<{ path: string }>;

    for (const stale of staleRows) {
      if (activePaths.has(stale.path)) {
        continue;
      }
      db.prepare('DELETE FROM files WHERE path = ? AND source = ?').run(
        stale.path,
        source
      );
      this.deleteChunksForPath(stale.path, source);
    }
  }

  // =========================================================================
  // Memory Tier Persistence
  // =========================================================================

  /**
   * Persist a memory entry from any tier.
   */
  storeMemory(memory: SerializedMemory): void {
    const db = this.requireDb();
    db.prepare(
      `INSERT INTO memories (id, tier, content, token_count, metadata, embedding, linked_memories, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         tier=excluded.tier,
         content=excluded.content,
         token_count=excluded.token_count,
         metadata=excluded.metadata,
         embedding=excluded.embedding,
         linked_memories=excluded.linked_memories,
         updated_at=excluded.updated_at`
    ).run(
      memory.id,
      memory.tier,
      memory.content,
      memory.tokenCount,
      memory.metadata,
      memory.embedding,
      memory.linkedMemories,
      memory.createdAt,
      memory.updatedAt
    );
  }

  /**
   * Retrieve a single memory by ID.
   */
  getMemory(id: string): SerializedMemory | null {
    const db = this.requireDb();
    const row = db
      .prepare(
        `SELECT id, tier, content, token_count, metadata, embedding, linked_memories, created_at, updated_at
         FROM memories WHERE id = ?`
      )
      .get(id) as RawMemoryRow | undefined;
    if (!row) {
      return null;
    }
    return deserializeMemoryRow(row);
  }

  /**
   * Retrieve all memories for a given tier, ordered by creation time descending.
   */
  getMemoriesByTier(tier: MemoryTier): SerializedMemory[] {
    const db = this.requireDb();
    const rows = db
      .prepare(
        `SELECT id, tier, content, token_count, metadata, embedding, linked_memories, created_at, updated_at
         FROM memories WHERE tier = ? ORDER BY created_at DESC`
      )
      .all(tier) as RawMemoryRow[];
    return rows.map(deserializeMemoryRow);
  }

  /**
   * Delete a memory by ID.
   */
  deleteMemory(id: string): void {
    const db = this.requireDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  /**
   * Atomically update a memory's tier (used for promotion/demotion).
   */
  updateMemoryTier(id: string, newTier: MemoryTier): void {
    const db = this.requireDb();
    db.prepare('UPDATE memories SET tier = ?, updated_at = ? WHERE id = ?').run(
      newTier,
      Date.now(),
      id
    );
  }

  /**
   * Count memories in a given tier.
   */
  countMemories(tier?: MemoryTier): number {
    const db = this.requireDb();
    if (tier) {
      const row = db
        .prepare('SELECT COUNT(*) as c FROM memories WHERE tier = ?')
        .get(tier) as { c: number } | undefined;
      return row?.c ?? 0;
    }
    const row = db.prepare('SELECT COUNT(*) as c FROM memories').get() as
      | { c: number }
      | undefined;
    return row?.c ?? 0;
  }

  // =========================================================================
  // Atomic Reindex
  // =========================================================================

  /**
   * Begin an atomic reindex operation.
   *
   * Creates a temporary database file alongside the main database. The caller
   * should perform all indexing operations against the temp DB, then call
   * `commitReindex()` to atomically swap the files.
   */
  beginReindex(): TempDatabaseContext {
    const tempDbPath = `${this.dbPath}.tmp-${randomUUID()}`;
    const { DatabaseSync } = requireNodeSqlite();
    const tempDb = new DatabaseSync(tempDbPath, {
      allowExtension: this.allowExtension,
    }) as unknown as DatabaseHandle;
    tempDb.exec('PRAGMA journal_mode=WAL');
    tempDb.exec('PRAGMA busy_timeout = 5000');

    return {
      tempDbPath,
      tempDb,
      originalDbPath: this.dbPath,
    };
  }

  /**
   * Commit an atomic reindex by swapping the temp DB into the main path.
   *
   * Closes both databases, renames temp -> main (with backup), and reopens
   * the main database.
   */
  async commitReindex(ctx: TempDatabaseContext): Promise<void> {
    ctx.tempDb.close();
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    const backupPath = `${ctx.originalDbPath}.backup-${randomUUID()}`;

    // Rename original -> backup
    await moveIndexFiles(ctx.originalDbPath, backupPath);

    try {
      // Rename temp -> original
      await moveIndexFiles(ctx.tempDbPath, ctx.originalDbPath);
    } catch (err) {
      // Restore backup on failure
      await moveIndexFiles(backupPath, ctx.originalDbPath);
      throw err;
    }

    // Remove backup
    await removeIndexFiles(backupPath);

    // Reopen at original path
    this.open(ctx.originalDbPath, {
      allowExtension: this.allowExtension,
      walMode: true,
    });
  }

  /**
   * Roll back an in-progress reindex by closing and removing the temp database.
   */
  async rollbackReindex(ctx: TempDatabaseContext): Promise<void> {
    try {
      ctx.tempDb.close();
    } catch {
      // May already be closed
    }
    await removeIndexFiles(ctx.tempDbPath);
  }

  // =========================================================================
  // Session Delta Tracking
  // =========================================================================

  /**
   * Get the current delta tracking state for a session file.
   */
  getSessionDelta(filePath: string): SessionDelta {
    return (
      this.sessionDeltas.get(filePath) ?? {
        lastSize: 0,
        pendingBytes: 0,
        pendingMessages: 0,
      }
    );
  }

  /**
   * Update the delta tracking state for a session file.
   */
  updateSessionDelta(filePath: string, delta: SessionDelta): void {
    this.sessionDeltas.set(filePath, delta);
  }

  /**
   * Reset delta state after successful indexing.
   */
  resetSessionDelta(filePath: string, currentSize: number): void {
    const state = this.sessionDeltas.get(filePath);
    if (state) {
      state.lastSize = currentSize;
      state.pendingBytes = 0;
      state.pendingMessages = 0;
    }
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Clear all index data (chunks, files, FTS) but preserve the memories table
   * and embedding cache. Used before a full reindex.
   */
  resetIndex(): void {
    const db = this.requireDb();
    db.exec('DELETE FROM files');
    db.exec('DELETE FROM chunks');
    if (this.ftsAvailable) {
      try {
        db.exec(`DELETE FROM ${FTS_TABLE}`);
      } catch {
        // Non-fatal
      }
    }
    try {
      db.exec(`DROP TABLE IF EXISTS ${VECTOR_TABLE}`);
    } catch {
      // Non-fatal
    }
  }

  /**
   * Return counts for diagnostic / status reporting.
   */
  getCounts(source?: MemorySource): { files: number; chunks: number } {
    const db = this.requireDb();
    const sourceClause = source ? ' WHERE source = ?' : '';
    const params: unknown[] = source ? [source] : [];

    const fileRow = db
      .prepare(`SELECT COUNT(*) as c FROM files${sourceClause}`)
      .get(...params) as { c: number } | undefined;

    const chunkRow = db
      .prepare(`SELECT COUNT(*) as c FROM chunks${sourceClause}`)
      .get(...params) as { c: number } | undefined;

    return {
      files: fileRow?.c ?? 0,
      chunks: chunkRow?.c ?? 0,
    };
  }

  // =========================================================================
  // Internal
  // =========================================================================

  private requireDb(): DatabaseHandle {
    if (!this.db) {
      throw new Error('SQLiteBackend: database is not open');
    }
    return this.db;
  }
}

// ---------------------------------------------------------------------------
// Row deserialization
// ---------------------------------------------------------------------------

type RawMemoryRow = {
  id: string;
  tier: string;
  content: string;
  token_count: number;
  metadata: string;
  embedding: string | null;
  linked_memories: string;
  created_at: number;
  updated_at: number;
};

function deserializeMemoryRow(row: RawMemoryRow): SerializedMemory {
  return {
    id: row.id,
    tier: row.tier as MemoryTier,
    content: row.content,
    tokenCount: row.token_count,
    metadata: row.metadata,
    embedding: row.embedding,
    linkedMemories: row.linked_memories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// File swap helpers (following OpenClaw's approach)
// ---------------------------------------------------------------------------

async function moveIndexFiles(
  sourceBase: string,
  targetBase: string
): Promise<void> {
  const suffixes = ['', '-wal', '-shm'];
  for (const suffix of suffixes) {
    const source = `${sourceBase}${suffix}`;
    const target = `${targetBase}${suffix}`;
    try {
      await fs.rename(source, target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

async function removeIndexFiles(basePath: string): Promise<void> {
  const suffixes = ['', '-wal', '-shm'];
  await Promise.all(
    suffixes.map(suffix => fs.rm(`${basePath}${suffix}`, { force: true }))
  );
}

// ---------------------------------------------------------------------------
// node:sqlite dynamic import
// ---------------------------------------------------------------------------

function requireNodeSqlite(): {
  DatabaseSync: new (...args: unknown[]) => unknown;
} {
  // node:sqlite is available in Node.js 22+ as a built-in module.
  // We use a dynamic require so this module can be imported in environments
  // where node:sqlite is not available (the open() call will fail at runtime).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:sqlite') as {
    DatabaseSync: new (...args: unknown[]) => unknown;
  };
}

// ---------------------------------------------------------------------------
// Exported utilities
// ---------------------------------------------------------------------------

export { hashText, ensureDir, VECTOR_TABLE, FTS_TABLE, EMBEDDING_CACHE_TABLE };
