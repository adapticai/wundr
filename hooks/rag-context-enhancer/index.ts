/**
 * RAG Context Enhancer Pre-Action Hook
 *
 * A pre-action hook that analyzes incoming requests and determines if
 * RAG (Retrieval-Augmented Generation) context would be beneficial.
 * When triggered, it executes RAG searches and injects enhanced context.
 *
 * @module hooks/rag-context-enhancer
 */

import { defaultConfig } from './config';
import { RequestAnalyzer } from './request-analyzer';

import type {
  RagContextHookConfig,
  HookContext,
  HookExecutionResult,
  AnalysisResult,
  EnhancedContext,
  GeneratedQuery,
  SearchConfig,
  IRagService,
} from './types';

// Re-export types for external use
export * from './types';
export { defaultConfig } from './config';
export { RequestAnalyzer } from './request-analyzer';

/**
 * Hook configuration export for registration
 */
export const ragContextEnhancerHook = {
  name: 'rag-context-enhancer',
  type: 'pre-action' as const,
  description: 'Analyzes requests and injects relevant RAG context',
  version: '1.0.0',
  enabled: true,
  config: defaultConfig,
  execute: executeHook,
};

/**
 * Simple in-memory cache for analysis results
 */
class AnalysisCache {
  private cache = new Map<string, { result: AnalysisResult; timestamp: number }>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number = 300000, maxEntries: number = 100) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): AnalysisResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
return undefined;
}

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  set(key: string, result: AnalysisResult): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { result, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const analysisCache = new AnalysisCache(
  defaultConfig.cache?.ttlMs ?? 300000,
  defaultConfig.cache?.maxEntries ?? 100,
);

/**
 * Execute the RAG context enhancer hook
 *
 * @param context - The hook execution context
 * @param config - Optional configuration override
 * @param ragService - Optional RAG service for searching (injected for testing)
 * @returns Hook execution result
 */
export async function executeHook(
  context: HookContext,
  config: Partial<RagContextHookConfig> = {},
  ragService?: IRagService,
): Promise<HookExecutionResult> {
  const startTime = Date.now();
  const mergedConfig = { ...defaultConfig, ...config };

  // Check if hook is enabled
  if (!mergedConfig.enabled) {
    return {
      success: true,
      analysis: createEmptyAnalysis(),
      executionTimeMs: Date.now() - startTime,
      contextInjected: false,
    };
  }

  try {
    // Create analyzer with merged config
    const analyzer = new RequestAnalyzer(mergedConfig);

    // Check cache first
    const cacheKey = generateCacheKey(context.request, context.targetPath);
    let analysis = analysisCache.get(cacheKey);

    if (!analysis) {
      // Perform analysis
      analysis = analyzer.analyze(context.request);
      analysisCache.set(cacheKey, analysis);
    }

    // Log analysis if configured
    if (mergedConfig.logging?.logMatches) {
      logAnalysis(analysis, mergedConfig);
    }

    // If enhancement not recommended, return early
    if (!analysis.shouldEnhance) {
      return {
        success: true,
        analysis,
        executionTimeMs: Date.now() - startTime,
        contextInjected: false,
      };
    }

    // Execute RAG search if service is available
    let enhancedContext: EnhancedContext | undefined;

    if (ragService && analysis.queries.length > 0) {
      try {
        // Build search config from analysis and defaults
        const searchConfig = buildSearchConfig(analysis, mergedConfig.defaultSearchConfig);

        enhancedContext = await ragService.search(
          analysis.queries,
          context.targetPath,
          searchConfig,
        );

        if (mergedConfig.logging?.logQueries) {
          logQueries(analysis.queries, enhancedContext);
        }
      } catch (_searchError) {
        // Search failed - continue without enhanced context
      }
    }

    const executionTimeMs = Date.now() - startTime;

    if (mergedConfig.logging?.logTiming) {
      // Timing logged: executionTimeMs is available in the returned result
    }

    return {
      success: true,
      analysis,
      enhancedContext,
      executionTimeMs,
      contextInjected: enhancedContext !== undefined && enhancedContext.sections.length > 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Hook execution failed - error details available in result.error

    return {
      success: false,
      analysis: createEmptyAnalysis(),
      error: errorMessage,
      executionTimeMs: Date.now() - startTime,
      contextInjected: false,
    };
  }
}

/**
 * Analyze a request without executing RAG search
 * Useful for testing or determining if enhancement would be triggered
 *
 * @param request - The request text to analyze
 * @param config - Optional configuration override
 * @returns Analysis result
 */
export function analyzeRequest(
  request: string,
  config: Partial<RagContextHookConfig> = {},
): AnalysisResult {
  const mergedConfig = { ...defaultConfig, ...config };
  const analyzer = new RequestAnalyzer(mergedConfig);
  return analyzer.analyze(request);
}

/**
 * Check if a request would trigger RAG enhancement
 *
 * @param request - The request text to check
 * @param config - Optional configuration override
 * @returns True if enhancement would be triggered
 */
export function wouldTriggerEnhancement(
  request: string,
  config: Partial<RagContextHookConfig> = {},
): boolean {
  const analysis = analyzeRequest(request, config);
  return analysis.shouldEnhance;
}

/**
 * Format enhanced context for injection into the conversation
 *
 * @param context - The enhanced context to format
 * @param maxTokens - Maximum tokens to include
 * @returns Formatted context string
 */
export function formatContextForInjection(
  context: EnhancedContext,
  maxTokens: number = 8000,
): string {
  if (context.sections.length === 0) {
    return '';
  }

  const lines: string[] = [
    '--- RAG Enhanced Context ---',
    '',
    `Summary: ${context.summary}`,
    '',
    'Relevant Code Sections:',
    '',
  ];

  let currentTokens = estimateTokens(lines.join('\n'));

  for (const section of context.sections) {
    const sectionLines = [
      `### ${section.filePath} (lines ${section.lineRange.start}-${section.lineRange.end})`,
      `Relevance: ${(section.relevanceScore * 100).toFixed(1)}%`,
      `Matched queries: ${section.matchedQueries.join(', ')}`,
      '',
      '```',
      section.content,
      '```',
      '',
    ];

    const sectionText = sectionLines.join('\n');
    const sectionTokens = estimateTokens(sectionText);

    if (currentTokens + sectionTokens > maxTokens) {
      break;
    }

    lines.push(...sectionLines);
    currentTokens += sectionTokens;
  }

  lines.push('--- End RAG Context ---');

  return lines.join('\n');
}

/**
 * Clear the analysis cache
 */
export function clearCache(): void {
  analysisCache.clear();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create an empty analysis result
 */
function createEmptyAnalysis(): AnalysisResult {
  return {
    shouldEnhance: false,
    confidence: 0,
    contextGoal: 'understanding',
    queries: [],
    matches: [],
    entities: {
      functions: [],
      classes: [],
      files: [],
      modules: [],
      keywords: [],
      variables: [],
    },
    reasoning: 'Analysis not performed or hook disabled.',
  };
}

/**
 * Generate a cache key from request and path
 */
function generateCacheKey(request: string, targetPath: string): string {
  const normalized = request.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${targetPath}:${normalized}`.substring(0, 500);
}

/**
 * Build search configuration from analysis and defaults
 */
function buildSearchConfig(
  analysis: AnalysisResult,
  defaults: SearchConfig,
): SearchConfig {
  return {
    ...defaults,
    // Add suggested patterns from analysis
    includePatterns: analysis.suggestedPatterns && analysis.suggestedPatterns.length > 0
      ? [...defaults.includePatterns, ...analysis.suggestedPatterns]
      : defaults.includePatterns,
  };
}

/**
 * Log analysis results
 */
function logAnalysis(_analysis: AnalysisResult, _config: RagContextHookConfig): void {
  // Logging is disabled - analysis details available in returned result
  // To enable logging, integrate with a proper logging framework
}

/**
 * Log generated queries and results
 */
function logQueries(_queries: readonly GeneratedQuery[], _context: EnhancedContext): void {
  // Logging is disabled - query and context details available in returned result
  // To enable logging, integrate with a proper logging framework
}

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Create a mock RAG service for testing
 */
export function createMockRagService(responses: Map<string, EnhancedContext>): IRagService {
  return {
    async search(
      queries: readonly GeneratedQuery[],
      _targetPath: string,
      _config: SearchConfig,
    ): Promise<EnhancedContext> {
      // Return first matching response or empty context
      for (const query of queries) {
        const response = responses.get(query.query);
        if (response) {
          return response;
        }
      }

      return {
        context: '',
        sections: [],
        summary: 'No results found',
        tokenCount: 0,
        sources: [],
        relevanceMap: {},
      };
    },

    async isIndexed(_path: string): Promise<boolean> {
      return true;
    },

    async indexPath(_path: string): Promise<void> {
      // No-op for mock
    },
  };
}

export default ragContextEnhancerHook;
