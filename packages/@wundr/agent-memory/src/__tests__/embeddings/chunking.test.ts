/**
 * Tests for text chunking strategies (src/embeddings/chunking.ts).
 *
 * Covers:
 *  - No-chunking strategy ("none")
 *  - Sliding-window chunking
 *  - Sentence-based chunking
 *  - Chunk overlap validation
 *  - Edge cases: empty text, single sentence, very short text
 *  - Mean-pool embedding aggregation
 *  - Default configuration behavior
 *  - Unknown strategy fallback
 */

import { chunkText, meanPoolEmbeddings } from '../../embeddings/chunking';
import { estimateTokens, type ChunkingConfig } from '../../embeddings/provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slidingWindowConfig(
  overrides?: Partial<ChunkingConfig>
): ChunkingConfig {
  return {
    strategy: 'sliding-window',
    chunkSize: 128, // ~512 chars per chunk
    overlap: 32, // ~128 chars overlap
    ...overrides,
  };
}

function sentenceConfig(overrides?: Partial<ChunkingConfig>): ChunkingConfig {
  return {
    strategy: 'sentence',
    maxSentences: 3,
    ...overrides,
  };
}

/**
 * Generate text of a specific approximate character length.
 */
function generateText(charLength: number): string {
  const word = 'Lorem ipsum dolor sit amet. ';
  let text = '';
  while (text.length < charLength) {
    text += word;
  }
  return text.slice(0, charLength);
}

/**
 * Generate text with distinct sentences.
 */
function generateSentences(count: number): string {
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    sentences.push(
      `Sentence number ${i + 1} about topic ${String.fromCharCode(65 + (i % 26))}.`
    );
  }
  return sentences.join(' ');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chunkText', () => {
  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    it('should return empty array for empty text', () => {
      const chunks = chunkText('', slidingWindowConfig());
      expect(chunks).toHaveLength(0);
    });

    it('should return empty array for undefined-like empty string', () => {
      const chunks = chunkText('', sentenceConfig());
      expect(chunks).toHaveLength(0);
    });

    it('should handle single character text', () => {
      const chunks = chunkText('A', slidingWindowConfig());
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].text).toBe('A');
    });

    it('should handle text shorter than chunk size', () => {
      const chunks = chunkText(
        'Short text.',
        slidingWindowConfig({ chunkSize: 1000 })
      );
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('Short text.');
    });
  });

  // =========================================================================
  // "none" Strategy
  // =========================================================================

  describe('none strategy', () => {
    it('should return the entire text as a single chunk', () => {
      const text = 'This is a test string that should not be chunked.';
      const chunks = chunkText(text, { strategy: 'none' });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].endOffset).toBe(text.length);
    });

    it('should estimate token count', () => {
      const text = 'Hello world';
      const chunks = chunkText(text, { strategy: 'none' });

      expect(chunks[0].tokenCount).toBe(estimateTokens(text));
    });

    it('should work with default config (strategy: none)', () => {
      const text = 'Default config test.';
      const chunks = chunkText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });
  });

  // =========================================================================
  // Sliding Window Strategy
  // =========================================================================

  describe('sliding-window strategy', () => {
    it('should split long text into multiple chunks', () => {
      // chunkSize=128 tokens => ~512 chars per chunk
      const text = generateText(2000);
      const chunks = chunkText(text, slidingWindowConfig());

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should respect the chunk size limit', () => {
      const chunkSize = 50; // ~200 chars
      const text = generateText(1000);
      const config = slidingWindowConfig({ chunkSize, overlap: 10 });
      const chunks = chunkText(text, config);

      for (const chunk of chunks) {
        // Each chunk should be at most chunkSize * 4 chars
        expect(chunk.text.length).toBeLessThanOrEqual(chunkSize * 4);
      }
    });

    it('should produce overlapping chunks', () => {
      const text = generateText(2000);
      const config = slidingWindowConfig({ chunkSize: 128, overlap: 32 });
      const chunks = chunkText(text, config);

      expect(chunks.length).toBeGreaterThan(1);

      // Check that adjacent chunks overlap
      for (let i = 0; i < chunks.length - 1; i++) {
        const currentEnd = chunks[i].endOffset;
        const nextStart = chunks[i + 1].startOffset;

        // Overlap means next chunk starts before current chunk ends
        expect(nextStart).toBeLessThan(currentEnd);
      }
    });

    it('should cover the entire text', () => {
      const text = generateText(2000);
      const chunks = chunkText(text, slidingWindowConfig());

      // First chunk should start at 0
      expect(chunks[0].startOffset).toBe(0);
      // Last chunk should reach the end
      expect(chunks[chunks.length - 1].endOffset).toBe(text.length);
    });

    it('should set correct offsets', () => {
      const text = generateText(1000);
      const chunks = chunkText(text, slidingWindowConfig());

      for (const chunk of chunks) {
        // Verify that the extracted text matches the offsets
        expect(chunk.text).toBe(text.slice(chunk.startOffset, chunk.endOffset));
      }
    });

    it('should include token count for each chunk', () => {
      const text = generateText(1000);
      const chunks = chunkText(text, slidingWindowConfig());

      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.tokenCount).toBe(estimateTokens(chunk.text));
      }
    });

    it('should use maxInputTokens as fallback chunk size', () => {
      const text = generateText(2000);
      const config: ChunkingConfig = {
        strategy: 'sliding-window',
        chunkSize: undefined,
        overlap: 32,
        // No explicit chunkSize -- should fall back to maxInputTokens
      };
      const chunks = chunkText(text, config, 64); // 64 tokens = 256 chars

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle overlap greater than chunk size gracefully', () => {
      const text = generateText(500);
      const config = slidingWindowConfig({ chunkSize: 20, overlap: 100 });

      // Should not infinite loop; step = max(1, chunkSize*4 - overlap*4)
      const chunks = chunkText(text, config);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should return single chunk when text fits within chunk size', () => {
      const text = 'Short.';
      const chunks = chunkText(text, slidingWindowConfig({ chunkSize: 1000 }));

      expect(chunks).toHaveLength(1);
    });
  });

  // =========================================================================
  // Sentence-Based Strategy
  // =========================================================================

  describe('sentence strategy', () => {
    it('should split text into sentence-based chunks', () => {
      const text = generateSentences(10);
      const chunks = chunkText(text, sentenceConfig({ maxSentences: 3 }));

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should not exceed maxSentences per chunk', () => {
      const text = generateSentences(20);
      const config = sentenceConfig({ maxSentences: 3 });
      const chunks = chunkText(text, config);

      for (const chunk of chunks) {
        // Count approximate sentence boundaries in the chunk
        // Each sentence has exactly one period, but the chunk text
        // is joined with spaces so we count by splitting
        const approxSentences = chunk.text.split(/[.!?]\s+/).filter(Boolean);
        // Allow some flexibility due to last sentence not having trailing space
        expect(approxSentences.length).toBeLessThanOrEqual(4);
      }
    });

    it('should handle text with a single sentence', () => {
      const text = 'This is the only sentence.';
      const chunks = chunkText(text, sentenceConfig());

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBeTruthy();
    });

    it('should handle text with no sentence boundaries', () => {
      const text =
        'no sentence boundaries here just some words without periods';
      const chunks = chunkText(text, sentenceConfig());

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should split on newlines when no sentence boundaries found', () => {
      const text =
        'first line\nsecond line\nthird line\nfourth line\nfifth line\nsixth line\nseventh line';
      const chunks = chunkText(text, sentenceConfig({ maxSentences: 2 }));

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should include token count for each chunk', () => {
      const text = generateSentences(10);
      const chunks = chunkText(text, sentenceConfig());

      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      }
    });

    it('should respect maxInputTokens to flush chunks', () => {
      // Create very long sentences
      const longSentence = 'A'.repeat(500) + '. ';
      const text = longSentence.repeat(5) + 'End.';

      const chunks = chunkText(text, sentenceConfig({ maxSentences: 10 }), 50);
      // With maxInputTokens=50 (200 chars), each 500+ char sentence should be its own chunk
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should produce non-empty chunks', () => {
      const text = generateSentences(8);
      const chunks = chunkText(text, sentenceConfig());

      for (const chunk of chunks) {
        expect(chunk.text.trim().length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Unknown Strategy
  // =========================================================================

  describe('unknown strategy', () => {
    it('should fall back to no chunking for unknown strategy', () => {
      const text = 'Fallback text.';
      const config = {
        strategy: 'unknown-strategy',
      } as unknown as ChunkingConfig;
      const chunks = chunkText(text, config);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });
  });
});

// ===========================================================================
// Mean Pool Embeddings
// ===========================================================================

describe('meanPoolEmbeddings', () => {
  it('should return empty array for no embeddings', () => {
    const result = meanPoolEmbeddings([]);
    expect(result).toEqual([]);
  });

  it('should return the single embedding when only one provided', () => {
    const embedding = [0.1, 0.2, 0.3];
    const result = meanPoolEmbeddings([embedding]);

    expect(result).toEqual(embedding);
  });

  it('should average two equal-weight embeddings', () => {
    const e1 = [1.0, 0.0, 0.0];
    const e2 = [0.0, 1.0, 0.0];

    const result = meanPoolEmbeddings([e1, e2]);

    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(0.0);
  });

  it('should weight by provided weights', () => {
    const e1 = [1.0, 0.0];
    const e2 = [0.0, 1.0];

    // Weight e1 3x more than e2
    const result = meanPoolEmbeddings([e1, e2], [3, 1]);

    expect(result[0]).toBeCloseTo(0.75); // (1.0*3 + 0.0*1) / 4
    expect(result[1]).toBeCloseTo(0.25); // (0.0*3 + 1.0*1) / 4
  });

  it('should handle all-zero embeddings', () => {
    const e1 = [0, 0, 0];
    const e2 = [0, 0, 0];

    const result = meanPoolEmbeddings([e1, e2]);

    expect(result).toEqual([0, 0, 0]);
  });

  it('should handle missing weights gracefully', () => {
    const e1 = [2.0, 0.0];
    const e2 = [0.0, 4.0];
    const e3 = [6.0, 0.0];

    // Only provide weights for first two; third defaults to 1
    const result = meanPoolEmbeddings([e1, e2, e3], [1, 1]);

    // Total weight = 1 + 1 + 1 = 3
    expect(result[0]).toBeCloseTo((2 + 0 + 6) / 3);
    expect(result[1]).toBeCloseTo((0 + 4 + 0) / 3);
  });

  it('should handle multiple embeddings with uniform weights', () => {
    const embeddings = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    const result = meanPoolEmbeddings(embeddings);

    expect(result[0]).toBeCloseTo(4); // (1+4+7)/3
    expect(result[1]).toBeCloseTo(5); // (2+5+8)/3
    expect(result[2]).toBeCloseTo(6); // (3+6+9)/3
  });
});

// ===========================================================================
// estimateTokens
// ===========================================================================

describe('estimateTokens', () => {
  it('should estimate roughly 1 token per 4 characters', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should ceil partial tokens', () => {
    expect(estimateTokens('ab')).toBe(1); // ceil(2/4) = 1
    expect(estimateTokens('abcde')).toBe(2); // ceil(5/4) = 2
  });
});
