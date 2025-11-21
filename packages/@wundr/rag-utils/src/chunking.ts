/**
 * Document Chunking Module
 *
 * Provides intelligent chunking of code and documentation files
 * with support for code structure awareness.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  DEFAULT_CHUNKING_OPTIONS,
} from './types';

import type {
  DocumentChunk,
  ChunkMetadata,
  ChunkingOptions} from './types';

/**
 * Code-aware document chunker
 */
export class DocumentChunker {
  private options: ChunkingOptions;

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  /**
   * Chunk a document into smaller pieces
   */
  async chunkDocument(
    content: string,
    sourceFile: string,
    language?: string,
  ): Promise<DocumentChunk[]> {
    const lines = content.split('\n');

    if (this.options.respectFunctionBoundaries || this.options.respectClassBoundaries) {
      return this.chunkByStructure(lines, sourceFile, language);
    }

    return this.chunkByTokens(lines, sourceFile, language);
  }

  /**
   * Chunk by code structure (functions, classes)
   */
  private chunkByStructure(
    lines: string[],
    sourceFile: string,
    language?: string,
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const boundaries = this.detectBoundaries(lines, language);

    let currentStart = 0;
    for (const boundary of boundaries) {
      if (boundary.start > currentStart) {
        // Add content before this boundary
        const chunk = this.createChunk(
          lines.slice(currentStart, boundary.start),
          sourceFile,
          currentStart + 1,
          boundary.start,
          language,
        );
        if (chunk) {
          chunks.push(chunk);
        }
      }

      // Add the boundary content (function or class)
      const chunk = this.createChunk(
        lines.slice(boundary.start, boundary.end + 1),
        sourceFile,
        boundary.start + 1,
        boundary.end + 1,
        language,
        boundary.type,
        boundary.name,
      );
      if (chunk) {
        chunks.push(chunk);
      }
      currentStart = boundary.end + 1;
    }

    // Add remaining content
    if (currentStart < lines.length) {
      const chunk = this.createChunk(
        lines.slice(currentStart),
        sourceFile,
        currentStart + 1,
        lines.length,
        language,
      );
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Chunk by token count with overlap
   */
  private chunkByTokens(
    lines: string[],
    sourceFile: string,
    language?: string,
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let currentLines: string[] = [];
    let currentTokens = 0;
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineTokens = this.estimateTokens(lines[i] ?? '');

      if (currentTokens + lineTokens > this.options.maxTokens && currentLines.length > 0) {
        const chunk = this.createChunk(
          currentLines,
          sourceFile,
          startLine + 1,
          startLine + currentLines.length,
          language,
        );
        if (chunk) {
          chunks.push(chunk);
        }

        // Handle overlap
        const overlapLines = this.calculateOverlapLines(currentLines);
        currentLines = overlapLines;
        currentTokens = overlapLines.reduce((sum, line) => sum + this.estimateTokens(line), 0);
        startLine = i - overlapLines.length;
      }

      currentLines.push(lines[i] ?? '');
      currentTokens += lineTokens;
    }

    // Add final chunk
    if (currentLines.length > 0) {
      const chunk = this.createChunk(
        currentLines,
        sourceFile,
        startLine + 1,
        startLine + currentLines.length,
        language,
      );
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Detect function and class boundaries in code
   */
  private detectBoundaries(
    lines: string[],
    language?: string,
  ): Array<{ start: number; end: number; type: 'function' | 'class'; name: string }> {
    const boundaries: Array<{ start: number; end: number; type: 'function' | 'class'; name: string }> = [];

    // Simple regex patterns for common languages
    const patterns = this.getPatternsForLanguage(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const end = this.findBlockEnd(lines, i, language);
          boundaries.push({
            start: i,
            end,
            type: pattern.type,
            name: match[1] ?? 'anonymous',
          });
          i = end; // Skip to end of block
          break;
        }
      }
    }

    return boundaries;
  }

  /**
   * Get regex patterns for detecting functions/classes based on language
   */
  private getPatternsForLanguage(
    language?: string,
  ): Array<{ regex: RegExp; type: 'function' | 'class' }> {
    const patterns: Array<{ regex: RegExp; type: 'function' | 'class' }> = [];

    switch (language?.toLowerCase()) {
      case 'typescript':
      case 'javascript':
      case 'ts':
      case 'js':
        patterns.push(
          { regex: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
          { regex: /^\s*(?:export\s+)?class\s+(\w+)/, type: 'class' },
          { regex: /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/, type: 'function' },
        );
        break;
      case 'python':
      case 'py':
        patterns.push(
          { regex: /^\s*def\s+(\w+)\s*\(/, type: 'function' },
          { regex: /^\s*class\s+(\w+)/, type: 'class' },
        );
        break;
      default:
        // Generic patterns
        patterns.push(
          { regex: /^\s*(?:function|def|func)\s+(\w+)/, type: 'function' },
          { regex: /^\s*class\s+(\w+)/, type: 'class' },
        );
    }

    return patterns;
  }

  /**
   * Find the end of a code block (function or class)
   */
  private findBlockEnd(lines: string[], start: number, language?: string): number {
    let braceCount = 0;
    let foundOpening = false;

    // For Python, use indentation
    if (language?.toLowerCase() === 'python' || language?.toLowerCase() === 'py') {
      const startLine = lines[start] ?? '';
      const baseIndent = startLine.match(/^\s*/)?.[0].length ?? 0;

      for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (line.trim() === '') {
continue;
}

        const currentIndent = line.match(/^\s*/)?.[0].length ?? 0;
        if (currentIndent <= baseIndent) {
          return i - 1;
        }
      }
      return lines.length - 1;
    }

    // For brace-based languages
    for (let i = start; i < lines.length; i++) {
      const line = lines[i] ?? '';
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpening = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (foundOpening && braceCount === 0) {
        return i;
      }
    }

    return lines.length - 1;
  }

  /**
   * Create a document chunk
   */
  private createChunk(
    lines: string[],
    sourceFile: string,
    startLine: number,
    endLine: number,
    language?: string,
    type?: 'function' | 'class',
    name?: string,
  ): DocumentChunk | null {
    const content = lines.join('\n').trim();

    if (this.estimateTokens(content) < this.options.minTokens) {
      return null;
    }

    const metadata: ChunkMetadata = {
      sourceFile,
      startLine,
      endLine,
      language,
      type: this.detectContentType(content),
    };

    if (type === 'function' && name) {
      metadata.functionName = name;
    } else if (type === 'class' && name) {
      metadata.className = name;
    }

    // Extract imports and exports for JS/TS
    if (language?.toLowerCase() === 'typescript' || language?.toLowerCase() === 'javascript') {
      metadata.importStatements = this.extractImports(content);
      metadata.exportStatements = this.extractExports(content);
    }

    return {
      id: uuidv4(),
      content,
      metadata,
    };
  }

  /**
   * Detect the type of content (code, comment, documentation, mixed)
   */
  private detectContentType(content: string): 'code' | 'comment' | 'documentation' | 'mixed' {
    const lines = content.split('\n');
    let codeLines = 0;
    let commentLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '') {
continue;
}

      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('"""') ||
        trimmed.startsWith("'''")
      ) {
        commentLines++;
      } else {
        codeLines++;
      }
    }

    const total = codeLines + commentLines;
    if (total === 0) {
return 'code';
}

    const commentRatio = commentLines / total;
    if (commentRatio > 0.8) {
return 'comment';
}
    if (commentRatio > 0.5) {
return 'documentation';
}
    if (commentRatio > 0.2) {
return 'mixed';
}
    return 'code';
  }

  /**
   * Extract import statements from content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /^import\s+.*$/gm;
    const requireRegex = /^(?:const|let|var)\s+.*=\s*require\s*\(/gm;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[0]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[0]);
    }

    return imports;
  }

  /**
   * Extract export statements from content
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /^export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+\w+/gm;
    const moduleExportsRegex = /^module\.exports\s*=/gm;

    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[0]);
    }
    while ((match = moduleExportsRegex.exec(content)) !== null) {
      exports.push(match[0]);
    }

    return exports;
  }

  /**
   * Calculate lines to keep for overlap
   */
  private calculateOverlapLines(lines: string[]): string[] {
    let overlapTokens = 0;
    const overlapLines: string[] = [];

    for (let i = lines.length - 1; i >= 0 && overlapTokens < this.options.overlap; i--) {
      const line = lines[i];
      if (line !== undefined) {
        overlapLines.unshift(line);
        overlapTokens += this.estimateTokens(line);
      }
    }

    return overlapLines;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for code
    return Math.ceil(text.length / 4);
  }
}

/**
 * Factory function to create a chunker with default options
 */
export function createChunker(options?: Partial<ChunkingOptions>): DocumentChunker {
  return new DocumentChunker(options);
}
