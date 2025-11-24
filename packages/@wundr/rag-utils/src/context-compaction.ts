/**
 * Context Compaction Module
 *
 * Provides context compaction using summarization and deduplication
 * to prevent context rot and maintain relevance in long conversations.
 */

import { EventEmitter } from 'eventemitter3';
import { z } from 'zod';

import type { SearchResult, DocumentChunk } from './types';

/**
 * Configuration for context compaction
 */
export interface ContextCompactionConfig {
  /** Maximum tokens allowed in compacted context */
  maxTokens: number;
  /** Target token count after compaction */
  targetTokens: number;
  /** Minimum relevance score to keep a chunk */
  minRelevanceThreshold: number;
  /** Strategy for compaction */
  strategy: CompactionStrategy;
  /** Whether to preserve code blocks */
  preserveCodeBlocks: boolean;
  /** Whether to merge related chunks */
  mergeRelatedChunks: boolean;
}

/**
 * Compaction strategy types
 */
export type CompactionStrategy =
  | 'truncate'
  | 'summarize'
  | 'prioritize'
  | 'deduplicate'
  | 'hybrid';

/**
 * Default context compaction configuration
 */
export const DEFAULT_COMPACTION_CONFIG: ContextCompactionConfig = {
  maxTokens: 8000,
  targetTokens: 4000,
  minRelevanceThreshold: 0.5,
  strategy: 'hybrid',
  preserveCodeBlocks: true,
  mergeRelatedChunks: true,
};

/**
 * Compacted context result
 */
export interface CompactedContext {
  /** Compacted chunks */
  chunks: CompactedChunk[];
  /** Total token count */
  tokenCount: number;
  /** Compaction ratio achieved */
  compressionRatio: number;
  /** Number of chunks removed */
  chunksRemoved: number;
  /** Number of chunks merged */
  chunksMerged: number;
  /** Summary of context (if summarization was used) */
  summary?: string;
  /** Metadata about the compaction */
  metadata: CompactionMetadata;
}

/**
 * A compacted chunk with additional metadata
 */
export interface CompactedChunk {
  /** Original chunk */
  chunk: DocumentChunk;
  /** Compacted content (may differ from original) */
  compactedContent: string;
  /** Relevance score */
  relevanceScore: number;
  /** Whether chunk was modified during compaction */
  wasModified: boolean;
  /** Original token count */
  originalTokens: number;
  /** Compacted token count */
  compactedTokens: number;
}

/**
 * Metadata about the compaction process
 */
export interface CompactionMetadata {
  /** Strategy used */
  strategy: CompactionStrategy;
  /** Time taken for compaction (ms) */
  processingTime: number;
  /** Original token count */
  originalTokenCount: number;
  /** Final token count */
  finalTokenCount: number;
  /** Number of iterations performed */
  iterations: number;
  /** Techniques applied */
  techniquesApplied: string[];
}

/**
 * Context window for managing conversation context
 */
export interface ContextWindow {
  /** Window ID */
  id: string;
  /** Current chunks in window */
  chunks: CompactedChunk[];
  /** Current token count */
  tokenCount: number;
  /** Maximum tokens for this window */
  maxTokens: number;
  /** Age of context (number of interactions) */
  age: number;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Zod schema for compaction config validation
 */
export const ContextCompactionConfigSchema = z.object({
  maxTokens: z.number().int().positive().default(8000),
  targetTokens: z.number().int().positive().default(4000),
  minRelevanceThreshold: z.number().min(0).max(1).default(0.5),
  strategy: z
    .enum(['truncate', 'summarize', 'prioritize', 'deduplicate', 'hybrid'])
    .default('hybrid'),
  preserveCodeBlocks: z.boolean().default(true),
  mergeRelatedChunks: z.boolean().default(true),
});

/**
 * Events emitted by the context compactor
 */
export interface ContextCompactorEvents {
  'compaction:start': (chunkCount: number, tokenCount: number) => void;
  'compaction:progress': (phase: string, progress: number) => void;
  'compaction:complete': (result: CompactedContext) => void;
  'compaction:error': (error: Error) => void;
  'window:update': (window: ContextWindow) => void;
  'window:overflow': (window: ContextWindow) => void;
}

/**
 * Context compactor for managing and optimizing retrieval context
 *
 * @example
 * ```typescript
 * const compactor = new ContextCompactor({ maxTokens: 4000 });
 * const compacted = await compactor.compact(searchResults);
 *
 * console.log(`Compressed from ${compacted.metadata.originalTokenCount} to ${compacted.tokenCount} tokens`);
 * console.log(`Compression ratio: ${(compacted.compressionRatio * 100).toFixed(1)}%`);
 * ```
 */
export class ContextCompactor extends EventEmitter<ContextCompactorEvents> {
  private config: ContextCompactionConfig;
  private contextWindows: Map<string, ContextWindow> = new Map();

  constructor(config: Partial<ContextCompactionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
  }

  /**
   * Compact search results to fit within token budget
   *
   * @param results - Search results to compact
   * @param options - Optional compaction options
   * @returns Compacted context
   */
  async compact(
    results: SearchResult[],
    options: {
      maxTokens?: number;
      targetTokens?: number;
      strategy?: CompactionStrategy;
    } = {},
  ): Promise<CompactedContext> {
    const startTime = Date.now();
    const maxTokens = options.maxTokens ?? this.config.maxTokens;
    const targetTokens = options.targetTokens ?? this.config.targetTokens;
    const strategy = options.strategy ?? this.config.strategy;

    const originalTokenCount = this.calculateTotalTokens(
      results.map(r => r.chunk),
    );
    this.emit('compaction:start', results.length, originalTokenCount);

    // Validate token budget - targetTokens should not exceed maxTokens
    const effectiveTarget = Math.min(targetTokens, maxTokens);

    try {
      let compactedChunks: CompactedChunk[] =
        this.initializeCompactedChunks(results);
      const techniquesApplied: string[] = [];
      let iterations = 0;

      // Apply strategy
      switch (strategy) {
        case 'truncate':
          compactedChunks = this.applyTruncation(
            compactedChunks,
            effectiveTarget,
          );
          techniquesApplied.push('truncation');
          break;

        case 'summarize':
          compactedChunks = await this.applySummarization(
            compactedChunks,
            effectiveTarget,
          );
          techniquesApplied.push('summarization');
          break;

        case 'prioritize':
          compactedChunks = this.applyPrioritization(
            compactedChunks,
            effectiveTarget,
          );
          techniquesApplied.push('prioritization');
          break;

        case 'deduplicate':
          compactedChunks = this.applyDeduplication(compactedChunks);
          techniquesApplied.push('deduplication');
          break;

        case 'hybrid':
        default: {
          // Apply hybrid strategy in stages
          this.emit('compaction:progress', 'deduplication', 0.25);
          compactedChunks = this.applyDeduplication(compactedChunks);
          techniquesApplied.push('deduplication');
          iterations++;

          let currentTokens = this.calculateCompactedTokens(compactedChunks);

          if (currentTokens > effectiveTarget) {
            this.emit('compaction:progress', 'prioritization', 0.5);
            compactedChunks = this.applyPrioritization(
              compactedChunks,
              effectiveTarget,
            );
            techniquesApplied.push('prioritization');
            iterations++;
          }

          currentTokens = this.calculateCompactedTokens(compactedChunks);

          if (currentTokens > effectiveTarget) {
            this.emit('compaction:progress', 'truncation', 0.75);
            compactedChunks = this.applyTruncation(
              compactedChunks,
              effectiveTarget,
            );
            techniquesApplied.push('truncation');
            iterations++;
          }

          // Merge related chunks if enabled
          if (this.config.mergeRelatedChunks) {
            this.emit('compaction:progress', 'merging', 0.9);
            compactedChunks = this.applyMerging(compactedChunks);
            techniquesApplied.push('merging');
            iterations++;
          }
          break;
        }
      }

      const finalTokenCount = this.calculateCompactedTokens(compactedChunks);
      const processingTime = Date.now() - startTime;

      // Calculate statistics
      const chunksRemoved = results.length - compactedChunks.length;
      const chunksMerged = compactedChunks.filter(c => c.wasModified).length;
      const compressionRatio =
        originalTokenCount > 0 ? finalTokenCount / originalTokenCount : 1;

      const result: CompactedContext = {
        chunks: compactedChunks,
        tokenCount: finalTokenCount,
        compressionRatio,
        chunksRemoved,
        chunksMerged,
        metadata: {
          strategy,
          processingTime,
          originalTokenCount,
          finalTokenCount,
          iterations,
          techniquesApplied,
        },
      };

      this.emit('compaction:progress', 'complete', 1.0);
      this.emit('compaction:complete', result);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('compaction:error', err);
      throw err;
    }
  }

  /**
   * Create or update a context window
   *
   * @param windowId - Unique window identifier
   * @param chunks - Chunks to add to window
   * @param maxTokens - Maximum tokens for this window
   * @returns Updated context window
   */
  async updateContextWindow(
    windowId: string,
    chunks: CompactedChunk[],
    maxTokens?: number,
  ): Promise<ContextWindow> {
    const max = maxTokens ?? this.config.maxTokens;
    let window = this.contextWindows.get(windowId);

    if (!window) {
      window = {
        id: windowId,
        chunks: [],
        tokenCount: 0,
        maxTokens: max,
        age: 0,
        updatedAt: new Date(),
      };
    }

    // Add new chunks
    window.chunks.push(...chunks);
    window.tokenCount = this.calculateCompactedTokens(window.chunks);
    window.age++;
    window.updatedAt = new Date();

    // Check for overflow
    if (window.tokenCount > window.maxTokens) {
      this.emit('window:overflow', window);

      // Compact the window
      const results = window.chunks.map(c => ({
        chunk: c.chunk,
        score: c.relevanceScore,
        distance: 1 - c.relevanceScore,
      }));

      const compacted = await this.compact(results, {
        maxTokens: window.maxTokens,
        targetTokens: Math.floor(window.maxTokens * 0.8),
      });

      window.chunks = compacted.chunks;
      window.tokenCount = compacted.tokenCount;
    }

    this.contextWindows.set(windowId, window);
    this.emit('window:update', window);

    return window;
  }

  /**
   * Get a context window by ID
   */
  getContextWindow(windowId: string): ContextWindow | undefined {
    return this.contextWindows.get(windowId);
  }

  /**
   * Clear a context window
   */
  clearContextWindow(windowId: string): void {
    this.contextWindows.delete(windowId);
  }

  /**
   * Extract key information from chunks for summarization
   *
   * @param chunks - Chunks to extract from
   * @returns Extracted key information
   */
  extractKeyInformation(chunks: CompactedChunk[]): {
    functions: string[];
    classes: string[];
    imports: string[];
    keyTerms: string[];
  } {
    const functions: string[] = [];
    const classes: string[] = [];
    const imports: string[] = [];
    const keyTerms: string[] = [];

    for (const chunk of chunks) {
      const metadata = chunk.chunk.metadata;

      if (metadata.functionName) {
        functions.push(metadata.functionName);
      }
      if (metadata.className) {
        classes.push(metadata.className);
      }
      if (metadata.importStatements) {
        imports.push(...metadata.importStatements);
      }

      // Extract key terms from content
      const terms = this.extractTerms(chunk.compactedContent);
      keyTerms.push(...terms.slice(0, 5));
    }

    return {
      functions: [...new Set(functions)],
      classes: [...new Set(classes)],
      imports: [...new Set(imports)],
      keyTerms: [...new Set(keyTerms)].slice(0, 20),
    };
  }

  /**
   * Generate a summary of compacted context
   *
   * @param context - Compacted context
   * @returns Summary string
   */
  generateContextSummary(context: CompactedContext): string {
    const keyInfo = this.extractKeyInformation(context.chunks);
    const fileCount = new Set(
      context.chunks.map(c => c.chunk.metadata.sourceFile),
    ).size;

    const parts: string[] = [
      `Context contains ${context.chunks.length} chunks from ${fileCount} files.`,
    ];

    if (keyInfo.functions.length > 0) {
      parts.push(`Functions: ${keyInfo.functions.slice(0, 5).join(', ')}`);
    }

    if (keyInfo.classes.length > 0) {
      parts.push(`Classes: ${keyInfo.classes.slice(0, 5).join(', ')}`);
    }

    if (keyInfo.keyTerms.length > 0) {
      parts.push(`Key terms: ${keyInfo.keyTerms.slice(0, 10).join(', ')}`);
    }

    parts.push(
      `Token count: ${context.tokenCount} (${(context.compressionRatio * 100).toFixed(1)}% of original)`,
    );

    return parts.join(' ');
  }

  /**
   * Get the current configuration
   */
  getConfig(): ContextCompactionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextCompactionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Private helper methods

  private initializeCompactedChunks(results: SearchResult[]): CompactedChunk[] {
    return results.map(result => ({
      chunk: result.chunk,
      compactedContent: result.chunk.content,
      relevanceScore: result.score,
      wasModified: false,
      originalTokens: this.estimateTokens(result.chunk.content),
      compactedTokens: this.estimateTokens(result.chunk.content),
    }));
  }

  private applyTruncation(
    chunks: CompactedChunk[],
    targetTokens: number,
  ): CompactedChunk[] {
    const sorted = [...chunks].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );
    const result: CompactedChunk[] = [];
    let currentTokens = 0;

    for (const chunk of sorted) {
      if (currentTokens + chunk.compactedTokens <= targetTokens) {
        result.push(chunk);
        currentTokens += chunk.compactedTokens;
      } else {
        // Try to partially include the chunk
        const remainingTokens = targetTokens - currentTokens;
        if (remainingTokens > 50) {
          // Minimum meaningful chunk
          const truncatedContent = this.truncateContent(
            chunk.compactedContent,
            remainingTokens,
          );
          result.push({
            ...chunk,
            compactedContent: truncatedContent,
            wasModified: true,
            compactedTokens: this.estimateTokens(truncatedContent),
          });
        }
        break;
      }
    }

    return result;
  }

  private async applySummarization(
    chunks: CompactedChunk[],
    targetTokens: number,
  ): Promise<CompactedChunk[]> {
    // Simple extractive summarization for code
    // In production, this could use an LLM for abstractive summarization
    return chunks.map(chunk => {
      if (chunk.compactedTokens <= targetTokens / chunks.length) {
        return chunk;
      }

      const targetChunkTokens = Math.floor(targetTokens / chunks.length);
      const summarized = this.extractiveSummarize(
        chunk.compactedContent,
        targetChunkTokens,
      );

      return {
        ...chunk,
        compactedContent: summarized,
        wasModified: true,
        compactedTokens: this.estimateTokens(summarized),
      };
    });
  }

  private applyPrioritization(
    chunks: CompactedChunk[],
    targetTokens: number,
  ): CompactedChunk[] {
    // Sort by relevance and keep top chunks within budget
    const sorted = [...chunks].sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );

    // Filter out low relevance chunks
    const filtered = sorted.filter(
      c => c.relevanceScore >= this.config.minRelevanceThreshold,
    );

    // Select chunks within budget
    const result: CompactedChunk[] = [];
    let currentTokens = 0;

    for (const chunk of filtered) {
      if (currentTokens + chunk.compactedTokens <= targetTokens) {
        result.push(chunk);
        currentTokens += chunk.compactedTokens;
      }
    }

    return result;
  }

  private applyDeduplication(chunks: CompactedChunk[]): CompactedChunk[] {
    const result: CompactedChunk[] = [];
    const seenContent = new Set<string>();

    for (const chunk of chunks) {
      const contentHash = this.hashContent(chunk.compactedContent);

      if (!seenContent.has(contentHash)) {
        seenContent.add(contentHash);
        result.push(chunk);
      }
    }

    // Also check for near-duplicates
    return this.removeNearDuplicates(result);
  }

  private applyMerging(chunks: CompactedChunk[]): CompactedChunk[] {
    // Group chunks by source file
    const byFile = new Map<string, CompactedChunk[]>();

    for (const chunk of chunks) {
      const file = chunk.chunk.metadata.sourceFile;
      const fileChunks = byFile.get(file) ?? [];
      fileChunks.push(chunk);
      byFile.set(file, fileChunks);
    }

    const result: CompactedChunk[] = [];

    for (const [, fileChunks] of byFile) {
      if (fileChunks.length <= 1) {
        result.push(...fileChunks);
        continue;
      }

      // Sort by line number
      fileChunks.sort(
        (a, b) => a.chunk.metadata.startLine - b.chunk.metadata.startLine,
      );

      // Merge adjacent chunks
      let current = fileChunks[0];
      if (!current) {
        continue;
      }

      for (let i = 1; i < fileChunks.length; i++) {
        const next = fileChunks[i]!;

        if (this.areAdjacent(current, next)) {
          current = this.mergeChunks(current, next);
        } else {
          result.push(current);
          current = next;
        }
      }

      result.push(current);
    }

    return result;
  }

  private calculateTotalTokens(chunks: DocumentChunk[]): number {
    return chunks.reduce(
      (sum, chunk) => sum + this.estimateTokens(chunk.content),
      0,
    );
  }

  private calculateCompactedTokens(chunks: CompactedChunk[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.compactedTokens, 0);
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for code
    return Math.ceil(text.length / 4);
  }

  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;

    if (content.length <= maxChars) {
      return content;
    }

    // Try to truncate at a logical boundary
    const truncated = content.slice(0, maxChars);
    const lastNewline = truncated.lastIndexOf('\n');

    if (lastNewline > maxChars * 0.7) {
      return truncated.slice(0, lastNewline) + '\n// ... truncated';
    }

    return truncated + '...';
  }

  private extractiveSummarize(content: string, targetTokens: number): string {
    const lines = content.split('\n');
    const importantLines: string[] = [];

    // Priority patterns for code
    const highPriority = [
      /^\s*(?:export\s+)?(?:async\s+)?function/,
      /^\s*(?:export\s+)?class/,
      /^\s*(?:export\s+)?interface/,
      /^\s*(?:export\s+)?type/,
      /^\s*import\s+/,
      /^\s*export\s+/,
      /^\s*\/\*\*/,
      /^\s*\*\s+@/,
    ];

    // First pass: get high priority lines
    for (const line of lines) {
      if (highPriority.some(pattern => pattern.test(line))) {
        importantLines.push(line);
      }
    }

    // Second pass: fill with remaining content if needed
    let currentTokens = this.estimateTokens(importantLines.join('\n'));

    if (currentTokens < targetTokens) {
      for (const line of lines) {
        if (!importantLines.includes(line) && line.trim().length > 0) {
          const lineTokens = this.estimateTokens(line);
          if (currentTokens + lineTokens <= targetTokens) {
            importantLines.push(line);
            currentTokens += lineTokens;
          }
        }
      }
    }

    return importantLines.join('\n');
  }

  private hashContent(content: string): string {
    // Simple hash for deduplication
    const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
    let hash = 0;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  private removeNearDuplicates(chunks: CompactedChunk[]): CompactedChunk[] {
    const result: CompactedChunk[] = [];

    for (const chunk of chunks) {
      const isDuplicate = result.some(
        existing => this.calculateSimilarity(existing, chunk) > 0.8,
      );

      if (!isDuplicate) {
        result.push(chunk);
      }
    }

    return result;
  }

  private calculateSimilarity(
    chunk1: CompactedChunk,
    chunk2: CompactedChunk,
  ): number {
    const terms1 = new Set(this.extractTerms(chunk1.compactedContent));
    const terms2 = new Set(this.extractTerms(chunk2.compactedContent));

    const intersection = new Set([...terms1].filter(t => terms2.has(t)));
    const union = new Set([...terms1, ...terms2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private areAdjacent(chunk1: CompactedChunk, chunk2: CompactedChunk): boolean {
    const end1 = chunk1.chunk.metadata.endLine;
    const start2 = chunk2.chunk.metadata.startLine;

    return start2 - end1 <= 3; // Allow small gap
  }

  private mergeChunks(
    chunk1: CompactedChunk,
    chunk2: CompactedChunk,
  ): CompactedChunk {
    const mergedContent =
      chunk1.compactedContent + '\n' + chunk2.compactedContent;
    const avgRelevance = (chunk1.relevanceScore + chunk2.relevanceScore) / 2;

    return {
      chunk: {
        ...chunk1.chunk,
        content: mergedContent,
        metadata: {
          ...chunk1.chunk.metadata,
          endLine: chunk2.chunk.metadata.endLine,
        },
      },
      compactedContent: mergedContent,
      relevanceScore: avgRelevance,
      wasModified: true,
      originalTokens: chunk1.originalTokens + chunk2.originalTokens,
      compactedTokens: this.estimateTokens(mergedContent),
    };
  }

  private extractTerms(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'const',
      'let',
      'var',
      'function',
      'return',
      'if',
      'else',
      'import',
      'export',
      'from',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term));
  }
}

/**
 * Factory function to create a context compactor
 *
 * @param config - Optional configuration
 * @returns Configured ContextCompactor instance
 */
export function createContextCompactor(
  config?: Partial<ContextCompactionConfig>,
): ContextCompactor {
  return new ContextCompactor(config);
}
