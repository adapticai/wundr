/**
 * Project RAG Sync
 *
 * Provides functionality for incremental synchronization of RAG indexes,
 * detecting and processing only changed files since the last sync.
 */

import * as fs from 'fs';
import * as path from 'path';

import { glob } from 'glob';

import {
  type RagStoreConfig,
  getRagStorePath,
  loadRagConfig,
} from './project-rag-config.js';
import { type IndexedFile, isRagInitialized } from './project-rag-init.js';

/**
 * Sync statistics returned after synchronization
 */
export interface RagSyncStats {
  /** Number of new files added to the index */
  readonly added: number;
  /** Number of files modified and re-indexed */
  readonly modified: number;
  /** Number of files removed from the index */
  readonly deleted: number;
  /** Total files in the index after sync */
  readonly total: number;
  /** Timestamp of the sync operation */
  readonly syncedAt: string;
  /** Duration of sync in milliseconds */
  readonly durationMs: number;
}

/**
 * Sync options for customizing sync behavior
 */
export interface RagSyncOptions {
  /** Force full sync even if incremental is possible */
  readonly forceFullSync?: boolean;
  /** Dry run - report changes without applying */
  readonly dryRun?: boolean;
  /** Custom patterns to include (overrides config) */
  readonly includePatterns?: readonly string[];
  /** Custom patterns to exclude (overrides config) */
  readonly excludePatterns?: readonly string[];
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
 * Synchronize project RAG index with current file state
 *
 * This function performs incremental synchronization by:
 * 1. Detecting files added since last sync
 * 2. Detecting files modified since last sync
 * 3. Removing files that no longer exist
 *
 * @param projectPath - Path to the project directory
 * @param options - Sync options
 * @returns Sync statistics
 */
export async function syncProjectRag(
  projectPath: string,
  options: RagSyncOptions = {},
): Promise<RagSyncStats> {
  const startTime = Date.now();

  // Validate project has RAG initialized
  if (!isRagInitialized(projectPath)) {
    throw new Error(`RAG not initialized for project: ${projectPath}`);
  }

  // Load configuration
  const configPath = getRagStorePath(projectPath);
  const config = loadRagConfig(configPath);
  if (!config) {
    throw new Error(`Failed to load RAG configuration from: ${configPath}`);
  }

  // Load existing index
  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');
  const existingIndex = loadIndexFile(indexPath);

  // Get current file state
  const currentFiles = await getCurrentFiles(projectPath, config, options);

  // Build maps for comparison
  const existingMap = new Map(
    existingIndex.files.map(f => [f.path, f]),
  );
  const currentMap = new Map(
    currentFiles.map(f => [f.relativePath, f]),
  );

  // Detect changes
  const added: IndexedFile[] = [];
  const modified: IndexedFile[] = [];
  const deleted: string[] = [];

  // Find added and modified files
  for (const file of currentFiles) {
    const existing = existingMap.get(file.relativePath);
    if (!existing) {
      added.push(file);
    } else if (file.lastModified.toISOString() !== existing.lastModified) {
      modified.push(file);
    }
  }

  // Find deleted files
  for (const existingFile of existingIndex.files) {
    if (!currentMap.has(existingFile.path)) {
      deleted.push(existingFile.path);
    }
  }

  // Apply changes unless dry run
  if (!options.dryRun) {
    // Update index with current state
    const updatedIndex: RagIndexData = {
      version: '1.0.0',
      indexedAt: existingIndex.indexedAt,
      lastSyncAt: new Date().toISOString(),
      fileCount: currentFiles.length,
      files: currentFiles.map(f => ({
        path: f.relativePath,
        size: f.size,
        lastModified: f.lastModified.toISOString(),
      })),
    };

    fs.writeFileSync(indexPath, JSON.stringify(updatedIndex, null, 2), 'utf-8');
  }

  const durationMs = Date.now() - startTime;

  return {
    added: added.length,
    modified: modified.length,
    deleted: deleted.length,
    total: currentFiles.length,
    syncedAt: new Date().toISOString(),
    durationMs,
  };
}

/**
 * Load existing index file or return empty index
 *
 * @param indexPath - Path to the index file
 * @returns Index data
 */
function loadIndexFile(indexPath: string): RagIndexData {
  if (!fs.existsSync(indexPath)) {
    return {
      version: '1.0.0',
      indexedAt: new Date().toISOString(),
      fileCount: 0,
      files: [],
    };
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as RagIndexData;
  } catch {
    return {
      version: '1.0.0',
      indexedAt: new Date().toISOString(),
      fileCount: 0,
      files: [],
    };
  }
}

/**
 * Get current files matching the configuration patterns
 *
 * @param projectPath - Path to the project
 * @param config - RAG configuration
 * @param options - Sync options
 * @returns Array of indexed files
 */
async function getCurrentFiles(
  projectPath: string,
  config: RagStoreConfig,
  options: RagSyncOptions,
): Promise<IndexedFile[]> {
  const includePatterns = options.includePatterns ?? config.includePatterns;
  const excludePatterns = options.excludePatterns ?? config.excludePatterns;

  const indexedFiles: IndexedFile[] = [];
  const seenPaths = new Set<string>();

  for (const pattern of includePatterns) {
    const files = await glob(pattern, {
      cwd: projectPath,
      ignore: [...excludePatterns],
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
 * Get the last sync timestamp for a project
 *
 * @param projectPath - Path to the project
 * @returns Last sync timestamp or null if never synced
 */
export function getLastSyncTime(projectPath: string): Date | null {
  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content) as RagIndexData;
    return index.lastSyncAt ? new Date(index.lastSyncAt) : null;
  } catch {
    return null;
  }
}

/**
 * Check if sync is needed based on file changes
 *
 * @param projectPath - Path to the project
 * @returns True if sync is recommended
 */
export async function isSyncNeeded(projectPath: string): Promise<boolean> {
  if (!isRagInitialized(projectPath)) {
    return false;
  }

  const configPath = getRagStorePath(projectPath);
  const config = loadRagConfig(configPath);
  if (!config) {
    return false;
  }

  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');
  const existingIndex = loadIndexFile(indexPath);
  const currentFiles = await getCurrentFiles(projectPath, config, {});

  // Quick check: different file count means changes exist
  if (currentFiles.length !== existingIndex.fileCount) {
    return true;
  }

  // Build map for detailed comparison
  const existingMap = new Map(
    existingIndex.files.map(f => [f.path, f.lastModified]),
  );

  for (const file of currentFiles) {
    const existingTime = existingMap.get(file.relativePath);
    if (!existingTime || file.lastModified.toISOString() !== existingTime) {
      return true;
    }
  }

  return false;
}
