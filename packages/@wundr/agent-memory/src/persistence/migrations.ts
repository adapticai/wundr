/**
 * @wundr.io/agent-memory - Database Schema Migrations
 *
 * Versioned migration system for the SQLite persistence layer.
 * Each migration is idempotent and tracked in the schema_version table.
 * Migrations run sequentially inside transactions for atomicity.
 */

/**
 * Minimal database interface required by the migration system.
 * This avoids a hard dependency on `node:sqlite` types at import time.
 */
export interface MigrationDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
}

/**
 * A single schema migration definition.
 */
export interface Migration {
  /** Monotonically increasing version number */
  version: number;
  /** Human-readable description of the migration */
  description: string;
  /** SQL statements or imperative logic to apply */
  up: (db: MigrationDatabase) => void;
}

// ============================================================================
// Migration Definitions
// ============================================================================

const migrations: Migration[] = [
  {
    version: 1,
    description:
      'Create three-tier memory tables, sessions, and supporting tables',
    up: (db: MigrationDatabase) => {
      // Scratchpad: active working memory
      db.exec(`
        CREATE TABLE IF NOT EXISTS scratchpad (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          content TEXT NOT NULL,
          token_count INTEGER NOT NULL DEFAULT 0,
          metadata TEXT NOT NULL,
          embedding TEXT,
          linked_memories TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Episodic: autobiographical event memories
      db.exec(`
        CREATE TABLE IF NOT EXISTS episodic (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          token_count INTEGER NOT NULL DEFAULT 0,
          metadata TEXT NOT NULL,
          embedding TEXT,
          linked_memories TEXT NOT NULL DEFAULT '[]',
          episode_data TEXT,
          session_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Semantic: consolidated knowledge/facts
      db.exec(`
        CREATE TABLE IF NOT EXISTS semantic (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          token_count INTEGER NOT NULL DEFAULT 0,
          metadata TEXT NOT NULL,
          embedding TEXT,
          linked_memories TEXT NOT NULL DEFAULT '[]',
          semantic_data TEXT,
          category TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Forgetting curve spaced repetition schedules
      db.exec(`
        CREATE TABLE IF NOT EXISTS repetition_schedules (
          memory_id TEXT PRIMARY KEY,
          next_review_at INTEGER NOT NULL,
          interval_ms INTEGER NOT NULL,
          review_count INTEGER NOT NULL DEFAULT 0,
          ease_factor REAL NOT NULL DEFAULT 2.5
        );
      `);

      // Session state
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          started_at INTEGER NOT NULL,
          last_active_at INTEGER NOT NULL,
          turn_number INTEGER NOT NULL DEFAULT 0,
          active_agents TEXT NOT NULL DEFAULT '[]',
          scratchpad_state TEXT NOT NULL DEFAULT '[]',
          metadata TEXT NOT NULL DEFAULT '{}',
          is_active INTEGER NOT NULL DEFAULT 1,
          pending_compaction INTEGER NOT NULL DEFAULT 0
        );
      `);

      // Session transcripts
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_transcripts (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          turn_number INTEGER NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );
      `);

      // Memory promotion audit trail
      db.exec(`
        CREATE TABLE IF NOT EXISTS promotion_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_id TEXT NOT NULL,
          from_tier TEXT NOT NULL,
          to_tier TEXT NOT NULL,
          promoted_at INTEGER NOT NULL,
          reason TEXT
        );
      `);
    },
  },
  {
    version: 2,
    description: 'Create indexes for query performance',
    up: (db: MigrationDatabase) => {
      // Scratchpad indexes
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_scratchpad_key ON scratchpad(key);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_scratchpad_updated ON scratchpad(updated_at);`
      );

      // Episodic indexes
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_episodic_session ON episodic(session_id);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_episodic_created ON episodic(created_at);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_episodic_updated ON episodic(updated_at);`
      );

      // Semantic indexes
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic(category);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_semantic_created ON semantic(created_at);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_semantic_updated ON semantic(updated_at);`
      );

      // Session indexes
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);`
      );

      // Transcript indexes
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_transcripts_session ON session_transcripts(session_id);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON session_transcripts(timestamp);`
      );

      // Promotion log indexes
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_promotion_memory ON promotion_log(memory_id);`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_promotion_time ON promotion_log(promoted_at);`
      );

      // Repetition schedule index
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_repetition_review ON repetition_schedules(next_review_at);`
      );
    },
  },
];

// ============================================================================
// Migration Runner
// ============================================================================

/**
 * Ensures the schema_version tracking table exists.
 */
function ensureVersionTable(db: MigrationDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    );
  `);
}

/**
 * Reads the current schema version from the database.
 *
 * @returns Current version number (0 if no migrations have run)
 */
function getCurrentVersion(db: MigrationDatabase): number {
  const row = db
    .prepare('SELECT MAX(version) as version FROM schema_version')
    .get() as { version: number | null } | undefined;

  return row?.version ?? 0;
}

/**
 * Records a completed migration in the schema_version table.
 */
function recordMigration(db: MigrationDatabase, migration: Migration): void {
  db.prepare(
    'INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)'
  ).run(migration.version, Date.now(), migration.description);
}

/**
 * Result of running migrations.
 */
export interface MigrationResult {
  /** Previous schema version */
  previousVersion: number;
  /** Current schema version after migrations */
  currentVersion: number;
  /** Number of migrations applied */
  migrationsApplied: number;
  /** Descriptions of applied migrations */
  applied: string[];
}

/**
 * Runs all pending migrations against the given database.
 *
 * Each migration runs inside a transaction. If a migration fails, its
 * transaction is rolled back and the error is propagated. Migrations
 * that have already been applied (version <= current) are skipped.
 *
 * @param db - Database handle
 * @returns Migration result with details of what was applied
 *
 * @example
 * ```typescript
 * const db = openDatabase('/path/to/memory.db');
 * const result = runMigrations(db);
 * console.log(`Applied ${result.migrationsApplied} migrations`);
 * ```
 */
export function runMigrations(db: MigrationDatabase): MigrationResult {
  ensureVersionTable(db);

  const previousVersion = getCurrentVersion(db);
  const pending = migrations.filter(m => m.version > previousVersion);
  const applied: string[] = [];

  // Sort by version to guarantee ordering
  pending.sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.exec('BEGIN');
    try {
      migration.up(db);
      recordMigration(db, migration);
      db.exec('COMMIT');
      applied.push(migration.description);
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(
        `Migration v${migration.version} failed (${migration.description}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return {
    previousVersion,
    currentVersion:
      pending.length > 0
        ? pending[pending.length - 1].version
        : previousVersion,
    migrationsApplied: applied.length,
    applied,
  };
}

/**
 * Returns the latest schema version number defined in code.
 * Useful for checking whether the database needs migration.
 *
 * @returns The highest migration version number
 */
export function getLatestVersion(): number {
  if (migrations.length === 0) {
    return 0;
  }
  return Math.max(...migrations.map(m => m.version));
}

/**
 * Returns all registered migration definitions.
 * Useful for diagnostics and testing.
 *
 * @returns Array of migration definitions sorted by version
 */
export function getMigrations(): readonly Migration[] {
  return [...migrations].sort((a, b) => a.version - b.version);
}
