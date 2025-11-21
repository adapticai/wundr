/**
 * RAG Context Builder MCP Tool Handler
 *
 * Builds comprehensive context for agent use by executing multiple RAG searches
 * in parallel, consolidating and deduplicating results, and fitting within
 * a specified token budget.
 *
 * @module @wundr/mcp-server/tools/rag/rag-context-builder
 */

import { z } from 'zod';
import { GeminiRAGService, getDefaultRAGService } from '../../services/gemini';
import type { McpToolResult } from '../registry';
import type {
  ConsolidatedContextItem,
  ContextSummary,
  IRAGService,
  ITokenCounter,
  PrioritizationStrategy,
  RAGChunk,
  RAGContextBuilderInput,
  RAGContextBuilderOutput,
  RAGSearchOptions,
  RAGSearchResult,
  RAGStore,
  QueryResult,
  TokenCountResult,
} from './types';

// =============================================================================
// Token Counting Utilities
// =============================================================================

/**
 * Estimates tokens based on character count
 * Uses a conservative estimate of ~4 characters per token (typical for English text)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Default token counter implementation using character-based estimation
 */
export class DefaultTokenCounter implements ITokenCounter {
  private readonly charsPerToken: number;

  constructor(charsPerToken: number = CHARS_PER_TOKEN) {
    this.charsPerToken = charsPerToken;
  }

  /**
   * Count tokens in a string
   */
  count(text: string): TokenCountResult {
    return {
      count: this.estimate(text),
      method: 'estimated',
    };
  }

  /**
   * Estimate tokens without full counting
   */
  estimate(text: string): number {
    return Math.ceil(text.length / this.charsPerToken);
  }

  /**
   * Truncate text to fit within token limit
   */
  truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.charsPerToken;
    if (text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars - 3) + '...';
  }
}

/**
 * Get the default token counter instance
 */
export function getTokenCounter(): ITokenCounter {
  return new DefaultTokenCounter();
}

/**
 * Estimate token count for a string
 */
export function estimateTokens(text: string): number {
  return getTokenCounter().estimate(text);
}

/**
 * Truncate text to fit within token budget
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  return getTokenCounter().truncateToFit(text, maxTokens);
}

// =============================================================================
// Context Consolidation Helpers
// =============================================================================

/**
 * Simple hash function for content deduplication
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Merge duplicate chunks from multiple search results
 */
export function deduplicateChunks(
  searchResults: readonly RAGSearchResult[],
): Map<string, { chunk: RAGChunk; matchedQueries: string[] }> {
  const deduped = new Map<string, { chunk: RAGChunk; matchedQueries: string[] }>();

  for (const result of searchResults) {
    for (const chunk of result.chunks) {
      const contentHash = simpleHash(chunk.content);
      const key = `${chunk.source}:${contentHash}`;

      const existing = deduped.get(key);
      if (existing) {
        const aggregatedScore = Math.max(existing.chunk.score, chunk.score);
        existing.matchedQueries.push(result.query);
        deduped.set(key, {
          chunk: { ...existing.chunk, score: aggregatedScore },
          matchedQueries: existing.matchedQueries,
        });
      } else {
        deduped.set(key, {
          chunk,
          matchedQueries: [result.query],
        });
      }
    }
  }

  return deduped;
}

/**
 * Convert deduplicated chunks to consolidated context items
 */
export function consolidateChunks(
  deduped: Map<string, { chunk: RAGChunk; matchedQueries: string[] }>,
  tokenCounter: ITokenCounter,
): ConsolidatedContextItem[] {
  const items: ConsolidatedContextItem[] = [];

  for (const [id, { chunk, matchedQueries }] of deduped) {
    const queryBoost = Math.min(matchedQueries.length * 0.1, 0.3);
    const aggregatedScore = Math.min(chunk.score + queryBoost, 1.0);

    items.push({
      id,
      content: chunk.content,
      source: chunk.source,
      aggregatedScore,
      matchedQueries: [...new Set(matchedQueries)],
      tokenCount: tokenCounter.estimate(chunk.content),
      timestamp: chunk.timestamp,
      lineRange: chunk.lineRange,
    });
  }

  return items;
}

// =============================================================================
// Legacy Input Schema (for backward compatibility)
// =============================================================================

export const ContextQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').describe('Search query'),
  storeIds: z.array(z.string()).optional().describe('Specific stores to search'),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium').describe('Query priority'),
  weight: z.number().min(0).max(1).optional().default(1).describe('Query weight in results'),
});

export type ContextQuery = z.infer<typeof ContextQuerySchema>;

export const RagContextBuilderInputSchema = z.object({
  queries: z.union([
    z.array(z.string()).min(1, 'At least one query is required'),
    z.array(ContextQuerySchema).min(1, 'At least one query is required'),
  ]).describe('Queries to execute (strings or query objects)'),
  targetPath: z.string().optional().describe('Target path/directory to search within'),
  contextGoal: z.string().optional().describe('Goal description for context building'),
  maxContextTokens: z.number().int().positive().optional().default(4000).describe('Maximum tokens in context'),
  prioritization: z.enum(['relevance', 'recency', 'coverage']).optional().default('relevance').describe('Prioritization strategy'),
  includePatterns: z.array(z.string()).optional().describe('File patterns to include'),
  excludePatterns: z.array(z.string()).optional().describe('File patterns to exclude'),
  minScore: z.number().min(0).max(1).optional().default(0.3).describe('Minimum relevance score threshold'),
  // Legacy fields for backward compatibility
  tokenBudget: z.number().int().positive().optional().describe('Alias for maxContextTokens'),
  strategy: z.enum(['relevance', 'recency', 'diversity', 'balanced']).optional().describe('Legacy strategy field'),
  deduplication: z.boolean().optional().default(true).describe('Remove duplicate results'),
  includeMetadata: z.boolean().optional().default(false).describe('Include result metadata'),
  maxResultsPerQuery: z.number().int().positive().optional().default(5).describe('Max results per query'),
});

export type RagContextBuilderInputLegacy = z.infer<typeof RagContextBuilderInputSchema>;

// =============================================================================
// Output Types
// =============================================================================

export interface ContextSegment {
  queryIndex: number;
  query: string;
  content: string;
  source: string;
  score: number;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export interface RagContextBuilderOutputLegacy {
  context: string;
  segments: ContextSegment[];
  totalTokens: number;
  tokenBudgetUsed: number;
  queriesExecuted: number;
  resultsIncluded: number;
  deduplicatedCount?: number;
}

// =============================================================================
// GeminiRAGService Interface (Legacy)
// =============================================================================

export interface GeminiRAGServiceLegacy {
  listStores(): Promise<RAGStore[]>;
  getStore(storeId: string): Promise<RAGStore | null>;
  search(
    storeId: string,
    query: string,
    options?: {
      topK?: number;
      minScore?: number;
      fileFilter?: string[];
    }
  ): Promise<QueryResult[]>;
  estimateTokens(text: string): number;
}

// =============================================================================
// Prioritization Strategy Implementations
// =============================================================================

/**
 * Strategy interface for context prioritization
 */
export interface PrioritizationStrategyImpl {
  sort(items: ConsolidatedContextItem[]): ConsolidatedContextItem[];
  getName(): PrioritizationStrategy;
}

/**
 * Relevance-based prioritization - highest relevance scores first
 */
export class RelevancePrioritization implements PrioritizationStrategyImpl {
  sort(items: ConsolidatedContextItem[]): ConsolidatedContextItem[] {
    return [...items].sort((a, b) => b.aggregatedScore - a.aggregatedScore);
  }
  getName(): PrioritizationStrategy {
    return 'relevance';
  }
}

/**
 * Recency-based prioritization - most recent items first
 */
export class RecencyPrioritization implements PrioritizationStrategyImpl {
  sort(items: ConsolidatedContextItem[]): ConsolidatedContextItem[] {
    return [...items].sort((a, b) => {
      const timeA = a.timestamp?.getTime() ?? 0;
      const timeB = b.timestamp?.getTime() ?? 0;
      if (timeA === timeB) {
        return b.aggregatedScore - a.aggregatedScore;
      }
      return timeB - timeA;
    });
  }
  getName(): PrioritizationStrategy {
    return 'recency';
  }
}

/**
 * Coverage-based prioritization - ensure all queries have representation
 */
export class CoveragePrioritization implements PrioritizationStrategyImpl {
  sort(items: ConsolidatedContextItem[]): ConsolidatedContextItem[] {
    const result: ConsolidatedContextItem[] = [];
    const coveredQueries = new Set<string>();
    const remaining = [...items];

    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        if (!item) {
continue;
}
        const uncoveredCount = item.matchedQueries.filter(
          (q) => !coveredQueries.has(q),
        ).length;
        const score = uncoveredCount + item.aggregatedScore * 0.1;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) {
break;
}

      const selected = remaining[bestIdx];
      if (!selected) {
break;
}
      result.push(selected);
      remaining.splice(bestIdx, 1);

      for (const query of selected.matchedQueries) {
        coveredQueries.add(query);
      }
    }

    remaining.sort((a, b) => b.aggregatedScore - a.aggregatedScore);
    result.push(...remaining);

    return result;
  }
  getName(): PrioritizationStrategy {
    return 'coverage';
  }
}

/**
 * Get the appropriate prioritization strategy implementation
 */
export function getPrioritizationStrategy(
  strategy: PrioritizationStrategy,
): PrioritizationStrategyImpl {
  switch (strategy) {
    case 'relevance':
      return new RelevancePrioritization();
    case 'recency':
      return new RecencyPrioritization();
    case 'coverage':
      return new CoveragePrioritization();
    default:
      return new RelevancePrioritization();
  }
}

// Legacy strategy type for backward compatibility
type LegacyPrioritizationStrategy = (segments: ContextSegment[]) => ContextSegment[];

const legacyStrategies: Record<string, LegacyPrioritizationStrategy> = {
  relevance: (segments) => [...segments].sort((a, b) => b.score - a.score),

  recency: (segments) => {
    return [...segments].sort((a, b) => {
      const aTime = a.metadata?.lastModified ? new Date(a.metadata.lastModified as string).getTime() : 0;
      const bTime = b.metadata?.lastModified ? new Date(b.metadata.lastModified as string).getTime() : 0;
      if (aTime !== bTime) {
return bTime - aTime;
}
      return b.score - a.score;
    });
  },

  diversity: (segments) => {
    const bySource = new Map<string, ContextSegment[]>();
    for (const seg of segments) {
      const existing = bySource.get(seg.source) || [];
      existing.push(seg);
      bySource.set(seg.source, existing);
    }

    const result: ContextSegment[] = [];
    const sources = Array.from(bySource.keys());
    let hasMore = true;
    let index = 0;

    while (hasMore) {
      hasMore = false;
      for (const source of sources) {
        const sourceSegments = bySource.get(source) || [];
        const segment = sourceSegments[index];
        if (index < sourceSegments.length && segment) {
          result.push(segment);
          hasMore = true;
        }
      }
      index++;
    }

    return result;
  },

  coverage: (segments) => {
    // Coverage strategy for legacy format
    const result: ContextSegment[] = [];
    const coveredQueries = new Set<number>();
    const remaining = [...segments];

    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        if (!seg) {
continue;
}
        const isUncovered = !coveredQueries.has(seg.queryIndex);
        const score = (isUncovered ? 1 : 0) + seg.score * 0.1;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) {
break;
}

      const selected = remaining[bestIdx];
      if (!selected) {
break;
}
      result.push(selected);
      remaining.splice(bestIdx, 1);
      coveredQueries.add(selected.queryIndex);
    }

    remaining.sort((a, b) => b.score - a.score);
    result.push(...remaining);

    return result;
  },

  balanced: (segments) => {
    const byPriority = {
      high: segments.filter(s => s.metadata?.priority === 'high'),
      medium: segments.filter(s => s.metadata?.priority === 'medium' || !s.metadata?.priority),
      low: segments.filter(s => s.metadata?.priority === 'low'),
    };

    for (const priority of Object.keys(byPriority) as Array<keyof typeof byPriority>) {
      byPriority[priority].sort((a, b) => b.score - a.score);
    }

    return [...byPriority.high, ...byPriority.medium, ...byPriority.low];
  },
};

// ============================================================================
// Deduplication
// ============================================================================

function deduplicateSegments(segments: ContextSegment[]): { segments: ContextSegment[]; removed: number } {
  const seen = new Set<string>();
  const unique: ContextSegment[] = [];
  let removed = 0;

  for (const segment of segments) {
    // Create a hash based on content and source
    const hash = `${segment.source}:${segment.content.substring(0, 100)}`;
    if (!seen.has(hash)) {
      seen.add(hash);
      unique.push(segment);
    } else {
      removed++;
    }
  }

  return { segments: unique, removed };
}

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * Creates the RAG context builder handler
 */
export function createRagContextBuilderHandler(ragService: GeminiRAGService) {
  return async function ragContextBuilderHandler(
    input: RagContextBuilderInputLegacy,
  ): Promise<McpToolResult<RagContextBuilderOutputLegacy>> {
    try {
      // Validate input
      const validationResult = RagContextBuilderInputSchema.safeParse(input);
      if (!validationResult.success) {
        return {
          success: false,
          error: 'Input validation failed',
          errorDetails: {
            code: 'VALIDATION_ERROR',
            message: validationResult.error.message,
            context: { issues: validationResult.error.issues },
          },
        };
      }

      const validInput = validationResult.data;
      const allSegments: ContextSegment[] = [];
      let queriesExecuted = 0;

      // Get available stores
      const availableStores = await ragService.listStores();
      if (availableStores.length === 0) {
        return {
          success: false,
          error: 'No RAG stores available',
          errorDetails: {
            code: 'NO_STORES',
            message: 'No RAG stores are available for searching. Create a store first.',
          },
        };
      }

      // Execute each query
      for (let i = 0; i < validInput.queries.length; i++) {
        const queryDef = validInput.queries[i];
        if (queryDef === undefined) {
continue;
}

        // Handle both string and object query formats
        const isStringQuery = typeof queryDef === 'string';
        const queryString = isStringQuery ? queryDef : queryDef.query;
        const queryStoreIds = isStringQuery ? undefined : queryDef.storeIds;
        const queryWeight = isStringQuery ? 1 : (queryDef.weight || 1);
        const queryPriority = isStringQuery ? undefined : queryDef.priority;

        const storesToSearch = queryStoreIds && queryStoreIds.length > 0
          ? availableStores.filter(s => queryStoreIds.includes(s.id))
          : availableStores;

        if (storesToSearch.length === 0) {
          continue;
        }

        // Search each store
        for (const store of storesToSearch) {
          try {
            // Use the searchStore method which returns an array of ExtendedSearchResult
            const results = await ragService.searchStore(store.id, queryString, {
              limit: validInput.maxResultsPerQuery,
            });

            // Convert results to segments (results is an array)
            for (const result of results) {
              const tokenCount = estimateTokens(result.content);
              allSegments.push({
                queryIndex: i,
                query: queryString,
                content: result.content,
                source: result.metadata.filePath,
                score: result.score * queryWeight,
                tokenCount,
                metadata: {
                  ...result.metadata,
                  priority: queryPriority,
                  storeId: store.id,
                },
              });
            }
            queriesExecuted++;
          } catch (error) {
            // Continue with other stores if one fails
            console.warn(`Search failed for store ${store.id}:`, error);
          }
        }
      }

      if (allSegments.length === 0) {
        return {
          success: true,
          data: {
            context: '',
            segments: [],
            totalTokens: 0,
            tokenBudgetUsed: 0,
            queriesExecuted,
            resultsIncluded: 0,
          },
          message: 'No results found for the given queries',
        };
      }

      // Deduplicate if enabled
      let deduplicatedCount: number | undefined;
      let processedSegments = allSegments;

      if (validInput.deduplication) {
        const dedupeResult = deduplicateSegments(allSegments);
        processedSegments = dedupeResult.segments;
        deduplicatedCount = dedupeResult.removed;
      }

      // Apply prioritization strategy
      const strategyName = validInput.prioritization || validInput.strategy || 'relevance';
      const strategyFn = legacyStrategies[strategyName as keyof typeof legacyStrategies];
      const prioritizedSegments = strategyFn ? strategyFn(processedSegments) : processedSegments;

      // Build context within token budget
      const finalSegments: ContextSegment[] = [];
      let totalTokens = 0;
      const tokenBudget = validInput.tokenBudget ?? 4000; // Default to 4000 if not specified

      for (const segment of prioritizedSegments) {
        if (totalTokens + segment.tokenCount > tokenBudget) {
          // Try to fit partial content
          const remainingBudget = tokenBudget - totalTokens;
          if (remainingBudget > 100) {
            // Estimate characters based on tokens (roughly 4 chars per token)
            const maxChars = remainingBudget * 4;
            const truncatedContent = segment.content.substring(0, maxChars);
            const truncatedTokens = estimateTokens(truncatedContent);

            finalSegments.push({
              ...segment,
              content: truncatedContent + '...',
              tokenCount: truncatedTokens,
            });
            totalTokens += truncatedTokens;
          }
          break;
        }

        finalSegments.push(segment);
        totalTokens += segment.tokenCount;
      }

      // Build the final context string
      const contextParts: string[] = [];
      for (const segment of finalSegments) {
        if (validInput.includeMetadata) {
          contextParts.push(`[Source: ${segment.source}]\n${segment.content}`);
        } else {
          contextParts.push(segment.content);
        }
      }

      const context = contextParts.join('\n\n---\n\n');
      const tokenBudgetUsed = Math.round((totalTokens / tokenBudget) * 100);

      return {
        success: true,
        data: {
          context,
          segments: finalSegments,
          totalTokens,
          tokenBudgetUsed,
          queriesExecuted,
          resultsIncluded: finalSegments.length,
          deduplicatedCount,
        },
        message: `Built context with ${finalSegments.length} segments (${totalTokens} tokens, ${tokenBudgetUsed}% of budget)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
        errorDetails: {
          code: 'CONTEXT_BUILD_ERROR',
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  };
}

/**
 * Tool definition for MCP registration (legacy format)
 */
export const ragContextBuilderToolLegacy = {
  name: 'rag-context-builder',
  description: 'Build optimized context from multiple RAG queries with token budget management',
  inputSchema: {
    type: 'object',
    properties: {
      queries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            storeIds: { type: 'array', items: { type: 'string' }, description: 'Specific stores to search' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Query priority' },
            weight: { type: 'number', description: 'Query weight in results (0-1)' },
          },
          required: ['query'],
        },
        description: 'Queries to execute',
      },
      tokenBudget: {
        type: 'number',
        description: 'Maximum tokens in context',
        default: 4000,
      },
      strategy: {
        type: 'string',
        enum: ['relevance', 'recency', 'diversity', 'balanced'],
        description: 'Prioritization strategy',
        default: 'balanced',
      },
      deduplication: {
        type: 'boolean',
        description: 'Remove duplicate results',
        default: true,
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Include result metadata',
        default: false,
      },
      maxResultsPerQuery: {
        type: 'number',
        description: 'Max results per query',
        default: 5,
      },
    },
    required: ['queries'],
  },
  category: 'rag',
};

// =============================================================================
// New Context Builder Handler (matches specified interface)
// =============================================================================

/**
 * Format consolidated context items into a structured string for agent use
 */
export function formatContextForAgent(
  items: readonly ConsolidatedContextItem[],
  contextGoal: string,
): string {
  if (items.length === 0) {
    return `# Context for: ${contextGoal}\n\nNo relevant context found.`;
  }

  const sections: string[] = [
    `# Context for: ${contextGoal}`,
    '',
    `Found ${items.length} relevant context items.`,
    '',
    '---',
    '',
  ];

  for (const item of items) {
    sections.push(`## ${item.source}`);
    if (item.lineRange) {
      sections.push(`Lines ${item.lineRange.start}-${item.lineRange.end}`);
    }
    sections.push(`Relevance: ${(item.aggregatedScore * 100).toFixed(1)}%`);
    sections.push(`Matched queries: ${item.matchedQueries.join(', ')}`);
    sections.push('');
    sections.push('```');
    sections.push(item.content);
    sections.push('```');
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Select items that fit within the token budget
 */
export function selectWithinBudget(
  items: ConsolidatedContextItem[],
  maxTokens: number,
  tokenCounter: ITokenCounter,
): { selected: ConsolidatedContextItem[]; totalTokens: number } {
  const selected: ConsolidatedContextItem[] = [];
  let totalTokens = 0;

  const overheadPerItem = 50;
  const headerOverhead = 100;
  const availableTokens = maxTokens - headerOverhead;

  for (const item of items) {
    const itemTokens = item.tokenCount + overheadPerItem;
    if (totalTokens + itemTokens <= availableTokens) {
      selected.push(item);
      totalTokens += itemTokens;
    }
  }

  return { selected, totalTokens: totalTokens + headerOverhead };
}

/**
 * Create an error response for the new handler format
 */
function createErrorResponse(
  error: string,
  startTime: number,
): RAGContextBuilderOutput {
  return {
    success: false,
    contextItems: [],
    summary: {
      totalSources: 0,
      totalTokens: 0,
      queryBreakdown: {},
      coverageScore: 0,
      averageRelevance: 0,
      strategyUsed: 'relevance',
    },
    formattedContext: '',
    error,
    metadata: {
      totalSearchTimeMs: 0,
      processingTimeMs: Date.now() - startTime,
      queriesExecuted: 0,
      chunksProcessed: 0,
      chunksIncluded: 0,
      tokenBudgetUsed: 0,
      tokenBudgetRemaining: 0,
    },
  };
}

/**
 * RAG Context Builder Handler
 *
 * Executes multiple RAG searches in parallel, consolidates results,
 * and builds comprehensive context within a token budget.
 *
 * @param input - Context builder input parameters
 * @param ragService - Optional RAG service instance (defaults to GeminiRAGService)
 * @returns Context builder output with formatted context and metadata
 *
 * @example
 * ```typescript
 * const result = await ragContextBuilderHandler({
 *   queries: ['authentication', 'JWT tokens', 'refresh tokens'],
 *   targetPath: '/path/to/project',
 *   contextGoal: 'Understand the authentication system',
 *   maxContextTokens: 4000,
 *   prioritization: 'relevance',
 * });
 *
 * console.log(result.formattedContext);
 * ```
 */
export async function ragContextBuilderHandler(
  input: RAGContextBuilderInput,
  ragService?: IRAGService,
): Promise<RAGContextBuilderOutput> {
  const startTime = Date.now();
  const tokenCounter = getTokenCounter();
  const warnings: string[] = [];

  try {
    // Validate input
    if (!input.queries || input.queries.length === 0) {
      return createErrorResponse('At least one query is required', startTime);
    }

    if (!input.targetPath) {
      return createErrorResponse('Target path is required', startTime);
    }

    if (input.maxContextTokens <= 0) {
      return createErrorResponse('maxContextTokens must be positive', startTime);
    }

    // Use provided service or default
    const service = ragService ?? getDefaultRAGService();

    // Build search options
    const searchOptions: RAGSearchOptions = {
      minScore: input.minScore ?? 0.3,
      includePatterns: input.includePatterns,
      excludePatterns: input.excludePatterns,
      includeContent: true,
    };

    // Execute all searches in parallel
    const searchStartTime = Date.now();
    const searchResults = await service.searchMultiple(
      input.queries,
      input.targetPath,
      searchOptions,
    );
    const totalSearchTimeMs = Date.now() - searchStartTime;

    // Check for search errors
    const searchErrors = searchResults.filter((r) => r.error);
    if (searchErrors.length > 0) {
      for (const err of searchErrors) {
        warnings.push(`Search error for query "${err.query}": ${err.error}`);
      }
    }

    // Count total chunks processed
    const chunksProcessed = searchResults.reduce(
      (sum, r) => sum + r.chunks.length,
      0,
    );

    // Deduplicate chunks across all search results
    const deduped = deduplicateChunks(searchResults);

    // Convert to consolidated context items
    const consolidated = consolidateChunks(deduped, tokenCounter);

    // Apply prioritization strategy
    const strategy = getPrioritizationStrategy(input.prioritization);
    const prioritized = strategy.sort(consolidated);

    // Select items within token budget
    const { selected, totalTokens } = selectWithinBudget(
      prioritized,
      input.maxContextTokens,
      tokenCounter,
    );

    // Format context for agent use
    const formattedContext = formatContextForAgent(selected, input.contextGoal);

    // Calculate coverage score
    const allQueries = new Set(input.queries);
    const coveredQueries = new Set(
      selected.flatMap((item) => item.matchedQueries),
    );
    const coverageScore = coveredQueries.size / allQueries.size;

    // Calculate average relevance
    const averageRelevance =
      selected.length > 0
        ? selected.reduce((sum, item) => sum + item.aggregatedScore, 0) /
          selected.length
        : 0;

    // Build query breakdown
    const queryBreakdown: Record<string, number> = {};
    for (const query of input.queries) {
      queryBreakdown[query] = selected.filter((item) =>
        item.matchedQueries.includes(query),
      ).length;
    }

    // Calculate unique sources
    const uniqueSources = new Set(selected.map((item) => item.source));

    // Build summary
    const summary: ContextSummary = {
      totalSources: uniqueSources.size,
      totalTokens,
      queryBreakdown,
      coverageScore,
      averageRelevance,
      strategyUsed: input.prioritization,
    };

    const processingTimeMs = Date.now() - startTime - totalSearchTimeMs;

    return {
      success: true,
      contextItems: selected,
      summary,
      formattedContext,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        totalSearchTimeMs,
        processingTimeMs,
        queriesExecuted: input.queries.length,
        chunksProcessed,
        chunksIncluded: selected.length,
        tokenBudgetUsed: totalTokens,
        tokenBudgetRemaining: input.maxContextTokens - totalTokens,
      },
    };
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : String(error),
      startTime,
    );
  }
}

/**
 * MCP Tool definition for RAG Context Builder (new format)
 */
export const ragContextBuilderTool = {
  name: 'rag_context_builder',
  description:
    'Build comprehensive context for agent use by executing multiple RAG searches in parallel, ' +
    'consolidating and deduplicating results, and fitting within a specified token budget. ' +
    'Supports relevance, recency, and coverage prioritization strategies.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      queries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple search queries to execute in parallel',
        minItems: 1,
      },
      targetPath: {
        type: 'string',
        description: 'Target path/directory to search within',
      },
      contextGoal: {
        type: 'string',
        description: 'Goal description for context building (helps format output)',
      },
      maxContextTokens: {
        type: 'number',
        description: 'Maximum tokens allowed in the built context',
        minimum: 100,
        default: 4000,
      },
      prioritization: {
        type: 'string',
        enum: ['relevance', 'recency', 'coverage'],
        description:
          'Strategy for prioritizing results: relevance (highest scores), ' +
          'recency (most recent), or coverage (ensure all queries represented)',
        default: 'relevance',
      },
      includePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional file patterns to include (e.g., ["*.ts", "*.js"])',
      },
      excludePatterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional file patterns to exclude (e.g., ["node_modules/*"])',
      },
      minScore: {
        type: 'number',
        description: 'Minimum relevance score threshold (0-1)',
        minimum: 0,
        maximum: 1,
        default: 0.3,
      },
    },
    required: ['queries', 'targetPath', 'contextGoal', 'maxContextTokens', 'prioritization'],
  },
  category: 'rag',
};

/**
 * Handle MCP tool call for RAG Context Builder
 */
export async function handleRagContextBuilder(
  args: Record<string, unknown>,
): Promise<{ success: boolean; data?: RAGContextBuilderOutput; error?: string }> {
  try {
    const input: RAGContextBuilderInput = {
      queries: args['queries'] as string[],
      targetPath: args['targetPath'] as string,
      contextGoal: args['contextGoal'] as string,
      maxContextTokens: (args['maxContextTokens'] as number) ?? 4000,
      prioritization: (args['prioritization'] as PrioritizationStrategy) ?? 'relevance',
      includePatterns: args['includePatterns'] as string[] | undefined,
      excludePatterns: args['excludePatterns'] as string[] | undefined,
      minScore: args['minScore'] as number | undefined,
    };

    const result = await ragContextBuilderHandler(input);

    return {
      success: result.success,
      data: result,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
