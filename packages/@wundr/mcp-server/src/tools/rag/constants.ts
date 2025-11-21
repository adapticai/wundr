/**
 * RAG Tools Constants
 *
 * Default configurations and constants for RAG tools.
 *
 * @module @wundr/mcp-server/tools/rag/constants
 */

import * as path from 'path';
import type { RagToolsConfig, VectorStoreType, EmbeddingModel, ContextStrategy } from './types';

// ============================================================================
// Directory Constants
// ============================================================================

/**
 * Default RAG store directory
 */
export const RAG_STORE_DIR = path.join(process.cwd(), '.wundr', 'rag-stores');

/**
 * Default cache directory
 */
export const RAG_CACHE_DIR = path.join(process.cwd(), '.wundr', 'rag-cache');

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default RAG tools configuration
 */
export const DEFAULT_CONFIG: RagToolsConfig = {
  defaultStoreType: 'memory' as VectorStoreType,
  defaultEmbeddingModel: 'local' as EmbeddingModel,
  defaultDimensions: 384,
  defaultMaxResults: 10,
  defaultMinScore: 0.3,
  defaultMaxTokens: 4000,
  defaultContextStrategy: 'relevant' as ContextStrategy,
  cache: {
    enabled: true,
    ttlSeconds: 3600,
    maxSize: 100,
  },
};

// ============================================================================
// Supported Values
// ============================================================================

/**
 * Supported vector store types
 */
export const SUPPORTED_STORE_TYPES: VectorStoreType[] = [
  'memory',
  'chromadb',
  'pinecone',
  'qdrant',
  'weaviate',
];

/**
 * Supported embedding models
 */
export const SUPPORTED_EMBEDDING_MODELS: EmbeddingModel[] = [
  'openai',
  'cohere',
  'local',
  'custom',
];

/**
 * Supported context strategies
 */
export const SUPPORTED_CONTEXT_STRATEGIES: ContextStrategy[] = [
  'relevant',
  'recent',
  'comprehensive',
  'focused',
  'custom',
];

// ============================================================================
// File Patterns
// ============================================================================

/**
 * Default include patterns for code files
 */
export const DEFAULT_CODE_PATTERNS = [
  '*.ts',
  '*.tsx',
  '*.js',
  '*.jsx',
  '*.py',
  '*.go',
  '*.rs',
  '*.java',
  '*.c',
  '*.cpp',
  '*.h',
  '*.hpp',
];

/**
 * Default include patterns for documentation files
 */
export const DEFAULT_DOC_PATTERNS = [
  '*.md',
  '*.mdx',
  '*.txt',
  '*.rst',
  '*.adoc',
];

/**
 * Default exclude patterns
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '*.min.js',
  '*.min.css',
  '*.map',
];

// ============================================================================
// Tool Names and Descriptions
// ============================================================================

/**
 * RAG tool names
 */
export const RAG_TOOL_NAMES = {
  FILE_SEARCH: 'rag-file-search',
  STORE_MANAGE: 'rag-store-manage',
  CONTEXT_BUILDER: 'rag-context-builder',
} as const;

/**
 * RAG tool descriptions
 */
export const RAG_TOOL_DESCRIPTIONS = {
  [RAG_TOOL_NAMES.FILE_SEARCH]:
    'Search files using semantic, keyword, or hybrid search with relevance scoring',
  [RAG_TOOL_NAMES.STORE_MANAGE]:
    'Create, manage, and maintain vector stores for RAG operations',
  [RAG_TOOL_NAMES.CONTEXT_BUILDER]:
    'Build optimal context for LLM queries using multiple sources and strategies',
} as const;

// ============================================================================
// Limits and Thresholds
// ============================================================================

/**
 * Maximum file size to index (in bytes)
 */
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Maximum content length for snippets
 */
export const MAX_SNIPPET_LENGTH = 1000;

/**
 * Maximum documents per store
 */
export const MAX_DOCUMENTS_PER_STORE = 100000;

/**
 * Maximum context chunks
 */
export const MAX_CONTEXT_CHUNKS = 50;
