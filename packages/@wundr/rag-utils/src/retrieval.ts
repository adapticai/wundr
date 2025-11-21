/**
 * Retrieval Module
 *
 * Provides high-level retrieval functionality combining embeddings,
 * vector store, and filtering capabilities.
 */

import { EventEmitter } from 'eventemitter3';

import { DocumentChunker } from './chunking';
import { EmbeddingService } from './embeddings';
import { VectorStore } from './vector-store';

import type {
  DocumentChunk,
  SearchResult,
  RetrievalOptions,
  ChunkingOptions,
} from './types';

/**
 * Default retrieval options
 */
export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  topK: 10,
  minScore: 0.7,
  includeMetadata: true,
  rerank: false,
};

/**
 * Events emitted by the retrieval service
 */
export interface RetrievalServiceEvents {
  'retrieval:index:start': (fileCount: number) => void;
  'retrieval:index:progress': (processed: number, total: number) => void;
  'retrieval:index:complete': (chunkCount: number) => void;
  'retrieval:search:start': (query: string) => void;
  'retrieval:search:complete': (resultCount: number) => void;
  'retrieval:error': (error: Error) => void;
}

/**
 * File content to be indexed
 */
export interface FileContent {
  path: string;
  content: string;
  language?: string;
}

/**
 * Retrieval service for RAG operations
 */
export class RetrievalService extends EventEmitter<RetrievalServiceEvents> {
  private chunker: DocumentChunker;
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private initialized = false;

  constructor(
    chunkingOptions?: Partial<ChunkingOptions>,
    embeddingDimensions: number = 768,
  ) {
    super();
    this.chunker = new DocumentChunker(chunkingOptions);
    this.embeddingService = new EmbeddingService();
    this.vectorStore = new VectorStore({ dimensions: embeddingDimensions });
  }

  /**
   * Initialize the retrieval service with API key
   */
  initialize(apiKey: string): void {
    this.embeddingService.initialize(apiKey);
    this.initialized = true;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Index files for retrieval
   */
  async indexFiles(files: FileContent[]): Promise<number> {
    if (!this.initialized) {
      throw new Error('RetrievalService not initialized. Call initialize() with API key first.');
    }

    this.emit('retrieval:index:start', files.length);

    const allChunks: DocumentChunk[] = [];
    let processed = 0;

    for (const file of files) {
      try {
        const chunks = await this.chunker.chunkDocument(
          file.content,
          file.path,
          file.language,
        );
        allChunks.push(...chunks);
        processed++;
        this.emit('retrieval:index:progress', processed, files.length);
      } catch (error) {
        this.emit('retrieval:error', error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Generate embeddings for all chunks
    const embeddedChunks = await this.embeddingService.embedChunks(allChunks);

    // Add to vector store
    this.vectorStore.add(embeddedChunks);

    this.emit('retrieval:index:complete', embeddedChunks.length);
    return embeddedChunks.length;
  }

  /**
   * Index a single file
   */
  async indexFile(file: FileContent): Promise<number> {
    return this.indexFiles([file]);
  }

  /**
   * Search for relevant chunks
   */
  async search(
    query: string,
    options: Partial<RetrievalOptions> = {},
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('RetrievalService not initialized. Call initialize() with API key first.');
    }

    const opts = { ...DEFAULT_RETRIEVAL_OPTIONS, ...options };

    this.emit('retrieval:search:start', query);

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embedText(query);

    // Search vector store
    let results = this.vectorStore.search(
      queryEmbedding,
      opts.topK * 2, // Get more results for filtering
      opts.filter,
    );

    // Filter by minimum score
    results = results.filter((r) => r.score >= opts.minScore);

    // Rerank if requested
    if (opts.rerank) {
      results = this.rerankResults(query, results);
    }

    // Take top K
    results = results.slice(0, opts.topK);

    // Remove metadata if not requested
    if (!opts.includeMetadata) {
      results = results.map((r) => ({
        ...r,
        chunk: {
          ...r.chunk,
          metadata: {
            sourceFile: r.chunk.metadata.sourceFile,
            startLine: r.chunk.metadata.startLine,
            endLine: r.chunk.metadata.endLine,
          },
        },
      }));
    }

    this.emit('retrieval:search:complete', results.length);
    return results;
  }

  /**
   * Get chunks by file path
   */
  getChunksByFile(filePath: string): DocumentChunk[] {
    return this.vectorStore.filter({ sourceFiles: [filePath] });
  }

  /**
   * Get chunks by function name
   */
  getChunksByFunction(functionName: string): DocumentChunk[] {
    return this.vectorStore.filter({ functionNames: [functionName] });
  }

  /**
   * Get chunks by class name
   */
  getChunksByClass(className: string): DocumentChunk[] {
    return this.vectorStore.filter({ classNames: [className] });
  }

  /**
   * Remove indexed file
   */
  removeFile(filePath: string): void {
    const chunks = this.getChunksByFile(filePath);
    this.vectorStore.remove(chunks.map((c) => c.id));
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    totalChunks: number;
    fileCount: number;
    languages: string[];
    avgChunkSize: number;
  } {
    const chunks = this.vectorStore.getAll();
    const files = new Set<string>();
    const languages = new Set<string>();
    let totalSize = 0;

    for (const chunk of chunks) {
      files.add(chunk.metadata.sourceFile);
      if (chunk.metadata.language) {
        languages.add(chunk.metadata.language);
      }
      totalSize += chunk.content.length;
    }

    return {
      totalChunks: chunks.length,
      fileCount: files.size,
      languages: Array.from(languages),
      avgChunkSize: chunks.length > 0 ? Math.round(totalSize / chunks.length) : 0,
    };
  }

  /**
   * Clear all indexed data
   */
  clear(): void {
    this.vectorStore.clear();
  }

  /**
   * Export index data for persistence
   */
  exportIndex(): { chunks: DocumentChunk[] } {
    return {
      chunks: this.vectorStore.getAll(),
    };
  }

  /**
   * Import index data from persistence
   */
  importIndex(data: { chunks: DocumentChunk[] }): void {
    this.vectorStore.clear();
    this.vectorStore.add(data.chunks);
  }

  /**
   * Rerank results using additional scoring
   */
  private rerankResults(query: string, results: SearchResult[]): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);

    return results
      .map((result) => {
        const contentLower = result.chunk.content.toLowerCase();

        // Calculate term frequency bonus
        let termBonus = 0;
        for (const term of queryTerms) {
          if (contentLower.includes(term)) {
            termBonus += 0.05;
          }
        }

        // Calculate code structure bonus
        let structureBonus = 0;
        if (result.chunk.metadata.functionName) {
          if (queryTerms.some((t) => result.chunk.metadata.functionName?.toLowerCase().includes(t))) {
            structureBonus += 0.1;
          }
        }
        if (result.chunk.metadata.className) {
          if (queryTerms.some((t) => result.chunk.metadata.className?.toLowerCase().includes(t))) {
            structureBonus += 0.1;
          }
        }

        const adjustedScore = Math.min(1, result.score + termBonus + structureBonus);

        return {
          ...result,
          score: adjustedScore,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get the underlying vector store
   */
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  /**
   * Get the embedding service
   */
  getEmbeddingService(): EmbeddingService {
    return this.embeddingService;
  }

  /**
   * Get the document chunker
   */
  getChunker(): DocumentChunker {
    return this.chunker;
  }
}

/**
 * Factory function to create a retrieval service
 */
export function createRetrievalService(
  apiKey?: string,
  chunkingOptions?: Partial<ChunkingOptions>,
  embeddingDimensions?: number,
): RetrievalService {
  const service = new RetrievalService(chunkingOptions, embeddingDimensions);
  if (apiKey) {
    service.initialize(apiKey);
  }
  return service;
}

/**
 * Utility function to format search results for display
 */
export function formatSearchResults(results: SearchResult[]): string {
  return results
    .map((r, i) => {
      const { chunk, score } = r;
      const { metadata } = chunk;
      return `
## Result ${i + 1} (Score: ${score.toFixed(3)})
**File:** ${metadata.sourceFile}:${metadata.startLine}-${metadata.endLine}
${metadata.functionName ? `**Function:** ${metadata.functionName}` : ''}
${metadata.className ? `**Class:** ${metadata.className}` : ''}

\`\`\`${metadata.language ?? ''}
${chunk.content.slice(0, 500)}${chunk.content.length > 500 ? '...' : ''}
\`\`\`
      `.trim();
    })
    .join('\n\n---\n\n');
}
