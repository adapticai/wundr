/**
 * File Processor for Gemini RAG Service
 *
 * Handles file reading, chunking, glob pattern matching,
 * exclusion patterns, and metadata extraction.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TextChunker, ChunkOptions, ChunkResult, TextChunk } from './chunker';

/**
 * Options for file processing
 */
export interface FileProcessorOptions {
  /** Base directory for relative paths */
  basePath?: string;
  /** Glob patterns to include - defaults to all files */
  includePatterns?: string[];
  /** Glob patterns to exclude */
  excludePatterns?: string[];
  /** Maximum file size in bytes - defaults to 10MB */
  maxFileSize?: number;
  /** File extensions to process - defaults to common code and text files */
  extensions?: string[];
  /** Chunking options */
  chunkOptions?: ChunkOptions;
  /** Extract code metadata such as language and imports */
  extractMetadata?: boolean;
}

/**
 * Metadata extracted from a file
 */
export interface FileMetadata {
  /** Full file path */
  filePath: string;
  /** File name */
  fileName: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: Date;
  /** Detected programming language */
  language?: string;
  /** Relative path from base directory */
  relativePath?: string;
  /** Number of lines */
  lineCount?: number;
  /** Extracted imports/dependencies */
  imports?: string[];
  /** Extracted exports */
  exports?: string[];
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Processed file chunk with metadata
 */
export interface ProcessedChunk extends TextChunk {
  /** Source file metadata */
  fileMetadata: FileMetadata;
  /** Unique chunk identifier */
  chunkId: string;
}

/**
 * Result of processing files
 */
export interface ProcessResult {
  /** All processed chunks */
  chunks: ProcessedChunk[];
  /** Files processed successfully */
  filesProcessed: string[];
  /** Files that failed to process */
  filesFailed: Array<{ path: string; error: string }>;
  /** Total chunks created */
  totalChunks: number;
  /** Total tokens estimated */
  totalTokens: number;
  /** Processing statistics */
  stats: {
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalBytes: number;
    totalLines: number;
    averageChunksPerFile: number;
  };
}

/**
 * Default file extensions to process
 */
const DEFAULT_EXTENSIONS = [
  // Code
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyi',
  '.go',
  '.rs',
  '.java', '.kt', '.scala',
  '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.vue', '.svelte',
  // Config
  '.json', '.yaml', '.yml', '.toml',
  '.xml',
  '.env', '.env.example',
  // Documentation
  '.md', '.mdx', '.txt', '.rst',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Shell
  '.sh', '.bash', '.zsh', '.fish',
  // Data
  '.sql', '.graphql', '.gql',
];

/**
 * Default exclusion patterns
 */
const DEFAULT_EXCLUSIONS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/venv/**',
  '**/.venv/**',
  '**/target/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/*.lock',
];

/**
 * Language detection based on file extension
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
};

/**
 * File Processor class
 */
export class FileProcessor {
  private readonly options: Required<FileProcessorOptions>;
  private readonly chunker: TextChunker;

  constructor(options: FileProcessorOptions = {}) {
    this.options = {
      basePath: options.basePath || process.cwd(),
      includePatterns: options.includePatterns || ['**/*'],
      excludePatterns: options.excludePatterns || DEFAULT_EXCLUSIONS,
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      extensions: options.extensions || DEFAULT_EXTENSIONS,
      chunkOptions: options.chunkOptions || {},
      extractMetadata: options.extractMetadata !== false,
    };

    this.chunker = new TextChunker(this.options.chunkOptions);
  }

  /**
   * Check if a path matches a glob pattern
   */
  private matchesGlob(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Check if a file should be included based on patterns
   */
  private shouldInclude(relativePath: string): boolean {
    // Check exclusion patterns first
    for (const pattern of this.options.excludePatterns) {
      if (this.matchesGlob(relativePath, pattern)) {
        return false;
      }
    }

    // Check extension
    const ext = path.extname(relativePath).toLowerCase();
    if (!this.options.extensions.includes(ext)) {
      return false;
    }

    // Check inclusion patterns
    for (const pattern of this.options.includePatterns) {
      if (this.matchesGlob(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Recursively discover files matching patterns
   */
  public async discoverFiles(directory?: string): Promise<string[]> {
    const baseDir = directory || this.options.basePath;
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return; // Skip directories we can't read
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          // Check if directory should be excluded
          let excluded = false;
          for (const pattern of this.options.excludePatterns) {
            if (this.matchesGlob(relativePath + '/', pattern) ||
                this.matchesGlob(relativePath, pattern)) {
              excluded = true;
              break;
            }
          }

          if (!excluded) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (this.shouldInclude(relativePath)) {
            files.push(fullPath);
          }
        }
      }
    };

    await walk(baseDir);
    return files;
  }

  /**
   * Extract metadata from file content
   */
  private extractMetadataFromContent(
    content: string,
    language: string,
  ): { imports: string[]; exports: string[] } {
    const imports: string[] = [];
    const exports: string[] = [];

    // Language-specific import/export extraction
    const patterns: Record<string, { imports: RegExp[]; exports: RegExp[] }> = {
      typescript: {
        imports: [
          /import\s+(?:type\s+)?(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g,
          /import\s+['"]([^'"]+)['"]/g,
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        exports: [
          /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g,
          /export\s*{\s*([^}]+)\s*}/g,
        ],
      },
      javascript: {
        imports: [
          /import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g,
          /import\s+['"]([^'"]+)['"]/g,
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        ],
        exports: [
          /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
          /module\.exports\s*=/g,
        ],
      },
      python: {
        imports: [
          /^import\s+(\S+)/gm,
          /^from\s+(\S+)\s+import/gm,
        ],
        exports: [
          /^(?:def|class)\s+(\w+)/gm,
        ],
      },
      go: {
        imports: [
          /import\s+"([^"]+)"/g,
          /import\s+\(\s*"([^"]+)"/g,
        ],
        exports: [
          /^func\s+([A-Z]\w*)/gm,
          /^type\s+([A-Z]\w*)/gm,
        ],
      },
    };

    const langPatterns = patterns[language] ?? patterns['javascript'];
    if (!langPatterns) {
      return { imports: [], exports: [] };
    }

    for (const pattern of langPatterns.imports) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const captured = match[1];
        if (captured) {
          imports.push(captured);
        }
      }
    }

    for (const pattern of langPatterns.exports) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const captured = match[1];
        if (captured) {
          exports.push(captured);
        }
      }
    }

    return { imports: [...new Set(imports)], exports: [...new Set(exports)] };
  }

  /**
   * Extract metadata from a file
   */
  public async extractFileMetadata(filePath: string, content?: string): Promise<FileMetadata> {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const language = EXTENSION_TO_LANGUAGE[ext];

    const metadata: FileMetadata = {
      filePath,
      fileName: path.basename(filePath),
      extension: ext,
      size: stats.size,
      lastModified: stats.mtime,
      language,
      relativePath: path.relative(this.options.basePath, filePath),
    };

    if (content && this.options.extractMetadata) {
      metadata.lineCount = (content.match(/\n/g) || []).length + 1;

      if (language) {
        const { imports, exports } = this.extractMetadataFromContent(content, language);
        metadata.imports = imports;
        metadata.exports = exports;
      }
    }

    return metadata;
  }

  /**
   * Process a single file
   */
  public async processFile(filePath: string): Promise<ProcessedChunk[]> {
    const stats = await fs.promises.stat(filePath);

    if (stats.size > this.options.maxFileSize) {
      throw new Error(`File exceeds maximum size of ${this.options.maxFileSize} bytes`);
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileMetadata = await this.extractFileMetadata(filePath, content);

    // Use section-based chunking for code files
    const isCodeFile = fileMetadata.language && !['json', 'yaml', 'xml', 'markdown'].includes(fileMetadata.language);
    const chunkResult = isCodeFile
      ? this.chunker.chunkBySection(content)
      : this.chunker.chunk(content);

    return chunkResult.chunks.map((chunk, index) => ({
      ...chunk,
      fileMetadata,
      chunkId: `${fileMetadata.relativePath || filePath}#chunk-${index}`,
    }));
  }

  /**
   * Process multiple files
   */
  public async processFiles(filePaths: string[]): Promise<ProcessResult> {
    const chunks: ProcessedChunk[] = [];
    const filesProcessed: string[] = [];
    const filesFailed: Array<{ path: string; error: string }> = [];
    let totalBytes = 0;
    let totalLines = 0;

    for (const filePath of filePaths) {
      try {
        const fileChunks = await this.processFile(filePath);
        chunks.push(...fileChunks);
        filesProcessed.push(filePath);

        const firstChunk = fileChunks[0];
        if (firstChunk) {
          totalBytes += firstChunk.fileMetadata.size;
          totalLines += firstChunk.fileMetadata.lineCount ?? 0;
        }
      } catch (error) {
        filesFailed.push({
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    return {
      chunks,
      filesProcessed,
      filesFailed,
      totalChunks: chunks.length,
      totalTokens,
      stats: {
        totalFiles: filePaths.length,
        successfulFiles: filesProcessed.length,
        failedFiles: filesFailed.length,
        totalBytes,
        totalLines,
        averageChunksPerFile: filesProcessed.length > 0
          ? chunks.length / filesProcessed.length
          : 0,
      },
    };
  }

  /**
   * Process all files in a directory
   */
  public async processDirectory(directory?: string): Promise<ProcessResult> {
    const files = await this.discoverFiles(directory);
    return this.processFiles(files);
  }

  /**
   * Process files matching specific glob patterns
   */
  public async processGlob(patterns: string[], basePath?: string): Promise<ProcessResult> {
    const base = basePath || this.options.basePath;
    const allFiles = await this.discoverFiles(base);

    const matchingFiles = allFiles.filter((filePath) => {
      const relativePath = path.relative(base, filePath);
      return patterns.some((pattern) => this.matchesGlob(relativePath, pattern));
    });

    return this.processFiles(matchingFiles);
  }
}

/**
 * Create a file processor with default options
 */
export function createFileProcessor(options?: FileProcessorOptions): FileProcessor {
  return new FileProcessor(options);
}
