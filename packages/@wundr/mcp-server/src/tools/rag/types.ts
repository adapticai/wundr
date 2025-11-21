/**
 * RAG (Retrieval Augmented Generation) Type Definitions and Zod Schemas
 *
 * @module @wundr/mcp-server/tools/rag/types
 */

import { z } from 'zod';

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

/**
 * Chunking strategy for splitting files into searchable segments
 */
export const ChunkingStrategySchema = z.enum([
  'semantic',
  'fixed',
  'paragraph',
  'sentence',
  'code-aware',
]);

/**
 * Configuration for how files are chunked for indexing
 */
export const ChunkingConfigSchema = z.object({
  strategy: ChunkingStrategySchema.optional().default('semantic')
    .describe('Chunking strategy to use'),
  chunkSize: z.number().min(100).max(10000).optional().default(1000)
    .describe('Target chunk size in tokens'),
  chunkOverlap: z.number().min(0).max(500).optional().default(200)
    .describe('Overlap between chunks in tokens'),
  minChunkSize: z.number().min(50).optional().default(100)
    .describe('Minimum chunk size in tokens'),
  maxChunksPerFile: z.number().optional().default(100)
    .describe('Maximum chunks per file'),
  preserveCodeBlocks: z.boolean().optional().default(true)
    .describe('Keep code blocks intact when chunking'),
  respectBoundaries: z.boolean().optional().default(true)
    .describe('Respect function/class boundaries in code files'),
});

/**
 * Metadata filter operators for querying
 */
export const MetadataFilterOperatorSchema = z.enum([
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'startsWith', 'endsWith',
]);

/**
 * Single metadata filter condition
 */
export const MetadataFilterConditionSchema = z.object({
  field: z.string().describe('Metadata field to filter on'),
  operator: MetadataFilterOperatorSchema.describe('Comparison operator'),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]).describe('Value to compare against'),
});

/**
 * Compound metadata filter with logical operators
 */
export interface ZodMetadataFilter {
  and?: ZodMetadataFilter[];
  or?: ZodMetadataFilter[];
  not?: ZodMetadataFilter;
  condition?: z.infer<typeof MetadataFilterConditionSchema>;
}

export const ZodMetadataFilterSchema: z.ZodType<ZodMetadataFilter> = z.object({
  and: z.array(z.lazy(() => ZodMetadataFilterSchema)).optional()
    .describe('All conditions must match'),
  or: z.array(z.lazy(() => ZodMetadataFilterSchema)).optional()
    .describe('Any condition must match'),
  not: z.lazy(() => ZodMetadataFilterSchema).optional()
    .describe('Condition must not match'),
  condition: MetadataFilterConditionSchema.optional()
    .describe('Single filter condition'),
});

/**
 * Prioritization strategy for context building
 */
export const PrioritizationStrategySchema = z.enum([
  'relevance',
  'recency',
  'diversity',
  'coverage',
  'frequency',
]);

/**
 * Index status for a RAG store
 */
export const IndexStatusSchema = z.enum([
  'idle',
  'indexing',
  'syncing',
  'error',
  'stale',
]);

/**
 * Store operations
 */
export const StoreOperationSchema = z.enum([
  'create',
  'list',
  'get',
  'delete',
  'sync',
  'status',
  'optimize',
  'export',
  'import',
]);

// =============================================================================
// RAG File Search Zod Schemas
// =============================================================================

/**
 * Input schema for rag_file_search tool
 */
export const RagFileSearchInputSchema = z.object({
  targetPath: z.string().describe('Root directory path to search in'),
  query: z.string().min(1).describe('Search query (natural language or keywords)'),
  includePatterns: z.array(z.string()).optional().default(['**/*'])
    .describe('Glob patterns for files to include'),
  excludePatterns: z.array(z.string()).optional().default(['**/node_modules/**', '**/dist/**', '**/.git/**'])
    .describe('Glob patterns for files to exclude'),
  fileTypes: z.array(z.string()).optional()
    .describe('Specific file extensions to search'),
  storeName: z.string().optional()
    .describe('Name of the RAG store to use'),
  forceReindex: z.boolean().optional().default(false)
    .describe('Force reindexing even if index exists'),
  chunkingConfig: ChunkingConfigSchema.optional()
    .describe('Custom chunking configuration'),
  metadataFilter: ZodMetadataFilterSchema.optional()
    .describe('Filter results by metadata'),
  maxResults: z.number().min(1).max(100).optional().default(10)
    .describe('Maximum number of results to return'),
  minRelevanceScore: z.number().min(0).max(1).optional().default(0.5)
    .describe('Minimum relevance score threshold'),
  includeContent: z.boolean().optional().default(true)
    .describe('Include full chunk content in results'),
  includeCitations: z.boolean().optional().default(true)
    .describe('Include citation information'),
});

/**
 * Citation schema
 */
export const CitationZodSchema = z.object({
  filePath: z.string().describe('Path to the cited file'),
  startLine: z.number().describe('Starting line of citation'),
  endLine: z.number().describe('Ending line of citation'),
  snippet: z.string().describe('Text snippet for the citation'),
  context: z.string().optional().describe('Surrounding context'),
});

/**
 * Matched chunk schema
 */
export const MatchedChunkZodSchema = z.object({
  chunkId: z.string().describe('ID of the matched chunk'),
  content: z.string().describe('Content of the matched chunk'),
  score: z.number().min(0).max(1).describe('Relevance score for this chunk'),
  highlights: z.array(z.object({
    start: z.number(),
    end: z.number(),
    text: z.string(),
  })).optional().describe('Highlighted matches within the chunk'),
  startLine: z.number().describe('Starting line in source file'),
  endLine: z.number().describe('Ending line in source file'),
});

/**
 * Search result schema
 */
export const SearchResultZodSchema = z.object({
  filePath: z.string().describe('Path to the matched file'),
  relevanceScore: z.number().min(0).max(1).describe('Overall relevance score'),
  matchedChunks: z.array(MatchedChunkZodSchema).describe('Chunks that matched the query'),
  citations: z.array(CitationZodSchema).describe('Citation references for this result'),
  fileMetadata: z.object({
    size: z.number().describe('File size in bytes'),
    lastModified: z.string().describe('Last modification timestamp'),
    language: z.string().optional().describe('Detected programming language'),
    lineCount: z.number().optional().describe('Total lines in file'),
  }).optional().describe('Metadata about the source file'),
  summary: z.string().optional().describe('AI-generated summary of relevance'),
});

/**
 * Output schema for rag_file_search tool
 */
export const RagFileSearchOutputSchema = z.object({
  results: z.array(SearchResultZodSchema).describe('Search results ranked by relevance'),
  summary: z.string().describe('AI-generated summary of search results'),
  storeName: z.string().describe('Name of the RAG store used'),
  indexedFileCount: z.number().describe('Number of files in the index'),
  totalChunks: z.number().describe('Total chunks in the index'),
  searchMetrics: z.object({
    queryTimeMs: z.number().describe('Query execution time in milliseconds'),
    totalMatches: z.number().describe('Total number of matches before limiting'),
    indexStatus: IndexStatusSchema.describe('Current index status'),
  }).describe('Search performance metrics'),
  suggestions: z.array(z.string()).optional()
    .describe('Suggested related queries'),
});

// =============================================================================
// RAG Store Manage Zod Schemas
// =============================================================================

/**
 * Input schema for rag_store_manage tool
 */
export const RagStoreManageInputSchema = z.object({
  operation: StoreOperationSchema.describe('Management operation to perform'),
  storeName: z.string().optional()
    .describe('Store name (required for get, delete, sync, status, optimize)'),
  targetPath: z.string().optional()
    .describe('Root path for the store (required for create)'),
  includePatterns: z.array(z.string()).optional()
    .describe('Glob patterns for files to include (for create)'),
  excludePatterns: z.array(z.string()).optional()
    .describe('Glob patterns for files to exclude (for create)'),
  fileTypes: z.array(z.string()).optional()
    .describe('File extensions to index (for create)'),
  chunkingConfig: ChunkingConfigSchema.optional()
    .describe('Chunking configuration (for create)'),
  force: z.boolean().optional().default(false)
    .describe('Force operation'),
  exportPath: z.string().optional()
    .describe('Path for export operation'),
  importPath: z.string().optional()
    .describe('Path for import operation'),
});

/**
 * Store list item schema
 */
export const StoreListItemSchema = z.object({
  name: z.string(),
  targetPath: z.string(),
  status: IndexStatusSchema,
  fileCount: z.number(),
  chunkCount: z.number(),
  lastIndexed: z.string().optional(),
  sizeBytes: z.number(),
});

/**
 * RAG store schema
 */
export const RagStoreZodSchema = z.object({
  name: z.string().describe('Unique store name'),
  targetPath: z.string().describe('Root path being indexed'),
  createdAt: z.string().describe('Store creation timestamp'),
  updatedAt: z.string().describe('Last update timestamp'),
  lastIndexedAt: z.string().optional().describe('Last full index timestamp'),
  status: IndexStatusSchema.describe('Current index status'),
  config: z.object({
    includePatterns: z.array(z.string()).describe('Glob patterns for files to include'),
    excludePatterns: z.array(z.string()).describe('Glob patterns for files to exclude'),
    fileTypes: z.array(z.string()).optional().describe('Specific file extensions to index'),
    chunking: ChunkingConfigSchema.describe('Chunking configuration'),
    maxFileSizeMb: z.number().optional().default(10).describe('Maximum file size to index in MB'),
    followSymlinks: z.boolean().optional().default(false).describe('Follow symbolic links'),
  }).describe('Store configuration'),
  stats: z.object({
    totalFiles: z.number().describe('Total number of indexed files'),
    totalChunks: z.number().describe('Total number of chunks'),
    totalTokens: z.number().describe('Total tokens indexed'),
    indexSizeBytes: z.number().describe('Index size in bytes'),
    avgChunkSize: z.number().describe('Average chunk size in tokens'),
    languageDistribution: z.record(z.number()).optional().describe('Files per language'),
  }).describe('Index statistics'),
  version: z.string().describe('Index format version'),
});

/**
 * Sync result schema
 */
export const SyncResultZodSchema = z.object({
  filesAdded: z.number(),
  filesUpdated: z.number(),
  filesRemoved: z.number(),
  chunksAdded: z.number(),
  chunksRemoved: z.number(),
  durationMs: z.number(),
});

/**
 * Optimize result schema
 */
export const OptimizeResultZodSchema = z.object({
  beforeSizeBytes: z.number(),
  afterSizeBytes: z.number(),
  chunksCompacted: z.number(),
  durationMs: z.number(),
});

/**
 * Output schema for rag_store_manage tool
 */
export const RagStoreManageOutputSchema = z.object({
  success: z.boolean().describe('Whether the operation succeeded'),
  operation: StoreOperationSchema.describe('Operation that was performed'),
  message: z.string().describe('Human-readable result message'),
  store: RagStoreZodSchema.optional().describe('Store details'),
  stores: z.array(StoreListItemSchema).optional().describe('List of stores'),
  deletedStore: z.string().optional().describe('Name of deleted store'),
  syncResult: SyncResultZodSchema.optional().describe('Sync operation results'),
  optimizeResult: OptimizeResultZodSchema.optional().describe('Optimize operation results'),
  exportPath: z.string().optional().describe('Export file path'),
});

// =============================================================================
// RAG Context Builder Zod Schemas
// =============================================================================

/**
 * Weighted query schema
 */
export const WeightedQuerySchema = z.object({
  query: z.string().describe('Search query'),
  weight: z.number().min(0).max(1).optional().default(1)
    .describe('Query importance weight (0-1)'),
  category: z.string().optional()
    .describe('Category label for organizing results'),
});

/**
 * Input schema for rag_context_builder tool
 */
export const RagContextBuilderInputSchema = z.object({
  queries: z.array(z.union([z.string(), WeightedQuerySchema]))
    .min(1)
    .describe('Search queries (strings or weighted query objects)'),
  targetPath: z.string().describe('Root directory path to search in'),
  contextGoal: z.string().optional()
    .describe('High-level description of what context is needed for'),
  maxContextTokens: z.number().min(1000).max(100000).optional().default(8000)
    .describe('Maximum tokens to include in context'),
  prioritization: PrioritizationStrategySchema.optional().default('relevance')
    .describe('Strategy for prioritizing results'),
  storeName: z.string().optional()
    .describe('RAG store to use'),
  includePatterns: z.array(z.string()).optional()
    .describe('Glob patterns for files to include'),
  excludePatterns: z.array(z.string()).optional()
    .describe('Glob patterns for files to exclude'),
  deduplication: z.boolean().optional().default(true)
    .describe('Remove duplicate content across queries'),
  includeFileHeaders: z.boolean().optional().default(true)
    .describe('Include file path headers in context'),
  groupByFile: z.boolean().optional().default(true)
    .describe('Group related chunks by file'),
  maxChunksPerFile: z.number().min(1).max(50).optional().default(5)
    .describe('Maximum chunks to include per file'),
  minRelevanceScore: z.number().min(0).max(1).optional().default(0.4)
    .describe('Minimum relevance score for inclusion'),
});

/**
 * Context section schema
 */
export const ContextSectionSchema = z.object({
  filePath: z.string().describe('Source file path'),
  relevanceScore: z.number().describe('Overall relevance for this file'),
  content: z.string().describe('Consolidated content from this file'),
  tokenCount: z.number().describe('Token count for this section'),
  lineRange: z.object({
    start: z.number(),
    end: z.number(),
  }).describe('Line range covered'),
  matchedQueries: z.array(z.string()).describe('Queries that matched this file'),
});

/**
 * Context suggestions schema
 */
export const ContextSuggestionsSchema = z.object({
  additionalQueries: z.array(z.string()).optional()
    .describe('Suggested additional queries'),
  missingContext: z.array(z.string()).optional()
    .describe('Potentially missing context areas'),
  refinements: z.array(z.string()).optional()
    .describe('Suggested query refinements'),
});

/**
 * Output schema for rag_context_builder tool
 */
export const RagContextBuilderOutputSchema = z.object({
  context: z.string().describe('Consolidated context string ready for use'),
  sections: z.array(ContextSectionSchema)
    .describe('Individual context sections by file'),
  summary: z.string().describe('AI-generated summary of the context'),
  metadata: z.object({
    totalTokens: z.number().describe('Total tokens in context'),
    totalFiles: z.number().describe('Number of files included'),
    totalChunks: z.number().describe('Number of chunks included'),
    queriesProcessed: z.number().describe('Number of queries processed'),
    deduplicatedChunks: z.number().describe('Chunks removed due to deduplication'),
    truncatedFiles: z.number().describe('Files that hit the per-file chunk limit'),
  }).describe('Context building metadata'),
  relevanceMap: z.record(z.number()).describe('Relevance scores by file path'),
  suggestions: ContextSuggestionsSchema.optional()
    .describe('Suggestions for improving context'),
});

/**
 * File chunk schema
 */
export const FileChunkSchema = z.object({
  id: z.string().describe('Unique identifier for the chunk'),
  filePath: z.string().describe('Source file path'),
  content: z.string().describe('Chunk content text'),
  startLine: z.number().describe('Starting line number in source file'),
  endLine: z.number().describe('Ending line number in source file'),
  startChar: z.number().describe('Starting character offset'),
  endChar: z.number().describe('Ending character offset'),
  tokenCount: z.number().describe('Number of tokens in chunk'),
  embedding: z.array(z.number()).optional().describe('Vector embedding if computed'),
  metadata: z.record(z.unknown()).optional().describe('Additional chunk metadata'),
  language: z.string().optional().describe('Detected programming language'),
  symbols: z.array(z.string()).optional().describe('Code symbols defined in this chunk'),
  imports: z.array(z.string()).optional().describe('Import statements in this chunk'),
  exports: z.array(z.string()).optional().describe('Export statements in this chunk'),
  createdAt: z.string().describe('When the chunk was indexed'),
  updatedAt: z.string().describe('When the chunk was last updated'),
});

// =============================================================================
// Schema Registry Exports for ToolSchemas
// =============================================================================

/**
 * RAG tool schemas for registration in ToolSchemas registry
 */
export const RagFileSearchSchema = RagFileSearchInputSchema;
export const RagStoreManageSchema = RagStoreManageInputSchema;
export const RagContextBuilderSchema = RagContextBuilderInputSchema;

/**
 * RAG tool registry entries
 */
export const RagToolSchemas = {
  'rag-file-search': {
    schema: RagFileSearchSchema,
    description: 'Search files using RAG (Retrieval-Augmented Generation) with semantic understanding',
    category: 'rag',
  },
  'rag-store-manage': {
    schema: RagStoreManageSchema,
    description: 'Manage RAG vector stores for file indexing and search',
    category: 'rag',
  },
  'rag-context-builder': {
    schema: RagContextBuilderSchema,
    description: 'Build consolidated context from multiple queries for AI consumption',
    category: 'rag',
  },
} as const;

export type RagToolName = keyof typeof RagToolSchemas;

// =============================================================================
// Zod Inferred Types
// =============================================================================

export type RagFileSearchInputType = z.infer<typeof RagFileSearchInputSchema>;
export type RagFileSearchOutputType = z.infer<typeof RagFileSearchOutputSchema>;
export type RagStoreManageInputType = z.infer<typeof RagStoreManageInputSchema>;
export type RagStoreManageOutputType = z.infer<typeof RagStoreManageOutputSchema>;
export type RagContextBuilderInputType = z.infer<typeof RagContextBuilderInputSchema>;
export type RagContextBuilderOutputType = z.infer<typeof RagContextBuilderOutputSchema>;
export type FileChunkType = z.infer<typeof FileChunkSchema>;
export type StoreListItemType = z.infer<typeof StoreListItemSchema>;
export type RagStoreType = z.infer<typeof RagStoreZodSchema>;
export type ContextSectionType = z.infer<typeof ContextSectionSchema>;
export type WeightedQueryType = z.infer<typeof WeightedQuerySchema>;

// =============================================================================
// Store Types (Legacy TypeScript Interfaces)
// =============================================================================

/**
 * RAG Store metadata
 */
export interface RAGStore {
  /** Unique store identifier (corpus name in Gemini) */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Store creation timestamp */
  createdAt: string;
  /** Last sync timestamp */
  lastSyncAt?: string;
  /** Number of files indexed */
  fileCount: number;
  /** Number of chunks created */
  chunkCount: number;
  /** Total size in bytes */
  sizeBytes: number;
  /** Store status */
  status: StoreStatus;
  /** Configuration used for this store */
  config?: StoreConfig;
}

/**
 * Store status enumeration
 */
export type StoreStatus = 'active' | 'indexing' | 'error' | 'deleted' | 'syncing';

/**
 * Store configuration options
 */
export interface StoreConfig {
  /** Chunk size for text splitting */
  chunkSize?: number;
  /** Overlap between chunks */
  chunkOverlap?: number;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Embedding model to use */
  embeddingModel?: string;
}

/**
 * Default store configuration
 */
export const DEFAULT_STORE_CONFIG: Required<StoreConfig> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  includePatterns: ['**/*.ts', '**/*.js', '**/*.md', '**/*.json'],
  excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  maxFileSize: 1024 * 1024, // 1MB
  embeddingModel: 'text-embedding-004',
};

// =============================================================================
// File Types
// =============================================================================

/**
 * File metadata for indexed documents
 */
export interface IndexedFile {
  /** File path relative to store root */
  path: string;
  /** File hash for change detection */
  hash: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified timestamp */
  lastModified: string;
  /** Indexing timestamp */
  indexedAt: string;
  /** Number of chunks created from this file */
  chunkCount: number;
  /** File MIME type */
  mimeType?: string;
}

/**
 * File change types for sync operations
 */
export type FileChangeType = 'added' | 'modified' | 'deleted' | 'unchanged';

/**
 * File change detection result
 */
export interface FileChange {
  path: string;
  changeType: FileChangeType;
  oldHash?: string;
  newHash?: string;
}

// =============================================================================
// Operation Types
// =============================================================================

/**
 * Store creation parameters
 */
export interface CreateStoreParams {
  /** Store identifier */
  id: string;
  /** Optional display name */
  displayName?: string;
  /** Optional configuration */
  config?: StoreConfig;
  /** Initial files to index */
  sourcePath?: string;
}

/**
 * Store sync parameters
 */
export interface SyncStoreParams {
  /** Store identifier */
  storeId: string;
  /** Source path to sync from */
  sourcePath: string;
  /** Force full reindex */
  forceReindex?: boolean;
  /** Delete removed files from index */
  deleteRemoved?: boolean;
}

/**
 * Store query parameters
 */
export interface QueryStoreParams {
  /** Store identifier */
  storeId: string;
  /** Query text */
  query: string;
  /** Maximum results to return */
  topK?: number;
  /** Minimum similarity score */
  minScore?: number;
  /** Filter by file patterns */
  fileFilter?: string[];
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Query result item
 */
export interface QueryResult {
  /** Document/chunk content */
  content: string;
  /** Source file path */
  sourcePath: string;
  /** Similarity score */
  score: number;
  /** Chunk metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  /** Number of files added */
  added: number;
  /** Number of files updated */
  updated: number;
  /** Number of files deleted */
  deleted: number;
  /** Number of files unchanged */
  unchanged: number;
  /** Total chunks indexed */
  totalChunks: number;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Errors encountered */
  errors?: Array<{ path: string; error: string }>;
}

/**
 * Store statistics
 */
export interface StoreStats {
  /** Store identifier */
  storeId: string;
  /** Total files indexed */
  totalFiles: number;
  /** Total chunks */
  totalChunks: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Average chunk size */
  avgChunkSize: number;
  /** File type breakdown */
  fileTypes: Record<string, number>;
  /** Last sync statistics */
  lastSync?: SyncResult;
  /** Store health status */
  health: StoreHealthStatus;
}

/**
 * Store health status
 */
export interface StoreHealthStatus {
  /** Overall health */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Individual health checks */
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
  }>;
  /** Last health check timestamp */
  lastCheckedAt: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Generic RAG operation response
 */
export interface RAGOperationResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Store list response
 */
export interface ListStoresResponse {
  stores: RAGStore[];
  totalCount: number;
}

/**
 * Store creation response
 */
export interface CreateStoreResponse {
  store: RAGStore;
  message: string;
}

/**
 * Store deletion response
 */
export interface DeleteStoreResponse {
  storeId: string;
  deleted: boolean;
  message: string;
}

// =============================================================================
// Action Types for MCP Tool
// =============================================================================

/**
 * RAG Store management actions
 */
export type RAGStoreAction = 'create' | 'list' | 'get' | 'delete' | 'sync' | 'status';

/**
 * RAG Store manage input parameters
 */
export interface RAGStoreManageInput {
  /** Action to perform */
  action: RAGStoreAction;
  /** Store identifier (for get, delete, sync, status) */
  storeId?: string;
  /** Display name (for create) */
  displayName?: string;
  /** Source path (for create, sync) */
  sourcePath?: string;
  /** Store configuration (for create) */
  config?: StoreConfig;
  /** Force reindex (for sync) */
  forceReindex?: boolean;
  /** Output format */
  format?: 'json' | 'table' | 'text';
}

// =============================================================================
// Context Builder Types
// =============================================================================

/**
 * Prioritization strategy for context building
 */
export type PrioritizationStrategy = 'relevance' | 'recency' | 'coverage';

/**
 * A single chunk of retrieved content from RAG search
 */
export interface RAGChunk {
  /** Unique identifier for the chunk */
  readonly id: string;
  /** The actual content text */
  readonly content: string;
  /** Source file or document path */
  readonly source: string;
  /** Relevance score from the search (0-1) */
  readonly score: number;
  /** Timestamp when the content was last modified */
  readonly timestamp?: Date;
  /** Line numbers if from a code file */
  readonly lineRange?: { start: number; end: number };
  /** Additional metadata about the chunk */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result from a single RAG search query
 */
export interface RAGSearchResult {
  /** The original query string */
  readonly query: string;
  /** Retrieved chunks matching the query */
  readonly chunks: readonly RAGChunk[];
  /** Total number of matches found */
  readonly totalMatches: number;
  /** Time taken for the search in milliseconds */
  readonly searchTimeMs: number;
  /** Any errors encountered during search */
  readonly error?: string;
}

/**
 * Array of RAG search results - for compatibility with array operations
 */
export type RAGSearchResults = RAGSearchResult[];

/**
 * Input parameters for the RAG context builder
 */
export interface RAGContextBuilderInput {
  /** Multiple search queries to execute */
  readonly queries: readonly string[];
  /** Target path/directory to search within */
  readonly targetPath: string;
  /** Goal description for context building */
  readonly contextGoal: string;
  /** Maximum tokens allowed in the built context */
  readonly maxContextTokens: number;
  /** Strategy for prioritizing results */
  readonly prioritization: PrioritizationStrategy;
  /** Optional file patterns to include */
  readonly includePatterns?: readonly string[];
  /** Optional file patterns to exclude */
  readonly excludePatterns?: readonly string[];
  /** Minimum relevance score threshold (0-1) */
  readonly minScore?: number;
}

/**
 * A consolidated context item after deduplication and prioritization
 */
export interface ConsolidatedContextItem {
  /** Unique identifier */
  readonly id: string;
  /** The content text */
  readonly content: string;
  /** Source file path */
  readonly source: string;
  /** Aggregated relevance score */
  readonly aggregatedScore: number;
  /** Queries that matched this content */
  readonly matchedQueries: readonly string[];
  /** Estimated token count for this item */
  readonly tokenCount: number;
  /** Timestamp for recency calculations */
  readonly timestamp?: Date;
  /** Line range in source file */
  readonly lineRange?: { start: number; end: number };
}

/**
 * Summary of the built context
 */
export interface ContextSummary {
  /** Total number of unique sources */
  readonly totalSources: number;
  /** Total token count used */
  readonly totalTokens: number;
  /** Breakdown by query of how many results were included */
  readonly queryBreakdown: Record<string, number>;
  /** Coverage score (0-1) indicating how well queries are covered */
  readonly coverageScore: number;
  /** Average relevance score of included items */
  readonly averageRelevance: number;
  /** Prioritization strategy used */
  readonly strategyUsed: PrioritizationStrategy;
}

/**
 * Output from the RAG context builder
 */
export interface RAGContextBuilderOutput {
  /** Whether the operation succeeded */
  readonly success: boolean;
  /** Consolidated and prioritized context items */
  readonly contextItems: readonly ConsolidatedContextItem[];
  /** Summary of the built context */
  readonly summary: ContextSummary;
  /** The formatted context ready for agent use */
  readonly formattedContext: string;
  /** Any warnings generated during processing */
  readonly warnings?: readonly string[];
  /** Error message if failed */
  readonly error?: string;
  /** Metadata about the operation */
  readonly metadata: {
    readonly totalSearchTimeMs: number;
    readonly processingTimeMs: number;
    readonly queriesExecuted: number;
    readonly chunksProcessed: number;
    readonly chunksIncluded: number;
    readonly tokenBudgetUsed: number;
    readonly tokenBudgetRemaining: number;
  };
}

// =============================================================================
// RAG Service Interface Types
// =============================================================================

/**
 * Configuration for RAG service
 */
export interface RAGServiceConfig {
  /** API key for the embedding service */
  readonly apiKey?: string;
  /** Model to use for embeddings */
  readonly embeddingModel?: string;
  /** Maximum chunks to return per query */
  readonly maxChunksPerQuery?: number;
  /** Default minimum score threshold */
  readonly defaultMinScore?: number;
  /** Cache configuration */
  readonly cache?: {
    readonly enabled: boolean;
    readonly ttlMs: number;
  };
}

/**
 * Search options for RAG queries
 */
export interface RAGSearchOptions {
  /** Maximum results to return (alias: topK) */
  readonly limit?: number;
  /** Maximum results to return (alias: limit) - for compatibility */
  readonly topK?: number;
  /** Minimum score threshold */
  readonly minScore?: number;
  /** File patterns to include */
  readonly includePatterns?: readonly string[];
  /** File patterns to exclude */
  readonly excludePatterns?: readonly string[];
  /** Whether to include content in results */
  readonly includeContent?: boolean;
}

/**
 * Interface for RAG service implementations
 */
export interface IRAGService {
  /**
   * Search for relevant content based on a query
   */
  search(
    query: string,
    targetPath: string,
    options?: RAGSearchOptions
  ): Promise<RAGSearchResult>;

  /**
   * Execute multiple searches in parallel
   */
  searchMultiple(
    queries: readonly string[],
    targetPath: string,
    options?: RAGSearchOptions
  ): Promise<readonly RAGSearchResult[]>;

  /**
   * Index a directory for search
   */
  indexDirectory(path: string): Promise<void>;

  /**
   * Check if a path is indexed
   */
  isIndexed(path: string): Promise<boolean>;
}

// =============================================================================
// Token Counting Types
// =============================================================================

/**
 * Token counting result
 */
export interface TokenCountResult {
  /** Number of tokens */
  readonly count: number;
  /** Method used for counting */
  readonly method: 'exact' | 'estimated';
}

/**
 * Token counter interface
 */
export interface ITokenCounter {
  /**
   * Count tokens in a string
   */
  count(text: string): TokenCountResult;

  /**
   * Estimate tokens without full counting
   */
  estimate(text: string): number;

  /**
   * Truncate text to fit within token limit
   */
  truncateToFit(text: string, maxTokens: number): string;
}

// =============================================================================
// RAG File Search Types
// =============================================================================

/**
 * Supported file type categories for filtering
 */
export type FileTypeCategory = 'code' | 'documentation' | 'config' | 'data' | 'all';

/**
 * Mapping of file type categories to extensions
 */
export const FILE_TYPE_EXTENSIONS: Record<FileTypeCategory, string[]> = {
  code: [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.pyi',
    '.java', '.kt', '.scala',
    '.go', '.rs',
    '.c', '.cpp', '.cc', '.h', '.hpp',
    '.cs', '.rb', '.php', '.swift',
    '.vue', '.svelte',
  ],
  documentation: [
    '.md', '.mdx', '.markdown',
    '.txt', '.text',
    '.rst', '.adoc',
    '.html', '.htm',
  ],
  config: [
    '.json', '.jsonc', '.json5',
    '.yaml', '.yml',
    '.toml', '.ini', '.cfg',
    '.env', '.env.local', '.env.example',
    '.xml', '.properties',
  ],
  data: ['.csv', '.tsv', '.sql', '.graphql', '.gql'],
  all: [], // Empty means all files
};

/**
 * Default file patterns to exclude
 */
export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock',
  '**/.DS_Store',
  '**/thumbs.db',
];

/**
 * Chunking strategy options
 */
export type ChunkingStrategy = 'fixed' | 'semantic' | 'paragraph' | 'sentence';

/**
 * Extended chunking configuration
 */
export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize?: number;
  maxChunksPerFile?: number;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  strategy: 'semantic',
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  maxChunksPerFile: 100,
};

/**
 * Metadata filter for search queries
 */
export interface MetadataFilter {
  /** File path contains this string */
  pathContains?: string;
  /** File extension filter */
  extension?: string | string[];
  /** File modified after this date */
  modifiedAfter?: string;
  /** File modified before this date */
  modifiedBefore?: string;
  /** Custom metadata key-value filters */
  custom?: Record<string, string | number | boolean>;
}

/**
 * RAG File Search input parameters
 */
export interface RagFileSearchInput {
  /** Target path to search (directory or file) */
  targetPath: string;
  /** Natural language search query */
  query: string;
  /** Glob patterns to include files */
  includePatterns?: string[];
  /** Glob patterns to exclude files */
  excludePatterns?: string[];
  /** File type categories to include */
  fileTypes?: FileTypeCategory[];
  /** Name for the RAG store (for caching/reuse) */
  storeName?: string;
  /** Force reindexing even if store exists */
  forceReindex?: boolean;
  /** Chunking configuration */
  chunkingConfig?: Partial<ChunkingConfig>;
  /** Metadata filters for search */
  metadataFilter?: MetadataFilter;
  /** Maximum number of results to return */
  maxResults?: number;
}

/**
 * Citation information for a search result
 */
export interface Citation {
  /** Source file path */
  filePath: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Column start position */
  startColumn?: number;
  /** Column end position */
  endColumn?: number;
  /** Highlighted snippet */
  snippet: string;
}

/**
 * A matched chunk from the search
 */
export interface MatchedChunk {
  /** Chunk content */
  content: string;
  /** Relevance score (0-1) */
  score: number;
  /** Citation information */
  citation: Citation;
  /** Chunk metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Search result for a single file
 */
export interface FileSearchResult {
  /** File path */
  filePath: string;
  /** Relative path from target */
  relativePath: string;
  /** Overall relevance score for this file */
  relevanceScore: number;
  /** Matched chunks within this file */
  matchedChunks: MatchedChunk[];
  /** File metadata */
  metadata: {
    /** File size in bytes */
    size: number;
    /** Last modified timestamp */
    lastModified: string;
    /** File extension */
    extension: string;
    /** Total chunks in file */
    totalChunks: number;
    /** Language (if detected) */
    language?: string;
  };
}

/**
 * Output from RAG file search
 */
export interface RagFileSearchOutput {
  /** Search results sorted by relevance */
  results: FileSearchResult[];
  /** AI-generated summary of findings */
  summary: string;
  /** Total number of files searched */
  totalFilesSearched: number;
  /** Total number of chunks searched */
  totalChunksSearched: number;
  /** Search duration in milliseconds */
  searchDuration: number;
  /** Index statistics */
  indexStats: {
    /** Whether the index was created fresh */
    wasReindexed: boolean;
    /** Number of files indexed */
    filesIndexed: number;
    /** Number of chunks created */
    chunksCreated: number;
    /** Indexing duration in milliseconds */
    indexingDuration?: number;
  };
  /** Store information */
  storeInfo: {
    /** Store name */
    name: string;
    /** Store creation timestamp */
    createdAt: string;
    /** Store last updated timestamp */
    lastUpdated: string;
  };
}

/**
 * Summary generation result
 */
export interface SummaryResult {
  /** Generated summary */
  summary: string;
  /** Key findings */
  keyFindings: string[];
  /** Confidence score */
  confidence: number;
}

// =============================================================================
// Additional Tool Types (for index.ts compatibility)
// =============================================================================

/**
 * Supported embedding model types
 */
export type EmbeddingModel = 'openai' | 'cohere' | 'local' | 'custom';

/**
 * Supported vector store types
 */
export type VectorStoreType = 'memory' | 'chromadb' | 'pinecone' | 'qdrant' | 'weaviate';

/**
 * Search result relevance scoring method
 */
export type ScoringMethod = 'cosine' | 'euclidean' | 'dot_product';

/**
 * Store management action types (alias for RAGStoreAction)
 */
export type StoreAction = RAGStoreAction;

/**
 * Context building strategy
 */
export type ContextStrategy =
  | 'relevant'
  | 'recent'
  | 'comprehensive'
  | 'focused'
  | 'custom';

/**
 * Context source types
 */
export type ContextSource = 'files' | 'store' | 'memory' | 'combined';

/**
 * Store info (simplified alias)
 */
export interface StoreInfo {
  /** Store name */
  name: string;
  /** Store type */
  type: VectorStoreType;
  /** Number of documents/vectors */
  documentCount: number;
  /** Store size in bytes */
  sizeBytes: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Embedding model used */
  embeddingModel: EmbeddingModel;
  /** Vector dimensions */
  dimensions: number;
  /** Health status */
  status: 'healthy' | 'degraded' | 'error';
}

/**
 * Context chunk for context builder
 */
export interface ContextChunk {
  /** Chunk content */
  content: string;
  /** Source information */
  source: {
    type: ContextSource;
    path?: string;
    storeName?: string;
  };
  /** Relevance score */
  relevance: number;
  /** Token count estimate */
  tokenCount: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Store management input (alias)
 */
export type RagStoreManageInput = RAGStoreManageInput;

/**
 * Store management output
 */
export interface RagStoreManageOutput {
  /** Action performed */
  action: StoreAction;
  /** Whether the action succeeded */
  success: boolean;
  /** Result message */
  message: string;
  /** Store information (for status/list actions) */
  stores?: StoreInfo[];
  /** Single store info (for status action) */
  store?: StoreInfo;
  /** Index statistics (for index action) */
  indexStats?: {
    filesProcessed: number;
    documentsAdded: number;
    errors: number;
    duration: number;
  };
}

/**
 * Context builder input (alias with lowercase prefix for backward compatibility)
 * @deprecated Use RAGContextBuilderInput instead
 */
export type RagContextBuilderInput = RAGContextBuilderInput;

/**
 * Context builder output for handler (simplified structure)
 * @deprecated Use RAGContextBuilderOutput for new code - this is maintained for backward compatibility
 */
export interface RagContextBuilderOutput {
  /** Built context string */
  context: string;
  /** Individual context chunks */
  chunks: ContextChunk[];
  /** Total token count estimate */
  totalTokens: number;
  /** Strategy used */
  strategy: ContextStrategy;
  /** Sources used */
  sources: ContextSource[];
  /** Context quality metrics */
  quality?: {
    relevanceScore: number;
    diversityScore: number;
    coverageScore: number;
  };
}

/**
 * RAG tool handler result
 */
export interface RagToolResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Human-readable message */
  message?: string;
  /** Error message if failed */
  error?: string;
  /** Warnings */
  warnings?: string[];
  /** Metadata */
  metadata?: {
    duration?: number;
    timestamp?: string;
  };
}

/**
 * RAG file search handler type
 */
export type RagFileSearchHandler = (
  input: RagFileSearchInput,
) => Promise<RagToolResult<RagFileSearchOutput>>;

/**
 * RAG store manage handler type
 */
export type RagStoreManageHandler = (
  input: RagStoreManageInput,
) => Promise<RagToolResult<RagStoreManageOutput>>;

/**
 * RAG context builder handler type
 */
export type RagContextBuilderHandler = (
  input: RagContextBuilderInput,
) => Promise<RagToolResult<RagContextBuilderOutput>>;

/**
 * RAG tools default configuration
 */
export interface RagToolsConfig {
  /** Default vector store type */
  defaultStoreType: VectorStoreType;
  /** Default embedding model */
  defaultEmbeddingModel: EmbeddingModel;
  /** Default vector dimensions */
  defaultDimensions: number;
  /** Default max results for search */
  defaultMaxResults: number;
  /** Default min score threshold */
  defaultMinScore: number;
  /** Default max tokens for context */
  defaultMaxTokens: number;
  /** Default context strategy */
  defaultContextStrategy: ContextStrategy;
  /** Cache settings */
  cache: {
    enabled: boolean;
    ttlSeconds: number;
    maxSize: number;
  };
}
