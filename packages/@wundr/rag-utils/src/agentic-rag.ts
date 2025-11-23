/**
 * Agentic RAG System Module
 *
 * Provides an intelligent, self-directed retrieval system that combines
 * iterative retrieval, query reformulation, self-critique, and context compaction
 * to achieve high-quality retrieval results.
 */

import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';

import {
  ContextCompactor,
  DEFAULT_COMPACTION_CONFIG,
} from './context-compaction';
import {
  QueryReformulator,
  DEFAULT_REFORMULATION_CONFIG,
} from './query-reformulation';
import { RetrievalService, DEFAULT_RETRIEVAL_OPTIONS } from './retrieval';
import { RetrievalCritic, DEFAULT_CRITIQUE_CONFIG } from './retrieval-critique';

import type {
  CompactedContext,
  ContextCompactionConfig,
} from './context-compaction';
import type {
  ReformulationResult,
  QueryReformulationConfig,
  ContextGap,
} from './query-reformulation';
import type {
  CritiqueResult,
  RetrievalCritiqueConfig,
} from './retrieval-critique';
import type {
  RetrievalOptions,
  SearchResult,
  ChunkingOptions,
  DocumentChunk,
} from './types';

/**
 * Configuration for the agentic RAG system
 */
export interface AgenticRAGConfig {
  /** Maximum retrieval iterations */
  maxIterations: number;
  /** Target quality score to achieve */
  targetQualityScore: number;
  /** Whether to enable query reformulation */
  enableReformulation: boolean;
  /** Whether to enable self-critique */
  enableCritique: boolean;
  /** Whether to enable context compaction */
  enableCompaction: boolean;
  /** Retrieval options */
  retrievalOptions: Partial<RetrievalOptions>;
  /** Query reformulation config */
  reformulationConfig: Partial<QueryReformulationConfig>;
  /** Critique config */
  critiqueConfig: Partial<RetrievalCritiqueConfig>;
  /** Compaction config */
  compactionConfig: Partial<ContextCompactionConfig>;
}

/**
 * Default agentic RAG configuration
 */
export const DEFAULT_AGENTIC_RAG_CONFIG: AgenticRAGConfig = {
  maxIterations: 3,
  targetQualityScore: 0.8,
  enableReformulation: true,
  enableCritique: true,
  enableCompaction: true,
  retrievalOptions: DEFAULT_RETRIEVAL_OPTIONS,
  reformulationConfig: DEFAULT_REFORMULATION_CONFIG,
  critiqueConfig: DEFAULT_CRITIQUE_CONFIG,
  compactionConfig: DEFAULT_COMPACTION_CONFIG,
};

/**
 * Result of a single retrieval iteration
 */
export interface RetrievalIteration {
  /** Iteration number */
  iteration: number;
  /** Query used for this iteration */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Critique of results (if enabled) */
  critique?: CritiqueResult;
  /** Reformulation result (if applied) */
  reformulation?: ReformulationResult;
  /** Time taken for iteration (ms) */
  duration: number;
}

/**
 * Complete result from agentic retrieval
 */
export interface AgenticRetrievalResult {
  /** Original query */
  originalQuery: string;
  /** Final query used */
  finalQuery: string;
  /** All retrieval iterations */
  iterations: RetrievalIteration[];
  /** Final combined results */
  results: SearchResult[];
  /** Compacted context (if enabled) */
  compactedContext?: CompactedContext;
  /** Final quality score */
  qualityScore: number;
  /** Whether target quality was achieved */
  targetAchieved: boolean;
  /** Total processing time (ms) */
  totalDuration: number;
  /** Summary of the retrieval process */
  summary: string;
}

/**
 * Zod schema for agentic RAG config validation
 */
export const AgenticRAGConfigSchema = z.object({
  maxIterations: z.number().int().positive().default(3),
  targetQualityScore: z.number().min(0).max(1).default(0.8),
  enableReformulation: z.boolean().default(true),
  enableCritique: z.boolean().default(true),
  enableCompaction: z.boolean().default(true),
  retrievalOptions: z.object({}).passthrough().default({}),
  reformulationConfig: z.object({}).passthrough().default({}),
  critiqueConfig: z.object({}).passthrough().default({}),
  compactionConfig: z.object({}).passthrough().default({}),
});

/**
 * Events emitted by the agentic RAG system
 */
export interface AgenticRAGEvents {
  'agentic:start': (query: string) => void;
  'agentic:iteration': (iteration: RetrievalIteration) => void;
  'agentic:reformulation': (result: ReformulationResult) => void;
  'agentic:critique': (result: CritiqueResult) => void;
  'agentic:compaction': (result: CompactedContext) => void;
  'agentic:complete': (result: AgenticRetrievalResult) => void;
  'agentic:error': (error: Error) => void;
}

/**
 * Agentic RAG system for intelligent, self-directed retrieval
 *
 * This system combines multiple techniques to achieve high-quality retrieval:
 * 1. Iterative retrieval with query reformulation
 * 2. Self-critique to assess retrieval quality
 * 3. Context compaction to prevent context rot
 *
 * @example
 * ```typescript
 * const agenticRAG = new AgenticRAGSystem();
 * agenticRAG.initialize(apiKey);
 *
 * // Index files
 * await agenticRAG.indexFiles(files);
 *
 * // Perform agentic retrieval
 * const result = await agenticRAG.agenticRetrieve("authentication flow");
 *
 * console.log(`Quality: ${result.qualityScore}`);
 * console.log(`Iterations: ${result.iterations.length}`);
 * console.log(`Results: ${result.results.length}`);
 * ```
 */
export class AgenticRAGSystem extends EventEmitter<AgenticRAGEvents> {
  private config: AgenticRAGConfig;
  private retrievalService: RetrievalService;
  private reformulator: QueryReformulator;
  private critic: RetrievalCritic;
  private compactor: ContextCompactor;
  private initialized = false;

  constructor(
    config: Partial<AgenticRAGConfig> = {},
    chunkingOptions?: Partial<ChunkingOptions>
  ) {
    super();
    this.config = { ...DEFAULT_AGENTIC_RAG_CONFIG, ...config };

    // Initialize components
    this.retrievalService = new RetrievalService(chunkingOptions);
    this.reformulator = new QueryReformulator(this.config.reformulationConfig);
    this.critic = new RetrievalCritic(this.config.critiqueConfig);
    this.compactor = new ContextCompactor(this.config.compactionConfig);
  }

  /**
   * Initialize the agentic RAG system with API key
   *
   * @param apiKey - API key for embedding service
   */
  initialize(apiKey: string): void {
    this.retrievalService.initialize(apiKey);
    this.initialized = true;
  }

  /**
   * Check if system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Index files for retrieval
   *
   * @param files - Files to index
   * @returns Number of chunks indexed
   */
  async indexFiles(
    files: Array<{ path: string; content: string; language?: string }>
  ): Promise<number> {
    if (!this.initialized) {
      throw new Error(
        'AgenticRAGSystem not initialized. Call initialize() with API key first.'
      );
    }

    return this.retrievalService.indexFiles(files);
  }

  /**
   * Perform agentic retrieval with iterative refinement
   *
   * @param query - The search query
   * @param options - Optional retrieval options
   * @returns Complete agentic retrieval result
   */
  async agenticRetrieve(
    query: string,
    options: Partial<RetrievalOptions> = {}
  ): Promise<AgenticRetrievalResult> {
    if (!this.initialized) {
      throw new Error(
        'AgenticRAGSystem not initialized. Call initialize() with API key first.'
      );
    }

    const startTime = Date.now();
    this.emit('agentic:start', query);

    try {
      const iterations: RetrievalIteration[] = [];
      let currentQuery = query;
      let allResults: SearchResult[] = [];
      let bestCritique: CritiqueResult | undefined;

      // Iterative retrieval loop
      for (let i = 0; i < this.config.maxIterations; i++) {
        const iterationStart = Date.now();

        // Perform retrieval
        const results = await this.retrievalService.search(currentQuery, {
          ...this.config.retrievalOptions,
          ...options,
        });

        let critique: CritiqueResult | undefined;
        let reformulation: ReformulationResult | undefined;

        // Critique results if enabled
        if (this.config.enableCritique) {
          critique = await this.critic.critique(currentQuery, results);
          this.emit('agentic:critique', critique);

          // Track best critique
          if (
            !bestCritique ||
            critique.overallScore > bestCritique.overallScore
          ) {
            bestCritique = critique;
          }
        }

        // Create iteration record
        const iteration: RetrievalIteration = {
          iteration: i + 1,
          query: currentQuery,
          results,
          critique,
          duration: Date.now() - iterationStart,
        };

        iterations.push(iteration);
        this.emit('agentic:iteration', iteration);

        // Merge results (deduplicated)
        allResults = this.mergeResults(allResults, results);

        // Check if target quality achieved or no more iterations needed
        if (
          critique?.isAcceptable &&
          critique.overallScore >= this.config.targetQualityScore
        ) {
          break;
        }

        // Check if another iteration is worthwhile
        if (critique && !critique.needsIteration) {
          break;
        }

        // Reformulate query for next iteration if enabled
        if (
          this.config.enableReformulation &&
          i < this.config.maxIterations - 1
        ) {
          reformulation = await this.reformulator.reformulate(
            currentQuery,
            results,
            {
              iteration: i + 1,
            }
          );
          this.emit('agentic:reformulation', reformulation);

          // Update current query for next iteration
          currentQuery = reformulation.reformulatedQuery;
          iteration.reformulation = reformulation;

          // Try query suggestions from critique
          if (
            critique?.querySuggestions &&
            critique.querySuggestions.length > 0
          ) {
            const suggestionResults = await this.trySuggestions(
              critique.querySuggestions,
              options
            );
            allResults = this.mergeResults(allResults, suggestionResults);
          }
        }
      }

      // Sort final results by score
      allResults.sort((a, b) => b.score - a.score);

      // Apply final filtering
      const finalResults = allResults.slice(
        0,
        options.topK ?? this.config.retrievalOptions.topK ?? 10
      );

      // Compact context if enabled
      let compactedContext: CompactedContext | undefined;
      if (this.config.enableCompaction) {
        compactedContext = await this.compactor.compact(finalResults);
        this.emit('agentic:compaction', compactedContext);
      }

      const totalDuration = Date.now() - startTime;
      const qualityScore =
        bestCritique?.overallScore ?? this.estimateQuality(finalResults);

      const result: AgenticRetrievalResult = {
        originalQuery: query,
        finalQuery: currentQuery,
        iterations,
        results: finalResults,
        compactedContext,
        qualityScore,
        targetAchieved: qualityScore >= this.config.targetQualityScore,
        totalDuration,
        summary: this.generateSummary(query, iterations, qualityScore),
      };

      this.emit('agentic:complete', result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('agentic:error', err);
      throw err;
    }
  }

  /**
   * Compact existing context to reduce token count
   *
   * @param results - Results to compact
   * @param options - Compaction options
   * @returns Compacted context
   */
  async compactContext(
    results: SearchResult[],
    options?: {
      maxTokens?: number;
      targetTokens?: number;
    }
  ): Promise<CompactedContext> {
    return this.compactor.compact(results, options);
  }

  /**
   * Critique retrieval quality
   *
   * @param query - The search query
   * @param results - Results to critique
   * @returns Critique result
   */
  async critiqueRetrieval(
    query: string,
    results: SearchResult[]
  ): Promise<CritiqueResult> {
    return this.critic.critique(query, results);
  }

  /**
   * Reformulate a query based on context gaps
   *
   * @param query - Query to reformulate
   * @param results - Previous results
   * @param options - Reformulation options
   * @returns Reformulation result
   */
  async reformulateQuery(
    query: string,
    results: SearchResult[],
    options?: { iteration?: number }
  ): Promise<ReformulationResult> {
    return this.reformulator.reformulate(query, results, options);
  }

  /**
   * Identify gaps in current retrieval context
   *
   * @param query - The search query
   * @param results - Current results
   * @returns Identified context gaps
   */
  identifyContextGaps(query: string, results: SearchResult[]): ContextGap[] {
    return this.reformulator.identifyContextGaps(query, results);
  }

  /**
   * Generate query variations for multi-query retrieval
   *
   * @param query - Original query
   * @param count - Number of variations
   * @returns Query variations
   */
  generateQueryVariations(query: string, count: number = 3): string[] {
    return this.reformulator.generateQueryVariations(query, count);
  }

  /**
   * Get context summary for compacted results
   *
   * @param context - Compacted context
   * @returns Summary string
   */
  getContextSummary(context: CompactedContext): string {
    return this.compactor.generateContextSummary(context);
  }

  /**
   * Clear all indexed data
   */
  clear(): void {
    this.retrievalService.clear();
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalChunks: number;
    fileCount: number;
    languages: string[];
    avgChunkSize: number;
  } {
    return this.retrievalService.getStats();
  }

  /**
   * Export index data
   */
  exportIndex(): { chunks: DocumentChunk[] } {
    return this.retrievalService.exportIndex();
  }

  /**
   * Import index data
   */
  importIndex(data: { chunks: DocumentChunk[] }): void {
    this.retrievalService.importIndex(data);
  }

  /**
   * Get the current configuration
   */
  getConfig(): AgenticRAGConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AgenticRAGConfig>): void {
    this.config = { ...this.config, ...config };

    // Update sub-components
    if (config.reformulationConfig) {
      this.reformulator.updateConfig(config.reformulationConfig);
    }
    if (config.critiqueConfig) {
      this.critic.updateConfig(config.critiqueConfig);
    }
    if (config.compactionConfig) {
      this.compactor.updateConfig(config.compactionConfig);
    }
  }

  /**
   * Get underlying components for advanced usage
   */
  getComponents(): {
    retrievalService: RetrievalService;
    reformulator: QueryReformulator;
    critic: RetrievalCritic;
    compactor: ContextCompactor;
  } {
    return {
      retrievalService: this.retrievalService,
      reformulator: this.reformulator,
      critic: this.critic,
      compactor: this.compactor,
    };
  }

  // Private helper methods

  private async trySuggestions(
    suggestions: string[],
    options: Partial<RetrievalOptions>
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    for (const suggestion of suggestions.slice(0, 2)) {
      const results = await this.retrievalService.search(suggestion, {
        ...this.config.retrievalOptions,
        ...options,
        topK: 3, // Limit results per suggestion
      });
      allResults.push(...results);
    }

    return allResults;
  }

  private mergeResults(
    existing: SearchResult[],
    newResults: SearchResult[]
  ): SearchResult[] {
    const seen = new Set(existing.map(r => r.chunk.id));
    const merged = [...existing];

    for (const result of newResults) {
      if (!seen.has(result.chunk.id)) {
        seen.add(result.chunk.id);
        merged.push(result);
      }
    }

    return merged;
  }

  private estimateQuality(results: SearchResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    // Average score with penalty for few results
    const avgScore =
      results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const countBonus = Math.min(results.length / 10, 0.2);

    return Math.min(avgScore + countBonus, 1);
  }

  private generateSummary(
    query: string,
    iterations: RetrievalIteration[],
    qualityScore: number
  ): string {
    const totalResults = iterations.reduce(
      (sum, i) => sum + i.results.length,
      0
    );
    const reformulations = iterations.filter(i => i.reformulation).length;
    const avgDuration =
      iterations.reduce((sum, i) => sum + i.duration, 0) / iterations.length;

    const parts: string[] = [
      `Agentic retrieval for "${query}" completed.`,
      `${iterations.length} iteration(s), ${totalResults} total results retrieved.`,
    ];

    if (reformulations > 0) {
      parts.push(`Query reformulated ${reformulations} time(s).`);
    }

    parts.push(
      `Final quality score: ${(qualityScore * 100).toFixed(1)}%.`,
      `Average iteration time: ${avgDuration.toFixed(0)}ms.`
    );

    return parts.join(' ');
  }
}

/**
 * Factory function to create an agentic RAG system
 *
 * @param apiKey - Optional API key (can be set later via initialize())
 * @param config - Optional configuration
 * @param chunkingOptions - Optional chunking options
 * @returns Configured AgenticRAGSystem instance
 */
export function createAgenticRAGSystem(
  apiKey?: string,
  config?: Partial<AgenticRAGConfig>,
  chunkingOptions?: Partial<ChunkingOptions>
): AgenticRAGSystem {
  const system = new AgenticRAGSystem(config, chunkingOptions);
  if (apiKey) {
    system.initialize(apiKey);
  }
  return system;
}
