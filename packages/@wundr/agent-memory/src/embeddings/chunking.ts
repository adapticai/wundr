/**
 * @wundr/agent-memory - Text Chunking Strategies
 *
 * Provides strategies for splitting long text before embedding:
 *
 * - **none**: Pass text as-is (no splitting).
 * - **sliding-window**: Fixed-size token windows with configurable overlap.
 *   Good for code and prose where context bleeds across sentence boundaries.
 * - **sentence**: Split on sentence boundaries and group into chunks of N
 *   sentences. Good for natural-language documents.
 *
 * Both strategies produce chunks suitable for embedding and later mean-pooling
 * or individual retrieval.
 */

import {
  type ChunkingConfig,
  DEFAULT_CHUNKING_CONFIG,
  estimateTokens,
} from './provider';

// ============================================================================
// Public API
// ============================================================================

/**
 * A single chunk produced by a chunking strategy.
 */
export interface TextChunk {
  /** The chunk text. */
  text: string;
  /** Start character offset in the original text. */
  startOffset: number;
  /** End character offset (exclusive) in the original text. */
  endOffset: number;
  /** Estimated token count. */
  tokenCount: number;
}

/**
 * Split text according to the provided chunking configuration.
 *
 * If the strategy is `"none"` or the text is within the provider's
 * maxInputTokens, a single chunk containing the entire text is returned.
 *
 * @param text - The input text to chunk.
 * @param config - Chunking configuration.
 * @param maxInputTokens - Provider's max input tokens per text (used as fallback size).
 * @returns Array of text chunks.
 */
export function chunkText(
  text: string,
  config?: ChunkingConfig,
  maxInputTokens?: number,
): TextChunk[] {
  const resolved = config ? { ...DEFAULT_CHUNKING_CONFIG, ...config } : DEFAULT_CHUNKING_CONFIG;

  if (!text || text.length === 0) {
    return [];
  }

  if (resolved.strategy === 'none') {
    return [{ text, startOffset: 0, endOffset: text.length, tokenCount: estimateTokens(text) }];
  }

  if (resolved.strategy === 'sliding-window') {
    return slidingWindowChunk(text, resolved, maxInputTokens);
  }

  if (resolved.strategy === 'sentence') {
    return sentenceChunk(text, resolved, maxInputTokens);
  }

  // Unknown strategy -- treat as no chunking
  return [{ text, startOffset: 0, endOffset: text.length, tokenCount: estimateTokens(text) }];
}

/**
 * Mean-pool multiple embedding vectors into a single vector.
 *
 * Used when a text is split into multiple chunks -- each chunk is embedded
 * independently, and the results are averaged to produce a single embedding
 * for the original text. Weighting is proportional to token count so that
 * larger chunks contribute more.
 */
export function meanPoolEmbeddings(
  embeddings: number[][],
  weights?: number[],
): number[] {
  if (embeddings.length === 0) {
    return [];
  }
  if (embeddings.length === 1) {
    return embeddings[0]!;
  }

  const dims = embeddings[0]!.length;
  const result = new Array<number>(dims).fill(0);
  let totalWeight = 0;

  for (let i = 0; i < embeddings.length; i++) {
    const w = weights ? (weights[i] ?? 1) : 1;
    totalWeight += w;
    const vec = embeddings[i]!;
    for (let d = 0; d < dims; d++) {
      result[d]! += (vec[d] ?? 0) * w;
    }
  }

  if (totalWeight > 0) {
    for (let d = 0; d < dims; d++) {
      result[d]! /= totalWeight;
    }
  }

  return result;
}

// ============================================================================
// Sliding Window Strategy
// ============================================================================

/**
 * Split text into fixed-size token windows with overlap.
 *
 * The chunk boundaries are estimated using the ~4 chars/token heuristic.
 * Overlap ensures that information near chunk boundaries is captured in
 * at least two chunks.
 */
function slidingWindowChunk(
  text: string,
  config: ChunkingConfig,
  maxInputTokens?: number,
): TextChunk[] {
  const chunkTokens = config.chunkSize ?? maxInputTokens ?? 512;
  const overlapTokens = config.overlap ?? 64;

  // Convert token counts to approximate character counts
  const chunkChars = chunkTokens * 4;
  const overlapChars = overlapTokens * 4;
  const stepChars = Math.max(1, chunkChars - overlapChars);

  const chunks: TextChunk[] = [];
  let offset = 0;

  while (offset < text.length) {
    const end = Math.min(offset + chunkChars, text.length);
    const chunkText = text.slice(offset, end);
    chunks.push({
      text: chunkText,
      startOffset: offset,
      endOffset: end,
      tokenCount: estimateTokens(chunkText),
    });

    if (end >= text.length) {
      break;
    }

    offset += stepChars;
  }

  return chunks;
}

// ============================================================================
// Sentence-Based Strategy
// ============================================================================

/**
 * Regex for splitting text into sentences.
 *
 * Splits on period, exclamation mark, or question mark followed by whitespace
 * or end of string, while handling common abbreviations (Mr., Mrs., Dr., etc.)
 * and decimal numbers.
 */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z"'])/;

/**
 * Split text on sentence boundaries and group into chunks of N sentences.
 */
function sentenceChunk(
  text: string,
  config: ChunkingConfig,
  maxInputTokens?: number,
): TextChunk[] {
  const maxSentences = config.maxSentences ?? 5;
  const maxTokens = maxInputTokens ?? 512;

  // Split into sentences
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentStart = 0;
  let currentOffset = 0;

  for (const sentence of sentences) {
    const candidateText = currentSentences.length > 0
      ? currentSentences.join(' ') + ' ' + sentence
      : sentence;
    const candidateTokens = estimateTokens(candidateText);

    // Flush current group if adding this sentence would exceed limits
    if (
      currentSentences.length > 0 &&
      (currentSentences.length >= maxSentences || candidateTokens > maxTokens)
    ) {
      const chunkStr = currentSentences.join(' ');
      chunks.push({
        text: chunkStr,
        startOffset: currentStart,
        endOffset: currentOffset,
        tokenCount: estimateTokens(chunkStr),
      });
      currentSentences = [];
      currentStart = currentOffset;
    }

    if (currentSentences.length === 0) {
      currentStart = currentOffset;
    }

    currentSentences.push(sentence);
    currentOffset += sentence.length + 1; // +1 for the space separator
  }

  // Flush remaining
  if (currentSentences.length > 0) {
    const chunkStr = currentSentences.join(' ');
    chunks.push({
      text: chunkStr,
      startOffset: currentStart,
      endOffset: Math.min(currentOffset, text.length),
      tokenCount: estimateTokens(chunkStr),
    });
  }

  return chunks;
}

/**
 * Split text into individual sentences.
 * Falls back to splitting on newlines if no sentence boundaries are found.
 */
function splitSentences(text: string): string[] {
  const parts = text.split(SENTENCE_BOUNDARY).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts;
  }

  // Fallback: split on newlines
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }

  // Single block -- return as-is
  return parts.length > 0 ? parts : [text];
}
