/**
 * RAG File Search Handler for MCP Server
 *
 * Provides semantic file search capabilities using RAG techniques.
 *
 * @module mcp-tools/tools/rag/rag-file-search-handler
 */

import * as fs from 'fs';
import * as path from 'path';

import type { RagFileSearchArgs } from '../../types/index.js';

/**
 * Handler for RAG file search operations
 */
export class RagFileSearchHandler {
  /**
   * Execute the RAG file search operation
   *
   * @param args - Search arguments
   * @returns Search results as formatted string
   */
  async execute(args: RagFileSearchArgs): Promise<string> {
    const {
      query,
      paths = [process.cwd()],
      maxResults = 10,
      minScore = 0.3,
      mode = 'hybrid',
      includeContent = true,
      maxContentLength = 500,
    } = args;

    if (!query || query.trim().length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Query is required and cannot be empty',
      });
    }

    const results: Array<{
      filePath: string;
      relativePath: string;
      score: number;
      snippets: string[];
    }> = [];

    const queryTerms = query.toLowerCase().split(/\s+/);
    const searchPaths = Array.isArray(paths) ? paths : [paths];

    for (const searchPath of searchPaths) {
      const resolvedPath = path.resolve(searchPath);
      if (!fs.existsSync(resolvedPath)) {
        continue;
      }

      const files = this.collectFiles(resolvedPath);

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const score = this.calculateScore(content, queryTerms, mode);

          if (score >= minScore) {
            const snippets = includeContent
              ? this.extractSnippets(content, queryTerms, maxContentLength)
              : [];

            results.push({
              filePath: file,
              relativePath: path.relative(process.cwd(), file),
              score,
              snippets,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, maxResults);

    return JSON.stringify({
      success: true,
      action: 'search',
      message: `Found ${limitedResults.length} results for query: "${query}"`,
      results: limitedResults,
      totalMatches: results.length,
      searchMode: _mode,
    });
  }

  /**
   * Collect all files from a directory recursively
   */
  private collectFiles(dir: string): string[] {
    const files: string[] = [];
    const excludePatterns = ['node_modules', '.git', 'dist', 'coverage', '.next'];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludePatterns.some(p => entry.name.includes(p))) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.collectFiles(fullPath));
        } else if (entry.isFile() && this.isSearchableFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return files;
  }

  /**
   * Check if file should be searched
   */
  private isSearchableFile(filename: string): boolean {
    const searchableExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yaml', '.yml',
      '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
      '.css', '.scss', '.html', '.xml', '.txt',
    ];
    const ext = path.extname(filename).toLowerCase();
    return searchableExtensions.includes(ext);
  }

  /**
   * Calculate relevance score for content
   */
  private calculateScore(
    content: string,
    queryTerms: string[],
    mode: string,
  ): number {
    const lowerContent = content.toLowerCase();
    let matchCount = 0;

    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    }

    // Normalize score based on content length and query terms
    const baseScore = matchCount / (queryTerms.length * 5);
    return Math.min(1, baseScore);
  }

  /**
   * Extract relevant snippets from content
   */
  private extractSnippets(
    content: string,
    queryTerms: string[],
    maxLength: number,
  ): string[] {
    const lines = content.split('\n');
    const snippets: string[] = [];

    for (let i = 0; i < lines.length && snippets.length < 3; i++) {
      const line = lines[i].toLowerCase();
      if (queryTerms.some(term => line.includes(term))) {
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 2);
        const snippet = lines.slice(start, end).join('\n');
        if (snippet.length <= maxLength) {
          snippets.push(snippet);
        } else {
          snippets.push(snippet.substring(0, maxLength) + '...');
        }
      }
    }

    return snippets;
  }
}
