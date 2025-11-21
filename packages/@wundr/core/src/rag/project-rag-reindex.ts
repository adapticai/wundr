/**
 * Project RAG Re-indexing
 *
 * Provides functionality for complete re-indexing of RAG stores,
 * including deleting existing stores and rebuilding from scratch.
 */

import * as fs from 'fs';
import * as path from 'path';

import { glob } from 'glob';

import {
  type RagStoreConfig,
  getRagStorePath,
  loadRagConfig,
  saveRagConfig,
} from './project-rag-config.js';
import { type IndexedFile, isRagInitialized } from './project-rag-init.js';

/**
 * Reindex statistics
 */
export interface RagReindexStats {
  /** Whether reindexing was successful */
  readonly success: boolean;
  /** Number of files indexed */
  readonly filesIndexed: number;
  /** Total size of indexed files in bytes */
  readonly totalSize: number;
  /** Duration of reindex in milliseconds */
  readonly durationMs: number;
  /** Timestamp when reindex completed */
  readonly reindexedAt: string;
  /** Any errors that occurred */
  readonly errors: readonly string[];
  /** Any warnings that occurred */
  readonly warnings: readonly string[];
  /** Previous index stats for comparison */
  readonly previous: {
    readonly fileCount: number;
    readonly indexedAt: string | null;
  };
}

/**
 * Reindex options
 */
export interface RagReindexOptions {
  /** Preserve existing configuration (default: true) */
  readonly preserveConfig?: boolean;
  /** Custom configuration to use during reindex */
  readonly config?: Partial<RagStoreConfig>;
  /** Skip confirmation for destructive operations */
  readonly force?: boolean;
  /** Backup existing index before reindex */
  readonly backup?: boolean;
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
 * Perform full re-indexing of project RAG store
 *
 * This function:
 * 1. Optionally backs up the existing index
 * 2. Deletes the existing index
 * 3. Re-creates the index with current configuration
 * 4. Re-indexes all matching files
 *
 * @param projectPath - Path to the project directory
 * @param options - Reindex options
 * @returns Reindex statistics
 */
export async function reindexProjectRag(
  projectPath: string,
  options: RagReindexOptions = {},
): Promise<RagReindexStats> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate RAG is initialized
  if (!isRagInitialized(projectPath)) {
    return {
      success: false,
      filesIndexed: 0,
      totalSize: 0,
      durationMs: Date.now() - startTime,
      reindexedAt: new Date().toISOString(),
      errors: [`RAG not initialized for project: ${projectPath}`],
      warnings: [],
      previous: { fileCount: 0, indexedAt: null },
    };
  }

  // Load existing configuration
  const configPath = getRagStorePath(projectPath);
  let config = loadRagConfig(configPath);
  if (!config) {
    return {
      success: false,
      filesIndexed: 0,
      totalSize: 0,
      durationMs: Date.now() - startTime,
      reindexedAt: new Date().toISOString(),
      errors: [`Failed to load RAG configuration from: ${configPath}`],
      warnings: [],
      previous: { fileCount: 0, indexedAt: null },
    };
  }

  // Get previous index stats
  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');
  const previousStats = getPreviousIndexStats(indexPath);

  // Backup existing index if requested
  if (options.backup) {
    try {
      backupIndex(projectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to backup existing index: ${message}`);
    }
  }

  // Apply custom configuration if provided
  if (options.config) {
    const preserveConfig = options.preserveConfig !== false;
    if (preserveConfig) {
      config = mergeConfigs(config, options.config);
    } else {
      config = {
        ...config,
        ...options.config,
        chunkingConfig: options.config.chunkingConfig ?? config.chunkingConfig,
        metadata: options.config.metadata ?? config.metadata,
      };
    }

    // Save updated configuration
    try {
      saveRagConfig(config, configPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to save updated configuration: ${message}`);
    }
  }

  // Delete existing index
  try {
    deleteIndex(indexPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to delete existing index: ${message}`);
    return {
      success: false,
      filesIndexed: 0,
      totalSize: 0,
      durationMs: Date.now() - startTime,
      reindexedAt: new Date().toISOString(),
      errors,
      warnings,
      previous: previousStats,
    };
  }

  // Re-index all files
  let indexedFiles: IndexedFile[] = [];
  try {
    indexedFiles = await indexAllFiles(projectPath, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to index files: ${message}`);
  }

  // Calculate total size
  const totalSize = indexedFiles.reduce((sum, f) => sum + f.size, 0);

  // Save new index
  if (errors.length === 0) {
    try {
      const indexData: RagIndexData = {
        version: '1.0.0',
        indexedAt: new Date().toISOString(),
        fileCount: indexedFiles.length,
        files: indexedFiles.map(f => ({
          path: f.relativePath,
          size: f.size,
          lastModified: f.lastModified.toISOString(),
        })),
      };

      fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to save new index: ${message}`);
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: errors.length === 0,
    filesIndexed: indexedFiles.length,
    totalSize,
    durationMs,
    reindexedAt: new Date().toISOString(),
    errors,
    warnings,
    previous: previousStats,
  };
}

/**
 * Get statistics from the previous index
 *
 * @param indexPath - Path to the index file
 * @returns Previous index stats
 */
function getPreviousIndexStats(indexPath: string): {
  fileCount: number;
  indexedAt: string | null;
} {
  if (!fs.existsSync(indexPath)) {
    return { fileCount: 0, indexedAt: null };
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const indexData = JSON.parse(content) as RagIndexData;
    return {
      fileCount: indexData.fileCount || 0,
      indexedAt: indexData.indexedAt || null,
    };
  } catch {
    return { fileCount: 0, indexedAt: null };
  }
}

/**
 * Backup the existing index file
 *
 * @param projectPath - Path to the project
 */
function backupIndex(projectPath: string): void {
  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');

  if (!fs.existsSync(indexPath)) {
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    projectPath,
    '.wundr',
    `rag-index.backup.${timestamp}.json`,
  );

  fs.copyFileSync(indexPath, backupPath);

  // Clean up old backups (keep only last 3)
  cleanupOldBackups(projectPath);
}

/**
 * Clean up old backup files, keeping only the most recent ones
 *
 * @param projectPath - Path to the project
 */
function cleanupOldBackups(projectPath: string): void {
  const wundrDir = path.join(projectPath, '.wundr');
  const files = fs.readdirSync(wundrDir);
  const backups = files
    .filter(f => f.startsWith('rag-index.backup.') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(wundrDir, f),
      mtime: fs.statSync(path.join(wundrDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  // Keep only the 3 most recent backups
  const toDelete = backups.slice(3);
  for (const backup of toDelete) {
    fs.unlinkSync(backup.path);
  }
}

/**
 * Delete the existing index file
 *
 * @param indexPath - Path to the index file
 */
function deleteIndex(indexPath: string): void {
  if (fs.existsSync(indexPath)) {
    fs.unlinkSync(indexPath);
  }
}

/**
 * Merge configurations, preserving original values unless overridden
 *
 * @param original - Original configuration
 * @param override - Override values
 * @returns Merged configuration
 */
function mergeConfigs(
  original: RagStoreConfig,
  override: Partial<RagStoreConfig>,
): RagStoreConfig {
  return {
    storeName: override.storeName ?? original.storeName,
    autoSync: override.autoSync ?? original.autoSync,
    syncOnSave: override.syncOnSave ?? original.syncOnSave,
    excludePatterns: override.excludePatterns ?? original.excludePatterns,
    includePatterns: override.includePatterns ?? original.includePatterns,
    chunkingConfig: {
      ...original.chunkingConfig,
      ...override.chunkingConfig,
    },
    metadata: {
      ...original.metadata,
      ...override.metadata,
    },
  };
}

/**
 * Index all files matching the configuration patterns
 *
 * @param projectPath - Path to the project
 * @param config - RAG configuration
 * @returns Array of indexed files
 */
async function indexAllFiles(
  projectPath: string,
  config: RagStoreConfig,
): Promise<IndexedFile[]> {
  const indexedFiles: IndexedFile[] = [];
  const seenPaths = new Set<string>();

  for (const pattern of config.includePatterns) {
    const files = await glob(pattern, {
      cwd: projectPath,
      ignore: [...config.excludePatterns],
      absolute: true,
      nodir: true,
    });

    for (const filePath of files) {
      const relativePath = path.relative(projectPath, filePath);

      // Avoid duplicates from overlapping patterns
      if (seenPaths.has(relativePath)) {
        continue;
      }
      seenPaths.add(relativePath);

      try {
        const stats = fs.statSync(filePath);
        indexedFiles.push({
          path: filePath,
          relativePath,
          size: stats.size,
          lastModified: stats.mtime,
        });
      } catch {
        // Skip files that can't be stat'd
      }
    }
  }

  return indexedFiles;
}

/**
 * Clear RAG store completely (configuration and index)
 *
 * @param projectPath - Path to the project
 * @param options - Options for clearing
 * @returns True if successfully cleared
 */
export function clearRagStore(
  projectPath: string,
  options: { preserveConfig?: boolean } = {},
): boolean {
  const wundrDir = path.join(projectPath, '.wundr');

  if (!fs.existsSync(wundrDir)) {
    return false;
  }

  // Files to remove
  const filesToRemove = ['rag-index.json'];

  if (!options.preserveConfig) {
    filesToRemove.push('rag-store.json', 'rag-exclude.txt');
  }

  // Also remove backup files
  const allFiles = fs.readdirSync(wundrDir);
  const backupFiles = allFiles.filter(f => f.startsWith('rag-index.backup.'));
  filesToRemove.push(...backupFiles);

  // Remove files
  for (const file of filesToRemove) {
    const filePath = path.join(wundrDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  return true;
}

/**
 * Get list of backup files
 *
 * @param projectPath - Path to the project
 * @returns List of backup files with metadata
 */
export function getBackupList(projectPath: string): Array<{
  readonly name: string;
  readonly path: string;
  readonly createdAt: Date;
  readonly size: number;
}> {
  const wundrDir = path.join(projectPath, '.wundr');

  if (!fs.existsSync(wundrDir)) {
    return [];
  }

  const files = fs.readdirSync(wundrDir);
  return files
    .filter(f => f.startsWith('rag-index.backup.') && f.endsWith('.json'))
    .map(f => {
      const fullPath = path.join(wundrDir, f);
      const stats = fs.statSync(fullPath);
      return {
        name: f,
        path: fullPath,
        createdAt: stats.mtime,
        size: stats.size,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Restore index from a backup file
 *
 * @param projectPath - Path to the project
 * @param backupName - Name of the backup file to restore
 * @returns True if successfully restored
 */
export function restoreFromBackup(
  projectPath: string,
  backupName: string,
): boolean {
  const wundrDir = path.join(projectPath, '.wundr');
  const backupPath = path.join(wundrDir, backupName);
  const indexPath = path.join(wundrDir, 'rag-index.json');

  if (!fs.existsSync(backupPath)) {
    return false;
  }

  try {
    // Validate backup is valid JSON
    const content = fs.readFileSync(backupPath, 'utf-8');
    JSON.parse(content);

    // Copy backup to index
    fs.copyFileSync(backupPath, indexPath);
    return true;
  } catch {
    return false;
  }
}
