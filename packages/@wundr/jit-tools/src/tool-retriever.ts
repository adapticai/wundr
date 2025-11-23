/**
 * @wundr.io/jit-tools - Tool Retriever
 *
 * JITToolRetriever class with semantic search for tools, permission filtering,
 * and relevance ranking. Uses RAG utilities for semantic similarity matching.
 */

import { EventEmitter } from 'eventemitter3';

import { IntentAnalyzer } from './intent-analyzer';
import { DEFAULT_JIT_CONFIG } from './types';

import type { ToolRegistry } from './tool-registry';
import type {
  ToolSpec,
  ToolRetrievalResult,
  RetrievedTool,
  JITToolConfig,
  AgentContext,
  ParsedIntent,
  ToolCategory,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for a retrieval operation
 */
export interface RetrievalOptions {
  /** Override max tools for this retrieval */
  maxTools?: number;
  /** Override token budget for this retrieval */
  maxTokenBudget?: number;
  /** Override minimum relevance score */
  minRelevanceScore?: number;
  /** Bypass permission filtering */
  bypassPermissions?: boolean;
  /** Include deprecated tools */
  includeDeprecated?: boolean;
  /** Boost specific tool categories */
  categoryBoosts?: Partial<Record<ToolCategory, number>>;
  /** Specific tool IDs to prioritize */
  prioritizedToolIds?: string[];
  /** Specific tool IDs to exclude */
  excludedToolIds?: string[];
}

/**
 * Cache entry for retrieval results
 */
interface CacheEntry {
  result: ToolRetrievalResult;
  timestamp: number;
  queryHash: string;
}

// =============================================================================
// JITToolRetriever Class
// =============================================================================

/**
 * Retrieves and ranks tools based on agent intent using semantic search
 * and relevance scoring.
 *
 * @example
 * ```typescript
 * const retriever = new JITToolRetriever(registry, config);
 *
 * // Retrieve tools for a query
 * const result = await retriever.retrieve(
 *   'I need to review the pull request and check for security issues',
 *   agentContext
 * );
 *
 * // Result contains ranked tools with scores
 * for (const { tool, finalScore } of result.tools) {
 *   console.log(`${tool.name}: ${finalScore}`);
 * }
 * ```
 */
export class JITToolRetriever extends EventEmitter {
  private registry: ToolRegistry;
  private config: JITToolConfig;
  private intentAnalyzer: IntentAnalyzer;
  private cache: Map<string, CacheEntry> = new Map();
  private embeddings: Map<string, number[]> = new Map();

  /**
   * Creates a new JITToolRetriever instance
   *
   * @param registry - Tool registry to retrieve from
   * @param config - JIT configuration options
   */
  constructor(registry: ToolRegistry, config: Partial<JITToolConfig> = {}) {
    super();
    this.registry = registry;
    this.config = { ...DEFAULT_JIT_CONFIG, ...config };
    this.intentAnalyzer = new IntentAnalyzer();
  }

  // ===========================================================================
  // Main Retrieval Methods
  // ===========================================================================

  /**
   * Retrieve relevant tools for a query
   *
   * @param query - Natural language query describing the needed tools
   * @param context - Agent context for personalization
   * @param options - Retrieval options
   * @returns Tool retrieval result with ranked tools
   */
  async retrieve(
    query: string,
    context?: AgentContext,
    options: RetrievalOptions = {}
  ): Promise<ToolRetrievalResult> {
    const startTime = Date.now();

    // Emit retrieval started event
    this.emit('retrieval:started', { query, context });

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cachedResult = this.getCachedResult(query, context);
        if (cachedResult) {
          this.emit('cache:hit', { query });
          return cachedResult;
        }
        this.emit('cache:miss', { query });
      }

      // Analyze intent
      const intent = context?.taskContext
        ? this.intentAnalyzer.analyzeWithTaskContext(query, context.taskContext)
        : this.intentAnalyzer.analyze(query, context);

      // Get candidate tools
      const candidates = this.getCandidateTools(intent, context, options);

      // Score all candidates
      const scoredTools = await this.scoreTools(
        candidates,
        intent,
        context,
        options
      );

      // Filter by permissions
      const permissionFiltered = this.filterByPermissions(
        scoredTools,
        context,
        options
      );

      // Filter by score threshold
      const minScore =
        options.minRelevanceScore ?? this.config.minRelevanceScore;
      const scoreFiltered = permissionFiltered.filter(
        rt => rt.finalScore >= minScore
      );

      // Apply token budget and max tools limit
      const maxTools = options.maxTools ?? this.config.maxTools;
      const maxBudget = options.maxTokenBudget ?? this.config.maxTokenBudget;
      const finalTools = this.applyBudgetConstraints(
        scoreFiltered,
        maxTools,
        maxBudget
      );

      // Build result
      const result: ToolRetrievalResult = {
        tools: finalTools,
        totalMatches: scoredTools.length,
        query,
        retrievalTimeMs: Date.now() - startTime,
        totalTokenCost: finalTools.reduce(
          (sum, rt) => sum + rt.tool.tokenCost,
          0
        ),
        metadata: {
          toolsScanned: candidates.length,
          filteredByPermissions: scoredTools.length - permissionFiltered.length,
          filteredByScore: permissionFiltered.length - scoreFiltered.length,
          usedSemanticSearch: this.config.enableSemanticSearch,
          cacheHit: false,
        },
      };

      // Cache result
      if (this.config.enableCaching) {
        this.cacheResult(query, context, result);
      }

      // Emit completion event
      this.emit('retrieval:completed', { result });

      return result;
    } catch (error) {
      this.emit('retrieval:error', { query, error });
      throw error;
    }
  }

  /**
   * Retrieve tools by specific capabilities
   *
   * @param capabilities - Required capabilities
   * @param context - Agent context
   * @param options - Retrieval options
   * @returns Tool retrieval result
   */
  async retrieveByCapabilities(
    capabilities: string[],
    context?: AgentContext,
    options: RetrievalOptions = {}
  ): Promise<ToolRetrievalResult> {
    const query = `Find tools with capabilities: ${capabilities.join(', ')}`;
    return this.retrieve(query, context, options);
  }

  /**
   * Retrieve tools by category
   *
   * @param categories - Tool categories
   * @param context - Agent context
   * @param options - Retrieval options
   * @returns Tool retrieval result
   */
  async retrieveByCategories(
    categories: ToolCategory[],
    context?: AgentContext,
    options: RetrievalOptions = {}
  ): Promise<ToolRetrievalResult> {
    const boostedOptions: RetrievalOptions = {
      ...options,
      categoryBoosts: categories.reduce(
        (acc, cat) => {
          acc[cat] = 2.0; // Double the weight for specified categories
          return acc;
        },
        {} as Partial<Record<ToolCategory, number>>
      ),
    };

    const query = `Find tools in categories: ${categories.join(', ')}`;
    return this.retrieve(query, context, boostedOptions);
  }

  /**
   * Get tool recommendations based on agent history
   *
   * @param context - Agent context with history
   * @param options - Retrieval options
   * @returns Recommended tools
   */
  async getRecommendations(
    context: AgentContext,
    options: RetrievalOptions = {}
  ): Promise<ToolRetrievalResult> {
    // Build query from agent history and preferences
    const recentTools = context.toolHistory
      .slice(0, 10)
      .filter(
        record => record.success && record.relevanceFeedback !== 'not_helpful'
      )
      .map(record => record.toolId);

    const preferredCategories = context.preferences.preferredCategories;

    const query = `Recommend tools similar to: ${recentTools.join(', ')}. Prefer categories: ${preferredCategories.join(', ')}`;

    return this.retrieve(query, context, {
      ...options,
      prioritizedToolIds: context.preferences.preferredTools,
      excludedToolIds: context.preferences.excludedTools,
    });
  }

  // ===========================================================================
  // Scoring Methods
  // ===========================================================================

  /**
   * Score tools against the parsed intent
   */
  private async scoreTools(
    tools: ToolSpec[],
    intent: ParsedIntent,
    context?: AgentContext,
    options: RetrievalOptions = {}
  ): Promise<RetrievedTool[]> {
    const weights = this.config.scoringWeights;
    const categoryBoosts = options.categoryBoosts || {};

    const scoredTools: RetrievedTool[] = [];

    for (const tool of tools) {
      // Calculate individual scores
      const semanticScore = this.config.enableSemanticSearch
        ? await this.calculateSemanticScore(tool, intent)
        : 0;

      const keywordScore = this.calculateKeywordScore(tool, intent);
      const permissionScore = this.calculatePermissionScore(tool, context);
      const priorityScore = tool.priority / 100;
      const categoryScore = this.calculateCategoryScore(
        tool,
        intent,
        categoryBoosts
      );

      // Calculate weighted final score
      let finalScore =
        semanticScore * weights.semantic +
        keywordScore * weights.keyword +
        permissionScore * weights.permission +
        priorityScore * weights.priority +
        categoryScore * weights.category;

      // Apply boosts
      if (options.prioritizedToolIds?.includes(tool.id)) {
        finalScore *= 1.5;
      }

      // Apply preference boosts from context
      if (context?.preferences.preferredTools.includes(tool.id)) {
        finalScore *= 1.3;
      }

      // Apply history boosts
      if (context) {
        const historyBoost = this.calculateHistoryBoost(tool.id, context);
        finalScore *= historyBoost;
      }

      // Normalize to 0-1 range
      finalScore = Math.min(Math.max(finalScore, 0), 1);

      scoredTools.push({
        tool,
        relevanceScore: (semanticScore + keywordScore) / 2,
        semanticScore,
        keywordScore,
        permissionScore,
        finalScore,
        matchReasons: this.generateMatchReasons(tool, intent, {
          semanticScore,
          keywordScore,
          permissionScore,
          categoryScore,
        }),
      });
    }

    // Sort by final score descending
    scoredTools.sort((a, b) => b.finalScore - a.finalScore);

    return scoredTools;
  }

  /**
   * Calculate semantic similarity score
   */
  private async calculateSemanticScore(
    tool: ToolSpec,
    intent: ParsedIntent
  ): Promise<number> {
    // Get or compute tool embedding
    const toolEmbedding = await this.getToolEmbedding(tool);
    const queryEmbedding = await this.getQueryEmbedding(intent.normalizedQuery);

    if (!toolEmbedding || !queryEmbedding) {
      return 0;
    }

    // Calculate cosine similarity
    return this.cosineSimilarity(toolEmbedding, queryEmbedding);
  }

  /**
   * Calculate keyword matching score
   */
  private calculateKeywordScore(tool: ToolSpec, intent: ParsedIntent): number {
    const toolKeywords = new Set([
      ...tool.keywords.map(k => k.toLowerCase()),
      ...tool.capabilities.map(c => c.toLowerCase()),
      tool.name.toLowerCase(),
    ]);

    const queryKeywords = intent.keywords.map(k => k.toLowerCase());

    // Count matches
    let matches = 0;
    for (const keyword of queryKeywords) {
      if (toolKeywords.has(keyword)) {
        matches++;
      } else {
        // Partial matching
        for (const toolKeyword of toolKeywords) {
          if (toolKeyword.includes(keyword) || keyword.includes(toolKeyword)) {
            matches += 0.5;
            break;
          }
        }
      }
    }

    // Normalize by query keyword count
    return queryKeywords.length > 0
      ? Math.min(matches / queryKeywords.length, 1)
      : 0;
  }

  /**
   * Calculate permission matching score
   */
  private calculatePermissionScore(
    tool: ToolSpec,
    context?: AgentContext
  ): number {
    if (!context || this.config.permissionMode === 'disabled') {
      return 1.0;
    }

    const agentPermissions = new Set(context.permissions);
    const toolPermissions = tool.permissions;

    // Check if agent has all required permissions
    const matchedPermissions = toolPermissions.filter(p =>
      agentPermissions.has(p)
    );
    const permissionRatio =
      toolPermissions.length > 0
        ? matchedPermissions.length / toolPermissions.length
        : 1.0;

    return permissionRatio;
  }

  /**
   * Calculate category relevance score
   */
  private calculateCategoryScore(
    tool: ToolSpec,
    intent: ParsedIntent,
    boosts: Partial<Record<ToolCategory, number>>
  ): number {
    let score = 0;

    // Check if tool category matches intent categories
    if (intent.relevantCategories.includes(tool.category)) {
      score = 1.0;
    }

    // Apply category boosts
    const boost = boosts[tool.category];
    if (boost) {
      score *= boost;
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate boost from tool usage history
   */
  private calculateHistoryBoost(toolId: string, context: AgentContext): number {
    const relevantHistory = context.toolHistory.filter(
      h => h.toolId === toolId
    );

    if (relevantHistory.length === 0) {
      return 1.0;
    }

    // Calculate success rate
    const successCount = relevantHistory.filter(h => h.success).length;
    const successRate = successCount / relevantHistory.length;

    // Calculate helpfulness rate
    const helpfulCount = relevantHistory.filter(
      h => h.relevanceFeedback === 'helpful'
    ).length;
    const helpfulRate = relevantHistory.some(h => h.relevanceFeedback)
      ? helpfulCount / relevantHistory.filter(h => h.relevanceFeedback).length
      : 0.5;

    // Combine rates
    return 1.0 + successRate * 0.2 + helpfulRate * 0.2;
  }

  // ===========================================================================
  // Filtering Methods
  // ===========================================================================

  /**
   * Get candidate tools based on intent
   */
  private getCandidateTools(
    intent: ParsedIntent,
    context?: AgentContext,
    options: RetrievalOptions = {}
  ): ToolSpec[] {
    // Start with all tools or filtered by category
    let candidates: ToolSpec[];

    if (intent.relevantCategories.length > 0) {
      // Get tools from relevant categories
      const categoryTools = new Set<ToolSpec>();
      for (const category of intent.relevantCategories) {
        for (const tool of this.registry.getByCategory(category)) {
          categoryTools.add(tool);
        }
      }
      candidates = Array.from(categoryTools);
    } else if (this.config.includedCategories.length > 0) {
      // Use configured included categories
      const categoryTools = new Set<ToolSpec>();
      for (const category of this.config.includedCategories) {
        for (const tool of this.registry.getByCategory(category)) {
          categoryTools.add(tool);
        }
      }
      candidates = Array.from(categoryTools);
    } else {
      // Get all non-deprecated tools
      candidates = this.registry.getAll(!options.includeDeprecated);
    }

    // Filter by excluded categories
    if (this.config.excludedCategories.length > 0) {
      candidates = candidates.filter(
        tool => !this.config.excludedCategories.includes(tool.category)
      );
    }

    // Filter by excluded tool IDs
    if (options.excludedToolIds?.length) {
      const excludedSet = new Set(options.excludedToolIds);
      candidates = candidates.filter(tool => !excludedSet.has(tool.id));
    }

    // Add capability-matched tools
    if (intent.requiredCapabilities.length > 0) {
      const capabilityTools = this.registry.search({
        capabilities: intent.requiredCapabilities,
        includeDeprecated: options.includeDeprecated,
      });

      // Merge without duplicates
      const candidateIds = new Set(candidates.map(t => t.id));
      for (const tool of capabilityTools) {
        if (!candidateIds.has(tool.id)) {
          candidates.push(tool);
        }
      }
    }

    return candidates;
  }

  /**
   * Filter tools by permission requirements
   */
  private filterByPermissions(
    tools: RetrievedTool[],
    context?: AgentContext,
    options: RetrievalOptions = {}
  ): RetrievedTool[] {
    if (
      options.bypassPermissions ||
      this.config.permissionMode === 'disabled'
    ) {
      return tools;
    }

    if (!context) {
      // No context means no permission filtering
      return tools;
    }

    const agentPermissions = new Set(context.permissions);

    return tools.filter(({ tool }) => {
      if (this.config.permissionMode === 'strict') {
        // All permissions must match
        return tool.permissions.every(p => agentPermissions.has(p));
      } else {
        // Lenient: at least one permission match or no permissions required
        return (
          tool.permissions.length === 0 ||
          tool.permissions.some(p => agentPermissions.has(p))
        );
      }
    });
  }

  /**
   * Apply token budget and max tools constraints
   */
  private applyBudgetConstraints(
    tools: RetrievedTool[],
    maxTools: number,
    maxBudget: number
  ): RetrievedTool[] {
    const result: RetrievedTool[] = [];
    let totalTokens = 0;

    for (const scoredTool of tools) {
      if (result.length >= maxTools) {
        break;
      }

      if (totalTokens + scoredTool.tool.tokenCost > maxBudget) {
        continue; // Skip this tool but check others
      }

      result.push(scoredTool);
      totalTokens += scoredTool.tool.tokenCost;
    }

    return result;
  }

  // ===========================================================================
  // Embedding Methods
  // ===========================================================================

  /**
   * Get or compute embedding for a tool
   */
  private async getToolEmbedding(tool: ToolSpec): Promise<number[] | null> {
    const cacheKey = `tool:${tool.id}:${tool.metadata.updatedAt.toISOString()}`;

    if (this.embeddings.has(cacheKey)) {
      return this.embeddings.get(cacheKey)!;
    }

    // Generate text representation of tool
    const toolText = this.toolToText(tool);

    // Compute embedding (simplified - in production, use actual embedding model)
    const embedding = this.computeSimpleEmbedding(toolText);

    this.embeddings.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * Get or compute embedding for a query
   */
  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    const cacheKey = `query:${query}`;

    if (this.embeddings.has(cacheKey)) {
      return this.embeddings.get(cacheKey)!;
    }

    const embedding = this.computeSimpleEmbedding(query);
    this.embeddings.set(cacheKey, embedding);

    return embedding;
  }

  /**
   * Convert tool to text representation for embedding
   */
  private toolToText(tool: ToolSpec): string {
    return [
      tool.name,
      tool.description,
      tool.capabilities.join(' '),
      tool.keywords.join(' '),
      tool.category,
    ].join(' ');
  }

  /**
   * Compute simple bag-of-words embedding
   * In production, replace with actual embedding model from rag-utils
   */
  private computeSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const dimension = 128;
    const embedding = new Array(dimension).fill(0);

    for (const word of words) {
      // Simple hash-based embedding
      for (let i = 0; i < word.length; i++) {
        const charCode = word.charCodeAt(i);
        const index = (charCode * (i + 1)) % dimension;
        embedding[index] += 1 / words.length;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  // ===========================================================================
  // Caching Methods
  // ===========================================================================

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult(
    query: string,
    context?: AgentContext
  ): ToolRetrievalResult | null {
    const queryHash = this.hashQuery(query, context);
    const entry = this.cache.get(queryHash);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.config.cacheTtlMs) {
      this.cache.delete(queryHash);
      return null;
    }

    return {
      ...entry.result,
      metadata: {
        ...entry.result.metadata,
        cacheHit: true,
      },
    };
  }

  /**
   * Cache a retrieval result
   */
  private cacheResult(
    query: string,
    context: AgentContext | undefined,
    result: ToolRetrievalResult
  ): void {
    const queryHash = this.hashQuery(query, context);

    this.cache.set(queryHash, {
      result,
      timestamp: Date.now(),
      queryHash,
    });

    // Cleanup old entries if cache is too large
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Hash query and context for cache key
   */
  private hashQuery(query: string, context?: AgentContext): string {
    const contextKey = context
      ? `${context.agentId}:${context.permissions.join(',')}:${context.taskContext?.taskType || ''}`
      : 'no-context';

    return `${query.toLowerCase().trim()}:${contextKey}`;
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.config.cacheTtlMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    this.emit('cache:invalidated', { count: expiredKeys.length });
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.emit('cache:invalidated', { count });
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Generate human-readable match reasons
   */
  private generateMatchReasons(
    tool: ToolSpec,
    intent: ParsedIntent,
    scores: {
      semanticScore: number;
      keywordScore: number;
      permissionScore: number;
      categoryScore: number;
    }
  ): string[] {
    const reasons: string[] = [];

    if (scores.semanticScore > 0.7) {
      reasons.push('High semantic similarity');
    }

    if (scores.keywordScore > 0.5) {
      const matchingKeywords = tool.keywords.filter(k =>
        intent.keywords.includes(k.toLowerCase())
      );
      if (matchingKeywords.length > 0) {
        reasons.push(`Keywords: ${matchingKeywords.slice(0, 3).join(', ')}`);
      }
    }

    if (intent.relevantCategories.includes(tool.category)) {
      reasons.push(`Category: ${tool.category}`);
    }

    const matchingCaps = tool.capabilities.filter(c =>
      intent.requiredCapabilities.includes(c)
    );
    if (matchingCaps.length > 0) {
      reasons.push(`Capabilities: ${matchingCaps.slice(0, 3).join(', ')}`);
    }

    if (scores.permissionScore === 1.0 && tool.permissions.length > 0) {
      reasons.push('Full permission match');
    }

    return reasons;
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<JITToolConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache(); // Clear cache when config changes
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): JITToolConfig {
    return { ...this.config };
  }
}

/**
 * Create a JIT tool retriever with default configuration
 *
 * @param registry - Tool registry
 * @param config - Optional configuration
 * @returns JITToolRetriever instance
 */
export function createToolRetriever(
  registry: ToolRegistry,
  config?: Partial<JITToolConfig>
): JITToolRetriever {
  return new JITToolRetriever(registry, config);
}
