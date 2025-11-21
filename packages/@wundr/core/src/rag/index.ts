/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * This module provides functionality for initializing and managing
 * RAG configuration for projects.
 */

// Configuration exports
export {
  type ChunkingConfig,
  type RagMetadata,
  type RagStoreConfig,
  type FrameworkDetectionResult,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_METADATA,
  createDefaultRagConfig,
  detectFramework,
  loadRagConfig,
  saveRagConfig,
  mergeRagConfig,
  getRagStorePath,
  getRagExcludePath,
} from './project-rag-config.js';

// Initialization exports
export {
  type RagInitOptions,
  type RagInitResult,
  type IndexedFile,
  initProjectRag,
  isRagInitialized,
  removeRag,
  reindexProject,
} from './project-rag-init.js';

// Sync exports
export {
  type RagSyncStats,
  type RagSyncOptions,
  syncProjectRag,
  getLastSyncTime,
  isSyncNeeded,
} from './project-rag-sync.js';

// Validation exports
export {
  type ValidationSeverity,
  type ValidationIssue,
  type RagValidationReport,
  type RagValidateOptions,
  validateProjectRag,
  getRagHealth,
} from './project-rag-validate.js';

// Reindex exports
export {
  type RagReindexStats,
  type RagReindexOptions,
  reindexProjectRag,
  clearRagStore,
  getBackupList,
  restoreFromBackup,
} from './project-rag-reindex.js';
