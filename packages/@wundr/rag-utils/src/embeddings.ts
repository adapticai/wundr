/**
 * Embeddings Module
 *
 * Provides embedding generation using Google GenAI and other providers.
 */

import { GoogleGenAI } from '@google/genai';
import { EventEmitter } from 'eventemitter3';

import {
  DEFAULT_EMBEDDING_CONFIG,
} from './types';

import type {
  DocumentChunk,
  EmbeddingConfig} from './types';

/**
 * Events emitted by the embedding service
 */
export interface EmbeddingServiceEvents {
  'embedding:start': (batchSize: number) => void;
  'embedding:progress': (completed: number, total: number) => void;
  'embedding:complete': (totalEmbeddings: number) => void;
  'embedding:error': (error: Error) => void;
}

/**
 * Embedding service for generating vector embeddings
 */
export class EmbeddingService extends EventEmitter<EmbeddingServiceEvents> {
  private config: EmbeddingConfig;
  private client: GoogleGenAI | null = null;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_EMBEDDING_CONFIG, ...config };
  }

  /**
   * Initialize the embedding service with API key
   */
  initialize(apiKey: string): void {
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate embeddings for a batch of texts
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('Embedding service not initialized. Call initialize() with API key first.');
    }

    const embeddings: number[][] = [];
    const batches = this.createBatches(texts, this.config.batchSize);

    this.emit('embedding:start', texts.length);

    let completed = 0;
    for (const batch of batches) {
      const batchEmbeddings = await this.embedBatch(batch);
      embeddings.push(...batchEmbeddings);
      completed += batch.length;
      this.emit('embedding:progress', completed, texts.length);
    }

    this.emit('embedding:complete', embeddings.length);
    return embeddings;
  }

  /**
   * Generate embedding for a single text
   */
  async embedText(text: string): Promise<number[]> {
    const embeddings = await this.embedTexts([text]);
    const result = embeddings[0];
    if (!result) {
      throw new Error('Failed to generate embedding');
    }
    return result;
  }

  /**
   * Generate embeddings for document chunks
   */
  async embedChunks(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const texts = chunks.map((chunk) => chunk.content);
    const embeddings = await this.embedTexts(texts);

    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));
  }

  /**
   * Embed a batch of texts with retry logic
   */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.callEmbeddingAPI(texts);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries - 1) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    this.emit('embedding:error', lastError ?? new Error('Unknown error'));
    throw lastError;
  }

  /**
   * Call the embedding API
   */
  private async callEmbeddingAPI(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const results: number[][] = [];

    for (const text of texts) {
      const result = await this.client.models.embedContent({
        model: this.config.model,
        contents: text,
      });

      if (result.embeddings && result.embeddings.length > 0) {
        const embedding = result.embeddings[0];
        if (embedding?.values) {
          results.push(embedding.values);
        }
      }
    }

    return results;
  }

  /**
   * Create batches of items
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the configured embedding dimensions
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Get the configured model name
   */
  getModel(): string {
    return this.config.model;
  }
}

/**
 * Factory function to create an embedding service
 */
export function createEmbeddingService(
  apiKey?: string,
  config?: Partial<EmbeddingConfig>,
): EmbeddingService {
  const service = new EmbeddingService(config);
  if (apiKey) {
    service.initialize(apiKey);
  }
  return service;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
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

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
return 0;
}

  return dotProduct / denominator;
}

/**
 * Compute Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    const diff = aVal - bVal;
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(v: number[]): number[] {
  let norm = 0;
  for (const val of v) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
return v;
}

  return v.map((val) => val / norm);
}
