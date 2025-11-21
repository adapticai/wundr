/**
 * RAG Tools Zod Schemas
 *
 * Zod schema definitions for RAG tool input validation.
 *
 * @module @wundr/mcp-server/tools/rag/schemas
 */

import { z } from 'zod';

// ============================================================================
// File Search Schema
// ============================================================================

/**
 * Schema for RAG file search input
 */
export const RagFileSearchSchema = z.object({
  query: z.string().min(1).describe('Search query string'),
  paths: z.array(z.string()).optional().describe('Paths to search within'),
  includePatterns: z
    .array(z.string())
    .optional()
    .describe('File patterns to include (e.g., "*.ts", "*.md")'),
  excludePatterns: z
    .array(z.string())
    .optional()
    .describe('File patterns to exclude'),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe('Maximum number of results to return'),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.3)
    .describe('Minimum relevance score threshold (0-1)'),
  mode: z
    .enum(['semantic', 'keyword', 'hybrid'])
    .optional()
    .default('hybrid')
    .describe('Search mode'),
  includeContent: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include file content snippets in results'),
  maxContentLength: z
    .number()
    .int()
    .positive()
    .optional()
    .default(500)
    .describe('Maximum content length per result'),
});

export type RagFileSearchInput = z.infer<typeof RagFileSearchSchema>;

// ============================================================================
// Store Management Schema
// ============================================================================

/**
 * Store configuration schema
 */
const StoreConfigSchema = z.object({
  type: z
    .enum(['memory', 'chromadb', 'pinecone', 'qdrant', 'weaviate'])
    .optional()
    .describe('Vector store type'),
  embeddingModel: z
    .enum(['openai', 'cohere', 'local', 'custom'])
    .optional()
    .describe('Embedding model to use'),
  dimensions: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Vector dimensions'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Additional store metadata'),
});

/**
 * Schema for RAG store management input
 */
export const RagStoreManageSchema = z.object({
  action: z
    .enum([
      'create',
      'delete',
      'list',
      'status',
      'index',
      'clear',
      'optimize',
      'backup',
      'restore',
    ])
    .describe('Store management action to perform'),
  storeName: z
    .string()
    .optional()
    .describe('Store name/identifier'),
  config: StoreConfigSchema.optional().describe(
    'Store configuration for create action',
  ),
  indexPaths: z
    .array(z.string())
    .optional()
    .describe('Paths to index for index action'),
  backupPath: z
    .string()
    .optional()
    .describe('Backup/restore file path'),
  force: z
    .boolean()
    .optional()
    .describe('Force operation without confirmation'),
});

export type RagStoreManageInput = z.infer<typeof RagStoreManageSchema>;

// ============================================================================
// Context Builder Schema
// ============================================================================

/**
 * Conversation message schema
 */
const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']).describe('Message role'),
  content: z.string().describe('Message content'),
});

/**
 * Schema for RAG context builder input
 */
export const RagContextBuilderSchema = z.object({
  query: z.string().min(1).describe('Query or topic for context building'),
  strategy: z
    .enum(['relevant', 'recent', 'comprehensive', 'focused', 'custom'])
    .optional()
    .default('relevant')
    .describe('Context building strategy'),
  sources: z
    .array(z.enum(['files', 'store', 'memory', 'combined']))
    .optional()
    .default(['combined'])
    .describe('Sources to include in context'),
  maxTokens: z
    .number()
    .int()
    .positive()
    .optional()
    .default(4000)
    .describe('Maximum context tokens/length'),
  storeName: z
    .string()
    .optional()
    .describe('Store name to query'),
  additionalPaths: z
    .array(z.string())
    .optional()
    .describe('Additional file paths to include'),
  includeCode: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include code snippets in context'),
  includeDocs: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include documentation in context'),
  conversationHistory: z
    .array(ConversationMessageSchema)
    .optional()
    .describe('Conversation history for context'),
  format: z
    .enum(['plain', 'markdown', 'structured'])
    .optional()
    .default('markdown')
    .describe('Output format'),
});

export type RagContextBuilderInput = z.infer<typeof RagContextBuilderSchema>;

// ============================================================================
// Schema Registry Entries
// ============================================================================

/**
 * RAG tool schema registry entries for integration with main ToolSchemas
 */
export const RagToolSchemaEntries = {
  'rag-file-search': {
    schema: RagFileSearchSchema,
    description:
      'Search files using semantic, keyword, or hybrid search with relevance scoring',
    category: 'rag',
  },
  'rag-store-manage': {
    schema: RagStoreManageSchema,
    description:
      'Create, manage, and maintain vector stores for RAG operations',
    category: 'rag',
  },
  'rag-context-builder': {
    schema: RagContextBuilderSchema,
    description:
      'Build optimal context for LLM queries using multiple sources and strategies',
    category: 'rag',
  },
} as const;

export type RagToolName = keyof typeof RagToolSchemaEntries;
