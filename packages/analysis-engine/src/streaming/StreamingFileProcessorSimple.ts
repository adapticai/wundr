/**
 * @fileoverview Simplified Streaming File Processor for immediate functionality
 * Basic file processing with proper TypeScript types
 */

import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ProcessedFile {
  path: string;
  size: number;
  lines: number;
  encoding: string;
  mimeType: string;
  lastModified: Date;
  metadata: {
    language?: string;
    complexity?: number;
    imports?: string[];
    exports?: string[];
  };
}

export interface StreamingStats {
  filesProcessed: number;
  bytesProcessed: number;
  linesProcessed: number;
  processingRate: number;
  memoryUsage: number;
  averageFileSize: number;
  errorCount: number;
}

/**
 * Simplified streaming file processor
 */
export class StreamingFileProcessor extends EventEmitter {
  private stats: StreamingStats;

  constructor() {
    super();
    this.stats = {
      filesProcessed: 0,
      bytesProcessed: 0,
      linesProcessed: 0,
      processingRate: 0,
      memoryUsage: 0,
      averageFileSize: 0,
      errorCount: 0
    };
  }

  async processFiles(filePaths: string[]): Promise<ProcessedFile[]> {
    const startTime = Date.now();
    const results: ProcessedFile[] = [];
    
    this.resetStats();
    
    this.emit('processing-started', {
      totalFiles: filePaths.length
    });

    try {
      for (const filePath of filePaths) {
        try {
          const result = await this.processFile(filePath);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          this.emit('file-error', { file: filePath, error });
          this.stats.errorCount++;
        }
      }

      const processingTime = Date.now() - startTime;
      this.stats.processingRate = this.stats.filesProcessed / (processingTime / 1000);
      
      this.emit('processing-completed', {
        totalProcessed: results.length,
        totalErrors: this.stats.errorCount,
        processingTime,
        stats: this.stats
      });

      return results;
    } catch (error) {
      this.emit('processing-error', { error });
      throw error;
    }
  }

  private async processFile(filePath: string): Promise<ProcessedFile | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      this.emit('file-started', {
        file: path.basename(filePath),
        size: stats.size
      });

      const processedFile: ProcessedFile = {
        path: filePath,
        size: stats.size,
        lines: lines.length,
        encoding: 'utf8',
        mimeType: this.detectMimeType(filePath),
        lastModified: stats.mtime,
        metadata: {
          language: this.detectLanguage(filePath),
          complexity: this.calculateComplexity(content),
          imports: this.extractImports(content),
          exports: this.extractExports(content)
        }
      };
      
      this.stats.filesProcessed++;
      this.stats.bytesProcessed += stats.size;
      this.stats.linesProcessed += lines.length;
      this.stats.memoryUsage = process.memoryUsage().heapUsed;
      
      if (this.stats.filesProcessed > 0) {
        this.stats.averageFileSize = this.stats.bytesProcessed / this.stats.filesProcessed;
      }

      this.emit('file-completed', {
        file: path.basename(filePath),
        lines: processedFile.lines,
        size: processedFile.size
      });

      return processedFile;
    } catch (error) {
      throw error;
    }
  }

  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.jsx': 'text/jsx',
      '.tsx': 'text/tsx',
      '.json': 'application/json',
      '.md': 'text/markdown'
    };
    return mimeTypes[ext] || 'text/plain';
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languages: { [key: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript'
    };
    return languages[ext] || 'unknown';
  }

  private calculateComplexity(content: string): number {
    const complexityKeywords = /\b(if|for|while|switch|try|catch)\b/g;
    return (content.match(complexityKeywords) || []).length;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath) {
        imports.push(importPath);
      }
    }
    return imports;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      const exportName = match[1];
      if (exportName) {
        exports.push(exportName);
      }
    }
    return exports;
  }

  private resetStats(): void {
    this.stats = {
      filesProcessed: 0,
      bytesProcessed: 0,
      linesProcessed: 0,
      processingRate: 0,
      memoryUsage: 0,
      averageFileSize: 0,
      errorCount: 0
    };
  }

  getStats(): StreamingStats {
    return { ...this.stats };
  }

  async cleanup(): Promise<void> {
    this.resetStats();
    this.emit('cleanup-complete');
  }
}