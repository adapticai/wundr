# Wave 2 Analysis 07: Dual-Backend Persistent Memory System

## Executive Summary

Wundr's `@wundr/agent-memory` package currently implements a MemGPT-inspired
three-tier memory system (scratchpad / episodic / semantic) that operates
entirely in-memory. All state is lost between process restarts unless manually
serialized. Meanwhile, OpenClaw's `MemoryIndexManager` demonstrates a
production-grade approach: SQLite-backed storage with FTS5 full-text search,
sqlite-vec vector similarity, hybrid result merging, embedding caches with LRU
eviction, session transcript delta tracking, and atomic reindexing via temp-DB
swap.

This document describes a dual-backend persistent memory system for Wundr that
bridges these two architectures -- preserving the MemGPT tier semantics while
adding the durability and search quality of OpenClaw's approach.

---

## 1. Architecture Comparison

### 1.1 Wundr Current State

| Component | Implementation | Persistence |
|-----------|---------------|-------------|
| Scratchpad | `Map<string, unknown>` | None (in-process) |
| Episodic Store | `MemoryEntry[]` array | None |
| Semantic Store | `MemoryEntry[]` array | None |
| Search | `Array.filter` on `content.includes(query)` | N/A |
| Session Manager | In-memory maps | JSON serialize/restore |
| Forgetting Curve | In-memory decay calculations | JSON serialize/restore |

Key gaps:
- **No full-text search** -- substring match only
- **No vector search** -- embedding fields exist but are never queried
- **No persistence** -- everything is volatile
- **No indexing** -- linear scans on every retrieval
- **No session transcript ingestion** -- sessions store scratchpad snapshots, not indexed transcripts

### 1.2 OpenClaw Reference Architecture

| Component | Implementation |
|-----------|---------------|
| Storage | SQLite via `node:sqlite` (`DatabaseSync`) |
| FTS | FTS5 virtual table (`chunks_fts`) with BM25 ranking |
| Vector | sqlite-vec extension (`chunks_vec`) with cosine distance |
| Hybrid Search | Weighted merge of vector + FTS results by chunk ID |
| Embedding Cache | SQLite table with LRU eviction by `updated_at` |
| Session Indexing | Delta tracking (byte offset + newline counting) |
| Reindexing | Temp DB build -> swap files atomically -> reopen |
| Batch Embeddings | OpenAI / Gemini / Voyage batch API with retry + fallback |
| File Watching | chokidar with debounced sync triggers |

---

## 2. Proposed Design

### 2.1 Dual-Backend Architecture

```
AgentMemoryManager (existing - orchestrator)
  |
  +-- Scratchpad      (in-memory, volatile by design)
  |
  +-- EpisodicStore   --+
  |                     |-- reads/writes via BackendAdapter interface
  +-- SemanticStore   --+
  |
  +-- SQLiteBackend (new)
  |     |-- chunks table (text + JSON embedding)
  |     |-- files table  (hash-based change detection)
  |     |-- meta table   (index versioning)
  |     |-- FTS5 virtual table (full-text search)
  |     |-- vec0 virtual table (vector similarity)
  |     |-- embedding_cache table (LRU eviction)
  |     |-- Memory tier table (scratchpad/episodic/semantic persistence)
  |
  +-- VectorSearch (new)
  |     |-- sqlite-vec loading + fallback cosine
  |     |-- query embedding with timeout
  |
  +-- HybridSearch (new)
  |     |-- FTS query builder
  |     |-- BM25 rank-to-score normalization
  |     |-- Weighted merge of vector + FTS results
  |
  +-- EmbeddingCache (new)
        |-- Hash-keyed cache in SQLite
        |-- LRU eviction by updated_at
        |-- Batch embedding support
```

### 2.2 Key Design Decisions

**D1: SQLite as single persistence layer.**
We follow OpenClaw's approach of using `node:sqlite` (the built-in Node.js
SQLite module available in Node 22+). A single `.sqlite` file stores chunks,
file metadata, embedding cache, FTS index, and vector index. This avoids
external database dependencies.

**D2: Scratchpad stays in-memory.**
The scratchpad is working memory for the current turn. It is volatile by
design in MemGPT. We persist a snapshot to SQLite on session end and restore
on session start, but the scratchpad is not searched via FTS/vector.

**D3: Episodic and semantic tiers persist to SQLite.**
When a memory is stored in episodic or semantic tiers, it is written to the
`memories` table and optionally chunked/embedded for search. Promotion and
demotion operations are atomic SQLite transactions.

**D4: Hybrid search is opt-in but default-on.**
Vector search requires sqlite-vec. If the extension is unavailable, we fall
back to cosine similarity on JSON-stored embeddings (like OpenClaw's fallback
path). FTS5 is available in all SQLite builds.

**D5: Session transcripts are indexed as memory source.**
Following OpenClaw's model, session transcript files (.jsonl) are parsed,
chunked, embedded, and indexed. Delta tracking avoids re-indexing unchanged
content.

**D6: Atomic reindexing via temp DB swap.**
When the embedding model changes or a force reindex is triggered, a new
temp database is built, the embedding cache is seeded from the old DB, and
after successful completion the files are atomically swapped.

### 2.3 Schema Design

```sql
-- Index metadata (model version, chunking config)
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tracked files (memory files, session transcripts)
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'memory',  -- 'memory' | 'sessions' | 'scratchpad'
  hash TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  size INTEGER NOT NULL
);

-- Text chunks with embeddings
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'memory',
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  hash TEXT NOT NULL,
  model TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,         -- JSON array of floats
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);

-- MemGPT tier persistence
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL,               -- 'scratchpad' | 'episodic' | 'semantic'
  content TEXT NOT NULL,            -- JSON serialized
  token_count INTEGER NOT NULL,
  metadata TEXT NOT NULL,           -- JSON serialized MemoryMetadata
  embedding TEXT,                   -- JSON array of floats
  linked_memories TEXT NOT NULL DEFAULT '[]',  -- JSON array of UUIDs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);

-- FTS5 full-text search over chunks
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  id UNINDEXED,
  path UNINDEXED,
  source UNINDEXED,
  model UNINDEXED,
  start_line UNINDEXED,
  end_line UNINDEXED
);

-- sqlite-vec vector index (created dynamically based on dimensions)
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[<dims>]
);

-- Embedding cache with LRU eviction
CREATE TABLE IF NOT EXISTS embedding_cache (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding TEXT NOT NULL,
  dims INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, hash)
);
CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at
  ON embedding_cache(updated_at);
```

---

## 3. Component Specifications

### 3.1 SQLiteBackend (`sqlite-backend.ts`)

Primary responsibilities:
- Open/create SQLite database with WAL mode
- Schema creation and migrations
- CRUD operations for chunks, files, memories
- Atomic reindex via temp DB swap
- Session transcript parsing and delta tracking

Key methods:
```typescript
interface SQLiteBackend {
  // Lifecycle
  open(dbPath: string, options?: OpenOptions): void;
  close(): void;

  // Schema
  ensureSchema(): void;
  readMeta(): IndexMeta | null;
  writeMeta(meta: IndexMeta): void;

  // Chunk operations
  upsertChunks(path: string, source: string, chunks: ChunkRecord[]): void;
  deleteChunksForPath(path: string, source: string): void;
  listChunks(model: string, source?: string): ChunkRecord[];

  // File tracking
  getFileRecord(path: string): FileRecord | null;
  upsertFileRecord(record: FileRecord): void;
  deleteStaleFiles(activePaths: Set<string>, source: string): void;

  // Memory tier persistence
  storeMemory(memory: SerializedMemory): void;
  getMemory(id: string): SerializedMemory | null;
  getMemoriesByTier(tier: string): SerializedMemory[];
  deleteMemory(id: string): void;
  updateMemoryTier(id: string, newTier: string): void;

  // Atomic reindex
  beginReindex(): TempDatabaseContext;
  commitReindex(ctx: TempDatabaseContext): void;
  rollbackReindex(ctx: TempDatabaseContext): void;

  // Session delta tracking
  getSessionDelta(path: string): SessionDelta;
  updateSessionDelta(path: string, delta: SessionDelta): void;
}
```

### 3.2 VectorSearch (`vector-search.ts`)

Primary responsibilities:
- Load sqlite-vec extension with fallback
- Create/manage vec0 virtual table
- Vector similarity queries via `vec_distance_cosine`
- Fallback cosine similarity on JSON embeddings

Key methods:
```typescript
interface VectorSearch {
  // Extension management
  loadExtension(db: DatabaseSync): Promise<LoadResult>;
  ensureVectorTable(db: DatabaseSync, dimensions: number): void;

  // Search
  search(params: VectorSearchParams): VectorSearchResult[];
  searchFallback(params: FallbackSearchParams): VectorSearchResult[];

  // Utilities
  vectorToBlob(embedding: number[]): Buffer;
  cosineSimilarity(a: number[], b: number[]): number;
}
```

### 3.3 HybridSearch (`hybrid-search.ts`)

Primary responsibilities:
- Build FTS5 query from natural language
- Execute BM25-ranked keyword search
- Merge vector + keyword results with configurable weights
- Score normalization

Key methods:
```typescript
interface HybridSearch {
  // FTS operations
  buildFtsQuery(raw: string): string | null;
  searchKeyword(params: KeywordSearchParams): KeywordResult[];
  bm25RankToScore(rank: number): number;

  // Hybrid merge
  mergeResults(params: MergeParams): HybridResult[];
}
```

### 3.4 EmbeddingCache (`embedding-cache.ts`)

Primary responsibilities:
- Hash-based embedding cache in SQLite
- Batch loading of cached embeddings
- Upsert new embeddings
- LRU eviction when cache exceeds max entries
- Cache seeding during reindex

Key methods:
```typescript
interface EmbeddingCache {
  // Cache operations
  load(hashes: string[]): Map<string, number[]>;
  upsert(entries: CacheEntry[]): void;
  pruneIfNeeded(maxEntries: number): void;

  // Reindex support
  seedFrom(sourceDb: DatabaseSync): void;

  // Statistics
  count(): number;
}
```

---

## 4. Data Flow

### 4.1 Memory Storage Flow

```
store(content, { tier: 'episodic' })
  |
  v
AgentMemoryManager.store()
  |
  +-- EpisodicStore.store() [in-memory tier operations]
  |
  +-- SQLiteBackend.storeMemory() [persistence]
  |     |
  |     +-- Compute embedding (via provider)
  |     +-- EmbeddingCache.upsert()
  |     +-- INSERT INTO memories
  |     +-- Chunk content -> INSERT INTO chunks
  |     +-- INSERT INTO chunks_fts
  |     +-- INSERT INTO chunks_vec (if available)
```

### 4.2 Search Flow

```
search(query, { tiers: ['episodic', 'semantic'] })
  |
  v
HybridSearch.mergeResults()
  |
  +-- VectorSearch.search()       [cosine similarity]
  |     |
  |     +-- Embed query via provider
  |     +-- EmbeddingCache.load() [check cache first]
  |     +-- vec_distance_cosine() [sqlite-vec]
  |     +-- OR cosineSimilarity() [fallback]
  |
  +-- HybridSearch.searchKeyword() [BM25 text match]
  |     |
  |     +-- buildFtsQuery()
  |     +-- SELECT ... FROM chunks_fts MATCH ?
  |
  +-- Weighted merge by chunk ID
  +-- Filter by minScore
  +-- Map back to Memory objects
```

### 4.3 Atomic Reindex Flow

```
sync({ force: true })
  |
  v
SQLiteBackend.beginReindex()
  |
  +-- Create temp DB at <path>.tmp-<uuid>
  +-- EmbeddingCache.seedFrom(originalDb)
  +-- ensureSchema() on temp DB
  |
  +-- syncMemoryFiles() [using temp DB]
  +-- syncSessionFiles() [using temp DB]
  |
  +-- writeMeta() [new model/provider/config]
  +-- pruneEmbeddingCache()
  |
  +-- commitReindex()
        |
        +-- Close temp DB
        +-- Close original DB
        +-- Rename original -> backup
        +-- Rename temp -> target
        +-- Remove backup
        +-- Reopen at target path
```

---

## 5. Session Transcript Delta Tracking

Following OpenClaw's approach, session transcripts (.jsonl files) are
incrementally indexed based on byte-offset deltas:

1. **Track last known size** per session file
2. **On transcript update event**, compute `deltaBytes = currentSize - lastSize`
3. **Accumulate pending bytes and messages** until thresholds are met
4. **When threshold hit**, mark file as dirty and trigger sync
5. **During sync**, re-read and re-chunk only dirty session files
6. **After sync**, reset delta counters

This avoids re-embedding entire transcripts on every message, which is
critical for long-running sessions.

---

## 6. Migration Strategy

### Phase 1: Add SQLite Backend (Non-Breaking)

- Introduce `backends/` directory with all four files
- SQLiteBackend is opt-in via `persistence: true` in config
- Existing in-memory behavior is unchanged
- On `initialize()`, if persistence is enabled:
  - Open/create SQLite database
  - Load persisted memories into in-memory tiers
  - Start background sync for memory files

### Phase 2: Wire Into AgentMemoryManager

- Add `SQLiteBackend` as optional dependency
- On `store()`, write-through to SQLite
- On `search()`, use hybrid search when available
- On `promote()`/`remove()`, update SQLite atomically
- On `shutdown()`, flush scratchpad snapshot to SQLite

### Phase 3: Session Transcript Indexing

- Parse `.jsonl` session files
- Delta tracking for incremental updates
- Index as `source: 'sessions'` chunks

---

## 7. Configuration

```typescript
interface PersistenceConfig {
  /** Enable SQLite persistence */
  enabled: boolean;

  /** Path to SQLite database file */
  dbPath: string;

  /** Embedding provider configuration */
  embedding: {
    provider: 'openai' | 'local';
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };

  /** Vector search configuration */
  vector: {
    enabled: boolean;
    extensionPath?: string;  // Path to sqlite-vec extension
  };

  /** FTS / hybrid search configuration */
  hybrid: {
    enabled: boolean;
    vectorWeight: number;    // Default: 0.7
    textWeight: number;      // Default: 0.3
    candidateMultiplier: number;  // Default: 3
  };

  /** Chunking configuration */
  chunking: {
    maxTokens: number;       // Default: 512
    overlap: number;         // Default: 50
  };

  /** Embedding cache configuration */
  cache: {
    enabled: boolean;
    maxEntries: number;      // Default: 10000
  };

  /** Session indexing configuration */
  sessions: {
    enabled: boolean;
    transcriptDir?: string;
    deltaBytes: number;      // Default: 4096
    deltaMessages: number;   // Default: 10
  };

  /** Sync configuration */
  sync: {
    onSearch: boolean;
    onSessionStart: boolean;
    watch: boolean;
    watchDebounceMs: number;
    intervalMinutes: number;
  };
}
```

---

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| sqlite-vec unavailable | Fall back to JSON cosine similarity |
| FTS5 unavailable | Disable keyword search, vector-only results |
| Embedding provider fails | Retry with exponential backoff (3 attempts) |
| Reindex fails mid-way | Rollback to original DB, log warning |
| Database corruption | Rebuild from scratch on next sync |
| Concurrent access | WAL mode + busy_timeout for read concurrency |

---

## 9. Performance Considerations

- **WAL mode** for concurrent reads during writes
- **Batch embedding** to minimize API round-trips
- **Embedding cache** to avoid re-computing for unchanged content
- **Hash-based change detection** on files to skip unchanged content
- **Debounced file watching** to avoid sync storms
- **Concurrent indexing** with configurable parallelism
- **LRU cache eviction** to bound cache size

---

## 10. Files Produced

| File | Purpose |
|------|---------|
| `backends/sqlite-backend.ts` | SQLite storage, schema, reindex, session deltas |
| `backends/vector-search.ts` | sqlite-vec loading, vector queries, fallback cosine |
| `backends/hybrid-search.ts` | FTS5 queries, BM25 scoring, weighted merge |
| `backends/embedding-cache.ts` | Hash-keyed cache, LRU eviction, batch loading |
