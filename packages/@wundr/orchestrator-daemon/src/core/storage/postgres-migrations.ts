/**
 * PostgreSQL Migration Helper for Orchestrator Daemon
 *
 * Creates and manages database schema for:
 *   - daemon_tasks          - Task records with dependency tracking
 *   - daemon_backlog_items  - Ordered backlog per orchestrator
 *   - daemon_sessions       - Session state and lifecycle
 *   - daemon_memory         - Memory entries with optional vector embeddings
 *
 * Uses a version tracking table (daemon_schema_migrations) to apply
 * each migration exactly once. All tables use CREATE TABLE IF NOT EXISTS
 * so calling runMigrations() on an already-migrated database is safe.
 */

import type { Pool } from 'pg';

import { Logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------

interface Migration {
  version: number;
  name: string;
  up: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_schema_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS daemon_schema_migrations (
        version     INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
  {
    version: 2,
    name: 'create_daemon_tasks',
    up: `
      CREATE TABLE IF NOT EXISTS daemon_tasks (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        title           TEXT        NOT NULL,
        description     TEXT        NOT NULL DEFAULT '',
        status          TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','in_progress','completed','deleted')),
        priority        TEXT        NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low','medium','high','critical')),
        orchestrator_id TEXT,
        owner           TEXT,
        active_form     TEXT,
        blocks          JSONB       NOT NULL DEFAULT '[]',
        blocked_by      JSONB       NOT NULL DEFAULT '[]',
        metadata        JSONB       NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_daemon_tasks_status
        ON daemon_tasks (status);
      CREATE INDEX IF NOT EXISTS idx_daemon_tasks_orchestrator_id
        ON daemon_tasks (orchestrator_id);
      CREATE INDEX IF NOT EXISTS idx_daemon_tasks_priority
        ON daemon_tasks (priority);
      CREATE INDEX IF NOT EXISTS idx_daemon_tasks_owner
        ON daemon_tasks (owner);
      CREATE INDEX IF NOT EXISTS idx_daemon_tasks_created_at
        ON daemon_tasks (created_at DESC);
    `,
  },
  {
    version: 3,
    name: 'create_daemon_backlog_items',
    up: `
      CREATE TABLE IF NOT EXISTS daemon_backlog_items (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id         UUID        NOT NULL REFERENCES daemon_tasks(id) ON DELETE CASCADE,
        orchestrator_id TEXT        NOT NULL,
        position        INTEGER     NOT NULL DEFAULT 0,
        added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_daemon_backlog_orchestrator_id
        ON daemon_backlog_items (orchestrator_id);
      CREATE INDEX IF NOT EXISTS idx_daemon_backlog_task_id
        ON daemon_backlog_items (task_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daemon_backlog_unique_task_per_orchestrator
        ON daemon_backlog_items (task_id, orchestrator_id);
    `,
  },
  {
    version: 4,
    name: 'create_daemon_sessions',
    up: `
      CREATE TABLE IF NOT EXISTS daemon_sessions (
        id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_manager_id  TEXT        NOT NULL,
        state               TEXT        NOT NULL DEFAULT 'initializing'
                              CHECK (state IN ('initializing','running','paused','completed','failed','terminated')),
        config              JSONB       NOT NULL DEFAULT '{}',
        started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at        TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_daemon_sessions_session_manager_id
        ON daemon_sessions (session_manager_id);
      CREATE INDEX IF NOT EXISTS idx_daemon_sessions_state
        ON daemon_sessions (state);
      CREATE INDEX IF NOT EXISTS idx_daemon_sessions_started_at
        ON daemon_sessions (started_at DESC);
    `,
  },
  {
    version: 5,
    name: 'create_daemon_memory',
    up: `
      CREATE TABLE IF NOT EXISTS daemon_memory (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        orchestrator_id TEXT        NOT NULL,
        type            TEXT        NOT NULL
                          CHECK (type IN ('interaction','observation','decision','knowledge')),
        content         TEXT        NOT NULL,
        embedding       JSONB,
        importance      FLOAT       NOT NULL DEFAULT 0.5
                          CHECK (importance BETWEEN 0 AND 1),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at      TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_daemon_memory_orchestrator_id
        ON daemon_memory (orchestrator_id);
      CREATE INDEX IF NOT EXISTS idx_daemon_memory_type
        ON daemon_memory (type);
      CREATE INDEX IF NOT EXISTS idx_daemon_memory_created_at
        ON daemon_memory (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_daemon_memory_expires_at
        ON daemon_memory (expires_at)
        WHERE expires_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_daemon_memory_importance
        ON daemon_memory (importance DESC);
    `,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations against the given connection pool.
 *
 * Each migration is applied in a dedicated transaction so a failed migration
 * rolls back cleanly and does not corrupt the schema.
 *
 * Safe to call on an already-migrated database — already-applied migrations
 * are skipped based on the version number stored in daemon_schema_migrations.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const logger = new Logger('PostgresMigrations');

  // Ensure the migrations tracking table exists first (migration #1).
  // We run it directly rather than through the loop so the table is
  // present before we query it.
  await pool.query(MIGRATIONS[0]!.up);
  await pool.query(
    `INSERT INTO daemon_schema_migrations (version, name)
     VALUES ($1, $2)
     ON CONFLICT (version) DO NOTHING`,
    [MIGRATIONS[0]!.version, MIGRATIONS[0]!.name]
  );

  // Fetch already-applied versions
  const { rows } = await pool.query<{ version: number }>(
    'SELECT version FROM daemon_schema_migrations ORDER BY version ASC'
  );
  const appliedVersions = new Set(rows.map(r => r.version));

  // Apply pending migrations in order
  for (const migration of MIGRATIONS.slice(1)) {
    if (appliedVersions.has(migration.version)) {
      logger.debug(
        `Migration ${migration.version} (${migration.name}) already applied, skipping`
      );
      continue;
    }

    logger.info(`Applying migration ${migration.version}: ${migration.name}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.up);
      await client.query(
        `INSERT INTO daemon_schema_migrations (version, name) VALUES ($1, $2)`,
        [migration.version, migration.name]
      );
      await client.query('COMMIT');
      logger.info(`Migration ${migration.version} applied successfully`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      client.release();
    }
  }

  logger.info('All migrations applied');
}

/**
 * Return the list of migration versions that have been applied.
 * Useful for diagnostics and health checks.
 */
export async function getAppliedMigrations(
  pool: Pool
): Promise<Array<{ version: number; name: string; appliedAt: Date }>> {
  const { rows } = await pool.query<{
    version: number;
    name: string;
    applied_at: Date;
  }>(
    'SELECT version, name, applied_at FROM daemon_schema_migrations ORDER BY version ASC'
  );

  return rows.map(r => ({
    version: r.version,
    name: r.name,
    appliedAt: r.applied_at,
  }));
}
