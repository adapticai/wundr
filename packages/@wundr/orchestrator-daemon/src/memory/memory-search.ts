/**
 * MemorySearch - Relevance-ranked search across memory files
 *
 * Provides keyword-based search with TF-IDF-style ranking across all
 * memory scopes and overflow files. Inspired by OpenClaw's hybrid
 * search approach (vector + keyword) but using a lightweight keyword-only
 * strategy suitable for local markdown files without an embedding provider.
 *
 * @packageDocumentation
 */

import {
  MemoryFileManager,
  type ParsedMemoryFile,
  type MemoryEntry,
  type MemorySection,
} from './memory-file-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A scored search result.
 */
export interface MemorySearchResult {
  /** The matched entry text */
  text: string;
  /** Section title containing the entry */
  section: string;
  /** Scope the result came from (user, project, local) */
  scope: string;
  /** File path the result was found in */
  filePath: string;
  /** Relevance score (0-1, higher is better) */
  score: number;
  /** Line number in the source file */
  line: number;
  /** Entry metadata */
  metadata?: MemoryEntry['metadata'];
  /** Snippet with highlighted matches (if available) */
  snippet?: string;
}

/**
 * Search options.
 */
export interface MemorySearchOptions {
  /** Maximum number of results to return */
  maxResults?: number;
  /** Minimum score threshold (0-1) */
  minScore?: number;
  /** Restrict search to specific scopes */
  scopes?: string[];
  /** Restrict search to specific sections */
  sections?: string[];
  /** Include stale entries in results */
  includeStale?: boolean;
  /** Boost factor for recent entries (0 = no boost, 1 = strong boost) */
  recencyBoost?: number;
}

/**
 * Context for relevance scoring -- describes what the user is working on.
 */
export interface RelevanceContext {
  /** Current file being edited */
  currentFile?: string;
  /** Current task description */
  taskDescription?: string;
  /** Recent error messages */
  recentErrors?: string[];
  /** Recent tool names used */
  recentTools?: string[];
  /** Tags or labels for the current context */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_MIN_SCORE = 0.1;

// Logger available for future use: new Logger('MemorySearch')

// ---------------------------------------------------------------------------
// MemorySearch
// ---------------------------------------------------------------------------

export class MemorySearch {
  private fileManager: MemoryFileManager;

  constructor(fileManager?: MemoryFileManager) {
    this.fileManager = fileManager ?? new MemoryFileManager();
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Search across multiple parsed memory files with relevance ranking.
   *
   * Each result is scored using a combination of:
   * - Term frequency (how many query terms appear in the entry)
   * - Section priority boost (Corrections rank higher)
   * - Recency boost (newer entries score higher when enabled)
   * - Context relevance (if RelevanceContext is provided)
   */
  search(
    query: string,
    files: Array<{ file: ParsedMemoryFile; scope: string }>,
    options?: MemorySearchOptions,
    context?: RelevanceContext
  ): MemorySearchResult[] {
    const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;
    const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
    const includeStale = options?.includeStale ?? false;
    const recencyBoost = options?.recencyBoost ?? 0.2;

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return [];
    }

    // Build IDF from all entries
    const allEntries = this.collectAllEntries(files, options);
    const idf = this.computeIDF(allEntries, queryTerms);

    const results: MemorySearchResult[] = [];

    for (const { file, scope } of files) {
      // Scope filter
      if (options?.scopes && !options.scopes.includes(scope)) {
        continue;
      }

      for (const section of file.sections) {
        // Section filter
        if (
          options?.sections &&
          !options.sections.some(
            s => s.toLowerCase() === section.title.toLowerCase()
          )
        ) {
          continue;
        }

        for (const entry of section.entries) {
          // Skip stale entries unless requested
          if (entry.metadata?.stale && !includeStale) {
            continue;
          }

          const entryTerms = this.tokenize(entry.text);
          if (entryTerms.length === 0) {
            continue;
          }

          // Compute TF-IDF score
          let score = this.tfIdfScore(queryTerms, entryTerms, idf);

          // Section priority boost
          score *= this.sectionBoost(section.title);

          // Recency boost
          if (recencyBoost > 0 && entry.metadata?.dateAdded) {
            score *=
              1 + recencyBoost * this.recencyFactor(entry.metadata.dateAdded);
          }

          // Context relevance boost
          if (context) {
            score *= 1 + this.contextRelevanceFactor(entry, section, context);
          }

          // Confidence boost -- higher confidence entries rank higher
          if (entry.metadata?.confidence) {
            score *= 0.8 + 0.2 * entry.metadata.confidence;
          }

          if (score < minScore) {
            continue;
          }

          results.push({
            text: entry.text,
            section: section.title,
            scope,
            filePath: file.path,
            score: Math.round(score * 1000) / 1000,
            line: entry.line,
            metadata: entry.metadata,
            snippet: this.buildSnippet(entry, queryTerms),
          });
        }
      }
    }

    // Sort by score descending, then by recency
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Tie-break by recency
      const dateA = a.metadata?.dateAdded ?? '0000';
      const dateB = b.metadata?.dateAdded ?? '0000';
      return dateB.localeCompare(dateA);
    });

    return results.slice(0, maxResults);
  }

  /**
   * Score the relevance of an entry to the current context.
   *
   * Returns a value between 0 and 1 indicating how relevant this memory
   * is to what the user is currently doing.
   */
  scoreRelevance(
    entry: MemoryEntry,
    section: MemorySection,
    context: RelevanceContext
  ): number {
    let score = 0;
    const entryTerms = this.tokenize(entry.text);

    // Match against current file
    if (context.currentFile) {
      const fileTerms = this.tokenize(context.currentFile);
      const overlap = this.termOverlap(entryTerms, fileTerms);
      score += overlap * 0.3;
    }

    // Match against task description
    if (context.taskDescription) {
      const taskTerms = this.tokenize(context.taskDescription);
      const overlap = this.termOverlap(entryTerms, taskTerms);
      score += overlap * 0.4;
    }

    // Match against recent errors
    if (context.recentErrors) {
      for (const error of context.recentErrors) {
        const errorTerms = this.tokenize(error);
        const overlap = this.termOverlap(entryTerms, errorTerms);
        score += overlap * 0.2;
      }
    }

    // Match against recent tools
    if (context.recentTools) {
      const toolTerms = context.recentTools.flatMap(t => this.tokenize(t));
      const overlap = this.termOverlap(entryTerms, toolTerms);
      score += overlap * 0.1;
    }

    // Section-based relevance
    if (section.title === 'Error Patterns' && context.recentErrors?.length) {
      score += 0.15;
    }
    if (section.title === 'Tool Usage' && context.recentTools?.length) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  // -------------------------------------------------------------------------
  // Private: Scoring
  // -------------------------------------------------------------------------

  /**
   * Compute a TF-IDF-style score for a query against an entry.
   */
  private tfIdfScore(
    queryTerms: string[],
    entryTerms: string[],
    idf: Map<string, number>
  ): number {
    const entryFreq = this.termFrequency(entryTerms);
    let score = 0;

    for (const term of queryTerms) {
      const tf = entryFreq.get(term) ?? 0;
      if (tf === 0) {
        continue;
      }
      const termIdf = idf.get(term) ?? 1;
      // Normalized TF: log(1 + tf)
      score += Math.log(1 + tf) * termIdf;
    }

    // Normalize by query length
    return queryTerms.length > 0 ? score / queryTerms.length : 0;
  }

  /**
   * Compute IDF (Inverse Document Frequency) for query terms.
   */
  private computeIDF(
    allEntries: Array<{ terms: string[] }>,
    queryTerms: string[]
  ): Map<string, number> {
    const N = Math.max(1, allEntries.length);
    const idf = new Map<string, number>();

    for (const term of queryTerms) {
      let df = 0;
      for (const { terms } of allEntries) {
        if (terms.includes(term)) {
          df++;
        }
      }
      // IDF = log(N / (1 + df)) -- smoothed
      idf.set(term, Math.log(N / (1 + df)) + 1);
    }

    return idf;
  }

  /**
   * Collect all entries from all files for IDF computation.
   */
  private collectAllEntries(
    files: Array<{ file: ParsedMemoryFile; scope: string }>,
    options?: MemorySearchOptions
  ): Array<{ terms: string[] }> {
    const result: Array<{ terms: string[] }> = [];

    for (const { file, scope } of files) {
      if (options?.scopes && !options.scopes.includes(scope)) {
        continue;
      }
      for (const section of file.sections) {
        if (
          options?.sections &&
          !options.sections.some(
            s => s.toLowerCase() === section.title.toLowerCase()
          )
        ) {
          continue;
        }
        for (const entry of section.entries) {
          result.push({ terms: this.tokenize(entry.text) });
        }
      }
    }

    return result;
  }

  /**
   * Boost factor based on section priority.
   */
  private sectionBoost(sectionTitle: string): number {
    const boosts: Record<string, number> = {
      Corrections: 1.3,
      'User Preferences': 1.2,
      'Project Conventions': 1.15,
      'Error Patterns': 1.1,
      'Tool Usage': 1.05,
      Workflow: 1.0,
      'Architecture Decisions': 1.0,
      'People & Roles': 0.9,
      Links: 0.5,
    };
    return boosts[sectionTitle] ?? 1.0;
  }

  /**
   * Compute a recency factor (0-1) from an ISO date string.
   * More recent dates score higher.
   */
  private recencyFactor(dateStr: string): number {
    const now = Date.now();
    const entryDate = new Date(dateStr).getTime();
    if (isNaN(entryDate)) {
      return 0;
    }
    const ageDays = (now - entryDate) / (1000 * 60 * 60 * 24);
    // Exponential decay: half-life of 30 days
    return Math.exp(-ageDays / 30);
  }

  /**
   * Compute a context relevance factor (0-1).
   */
  private contextRelevanceFactor(
    entry: MemoryEntry,
    section: MemorySection,
    context: RelevanceContext
  ): number {
    return this.scoreRelevance(entry, section, context);
  }

  /**
   * Build a search snippet with basic highlighting.
   */
  private buildSnippet(entry: MemoryEntry, queryTerms: string[]): string {
    let snippet = entry.text;
    if (snippet.length > 150) {
      snippet = snippet.slice(0, 147) + '...';
    }

    // Mark matching terms with ** for emphasis
    for (const term of queryTerms) {
      const re = new RegExp(`\\b(${this.escapeRegex(term)})\\b`, 'gi');
      snippet = snippet.replace(re, '**$1**');
    }

    return snippet;
  }

  // -------------------------------------------------------------------------
  // Private: Tokenization
  // -------------------------------------------------------------------------

  /**
   * Tokenize text for search (lowercase, remove punctuation, remove stop words).
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'it',
      'its',
      'this',
      'that',
      'and',
      'or',
      'but',
      'not',
      'if',
      'then',
      'else',
      'when',
      'up',
      'out',
      'so',
      'no',
      'as',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
  }

  /**
   * Compute term frequency map.
   */
  private termFrequency(tokens: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
    return freq;
  }

  /**
   * Compute term overlap ratio between two token lists.
   */
  private termOverlap(tokensA: string[], tokensB: string[]): number {
    if (tokensA.length === 0 || tokensB.length === 0) {
      return 0;
    }
    const setB = new Set(tokensB);
    let overlap = 0;
    for (const term of tokensA) {
      if (setB.has(term)) {
        overlap++;
      }
    }
    return overlap / Math.max(tokensA.length, tokensB.length);
  }

  /**
   * Escape special regex characters.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
