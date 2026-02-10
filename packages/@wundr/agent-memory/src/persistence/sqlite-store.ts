/**
 * @wundr.io/agent-memory - SQLite Persistence Store
 *
 * Core persistence layer that maps the three-tier memory architecture
 * (scratchpad, episodic, semantic) to SQLite tables. Provides transactional
 * writes, WAL-mode crash recovery, session storage, transcript persistence,
 * and memory promotion tracking.
 *
 * Uses Node.js built-in `node:sqlite` (DatabaseSync) following the same
 * pattern established in OpenClaw's MemoryIndexManager.
 */

import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

import { CacheLayer } from './cache-layer';
import { runMigrations } from './migrations';

import type { CacheStatistics } from './cache-layer';
import type { MigrationResult } from './migrations';
import type {
  Memory,
  MemoryMetadata,
  MemoryTier,
  SessionState,
} from '../types';

// Re-import the RepetitionSchedule from forgetting curve
import type { RepetitionSchedule } from '../forgetting-curve';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration options for the SQLite store.
 */
export interface SQLiteStoreOptions {
  /** Enable WAL journal mode (default: true) */
  walMode?: boolean;
  /** Busy timeout in milliseconds (default: 5000) */
  busyTimeoutMs?: number;
  /** Maximum entries in the LRU cache (default: 500) */
  cacheMaxEntries?: number;
  /** Enable the LRU cache layer (default: true) */
  cacheEnabled?: boolean;
}

/**
 * Options for querying tier tables.
 */
export interface QueryOptions {
  /** Maximum number of results */
  limit?: number;
  /** Filter by session ID (episodic only) */
  sessionId?: string;
  /** Filter by category (semantic only) */
  category?: string;
  /** Filter by tag (searches metadata JSON) */
  tag?: string;
  /** Filter by agent ID (searches metadata JSON) */
  agentId?: string;
  /** Sort by column */
  sortBy?: 'created_at' | 'updated_at';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Only return memories updated after this timestamp (ms) */
  updatedAfter?: number;
}

/**
 * A transcript entry from a session.
 */
export interface TranscriptEntry {
  id: string;
  sessionId: string;
  turnNumber: number;
  role: string;
  content: string;
  timestamp: number;
}

/**
 * Persistence-level statistics.
 */
export interface PersistenceStatistics {
  scratchpadCount: number;
  episodicCount: number;
  semanticCount: number;
  sessionCount: number;
  transcriptCount: number;
  promotionCount: number;
  scheduleCount: number;
  dbSizeBytes: number;
  cache: CacheStatistics;
}

// ============================================================================
// Internal Row Types
// ============================================================================

interface ScratchpadRow {
  id: string;
  key: string;
  content: string;
  token_count: number;
  metadata: string;
  embedding: string | null;
  linked_memories: string;
  created_at: number;
  updated_at: number;
}

interface EpisodicRow {
  id: string;
  content: string;
  token_count: number;
  metadata: string;
  embedding: string | null;
  linked_memories: string;
  episode_data: string | null;
  session_id: string | null;
  created_at: number;
  updated_at: number;
}

interface SemanticRow {
  id: string;
  content: string;
  token_count: number;
  metadata: string;
  embedding: string | null;
  linked_memories: string;
  semantic_data: string | null;
  category: string | null;
  created_at: number;
  updated_at: number;
}

interface SessionRow {
  session_id: string;
  started_at: number;
  last_active_at: number;
  turn_number: number;
  active_agents: string;
  scratchpad_state: string;
  metadata: string;
  is_active: number;
  pending_compaction: number;
}

interface RepetitionRow {
  memory_id: string;
  next_review_at: number;
  interval_ms: number;
  review_count: number;
  ease_factor: number;
}

interface TranscriptRow {
  id: string;
  session_id: string;
  turn_number: number;
  role: string;
  content: string;
  timestamp: number;
}

interface CountRow {
  c: number;
}

// ============================================================================
// DatabaseSync Interface
// ============================================================================

/**
 * Minimal interface matching `node:sqlite` DatabaseSync.
 * Defined here to avoid a hard import-time dependency.
 * Note: the `exec` method here is SQLite's SQL execution API,
 * not child_process -- it runs SQL statements against the database.
 */
interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
}

// ============================================================================
// SQLiteStore Implementation
// ============================================================================

/**
 * SQLiteStore - Core persistence layer for the three-tier memory system.
 *
 * Maps scratchpad, episodic, and semantic memories to dedicated SQLite tables.
 * Provides transactional operations, WAL-mode crash recovery, LRU caching,
 * session persistence, and memory promotion tracking.
 *
 * @example
 * ```typescript
 * const store = new SQLiteStore('/path/to/memory.db');
 * store.open();
 *
 * // Store a memory
 * store.putEpisodic(memory);
 *
 * // Query with options
 * const results = store.queryEpisodic({
 *   sessionId: 'session-123',
 *   limit: 10,
 *   sortBy: 'created_at',
 *   sortDirection: 'desc',
 * });
 *
 * // Promote memory
 * store.promoteMemory(memoryId, 'episodic', 'semantic', 'consolidation');
 *
 * store.close();
 * ```
 */
export class SQLiteStore {
  private readonly dbPath: string;
  private readonly options: Required<SQLiteStoreOptions>;
  private db: DatabaseSync | null = null;
  private cache: CacheLayer<Memory>;
  private sessionCache: CacheLayer<SessionState>;
  private migrationResult: MigrationResult | null = null;

  /**
   * Creates a new SQLiteStore instance.
   * Call `open()` to initialize the database connection.
   *
   * @param dbPath - Path to the SQLite database file
   * @param options - Store configuration
   */
  constructor(dbPath: string, options: SQLiteStoreOptions = {}) {
    this.dbPath = dbPath;
    this.options = {
      walMode: options.walMode ?? true,
      busyTimeoutMs: options.busyTimeoutMs ?? 5000,
      cacheMaxEntries: options.cacheMaxEntries ?? 500,
      cacheEnabled: options.cacheEnabled ?? true,
    };

    this.cache = new CacheLayer<Memory>({
      maxEntries: this.options.cacheMaxEntries,
    });

    this.sessionCache = new CacheLayer<SessionState>({
      maxEntries: 50,
    });
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Opens the database connection, configures pragmas, and runs migrations.
   *
   * @returns Migration result detailing applied schema changes
   */
  open(): MigrationResult {
    if (this.db) {
      return this.migrationResult!;
    }

    // Ensure parent directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Import node:sqlite at runtime to handle environments where it is unavailable
    let DatabaseSyncClass: new (path: string) => DatabaseSync;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteModule = require('node:sqlite');
      DatabaseSyncClass = sqliteModule.DatabaseSync;
    } catch {
      throw new Error(
        'node:sqlite is not available. Memory persistence requires Node.js >= 22.5.0 ' +
          'with built-in SQLite support.'
      );
    }

    this.db = new DatabaseSyncClass(this.dbPath);

    // Configure pragmas for WAL mode and crash recovery.
    // Note: db.exec() is the SQLite SQL execution API, not child_process.
    if (this.options.walMode) {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA wal_autocheckpoint = 1000;');
    }
    this.db.exec(`PRAGMA busy_timeout = ${this.options.busyTimeoutMs};`);
    this.db.exec('PRAGMA foreign_keys = ON;');

    // Run migrations
    this.migrationResult = runMigrations(this.db);
    return this.migrationResult;
  }

  /**
   * Closes the database connection and clears all caches.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.cache.clear();
    this.sessionCache.clear();
    this.migrationResult = null;
  }

  /**
   * Returns whether the database is currently open.
   */
  get isOpen(): boolean {
    return this.db !== null;
  }

  /**
   * Returns the migration result from the last `open()` call.
   */
  getMigrationResult(): MigrationResult | null {
    return this.migrationResult;
  }

  // ==========================================================================
  // Transactions
  // ==========================================================================

  /**
   * Runs a function inside a database transaction.
   * Commits on success, rolls back on error.
   *
   * @param fn - Function to run within the transaction
   * @returns Return value of the function
   */
  transaction<T>(fn: () => T): T {
    const db = this.requireDb();
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  // ==========================================================================
  // Scratchpad Operations
  // ==========================================================================

  /**
   * Stores or updates a scratchpad memory entry.
   *
   * @param key - Scratchpad key
   * @param memory - Memory to store
   */
  putScratchpad(key: string, memory: Memory): void {
    const db = this.requireDb();
    const now = Date.now();

    db.prepare(
      `INSERT INTO scratchpad (id, key, content, token_count, metadata, embedding, linked_memories, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         key=excluded.key,
         content=excluded.content,
         token_count=excluded.token_count,
         metadata=excluded.metadata,
         embedding=excluded.embedding,
         linked_memories=excluded.linked_memories,
         updated_at=excluded.updated_at`
    ).run(
      memory.id,
      key,
      JSON.stringify(memory.content),
      memory.tokenCount,
      JSON.stringify(this.serializeMetadata(memory.metadata)),
      memory.embedding ? JSON.stringify(memory.embedding) : null,
      JSON.stringify(memory.linkedMemories),
      now,
      now
    );

    if (this.options.cacheEnabled) {
      this.cache.set(`scratchpad:${key}`, memory);
      this.cache.set(`id:${memory.id}`, memory);
    }
  }

  /**
   * Retrieves a scratchpad memory by key.
   *
   * @param key - Scratchpad key
   * @returns Memory or null if not found
   */
  getScratchpad(key: string): Memory | null {
    if (this.options.cacheEnabled) {
      return this.cache.getOrLoad(`scratchpad:${key}`, () => {
        return this.loadScratchpadFromDb(key);
      });
    }
    return this.loadScratchpadFromDb(key);
  }

  /**
   * Deletes a scratchpad memory by key.
   *
   * @param key - Scratchpad key
   * @returns True if a row was deleted
   */
  deleteScratchpad(key: string): boolean {
    const db = this.requireDb();
    const existing = this.loadScratchpadFromDb(key);

    db.prepare('DELETE FROM scratchpad WHERE key = ?').run(key);

    if (this.options.cacheEnabled) {
      this.cache.delete(`scratchpad:${key}`);
      if (existing) {
        this.cache.delete(`id:${existing.id}`);
      }
    }

    return existing !== null;
  }

  /**
   * Returns all scratchpad memories.
   *
   * @returns Array of all scratchpad memories
   */
  getAllScratchpad(): Memory[] {
    const db = this.requireDb();
    const rows = db.prepare('SELECT * FROM scratchpad ORDER BY updated_at DESC').all() as ScratchpadRow[];
    return rows.map(row => this.parseScratchpadRow(row));
  }

  /**
   * Clears all scratchpad entries.
   */
  clearScratchpad(): void {
    const db = this.requireDb();
    db.exec('DELETE FROM scratchpad');

    // Invalidate all scratchpad cache entries
    if (this.options.cacheEnabled) {
      const keys = this.cache.keys().filter(k => k.startsWith('scratchpad:'));
      for (const k of keys) {
        this.cache.delete(k);
      }
    }
  }

  // ==========================================================================
  // Episodic Operations
  // ==========================================================================

  /**
   * Stores or updates an episodic memory.
   *
   * @param memory - Memory to store
   * @param episodeData - Optional episode-specific metadata
   * @param sessionId - Optional session association
   */
  putEpisodic(memory: Memory, episodeData?: unknown, sessionId?: string): void {
    const db = this.requireDb();
    const now = Date.now();

    db.prepare(
      `INSERT INTO episodic (id, content, token_count, metadata, embedding, linked_memories, episode_data, session_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content=excluded.content,
         token_count=excluded.token_count,
         metadata=excluded.metadata,
         embedding=excluded.embedding,
         linked_memories=excluded.linked_memories,
         episode_data=excluded.episode_data,
         session_id=excluded.session_id,
         updated_at=excluded.updated_at`
    ).run(
      memory.id,
      JSON.stringify(memory.content),
      memory.tokenCount,
      JSON.stringify(this.serializeMetadata(memory.metadata)),
      memory.embedding ? JSON.stringify(memory.embedding) : null,
      JSON.stringify(memory.linkedMemories),
      episodeData ? JSON.stringify(episodeData) : null,
      sessionId ?? null,
      now,
      now
    );

    if (this.options.cacheEnabled) {
      this.cache.set(`id:${memory.id}`, memory);
    }
  }

  /**
   * Retrieves an episodic memory by ID.
   *
   * @param id - Memory ID
   * @returns Memory or null
   */
  getEpisodic(id: string): Memory | null {
    if (this.options.cacheEnabled) {
      return this.cache.getOrLoad(`id:${id}`, () => {
        return this.loadEpisodicFromDb(id);
      });
    }
    return this.loadEpisodicFromDb(id);
  }

  /**
   * Deletes an episodic memory by ID.
   *
   * @param id - Memory ID
   * @returns True if a row was deleted
   */
  deleteEpisodic(id: string): boolean {
    const db = this.requireDb();
    const row = db.prepare('SELECT id FROM episodic WHERE id = ?').get(id);
    db.prepare('DELETE FROM episodic WHERE id = ?').run(id);

    if (this.options.cacheEnabled) {
      this.cache.delete(`id:${id}`);
    }

    return row !== undefined;
  }

  /**
   * Queries episodic memories with filtering and sorting.
   *
   * @param options - Query options
   * @returns Matching memories
   */
  queryEpisodic(options: QueryOptions = {}): Memory[] {
    const db = this.requireDb();
    const { sql, params } = this.buildQuery('episodic', options);
    const rows = db.prepare(sql).all(...params) as EpisodicRow[];
    return rows.map(row => this.parseEpisodicRow(row));
  }

  // ==========================================================================
  // Semantic Operations
  // ==========================================================================

  /**
   * Stores or updates a semantic memory.
   *
   * @param memory - Memory to store
   * @param semanticData - Optional semantic-specific metadata
   * @param category - Optional knowledge category
   */
  putSemantic(memory: Memory, semanticData?: unknown, category?: string): void {
    const db = this.requireDb();
    const now = Date.now();

    db.prepare(
      `INSERT INTO semantic (id, content, token_count, metadata, embedding, linked_memories, semantic_data, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content=excluded.content,
         token_count=excluded.token_count,
         metadata=excluded.metadata,
         embedding=excluded.embedding,
         linked_memories=excluded.linked_memories,
         semantic_data=excluded.semantic_data,
         category=excluded.category,
         updated_at=excluded.updated_at`
    ).run(
      memory.id,
      JSON.stringify(memory.content),
      memory.tokenCount,
      JSON.stringify(this.serializeMetadata(memory.metadata)),
      memory.embedding ? JSON.stringify(memory.embedding) : null,
      JSON.stringify(memory.linkedMemories),
      semanticData ? JSON.stringify(semanticData) : null,
      category ?? null,
      now,
      now
    );

    if (this.options.cacheEnabled) {
      this.cache.set(`id:${memory.id}`, memory);
    }
  }

  /**
   * Retrieves a semantic memory by ID.
   *
   * @param id - Memory ID
   * @returns Memory or null
   */
  getSemantic(id: string): Memory | null {
    if (this.options.cacheEnabled) {
      return this.cache.getOrLoad(`id:${id}`, () => {
        return this.loadSemanticFromDb(id);
      });
    }
    return this.loadSemanticFromDb(id);
  }

  /**
   * Deletes a semantic memory by ID.
   *
   * @param id - Memory ID
   * @returns True if a row was deleted
   */
  deleteSemantic(id: string): boolean {
    const db = this.requireDb();
    const row = db.prepare('SELECT id FROM semantic WHERE id = ?').get(id);
    db.prepare('DELETE FROM semantic WHERE id = ?').run(id);

    if (this.options.cacheEnabled) {
      this.cache.delete(`id:${id}`);
    }

    return row !== undefined;
  }

  /**
   * Queries semantic memories with filtering and sorting.
   *
   * @param options - Query options
   * @returns Matching memories
   */
  querySemantic(options: QueryOptions = {}): Memory[] {
    const db = this.requireDb();
    const { sql, params } = this.buildQuery('semantic', options);
    const rows = db.prepare(sql).all(...params) as SemanticRow[];
    return rows.map(row => this.parseSemanticRow(row));
  }

  // ==========================================================================
  // Memory Promotion
  // ==========================================================================

  /**
   * Promotes a memory from one tier to another within a single transaction.
   *
   * The source memory is deleted, a new entry is created in the target tier,
   * and the transition is recorded in the promotion audit log.
   *
   * @param memoryId - ID of the memory to promote
   * @param fromTier - Source tier
   * @param toTier - Destination tier
   * @param reason - Optional reason for promotion
   */
  promoteMemory(
    memoryId: string,
    fromTier: MemoryTier,
    toTier: MemoryTier,
    reason?: string
  ): void {
    this.transaction(() => {
      const db = this.requireDb();

      // Load from source tier
      let memory: Memory | null = null;
      switch (fromTier) {
        case 'scratchpad': {
          const rows = db
            .prepare('SELECT * FROM scratchpad WHERE id = ?')
            .all(memoryId) as ScratchpadRow[];
          if (rows.length > 0) {
            memory = this.parseScratchpadRow(rows[0]);
          }
          break;
        }
        case 'episodic':
          memory = this.loadEpisodicFromDb(memoryId);
          break;
        case 'semantic':
          memory = this.loadSemanticFromDb(memoryId);
          break;
      }

      if (!memory) {
        throw new Error(`Memory ${memoryId} not found in ${fromTier} tier`);
      }

      // Delete from source
      switch (fromTier) {
        case 'scratchpad':
          db.prepare('DELETE FROM scratchpad WHERE id = ?').run(memoryId);
          break;
        case 'episodic':
          db.prepare('DELETE FROM episodic WHERE id = ?').run(memoryId);
          break;
        case 'semantic':
          db.prepare('DELETE FROM semantic WHERE id = ?').run(memoryId);
          break;
      }

      // Update type on the memory object
      const promotedMemory: Memory = {
        ...memory,
        type: toTier,
      };

      // Insert into target
      switch (toTier) {
        case 'episodic':
          this.putEpisodic(promotedMemory);
          break;
        case 'semantic':
          this.putSemantic(promotedMemory);
          break;
        default:
          throw new Error(`Cannot promote to ${toTier} tier`);
      }

      // Record in promotion log
      db.prepare(
        'INSERT INTO promotion_log (memory_id, from_tier, to_tier, promoted_at, reason) VALUES (?, ?, ?, ?, ?)'
      ).run(memoryId, fromTier, toTier, Date.now(), reason ?? null);

      // Invalidate cache
      if (this.options.cacheEnabled) {
        this.cache.delete(`id:${memoryId}`);
      }
    });
  }

  // ==========================================================================
  // Session Operations
  // ==========================================================================

  /**
   * Stores or updates a session.
   *
   * @param session - Session state to persist
   */
  putSession(session: SessionState): void {
    const db = this.requireDb();

    db.prepare(
      `INSERT INTO sessions (session_id, started_at, last_active_at, turn_number, active_agents, scratchpad_state, metadata, is_active, pending_compaction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         last_active_at=excluded.last_active_at,
         turn_number=excluded.turn_number,
         active_agents=excluded.active_agents,
         scratchpad_state=excluded.scratchpad_state,
         metadata=excluded.metadata,
         is_active=excluded.is_active,
         pending_compaction=excluded.pending_compaction`
    ).run(
      session.sessionId,
      session.startedAt.getTime(),
      session.lastActiveAt.getTime(),
      session.turnNumber,
      JSON.stringify(session.activeAgents),
      JSON.stringify(session.scratchpadState),
      JSON.stringify(session.metadata),
      session.isActive ? 1 : 0,
      session.pendingCompaction ? 1 : 0
    );

    if (this.options.cacheEnabled) {
      this.sessionCache.set(session.sessionId, session);
    }
  }

  /**
   * Retrieves a session by ID.
   *
   * @param sessionId - Session ID
   * @returns Session state or null
   */
  getSession(sessionId: string): SessionState | null {
    if (this.options.cacheEnabled) {
      return this.sessionCache.getOrLoad(sessionId, () => {
        return this.loadSessionFromDb(sessionId);
      });
    }
    return this.loadSessionFromDb(sessionId);
  }

  /**
   * Deletes a session and its transcripts.
   *
   * @param sessionId - Session ID
   */
  deleteSession(sessionId: string): void {
    const db = this.requireDb();
    this.transaction(() => {
      db.prepare('DELETE FROM session_transcripts WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
    });

    if (this.options.cacheEnabled) {
      this.sessionCache.delete(sessionId);
    }
  }

  /**
   * Returns all active sessions.
   *
   * @returns Array of active session states
   */
  getActiveSessions(): SessionState[] {
    const db = this.requireDb();
    const rows = db
      .prepare('SELECT * FROM sessions WHERE is_active = 1 ORDER BY last_active_at DESC')
      .all() as SessionRow[];
    return rows.map(row => this.parseSessionRow(row));
  }

  /**
   * Returns all sessions.
   *
   * @returns Array of all session states
   */
  getAllSessions(): SessionState[] {
    const db = this.requireDb();
    const rows = db
      .prepare('SELECT * FROM sessions ORDER BY last_active_at DESC')
      .all() as SessionRow[];
    return rows.map(row => this.parseSessionRow(row));
  }

  // ==========================================================================
  // Session Transcripts
  // ==========================================================================

  /**
   * Appends a transcript entry for a session.
   *
   * @param sessionId - Session ID
   * @param turnNumber - Turn number within the session
   * @param role - Role (e.g., 'user', 'assistant')
   * @param content - Message content
   */
  appendTranscript(
    sessionId: string,
    turnNumber: number,
    role: string,
    content: string
  ): void {
    const db = this.requireDb();
    const id = uuidv4();

    db.prepare(
      'INSERT INTO session_transcripts (id, session_id, turn_number, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, sessionId, turnNumber, role, content, Date.now());
  }

  /**
   * Retrieves all transcript entries for a session.
   *
   * @param sessionId - Session ID
   * @returns Transcript entries sorted by timestamp
   */
  getTranscripts(sessionId: string): TranscriptEntry[] {
    const db = this.requireDb();
    const rows = db
      .prepare(
        'SELECT * FROM session_transcripts WHERE session_id = ? ORDER BY timestamp ASC'
      )
      .all(sessionId) as TranscriptRow[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      turnNumber: row.turn_number,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
    }));
  }

  // ==========================================================================
  // Forgetting Curve / Repetition Schedules
  // ==========================================================================

  /**
   * Stores or updates a repetition schedule.
   *
   * @param schedule - Repetition schedule to persist
   */
  putRepetitionSchedule(schedule: RepetitionSchedule): void {
    const db = this.requireDb();

    db.prepare(
      `INSERT INTO repetition_schedules (memory_id, next_review_at, interval_ms, review_count, ease_factor)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(memory_id) DO UPDATE SET
         next_review_at=excluded.next_review_at,
         interval_ms=excluded.interval_ms,
         review_count=excluded.review_count,
         ease_factor=excluded.ease_factor`
    ).run(
      schedule.memoryId,
      schedule.nextReviewAt.getTime(),
      schedule.intervalMs,
      schedule.reviewCount,
      schedule.easeFactor
    );
  }

  /**
   * Retrieves a repetition schedule by memory ID.
   *
   * @param memoryId - Memory ID
   * @returns Schedule or null
   */
  getRepetitionSchedule(memoryId: string): RepetitionSchedule | null {
    const db = this.requireDb();
    const row = db
      .prepare('SELECT * FROM repetition_schedules WHERE memory_id = ?')
      .get(memoryId) as RepetitionRow | undefined;

    if (!row) {
      return null;
    }

    return {
      memoryId: row.memory_id,
      nextReviewAt: new Date(row.next_review_at),
      intervalMs: row.interval_ms,
      reviewCount: row.review_count,
      easeFactor: row.ease_factor,
    };
  }

  /**
   * Returns all schedules due for review before a given timestamp.
   *
   * @param beforeMs - Timestamp in milliseconds
   * @returns Schedules due for review
   */
  getSchedulesDueForReview(beforeMs: number): RepetitionSchedule[] {
    const db = this.requireDb();
    const rows = db
      .prepare(
        'SELECT * FROM repetition_schedules WHERE next_review_at <= ? ORDER BY next_review_at ASC'
      )
      .all(beforeMs) as RepetitionRow[];

    return rows.map(row => ({
      memoryId: row.memory_id,
      nextReviewAt: new Date(row.next_review_at),
      intervalMs: row.interval_ms,
      reviewCount: row.review_count,
      easeFactor: row.ease_factor,
    }));
  }

  /**
   * Deletes a repetition schedule.
   *
   * @param memoryId - Memory ID
   */
  deleteRepetitionSchedule(memoryId: string): void {
    const db = this.requireDb();
    db.prepare('DELETE FROM repetition_schedules WHERE memory_id = ?').run(memoryId);
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Returns persistence layer statistics.
   *
   * @returns Statistics snapshot
   */
  getStatistics(): PersistenceStatistics {
    const db = this.requireDb();

    const countQuery = (table: string): number => {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as CountRow | undefined;
      return row?.c ?? 0;
    };

    let dbSizeBytes = 0;
    try {
      const stat = fs.statSync(this.dbPath);
      dbSizeBytes = stat.size;
    } catch {
      // File may not exist yet
    }

    return {
      scratchpadCount: countQuery('scratchpad'),
      episodicCount: countQuery('episodic'),
      semanticCount: countQuery('semantic'),
      sessionCount: countQuery('sessions'),
      transcriptCount: countQuery('session_transcripts'),
      promotionCount: countQuery('promotion_log'),
      scheduleCount: countQuery('repetition_schedules'),
      dbSizeBytes,
      cache: this.cache.getStatistics(),
    };
  }

  // ==========================================================================
  // Bulk Operations (for import/export)
  // ==========================================================================

  /**
   * Returns all data from all tables for export.
   *
   * @returns Complete database snapshot
   */
  exportAll(): {
    scratchpad: Memory[];
    episodic: Memory[];
    semantic: Memory[];
    sessions: SessionState[];
    schedules: RepetitionSchedule[];
  } {
    return {
      scratchpad: this.getAllScratchpad(),
      episodic: this.queryEpisodic({ limit: 100000 }),
      semantic: this.querySemantic({ limit: 100000 }),
      sessions: this.getAllSessions(),
      schedules: this.getAllRepetitionSchedules(),
    };
  }

  /**
   * Imports data into all tables, replacing existing data.
   * Runs inside a single transaction for atomicity.
   *
   * @param data - Data to import
   */
  importAll(data: {
    scratchpad?: unknown[];
    episodic?: unknown[];
    semantic?: unknown[];
    sessions?: unknown[];
    schedules?: unknown[];
  }): void {
    this.transaction(() => {
      const db = this.requireDb();

      // Clear existing data
      db.exec('DELETE FROM scratchpad');
      db.exec('DELETE FROM episodic');
      db.exec('DELETE FROM semantic');
      db.exec('DELETE FROM sessions');
      db.exec('DELETE FROM session_transcripts');
      db.exec('DELETE FROM repetition_schedules');
      db.exec('DELETE FROM promotion_log');

      // Import scratchpad
      if (data.scratchpad) {
        for (const memory of data.scratchpad as Memory[]) {
          this.putScratchpad(memory.id, memory);
        }
      }

      // Import episodic
      if (data.episodic) {
        for (const memory of data.episodic as Memory[]) {
          this.putEpisodic(memory);
        }
      }

      // Import semantic
      if (data.semantic) {
        for (const memory of data.semantic as Memory[]) {
          this.putSemantic(memory);
        }
      }

      // Import sessions
      if (data.sessions) {
        for (const session of data.sessions as SessionState[]) {
          this.putSession(session);
        }
      }

      // Import schedules
      if (data.schedules) {
        for (const schedule of data.schedules as RepetitionSchedule[]) {
          this.putRepetitionSchedule(schedule);
        }
      }
    });

    // Clear all caches after bulk import
    this.cache.clear();
    this.sessionCache.clear();
  }

  // ==========================================================================
  // Database Maintenance
  // ==========================================================================

  /**
   * Runs VACUUM to reclaim disk space and defragment the database file.
   */
  vacuum(): void {
    const db = this.requireDb();
    db.exec('VACUUM');
  }

  /**
   * Runs an integrity check on the database.
   *
   * @returns Result string ('ok' if healthy)
   */
  integrityCheck(): string {
    const db = this.requireDb();
    const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string } | undefined;
    return row?.integrity_check ?? 'unknown';
  }

  /**
   * Runs PRAGMA optimize for query planner statistics.
   */
  optimize(): void {
    const db = this.requireDb();
    db.exec('PRAGMA optimize');
  }

  /**
   * Returns the database file path.
   */
  getDbPath(): string {
    return this.dbPath;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private requireDb(): DatabaseSync {
    if (!this.db) {
      throw new Error('Database is not open. Call open() first.');
    }
    return this.db;
  }

  private getAllRepetitionSchedules(): RepetitionSchedule[] {
    const db = this.requireDb();
    const rows = db.prepare('SELECT * FROM repetition_schedules').all() as RepetitionRow[];
    return rows.map(row => ({
      memoryId: row.memory_id,
      nextReviewAt: new Date(row.next_review_at),
      intervalMs: row.interval_ms,
      reviewCount: row.review_count,
      easeFactor: row.ease_factor,
    }));
  }

  private loadScratchpadFromDb(key: string): Memory | null {
    const db = this.requireDb();
    const row = db.prepare('SELECT * FROM scratchpad WHERE key = ?').get(key) as
      | ScratchpadRow
      | undefined;

    if (!row) {
      return null;
    }
    return this.parseScratchpadRow(row);
  }

  private loadEpisodicFromDb(id: string): Memory | null {
    const db = this.requireDb();
    const row = db.prepare('SELECT * FROM episodic WHERE id = ?').get(id) as
      | EpisodicRow
      | undefined;

    if (!row) {
      return null;
    }
    return this.parseEpisodicRow(row);
  }

  private loadSemanticFromDb(id: string): Memory | null {
    const db = this.requireDb();
    const row = db.prepare('SELECT * FROM semantic WHERE id = ?').get(id) as
      | SemanticRow
      | undefined;

    if (!row) {
      return null;
    }
    return this.parseSemanticRow(row);
  }

  private loadSessionFromDb(sessionId: string): SessionState | null {
    const db = this.requireDb();
    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as
      | SessionRow
      | undefined;

    if (!row) {
      return null;
    }
    return this.parseSessionRow(row);
  }

  // ==========================================================================
  // Row Parsing
  // ==========================================================================

  private parseScratchpadRow(row: ScratchpadRow): Memory {
    const metadata = this.parseMetadata(row.metadata);
    return {
      id: row.id,
      type: 'scratchpad',
      content: JSON.parse(row.content),
      tokenCount: row.token_count,
      metadata,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      linkedMemories: JSON.parse(row.linked_memories),
    };
  }

  private parseEpisodicRow(row: EpisodicRow): Memory {
    const metadata = this.parseMetadata(row.metadata);
    return {
      id: row.id,
      type: 'episodic',
      content: JSON.parse(row.content),
      tokenCount: row.token_count,
      metadata,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      linkedMemories: JSON.parse(row.linked_memories),
    };
  }

  private parseSemanticRow(row: SemanticRow): Memory {
    const metadata = this.parseMetadata(row.metadata);
    return {
      id: row.id,
      type: 'semantic',
      content: JSON.parse(row.content),
      tokenCount: row.token_count,
      metadata,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
      linkedMemories: JSON.parse(row.linked_memories),
    };
  }

  private parseSessionRow(row: SessionRow): SessionState {
    return {
      sessionId: row.session_id,
      startedAt: new Date(row.started_at),
      lastActiveAt: new Date(row.last_active_at),
      turnNumber: row.turn_number,
      activeAgents: JSON.parse(row.active_agents),
      scratchpadState: JSON.parse(row.scratchpad_state),
      metadata: JSON.parse(row.metadata),
      isActive: row.is_active === 1,
      pendingCompaction: row.pending_compaction === 1,
    };
  }

  private parseMetadata(json: string): MemoryMetadata {
    const raw = JSON.parse(json);
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      lastAccessedAt: new Date(raw.lastAccessedAt),
    };
  }

  private serializeMetadata(metadata: MemoryMetadata): Record<string, unknown> {
    return {
      ...metadata,
      createdAt: metadata.createdAt.toISOString(),
      lastAccessedAt: metadata.lastAccessedAt.toISOString(),
    };
  }

  // ==========================================================================
  // Query Builder
  // ==========================================================================

  private buildQuery(
    table: 'episodic' | 'semantic',
    options: QueryOptions
  ): { sql: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (table === 'episodic' && options.sessionId) {
      conditions.push('session_id = ?');
      params.push(options.sessionId);
    }

    if (table === 'semantic' && options.category) {
      conditions.push('category = ?');
      params.push(options.category);
    }

    if (options.updatedAfter !== undefined) {
      conditions.push('updated_at > ?');
      params.push(options.updatedAfter);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = options.sortBy ?? 'updated_at';
    const sortDir = options.sortDirection ?? 'desc';
    const limit = options.limit ?? 100;

    const sql = `SELECT * FROM ${table}${where} ORDER BY ${sortColumn} ${sortDir.toUpperCase()} LIMIT ?`;
    params.push(limit);

    return { sql, params };
  }
}
