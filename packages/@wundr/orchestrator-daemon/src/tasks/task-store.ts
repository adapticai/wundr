/**
 * Task Store - Persistence layer for task management
 *
 * Provides two implementations of the ITaskStore interface:
 *
 * 1. InMemoryTaskStore  - Map-backed, fast, used for tests
 * 2. SqliteTaskStore    - better-sqlite3 backed, durable, used in production
 *
 * Both implementations serialize `blocks`, `blockedBy`, and `metadata` as JSON
 * strings when stored in SQLite, and deserialize on read.
 */

import { TaskStoreError, DuplicateTaskError } from './task-types';
import { Logger } from '../utils/logger';

import type {
  ITaskStore,
  ManagedTask,
  TaskQuery,
  TaskStatus,
  TaskPriority,
} from './task-types';

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory task store backed by a Map. Suitable for tests and ephemeral
 * daemon instances that do not require persistence across restarts.
 */
export class InMemoryTaskStore implements ITaskStore {
  private tasks: Map<string, ManagedTask> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('InMemoryTaskStore');
  }

  async initialize(): Promise<void> {
    this.logger.debug('InMemoryTaskStore initialized');
  }

  async create(task: ManagedTask): Promise<void> {
    if (this.tasks.has(task.id)) {
      throw new DuplicateTaskError(task.id);
    }
    this.tasks.set(task.id, { ...task });
    this.logger.debug(`Created task: ${task.id}`);
  }

  async get(id: string): Promise<ManagedTask | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async update(
    id: string,
    updates: Partial<ManagedTask>
  ): Promise<ManagedTask | null> {
    const existing = this.tasks.get(id);
    if (!existing) {
      return null;
    }

    const updated: ManagedTask = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID mutation
      updatedAt: updates.updatedAt ?? new Date(),
    };

    this.tasks.set(id, updated);
    this.logger.debug(`Updated task: ${id}`);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.tasks.has(id);
    this.tasks.delete(id);
    if (existed) {
      this.logger.debug(`Deleted task: ${id}`);
    }
    return existed;
  }

  async query(query: TaskQuery): Promise<ManagedTask[]> {
    let results = Array.from(this.tasks.values());

    results = applyQueryFilters(results, query);

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    results = results.slice(offset, offset + limit);

    return results.map(t => ({ ...t }));
  }

  async getAll(): Promise<ManagedTask[]> {
    return Array.from(this.tasks.values()).map(t => ({ ...t }));
  }

  async count(query?: TaskQuery): Promise<number> {
    if (!query) {
      return this.tasks.size;
    }
    const results = applyQueryFilters(Array.from(this.tasks.values()), query);
    return results.length;
  }

  async close(): Promise<void> {
    this.tasks.clear();
    this.logger.debug('InMemoryTaskStore closed');
  }
}

// =============================================================================
// SQLite Implementation
// =============================================================================

/**
 * SQLite-backed task store using better-sqlite3 for synchronous I/O wrapped
 * in async interface. Provides durable storage that survives daemon restarts.
 *
 * The store serializes array/object fields (blocks, blockedBy, metadata) as
 * JSON text columns and deserializes on read.
 */
export class SqliteTaskStore implements ITaskStore {
  private db: SqliteDatabase | null = null;
  private dbPath: string;
  private logger: Logger;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.logger = new Logger('SqliteTaskStore');
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid hard dependency on better-sqlite3 in
      // environments that only use InMemoryTaskStore (e.g., tests).
      const Database = await loadSqliteDriver();
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrent read performance
      this.db.pragma('journal_mode = WAL');

      // Create tasks table and indexes
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          owner TEXT,
          active_form TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          blocks TEXT NOT NULL DEFAULT '[]',
          blocked_by TEXT NOT NULL DEFAULT '[]',
          metadata TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      this.db.run(
        'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)'
      );
      this.db.run('CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner)');
      this.db.run(
        'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)'
      );

      this.logger.info(`SqliteTaskStore initialized at ${this.dbPath}`);
    } catch (error) {
      throw new TaskStoreError(
        `Failed to initialize SQLite store: ${error}`,
        error
      );
    }
  }

  async create(task: ManagedTask): Promise<void> {
    this.ensureDb();

    try {
      const stmt = this.db!.prepare(`
        INSERT INTO tasks (id, subject, description, status, owner, active_form,
                          priority, blocks, blocked_by, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        task.id,
        task.subject,
        task.description,
        task.status,
        task.owner,
        task.activeForm,
        task.priority,
        JSON.stringify(task.blocks),
        JSON.stringify(task.blockedBy),
        JSON.stringify(task.metadata),
        task.createdAt.toISOString(),
        task.updatedAt.toISOString()
      );

      this.logger.debug(`Created task: ${task.id}`);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint')
      ) {
        throw new DuplicateTaskError(task.id);
      }
      throw new TaskStoreError(`Failed to create task: ${error}`, error);
    }
  }

  async get(id: string): Promise<ManagedTask | null> {
    this.ensureDb();

    try {
      const stmt = this.db!.prepare('SELECT * FROM tasks WHERE id = ?');
      const row = stmt.get(id) as SqliteRow | undefined;

      if (!row) {
        return null;
      }

      return rowToTask(row);
    } catch (error) {
      throw new TaskStoreError(`Failed to get task ${id}: ${error}`, error);
    }
  }

  async update(
    id: string,
    updates: Partial<ManagedTask>
  ): Promise<ManagedTask | null> {
    this.ensureDb();

    try {
      // Fetch the current row first
      const existing = await this.get(id);
      if (!existing) {
        return null;
      }

      // Merge updates
      const merged: ManagedTask = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent ID mutation
        updatedAt: updates.updatedAt ?? new Date(),
      };

      const stmt = this.db!.prepare(`
        UPDATE tasks SET
          subject = ?,
          description = ?,
          status = ?,
          owner = ?,
          active_form = ?,
          priority = ?,
          blocks = ?,
          blocked_by = ?,
          metadata = ?,
          updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        merged.subject,
        merged.description,
        merged.status,
        merged.owner,
        merged.activeForm,
        merged.priority,
        JSON.stringify(merged.blocks),
        JSON.stringify(merged.blockedBy),
        JSON.stringify(merged.metadata),
        merged.updatedAt.toISOString(),
        merged.id
      );

      this.logger.debug(`Updated task: ${id}`);
      return merged;
    } catch (error) {
      throw new TaskStoreError(`Failed to update task ${id}: ${error}`, error);
    }
  }

  async delete(id: string): Promise<boolean> {
    this.ensureDb();

    try {
      const stmt = this.db!.prepare('DELETE FROM tasks WHERE id = ?');
      const result = stmt.run(id);
      const deleted = result.changes > 0;

      if (deleted) {
        this.logger.debug(`Deleted task: ${id}`);
      }

      return deleted;
    } catch (error) {
      throw new TaskStoreError(`Failed to delete task ${id}: ${error}`, error);
    }
  }

  async query(query: TaskQuery): Promise<ManagedTask[]> {
    this.ensureDb();

    try {
      const { sql, params } = buildQuerySql(query);
      const stmt = this.db!.prepare(sql);
      const rows = stmt.all(...params) as SqliteRow[];

      return rows.map(rowToTask);
    } catch (error) {
      throw new TaskStoreError(`Failed to query tasks: ${error}`, error);
    }
  }

  async getAll(): Promise<ManagedTask[]> {
    this.ensureDb();

    try {
      const stmt = this.db!.prepare(
        'SELECT * FROM tasks ORDER BY created_at ASC'
      );
      const rows = stmt.all() as SqliteRow[];
      return rows.map(rowToTask);
    } catch (error) {
      throw new TaskStoreError(`Failed to get all tasks: ${error}`, error);
    }
  }

  async count(query?: TaskQuery): Promise<number> {
    this.ensureDb();

    try {
      if (!query) {
        const stmt = this.db!.prepare('SELECT COUNT(*) as count FROM tasks');
        const row = stmt.get() as { count: number };
        return row.count;
      }

      const { sql, params } = buildCountSql(query);
      const stmt = this.db!.prepare(sql);
      const row = stmt.get(...params) as { count: number };
      return row.count;
    } catch (error) {
      throw new TaskStoreError(`Failed to count tasks: ${error}`, error);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info('SqliteTaskStore closed');
    }
  }

  /**
   * Ensure the database handle is open.
   */
  private ensureDb(): void {
    if (!this.db) {
      throw new TaskStoreError(
        'SqliteTaskStore is not initialized. Call initialize() first.'
      );
    }
  }
}

// =============================================================================
// SQLite Helpers
// =============================================================================

/**
 * Minimal interface for the better-sqlite3 Database object.
 * Avoids importing the full module at the type level.
 */
interface SqliteDatabase {
  pragma(pragma: string): unknown;
  run(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface SqliteStatement {
  run(...params: unknown[]): {
    changes: number;
    lastInsertRowid: number | bigint;
  };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * Raw row shape as returned by SQLite.
 */
interface SqliteRow {
  id: string;
  subject: string;
  description: string;
  status: string;
  owner: string | null;
  active_form: string | null;
  priority: string;
  blocks: string;
  blocked_by: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convert a SQLite row to a ManagedTask object.
 */
function rowToTask(row: SqliteRow): ManagedTask {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    status: row.status as ManagedTask['status'],
    owner: row.owner,
    activeForm: row.active_form,
    priority: row.priority as ManagedTask['priority'],
    blocks: JSON.parse(row.blocks) as string[],
    blockedBy: JSON.parse(row.blocked_by) as string[],
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Dynamically loads the better-sqlite3 module. Returns the Database constructor.
 * Uses a string variable for the module name to avoid static analysis by the
 * TypeScript compiler, since better-sqlite3 is an optional peer dependency.
 */
async function loadSqliteDriver(): Promise<
  new (path: string) => SqliteDatabase
> {
  try {
    // Use a variable to prevent TypeScript from resolving the module statically.
    const moduleName = 'better-sqlite3';
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require(moduleName);
    return (mod.default ?? mod) as new (path: string) => SqliteDatabase;
  } catch {
    throw new TaskStoreError(
      'better-sqlite3 is required for SqliteTaskStore. Install with: pnpm add better-sqlite3'
    );
  }
}

/**
 * Build a SELECT SQL query from a TaskQuery.
 */
function buildQuerySql(query: TaskQuery): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  appendQueryConditions(query, conditions, params);

  let sql = 'SELECT * FROM tasks';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at ASC';

  if (query.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(query.limit);
  }
  if (query.offset !== undefined) {
    sql += ' OFFSET ?';
    params.push(query.offset);
  }

  return { sql, params };
}

/**
 * Build a COUNT SQL query from a TaskQuery.
 */
function buildCountSql(query: TaskQuery): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  appendQueryConditions(query, conditions, params);

  let sql = 'SELECT COUNT(*) as count FROM tasks';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { sql, params };
}

/**
 * Appends WHERE conditions to the conditions array and parameters to the
 * params array based on the given TaskQuery.
 */
function appendQueryConditions(
  query: TaskQuery,
  conditions: string[],
  params: unknown[]
): void {
  if (query.status !== undefined) {
    if (Array.isArray(query.status)) {
      const placeholders = query.status.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...query.status);
    } else {
      conditions.push('status = ?');
      params.push(query.status);
    }
  }

  if (query.owner !== undefined) {
    conditions.push('owner = ?');
    params.push(query.owner);
  }

  if (query.priority !== undefined) {
    if (Array.isArray(query.priority)) {
      const placeholders = query.priority.map(() => '?').join(', ');
      conditions.push(`priority IN (${placeholders})`);
      params.push(...query.priority);
    } else {
      conditions.push('priority = ?');
      params.push(query.priority);
    }
  }

  if (query.isBlocked === true) {
    conditions.push("blocked_by != '[]'");
  } else if (query.isBlocked === false) {
    conditions.push("blocked_by = '[]'");
  }

  if (query.hasOwner === true) {
    conditions.push('owner IS NOT NULL');
  } else if (query.hasOwner === false) {
    conditions.push('owner IS NULL');
  }
}

// =============================================================================
// Shared In-Memory Query Logic
// =============================================================================

/**
 * Apply query filters to an in-memory array of tasks.
 */
function applyQueryFilters(
  tasks: ManagedTask[],
  query: TaskQuery
): ManagedTask[] {
  let results = tasks;

  if (query.status !== undefined) {
    const statuses: TaskStatus[] = Array.isArray(query.status)
      ? query.status
      : [query.status];
    results = results.filter(t => statuses.includes(t.status));
  }

  if (query.owner !== undefined) {
    results = results.filter(t => t.owner === query.owner);
  }

  if (query.priority !== undefined) {
    const priorities: TaskPriority[] = Array.isArray(query.priority)
      ? query.priority
      : [query.priority];
    results = results.filter(t => priorities.includes(t.priority));
  }

  if (query.isBlocked === true) {
    results = results.filter(t => t.blockedBy.length > 0);
  } else if (query.isBlocked === false) {
    results = results.filter(t => t.blockedBy.length === 0);
  }

  if (query.hasOwner === true) {
    results = results.filter(t => t.owner !== null);
  } else if (query.hasOwner === false) {
    results = results.filter(t => t.owner === null);
  }

  return results;
}
