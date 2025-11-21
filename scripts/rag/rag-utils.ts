/**
 * RAG Utilities for Wundr
 * TypeScript utility functions for RAG CLI operations
 */

import { existsSync, readdirSync, statSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

// Types
export interface RAGConfig {
  version: string;
  stores: {
    global: StoreConfig;
    'project-specific': StoreConfig;
  };
  embeddings: EmbeddingsConfig;
  indexing: IndexingConfig;
  retrieval: RetrievalConfig;
}

export interface StoreConfig {
  path: string;
  description: string;
  autoSync: boolean;
  pruneDeleted: boolean;
}

export interface EmbeddingsConfig {
  model: string;
  dimensions: number;
  batchSize: number;
}

export interface IndexingConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxTokens: number;
}

export interface RetrievalConfig {
  topK: number;
  minScore: number;
}

export interface StoreMetadata {
  name: string;
  path: string;
  embeddingCount: number;
  lastSync: string | null;
  lastPrune: string | null;
  lastIndex: string | null;
  status: 'ready' | 'syncing' | 'error' | 'unknown';
  sourceDir?: string;
}

export interface SyncResult {
  store: string;
  filesProcessed: number;
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  duration: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

export interface PruneResult {
  store: string;
  entriesRemoved: number;
  bytesFreed: number;
  duration: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

export interface ReindexResult {
  store: string;
  entriesIndexed: number;
  duration: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

export interface StatusReport {
  timestamp: string;
  stores: StoreMetadata[];
  totalEmbeddings: number;
  totalDiskUsage: string;
  configPath: string;
}

// Constants
const RAG_BASE_DIR = path.join(process.env.HOME || '~', '.wundr', 'rag-stores');
const RAG_GLOBAL_DIR = path.join(RAG_BASE_DIR, 'global');
const RAG_PROJECT_DIR = path.join(RAG_BASE_DIR, 'project-specific');
const CONFIG_FILE = path.join(RAG_BASE_DIR, 'config.json');

// Utility functions
function getTimestamp(): string {
  return new Date().toISOString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
return '0 Bytes';
}
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) {
return 0;
}

  let totalSize = 0;
  const files = readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      totalSize += getDirSize(filePath);
    } else {
      totalSize += stat.size;
    }
  }

  return totalSize;
}

// RAG Configuration
export async function loadConfig(): Promise<RAGConfig> {
  try {
    const configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(configContent) as RAGConfig;
  } catch {
    // Return default config if file doesn't exist
    return {
      version: '1.0.0',
      stores: {
        global: {
          path: RAG_GLOBAL_DIR,
          description: 'Global RAG store for shared knowledge',
          autoSync: true,
          pruneDeleted: true,
        },
        'project-specific': {
          path: RAG_PROJECT_DIR,
          description: 'Project-specific RAG stores',
          autoSync: false,
          pruneDeleted: false,
        },
      },
      embeddings: {
        model: 'text-embedding-004',
        dimensions: 768,
        batchSize: 100,
      },
      indexing: {
        chunkSize: 1000,
        chunkOverlap: 200,
        maxTokens: 8192,
      },
      retrieval: {
        topK: 5,
        minScore: 0.7,
      },
    };
  }
}

export async function saveConfig(config: RAGConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Store Management
export async function getAllStores(): Promise<string[]> {
  const stores: string[] = [];

  // Add global store
  if (existsSync(RAG_GLOBAL_DIR)) {
    stores.push(RAG_GLOBAL_DIR);
  }

  // Add project-specific stores
  if (existsSync(RAG_PROJECT_DIR)) {
    const projectStores = readdirSync(RAG_PROJECT_DIR);
    for (const store of projectStores) {
      const storePath = path.join(RAG_PROJECT_DIR, store);
      if (statSync(storePath).isDirectory()) {
        stores.push(storePath);
      }
    }
  }

  return stores;
}

export async function getStoreMetadata(storePath: string): Promise<StoreMetadata> {
  const name = path.basename(storePath);
  const embeddingsDir = path.join(storePath, 'embeddings');
  const syncMetadata = path.join(storePath, 'metadata', 'sync.json');
  const pruneMetadata = path.join(storePath, 'metadata', 'prune.json');
  const indexMetadata = path.join(storePath, 'metadata', 'index.json');

  let embeddingCount = 0;
  if (existsSync(embeddingsDir)) {
    const files = readdirSync(embeddingsDir).filter(f => f.endsWith('.json'));
    embeddingCount = files.length;
  }

  let lastSync: string | null = null;
  let sourceDir: string | undefined;
  let status: StoreMetadata['status'] = 'unknown';

  if (existsSync(syncMetadata)) {
    try {
      const syncData = JSON.parse(await fs.readFile(syncMetadata, 'utf-8'));
      lastSync = syncData.lastSync || null;
      sourceDir = syncData.sourceDir;
      status = syncData.status === 'synced' ? 'ready' : syncData.status;
    } catch {
      // Ignore parse errors
    }
  }

  let lastPrune: string | null = null;
  if (existsSync(pruneMetadata)) {
    try {
      const pruneData = JSON.parse(await fs.readFile(pruneMetadata, 'utf-8'));
      lastPrune = pruneData.lastPrune || null;
    } catch {
      // Ignore parse errors
    }
  }

  let lastIndex: string | null = null;
  if (existsSync(indexMetadata)) {
    try {
      const indexData = JSON.parse(await fs.readFile(indexMetadata, 'utf-8'));
      lastIndex = indexData.lastIndex || null;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    name,
    path: storePath,
    embeddingCount,
    lastSync,
    lastPrune,
    lastIndex,
    status,
    sourceDir,
  };
}

export async function createStore(
  name: string,
  sourceDir: string,
  options: { global?: boolean } = {},
): Promise<string> {
  const baseDir = options.global ? RAG_GLOBAL_DIR : path.join(RAG_PROJECT_DIR, name);

  // Create store directories
  await fs.mkdir(path.join(baseDir, 'embeddings'), { recursive: true });
  await fs.mkdir(path.join(baseDir, 'indexes'), { recursive: true });
  await fs.mkdir(path.join(baseDir, 'metadata'), { recursive: true });
  await fs.mkdir(path.join(baseDir, 'cache'), { recursive: true });

  // Create source metadata
  const sourceMetadata = {
    sourceDir,
    created: getTimestamp(),
    name,
    type: options.global ? 'global' : 'project-specific',
  };

  await fs.writeFile(
    path.join(baseDir, 'metadata', 'source.json'),
    JSON.stringify(sourceMetadata, null, 2),
  );

  return baseDir;
}

// Sync Command Implementation
export async function syncStore(storePath: string): Promise<SyncResult> {
  const startTime = Date.now();
  const storeName = path.basename(storePath);

  try {
    const sourceMetadataPath = path.join(storePath, 'metadata', 'source.json');

    if (!existsSync(sourceMetadataPath)) {
      return {
        store: storeName,
        filesProcessed: 0,
        filesAdded: 0,
        filesUpdated: 0,
        filesRemoved: 0,
        duration: Date.now() - startTime,
        status: 'skipped',
        error: 'No source metadata found',
      };
    }

    const sourceMetadata = JSON.parse(await fs.readFile(sourceMetadataPath, 'utf-8'));
    const sourceDir = sourceMetadata.sourceDir;

    if (!sourceDir || !existsSync(sourceDir)) {
      return {
        store: storeName,
        filesProcessed: 0,
        filesAdded: 0,
        filesUpdated: 0,
        filesRemoved: 0,
        duration: Date.now() - startTime,
        status: 'skipped',
        error: `Source directory not found: ${sourceDir}`,
      };
    }

    // Count files that would be synced
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.md', '.json'];
    let filesProcessed = 0;

    const countFiles = (dir: string): void => {
      if (!existsSync(dir)) {
return;
}
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          countFiles(fullPath);
        } else if (stat.isFile() && extensions.some(ext => entry.endsWith(ext))) {
          filesProcessed++;
        }
      }
    };

    countFiles(sourceDir);

    // Update sync metadata
    const syncMetadata = {
      lastSync: getTimestamp(),
      filesCount: filesProcessed,
      sourceDir,
      status: 'synced',
    };

    await fs.writeFile(
      path.join(storePath, 'metadata', 'sync.json'),
      JSON.stringify(syncMetadata, null, 2),
    );

    return {
      store: storeName,
      filesProcessed,
      filesAdded: filesProcessed, // In a real implementation, track actual changes
      filesUpdated: 0,
      filesRemoved: 0,
      duration: Date.now() - startTime,
      status: 'success',
    };
  } catch (error) {
    return {
      store: storeName,
      filesProcessed: 0,
      filesAdded: 0,
      filesUpdated: 0,
      filesRemoved: 0,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function syncAllStores(): Promise<SyncResult[]> {
  const stores = await getAllStores();
  const results: SyncResult[] = [];

  for (const store of stores) {
    const result = await syncStore(store);
    results.push(result);
  }

  return results;
}

// Prune Command Implementation
export async function pruneStore(storePath: string): Promise<PruneResult> {
  const startTime = Date.now();
  const storeName = path.basename(storePath);

  try {
    const embeddingsDir = path.join(storePath, 'embeddings');
    const sourceMetadataPath = path.join(storePath, 'metadata', 'source.json');

    if (!existsSync(sourceMetadataPath)) {
      return {
        store: storeName,
        entriesRemoved: 0,
        bytesFreed: 0,
        duration: Date.now() - startTime,
        status: 'skipped',
        error: 'No source metadata found',
      };
    }

    const sourceMetadata = JSON.parse(await fs.readFile(sourceMetadataPath, 'utf-8'));
    const _sourceDir = sourceMetadata.sourceDir;

    let entriesRemoved = 0;
    let bytesFreed = 0;

    if (existsSync(embeddingsDir)) {
      const embeddingFiles = readdirSync(embeddingsDir).filter(f => f.endsWith('.json'));

      for (const file of embeddingFiles) {
        const embeddingPath = path.join(embeddingsDir, file);

        try {
          const embeddingData = JSON.parse(await fs.readFile(embeddingPath, 'utf-8'));
          const originalPath = embeddingData.originalPath;

          if (originalPath && !existsSync(originalPath)) {
            const stat = statSync(embeddingPath);
            bytesFreed += stat.size;
            await fs.unlink(embeddingPath);
            entriesRemoved++;
          }
        } catch {
          // Skip files that can't be parsed
        }
      }
    }

    // Update prune metadata
    const pruneMetadata = {
      lastPrune: getTimestamp(),
      prunedCount: entriesRemoved,
      bytesFreed,
      status: 'completed',
    };

    await fs.writeFile(
      path.join(storePath, 'metadata', 'prune.json'),
      JSON.stringify(pruneMetadata, null, 2),
    );

    return {
      store: storeName,
      entriesRemoved,
      bytesFreed,
      duration: Date.now() - startTime,
      status: 'success',
    };
  } catch (error) {
    return {
      store: storeName,
      entriesRemoved: 0,
      bytesFreed: 0,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pruneAllStores(): Promise<PruneResult[]> {
  const stores = await getAllStores();
  const results: PruneResult[] = [];

  for (const store of stores) {
    const result = await pruneStore(store);
    results.push(result);
  }

  return results;
}

// Reindex Command Implementation
export async function reindexStore(storePath: string): Promise<ReindexResult> {
  const startTime = Date.now();
  const storeName = path.basename(storePath);

  try {
    const embeddingsDir = path.join(storePath, 'embeddings');
    const indexesDir = path.join(storePath, 'indexes');

    // Ensure indexes directory exists
    await fs.mkdir(indexesDir, { recursive: true });

    // Count embeddings
    let embeddingCount = 0;
    if (existsSync(embeddingsDir)) {
      const files = readdirSync(embeddingsDir).filter(f => f.endsWith('.json'));
      embeddingCount = files.length;
    }

    // Generate index file
    const indexFile = path.join(indexesDir, 'main.json');
    const indexData = {
      version: '1.0.0',
      created: getTimestamp(),
      updated: getTimestamp(),
      embeddingCount,
      indexType: 'flat',
      status: 'ready',
    };

    await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2));

    // Update index metadata
    const indexMetadata = {
      lastIndex: getTimestamp(),
      totalEmbeddings: embeddingCount,
      indexFile,
      status: 'indexed',
    };

    await fs.writeFile(
      path.join(storePath, 'metadata', 'index.json'),
      JSON.stringify(indexMetadata, null, 2),
    );

    return {
      store: storeName,
      entriesIndexed: embeddingCount,
      duration: Date.now() - startTime,
      status: 'success',
    };
  } catch (error) {
    return {
      store: storeName,
      entriesIndexed: 0,
      duration: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function reindexAllStores(): Promise<ReindexResult[]> {
  const stores = await getAllStores();
  const results: ReindexResult[] = [];

  for (const store of stores) {
    const result = await reindexStore(store);
    results.push(result);
  }

  return results;
}

// Status Command Implementation
export async function getStatus(): Promise<StatusReport> {
  const stores = await getAllStores();
  const storeMetadata: StoreMetadata[] = [];
  let totalEmbeddings = 0;

  for (const store of stores) {
    const metadata = await getStoreMetadata(store);
    storeMetadata.push(metadata);
    totalEmbeddings += metadata.embeddingCount;
  }

  const totalSize = getDirSize(RAG_BASE_DIR);

  return {
    timestamp: getTimestamp(),
    stores: storeMetadata,
    totalEmbeddings,
    totalDiskUsage: formatBytes(totalSize),
    configPath: CONFIG_FILE,
  };
}

export function formatStatusReport(report: StatusReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('RAG Store Status Report');
  lines.push('='.repeat(70));
  lines.push(`Timestamp: ${report.timestamp}`);
  lines.push(`Config: ${report.configPath}`);
  lines.push(`Total Embeddings: ${report.totalEmbeddings}`);
  lines.push(`Disk Usage: ${report.totalDiskUsage}`);
  lines.push('');
  lines.push('-'.repeat(70));
  lines.push(
    padRight('Store', 25) +
    padRight('Embeddings', 12) +
    padRight('Last Sync', 18) +
    padRight('Status', 15),
  );
  lines.push('-'.repeat(70));

  for (const store of report.stores) {
    const lastSync = store.lastSync
      ? new Date(store.lastSync).toLocaleDateString()
      : 'Never';

    lines.push(
      padRight(store.name, 25) +
      padRight(String(store.embeddingCount), 12) +
      padRight(lastSync, 18) +
      padRight(store.status, 15),
    );
  }

  lines.push('-'.repeat(70));
  lines.push('');

  return lines.join('\n');
}

function padRight(str: string, length: number): string {
  return str.length >= length ? str : str + ' '.repeat(length - str.length);
}

// CLI Entry Point
export async function runCLI(args: string[]): Promise<void> {
  const command = args[0] || 'status';
  const _options = args.slice(1);

  switch (command) {
    case 'sync': {
      console.log('Syncing RAG stores...\n');
      const results = await syncAllStores();
      for (const result of results) {
        const statusIcon = result.status === 'success' ? '[OK]' : '[SKIP]';
        console.log(
          `${statusIcon} ${result.store}: ${result.filesProcessed} files (${result.duration}ms)`,
        );
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      }
      break;
    }

    case 'prune': {
      console.log('Pruning RAG stores...\n');
      const results = await pruneAllStores();
      for (const result of results) {
        const statusIcon = result.status === 'success' ? '[OK]' : '[SKIP]';
        console.log(
          `${statusIcon} ${result.store}: ${result.entriesRemoved} entries removed (${result.duration}ms)`,
        );
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      }
      break;
    }

    case 'reindex': {
      console.log('Re-indexing RAG stores...\n');
      const results = await reindexAllStores();
      for (const result of results) {
        const statusIcon = result.status === 'success' ? '[OK]' : '[SKIP]';
        console.log(
          `${statusIcon} ${result.store}: ${result.entriesIndexed} entries indexed (${result.duration}ms)`,
        );
        if (result.error) {
          console.log(`    Error: ${result.error}`);
        }
      }
      break;
    }

    case 'status':
    default: {
      const report = await getStatus();
      console.log(formatStatusReport(report));
      break;
    }
  }
}

// Export for direct CLI execution
if (require.main === module) {
  runCLI(process.argv.slice(2)).catch(console.error);
}
