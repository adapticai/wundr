/**
 * MCP Tools Module
 * Exports all tool-related functionality for the Wundr MCP server
 *
 * @module @wundr/mcp-server/tools
 */

// Export schemas
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

// Type aliases for backward compatibility
import type { McpTool, McpToolResult } from './registry';

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

  // Command execution utilities
  executeCommand,
  executeWundrCommand,
} from './cli-commands';
