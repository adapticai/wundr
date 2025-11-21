/**
 * MCP Tools Module
 * Exports all tool-related functionality for the Wundr MCP server
 *
 * @module @wundr/mcp-server/tools
 */

// Export schemas
// Type aliases for backward compatibility
import type { McpTool, McpToolResult } from './registry';

export {
  // Common schemas
  CommonOptionsSchema,

  // Computer setup schemas
  ComputerSetupSchema,
  ClaudeConfigSchema,
  BackupSchema,
  RollbackSchema,

  // Project schemas
  ProjectInitSchema,

  // Claude setup schemas
  ClaudeSetupSchema,

  // Governance schemas
  DriftDetectionSchema,
  PatternStandardizeSchema,
  GovernanceReportSchema,

  // Monorepo schemas
  MonorepoManageSchema,

  // Analysis schemas
  DependencyAnalyzeSchema,

  // Testing schemas
  TestBaselineSchema,

  // RAG schemas
  RagFileSearchSchema,
  RagStoreManageSchema,
  RagContextBuilderSchema,
  RagToolSchemaEntries,

  // Schema registry and utilities
  ToolSchemas,
  zodToJsonSchema,
  getToolJsonSchema,
  getAllToolJsonSchemas,

  // Types
  type ComputerSetupInput,
  type ClaudeConfigInput,
  type BackupInput,
  type RollbackInput,
  type ProjectInitInput,
  type ClaudeSetupInput,
  type DriftDetectionInput,
  type PatternStandardizeInput,
  type MonorepoManageInput,
  type GovernanceReportInput,
  type DependencyAnalyzeInput,
  type TestBaselineInput,
  type ToolName,

  // RAG types
  type RagFileSearchInput,
  type RagStoreManageInput,
  type RagContextBuilderInput,
  type RagToolName,
} from './schemas';

// Export registry
export {
  // Classes
  ToolRegistry,

  // Types
  type McpTool,
  type McpToolResult,
  type ToolRegistrationOptions,
  type ToolExecutionContext,

  // Factory functions
  createToolRegistry,
  createToolFromSchema,

  // Singleton
  globalRegistry,

  // Helper functions
  successResult,
  errorResult,
  wrapHandler,
} from './registry';

/**
 * @deprecated Use McpTool instead
 */
export type Tool = McpTool;

/**
 * @deprecated Use McpToolResult instead
 */
export type ToolResult = McpToolResult;

// Export CLI command tools
export {
  // Tool handlers
  computerSetupHandler,
  claudeConfigHandler,
  backupHandler,
  rollbackHandler,
  projectInitHandler,
  claudeSetupHandler,
  driftDetectionHandler,
  patternStandardizeHandler,
  monorepoManageHandler,
  governanceReportHandler,
  dependencyAnalyzeHandler,
  testBaselineHandler,

  // Registration
  registerCliCommandTools,
  initializeCliTools,
  initializeAllTools,

  // Command execution utilities
  executeCommand,
  executeWundrCommand,
} from './cli-commands';

// ============================================================================
// RAG Tools
// ============================================================================

export {
  // RAG handlers
  ragFileSearchHandler,
  ragStoreManageHandler,
  ragContextBuilderHandler,

  // RAG registration
  registerRagTools,
  initializeRagTools,
  getRagToolDefinitions,
  getRagToolJsonSchemas,

  // RAG constants
  DEFAULT_CONFIG as RAG_DEFAULT_CONFIG,
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

  // RAG types
  type EmbeddingModel,
  type VectorStoreType,
  type ScoringMethod,
  type RagFileSearchOutput,
  type FileSearchResult,
  type StoreAction,
  type RagStoreManageOutput,
  type StoreInfo,
  type ContextStrategy,
  type ContextSource,
  type RagContextBuilderOutput,
  type ContextChunk,
  type RagToolResult,
  type RagFileSearchHandler,
  type RagStoreManageHandler,
  type RagContextBuilderHandler,
  type RagToolsConfig,
} from './rag';
