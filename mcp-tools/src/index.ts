export { DriftDetectionHandler } from './tools/governance/drift-detection-handler.js';
export { GovernanceReportHandler } from './tools/governance/governance-report-handler.js';
export { PatternStandardizeHandler } from './tools/standardization/pattern-standardize-handler.js';
export { MonorepoManageHandler } from './tools/monorepo/monorepo-manage-handler.js';
export { DependencyAnalyzeHandler } from './tools/analysis/dependency-analyze-handler.js';
export { TestBaselineHandler } from './tools/testing/test-baseline-handler.js';
export { ClaudeConfigHandler } from './tools/config/claude-config-handler.js';

// RAG tool handlers
export { RagFileSearchHandler } from './tools/rag/rag-file-search-handler.js';
export { RagStoreManageHandler } from './tools/rag/rag-store-manage-handler.js';
export { RagContextBuilderHandler } from './tools/rag/rag-context-builder-handler.js';

// Dynamic Prompting System
export {
  // Core classes
  DynamicPromptManager,
  createDynamicPromptManager,
  ContextDetector,
  PersonaLibraryImpl,
  createPersonaLibrary,
  builtInPersonas,
  // Types
  type ContextSignals,
  type DetectedContext,
  type DetectionRule,
  type DomainType,
  type DynamicPromptConfig,
  type DynamicPromptingArgs,
  type DynamicPromptingResult,
  type MergingStrategy,
  type PersonaConfig,
  type PersonaLibrary,
  type PersonaPriority,
  type ResolvedPrompt,
  type TaskType,
} from './dynamic-prompting/index.js';

// Re-export types if needed
export type {
  DriftDetectionArgs,
  PatternStandardizeArgs,
  MonorepoManageArgs,
  GovernanceReportArgs,
  DependencyAnalyzeArgs,
  TestBaselineArgs,
  ClaudeConfigArgs,
  // RAG types
  RagFileSearchArgs,
  RagStoreManageArgs,
  RagContextBuilderArgs,
} from './types/index.js';
