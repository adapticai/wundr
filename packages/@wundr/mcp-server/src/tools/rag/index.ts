/**
 * RAG Tools Module
 *
 * Retrieval-Augmented Generation tools for semantic search,
 * vector store management, and context building.
 *
 * @module @wundr/mcp-server/tools/rag
 */

import { z } from 'zod';

import { globalRegistry } from '../registry';
import { zodToJsonSchema } from '../schemas';

import {
  ragFileSearchHandler,
  ragStoreManageHandler,
  ragContextBuilderHandler,
} from './handlers';

import {
  RagFileSearchSchema,
  RagStoreManageSchema,
  RagContextBuilderSchema,
  RagToolSchemaEntries,
} from './schemas';

import {
  DEFAULT_CONFIG,
  RAG_STORE_DIR,
  RAG_CACHE_DIR,
  RAG_TOOL_NAMES,
  RAG_TOOL_DESCRIPTIONS,
  SUPPORTED_STORE_TYPES,
  SUPPORTED_EMBEDDING_MODELS,
  SUPPORTED_CONTEXT_STRATEGIES,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_DOC_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  MAX_FILE_SIZE,
  MAX_SNIPPET_LENGTH,
  MAX_DOCUMENTS_PER_STORE,
  MAX_CONTEXT_CHUNKS,
} from './constants';

import type {
  ToolRegistry,
  McpTool,
  McpToolResult,
  ToolRegistrationOptions,
} from '../registry';

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  // Common types
  EmbeddingModel,
  VectorStoreType,
  ScoringMethod,

  // File search types
  RagFileSearchInput,
  RagFileSearchOutput,
  FileSearchResult,

  // Store management types
  StoreAction,
  RagStoreManageInput,
  RagStoreManageOutput,
  StoreInfo,

  // Context builder types (RAG prefix - canonical naming)
  RAGContextBuilderInput,
  RAGContextBuilderOutput,
  RAGSearchOptions,
  RAGSearchResult,
  RAGSearchResults,
  RAGChunk,

  // Context builder types (lowercase aliases for backward compatibility)
  ContextStrategy,
  ContextSource,
  RagContextBuilderInput,
  RagContextBuilderOutput,
  ContextChunk,

  // Handler types
  RagToolResult,
  RagFileSearchHandler,
  RagStoreManageHandler,
  RagContextBuilderHandler,

  // Configuration types
  RagToolsConfig,
} from './types';

// Re-export schema input types
export type {
  RagFileSearchInput as RagFileSearchSchemaInput,
  RagStoreManageInput as RagStoreManageSchemaInput,
  RagContextBuilderInput as RagContextBuilderSchemaInput,
  RagToolName,
} from './schemas';

// ============================================================================
// Re-export Handlers
// ============================================================================

export {
  ragFileSearchHandler,
  ragStoreManageHandler,
  ragContextBuilderHandler,
} from './handlers';

// ============================================================================
// Re-export Schemas
// ============================================================================

export {
  RagFileSearchSchema,
  RagStoreManageSchema,
  RagContextBuilderSchema,
  RagToolSchemaEntries,
} from './schemas';

// ============================================================================
// Re-export Constants
// ============================================================================

export {
  DEFAULT_CONFIG,
  RAG_STORE_DIR,
  RAG_CACHE_DIR,
  RAG_TOOL_NAMES,
  RAG_TOOL_DESCRIPTIONS,
  SUPPORTED_STORE_TYPES,
  SUPPORTED_EMBEDDING_MODELS,
  SUPPORTED_CONTEXT_STRATEGIES,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_DOC_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  MAX_FILE_SIZE,
  MAX_SNIPPET_LENGTH,
  MAX_DOCUMENTS_PER_STORE,
  MAX_CONTEXT_CHUNKS,
} from './constants';

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Create MCP tool definition for RAG file search
 */
function createRagFileSearchTool(): McpTool {
  return {
    name: RAG_TOOL_NAMES.FILE_SEARCH,
    description: RAG_TOOL_DESCRIPTIONS[RAG_TOOL_NAMES.FILE_SEARCH],
    inputSchema: zodToJsonSchema(RagFileSearchSchema),
    category: 'rag',
    handler: ragFileSearchHandler as (input: unknown) => Promise<McpToolResult<unknown>>,
    zodSchema: RagFileSearchSchema as z.ZodType<unknown>,
  };
}

/**
 * Create MCP tool definition for RAG store management
 */
function createRagStoreManageTool(): McpTool {
  return {
    name: RAG_TOOL_NAMES.STORE_MANAGE,
    description: RAG_TOOL_DESCRIPTIONS[RAG_TOOL_NAMES.STORE_MANAGE],
    inputSchema: zodToJsonSchema(RagStoreManageSchema),
    category: 'rag',
    handler: ragStoreManageHandler as (input: unknown) => Promise<McpToolResult<unknown>>,
    zodSchema: RagStoreManageSchema as z.ZodType<unknown>,
  };
}

/**
 * Create MCP tool definition for RAG context builder
 */
function createRagContextBuilderTool(): McpTool {
  return {
    name: RAG_TOOL_NAMES.CONTEXT_BUILDER,
    description: RAG_TOOL_DESCRIPTIONS[RAG_TOOL_NAMES.CONTEXT_BUILDER],
    inputSchema: zodToJsonSchema(RagContextBuilderSchema),
    category: 'rag',
    handler: ragContextBuilderHandler as (input: unknown) => Promise<McpToolResult<unknown>>,
    zodSchema: RagContextBuilderSchema as z.ZodType<unknown>,
  };
}

/**
 * Register all RAG tools with a tool registry
 *
 * @param registry - Tool registry to register with (defaults to global registry)
 * @param options - Registration options
 *
 * @example
 * ```typescript
 * // Register with global registry
 * registerRagTools();
 *
 * // Register with custom registry
 * const myRegistry = createToolRegistry();
 * registerRagTools(myRegistry);
 * ```
 */
export function registerRagTools(
  registry: ToolRegistry = globalRegistry,
  options: ToolRegistrationOptions = {},
): void {
  const tools = [
    createRagFileSearchTool(),
    createRagStoreManageTool(),
    createRagContextBuilderTool(),
  ];

  for (const tool of tools) {
    registry.register(tool, options);
  }
}

/**
 * Initialize RAG tools - alias for registerRagTools for consistency
 */
export const initializeRagTools = registerRagTools;

/**
 * Get all RAG tool definitions without registering
 */
export function getRagToolDefinitions(): McpTool[] {
  return [
    createRagFileSearchTool(),
    createRagStoreManageTool(),
    createRagContextBuilderTool(),
  ];
}

/**
 * Get RAG tool JSON schemas for MCP registration
 */
export function getRagToolJsonSchemas(): Record<
  string,
  { schema: Record<string, unknown>; description: string; category: string }
> {
  return {
    [RAG_TOOL_NAMES.FILE_SEARCH]: {
      schema: zodToJsonSchema(RagFileSearchSchema),
      description: RAG_TOOL_DESCRIPTIONS[RAG_TOOL_NAMES.FILE_SEARCH],
      category: 'rag',
    },
    [RAG_TOOL_NAMES.STORE_MANAGE]: {
      schema: zodToJsonSchema(RagStoreManageSchema),
      description: RAG_TOOL_DESCRIPTIONS[RAG_TOOL_NAMES.STORE_MANAGE],
      category: 'rag',
    },
    [RAG_TOOL_NAMES.CONTEXT_BUILDER]: {
      schema: zodToJsonSchema(RagContextBuilderSchema),
      description: RAG_TOOL_DESCRIPTIONS[RAG_TOOL_NAMES.CONTEXT_BUILDER],
      category: 'rag',
    },
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Registration
  registerRagTools,
  initializeRagTools,
  getRagToolDefinitions,
  getRagToolJsonSchemas,

  // Handlers
  ragFileSearchHandler,
  ragStoreManageHandler,
  ragContextBuilderHandler,

  // Schemas
  RagFileSearchSchema,
  RagStoreManageSchema,
  RagContextBuilderSchema,

  // Constants
  DEFAULT_CONFIG,
  RAG_TOOL_NAMES,
  RAG_TOOL_DESCRIPTIONS,
};
