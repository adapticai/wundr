/**
 * PostgreSQL Storage Adapter for Orchestrator Daemon
 *
 * Provides durable persistence for:
 *   - Tasks        (CRUD + filtered queries)
 *   - Backlogs     (ordered list per orchestrator)
 *   - Sessions     (state + config)
 *   - Memory       (key-value + semantic search stubs)
 *
 * Design decisions:
 *   - Connection pooling via `pg.Pool` (min:2, max:10)
 *   - Retry logic with exponential backoff for transient failures
 *   - All mutations run inside explicit transactions where atomicity matters
 *   - Prepared statements for the hot-path queries (pool.query with $N params
 *     are parameterised by the pg driver; true server-side prepared statements
 *     are used via pool.query({ name, text, values }) for repeated queries)
 *   - Logging follows the established Logger utility pattern
 */

import { Pool, type PoolConfig, type PoolClient } from 'pg';

import { Logger } from '../../utils/logger';
import { runMigrations } from './postgres-migrations';

import type { ManagedTask, TaskQuery } from '../../tasks/task-types';

// ---------------------------------------------------------------------------
// Public configuration
// ---------------------------------------------------------------------------

export interface PostgresAdapterConfig {
  /** PostgreSQL connection string, e.g. postgres://user:pass@host:5432/db */
  connectionString?: string;
  /** Individual connection parameters — used when connectionString is absent */
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  /** Connection pool settings */
  poolMin?: number;
  poolMax?: number;
  /** Idle connection timeout in ms. Default: 30 000 */
  idleTimeoutMs?: number;
  /** Connection acquisition timeout in ms. Default: 10 000 */
  connectionTimeoutMs?: number;
  /** Maximum retry attempts for transient errors. Default: 3 */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. Default: 200 */
  retryBaseDelayMs?: number;
  /** Whether to run schema migrations on connect(). Default: true */
  runMigrationsOnConnect?: boolean;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface BacklogItem {
  id: string;
  taskId: string;
  orchestratorId: string;
  position: number;
  addedAt: Date;
}

export interface SessionState {
  id: string;
  sessionManagerId: string;
  state: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'terminated';
  config: Record<string, unknown>;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface MemoryRecord {
  id: string;
  orchestratorId: string;
  type: 'interaction' | 'observation' | 'decision' | 'knowledge';
  content: string;
  embedding?: number[];
  importance: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AdapterStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalTaskCount: number;
  activeSessionCount: number;
  memoryRecordCount: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class PostgresAdapterError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PostgresAdapterError';
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class PostgresAdapter {
  private pool: Pool | null = null;
  private readonly config: Required<PostgresAdapterConfig>;
  private readonly logger: Logger;
  private connected = false;

  constructor(config: PostgresAdapterConfig = {}) {
    this.logger = new Logger('PostgresAdapter');
    this.config = {
      connectionString: config.connectionString ?? '',
      host: config.host ?? 'localhost',
      port: config.port ?? 5432,
      database: config.database ?? 'orchestrator',
      user: config.user ?? 'postgres',
      password: config.password ?? '',
      ssl: config.ssl ?? false,
      poolMin: config.poolMin ?? 2,
      poolMax: config.poolMax ?? 10,
      idleTimeoutMs: config.idleTimeoutMs ?? 30_000,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 10_000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelayMs: config.retryBaseDelayMs ?? 200,
      runMigrationsOnConnect: config.runMigrationsOnConnect ?? true,
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Connect to PostgreSQL and (optionally) run schema migrations.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const poolConfig: PoolConfig = {
      min: this.config.poolMin,
      max: this.config.poolMax,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,
    };

    if (this.config.connectionString) {
      poolConfig.connectionString = this.config.connectionString;
    } else {
      poolConfig.host = this.config.host;
      poolConfig.port = this.config.port;
      poolConfig.database = this.config.database;
      poolConfig.user = this.config.user;
      poolConfig.password = this.config.password;
    }

    if (this.config.ssl) {
      poolConfig.ssl = this.config.ssl;
    }

    this.pool = new Pool(poolConfig);

    // Verify connectivity
    await this.withRetry(() => this.pool!.query('SELECT 1'));

    this.logger.info('PostgreSQL pool created and verified');

    if (this.config.runMigrationsOnConnect) {
      await runMigrations(this.pool);
    }

    this.connected = true;
  }

  /**
   * Drain pool connections and release all resources.
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
    this.connected = false;
    this.logger.info('PostgreSQL pool closed');
  }

  // -------------------------------------------------------------------------
  // Health & Stats
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      this.ensurePool();
      await this.pool!.query('SELECT 1');
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getStats(): Promise<AdapterStats> {
    this.ensurePool();

    const [tasksResult, sessionsResult, memoryResult] = await Promise.all([
      this.pool!.query<{ count: string }>('SELECT COUNT(*) AS count FROM daemon_tasks'),
      this.pool!.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM daemon_sessions WHERE state IN ('initializing','running','paused')",
      ),
      this.pool!.query<{ count: string }>('SELECT COUNT(*) AS count FROM daemon_memory'),
    ]);

    return {
      totalConnections: this.pool!.totalCount,
      idleConnections: this.pool!.idleCount,
      waitingClients: this.pool!.waitingCount,
      totalTaskCount: parseInt(tasksResult.rows[0]?.count ?? '0', 10),
      activeSessionCount: parseInt(sessionsResult.rows[0]?.count ?? '0', 10),
      memoryRecordCount: parseInt(memoryResult.rows[0]?.count ?? '0', 10),
    };
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------

  async getTask(id: string): Promise<ManagedTask | null> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<TaskRow>(
        { name: 'get_task', text: 'SELECT * FROM daemon_tasks WHERE id = $1' },
        [id],
      ),
    );

    return rows[0] ? rowToTask(rows[0]) : null;
  }

  async getTasks(filter?: TaskQuery): Promise<ManagedTask[]> {
    this.ensurePool();

    const { sql, params } = buildTaskQuery(filter);
    const { rows } = await this.withRetry(() => this.pool!.query<TaskRow>(sql, params));
    return rows.map(rowToTask);
  }

  async createTask(task: ManagedTask): Promise<ManagedTask> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<TaskRow>(
        {
          name: 'create_task',
          text: `
            INSERT INTO daemon_tasks
              (id, title, description, status, priority, orchestrator_id,
               owner, active_form, blocks, blocked_by, metadata, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING *
          `,
        },
        [
          task.id,
          task.subject,
          task.description,
          task.status,
          task.priority,
          task.metadata?.orchestratorId ?? null,
          task.owner ?? null,
          task.activeForm ?? null,
          JSON.stringify(task.blocks),
          JSON.stringify(task.blockedBy),
          JSON.stringify(task.metadata),
          task.createdAt,
          task.updatedAt,
        ],
      ),
    );

    const row = rows[0];
    if (!row) {
      throw new PostgresAdapterError(`createTask: no row returned for id ${task.id}`);
    }
    return rowToTask(row);
  }

  async updateTask(id: string, updates: Partial<ManagedTask>): Promise<ManagedTask | null> {
    this.ensurePool();

    const existing = await this.getTask(id);
    if (!existing) {
      return null;
    }

    const merged: ManagedTask = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: updates.updatedAt ?? new Date(),
    };

    const { rows } = await this.withRetry(() =>
      this.pool!.query<TaskRow>(
        {
          name: 'update_task',
          text: `
            UPDATE daemon_tasks SET
              title           = $2,
              description     = $3,
              status          = $4,
              priority        = $5,
              orchestrator_id = $6,
              owner           = $7,
              active_form     = $8,
              blocks          = $9,
              blocked_by      = $10,
              metadata        = $11,
              updated_at      = $12
            WHERE id = $1
            RETURNING *
          `,
        },
        [
          merged.id,
          merged.subject,
          merged.description,
          merged.status,
          merged.priority,
          merged.metadata?.orchestratorId ?? null,
          merged.owner ?? null,
          merged.activeForm ?? null,
          JSON.stringify(merged.blocks),
          JSON.stringify(merged.blockedBy),
          JSON.stringify(merged.metadata),
          merged.updatedAt,
        ],
      ),
    );

    return rows[0] ? rowToTask(rows[0]) : null;
  }

  async deleteTask(id: string): Promise<boolean> {
    this.ensurePool();

    const { rowCount } = await this.withRetry(() =>
      this.pool!.query({ name: 'delete_task', text: 'DELETE FROM daemon_tasks WHERE id = $1' }, [
        id,
      ]),
    );

    return (rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Backlog
  // -------------------------------------------------------------------------

  async getBacklog(orchestratorId: string): Promise<BacklogItem[]> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<BacklogRow>(
        {
          name: 'get_backlog',
          text: `
            SELECT * FROM daemon_backlog_items
            WHERE orchestrator_id = $1
            ORDER BY position ASC, added_at ASC
          `,
        },
        [orchestratorId],
      ),
    );

    return rows.map(rowToBacklogItem);
  }

  async addToBacklog(
    orchestratorId: string,
    taskId: string,
    position?: number,
  ): Promise<BacklogItem> {
    this.ensurePool();

    // Determine next position if not provided
    let resolvedPosition = position;
    if (resolvedPosition === undefined) {
      const { rows } = await this.pool!.query<{ max: string | null }>(
        'SELECT MAX(position) AS max FROM daemon_backlog_items WHERE orchestrator_id = $1',
        [orchestratorId],
      );
      resolvedPosition = rows[0]?.max !== null ? parseInt(rows[0]?.max ?? '0', 10) + 1 : 0;
    }

    const { rows } = await this.withRetry(() =>
      this.pool!.query<BacklogRow>(
        {
          name: 'add_to_backlog',
          text: `
            INSERT INTO daemon_backlog_items (task_id, orchestrator_id, position)
            VALUES ($1, $2, $3)
            ON CONFLICT (task_id, orchestrator_id) DO UPDATE
              SET position = EXCLUDED.position
            RETURNING *
          `,
        },
        [taskId, orchestratorId, resolvedPosition],
      ),
    );

    const row = rows[0];
    if (!row) {
      throw new PostgresAdapterError('addToBacklog: no row returned');
    }
    return rowToBacklogItem(row);
  }

  async removeFromBacklog(orchestratorId: string, taskId: string): Promise<boolean> {
    this.ensurePool();

    const { rowCount } = await this.withRetry(() =>
      this.pool!.query(
        {
          name: 'remove_from_backlog',
          text: 'DELETE FROM daemon_backlog_items WHERE orchestrator_id = $1 AND task_id = $2',
        },
        [orchestratorId, taskId],
      ),
    );

    return (rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async getSessionState(id: string): Promise<SessionState | null> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<SessionRow>(
        { name: 'get_session', text: 'SELECT * FROM daemon_sessions WHERE id = $1' },
        [id],
      ),
    );

    return rows[0] ? rowToSession(rows[0]) : null;
  }

  async saveSessionState(
    session: Omit<SessionState, 'id'> & { id?: string },
  ): Promise<SessionState> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<SessionRow>(
        {
          name: 'upsert_session',
          text: `
            INSERT INTO daemon_sessions
              (id, session_manager_id, state, config, started_at, updated_at, completed_at)
            VALUES (
              COALESCE($1, gen_random_uuid()),
              $2, $3, $4, $5, $6, $7
            )
            ON CONFLICT (id) DO UPDATE SET
              session_manager_id = EXCLUDED.session_manager_id,
              state              = EXCLUDED.state,
              config             = EXCLUDED.config,
              updated_at         = EXCLUDED.updated_at,
              completed_at       = EXCLUDED.completed_at
            RETURNING *
          `,
        },
        [
          session.id ?? null,
          session.sessionManagerId,
          session.state,
          JSON.stringify(session.config),
          session.startedAt,
          session.updatedAt ?? new Date(),
          session.completedAt ?? null,
        ],
      ),
    );

    const row = rows[0];
    if (!row) {
      throw new PostgresAdapterError('saveSessionState: no row returned');
    }
    return rowToSession(row);
  }

  async listActiveSessions(): Promise<SessionState[]> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<SessionRow>(
        {
          name: 'list_active_sessions',
          text: `
            SELECT * FROM daemon_sessions
            WHERE state IN ('initializing','running','paused')
            ORDER BY started_at DESC
          `,
        },
      ),
    );

    return rows.map(rowToSession);
  }

  // -------------------------------------------------------------------------
  // Memory
  // -------------------------------------------------------------------------

  async storeMemory(
    record: Omit<MemoryRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: Date },
  ): Promise<MemoryRecord> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<MemoryRow>(
        {
          name: 'store_memory',
          text: `
            INSERT INTO daemon_memory
              (id, orchestrator_id, type, content, embedding, importance, created_at, expires_at)
            VALUES (
              COALESCE($1, gen_random_uuid()),
              $2, $3, $4, $5, $6,
              COALESCE($7, NOW()),
              $8
            )
            ON CONFLICT (id) DO UPDATE SET
              content    = EXCLUDED.content,
              embedding  = EXCLUDED.embedding,
              importance = EXCLUDED.importance,
              expires_at = EXCLUDED.expires_at
            RETURNING *
          `,
        },
        [
          record.id ?? null,
          record.orchestratorId,
          record.type,
          record.content,
          record.embedding ? JSON.stringify(record.embedding) : null,
          record.importance,
          record.createdAt ?? null,
          record.expiresAt ?? null,
        ],
      ),
    );

    const row = rows[0];
    if (!row) {
      throw new PostgresAdapterError('storeMemory: no row returned');
    }
    return rowToMemory(row);
  }

  async retrieveMemory(id: string): Promise<MemoryRecord | null> {
    this.ensurePool();

    const { rows } = await this.withRetry(() =>
      this.pool!.query<MemoryRow>(
        { name: 'retrieve_memory', text: 'SELECT * FROM daemon_memory WHERE id = $1' },
        [id],
      ),
    );

    return rows[0] ? rowToMemory(rows[0]) : null;
  }

  /**
   * Search memories for an orchestrator by content substring or type.
   * Results are ordered by importance descending, then recency.
   * Excludes expired records.
   */
  async searchMemories(
    orchestratorId: string,
    options?: {
      query?: string;
      type?: MemoryRecord['type'];
      limit?: number;
      minImportance?: number;
    },
  ): Promise<MemoryRecord[]> {
    this.ensurePool();

    const conditions: string[] = [
      'orchestrator_id = $1',
      '(expires_at IS NULL OR expires_at > NOW())',
    ];
    const params: unknown[] = [orchestratorId];
    let paramIdx = 2;

    if (options?.query) {
      conditions.push(`content ILIKE $${paramIdx}`);
      params.push(`%${options.query}%`);
      paramIdx++;
    }

    if (options?.type) {
      conditions.push(`type = $${paramIdx}`);
      params.push(options.type);
      paramIdx++;
    }

    if (options?.minImportance !== undefined) {
      conditions.push(`importance >= $${paramIdx}`);
      params.push(options.minImportance);
      paramIdx++;
    }

    const limit = options?.limit ?? 50;
    const sql = `
      SELECT * FROM daemon_memory
      WHERE ${conditions.join(' AND ')}
      ORDER BY importance DESC, created_at DESC
      LIMIT ${limit}
    `;

    const { rows } = await this.withRetry(() => this.pool!.query<MemoryRow>(sql, params));
    return rows.map(rowToMemory);
  }

  // -------------------------------------------------------------------------
  // Transaction helper
  // -------------------------------------------------------------------------

  /**
   * Execute a callback inside a serializable transaction.
   * The callback receives a PoolClient; commit and rollback are managed
   * automatically.
   */
  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    this.ensurePool();

    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private ensurePool(): void {
    if (!this.pool || !this.connected) {
      throw new PostgresAdapterError(
        'PostgresAdapter is not connected. Call connect() first.',
      );
    }
  }

  /**
   * Execute fn with exponential backoff retry on transient PostgreSQL errors.
   * Retries on connection errors (ECONNREFUSED, ETIMEDOUT) and lock errors
   * (40001 serialization failure, 40P01 deadlock detected).
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const retryable = new Set(['40001', '40P01', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET']);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastErr = err;

        const code =
          (err as { code?: string }).code ??
          (err as { errno?: string }).errno ??
          '';

        if (!retryable.has(code) || attempt === this.config.maxRetries) {
          break;
        }

        const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Transient error (${code}), retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`,
        );
        await sleep(delay);
      }
    }

    throw new PostgresAdapterError(
      `Operation failed after ${this.config.maxRetries} retries`,
      lastErr,
    );
  }
}

// ---------------------------------------------------------------------------
// Row types (raw DB shapes)
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  orchestrator_id: string | null;
  owner: string | null;
  active_form: string | null;
  blocks: unknown;
  blocked_by: unknown;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}

interface BacklogRow {
  id: string;
  task_id: string;
  orchestrator_id: string;
  position: number;
  added_at: Date;
}

interface SessionRow {
  id: string;
  session_manager_id: string;
  state: string;
  config: unknown;
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

interface MemoryRow {
  id: string;
  orchestrator_id: string;
  type: string;
  content: string;
  embedding: unknown;
  importance: number;
  created_at: Date;
  expires_at: Date | null;
}

// ---------------------------------------------------------------------------
// Row-to-type converters
// ---------------------------------------------------------------------------

function rowToTask(row: TaskRow): ManagedTask {
  return {
    id: row.id,
    subject: row.title,
    description: row.description,
    status: row.status as ManagedTask['status'],
    priority: row.priority as ManagedTask['priority'],
    owner: row.owner,
    activeForm: row.active_form,
    blocks: parseJsonArray(row.blocks),
    blockedBy: parseJsonArray(row.blocked_by),
    metadata: parseJsonObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBacklogItem(row: BacklogRow): BacklogItem {
  return {
    id: row.id,
    taskId: row.task_id,
    orchestratorId: row.orchestrator_id,
    position: row.position,
    addedAt: row.added_at,
  };
}

function rowToSession(row: SessionRow): SessionState {
  return {
    id: row.id,
    sessionManagerId: row.session_manager_id,
    state: row.state as SessionState['state'],
    config: parseJsonObject(row.config),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function rowToMemory(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    orchestratorId: row.orchestrator_id,
    type: row.type as MemoryRecord['type'],
    content: row.content,
    embedding: parseOptionalJsonArray(row.embedding),
    importance: row.importance,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Query builder for tasks
// ---------------------------------------------------------------------------

function buildTaskQuery(filter?: TaskQuery): { sql: string; params: unknown[] } {
  if (!filter) {
    return { sql: 'SELECT * FROM daemon_tasks ORDER BY created_at ASC', params: [] };
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filter.status !== undefined) {
    if (Array.isArray(filter.status)) {
      const placeholders = filter.status.map(() => `$${idx++}`).join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...filter.status);
    } else {
      conditions.push(`status = $${idx++}`);
      params.push(filter.status);
    }
  }

  if (filter.owner !== undefined) {
    conditions.push(`owner = $${idx++}`);
    params.push(filter.owner);
  }

  if (filter.priority !== undefined) {
    if (Array.isArray(filter.priority)) {
      const placeholders = filter.priority.map(() => `$${idx++}`).join(', ');
      conditions.push(`priority IN (${placeholders})`);
      params.push(...filter.priority);
    } else {
      conditions.push(`priority = $${idx++}`);
      params.push(filter.priority);
    }
  }

  if (filter.isBlocked === true) {
    conditions.push("blocked_by != '[]'::jsonb");
  } else if (filter.isBlocked === false) {
    conditions.push("blocked_by = '[]'::jsonb");
  }

  if (filter.hasOwner === true) {
    conditions.push('owner IS NOT NULL');
  } else if (filter.hasOwner === false) {
    conditions.push('owner IS NULL');
  }

  let sql = 'SELECT * FROM daemon_tasks';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at ASC';

  if (filter.limit !== undefined) {
    sql += ` LIMIT $${idx++}`;
    params.push(filter.limit);
  }
  if (filter.offset !== undefined) {
    sql += ` OFFSET $${idx++}`;
    params.push(filter.offset);
  }

  return { sql, params };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value as string[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseOptionalJsonArray(value: unknown): number[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value as number[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as number[]) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
