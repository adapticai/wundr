/**
 * Memory Module
 *
 * Provides multi-scope persistent memory management with auto-detection,
 * search, linking, session summaries, and file-based storage.
 *
 * @module @wundr/orchestrator-daemon/memory
 */

// ---------------------------------------------------------------------------
// Memory Manager (core)
// ---------------------------------------------------------------------------

export { MemoryManager } from './memory-manager';

// ---------------------------------------------------------------------------
// Context Compactor
// ---------------------------------------------------------------------------

export {
  ContextCompactor,
  createContextCompactor,
  estimateMessageTokens,
  estimateMessagesTokens,
  resolveContextWindowTokens,
  classifyMessageImportance,
  splitMessagesByTokenShare,
  chunkMessagesByMaxTokens,
  computeAdaptiveChunkRatio,
  isOversizedForSummary,
  pruneToolResults,
  pruneHistoryForContextShare,
  DEFAULT_CONTEXT_COMPACTOR_CONFIG,
} from './context-compactor';

export type {
  ConversationMessage,
  ContentBlock,
  MessageRole,
  MessageImportance,
  ModelCompactionThreshold,
  ContextCompactorConfig,
  ContextPruningConfig,
  MemoryFlushConfig,
  SummarizeFn,
  CompactionResult,
  CompactionMetadata,
  ToolFailureInfo,
  PreCompactHookResult,
  PreCompactListener,
  PruneHistoryResult,
} from './context-compactor';

// ---------------------------------------------------------------------------
// Auto-Memories (coordinator)
// ---------------------------------------------------------------------------

export { AutoMemories } from './auto-memories';
export type {
  MergedMemories,
  DecayResult,
  PruneResult,
  MemoryStats,
  AutoMemoriesConfig,
} from './auto-memories';

// ---------------------------------------------------------------------------
// Memory File Manager (low-level file I/O)
// ---------------------------------------------------------------------------

export { MemoryFileManager } from './memory-file-manager';
export type {
  EntryMetadata,
  MemoryEntry,
  MemorySection,
  ParsedMemoryFile,
  ConsolidationResult,
  MemoryVersion,
  MemoryFileManagerConfig,
} from './memory-file-manager';

// ---------------------------------------------------------------------------
// Learning Detector (conversation analysis)
// ---------------------------------------------------------------------------

export { LearningDetector } from './learning-detector';
export type {
  ConversationTurn,
  ToolCallRecord,
  MemorySectionType,
  DetectionCategory,
  DetectedMemory,
  LearningDetectorConfig,
} from './learning-detector';

// Note: MemoryScope from learning-detector conflicts with agents/agent-types.
// Consumers should import from './learning-detector' directly if needed,
// or use the re-export alias in src/index.ts.

// ---------------------------------------------------------------------------
// Memory Search
// ---------------------------------------------------------------------------

export { MemorySearch } from './memory-search';
export type {
  MemorySearchResult,
  MemorySearchOptions,
  RelevanceContext,
} from './memory-search';

// ---------------------------------------------------------------------------
// Session Summary
// ---------------------------------------------------------------------------

export { SessionSummaryGenerator } from './session-summary';
export type {
  SessionSummaryResult,
  SessionSummaryConfig,
} from './session-summary';

// ---------------------------------------------------------------------------
// Memory Linker
// ---------------------------------------------------------------------------

export { MemoryLinker } from './memory-linker';
export type {
  MemoryLink,
  LinkingResult,
  MemoryLinkerConfig,
} from './memory-linker';
