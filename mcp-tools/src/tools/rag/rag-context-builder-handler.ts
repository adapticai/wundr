/**
 * RAG Context Builder Handler for MCP Server
 *
 * Builds optimal context for LLM queries using RAG techniques.
 *
 * @module mcp-tools/tools/rag/rag-context-builder-handler
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import type { RagContextBuilderArgs } from '../../types/index.js';

// Store directory path
const RAG_STORE_DIR = path.join(os.homedir(), '.wundr', 'rag-stores');

interface ContextChunk {
  content: string;
  source: string;
  relevance: number;
  tokenCount: number;
}

/**
 * Handler for RAG context building operations
 */
export class RagContextBuilderHandler {
  /**
   * Execute the RAG context builder operation
   *
   * @param args - Context builder arguments
   * @returns Built context as formatted string
   */
  async execute(args: RagContextBuilderArgs): Promise<string> {
    const {
      query,
      strategy = 'relevant',
      sources = ['combined'],
      maxTokens = 4000,
      storeName,
      additionalPaths,
      includeCode = true,
      includeDocs = true,
      format = 'markdown',
    } = args;

    if (!query || query.trim().length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Query is required and cannot be empty',
      });
    }

    const chunks: ContextChunk[] = [];

    // Gather context from different sources
    if (sources.includes('files') || sources.includes('combined')) {
      const fileChunks = await this.gatherFileContext(
        query,
        additionalPaths,
        includeCode,
        includeDocs
      );
      chunks.push(...fileChunks);
    }

    if (
      storeName &&
      (sources.includes('store') || sources.includes('combined'))
    ) {
      const storeChunks = await this.gatherStoreContext(query, storeName);
      chunks.push(...storeChunks);
    }

    // Sort and select chunks based on strategy
    const selectedChunks = this.selectChunks(chunks, strategy, maxTokens);

    // Build final context
    const context = this.formatContext(selectedChunks, format);
    const totalTokens = selectedChunks.reduce(
      (sum, c) => sum + c.tokenCount,
      0
    );

    // Calculate quality metrics
    const quality = this.calculateQuality(selectedChunks);

    return JSON.stringify({
      success: true,
      action: 'build-context',
      message: `Built context with ${selectedChunks.length} chunks (~${totalTokens} tokens)`,
      context,
      chunks: selectedChunks.map(c => ({
        source: c.source,
        relevance: c.relevance,
        tokenCount: c.tokenCount,
      })),
      totalTokens,
      strategy,
      sources,
      quality,
    });
  }

  /**
   * Gather context from files
   */
  private async gatherFileContext(
    query: string,
    paths?: string[],
    includeCode?: boolean,
    includeDocs?: boolean
  ): Promise<ContextChunk[]> {
    const chunks: ContextChunk[] = [];
    const searchPaths = paths || [process.cwd()];
    const queryTerms = query.toLowerCase().split(/\s+/);

    const codeExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.go',
      '.rs',
      '.java',
    ];
    const docExtensions = ['.md', '.txt', '.rst', '.json', '.yaml', '.yml'];

    for (const searchPath of searchPaths) {
      const resolvedPath = path.resolve(searchPath);
      if (!fs.existsSync(resolvedPath)) continue;

      const files = this.collectFiles(resolvedPath);

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();

        // Filter by type
        const isCode = codeExtensions.includes(ext);
        const isDoc = docExtensions.includes(ext);

        if (isCode && !includeCode) continue;
        if (isDoc && !includeDocs) continue;
        if (!isCode && !isDoc) continue;

        try {
          const content = fs.readFileSync(file, 'utf-8');
          const relevance = this.calculateRelevance(content, queryTerms);

          if (relevance > 0.1) {
            const snippet = this.extractRelevantSnippet(content, queryTerms);
            chunks.push({
              content: snippet,
              source: path.relative(process.cwd(), file),
              relevance,
              tokenCount: Math.ceil(snippet.length / 4),
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return chunks;
  }

  /**
   * Gather context from a RAG store
   */
  private async gatherStoreContext(
    query: string,
    storeName: string
  ): Promise<ContextChunk[]> {
    const chunks: ContextChunk[] = [];
    const storePath = path.join(RAG_STORE_DIR, `${storeName}.json`);

    if (!fs.existsSync(storePath)) {
      return chunks;
    }

    try {
      const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
      const queryTerms = query.toLowerCase().split(/\s+/);

      for (const doc of data.documents || []) {
        const relevance = this.calculateRelevance(doc.content, queryTerms);

        if (relevance > 0.1) {
          const snippet = this.extractRelevantSnippet(doc.content, queryTerms);
          chunks.push({
            content: snippet,
            source: `store:${storeName}/${doc.path}`,
            relevance,
            tokenCount: Math.ceil(snippet.length / 4),
          });
        }
      }
    } catch {
      // Skip invalid stores
    }

    return chunks;
  }

  /**
   * Select chunks based on strategy and token limit
   */
  private selectChunks(
    chunks: ContextChunk[],
    strategy: string,
    maxTokens: number
  ): ContextChunk[] {
    // Sort based on strategy
    let sorted: ContextChunk[];

    switch (strategy) {
      case 'recent':
        // For file-based chunks, we'd need modification time
        // For now, use relevance as fallback
        sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);
        break;
      case 'comprehensive':
        // Try to get diverse sources
        sorted = this.diversifyChunks(chunks);
        break;
      case 'focused':
        // Take only highest relevance chunks
        sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);
        break;
      case 'relevant':
      default:
        sorted = [...chunks].sort((a, b) => b.relevance - a.relevance);
        break;
    }

    // Select chunks up to token limit
    const selected: ContextChunk[] = [];
    let tokenCount = 0;

    for (const chunk of sorted) {
      if (tokenCount + chunk.tokenCount <= maxTokens) {
        selected.push(chunk);
        tokenCount += chunk.tokenCount;
      }
    }

    return selected;
  }

  /**
   * Diversify chunks to get broader coverage
   */
  private diversifyChunks(chunks: ContextChunk[]): ContextChunk[] {
    const sourceGroups = new Map<string, ContextChunk[]>();

    for (const chunk of chunks) {
      const dir = path.dirname(chunk.source);
      if (!sourceGroups.has(dir)) {
        sourceGroups.set(dir, []);
      }
      sourceGroups.get(dir)!.push(chunk);
    }

    // Take top chunk from each group, round-robin
    const result: ContextChunk[] = [];
    const groupArrays = Array.from(sourceGroups.values());

    for (const group of groupArrays) {
      group.sort((a, b) => b.relevance - a.relevance);
    }

    let added = true;
    let index = 0;

    while (added) {
      added = false;
      for (const group of groupArrays) {
        if (index < group.length) {
          result.push(group[index]);
          added = true;
        }
      }
      index++;
    }

    return result;
  }

  /**
   * Format context for output
   */
  private formatContext(chunks: ContextChunk[], format: string): string {
    if (format === 'plain') {
      return chunks.map(c => `[${c.source}]\n${c.content}`).join('\n\n---\n\n');
    }

    if (format === 'structured') {
      return JSON.stringify(chunks, null, 2);
    }

    // Markdown format (default)
    let context = '## Retrieved Context\n\n';

    for (const chunk of chunks) {
      context += `### Source: ${chunk.source}\n`;
      context += `*Relevance: ${(chunk.relevance * 100).toFixed(1)}%*\n\n`;
      context += '```\n' + chunk.content + '\n```\n\n';
    }

    return context;
  }

  /**
   * Calculate quality metrics
   */
  private calculateQuality(chunks: ContextChunk[]): {
    relevanceScore: number;
    diversityScore: number;
    coverageScore: number;
  } {
    if (chunks.length === 0) {
      return { relevanceScore: 0, diversityScore: 0, coverageScore: 0 };
    }

    const avgRelevance =
      chunks.reduce((sum, c) => sum + c.relevance, 0) / chunks.length;

    const uniqueDirs = new Set(chunks.map(c => path.dirname(c.source)));
    const diversityScore = Math.min(1, uniqueDirs.size / 5);

    const coverageScore = Math.min(1, chunks.length / 10);

    return {
      relevanceScore: avgRelevance,
      diversityScore,
      coverageScore,
    };
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(content: string, queryTerms: string[]): number {
    const lowerContent = content.toLowerCase();
    let matchCount = 0;

    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    }

    return Math.min(1, matchCount / (queryTerms.length * 5));
  }

  /**
   * Extract relevant snippet from content
   */
  private extractRelevantSnippet(
    content: string,
    queryTerms: string[]
  ): string {
    const lines = content.split('\n');
    const matchingLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (queryTerms.some(term => line.includes(term))) {
        matchingLines.push(i);
      }
    }

    if (matchingLines.length === 0) {
      return content.substring(0, 500);
    }

    // Get context around first match
    const firstMatch = matchingLines[0];
    const start = Math.max(0, firstMatch - 3);
    const end = Math.min(lines.length, firstMatch + 10);

    return lines.slice(start, end).join('\n').substring(0, 1000);
  }

  /**
   * Collect files from directory
   */
  private collectFiles(dir: string): string[] {
    const files: string[] = [];
    const excludePatterns = ['node_modules', '.git', 'dist', 'coverage'];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludePatterns.some(p => entry.name.includes(p))) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.collectFiles(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return files.slice(0, 500); // Limit to prevent overwhelming
  }
}
