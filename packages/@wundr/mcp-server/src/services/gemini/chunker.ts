/**
 * Text Chunker for Gemini RAG Service
 *
 * Handles text chunking with configurable token limits,
 * overlap calculation, and line number tracking.
 */

/**
 * Configuration options for text chunking
 */
export interface ChunkOptions {
  /** Maximum number of tokens per chunk (default: 512) */
  maxTokens?: number;
  /** Number of overlapping tokens between chunks (default: 50) */
  overlapTokens?: number;
  /** Approximate characters per token (default: 4) */
  charsPerToken?: number;
  /** Preserve line boundaries when possible (default: true) */
  preserveLines?: boolean;
  /** Minimum chunk size in tokens (default: 100) */
  minChunkTokens?: number;
}

/**
 * Represents a single chunk of text with metadata
 */
export interface TextChunk {
  /** The chunk content */
  content: string;
  /** Zero-based chunk index */
  index: number;
  /** Starting line number (1-based) */
  startLine: number;
  /** Ending line number (1-based, inclusive) */
  endLine: number;
  /** Starting character offset in original text */
  startOffset: number;
  /** Ending character offset in original text */
  endOffset: number;
  /** Estimated token count */
  tokenCount: number;
  /** Whether this chunk overlaps with the previous */
  hasOverlap: boolean;
}

/**
 * Result of chunking operation
 */
export interface ChunkResult {
  /** Array of text chunks */
  chunks: TextChunk[];
  /** Total number of chunks */
  totalChunks: number;
  /** Total estimated tokens */
  totalTokens: number;
  /** Original text length */
  originalLength: number;
  /** Total lines in original text */
  totalLines: number;
}

/**
 * Default chunking options
 */
const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxTokens: 512,
  overlapTokens: 50,
  charsPerToken: 4,
  preserveLines: true,
  minChunkTokens: 100,
};

/**
 * Text Chunker class for splitting text into manageable chunks
 */
export class TextChunker {
  private readonly options: Required<ChunkOptions>;

  constructor(options: ChunkOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Validate options
    if (this.options.overlapTokens >= this.options.maxTokens) {
      throw new Error('overlapTokens must be less than maxTokens');
    }
    if (this.options.minChunkTokens > this.options.maxTokens) {
      throw new Error('minChunkTokens must not exceed maxTokens');
    }
  }

  /**
   * Estimate token count for a string
   */
  public estimateTokens(text: string): number {
    // Simple estimation based on characters per token
    // More accurate estimation would use a tokenizer
    return Math.ceil(text.length / this.options.charsPerToken);
  }

  /**
   * Convert token count to approximate character count
   */
  private tokensToChars(tokens: number): number {
    return tokens * this.options.charsPerToken;
  }

  /**
   * Get line number for a character offset
   */
  private getLineNumber(text: string, offset: number): number {
    const substring = text.substring(0, offset);
    return (substring.match(/\n/g) || []).length + 1;
  }

  /**
   * Find the nearest line boundary for a position
   */
  private findLineBoundary(text: string, position: number, direction: 'before' | 'after'): number {
    if (direction === 'before') {
      // Find the start of the current line or previous line
      const lastNewline = text.lastIndexOf('\n', position - 1);
      return lastNewline === -1 ? 0 : lastNewline + 1;
    } else {
      // Find the end of the current line
      const nextNewline = text.indexOf('\n', position);
      return nextNewline === -1 ? text.length : nextNewline + 1;
    }
  }

  /**
   * Find a good split point near the target position
   */
  private findSplitPoint(text: string, targetPosition: number): number {
    const maxChars = this.tokensToChars(this.options.maxTokens);
    const minPosition = Math.max(0, targetPosition - Math.floor(maxChars * 0.2));
    const maxPosition = Math.min(text.length, targetPosition + Math.floor(maxChars * 0.1));

    // Search window around target position
    const searchText = text.substring(minPosition, maxPosition);
    const relativeTarget = targetPosition - minPosition;

    // Priority: paragraph > sentence > line > word > char
    const splitPatterns = [
      /\n\n+/g,           // Paragraph breaks
      /\.\s+(?=[A-Z])/g,  // Sentence endings
      /\n/g,              // Line breaks
      /\s+/g,             // Word boundaries
    ];

    for (const pattern of splitPatterns) {
      let match;
      let closestPosition = -1;
      let closestDistance = Infinity;

      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(searchText)) !== null) {
        const position = match.index + match[0].length;
        const distance = Math.abs(position - relativeTarget);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPosition = position;
        }
      }

      if (closestPosition !== -1) {
        return minPosition + closestPosition;
      }
    }

    // Fall back to exact position
    return targetPosition;
  }

  /**
   * Chunk text into smaller pieces
   */
  public chunk(text: string): ChunkResult {
    if (!text || text.length === 0) {
      return {
        chunks: [],
        totalChunks: 0,
        totalTokens: 0,
        originalLength: 0,
        totalLines: 0,
      };
    }

    const chunks: TextChunk[] = [];
    const totalLines = (text.match(/\n/g) || []).length + 1;
    const maxChars = this.tokensToChars(this.options.maxTokens);
    const overlapChars = this.tokensToChars(this.options.overlapTokens);
    const stepSize = maxChars - overlapChars;

    let currentOffset = 0;
    let chunkIndex = 0;

    while (currentOffset < text.length) {
      // Calculate end position
      let endOffset = Math.min(currentOffset + maxChars, text.length);

      // If not at the end, find a good split point
      if (endOffset < text.length) {
        endOffset = this.findSplitPoint(text, endOffset);
      }

      // Adjust for line boundaries if preserving lines
      if (this.options.preserveLines && endOffset < text.length) {
        const adjustedEnd = this.findLineBoundary(text, endOffset, 'after');
        if (adjustedEnd <= currentOffset + maxChars * 1.1) {
          endOffset = adjustedEnd;
        }
      }

      // Extract chunk content
      const content = text.substring(currentOffset, endOffset);

      // Skip empty chunks
      if (content.trim().length === 0) {
        currentOffset = endOffset;
        continue;
      }

      const startLine = this.getLineNumber(text, currentOffset);
      const endLine = this.getLineNumber(text, endOffset - 1);
      const tokenCount = this.estimateTokens(content);

      chunks.push({
        content,
        index: chunkIndex,
        startLine,
        endLine,
        startOffset: currentOffset,
        endOffset,
        tokenCount,
        hasOverlap: chunkIndex > 0,
      });

      chunkIndex++;

      // Move to next chunk position with overlap
      if (endOffset >= text.length) {
        break;
      }

      currentOffset = Math.max(currentOffset + 1, endOffset - overlapChars);

      // Adjust to line boundary if preserving lines
      if (this.options.preserveLines) {
        currentOffset = this.findLineBoundary(text, currentOffset, 'before');
      }
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      originalLength: text.length,
      totalLines,
    };
  }

  /**
   * Chunk text by semantic sections (code-aware)
   */
  public chunkBySection(text: string, sectionDelimiters?: RegExp[]): ChunkResult {
    const defaultDelimiters = [
      /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+\w+/gm,
      /^#{1,6}\s+/gm, // Markdown headers
      /^\s*(?:\/\*\*|\*\/|\/\/\s*={3,})/gm, // Comment blocks
    ];

    const delimiters = sectionDelimiters || defaultDelimiters;
    const sections: { start: number; end: number; content: string }[] = [];
    const lastEnd = 0;

    // Find all section boundaries
    const boundaries = new Set<number>([0]);

    for (const delimiter of delimiters) {
      const regex = new RegExp(delimiter.source, delimiter.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        boundaries.add(match.index);
      }
    }

    boundaries.add(text.length);

    // Sort boundaries
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    // Create sections
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i] ?? 0;
      const end = sortedBoundaries[i + 1] ?? text.length;
      const content = text.substring(start, end);

      if (content.trim().length > 0) {
        sections.push({ start, end, content });
      }
    }

    // Merge small sections and split large ones
    const chunks: TextChunk[] = [];
    let currentContent = '';
    let currentStart = 0;
    let chunkIndex = 0;

    const maxChars = this.tokensToChars(this.options.maxTokens);
    const minChars = this.tokensToChars(this.options.minChunkTokens);

    for (const section of sections) {
      const sectionTokens = this.estimateTokens(section.content);

      // If section alone exceeds max, chunk it separately
      if (sectionTokens > this.options.maxTokens) {
        // Flush current content first
        if (currentContent.trim().length > 0) {
          const content = currentContent;
          chunks.push({
            content,
            index: chunkIndex++,
            startLine: this.getLineNumber(text, currentStart),
            endLine: this.getLineNumber(text, currentStart + content.length - 1),
            startOffset: currentStart,
            endOffset: currentStart + content.length,
            tokenCount: this.estimateTokens(content),
            hasOverlap: false,
          });
          currentContent = '';
        }

        // Chunk the large section
        const subResult = this.chunk(section.content);
        for (const subChunk of subResult.chunks) {
          chunks.push({
            ...subChunk,
            index: chunkIndex++,
            startLine: this.getLineNumber(text, section.start + subChunk.startOffset),
            endLine: this.getLineNumber(text, section.start + subChunk.endOffset - 1),
            startOffset: section.start + subChunk.startOffset,
            endOffset: section.start + subChunk.endOffset,
          });
        }

        currentStart = section.end;
        continue;
      }

      // If adding section would exceed max, flush current content
      if (this.estimateTokens(currentContent + section.content) > this.options.maxTokens) {
        if (currentContent.trim().length > 0) {
          const content = currentContent;
          chunks.push({
            content,
            index: chunkIndex++,
            startLine: this.getLineNumber(text, currentStart),
            endLine: this.getLineNumber(text, currentStart + content.length - 1),
            startOffset: currentStart,
            endOffset: currentStart + content.length,
            tokenCount: this.estimateTokens(content),
            hasOverlap: false,
          });
        }
        currentContent = section.content;
        currentStart = section.start;
      } else {
        // Add section to current chunk
        if (currentContent.length === 0) {
          currentStart = section.start;
        }
        currentContent += section.content;
      }
    }

    // Flush remaining content
    if (currentContent.trim().length > 0) {
      chunks.push({
        content: currentContent,
        index: chunkIndex,
        startLine: this.getLineNumber(text, currentStart),
        endLine: this.getLineNumber(text, currentStart + currentContent.length - 1),
        startOffset: currentStart,
        endOffset: currentStart + currentContent.length,
        tokenCount: this.estimateTokens(currentContent),
        hasOverlap: false,
      });
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      originalLength: text.length,
      totalLines: (text.match(/\n/g) || []).length + 1,
    };
  }
}

/**
 * Create a chunker with default options
 */
export function createChunker(options?: ChunkOptions): TextChunker {
  return new TextChunker(options);
}

/**
 * Convenience function to chunk text with default settings
 */
export function chunkText(text: string, options?: ChunkOptions): ChunkResult {
  const chunker = createChunker(options);
  return chunker.chunk(text);
}

/**
 * Convenience function to chunk text by semantic sections
 */
export function chunkTextBySection(text: string, options?: ChunkOptions): ChunkResult {
  const chunker = createChunker(options);
  return chunker.chunkBySection(text);
}
