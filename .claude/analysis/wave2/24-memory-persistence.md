# Wave 2 Analysis 24: SQLite-Based Memory Persistence Layer

## Executive Summary

Wundr's `@wundr/agent-memory` package implements a MemGPT-inspired three-tier
memory system (scratchpad / episodic / semantic) that operates entirely
in-memory. The `serialize()` / `restore()` API exists but requires external
callers to manage I/O, and all state is volatile between process restarts.

This document specifies a SQLite-backed persistence layer that makes memory
durable by default -- preserving the existing tier semantics, forgetting curve
state, and session lifecycle while adding crash recovery, atomic transactions,
LRU caching, backup/restore, and import/export capabilities.

The design draws heavily from OpenClaw's `MemoryIndexManager` which
demonstrates production-grade patterns: WAL-mode SQLite, transactional writes,
schema migrations, embedding caches with LRU eviction, and atomic reindexing
via temp-DB swap.

---

## 1. Current State Analysis

### 1.1 Wundr `@wundr/agent-memory`

| Component | Storage | Persistence |
|-----------|---------|-------------|
| Scratchpad | In-memory `Map` | `serialize()` -> JSON |
| Episodic Store | In-memory array | `serialize()` -> JSON |
| Semantic Store | In-memory array | `serialize()` -> JSON |
| Forgetting Curve | In-memory `Map` (schedules) | `serialize()` -> JSON |
| Session Manager | In-memory `Map` | Optional callback-based persistence |

**Gaps:**
- No automatic persistence -- callers must manually invoke `serialize()`
- No crash recovery -- unclean shutdown loses all state
- No transactional guarantees -- partial writes can corrupt state
- No incremental persistence -- full state dump on every save
- Session manager accepts persistence callbacks but no implementation exists

### 1.2 OpenClaw Reference Patterns

| Pattern | Implementation |
|---------|---------------|
| Storage engine | `node:sqlite` (`DatabaseSync`) with WAL mode |
| Schema management | Inline `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` migration |
| Transactions | `BEGIN` / `COMMIT` / `ROLLBACK` with try/catch guards |
| Caching | SQLite embedding cache table with LRU eviction by `updated_at` |
| Atomic reindex | Build temp DB -> swap files -> reopen main DB |
| Integrity | Hash-based change detection for incremental updates |

---

## 2. Design

### 2.1 Architecture Overview

```
AgentMemoryManager
  |
  +-- Scratchpad (in-memory, hot)
  +-- EpisodicStore (in-memory)
  +-- SemanticStore (in-memory)
  +-- ForgettingCurve (in-memory)
  +-- SessionManager (in-memory)
  |
  +-- PersistenceLayer (NEW)
        |
        +-- SQLiteStore        -- Core database operations
        |     |
        |     +-- migrations.ts  -- Schema versioning and migration
        |
        +-- CacheLayer         -- LRU cache in front of SQLite
        +-- BackupManager      -- Backup, restore, export, import
```

### 2.2 SQLite Schema (Three-Tier Tables)

```sql
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);

-- Scratchpad: active working memory
CREATE TABLE IF NOT EXISTS scratchpad (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,          -- JSON-serialized
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL,         -- JSON-serialized MemoryMetadata
  embedding TEXT,                 -- JSON-serialized number[]
  linked_memories TEXT NOT NULL DEFAULT '[]',  -- JSON array of UUIDs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Episodic: autobiographical event memories
CREATE TABLE IF NOT EXISTS episodic (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL,
  embedding TEXT,
  linked_memories TEXT NOT NULL DEFAULT '[]',
  episode_data TEXT,              -- JSON-serialized EpisodeMetadata
  session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Semantic: consolidated knowledge/facts
CREATE TABLE IF NOT EXISTS semantic (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL,
  embedding TEXT,
  linked_memories TEXT NOT NULL DEFAULT '[]',
  semantic_data TEXT,             -- JSON-serialized SemanticMetadata
  category TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Forgetting curve spaced repetition schedules
CREATE TABLE IF NOT EXISTS repetition_schedules (
  memory_id TEXT PRIMARY KEY,
  next_review_at INTEGER NOT NULL,
  interval_ms INTEGER NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5
);

-- Session state
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

-- Session transcripts for search indexing
CREATE TABLE IF NOT EXISTS session_transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Memory promotion audit trail
CREATE TABLE IF NOT EXISTS promotion_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT NOT NULL,
  from_tier TEXT NOT NULL,
  to_tier TEXT NOT NULL,
  promoted_at INTEGER NOT NULL,
  reason TEXT
);
```

### 2.3 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_scratchpad_key ON scratchpad(key);
CREATE INDEX IF NOT EXISTS idx_scratchpad_updated ON scratchpad(updated_at);
CREATE INDEX IF NOT EXISTS idx_episodic_session ON episodic(session_id);
CREATE INDEX IF NOT EXISTS idx_episodic_created ON episodic(created_at);
CREATE INDEX IF NOT EXISTS idx_episodic_updated ON episodic(updated_at);
CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic(category);
CREATE INDEX IF NOT EXISTS idx_semantic_created ON semantic(created_at);
CREATE INDEX IF NOT EXISTS idx_semantic_updated ON semantic(updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON session_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON session_transcripts(timestamp);
CREATE INDEX IF NOT EXISTS idx_promotion_memory ON promotion_log(memory_id);
CREATE INDEX IF NOT EXISTS idx_promotion_time ON promotion_log(promoted_at);
CREATE INDEX IF NOT EXISTS idx_repetition_review ON repetition_schedules(next_review_at);
```

### 2.4 Migration System

Migrations are versioned and tracked in the `schema_version` table. Each
migration is a function that receives the database handle and runs
idempotent DDL statements. The migration runner:

1. Reads the current version from `schema_version` (0 if table absent)
2. Runs all migrations with version > current, in order
3. Wraps each migration in a transaction
4. Records the version after successful application

This approach mirrors OpenClaw's `ensureMemoryIndexSchema` but adds
version tracking for forward compatibility.

### 2.5 WAL Mode and Crash Recovery

SQLite is opened in WAL (Write-Ahead Logging) mode:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA wal_autocheckpoint = 1000;
PRAGMA busy_timeout = 5000;
```

WAL mode provides:
- Concurrent readers during writes
- Crash recovery (WAL is replayed on next open)
- Better write performance for frequent small writes

### 2.6 LRU Cache Layer

An in-memory LRU cache sits in front of SQLite for hot data. The cache:
- Has a configurable maximum entry count (default: 500)
- Uses a doubly-linked list + Map for O(1) get/put/evict
- Writes through to SQLite on `set()` (write-through strategy)
- Invalidates on `delete()` and `clear()`
- Provides `getOrLoad()` for transparent cache-miss handling
- Tracks hit/miss statistics for monitoring

### 2.7 Backup and Restore

The `BackupManager` provides:
- **SQLite backup**: Uses `VACUUM INTO` for a consistent snapshot
- **JSON export**: Reads all tables and produces a portable JSON document
- **JSON import**: Validates and loads a JSON export, replacing all data
- **Timestamped backups**: Auto-names backups with ISO timestamps
- **Integrity checks**: Runs `PRAGMA integrity_check` before backup
- **Maintenance**: `VACUUM` and `PRAGMA optimize` for database health

### 2.8 Memory Promotion Persistence

When memories are promoted (scratchpad -> episodic -> semantic):
1. The source row is deleted from the origin table
2. A new row is inserted in the destination table
3. A `promotion_log` entry records the transition
4. All three operations run in a single transaction

### 2.9 Forgetting Curve Integration

The `repetition_schedules` table persists spaced repetition state so that
review schedules survive restarts. The Ebbinghaus formula parameters are
stored in the memory metadata JSON, and `retentionStrength` is updated
in the tier table on each decay pass.

---

## 3. File Structure

```
packages/@wundr/agent-memory/src/persistence/
  index.ts           -- Public exports
  sqlite-store.ts    -- Core SQLiteStore class
  migrations.ts      -- Schema versioning and migration functions
  cache-layer.ts     -- LRU cache with write-through to SQLite
  backup.ts          -- Backup, restore, export, import
```

---

## 4. API Surface

### 4.1 SQLiteStore

```typescript
class SQLiteStore {
  constructor(dbPath: string, options?: SQLiteStoreOptions)
  open(): void
  close(): void
  transaction<T>(fn: () => T): T

  // Scratchpad
  putScratchpad(key: string, memory: Memory): void
  getScratchpad(key: string): Memory | null
  deleteScratchpad(key: string): boolean
  getAllScratchpad(): Memory[]
  clearScratchpad(): void

  // Episodic
  putEpisodic(memory: Memory): void
  getEpisodic(id: string): Memory | null
  deleteEpisodic(id: string): boolean
  queryEpisodic(options: QueryOptions): Memory[]

  // Semantic
  putSemantic(memory: Memory): void
  getSemantic(id: string): Memory | null
  deleteSemantic(id: string): boolean
  querySemantic(options: QueryOptions): Memory[]

  // Promotion
  promoteMemory(id: string, from: MemoryTier, to: MemoryTier, reason?: string): void

  // Sessions
  putSession(session: SessionState): void
  getSession(sessionId: string): SessionState | null
  deleteSession(sessionId: string): void
  getActiveSessions(): SessionState[]

  // Session Transcripts
  appendTranscript(sessionId: string, turn: number, role: string, content: string): void
  getTranscripts(sessionId: string): TranscriptEntry[]

  // Forgetting curve
  putRepetitionSchedule(schedule: RepetitionSchedule): void
  getRepetitionSchedule(memoryId: string): RepetitionSchedule | null
  getSchedulesDueForReview(before: number): RepetitionSchedule[]

  // Statistics
  getStatistics(): PersistenceStatistics
}
```

### 4.2 CacheLayer

```typescript
class CacheLayer<T> {
  constructor(options?: CacheLayerOptions)
  get(key: string): T | undefined
  set(key: string, value: T): void
  delete(key: string): boolean
  has(key: string): boolean
  clear(): void
  getOrLoad(key: string, loader: () => T | null): T | null
  getStatistics(): CacheStatistics
}
```

### 4.3 BackupManager

```typescript
class BackupManager {
  constructor(store: SQLiteStore, options?: BackupOptions)
  createBackup(targetPath?: string): string
  restoreBackup(sourcePath: string): void
  exportJSON(targetPath?: string): string
  importJSON(sourcePath: string): ImportResult
  runMaintenance(): MaintenanceResult
  checkIntegrity(): IntegrityResult
}
```

---

## 5. Integration with AgentMemoryManager

The persistence layer integrates via the existing `persistence` option:

```typescript
const manager = new AgentMemoryManager({
  persistence: true,
  config: {
    persistenceEnabled: true,
    persistencePath: '~/.wundr/memory/agent-memory.db',
  },
});
```

When persistence is enabled:
1. `initialize()` opens the SQLiteStore, runs migrations
2. `store()` writes through to SQLite after in-memory store
3. `promote()` records the transition in the promotion log
4. `endSession()` persists session state
5. `shutdown()` flushes remaining state and closes the database
6. `restore()` on next startup loads state from SQLite

---

## 6. Implementation Notes

### 6.1 `node:sqlite` Usage

Following OpenClaw's pattern, we use Node.js built-in `node:sqlite`
(`DatabaseSync`) for synchronous operations. This avoids external native
module dependencies (no `better-sqlite3`). The synchronous API is
appropriate for the memory persistence use case where writes are small
and frequent.

### 6.2 JSON Serialization

Complex fields (content, metadata, embedding, linked_memories) are stored
as JSON text in SQLite. This keeps the schema simple while supporting
the flexible `unknown` content type. Parsing happens at read time and
is cached by the LRU layer for hot data.

### 6.3 Transaction Safety

All multi-table operations (promotion, bulk import, session save with
scratchpad) are wrapped in explicit transactions. The `transaction()` helper
follows the pattern:

```typescript
transaction<T>(fn: () => T): T {
  this.db.run('BEGIN');
  try {
    const result = fn();
    this.db.run('COMMIT');
    return result;
  } catch (error) {
    this.db.run('ROLLBACK');
    throw error;
  }
}
```

### 6.4 Backward Compatibility

The persistence layer is opt-in. When `persistenceEnabled` is false,
the existing in-memory behavior is preserved exactly. The `serialize()`
and `restore()` methods continue to work for manual persistence.

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `node:sqlite` not available (Node < 22) | Runtime check with clear error message |
| Database corruption on hard crash | WAL mode provides automatic recovery |
| Large memory sets slow to load | LRU cache + lazy loading on demand |
| Schema drift between versions | Migration system with version tracking |
| JSON parsing overhead | Cache parsed objects in LRU layer |
| Disk space growth | VACUUM on maintenance, configurable retention |
