/**
 * Query Reformulation Module
 *
 * Provides intelligent query reformulation based on context gaps
 * and retrieval feedback for improved RAG performance.
 */

import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';

import type { SearchResult } from './types';

/**
 * Configuration for query reformulation
 */
export interface QueryReformulationConfig {
  /** Maximum number of reformulation attempts */
  maxReformulations: number;
  /** Minimum confidence threshold for accepting results */
  confidenceThreshold: number;
  /** Whether to use semantic expansion */
  useSemanticExpansion: boolean;
  /** Whether to use term extraction */
  useTermExtraction: boolean;
  /** Custom reformulation strategies */
  strategies: ReformulationStrategy[];
}

/**
 * Default query reformulation configuration
 */
export const DEFAULT_REFORMULATION_CONFIG: QueryReformulationConfig = {
  maxReformulations: 3,
  confidenceThreshold: 0.75,
  useSemanticExpansion: true,
  useTermExtraction: true,
  strategies: ['expand', 'narrow', 'rephrase', 'decompose'],
};

/**
 * Reformulation strategy types
 */
export type ReformulationStrategy =
  | 'expand'
  | 'narrow'
  | 'rephrase'
  | 'decompose'
  | 'synonym';

/**
 * Context gap information identified during retrieval
 */
export interface ContextGap {
  /** Type of gap identified */
  type: 'missing_concept' | 'low_coverage' | 'ambiguity' | 'specificity';
  /** Description of the gap */
  description: string;
  /** Suggested terms to address the gap */
  suggestedTerms: string[];
  /** Confidence in gap identification */
  confidence: number;
}

/**
 * Query reformulation result
 */
export interface ReformulationResult {
  /** Original query */
  originalQuery: string;
  /** Reformulated query */
  reformulatedQuery: string;
  /** Strategy used for reformulation */
  strategy: ReformulationStrategy;
  /** Identified context gaps */
  gaps: ContextGap[];
  /** Reformulation iteration number */
  iteration: number;
  /** Confidence in the reformulation */
  confidence: number;
}

/**
 * Zod schema for query reformulation config validation
 */
export const QueryReformulationConfigSchema = z.object({
  maxReformulations: z.number().int().positive().default(3),
  confidenceThreshold: z.number().min(0).max(1).default(0.75),
  useSemanticExpansion: z.boolean().default(true),
  useTermExtraction: z.boolean().default(true),
  strategies: z
    .array(z.enum(['expand', 'narrow', 'rephrase', 'decompose', 'synonym']))
    .default(['expand', 'narrow', 'rephrase', 'decompose']),
});

/**
 * Events emitted by the query reformulator
 */
export interface QueryReformulatorEvents {
  'reformulation:start': (query: string) => void;
  'reformulation:gap-detected': (gap: ContextGap) => void;
  'reformulation:complete': (result: ReformulationResult) => void;
  'reformulation:error': (error: Error) => void;
}

/**
 * Query reformulation service for improving retrieval quality
 *
 * @example
 * ```typescript
 * const reformulator = new QueryReformulator();
 * const result = await reformulator.reformulate(
 *   "auth flow",
 *   previousResults,
 *   { strategy: 'expand' }
 * );
 * console.log(result.reformulatedQuery);
 * // "user authentication flow login session management"
 * ```
 */
export class QueryReformulator extends EventEmitter<QueryReformulatorEvents> {
  private config: QueryReformulationConfig;

  constructor(config: Partial<QueryReformulationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_REFORMULATION_CONFIG, ...config };
  }

  /**
   * Reformulate a query based on context gaps and previous results
   *
   * @param query - The original query to reformulate
   * @param previousResults - Results from previous retrieval attempt
   * @param options - Reformulation options
   * @returns Reformulation result with new query and gap analysis
   */
  async reformulate(
    query: string,
    previousResults: SearchResult[],
    options: {
      strategy?: ReformulationStrategy;
      iteration?: number;
      targetConcepts?: string[];
    } = {}
  ): Promise<ReformulationResult> {
    this.emit('reformulation:start', query);

    try {
      // Identify context gaps
      const gaps = this.identifyContextGaps(query, previousResults);

      // Emit gap events
      for (const gap of gaps) {
        this.emit('reformulation:gap-detected', gap);
      }

      // Select strategy
      const strategy = options.strategy ?? this.selectStrategy(gaps);

      // Apply reformulation
      const reformulatedQuery = this.applyReformulation(
        query,
        gaps,
        strategy,
        options.targetConcepts
      );

      // Calculate confidence
      const confidence = this.calculateConfidence(gaps, previousResults);

      const result: ReformulationResult = {
        originalQuery: query,
        reformulatedQuery,
        strategy,
        gaps,
        iteration: options.iteration ?? 1,
        confidence,
      };

      this.emit('reformulation:complete', result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('reformulation:error', err);
      throw err;
    }
  }

  /**
   * Identify gaps in the current retrieval context
   *
   * @param query - The search query
   * @param results - Current search results
   * @returns Array of identified context gaps
   */
  identifyContextGaps(query: string, results: SearchResult[]): ContextGap[] {
    const gaps: ContextGap[] = [];
    const queryTerms = this.extractTerms(query);

    // Check for low coverage
    if (results.length === 0) {
      gaps.push({
        type: 'missing_concept',
        description: 'No results found for query',
        suggestedTerms: this.generateSynonyms(queryTerms),
        confidence: 1.0,
      });
    } else if (results.length < 3) {
      gaps.push({
        type: 'low_coverage',
        description: 'Insufficient results for comprehensive context',
        suggestedTerms: this.expandTerms(queryTerms),
        confidence: 0.8,
      });
    }

    // Check result quality
    const avgScore =
      results.reduce((sum, r) => sum + r.score, 0) /
      Math.max(results.length, 1);
    if (avgScore < this.config.confidenceThreshold && results.length > 0) {
      gaps.push({
        type: 'ambiguity',
        description: 'Results have low relevance scores',
        suggestedTerms: this.generateSpecificTerms(query, results),
        confidence: 0.7,
      });
    }

    // Check for missing query terms in results
    const missingTerms = this.findMissingTerms(queryTerms, results);
    if (missingTerms.length > 0) {
      gaps.push({
        type: 'missing_concept',
        description: `Query terms not found in results: ${missingTerms.join(', ')}`,
        suggestedTerms: this.generateSynonyms(missingTerms),
        confidence: 0.85,
      });
    }

    // Check for specificity issues
    if (queryTerms.length <= 2 && results.length > 10) {
      gaps.push({
        type: 'specificity',
        description: 'Query may be too broad',
        suggestedTerms: this.extractKeyTermsFromResults(results),
        confidence: 0.6,
      });
    }

    return gaps;
  }

  /**
   * Decompose a complex query into sub-queries
   *
   * @param query - The complex query to decompose
   * @returns Array of simpler sub-queries
   */
  decomposeQuery(query: string): string[] {
    const subQueries: string[] = [];
    const terms = this.extractTerms(query);

    // Split by logical connectors
    const connectors = ['and', 'or', 'with', 'using', 'for', 'in'];
    const currentQuery = query.toLowerCase();

    for (const connector of connectors) {
      if (currentQuery.includes(` ${connector} `)) {
        const parts = currentQuery.split(` ${connector} `);
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length > 2) {
            subQueries.push(trimmed);
          }
        }
        break;
      }
    }

    // If no connectors found, group related terms
    if (subQueries.length === 0 && terms.length > 3) {
      // Create overlapping groups of terms
      for (let i = 0; i < terms.length - 1; i += 2) {
        const group = terms.slice(i, Math.min(i + 3, terms.length));
        subQueries.push(group.join(' '));
      }
    }

    // Always include original query
    if (subQueries.length === 0) {
      subQueries.push(query);
    }

    return subQueries;
  }

  /**
   * Extract related terms from retrieved content
   *
   * @param results - Search results to analyze
   * @returns Array of extracted terms
   */
  extractRelatedTerms(results: SearchResult[]): string[] {
    const termFrequency = new Map<string, number>();

    for (const result of results) {
      const terms = this.extractTerms(result.chunk.content);
      for (const term of terms) {
        termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
      }
    }

    // Sort by frequency and return top terms
    return Array.from(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);
  }

  /**
   * Generate query variations for multi-query retrieval
   *
   * @param query - Original query
   * @param count - Number of variations to generate
   * @returns Array of query variations
   */
  generateQueryVariations(query: string, count: number = 3): string[] {
    const variations: string[] = [query];
    const terms = this.extractTerms(query);

    // Variation 1: Expanded query
    if (count >= 1) {
      const expanded = this.expandTerms(terms);
      variations.push([...terms, ...expanded.slice(0, 2)].join(' '));
    }

    // Variation 2: Synonym replacement
    if (count >= 2) {
      const synonyms = this.generateSynonyms(terms);
      if (synonyms.length > 0) {
        variations.push(synonyms.join(' '));
      }
    }

    // Variation 3: Rephrased
    if (count >= 3) {
      const rephrased = this.rephraseQuery(query);
      if (rephrased !== query) {
        variations.push(rephrased);
      }
    }

    return [...new Set(variations)].slice(0, count + 1);
  }

  /**
   * Get the current configuration
   */
  getConfig(): QueryReformulationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<QueryReformulationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private selectStrategy(gaps: ContextGap[]): ReformulationStrategy {
    // Select strategy based on identified gaps
    const gapTypes = gaps.map(g => g.type);

    if (gapTypes.includes('missing_concept')) {
      return 'expand';
    }
    if (gapTypes.includes('specificity')) {
      return 'narrow';
    }
    if (gapTypes.includes('ambiguity')) {
      return 'rephrase';
    }
    if (gapTypes.includes('low_coverage')) {
      return 'synonym';
    }

    // Default to first available strategy
    return this.config.strategies[0] ?? 'expand';
  }

  private applyReformulation(
    query: string,
    gaps: ContextGap[],
    strategy: ReformulationStrategy,
    targetConcepts?: string[]
  ): string {
    const terms = this.extractTerms(query);

    switch (strategy) {
      case 'expand': {
        const expandedTerms = gaps.flatMap(g => g.suggestedTerms).slice(0, 3);
        const additionalTerms = targetConcepts ?? expandedTerms;
        return [...terms, ...additionalTerms].join(' ');
      }

      case 'narrow': {
        // Extract most specific terms from gaps
        const specificTerms = gaps
          .filter(g => g.type === 'specificity')
          .flatMap(g => g.suggestedTerms)
          .slice(0, 2);
        return [...terms, ...specificTerms].join(' ');
      }

      case 'rephrase':
        return this.rephraseQuery(query);

      case 'decompose': {
        const subQueries = this.decomposeQuery(query);
        return subQueries[0] ?? query;
      }

      case 'synonym': {
        const synonyms = this.generateSynonyms(terms);
        return [...terms.slice(0, 2), ...synonyms.slice(0, 2)].join(' ');
      }

      default:
        return query;
    }
  }

  private calculateConfidence(
    gaps: ContextGap[],
    results: SearchResult[]
  ): number {
    if (gaps.length === 0 && results.length > 0) {
      return 1.0;
    }

    const gapPenalty = gaps.reduce(
      (sum, gap) => sum + (1 - gap.confidence) * 0.1,
      0
    );
    const resultBonus = Math.min(results.length * 0.05, 0.3);

    return Math.max(0, Math.min(1, 0.5 + resultBonus - gapPenalty));
  }

  private extractTerms(text: string): string[] {
    // Extract meaningful terms from text
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
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
      'must',
      'that',
      'this',
      'these',
      'those',
      'it',
      'its',
      'from',
      'as',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term));
  }

  private generateSynonyms(terms: string[]): string[] {
    // Simple synonym generation for common programming terms
    const synonymMap: Record<string, string[]> = {
      function: ['method', 'procedure', 'routine', 'func'],
      class: ['type', 'struct', 'object', 'interface'],
      error: ['exception', 'failure', 'bug', 'issue'],
      auth: ['authentication', 'authorization', 'login', 'session'],
      data: ['information', 'payload', 'content', 'record'],
      api: ['endpoint', 'service', 'interface', 'route'],
      test: ['spec', 'check', 'verify', 'validate'],
      config: ['configuration', 'settings', 'options', 'params'],
      user: ['account', 'profile', 'member', 'client'],
      file: ['document', 'resource', 'asset', 'path'],
      database: ['db', 'storage', 'datastore', 'repository'],
      handler: ['controller', 'processor', 'manager', 'service'],
      request: ['req', 'query', 'call', 'invocation'],
      response: ['res', 'result', 'reply', 'output'],
    };

    const synonyms: string[] = [];
    for (const term of terms) {
      const termSynonyms = synonymMap[term];
      if (termSynonyms) {
        synonyms.push(...termSynonyms);
      }
    }

    return [...new Set(synonyms)];
  }

  private expandTerms(terms: string[]): string[] {
    // Expand terms with related concepts
    const expansionMap: Record<string, string[]> = {
      authentication: ['login', 'session', 'token', 'jwt', 'oauth'],
      database: ['query', 'model', 'schema', 'migration'],
      api: ['rest', 'graphql', 'endpoint', 'middleware'],
      error: ['catch', 'throw', 'handling', 'boundary'],
      test: ['mock', 'stub', 'fixture', 'coverage'],
      component: ['props', 'state', 'render', 'lifecycle'],
      async: ['await', 'promise', 'callback', 'observable'],
    };

    const expanded: string[] = [];
    for (const term of terms) {
      const expansions = expansionMap[term];
      if (expansions) {
        expanded.push(...expansions);
      }
    }

    return [...new Set(expanded)];
  }

  private findMissingTerms(
    queryTerms: string[],
    results: SearchResult[]
  ): string[] {
    const resultContent = results
      .map(r => r.chunk.content.toLowerCase())
      .join(' ');

    return queryTerms.filter(
      term => !resultContent.includes(term.toLowerCase())
    );
  }

  private generateSpecificTerms(
    _query: string,
    results: SearchResult[]
  ): string[] {
    // Extract specific terms from high-scoring results
    const highScoreResults = results.filter(r => r.score >= 0.8);
    const terms: string[] = [];

    for (const result of highScoreResults) {
      const metadata = result.chunk.metadata;
      if (metadata.functionName) {
        terms.push(metadata.functionName);
      }
      if (metadata.className) {
        terms.push(metadata.className);
      }
    }

    return [...new Set(terms)].slice(0, 5);
  }

  private extractKeyTermsFromResults(results: SearchResult[]): string[] {
    const allTerms = this.extractRelatedTerms(results);
    return allTerms.slice(0, 5);
  }

  private rephraseQuery(query: string): string {
    // Simple rephrasing by reordering and adjusting terms
    const terms = this.extractTerms(query);

    if (terms.length <= 1) {
      return query;
    }

    // Reverse order for different embedding
    const reordered = [...terms].reverse();

    // Add context hint
    const contextHints = ['implementation', 'code', 'example', 'usage'];
    const hint = contextHints.find(h => !terms.includes(h));

    if (hint) {
      reordered.push(hint);
    }

    return reordered.join(' ');
  }
}

/**
 * Factory function to create a query reformulator
 *
 * @param config - Optional configuration
 * @returns Configured QueryReformulator instance
 */
export function createQueryReformulator(
  config?: Partial<QueryReformulationConfig>
): QueryReformulator {
  return new QueryReformulator(config);
}
