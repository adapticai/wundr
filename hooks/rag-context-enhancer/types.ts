/**
 * RAG Context Enhancer Hook Type Definitions
 *
 * @module hooks/rag-context-enhancer/types
 */

/**
 * Context goal type for categorizing the intent of the request
 */
export type ContextGoal =
  | 'understanding' // User wants to understand code/architecture
  | 'implementation' // User wants to implement a feature
  | 'refactoring' // User wants to refactor code
  | 'debugging' // User wants to debug an issue
  | 'migration' // User wants to migrate/upgrade code
  | 'documentation' // User wants to create/update docs
  | 'testing' // User wants to write/fix tests
  | 'analysis' // User wants to analyze codebase
  | 'search'; // User wants to find specific code

/**
 * Pattern match result from request analysis
 */
export interface PatternMatch {
  /** The type of pattern matched */
  readonly type: 'question' | 'action' | 'complexity';
  /** The specific pattern that matched */
  readonly pattern: string;
  /** The regex pattern used */
  readonly regex: RegExp;
  /** The matched text from the request */
  readonly match: string;
  /** Confidence score for this match (0-1) */
  readonly confidence: number;
}

/**
 * Generated RAG query from analysis
 */
export interface GeneratedQuery {
  /** The search query text */
  readonly query: string;
  /** Weight for this query in results (0-1) */
  readonly weight: number;
  /** Category label for organizing results */
  readonly category: string;
  /** Source pattern that generated this query */
  readonly sourcePattern?: string;
}

/**
 * Result from analyzing a request
 */
export interface AnalysisResult {
  /** Whether RAG context is recommended */
  readonly shouldEnhance: boolean;
  /** Confidence level for the recommendation (0-1) */
  readonly confidence: number;
  /** Detected context goal */
  readonly contextGoal: ContextGoal;
  /** Generated queries for RAG search */
  readonly queries: readonly GeneratedQuery[];
  /** Pattern matches that triggered enhancement */
  readonly matches: readonly PatternMatch[];
  /** Extracted entities from the request */
  readonly entities: RequestEntities;
  /** Suggested file patterns to search */
  readonly suggestedPatterns?: readonly string[];
  /** Explanation for the analysis decision */
  readonly reasoning: string;
}

/**
 * Entities extracted from a request
 */
export interface RequestEntities {
  /** Function or method names mentioned */
  readonly functions: readonly string[];
  /** Class or type names mentioned */
  readonly classes: readonly string[];
  /** File paths mentioned */
  readonly files: readonly string[];
  /** Module or package names mentioned */
  readonly modules: readonly string[];
  /** Technical terms or keywords */
  readonly keywords: readonly string[];
  /** Variable names mentioned */
  readonly variables: readonly string[];
}

/**
 * Pattern configuration for triggering RAG enhancement
 */
export interface TriggerPattern {
  /** Unique identifier for this pattern */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Regex pattern to match */
  readonly pattern: RegExp;
  /** Pattern type classification */
  readonly type: 'question' | 'action' | 'complexity';
  /** Weight for this pattern (0-1) */
  readonly weight: number;
  /** Context goal this pattern suggests */
  readonly suggestedGoal: ContextGoal;
  /** Query templates to use when this pattern matches */
  readonly queryTemplates?: readonly string[];
}

/**
 * Search configuration for RAG queries
 */
export interface SearchConfig {
  /** Maximum number of results per query */
  readonly maxResults: number;
  /** Minimum relevance score threshold */
  readonly minRelevanceScore: number;
  /** Maximum total tokens for context */
  readonly maxContextTokens: number;
  /** File patterns to include */
  readonly includePatterns: readonly string[];
  /** File patterns to exclude */
  readonly excludePatterns: readonly string[];
  /** Prioritization strategy */
  readonly prioritization: 'relevance' | 'recency' | 'diversity' | 'coverage';
  /** Whether to deduplicate results */
  readonly deduplicate: boolean;
  /** Maximum chunks per file */
  readonly maxChunksPerFile: number;
}

/**
 * Priority settings for the hook
 */
export interface PrioritySettings {
  /** Minimum confidence to trigger enhancement */
  readonly minConfidenceThreshold: number;
  /** Weights for different pattern types */
  readonly patternWeights: {
    readonly question: number;
    readonly action: number;
    readonly complexity: number;
  };
  /** Boost factor for multiple pattern matches */
  readonly multiMatchBoost: number;
  /** Maximum queries to generate */
  readonly maxQueries: number;
}

/**
 * Main configuration for the RAG context enhancer hook
 */
export interface RagContextHookConfig {
  /** Whether the hook is enabled */
  readonly enabled: boolean;
  /** Hook name identifier */
  readonly name: string;
  /** Hook description */
  readonly description: string;
  /** Version of the hook configuration */
  readonly version: string;
  /** Trigger patterns for question types */
  readonly questionPatterns: readonly TriggerPattern[];
  /** Trigger patterns for action types */
  readonly actionPatterns: readonly TriggerPattern[];
  /** Trigger patterns for complexity indicators */
  readonly complexityPatterns: readonly TriggerPattern[];
  /** Default search configuration */
  readonly defaultSearchConfig: SearchConfig;
  /** Priority settings */
  readonly priority: PrioritySettings;
  /** Cache configuration */
  readonly cache?: CacheConfig;
  /** Logging configuration */
  readonly logging?: LoggingConfig;
}

/**
 * Cache configuration for the hook
 */
export interface CacheConfig {
  /** Whether caching is enabled */
  readonly enabled: boolean;
  /** Time-to-live for cache entries in milliseconds */
  readonly ttlMs: number;
  /** Maximum number of cached entries */
  readonly maxEntries: number;
}

/**
 * Logging configuration for the hook
 */
export interface LoggingConfig {
  /** Logging level */
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to log pattern matches */
  readonly logMatches: boolean;
  /** Whether to log generated queries */
  readonly logQueries: boolean;
  /** Whether to log timing information */
  readonly logTiming: boolean;
}

/**
 * Hook context passed to the RAG context enhancer
 */
export interface HookContext {
  /** The original user request text */
  readonly request: string;
  /** Target path for the operation */
  readonly targetPath: string;
  /** Current session ID if available */
  readonly sessionId?: string;
  /** Task ID if available */
  readonly taskId?: string;
  /** Previous context from the conversation */
  readonly previousContext?: string;
  /** Metadata about the current session */
  readonly metadata?: HookMetadata;
}

/**
 * Metadata about the hook execution context
 */
export interface HookMetadata {
  /** Timestamp when the hook was triggered */
  readonly timestamp: string;
  /** Source of the request (e.g., 'cli', 'api', 'mcp') */
  readonly source?: string;
  /** User or agent identifier */
  readonly userId?: string;
  /** Agent type if applicable */
  readonly agentType?: string;
  /** Additional custom metadata */
  readonly custom?: Record<string, unknown>;
}

/**
 * Result of hook execution
 */
export interface HookExecutionResult {
  /** Whether the hook executed successfully */
  readonly success: boolean;
  /** The analysis result */
  readonly analysis: AnalysisResult;
  /** Enhanced context if generated */
  readonly enhancedContext?: EnhancedContext;
  /** Error message if failed */
  readonly error?: string;
  /** Execution timing in milliseconds */
  readonly executionTimeMs: number;
  /** Whether context was injected */
  readonly contextInjected: boolean;
}

/**
 * Enhanced context generated by the hook
 */
export interface EnhancedContext {
  /** The formatted context string ready for injection */
  readonly context: string;
  /** Individual context sections by source */
  readonly sections: readonly ContextSection[];
  /** Summary of the context */
  readonly summary: string;
  /** Token count of the context */
  readonly tokenCount: number;
  /** Sources used to build the context */
  readonly sources: readonly string[];
  /** Relevance map by file path */
  readonly relevanceMap: Record<string, number>;
}

/**
 * A section of enhanced context from a specific source
 */
export interface ContextSection {
  /** Source file path */
  readonly filePath: string;
  /** Content of this section */
  readonly content: string;
  /** Relevance score */
  readonly relevanceScore: number;
  /** Line range covered */
  readonly lineRange: {
    readonly start: number;
    readonly end: number;
  };
  /** Queries that matched this section */
  readonly matchedQueries: readonly string[];
  /** Token count for this section */
  readonly tokenCount: number;
}

/**
 * RAG service interface for searching and retrieving context
 */
export interface IRagService {
  /**
   * Search for relevant context based on queries
   */
  search(
    queries: readonly GeneratedQuery[],
    targetPath: string,
    config: SearchConfig
  ): Promise<EnhancedContext>;

  /**
   * Check if a path is indexed
   */
  isIndexed(path: string): Promise<boolean>;

  /**
   * Index a path for RAG search
   */
  indexPath(path: string): Promise<void>;
}
