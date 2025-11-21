/**
 * Gemini RAG Service
 *
 * Provides integration with Google Gemini API for RAG (Retrieval-Augmented Generation)
 * operations including file upload, vector store management, and semantic search.
 *
 * @module @wundr/mcp-server/services/gemini
 */

import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import type {
  IRAGService,
  RAGChunk,
  RAGSearchOptions,
  RAGSearchResult,
  RAGServiceConfig,
  RAGStore,
  StoreConfig,
  StoreStatus,
  QueryResult,
  SyncResult,
  StoreStats,
  StoreHealthStatus,
  IndexedFile,
} from '../../tools/rag/types';
import { FileProcessor, FileProcessorOptions, ProcessedChunk } from './file-processor';
import { TextChunker, ChunkOptions, ChunkResult } from './chunker';

// Re-export types from sub-modules
export * from './chunker';
export * from './file-processor';

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Extended configuration for Gemini RAG Service
 */
export interface GeminiRAGConfig extends RAGServiceConfig {
  /** Model to use for generation (default: 'gemini-1.5-flash') */
  generationModel?: string;
  /** Default chunk options */
  chunkOptions?: ChunkOptions;
  /** Default file processor options */
  fileProcessorOptions?: FileProcessorOptions;
  /** Maximum retries for API calls */
  maxRetries?: number;
  /** Base delay for retry backoff in ms */
  retryBaseDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Vector store configuration for creation
 */
export interface VectorStoreConfig {
  /** Store name */
  name: string;
  /** Store description */
  description?: string;
  /** Whether store persists across sessions */
  persistent?: boolean;
  /** Embedding dimension (default: 768 for text-embedding-004) */
  dimension?: number;
  /** Store configuration */
  storeConfig?: StoreConfig;
}

/**
 * Document in vector store
 */
export interface VectorDocument {
  /** Unique document ID */
  id: string;
  /** Source file path */
  filePath: string;
  /** Document content */
  content: string;
  /** Embedding vector */
  embedding: number[];
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Chunk information */
  chunk: {
    index: number;
    startLine: number;
    endLine: number;
    totalChunks: number;
  };
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Source file path */
  filePath: string;
  /** File name */
  fileName: string;
  /** File extension */
  extension: string;
  /** Programming language */
  language?: string;
  /** Relative path */
  relativePath?: string;
  /** Line range */
  lineRange: { start: number; end: number };
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Search query options
 */
export interface SearchOptions extends RAGSearchOptions {
  /** Rerank results using LLM */
  rerank?: boolean;
  /** Include embeddings in results */
  includeEmbeddings?: boolean;
  /** Metadata filters */
  filters?: MetadataFilterItem[];
}

/**
 * Metadata filter for search
 */
export interface MetadataFilterItem {
  /** Field to filter on */
  field: string;
  /** Filter operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  /** Filter value */
  value: string | number | boolean | string[];
}

/**
 * Search result with extended metadata
 */
export interface ExtendedSearchResult {
  /** Document ID */
  documentId: string;
  /** Similarity score (0-1) */
  score: number;
  /** Document content */
  content: string;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Chunk information */
  chunk: {
    index: number;
    startLine: number;
    endLine: number;
  };
  /** Embedding vector (if requested) */
  embedding?: number[];
}

/**
 * File upload options
 */
export interface UploadOptions {
  /** Custom metadata to add */
  metadata?: Record<string, unknown>;
  /** Override chunk options */
  chunkOptions?: ChunkOptions;
  /** Process in parallel */
  parallel?: boolean;
  /** Batch size for parallel processing */
  batchSize?: number;
}

/**
 * Upload result
 */
export interface UploadResult {
  /** Store ID files were uploaded to */
  storeId: string;
  /** Files successfully uploaded */
  filesUploaded: string[];
  /** Files that failed */
  filesFailed: Array<{ path: string; error: string }>;
  /** Total documents created */
  documentsCreated: number;
  /** Total chunks created */
  chunksCreated: number;
  /** Upload duration in ms */
  durationMs: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<GeminiRAGConfig> = {
  apiKey: process.env['GEMINI_API_KEY'] || '',
  embeddingModel: 'text-embedding-004',
  generationModel: 'gemini-1.5-flash',
  maxChunksPerQuery: 20,
  defaultMinScore: 0.5,
  chunkOptions: {},
  fileProcessorOptions: {},
  maxRetries: 3,
  retryBaseDelay: 1000,
  debug: false,
  cache: {
    enabled: true,
    ttlMs: 300000,
  },
};

// =============================================================================
// Internal Types
// =============================================================================

/**
 * In-memory vector store implementation
 */
interface InMemoryStore {
  config: RAGStore;
  documents: Map<string, VectorDocument>;
  indexedFiles: Map<string, IndexedFile>;
}

/**
 * Cached search result
 */
interface CachedSearchResult {
  result: RAGSearchResult;
  timestamp: number;
}

// =============================================================================
// Gemini RAG Service Implementation
// =============================================================================

/**
 * GeminiRAGService provides semantic search capabilities using Gemini embeddings.
 *
 * Features:
 * - Real Gemini API integration for embeddings
 * - Vector store management (create, delete, list)
 * - File upload and indexing with chunking
 * - Semantic search with metadata filtering
 * - Retry logic and error handling
 * - LLM-based reranking
 */
export class GeminiRAGService implements IRAGService {
  private readonly config: Required<GeminiRAGConfig>;
  private readonly client: GoogleGenAI | null;
  private readonly stores: Map<string, InMemoryStore>;
  private readonly searchCache: Map<string, CachedSearchResult>;
  private readonly fileProcessor: FileProcessor;
  private readonly chunker: TextChunker;

  constructor(config: GeminiRAGConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      cache: {
        ...DEFAULT_CONFIG.cache,
        ...config.cache,
      },
    };

    // Initialize Gemini client if API key is available
    if (this.config.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.config.apiKey });
    } else {
      this.client = null;
      this.log('No API key provided - running in mock mode');
    }

    this.stores = new Map();
    this.searchCache = new Map();
    this.fileProcessor = new FileProcessor(this.config.fileProcessorOptions);
    this.chunker = new TextChunker(this.config.chunkOptions);
  }

  // =============================================================================
  // Private Utility Methods
  // =============================================================================

  /**
   * Log debug message
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.error(`[GeminiRAG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  /**
   * Execute with retry logic
   */
  private async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt === this.config.maxRetries - 1) {
          throw lastError;
        }

        const delay = this.config.retryBaseDelay * Math.pow(2, attempt);
        this.log(`Retry ${attempt + 1}/${this.config.maxRetries} for ${context} after ${delay}ms`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`Failed after ${this.config.maxRetries} retries`);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'rate limit',
      'quota exceeded',
      'timeout',
      'temporarily unavailable',
      'internal server error',
      '429',
      '500',
      '502',
      '503',
      '504',
    ];

    const message = error.message.toLowerCase();
    return retryableMessages.some((msg) => message.includes(msg));
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Check if metadata matches filters
   */
  private matchesFilters(metadata: DocumentMetadata, filters: MetadataFilterItem[]): boolean {
    for (const filter of filters) {
      const value = this.getNestedValue(metadata as unknown as Record<string, unknown>, filter.field);

      if (value === undefined) {
        return false;
      }

      switch (filter.operator) {
        case 'eq':
          if (value !== filter.value) {
return false;
}
          break;
        case 'ne':
          if (value === filter.value) {
return false;
}
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= (filter.value as number)) {
return false;
}
          break;
        case 'lt':
          if (typeof value !== 'number' || value >= (filter.value as number)) {
return false;
}
          break;
        case 'gte':
          if (typeof value !== 'number' || value < (filter.value as number)) {
return false;
}
          break;
        case 'lte':
          if (typeof value !== 'number' || value > (filter.value as number)) {
return false;
}
          break;
        case 'in':
          if (!Array.isArray(filter.value) || !filter.value.includes(value as string)) {
return false;
}
          break;
        case 'contains':
          if (typeof value !== 'string' || !value.includes(filter.value as string)) {
return false;
}
          break;
      }
    }

    return true;
  }

  /**
   * Build cache key for search results
   */
  private buildCacheKey(query: string, targetPath: string, options?: RAGSearchOptions): string {
    return JSON.stringify({ query, targetPath, options });
  }

  /**
   * Get cached search result if valid
   */
  private getCachedResult(key: string): CachedSearchResult | null {
    if (!this.config.cache.enabled) {
return null;
}

    const cached = this.searchCache.get(key);
    if (!cached) {
return null;
}

    if (Date.now() - cached.timestamp > this.config.cache.ttlMs) {
      this.searchCache.delete(key);
      return null;
    }

    return cached;
  }

  // =============================================================================
  // Embedding Methods
  // =============================================================================

  /**
   * Generate embeddings for text using Gemini API
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      // Mock embedding for testing without API key
      return this.generateMockEmbedding(text);
    }

    return this.withRetry(async () => {
      const result = await this.client!.models.embedContent({
        model: this.config.embeddingModel,
        contents: [{ role: 'user', parts: [{ text }] }],
      });

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error('No embedding returned from API');
      }

      const firstEmbedding = result.embeddings[0];
      if (!firstEmbedding) {
        throw new Error('No embedding returned from API');
      }

      return firstEmbedding.values ?? [];
    }, 'generateEmbedding');
  }

  /**
   * Generate mock embedding for testing
   */
  private generateMockEmbedding(text: string): number[] {
    // Simple hash-based mock embedding
    const dimension = 768;
    const embedding: number[] = new Array(dimension).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = (charCode * (i + 1)) % dimension;
      const currentValue = embedding[index];
      if (currentValue !== undefined) {
        embedding[index] = currentValue + 0.01;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        const val = embedding[i];
        if (val !== undefined) {
          embedding[i] = val / norm;
        }
      }
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts (batched)
   */
  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 10;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((text) => this.generateEmbedding(text)));
      results.push(...batchResults);

      if (i + batchSize < texts.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  // =============================================================================
  // IRAGService Interface Implementation
  // =============================================================================

  /**
   * Search for relevant content based on a query
   */
  async search(query: string, targetPath: string, options?: RAGSearchOptions): Promise<RAGSearchResult> {
    const startTime = Date.now();
    const limit = options?.limit ?? this.config.maxChunksPerQuery;
    const minScore = options?.minScore ?? this.config.defaultMinScore;

    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(query, targetPath, options);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          ...cached.result,
          searchTimeMs: Date.now() - startTime,
        };
      }

      // Ensure directory is indexed
      if (!await this.isIndexed(targetPath)) {
        await this.indexDirectory(targetPath);
      }

      // Find the store for this path
      const store = this.findStoreByPath(targetPath);
      if (!store) {
        return {
          query,
          chunks: [],
          totalMatches: 0,
          searchTimeMs: Date.now() - startTime,
          error: `No index found for path: ${targetPath}`,
        };
      }

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Calculate similarity scores
      const scoredChunks: RAGChunk[] = [];

      for (const doc of store.documents.values()) {
        // Apply include/exclude patterns
        if (options?.includePatterns?.length) {
          const matches = options.includePatterns.some((pattern) =>
            this.matchPattern(doc.metadata.relativePath || doc.filePath, pattern),
          );
          if (!matches) {
continue;
}
        }

        if (options?.excludePatterns?.length) {
          const excluded = options.excludePatterns.some((pattern) =>
            this.matchPattern(doc.metadata.relativePath || doc.filePath, pattern),
          );
          if (excluded) {
continue;
}
        }

        const score = this.cosineSimilarity(queryEmbedding, doc.embedding);

        scoredChunks.push({
          id: doc.id,
          content: options?.includeContent !== false ? doc.content : '',
          source: doc.filePath,
          score,
          timestamp: store.config.lastSyncAt ? new Date(store.config.lastSyncAt) : undefined,
          lineRange: doc.metadata.lineRange,
          metadata: doc.metadata as unknown as Record<string, unknown>,
        });
      }

      // Sort by score and filter
      scoredChunks.sort((a, b) => b.score - a.score);
      const filteredChunks = scoredChunks.filter((chunk) => chunk.score >= minScore).slice(0, limit);

      const result: RAGSearchResult = {
        query,
        chunks: filteredChunks,
        totalMatches: scoredChunks.filter((c) => c.score >= minScore).length,
        searchTimeMs: Date.now() - startTime,
      };

      // Cache the result
      if (this.config.cache.enabled) {
        this.searchCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      return {
        query,
        chunks: [],
        totalMatches: 0,
        searchTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute multiple searches in parallel
   */
  async searchMultiple(
    queries: readonly string[],
    targetPath: string,
    options?: RAGSearchOptions,
  ): Promise<readonly RAGSearchResult[]> {
    // Ensure indexing happens once before parallel searches
    if (!await this.isIndexed(targetPath)) {
      await this.indexDirectory(targetPath);
    }

    const results = await Promise.all(queries.map((query) => this.search(query, targetPath, options)));
    return results;
  }

  /**
   * Index a directory for search
   */
  async indexDirectory(path: string): Promise<void> {
    const storeId = this.pathToStoreId(path);

    // Check if store already exists
    let store = this.stores.get(storeId);
    if (!store) {
      // Create new store
      const newStore = await this.createStore({
        name: storeId,
        description: `Auto-indexed store for ${path}`,
        persistent: false,
      });

      store = this.stores.get(newStore.id);
      if (!store) {
        throw new Error('Failed to create store');
      }
    }

    // Process files in the directory
    const processResult = await this.fileProcessor.processDirectory(path);

    // Generate embeddings and create documents
    const embeddings = await this.generateEmbeddings(processResult.chunks.map((c) => c.content));

    for (let i = 0; i < processResult.chunks.length; i++) {
      const chunk = processResult.chunks[i];
      const embedding = embeddings[i];
      if (!chunk || !embedding) {
        continue;
      }
      const doc: VectorDocument = {
        id: uuidv4(),
        filePath: chunk.fileMetadata.filePath,
        content: chunk.content,
        embedding,
        metadata: {
          filePath: chunk.fileMetadata.filePath,
          fileName: chunk.fileMetadata.fileName,
          extension: chunk.fileMetadata.extension,
          language: chunk.fileMetadata.language,
          relativePath: chunk.fileMetadata.relativePath,
          lineRange: { start: chunk.startLine, end: chunk.endLine },
        },
        chunk: {
          index: chunk.index,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          totalChunks: processResult.chunks.filter((c) => c.fileMetadata.filePath === chunk.fileMetadata.filePath)
            .length,
        },
      };

      store.documents.set(doc.id, doc);
    }

    // Update store metadata
    this.updateStoreMetadata(storeId, processResult.filesProcessed.length, store.documents.size);
    store.config.status = 'active';
    store.config.lastSyncAt = new Date().toISOString();
  }

  /**
   * Check if a path is indexed
   */
  async isIndexed(path: string): Promise<boolean> {
    const storeId = this.pathToStoreId(path);
    return this.stores.has(storeId);
  }

  // =============================================================================
  // Vector Store Management
  // =============================================================================

  /**
   * Create a new vector store
   */
  public async createStore(config: VectorStoreConfig): Promise<RAGStore> {
    const id = config.name || uuidv4();
    const now = new Date().toISOString();

    const store: RAGStore = {
      id,
      displayName: config.name,
      createdAt: now,
      lastSyncAt: undefined,
      fileCount: 0,
      chunkCount: 0,
      sizeBytes: 0,
      status: 'active',
      config: config.storeConfig,
    };

    this.stores.set(id, {
      config: store,
      documents: new Map(),
      indexedFiles: new Map(),
    });

    this.log(`Created store: ${id}`, store);
    return store;
  }

  /**
   * Get a vector store by ID
   */
  public async getStore(storeId: string): Promise<RAGStore | null> {
    const store = this.stores.get(storeId);
    return store ? store.config : null;
  }

  /**
   * Delete a vector store
   */
  public async deleteStore(storeId: string): Promise<boolean> {
    const deleted = this.stores.delete(storeId);
    this.log(`Deleted store: ${storeId}`, { success: deleted });
    return deleted;
  }

  /**
   * List all vector stores
   */
  public async listStores(): Promise<RAGStore[]> {
    return Array.from(this.stores.values()).map((s) => s.config);
  }

  /**
   * Update store metadata
   */
  private updateStoreMetadata(storeId: string, fileCount: number, chunkCount: number): void {
    const store = this.stores.get(storeId);
    if (store) {
      store.config.fileCount = fileCount;
      store.config.chunkCount = chunkCount;
    }
  }

  /**
   * Convert path to store ID
   */
  private pathToStoreId(path: string): string {
    return path.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Find store by path
   */
  private findStoreByPath(path: string): InMemoryStore | undefined {
    const storeId = this.pathToStoreId(path);
    return this.stores.get(storeId);
  }

  // =============================================================================
  // File Upload Methods
  // =============================================================================

  /**
   * Upload a single file to a store
   */
  public async uploadFile(storeId: string, filePath: string, options: UploadOptions = {}): Promise<UploadResult> {
    const startTime = Date.now();
    const store = this.stores.get(storeId);

    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }

    store.config.status = 'indexing';

    try {
      const chunks = await this.fileProcessor.processFile(filePath);
      const embeddings = await this.generateEmbeddings(chunks.map((c) => c.content));

      const documents: VectorDocument[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        if (!chunk || !embedding) {
continue;
}
        documents.push({
          id: uuidv4(),
          filePath: chunk.fileMetadata.filePath,
          content: chunk.content,
          embedding,
          metadata: {
            filePath: chunk.fileMetadata.filePath,
            fileName: chunk.fileMetadata.fileName,
            extension: chunk.fileMetadata.extension,
            language: chunk.fileMetadata.language,
            relativePath: chunk.fileMetadata.relativePath,
            lineRange: { start: chunk.startLine, end: chunk.endLine },
            custom: options.metadata,
          },
          chunk: {
            index: chunk.index,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            totalChunks: chunks.length,
          },
        });
      }

      for (const doc of documents) {
        store.documents.set(doc.id, doc);
      }

      this.updateStoreMetadata(
        storeId,
        new Set(Array.from(store.documents.values()).map((d) => d.filePath)).size,
        store.documents.size,
      );

      store.config.status = 'active';

      return {
        storeId,
        filesUploaded: [filePath],
        filesFailed: [],
        documentsCreated: 1,
        chunksCreated: documents.length,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      store.config.status = 'error';
      throw error;
    }
  }

  /**
   * Upload multiple files to a store
   */
  public async uploadFiles(storeId: string, filePaths: string[], options: UploadOptions = {}): Promise<UploadResult> {
    const startTime = Date.now();
    const store = this.stores.get(storeId);

    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }

    store.config.status = 'indexing';

    const filesUploaded: string[] = [];
    const filesFailed: Array<{ path: string; error: string }> = [];
    let totalChunks = 0;

    try {
      const processResult = await this.fileProcessor.processFiles(filePaths);
      const embeddings = await this.generateEmbeddings(processResult.chunks.map((c) => c.content));

      const documents: VectorDocument[] = [];
      for (let i = 0; i < processResult.chunks.length; i++) {
        const chunk = processResult.chunks[i];
        const embedding = embeddings[i];
        if (!chunk || !embedding) {
continue;
}
        documents.push({
          id: uuidv4(),
          filePath: chunk.fileMetadata.filePath,
          content: chunk.content,
          embedding,
          metadata: {
            filePath: chunk.fileMetadata.filePath,
            fileName: chunk.fileMetadata.fileName,
            extension: chunk.fileMetadata.extension,
            language: chunk.fileMetadata.language,
            relativePath: chunk.fileMetadata.relativePath,
            lineRange: { start: chunk.startLine, end: chunk.endLine },
            custom: options.metadata,
          },
          chunk: {
            index: chunk.index,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            totalChunks: processResult.chunks.filter((c) => c.fileMetadata.filePath === chunk.fileMetadata.filePath)
              .length,
          },
        });
      }

      for (const doc of documents) {
        store.documents.set(doc.id, doc);
      }

      filesUploaded.push(...processResult.filesProcessed);
      filesFailed.push(...processResult.filesFailed);
      totalChunks = documents.length;

      this.updateStoreMetadata(
        storeId,
        new Set(Array.from(store.documents.values()).map((d) => d.filePath)).size,
        store.documents.size,
      );

      store.config.status = 'active';

      return {
        storeId,
        filesUploaded,
        filesFailed,
        documentsCreated: new Set(filesUploaded).size,
        chunksCreated: totalChunks,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      store.config.status = 'error';
      throw error;
    }
  }

  /**
   * Upload all files in a directory to a store
   */
  public async uploadDirectory(storeId: string, directory: string, options: UploadOptions = {}): Promise<UploadResult> {
    const files = await this.fileProcessor.discoverFiles(directory);
    return this.uploadFiles(storeId, files, options);
  }

  // =============================================================================
  // Search with Extended Options
  // =============================================================================

  /**
   * Search a store with extended options (filtering, reranking)
   */
  public async searchStore(storeId: string, query: string, options: SearchOptions = {}): Promise<ExtendedSearchResult[]> {
    const store = this.stores.get(storeId);

    if (!store) {
      throw new Error(`Store not found: ${storeId}`);
    }

    const queryEmbedding = await this.generateEmbedding(query);
    const scores: Array<{ doc: VectorDocument; score: number }> = [];

    for (const doc of store.documents.values()) {
      // Apply metadata filters
      if (options.filters && !this.matchesFilters(doc.metadata, options.filters)) {
        continue;
      }

      // Apply include/exclude patterns
      if (options.includePatterns?.length) {
        const matches = options.includePatterns.some((pattern) =>
          this.matchPattern(doc.metadata.relativePath || doc.filePath, pattern),
        );
        if (!matches) {
continue;
}
      }

      if (options.excludePatterns?.length) {
        const excluded = options.excludePatterns.some((pattern) =>
          this.matchPattern(doc.metadata.relativePath || doc.filePath, pattern),
        );
        if (excluded) {
continue;
}
      }

      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      scores.push({ doc, score });
    }

    scores.sort((a, b) => b.score - a.score);

    const minScore = options.minScore || this.config.defaultMinScore;
    const limit = options.limit || this.config.maxChunksPerQuery;

    const filteredResults = scores.filter((s) => s.score >= minScore).slice(0, limit);

    let results: ExtendedSearchResult[] = filteredResults.map(({ doc, score }) => ({
      documentId: doc.id,
      score,
      content: options.includeContent !== false ? doc.content : '',
      metadata: doc.metadata,
      chunk: {
        index: doc.chunk.index,
        startLine: doc.chunk.startLine,
        endLine: doc.chunk.endLine,
      },
      embedding: options.includeEmbeddings ? doc.embedding : undefined,
    }));

    // Optional reranking
    if (options.rerank && results.length > 0) {
      results = await this.rerankResults(query, results);
    }

    return results;
  }

  /**
   * Rerank results using LLM
   */
  private async rerankResults(query: string, results: ExtendedSearchResult[]): Promise<ExtendedSearchResult[]> {
    if (!this.client || results.length === 0) {
      return results;
    }

    try {
      const prompt = `Given the search query: "${query}"

Rank the following code snippets by relevance. Return only the indices in order of relevance (most relevant first), separated by commas.

${results.map((r, i) => `[${i}] ${r.metadata.fileName} (lines ${r.chunk.startLine}-${r.chunk.endLine}):\n${r.content.substring(0, 500)}...`).join('\n\n')}

Indices (e.g., "2,0,1,3"):`;

      const response = await this.withRetry(async () => {
        const result = await this.client!.models.generateContent({
          model: this.config.generationModel,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        return result;
      }, 'rerankResults');

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const indices = text
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0 && n < results.length);

      if (indices.length > 0) {
        const reranked: ExtendedSearchResult[] = [];
        const used = new Set<number>();

        for (const idx of indices) {
          const result = results[idx];
          if (!used.has(idx) && result) {
            reranked.push(result);
            used.add(idx);
          }
        }

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (!used.has(i) && result) {
            reranked.push(result);
          }
        }

        return reranked;
      }
    } catch (error) {
      this.log('Reranking failed, returning original order', error);
    }

    return results;
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Match a file path against a glob-like pattern
   */
  private matchPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/{{GLOBSTAR}}/g, '.*');
    return new RegExp(regexPattern).test(path);
  }

  /**
   * Get document by ID
   */
  public async getDocument(storeId: string, documentId: string): Promise<VectorDocument | null> {
    const store = this.stores.get(storeId);
    if (!store) {
      return null;
    }
    return store.documents.get(documentId) || null;
  }

  /**
   * Delete document by ID
   */
  public async deleteDocument(storeId: string, documentId: string): Promise<boolean> {
    const store = this.stores.get(storeId);
    if (!store) {
      return false;
    }

    const deleted = store.documents.delete(documentId);

    if (deleted) {
      this.updateStoreMetadata(
        storeId,
        new Set(Array.from(store.documents.values()).map((d) => d.filePath)).size,
        store.documents.size,
      );
    }

    return deleted;
  }

  /**
   * Delete all documents from a file
   */
  public async deleteFileDocuments(storeId: string, filePath: string): Promise<number> {
    const store = this.stores.get(storeId);
    if (!store) {
      return 0;
    }

    let deleted = 0;
    for (const [id, doc] of store.documents) {
      if (doc.filePath === filePath) {
        store.documents.delete(id);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.updateStoreMetadata(
        storeId,
        new Set(Array.from(store.documents.values()).map((d) => d.filePath)).size,
        store.documents.size,
      );
    }

    return deleted;
  }

  /**
   * Clear all documents from a store
   */
  public async clearStore(storeId: string): Promise<boolean> {
    const store = this.stores.get(storeId);
    if (!store) {
      return false;
    }

    store.documents.clear();
    this.updateStoreMetadata(storeId, 0, 0);

    return true;
  }

  /**
   * Get store statistics
   */
  public async getStoreStats(storeId: string): Promise<StoreStats | null> {
    const store = this.stores.get(storeId);
    if (!store) {
      return null;
    }

    const documents = Array.from(store.documents.values());
    const uniqueFiles = new Set(documents.map((d) => d.filePath));
    const fileTypes: Record<string, number> = {};

    for (const doc of documents) {
      const ext = doc.metadata.extension || 'unknown';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    }

    return {
      storeId,
      totalFiles: uniqueFiles.size,
      totalChunks: documents.length,
      totalSizeBytes: documents.reduce((sum, d) => sum + d.content.length, 0),
      avgChunkSize: documents.length > 0 ? documents.reduce((sum, d) => sum + d.content.length, 0) / documents.length : 0,
      fileTypes,
      health: {
        status: store.config.status === 'active' ? 'healthy' : store.config.status === 'error' ? 'unhealthy' : 'degraded',
        checks: [
          { name: 'store_status', status: store.config.status === 'active' ? 'pass' : 'fail' },
          { name: 'document_count', status: documents.length > 0 ? 'pass' : 'warn', message: `${documents.length} documents` },
        ],
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Export store to JSON (for persistence)
   */
  public async exportStore(storeId: string): Promise<string | null> {
    const store = this.stores.get(storeId);
    if (!store) {
      return null;
    }

    const exportData = {
      config: store.config,
      documents: Array.from(store.documents.entries()),
      indexedFiles: Array.from(store.indexedFiles.entries()),
    };

    return JSON.stringify(exportData);
  }

  /**
   * Import store from JSON
   */
  public async importStore(json: string): Promise<RAGStore> {
    const data = JSON.parse(json);
    const store: InMemoryStore = {
      config: data.config,
      documents: new Map(data.documents),
      indexedFiles: new Map(data.indexedFiles || []),
    };

    this.stores.set(store.config.id, store);
    return store.config;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * Clear only search cache (keep index)
   */
  clearSearchCache(): void {
    this.searchCache.clear();
  }

  /**
   * Estimate token count for a string
   * Uses a simple character-based estimation (approximately 4 characters per token)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new GeminiRAGService instance
 */
export function createGeminiRAGService(config?: GeminiRAGConfig): GeminiRAGService {
  return new GeminiRAGService(config);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultInstance: GeminiRAGService | null = null;

/**
 * Get or create the default GeminiRAGService instance
 */
export function getDefaultRAGService(): GeminiRAGService {
  if (!defaultInstance) {
    defaultInstance = new GeminiRAGService();
  }
  return defaultInstance;
}
