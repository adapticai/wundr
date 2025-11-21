/**
 * Vector Store Module
 *
 * Provides in-memory vector storage and similarity search capabilities.
 */

import { EventEmitter } from 'eventemitter3';

import { cosineSimilarity, euclideanDistance } from './embeddings';

import type {
  DocumentChunk,
  SearchResult,
  VectorStoreConfig,
  ChunkFilter,
} from './types';

/**
 * Default vector store configuration
 */
export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  dimensions: 768,
  metric: 'cosine',
  maxElements: 100000,
};

/**
 * Events emitted by the vector store
 */
export interface VectorStoreEvents {
  'store:add': (count: number) => void;
  'store:remove': (count: number) => void;
  'store:search': (query: string, results: number) => void;
  'store:clear': () => void;
}

/**
 * In-memory vector store for document chunks
 */
export class VectorStore extends EventEmitter<VectorStoreEvents> {
  private config: VectorStoreConfig;
  private chunks: Map<string, DocumentChunk> = new Map();

  constructor(config: Partial<VectorStoreConfig> = {}) {
    super();
    this.config = { ...DEFAULT_VECTOR_STORE_CONFIG, ...config };
  }

  /**
   * Add chunks to the store
   */
  add(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      if (!chunk.embedding) {
        throw new Error(`Chunk ${chunk.id} does not have an embedding`);
      }
      if (chunk.embedding.length !== this.config.dimensions) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.dimensions}, got ${chunk.embedding.length}`,
        );
      }
      this.chunks.set(chunk.id, chunk);
    }
    this.emit('store:add', chunks.length);
  }

  /**
   * Add a single chunk to the store
   */
  addOne(chunk: DocumentChunk): void {
    this.add([chunk]);
  }

  /**
   * Remove chunks by their IDs
   */
  remove(ids: string[]): void {
    let removed = 0;
    for (const id of ids) {
      if (this.chunks.delete(id)) {
        removed++;
      }
    }
    this.emit('store:remove', removed);
  }

  /**
   * Remove a single chunk by ID
   */
  removeOne(id: string): boolean {
    const result = this.chunks.delete(id);
    if (result) {
      this.emit('store:remove', 1);
    }
    return result;
  }

  /**
   * Search for similar chunks
   */
  search(
    queryEmbedding: number[],
    topK: number = 10,
    filter?: ChunkFilter,
  ): SearchResult[] {
    if (queryEmbedding.length !== this.config.dimensions) {
      throw new Error(
        `Query embedding dimension mismatch: expected ${this.config.dimensions}, got ${queryEmbedding.length}`,
      );
    }

    const results: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) {
continue;
}
      if (!this.matchesFilter(chunk, filter)) {
continue;
}

      const score = this.computeScore(queryEmbedding, chunk.embedding);
      const distance = this.computeDistance(queryEmbedding, chunk.embedding);

      results.push({ chunk, score, distance });
    }

    // Sort by score (descending) and take top K
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    this.emit('store:search', 'vector query', topResults.length);
    return topResults;
  }

  /**
   * Search by text content (exact or fuzzy match)
   */
  searchByContent(query: string, topK: number = 10): DocumentChunk[] {
    const queryLower = query.toLowerCase();
    const results: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      const contentLower = chunk.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        // Simple scoring based on position and frequency
        const firstIndex = contentLower.indexOf(queryLower);
        const count = (contentLower.match(new RegExp(queryLower, 'g')) ?? []).length;
        const score = count * 10 - firstIndex * 0.1;
        results.push({ chunk, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map((r) => r.chunk);
  }

  /**
   * Get a chunk by ID
   */
  get(id: string): DocumentChunk | undefined {
    return this.chunks.get(id);
  }

  /**
   * Get all chunks
   */
  getAll(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Get chunks matching a filter
   */
  filter(filter: ChunkFilter): DocumentChunk[] {
    const results: DocumentChunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (this.matchesFilter(chunk, filter)) {
        results.push(chunk);
      }
    }
    return results;
  }

  /**
   * Clear all chunks from the store
   */
  clear(): void {
    this.chunks.clear();
    this.emit('store:clear');
  }

  /**
   * Get the number of chunks in the store
   */
  size(): number {
    return this.chunks.size;
  }

  /**
   * Check if a chunk matches the filter
   */
  private matchesFilter(chunk: DocumentChunk, filter?: ChunkFilter): boolean {
    if (!filter) {
return true;
}

    const { metadata } = chunk;

    if (filter.sourceFiles && filter.sourceFiles.length > 0) {
      if (!filter.sourceFiles.includes(metadata.sourceFile)) {
        return false;
      }
    }

    if (filter.languages && filter.languages.length > 0) {
      if (!metadata.language || !filter.languages.includes(metadata.language)) {
        return false;
      }
    }

    if (filter.types && filter.types.length > 0) {
      if (!metadata.type || !filter.types.includes(metadata.type)) {
        return false;
      }
    }

    if (filter.functionNames && filter.functionNames.length > 0) {
      if (!metadata.functionName || !filter.functionNames.includes(metadata.functionName)) {
        return false;
      }
    }

    if (filter.classNames && filter.classNames.length > 0) {
      if (!metadata.className || !filter.classNames.includes(metadata.className)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compute similarity score between two vectors
   */
  private computeScore(a: number[], b: number[]): number {
    switch (this.config.metric) {
      case 'cosine':
        return cosineSimilarity(a, b);
      case 'dotProduct':
        return this.dotProduct(a, b);
      case 'euclidean':
        // Convert distance to similarity score
        return 1 / (1 + euclideanDistance(a, b));
      default:
        return cosineSimilarity(a, b);
    }
  }

  /**
   * Compute distance between two vectors
   */
  private computeDistance(a: number[], b: number[]): number {
    switch (this.config.metric) {
      case 'cosine':
        return 1 - cosineSimilarity(a, b);
      case 'dotProduct':
        return 1 - this.normalizedDotProduct(a, b);
      case 'euclidean':
        return euclideanDistance(a, b);
      default:
        return 1 - cosineSimilarity(a, b);
    }
  }

  /**
   * Compute dot product of two vectors
   */
  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return sum;
  }

  /**
   * Compute normalized dot product (between 0 and 1)
   */
  private normalizedDotProduct(a: number[], b: number[]): number {
    const dp = this.dotProduct(a, b);
    const normA = Math.sqrt(this.dotProduct(a, a));
    const normB = Math.sqrt(this.dotProduct(b, b));
    if (normA === 0 || normB === 0) {
return 0;
}
    return (dp / (normA * normB) + 1) / 2; // Normalize to [0, 1]
  }

  /**
   * Export store data for persistence
   */
  export(): { config: VectorStoreConfig; chunks: DocumentChunk[] } {
    return {
      config: this.config,
      chunks: Array.from(this.chunks.values()),
    };
  }

  /**
   * Import store data from persistence
   */
  import(data: { config: VectorStoreConfig; chunks: DocumentChunk[] }): void {
    this.config = { ...DEFAULT_VECTOR_STORE_CONFIG, ...data.config };
    this.clear();
    for (const chunk of data.chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }
}

/**
 * Factory function to create a vector store
 */
export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  return new VectorStore(config);
}
