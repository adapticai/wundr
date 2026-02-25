/**
 * VectorSearch - sqlite-vec based vector similarity search with fallback.
 *
 * Handles loading the sqlite-vec extension, creating/managing the vec0 virtual
 * table, and running nearest-neighbor queries using `vec_distance_cosine`.
 * When sqlite-vec is unavailable, falls back to brute-force cosine similarity
 * computed over JSON-stored embeddings (following OpenClaw's dual-path approach).
 *
 * @module backends/vector-search
 */

import type { DatabaseHandle } from './sqlite-backend';
import { VECTOR_TABLE } from './sqlite-backend';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of attempting to load the sqlite-vec extension.
 */
export interface VecLoadResult {
  ok: boolean;
  extensionPath?: string;
  error?: string;
}

/**
 * Parameters for a vector similarity search.
 */
export interface VectorSearchParams {
  /** The database handle to query. */
  db: DatabaseHandle;
  /** The embedding model used for stored chunks. */
  model: string;
  /** The query embedding vector. */
  queryVec: number[];
  /** Maximum number of results to return. */
  limit: number;
  /** Maximum characters for snippet truncation. */
  snippetMaxChars: number;
  /** Optional source filter (e.g. 'memory', 'sessions'). */
  source?: string;
}

/**
 * A single vector search result.
 */
export interface VectorSearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: string;
}

/**
 * State for the vector search subsystem.
 */
export interface VectorSearchState {
  enabled: boolean;
  available: boolean | null;
  extensionPath?: string;
  loadError?: string;
  dims?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VECTOR_LOAD_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// VectorSearch
// ---------------------------------------------------------------------------

export class VectorSearch {
  private state: VectorSearchState;
  private loadPromise: Promise<boolean> | null = null;

  constructor(options?: { enabled?: boolean; extensionPath?: string }) {
    this.state = {
      enabled: options?.enabled ?? true,
      available: null,
      extensionPath: options?.extensionPath,
    };
  }

  /**
   * Get the current vector search state for status reporting.
   */
  getState(): Readonly<VectorSearchState> {
    return { ...this.state };
  }

  // =========================================================================
  // Extension Loading
  // =========================================================================

  /**
   * Attempt to load the sqlite-vec extension into the given database.
   *
   * Returns a result indicating success or failure. On failure, the error
   * message is stored in state for diagnostic reporting.
   */
  async loadExtension(db: DatabaseHandle): Promise<VecLoadResult> {
    if (!this.state.enabled) {
      this.state.available = false;
      return { ok: false, error: 'Vector search is disabled' };
    }

    try {
      const sqliteVec = await import('sqlite-vec');
      const resolvedPath = this.state.extensionPath?.trim()
        ? this.state.extensionPath.trim()
        : undefined;
      const extensionPath = resolvedPath ?? sqliteVec.getLoadablePath();

      if (db.enableLoadExtension) {
        db.enableLoadExtension(true);
      }

      if (resolvedPath && db.loadExtension) {
        db.loadExtension(extensionPath);
      } else {
        sqliteVec.load(db);
      }

      this.state.available = true;
      this.state.extensionPath = extensionPath;
      return { ok: true, extensionPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state.available = false;
      this.state.loadError = message;
      return { ok: false, error: message };
    }
  }

  /**
   * Ensure the extension is loaded, using a cached promise to avoid
   * redundant load attempts. Includes a timeout to prevent hanging.
   */
  async ensureReady(db: DatabaseHandle, dimensions?: number): Promise<boolean> {
    if (!this.state.enabled) {
      return false;
    }

    if (!this.loadPromise) {
      this.loadPromise = withTimeout(
        this.doLoad(db),
        VECTOR_LOAD_TIMEOUT_MS,
        `sqlite-vec load timed out after ${Math.round(VECTOR_LOAD_TIMEOUT_MS / 1000)}s`
      );
    }

    let ready = false;
    try {
      ready = await this.loadPromise;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state.available = false;
      this.state.loadError = message;
      this.loadPromise = null;
      return false;
    }

    if (ready && typeof dimensions === 'number' && dimensions > 0) {
      this.ensureVectorTable(db, dimensions);
    }

    return ready;
  }

  // =========================================================================
  // Vector Table Management
  // =========================================================================

  /**
   * Create the vec0 virtual table if it does not exist or if the dimensions
   * have changed. Drops and recreates if dimensions differ.
   */
  ensureVectorTable(db: DatabaseHandle, dimensions: number): void {
    if (this.state.dims === dimensions) {
      return;
    }

    if (this.state.dims && this.state.dims !== dimensions) {
      this.dropVectorTable(db);
    }

    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE} USING vec0(\n` +
        `  id TEXT PRIMARY KEY,\n` +
        `  embedding FLOAT[${dimensions}]\n` +
        `)`
    );
    this.state.dims = dimensions;
  }

  /**
   * Drop the vector table (used before recreating with new dimensions).
   */
  dropVectorTable(db: DatabaseHandle): void {
    try {
      db.exec(`DROP TABLE IF EXISTS ${VECTOR_TABLE}`);
    } catch {
      // Non-fatal: table may not exist
    }
    this.state.dims = undefined;
  }

  /**
   * Insert a single embedding into the vector table.
   */
  insertVector(db: DatabaseHandle, id: string, embedding: number[]): void {
    try {
      db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE id = ?`).run(id);
    } catch {
      // Row may not exist
    }
    db.prepare(`INSERT INTO ${VECTOR_TABLE} (id, embedding) VALUES (?, ?)`).run(
      id,
      vectorToBlob(embedding)
    );
  }

  /**
   * Delete a vector entry by chunk ID.
   */
  deleteVector(db: DatabaseHandle, id: string): void {
    try {
      db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE id = ?`).run(id);
    } catch {
      // Non-fatal
    }
  }

  /**
   * Delete all vector entries for chunks matching a path and source.
   */
  deleteVectorsForPath(
    db: DatabaseHandle,
    filePath: string,
    source: string
  ): void {
    try {
      db.prepare(
        `DELETE FROM ${VECTOR_TABLE} WHERE id IN (SELECT id FROM chunks WHERE path = ? AND source = ?)`
      ).run(filePath, source);
    } catch {
      // Non-fatal: vector table may not exist
    }
  }

  // =========================================================================
  // Search
  // =========================================================================

  /**
   * Run a vector similarity search using sqlite-vec.
   *
   * Uses `vec_distance_cosine` for efficient nearest-neighbor search when
   * the extension is available. Score is computed as `1 - distance`.
   */
  search(params: VectorSearchParams): VectorSearchResult[] {
    if (params.queryVec.length === 0 || params.limit <= 0) {
      return [];
    }

    if (this.state.available !== true) {
      return this.searchFallback(params);
    }

    const sourceFilter = params.source
      ? { sql: ' AND c.source = ?', params: [params.source] }
      : { sql: '', params: [] as string[] };

    try {
      const rows = params.db
        .prepare(
          `SELECT c.id, c.path, c.start_line, c.end_line, c.text,\n` +
            `       c.source,\n` +
            `       vec_distance_cosine(v.embedding, ?) AS dist\n` +
            `  FROM ${VECTOR_TABLE} v\n` +
            `  JOIN chunks c ON c.id = v.id\n` +
            ` WHERE c.model = ?${sourceFilter.sql}\n` +
            ` ORDER BY dist ASC\n` +
            ` LIMIT ?`
        )
        .all(
          vectorToBlob(params.queryVec),
          params.model,
          ...sourceFilter.params,
          params.limit
        ) as Array<{
        id: string;
        path: string;
        start_line: number;
        end_line: number;
        text: string;
        source: string;
        dist: number;
      }>;

      return rows.map(row => ({
        id: row.id,
        path: row.path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: 1 - row.dist,
        snippet: truncateSnippet(row.text, params.snippetMaxChars),
        source: row.source,
      }));
    } catch {
      // If vec query fails, fall back to brute force
      return this.searchFallback(params);
    }
  }

  /**
   * Fallback search when sqlite-vec is unavailable.
   *
   * Loads all chunk embeddings from the JSON `embedding` column and computes
   * cosine similarity in JavaScript. Less efficient but always works.
   */
  searchFallback(params: VectorSearchParams): VectorSearchResult[] {
    if (params.queryVec.length === 0 || params.limit <= 0) {
      return [];
    }

    const sourceFilter = params.source
      ? { sql: ' AND source = ?', params: [params.source] }
      : { sql: '', params: [] as string[] };

    const rows = params.db
      .prepare(
        `SELECT id, path, start_line, end_line, text, embedding, source
         FROM chunks
         WHERE model = ?${sourceFilter.sql}`
      )
      .all(params.model, ...sourceFilter.params) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      text: string;
      embedding: string;
      source: string;
    }>;

    const scored = rows
      .map(row => {
        const embedding = parseEmbedding(row.embedding);
        const score = cosineSimilarity(params.queryVec, embedding);
        return { row, score };
      })
      .filter(entry => Number.isFinite(entry.score));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, params.limit).map(entry => ({
      id: entry.row.id,
      path: entry.row.path,
      startLine: entry.row.start_line,
      endLine: entry.row.end_line,
      score: entry.score,
      snippet: truncateSnippet(entry.row.text, params.snippetMaxChars),
      source: entry.row.source,
    }));
  }

  // =========================================================================
  // Internal
  // =========================================================================

  private async doLoad(db: DatabaseHandle): Promise<boolean> {
    if (this.state.available !== null) {
      return this.state.available;
    }
    const result = await this.loadExtension(db);
    return result.ok;
  }
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Convert a float array to a Buffer for sqlite-vec blob storage.
 */
export function vectorToBlob(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

/**
 * Parse a JSON-encoded embedding string into a number array.
 */
export function parseEmbedding(raw: string): number[] {
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

/**
 * Compute cosine similarity between two vectors.
 *
 * Returns 0 if either vector is zero-length or if the denominator is zero.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

/**
 * Truncate a text snippet to a maximum character length, respecting UTF-16
 * surrogate pairs to avoid splitting multi-byte characters.
 */
function truncateSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  // Avoid splitting a surrogate pair
  let end = maxChars;
  if (
    end > 0 &&
    text.charCodeAt(end - 1) >= 0xd800 &&
    text.charCodeAt(end - 1) <= 0xdbff
  ) {
    end -= 1;
  }
  return text.slice(0, end);
}

/**
 * Promise timeout helper -- rejects if the promise does not resolve within
 * the given duration.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
