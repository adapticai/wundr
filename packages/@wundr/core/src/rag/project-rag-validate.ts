/**
 * Project RAG Validation
 *
 * Provides functionality to validate RAG store health,
 * checking for configuration integrity, orphaned entries,
 * and store accessibility.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  type RagStoreConfig,
  getRagStorePath,
  getRagExcludePath,
  loadRagConfig,
  DEFAULT_CHUNKING_CONFIG,
} from './project-rag-config.js';
import { isRagInitialized } from './project-rag-init.js';

/**
 * Validation issue severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Severity of the issue */
  readonly severity: ValidationSeverity;
  /** Issue code for programmatic handling */
  readonly code: string;
  /** Human-readable message */
  readonly message: string;
  /** Suggested fix for the issue */
  readonly suggestion?: string;
}

/**
 * Validation report structure
 */
export interface RagValidationReport {
  /** Whether the store is valid overall */
  readonly valid: boolean;
  /** Whether the store exists and is accessible */
  readonly storeExists: boolean;
  /** Whether configuration is valid */
  readonly configValid: boolean;
  /** Whether index file is valid */
  readonly indexValid: boolean;
  /** Number of orphaned entries found */
  readonly orphanedEntries: number;
  /** List of validation issues */
  readonly issues: readonly ValidationIssue[];
  /** Timestamp of validation */
  readonly validatedAt: string;
  /** Statistics about the store */
  readonly stats: {
    readonly totalFiles: number;
    readonly totalSize: number;
    readonly configSize: number;
  };
}

/**
 * Validation options
 */
export interface RagValidateOptions {
  /** Check for orphaned entries (files in index but not on disk) */
  readonly checkOrphans?: boolean;
  /** Check configuration integrity */
  readonly checkConfig?: boolean;
  /** Check index file integrity */
  readonly checkIndex?: boolean;
  /** Perform deep validation (slower but more thorough) */
  readonly deep?: boolean;
}

/**
 * Internal index file structure
 */
interface RagIndexData {
  version: string;
  indexedAt: string;
  lastSyncAt?: string;
  fileCount: number;
  files: Array<{
    path: string;
    size: number;
    lastModified: string;
  }>;
}

/**
 * Validate project RAG store health
 *
 * Performs comprehensive validation including:
 * 1. Store existence and accessibility
 * 2. Configuration integrity
 * 3. Index file integrity
 * 4. Orphaned entry detection
 *
 * @param projectPath - Path to the project directory
 * @param options - Validation options
 * @returns Validation report
 */
export function validateProjectRag(
  projectPath: string,
  options: RagValidateOptions = {},
): RagValidationReport {
  const issues: ValidationIssue[] = [];
  const defaultOptions: Required<RagValidateOptions> = {
    checkOrphans: true,
    checkConfig: true,
    checkIndex: true,
    deep: false,
    ...options,
  };

  // Check store existence
  const storeExists = isRagInitialized(projectPath);
  if (!storeExists) {
    return {
      valid: false,
      storeExists: false,
      configValid: false,
      indexValid: false,
      orphanedEntries: 0,
      issues: [{
        severity: 'error',
        code: 'STORE_NOT_FOUND',
        message: 'RAG store is not initialized',
        suggestion: 'Run initProjectRag() to initialize the RAG store',
      }],
      validatedAt: new Date().toISOString(),
      stats: {
        totalFiles: 0,
        totalSize: 0,
        configSize: 0,
      },
    };
  }

  // Validate configuration
  const configPath = getRagStorePath(projectPath);
  const configResult = defaultOptions.checkConfig
    ? validateConfig(configPath, issues)
    : { valid: true, size: 0 };

  // Validate index
  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');
  const indexResult = defaultOptions.checkIndex
    ? validateIndex(indexPath, issues)
    : { valid: true, fileCount: 0, totalSize: 0 };

  // Check for orphaned entries
  let orphanedCount = 0;
  if (defaultOptions.checkOrphans && indexResult.valid) {
    orphanedCount = findOrphanedEntries(projectPath, indexPath, issues);
  }

  // Check exclusion file
  const excludePath = getRagExcludePath(projectPath);
  validateExcludeFile(excludePath, issues);

  // Determine overall validity
  const hasErrors = issues.some(i => i.severity === 'error');
  const configValid = configResult.valid;
  const indexValid = indexResult.valid;

  return {
    valid: !hasErrors,
    storeExists,
    configValid,
    indexValid,
    orphanedEntries: orphanedCount,
    issues,
    validatedAt: new Date().toISOString(),
    stats: {
      totalFiles: indexResult.fileCount,
      totalSize: indexResult.totalSize,
      configSize: configResult.size,
    },
  };
}

/**
 * Validate RAG configuration file
 *
 * @param configPath - Path to configuration file
 * @param issues - Array to collect issues
 * @returns Validation result
 */
function validateConfig(
  configPath: string,
  issues: ValidationIssue[],
): { valid: boolean; size: number } {
  if (!fs.existsSync(configPath)) {
    issues.push({
      severity: 'error',
      code: 'CONFIG_NOT_FOUND',
      message: `Configuration file not found: ${configPath}`,
      suggestion: 'Re-initialize RAG to regenerate configuration',
    });
    return { valid: false, size: 0 };
  }

  let config: RagStoreConfig | null = null;
  let size = 0;

  try {
    const stats = fs.statSync(configPath);
    size = stats.size;
    config = loadRagConfig(configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      severity: 'error',
      code: 'CONFIG_READ_ERROR',
      message: `Failed to read configuration: ${message}`,
    });
    return { valid: false, size };
  }

  if (!config) {
    issues.push({
      severity: 'error',
      code: 'CONFIG_PARSE_ERROR',
      message: 'Failed to parse configuration file',
      suggestion: 'Configuration file may be corrupted. Consider re-initializing.',
    });
    return { valid: false, size };
  }

  // Validate required fields
  if (!config.storeName) {
    issues.push({
      severity: 'error',
      code: 'CONFIG_MISSING_STORE_NAME',
      message: 'Configuration missing required field: storeName',
    });
  }

  if (!config.includePatterns || config.includePatterns.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'CONFIG_NO_INCLUDE_PATTERNS',
      message: 'No include patterns defined - no files will be indexed',
      suggestion: 'Add include patterns to the configuration',
    });
  }

  // Validate chunking config
  if (config.chunkingConfig) {
    if (config.chunkingConfig.maxTokensPerChunk < 100) {
      issues.push({
        severity: 'warning',
        code: 'CONFIG_LOW_CHUNK_SIZE',
        message: `Chunk size (${config.chunkingConfig.maxTokensPerChunk}) is very low`,
        suggestion: `Consider increasing to at least ${DEFAULT_CHUNKING_CONFIG.maxTokensPerChunk}`,
      });
    }

    if (config.chunkingConfig.maxOverlapTokens >= config.chunkingConfig.maxTokensPerChunk) {
      issues.push({
        severity: 'error',
        code: 'CONFIG_INVALID_OVERLAP',
        message: 'Overlap tokens must be less than chunk size',
      });
    }
  }

  const hasErrors = issues.some(
    i => i.severity === 'error' && i.code.startsWith('CONFIG_'),
  );

  return { valid: !hasErrors, size };
}

/**
 * Validate RAG index file
 *
 * @param indexPath - Path to index file
 * @param issues - Array to collect issues
 * @returns Validation result
 */
function validateIndex(
  indexPath: string,
  issues: ValidationIssue[],
): { valid: boolean; fileCount: number; totalSize: number } {
  if (!fs.existsSync(indexPath)) {
    issues.push({
      severity: 'warning',
      code: 'INDEX_NOT_FOUND',
      message: 'Index file not found - project may not have been indexed yet',
      suggestion: 'Run syncProjectRag() to create the index',
    });
    return { valid: true, fileCount: 0, totalSize: 0 };
  }

  let indexData: RagIndexData;
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    indexData = JSON.parse(content) as RagIndexData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      severity: 'error',
      code: 'INDEX_PARSE_ERROR',
      message: `Failed to parse index file: ${message}`,
      suggestion: 'Run reindexProjectRag() to rebuild the index',
    });
    return { valid: false, fileCount: 0, totalSize: 0 };
  }

  // Validate index structure
  if (!indexData.version) {
    issues.push({
      severity: 'warning',
      code: 'INDEX_NO_VERSION',
      message: 'Index file missing version information',
    });
  }

  if (!indexData.indexedAt) {
    issues.push({
      severity: 'warning',
      code: 'INDEX_NO_TIMESTAMP',
      message: 'Index file missing timestamp',
    });
  }

  if (!Array.isArray(indexData.files)) {
    issues.push({
      severity: 'error',
      code: 'INDEX_INVALID_FILES',
      message: 'Index file has invalid files array',
    });
    return { valid: false, fileCount: 0, totalSize: 0 };
  }

  // Calculate total size
  const totalSize = indexData.files.reduce((sum, f) => sum + (f.size || 0), 0);

  // Validate file entries
  let invalidEntries = 0;
  for (const file of indexData.files) {
    if (!file.path || typeof file.path !== 'string') {
      invalidEntries++;
    }
  }

  if (invalidEntries > 0) {
    issues.push({
      severity: 'warning',
      code: 'INDEX_INVALID_ENTRIES',
      message: `Found ${invalidEntries} invalid file entries in index`,
      suggestion: 'Run reindexProjectRag() to rebuild the index',
    });
  }

  const hasErrors = issues.some(
    i => i.severity === 'error' && i.code.startsWith('INDEX_'),
  );

  return { valid: !hasErrors, fileCount: indexData.fileCount || 0, totalSize };
}

/**
 * Find orphaned entries (files in index but not on disk)
 *
 * @param projectPath - Path to the project
 * @param indexPath - Path to index file
 * @param issues - Array to collect issues
 * @returns Number of orphaned entries
 */
function findOrphanedEntries(
  projectPath: string,
  indexPath: string,
  issues: ValidationIssue[],
): number {
  let indexData: RagIndexData;
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    indexData = JSON.parse(content) as RagIndexData;
  } catch {
    return 0;
  }

  const orphaned: string[] = [];

  for (const file of indexData.files) {
    const fullPath = path.join(projectPath, file.path);
    if (!fs.existsSync(fullPath)) {
      orphaned.push(file.path);
    }
  }

  if (orphaned.length > 0) {
    const displayCount = Math.min(orphaned.length, 5);
    const examples = orphaned.slice(0, displayCount).join(', ');
    const moreCount = orphaned.length - displayCount;
    const moreText = moreCount > 0 ? ` and ${moreCount} more` : '';

    issues.push({
      severity: 'warning',
      code: 'INDEX_ORPHANED_ENTRIES',
      message: `Found ${orphaned.length} orphaned entries: ${examples}${moreText}`,
      suggestion: 'Run syncProjectRag() to clean up orphaned entries',
    });
  }

  return orphaned.length;
}

/**
 * Validate exclusion file
 *
 * @param excludePath - Path to exclusion file
 * @param issues - Array to collect issues
 */
function validateExcludeFile(
  excludePath: string,
  issues: ValidationIssue[],
): void {
  if (!fs.existsSync(excludePath)) {
    issues.push({
      severity: 'info',
      code: 'EXCLUDE_NOT_FOUND',
      message: 'Exclusion file not found - using default patterns',
    });
    return;
  }

  try {
    const content = fs.readFileSync(excludePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));

    if (lines.length === 0) {
      issues.push({
        severity: 'info',
        code: 'EXCLUDE_EMPTY',
        message: 'Exclusion file is empty',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      severity: 'warning',
      code: 'EXCLUDE_READ_ERROR',
      message: `Failed to read exclusion file: ${message}`,
    });
  }
}

/**
 * Get a quick health check for the RAG store
 *
 * @param projectPath - Path to the project
 * @returns Simple health status
 */
export function getRagHealth(projectPath: string): {
  healthy: boolean;
  initialized: boolean;
  lastSync: Date | null;
  fileCount: number;
} {
  if (!isRagInitialized(projectPath)) {
    return {
      healthy: false,
      initialized: false,
      lastSync: null,
      fileCount: 0,
    };
  }

  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');

  if (!fs.existsSync(indexPath)) {
    return {
      healthy: true,
      initialized: true,
      lastSync: null,
      fileCount: 0,
    };
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const indexData = JSON.parse(content) as RagIndexData;

    return {
      healthy: true,
      initialized: true,
      lastSync: indexData.lastSyncAt ? new Date(indexData.lastSyncAt) : null,
      fileCount: indexData.fileCount || 0,
    };
  } catch {
    return {
      healthy: false,
      initialized: true,
      lastSync: null,
      fileCount: 0,
    };
  }
}
