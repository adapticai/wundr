/**
 * HybridSearch - Combines vector similarity and FTS5 full-text search results.
 *
 * Implements the same weighted-merge strategy used by OpenClaw's memory system:
 * vector results are scored by cosine similarity, keyword results by BM25 rank,
 * and the two are merged using configurable weights with deduplication by chunk ID.
 *
 * @module backends/hybrid-search
 */

import type { DatabaseHandle } from './sqlite-backend';
import { FTS_TABLE } from './sqlite-backend';
import type { VectorSearch, VectorSearchResult } from './vector-search';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for hybrid search behavior.
 */
export interface HybridSearchConfig {
  /** Whether hybrid search (vector + FTS) is enabled. */
  enabled: boolean;
  /** Weight applied to vector similarity scores (0-1). */
  vectorWeight: number;
  /** Weight applied to FTS/BM25 text scores (0-1). */
  textWeight: number;
  /** Multiplier for candidate retrieval (e.g. 3x the final limit). */
  candidateMultiplier: number;
}

/**
 * Default hybrid search configuration.
 */
export const DEFAULT_HYBRID_CONFIG: HybridSearchConfig = {
  enabled: true,
  vectorWeight: 0.7,
  textWeight: 0.3,
  candidateMultiplier: 3,
};

/**
 * A keyword search result from FTS5.
 */
export interface KeywordSearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  textScore: number;
  snippet: string;
  source: string;
}

/**
 * Parameters for a keyword (FTS5) search.
 */
export interface KeywordSearchParams {
  /** The database handle to query. */
  db: DatabaseHandle;
  /** The embedding model filter. */
  model: string;
  /** The raw text query. */
  query: string;
  /** Maximum results to return. */
  limit: number;
  /** Maximum snippet character length. */
  snippetMaxChars: number;
  /** Optional source filter. */
  source?: string;
}

/**
 * Parameters for the full hybrid search pipeline.
 */
export interface HybridSearchParams {
  /** The database handle. */
  db: DatabaseHandle;
  /** The embedding model identifier. */
  model: string;
  /** The raw text query. */
  query: string;
  /** The query embedding vector. */
  queryVec: number[];
  /** Maximum final results. */
  maxResults: number;
  /** Minimum score threshold. */
  minScore: number;
  /** Maximum snippet character length. */
  snippetMaxChars: number;
  /** Optional source filter. */
  source?: string;
}

/**
 * A unified search result after hybrid merging.
 */
export interface HybridSearchResult {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: string;
}

// ---------------------------------------------------------------------------
// HybridSearch
// ---------------------------------------------------------------------------

export class HybridSearch {
  private config: HybridSearchConfig;
  private vectorSearch: VectorSearch;
  private ftsAvailable: boolean;

  constructor(params: {
    config?: Partial<HybridSearchConfig>;
    vectorSearch: VectorSearch;
    ftsAvailable: boolean;
  }) {
    this.config = { ...DEFAULT_HYBRID_CONFIG, ...params.config };
    this.vectorSearch = params.vectorSearch;
    this.ftsAvailable = params.ftsAvailable;
  }

  /**
   * Update FTS availability (e.g. after schema re-initialization).
   */
  setFtsAvailable(available: boolean): void {
    this.ftsAvailable = available;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<HybridSearchConfig> {
    return { ...this.config };
  }

  // =========================================================================
  // Full Pipeline
  // =========================================================================

  /**
   * Execute the full hybrid search pipeline.
   *
   * 1. Compute candidate count from maxResults * candidateMultiplier.
   * 2. Run vector search for candidates (if queryVec is non-zero).
   * 3. Run keyword/FTS search for candidates (if FTS is available).
   * 4. Merge results using weighted scoring.
   * 5. Filter by minScore and return up to maxResults.
   */
  search(params: HybridSearchParams): HybridSearchResult[] {
    const candidates = Math.min(
      200,
      Math.max(1, Math.floor(params.maxResults * this.config.candidateMultiplier))
    );

    // Vector search
    const hasVector = params.queryVec.length > 0 && params.queryVec.some((v) => v !== 0);
    const vectorResults: VectorSearchResult[] = hasVector
      ? this.vectorSearch.search({
          db: params.db,
          model: params.model,
          queryVec: params.queryVec,
          limit: candidates,
          snippetMaxChars: params.snippetMaxChars,
          source: params.source,
        })
      : [];

    // If hybrid is disabled, return vector-only results
    if (!this.config.enabled || !this.ftsAvailable) {
      return vectorResults
        .filter((entry) => entry.score >= params.minScore)
        .slice(0, params.maxResults);
    }

    // Keyword search
    const keywordResults = this.searchKeyword({
      db: params.db,
      model: params.model,
      query: params.query,
      limit: candidates,
      snippetMaxChars: params.snippetMaxChars,
      source: params.source,
    });

    // Merge
    const merged = mergeHybridResults({
      vector: vectorResults,
      keyword: keywordResults,
      vectorWeight: this.config.vectorWeight,
      textWeight: this.config.textWeight,
    });

    return merged
      .filter((entry) => entry.score >= params.minScore)
      .slice(0, params.maxResults);
  }

  // =========================================================================
  // Keyword (FTS5) Search
  // =========================================================================

  /**
   * Execute a keyword search using FTS5 with BM25 ranking.
   *
   * Tokenizes the input query and constructs an AND-joined FTS5 MATCH
   * expression. Results are ranked by BM25 and normalized to a 0-1 score.
   */
  searchKeyword(params: KeywordSearchParams): KeywordSearchResult[] {
    if (!this.ftsAvailable || params.limit <= 0) {
      return [];
    }

    const ftsQuery = buildFtsQuery(params.query);
    if (!ftsQuery) {
      return [];
    }

    const sourceFilter = params.source
      ? { sql: ' AND source = ?', params: [params.source] }
      : { sql: '', params: [] as string[] };

    try {
      const rows = params.db
        .prepare(
          `SELECT id, path, source, start_line, end_line, text,\n` +
            `       bm25(${FTS_TABLE}) AS rank\n` +
            `  FROM ${FTS_TABLE}\n` +
            ` WHERE ${FTS_TABLE} MATCH ? AND model = ?${sourceFilter.sql}\n` +
            ` ORDER BY rank ASC\n` +
            ` LIMIT ?`
        )
        .all(ftsQuery, params.model, ...sourceFilter.params, params.limit) as Array<{
        id: string;
        path: string;
        source: string;
        start_line: number;
        end_line: number;
        text: string;
        rank: number;
      }>;

      return rows.map((row) => {
        const textScore = bm25RankToScore(row.rank);
        return {
          id: row.id,
          path: row.path,
          startLine: row.start_line,
          endLine: row.end_line,
          score: textScore,
          textScore,
          snippet: truncateSnippet(row.text, params.snippetMaxChars),
          source: row.source,
        };
      });
    } catch {
      // FTS query may fail on malformed input
      return [];
    }
  }
}

// ---------------------------------------------------------------------------
// FTS Query Building
// ---------------------------------------------------------------------------

/**
 * Build an FTS5 MATCH query from a raw text input.
 *
 * Tokenizes the input into alphanumeric words, quotes each one, and joins
 * them with AND. Returns null if no valid tokens are found.
 *
 * @example
 * buildFtsQuery("hello world") // => '"hello" AND "world"'
 * buildFtsQuery("") // => null
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[A-Za-z0-9_]+/g)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) {
    return null;
  }
  const quoted = tokens.map((t) => `"${t.replaceAll('"', '')}"`);
  return quoted.join(' AND ');
}

// ---------------------------------------------------------------------------
// BM25 Score Normalization
// ---------------------------------------------------------------------------

/**
 * Convert a BM25 rank value to a normalized 0-1 score.
 *
 * FTS5's `bm25()` returns a rank where lower is better (the negative of the
 * relevance score). We normalize using `1 / (1 + rank)` after clamping
 * negative ranks to 0.
 */
export function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999;
  return 1 / (1 + normalized);
}

// ---------------------------------------------------------------------------
// Hybrid Merge
// ---------------------------------------------------------------------------

/**
 * Merge vector and keyword search results using weighted scoring.
 *
 * Results are deduplicated by chunk ID. Each result receives a final score
 * of `vectorWeight * vectorScore + textWeight * textScore`. If a chunk
 * appears in only one result set, the missing score defaults to 0.
 *
 * The merged results are sorted by descending final score.
 */
export function mergeHybridResults(params: {
  vector: VectorSearchResult[];
  keyword: KeywordSearchResult[];
  vectorWeight: number;
  textWeight: number;
}): HybridSearchResult[] {
  const byId = new Map<
    string,
    {
      id: string;
      path: string;
      startLine: number;
      endLine: number;
      source: string;
      snippet: string;
      vectorScore: number;
      textScore: number;
    }
  >();

  // Seed with vector results
  for (const r of params.vector) {
    byId.set(r.id, {
      id: r.id,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine,
      source: r.source,
      snippet: r.snippet,
      vectorScore: r.score,
      textScore: 0,
    });
  }

  // Merge in keyword results
  for (const r of params.keyword) {
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = r.textScore;
      // Prefer keyword snippet if available (more context-relevant)
      if (r.snippet && r.snippet.length > 0) {
        existing.snippet = r.snippet;
      }
    } else {
      byId.set(r.id, {
        id: r.id,
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        source: r.source,
        snippet: r.snippet,
        vectorScore: 0,
        textScore: r.textScore,
      });
    }
  }

  // Compute weighted scores and sort
  const merged = Array.from(byId.values()).map((entry) => {
    const score =
      params.vectorWeight * entry.vectorScore +
      params.textWeight * entry.textScore;
    return {
      id: entry.id,
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
      score,
      snippet: entry.snippet,
      source: entry.source,
    };
  });

  merged.sort((a, b) => b.score - a.score);
  return merged;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  let end = maxChars;
  if (end > 0 && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) {
    end -= 1;
  }
  return text.slice(0, end);
}
