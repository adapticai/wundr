/**
 * RAG Types and Interfaces
 */

import { z } from 'zod';

/**
 * Document chunk with metadata
 */
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

/**
 * Metadata associated with a chunk
 */
export interface ChunkMetadata {
  sourceFile: string;
  startLine: number;
  endLine: number;
  language?: string;
  type?: 'code' | 'comment' | 'documentation' | 'mixed';
  functionName?: string;
  className?: string;
  importStatements?: string[];
  exportStatements?: string[];
  dependencies?: string[];
}

/**
 * Chunking configuration options
 */
export interface ChunkingOptions {
  maxTokens: number;
  minTokens: number;
  overlap: number;
  preserveCodeBlocks: boolean;
  respectFunctionBoundaries: boolean;
  respectClassBoundaries: boolean;
}

/**
 * Default chunking options
 */
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxTokens: 512,
  minTokens: 50,
  overlap: 50,
  preserveCodeBlocks: true,
  respectFunctionBoundaries: true,
  respectClassBoundaries: true,
};

/**
 * Embedding model configuration
 */
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
}

/**
 * Default embedding configuration for Google GenAI
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-004',
  dimensions: 768,
  batchSize: 100,
  maxRetries: 3,
  timeout: 30000,
};

/**
 * Vector search result
 */
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  distance: number;
}

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  indexPath?: string;
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dotProduct';
  efConstruction?: number;
  efSearch?: number;
  maxElements?: number;
}

/**
 * Retrieval options
 */
export interface RetrievalOptions {
  topK: number;
  minScore: number;
  includeMetadata: boolean;
  filter?: ChunkFilter;
  rerank?: boolean;
}

/**
 * Filter for chunk retrieval
 */
export interface ChunkFilter {
  sourceFiles?: string[];
  languages?: string[];
  types?: Array<'code' | 'comment' | 'documentation' | 'mixed'>;
  functionNames?: string[];
  classNames?: string[];
}

/**
 * Zod schemas for validation
 */
export const ChunkMetadataSchema = z.object({
  sourceFile: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().positive(),
  language: z.string().optional(),
  type: z.enum(['code', 'comment', 'documentation', 'mixed']).optional(),
  functionName: z.string().optional(),
  className: z.string().optional(),
  importStatements: z.array(z.string()).optional(),
  exportStatements: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

export const DocumentChunkSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  metadata: ChunkMetadataSchema,
  embedding: z.array(z.number()).optional(),
});

export const ChunkingOptionsSchema = z.object({
  maxTokens: z.number().int().positive().default(512),
  minTokens: z.number().int().nonnegative().default(50),
  overlap: z.number().int().nonnegative().default(50),
  preserveCodeBlocks: z.boolean().default(true),
  respectFunctionBoundaries: z.boolean().default(true),
  respectClassBoundaries: z.boolean().default(true),
});

export const EmbeddingConfigSchema = z.object({
  model: z.string().default('text-embedding-004'),
  dimensions: z.number().int().positive().default(768),
  batchSize: z.number().int().positive().default(100),
  maxRetries: z.number().int().nonnegative().default(3),
  timeout: z.number().int().positive().default(30000),
});

export const SearchResultSchema = z.object({
  chunk: DocumentChunkSchema,
  score: z.number(),
  distance: z.number(),
});

export const RetrievalOptionsSchema = z.object({
  topK: z.number().int().positive().default(10),
  minScore: z.number().min(0).max(1).default(0.7),
  includeMetadata: z.boolean().default(true),
  filter: z.object({
    sourceFiles: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    types: z.array(z.enum(['code', 'comment', 'documentation', 'mixed'])).optional(),
    functionNames: z.array(z.string()).optional(),
    classNames: z.array(z.string()).optional(),
  }).optional(),
  rerank: z.boolean().default(false),
});
