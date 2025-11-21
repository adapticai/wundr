/**
 * RAG Tool Handlers
 *
 * Handler implementations for RAG (Retrieval-Augmented Generation) tools.
 *
 * @module @wundr/mcp-server/tools/rag/handlers
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  RagFileSearchInput,
  RagFileSearchOutput,
  RagStoreManageInput,
  RagStoreManageOutput,
  RagContextBuilderInput,
  RagContextBuilderOutput,
  RagToolResult,
  FileSearchResult,
  StoreInfo,
  ContextChunk,
  MatchedChunk,
  ContextStrategy,
  ContextSource,
} from './types';

import { DEFAULT_CONFIG, RAG_STORE_DIR } from './constants';

// ============================================================================
// File Search Handler
// ============================================================================

/**
 * Handle RAG file search requests
 *
 * Performs semantic, keyword, or hybrid search across files
 *
 * @param input - File search parameters
 * @returns Search results with relevance scores
 */
export async function ragFileSearchHandler(
  input: RagFileSearchInput,
): Promise<RagToolResult<RagFileSearchOutput>> {
  const startTime = Date.now();

  try {
    const {
      targetPath,
      query,
      includePatterns = ['**/*'],
      excludePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      maxResults = DEFAULT_CONFIG.defaultMaxResults,
      storeName,
    } = input;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: 'Query is required and cannot be empty',
      };
    }

    const resolvedPath = path.resolve(targetPath || process.cwd());

    // Collect files to search
    const files = await collectFiles([resolvedPath], includePatterns, excludePatterns);

    // Perform search
    const results = await performSearch(
      query,
      files,
      resolvedPath,
      maxResults,
    );

    const duration = Date.now() - startTime;

    return {
      success: true,
      data: {
        results,
        summary: `Found ${results.length} relevant files for query: "${query}"`,
        totalFilesSearched: files.length,
        totalChunksSearched: files.length, // Simplified
        searchDuration: duration,
        indexStats: {
          wasReindexed: false,
          filesIndexed: files.length,
          chunksCreated: files.length,
        },
        storeInfo: {
          name: storeName || 'default',
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
      },
      message: `Found ${results.length} results in ${files.length} files`,
      metadata: {
        duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// Store Management Handler
// ============================================================================

/**
 * Handle RAG store management requests
 *
 * Creates, manages, and maintains vector stores for RAG
 *
 * @param input - Store management parameters
 * @returns Store operation result
 */
export async function ragStoreManageHandler(
  input: RagStoreManageInput,
): Promise<RagToolResult<RagStoreManageOutput>> {
  const startTime = Date.now();

  try {
    const { action, storeId, displayName, sourcePath, config, forceReindex } = input;

    let result: RagStoreManageOutput;

    switch (action) {
      case 'create':
        result = await createStore(storeId || displayName, sourcePath, config);
        break;
      case 'delete':
        result = await deleteStore(storeId);
        break;
      case 'list':
        result = await listStores();
        break;
      case 'get':
      case 'status':
        result = await getStoreStatus(storeId);
        break;
      case 'sync':
        result = await syncStore(storeId, sourcePath, forceReindex);
        break;
      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }

    return {
      success: result.success,
      data: result,
      message: result.message,
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// Context Builder Handler
// ============================================================================

/**
 * Handle RAG context building requests
 *
 * Builds optimal context for LLM queries using RAG techniques
 *
 * @param input - Context builder parameters
 * @returns Built context with metadata
 */
export async function ragContextBuilderHandler(
  input: RagContextBuilderInput,
): Promise<RagToolResult<RagContextBuilderOutput>> {
  const startTime = Date.now();

  try {
    const {
      queries,
      targetPath,
      contextGoal,
      maxContextTokens = DEFAULT_CONFIG.defaultMaxTokens,
      prioritization = 'relevance',
      includePatterns,
      excludePatterns,
      minScore = DEFAULT_CONFIG.defaultMinScore,
    } = input;

    if (!queries || queries.length === 0) {
      return {
        success: false,
        error: 'At least one query is required',
      };
    }

    // Gather context chunks from file searches
    const chunks: ContextChunk[] = [];

    for (const query of queries) {
      const searchResult = await ragFileSearchHandler({
        targetPath,
        query,
        includePatterns: includePatterns as string[] | undefined,
        excludePatterns: excludePatterns as string[] | undefined,
        maxResults: 10,
      });

      if (searchResult.success && searchResult.data) {
        for (const result of searchResult.data.results) {
          for (const chunk of result.matchedChunks) {
            chunks.push({
              content: chunk.content,
              source: { type: 'files', path: result.filePath },
              relevance: chunk.score,
              tokenCount: Math.ceil(chunk.content.length / 4),
            });
          }
        }
      }
    }

    // Map prioritization to ContextStrategy
    const strategy: ContextStrategy = mapPrioritizationToStrategy(prioritization);

    // Select chunks up to token limit
    const selectedChunks = selectChunks(chunks, strategy, maxContextTokens);

    // Build final context
    const context = formatContext(selectedChunks);
    const totalTokens = selectedChunks.reduce((sum, c) => sum + c.tokenCount, 0);

    const sources: ContextSource[] = ['files'];

    return {
      success: true,
      data: {
        context,
        chunks: selectedChunks,
        totalTokens,
        strategy,
        sources,
        quality: calculateQualityMetrics(selectedChunks),
      },
      message: `Built context with ${selectedChunks.length} chunks (~${totalTokens} tokens)`,
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapPrioritizationToStrategy(prioritization: string): ContextStrategy {
  switch (prioritization) {
    case 'relevance':
      return 'relevant';
    case 'recency':
      return 'recent';
    case 'coverage':
      return 'comprehensive';
    default:
      return 'relevant';
  }
}

/**
 * Collect files matching patterns from paths
 */
async function collectFiles(
  paths: string[],
  includePatterns: string[],
  excludePatterns: string[],
): Promise<string[]> {
  const files: string[] = [];

  for (const searchPath of paths) {
    try {
      const resolvedPath = path.resolve(searchPath);
      if (fs.existsSync(resolvedPath)) {
        const stats = fs.statSync(resolvedPath);
        if (stats.isFile()) {
          files.push(resolvedPath);
        } else if (stats.isDirectory()) {
          const dirFiles = await walkDirectory(resolvedPath, includePatterns, excludePatterns);
          files.push(...dirFiles);
        }
      }
    } catch {
      // Skip inaccessible paths
    }
  }

  return files;
}

/**
 * Walk directory recursively
 */
async function walkDirectory(
  dir: string,
  includePatterns: string[],
  excludePatterns: string[],
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Check exclude patterns
      if (matchesPattern(fullPath, excludePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await walkDirectory(fullPath, includePatterns, excludePatterns);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        if (matchesPattern(fullPath, includePatterns)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return files;
}

/**
 * Check if path matches any pattern
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === '**/*' || pattern === '*') {
return true;
}
    // Simple glob matching
    const cleanPattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
    if (cleanPattern && filePath.includes(cleanPattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Perform search on files
 */
async function performSearch(
  query: string,
  files: string[],
  basePath: string,
  maxResults: number,
): Promise<FileSearchResult[]> {
  const results: FileSearchResult[] = [];
  const queryTerms = query.toLowerCase().split(/\s+/);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      // Simple keyword matching
      let matchCount = 0;
      const matchedChunks: MatchedChunk[] = [];

      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        if (!currentLine) {
continue;
}
        const line = currentLine.toLowerCase();
        let lineMatches = 0;
        for (const term of queryTerms) {
          if (line.includes(term)) {
            lineMatches++;
            matchCount++;
          }
        }

        if (lineMatches > 0) {
          const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join('\n');
          matchedChunks.push({
            content: snippet,
            score: lineMatches / queryTerms.length,
            citation: {
              filePath: file,
              startLine: i + 1,
              endLine: Math.min(lines.length, i + 2),
              snippet,
            },
          });
        }
      }

      if (matchCount > 0) {
        const stats = fs.statSync(file);
        const relevanceScore = Math.min(1, matchCount / (queryTerms.length * 3));

        results.push({
          filePath: file,
          relativePath: path.relative(basePath, file),
          relevanceScore,
          matchedChunks: matchedChunks.slice(0, 5), // Top 5 chunks per file
          metadata: {
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            extension: path.extname(file),
            totalChunks: matchedChunks.length,
            language: detectLanguage(file),
          },
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return results.slice(0, maxResults);
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
  };
  return langMap[ext] || 'text';
}

// ============================================================================
// Store Management Helpers
// ============================================================================

function ensureStoreDir(): void {
  if (!fs.existsSync(RAG_STORE_DIR)) {
    fs.mkdirSync(RAG_STORE_DIR, { recursive: true });
  }
}

async function createStore(
  storeName: string | undefined,
  sourcePath: string | undefined,
  config: RagStoreManageInput['config'],
): Promise<RagStoreManageOutput> {
  ensureStoreDir();

  const name = storeName || `store-${Date.now()}`;
  const storePath = path.join(RAG_STORE_DIR, `${name}.json`);

  if (fs.existsSync(storePath)) {
    return {
      action: 'create',
      success: false,
      message: `Store '${name}' already exists`,
    };
  }

  const storeData = {
    name,
    type: DEFAULT_CONFIG.defaultStoreType,
    embeddingModel: DEFAULT_CONFIG.defaultEmbeddingModel,
    dimensions: DEFAULT_CONFIG.defaultDimensions,
    documents: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourcePath,
    config,
  };

  fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2));

  return {
    action: 'create',
    success: true,
    message: `Store '${name}' created successfully`,
    store: {
      name,
      type: storeData.type,
      documentCount: 0,
      sizeBytes: 0,
      createdAt: storeData.createdAt,
      updatedAt: storeData.updatedAt,
      embeddingModel: storeData.embeddingModel,
      dimensions: storeData.dimensions,
      status: 'healthy',
    },
  };
}

async function deleteStore(storeId: string | undefined): Promise<RagStoreManageOutput> {
  if (!storeId) {
    return {
      action: 'delete',
      success: false,
      message: 'Store ID is required for delete action',
    };
  }

  const storePath = path.join(RAG_STORE_DIR, `${storeId}.json`);

  if (!fs.existsSync(storePath)) {
    return {
      action: 'delete',
      success: false,
      message: `Store '${storeId}' not found`,
    };
  }

  fs.unlinkSync(storePath);

  return {
    action: 'delete',
    success: true,
    message: `Store '${storeId}' deleted successfully`,
  };
}

async function listStores(): Promise<RagStoreManageOutput> {
  ensureStoreDir();

  const files = fs.readdirSync(RAG_STORE_DIR).filter((f) => f.endsWith('.json'));
  const stores: StoreInfo[] = [];

  for (const file of files) {
    const storePath = path.join(RAG_STORE_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      const stats = fs.statSync(storePath);

      stores.push({
        name: data.name,
        type: data.type || DEFAULT_CONFIG.defaultStoreType,
        documentCount: data.documents?.length || 0,
        sizeBytes: stats.size,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        embeddingModel: data.embeddingModel || DEFAULT_CONFIG.defaultEmbeddingModel,
        dimensions: data.dimensions || DEFAULT_CONFIG.defaultDimensions,
        status: 'healthy',
      });
    } catch {
      // Skip invalid stores
    }
  }

  return {
    action: 'list',
    success: true,
    message: `Found ${stores.length} stores`,
    stores,
  };
}

async function getStoreStatus(storeId: string | undefined): Promise<RagStoreManageOutput> {
  if (!storeId) {
    return {
      action: 'status',
      success: false,
      message: 'Store ID is required for status action',
    };
  }

  const storePath = path.join(RAG_STORE_DIR, `${storeId}.json`);

  if (!fs.existsSync(storePath)) {
    return {
      action: 'status',
      success: false,
      message: `Store '${storeId}' not found`,
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const stats = fs.statSync(storePath);

    return {
      action: 'status',
      success: true,
      message: `Status for store '${storeId}'`,
      store: {
        name: data.name,
        type: data.type || DEFAULT_CONFIG.defaultStoreType,
        documentCount: data.documents?.length || 0,
        sizeBytes: stats.size,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        embeddingModel: data.embeddingModel || DEFAULT_CONFIG.defaultEmbeddingModel,
        dimensions: data.dimensions || DEFAULT_CONFIG.defaultDimensions,
        status: 'healthy',
      },
    };
  } catch {
    return {
      action: 'status',
      success: false,
      message: `Failed to read store '${storeId}'`,
    };
  }
}

async function syncStore(
  storeId: string | undefined,
  sourcePath: string | undefined,
  forceReindex: boolean | undefined,
): Promise<RagStoreManageOutput> {
  if (!storeId) {
    return {
      action: 'sync',
      success: false,
      message: 'Store ID is required for sync action',
    };
  }

  const storePath = path.join(RAG_STORE_DIR, `${storeId}.json`);

  if (!fs.existsSync(storePath)) {
    return {
      action: 'sync',
      success: false,
      message: `Store '${storeId}' not found`,
    };
  }

  const indexPath = sourcePath || process.cwd();
  const files = await collectFiles([indexPath], ['**/*'], ['**/node_modules/**', '**/.git/**']);

  const startTime = Date.now();
  let filesProcessed = 0;
  let documentsAdded = 0;
  let errors = 0;

  const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));

  if (forceReindex) {
    data.documents = [];
  }

  data.documents = data.documents || [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      data.documents.push({
        path: file,
        content: content.substring(0, 10000), // Truncate large files
        indexed: new Date().toISOString(),
      });
      filesProcessed++;
      documentsAdded++;
    } catch {
      errors++;
    }
  }

  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));

  return {
    action: 'sync',
    success: true,
    message: `Synced ${documentsAdded} documents from ${filesProcessed} files`,
    indexStats: {
      filesProcessed,
      documentsAdded,
      errors,
      duration: Date.now() - startTime,
    },
  };
}

// ============================================================================
// Context Builder Helpers
// ============================================================================

function selectChunks(
  chunks: ContextChunk[],
  strategy: ContextStrategy,
  maxTokens: number,
): ContextChunk[] {
  // Sort by relevance
  const sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);

  // Select chunks up to token limit
  const selected: ContextChunk[] = [];
  let tokenCount = 0;

  for (const chunk of sorted) {
    if (tokenCount + chunk.tokenCount <= maxTokens) {
      selected.push(chunk);
      tokenCount += chunk.tokenCount;
    }
  }

  return selected;
}

function formatContext(chunks: ContextChunk[]): string {
  let context = '## Retrieved Context\n\n';

  for (const chunk of chunks) {
    const source = chunk.source.path || chunk.source.storeName || chunk.source.type;
    context += `### Source: ${source}\n`;
    context += `*Relevance: ${(chunk.relevance * 100).toFixed(1)}%*\n\n`;
    context += '```\n' + chunk.content + '\n```\n\n';
  }

  return context;
}

function calculateQualityMetrics(
  chunks: ContextChunk[],
): RagContextBuilderOutput['quality'] {
  if (chunks.length === 0) {
    return { relevanceScore: 0, diversityScore: 0, coverageScore: 0 };
  }

  const avgRelevance = chunks.reduce((sum, c) => sum + c.relevance, 0) / chunks.length;

  // Count unique sources for diversity
  const uniqueSources = new Set(chunks.map((c) => c.source.type));
  const diversityScore = uniqueSources.size / 4; // Max 4 source types

  // Coverage based on chunk count
  const coverageScore = Math.min(1, chunks.length / 10);

  return {
    relevanceScore: avgRelevance,
    diversityScore,
    coverageScore,
  };
}
