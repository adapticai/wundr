/**
 * Project RAG Initialization
 *
 * Provides functionality to initialize RAG (Retrieval-Augmented Generation)
 * configuration for a project, including creating configuration files,
 * exclusion lists, and performing initial indexing.
 */

import * as fs from 'fs';
import * as path from 'path';

import { glob } from 'glob';

import {
  type RagStoreConfig,
  createDefaultRagConfig,
  detectFramework,
  saveRagConfig,
  getRagStorePath,
  getRagExcludePath,
} from './project-rag-config.js';

/**
 * RAG initialization options
 */
export interface RagInitOptions {
  /** Project name (defaults to directory name) */
  readonly projectName?: string;
  /** Force re-initialization even if config exists */
  readonly force?: boolean;
  /** Skip initial indexing */
  readonly skipIndexing?: boolean;
  /** Custom configuration overrides */
  readonly config?: Partial<RagStoreConfig>;
}

/**
 * RAG initialization result
 */
export interface RagInitResult {
  /** Whether initialization was successful */
  readonly success: boolean;
  /** Path to the created configuration file */
  readonly configPath: string;
  /** Path to the exclusions file */
  readonly excludePath: string;
  /** Number of files indexed */
  readonly filesIndexed: number;
  /** Detected framework information */
  readonly framework: {
    readonly name: string;
    readonly projectType: string;
  };
  /** Any errors that occurred */
  readonly errors: readonly string[];
  /** Any warnings that occurred */
  readonly warnings: readonly string[];
}

/**
 * Indexed file information
 */
export interface IndexedFile {
  readonly path: string;
  readonly relativePath: string;
  readonly size: number;
  readonly lastModified: Date;
}

/**
 * Initialize project RAG configuration
 *
 * Creates the necessary configuration files and performs initial indexing
 * of project files for RAG functionality.
 *
 * @param projectPath - Path to the project directory
 * @param options - Initialization options
 * @returns Initialization result
 */
export async function initProjectRag(
  projectPath: string,
  options: RagInitOptions = {},
): Promise<RagInitResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate project path
  if (!fs.existsSync(projectPath)) {
    return {
      success: false,
      configPath: '',
      excludePath: '',
      filesIndexed: 0,
      framework: { name: 'unknown', projectType: 'unknown' },
      errors: [`Project path does not exist: ${projectPath}`],
      warnings: [],
    };
  }

  // Determine project name
  const projectName = options.projectName ?? path.basename(projectPath);

  // Get configuration paths
  const configPath = getRagStorePath(projectPath);
  const excludePath = getRagExcludePath(projectPath);
  const wundrDir = path.dirname(configPath);

  // Check if already initialized
  if (fs.existsSync(configPath) && !options.force) {
    warnings.push('RAG configuration already exists. Use --force to re-initialize.');
    const detected = detectFramework(projectPath);
    return {
      success: true,
      configPath,
      excludePath,
      filesIndexed: 0,
      framework: {
        name: detected.framework,
        projectType: detected.projectType,
      },
      errors: [],
      warnings,
    };
  }

  // Create .wundr directory
  try {
    if (!fs.existsSync(wundrDir)) {
      fs.mkdirSync(wundrDir, { recursive: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      configPath: '',
      excludePath: '',
      filesIndexed: 0,
      framework: { name: 'unknown', projectType: 'unknown' },
      errors: [`Failed to create .wundr directory: ${message}`],
      warnings: [],
    };
  }

  // Detect framework
  const frameworkResult = detectFramework(projectPath);

  // Create configuration
  const config = createDefaultRagConfig(projectName);
  const finalConfig: RagStoreConfig = {
    ...config,
    ...options.config,
    metadata: {
      ...config.metadata,
      framework: frameworkResult.framework,
      projectType: frameworkResult.projectType,
      ...options.config?.metadata,
    },
  };

  // Save configuration
  try {
    saveRagConfig(finalConfig, configPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to save RAG configuration: ${message}`);
  }

  // Create exclusions file
  try {
    createExclusionsFile(excludePath, finalConfig.excludePatterns);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to create exclusions file: ${message}`);
  }

  // Perform initial indexing
  let filesIndexed = 0;
  if (!options.skipIndexing && errors.length === 0) {
    try {
      const indexResult = await indexProjectFiles(projectPath, finalConfig);
      filesIndexed = indexResult.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Initial indexing failed: ${message}`);
    }
  }

  // Add gitignore entry if .gitignore exists
  try {
    addToGitignore(projectPath, '.wundr/');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Could not update .gitignore: ${message}`);
  }

  return {
    success: errors.length === 0,
    configPath,
    excludePath,
    filesIndexed,
    framework: {
      name: frameworkResult.framework,
      projectType: frameworkResult.projectType,
    },
    errors,
    warnings,
  };
}

/**
 * Create the exclusions file with common patterns
 *
 * @param excludePath - Path to the exclusions file
 * @param patterns - Exclusion patterns to write
 */
function createExclusionsFile(
  excludePath: string,
  patterns: readonly string[],
): void {
  const header = `# RAG Exclusion Patterns
# Add patterns here to exclude files from RAG indexing
# Patterns follow glob syntax

`;
  const content = header + patterns.join('\n') + '\n';
  fs.writeFileSync(excludePath, content, 'utf-8');
}

/**
 * Add entry to .gitignore if it exists and doesn't already contain the entry
 *
 * @param projectPath - Path to the project
 * @param entry - Entry to add to .gitignore
 */
function addToGitignore(projectPath: string, entry: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');

  if (content.includes(entry)) {
    return;
  }

  const newContent = content.endsWith('\n')
    ? content + entry + '\n'
    : content + '\n' + entry + '\n';

  fs.writeFileSync(gitignorePath, newContent, 'utf-8');
}

/**
 * Index project files for RAG
 *
 * @param projectPath - Path to the project
 * @param config - RAG configuration
 * @returns Array of indexed files
 */
async function indexProjectFiles(
  projectPath: string,
  config: RagStoreConfig,
): Promise<IndexedFile[]> {
  const indexedFiles: IndexedFile[] = [];

  // Collect all matching files
  for (const pattern of config.includePatterns) {
    const files = await glob(pattern, {
      cwd: projectPath,
      ignore: [...config.excludePatterns],
      absolute: true,
      nodir: true,
    });

    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        indexedFiles.push({
          path: filePath,
          relativePath: path.relative(projectPath, filePath),
          size: stats.size,
          lastModified: stats.mtime,
        });
      } catch {
        // Skip files that can't be stat'd
      }
    }
  }

  // Save index to .wundr directory
  const indexPath = path.join(projectPath, '.wundr', 'rag-index.json');
  const indexData = {
    version: '1.0.0',
    indexedAt: new Date().toISOString(),
    fileCount: indexedFiles.length,
    files: indexedFiles.map(f => ({
      path: f.relativePath,
      size: f.size,
      lastModified: f.lastModified.toISOString(),
    })),
  };

  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');

  return indexedFiles;
}

/**
 * Check if a project has RAG initialized
 *
 * @param projectPath - Path to the project
 * @returns True if RAG is initialized
 */
export function isRagInitialized(projectPath: string): boolean {
  const configPath = getRagStorePath(projectPath);
  return fs.existsSync(configPath);
}

/**
 * Remove RAG configuration from a project
 *
 * @param projectPath - Path to the project
 * @returns True if successfully removed
 */
export function removeRag(projectPath: string): boolean {
  const wundrDir = path.join(projectPath, '.wundr');

  if (!fs.existsSync(wundrDir)) {
    return false;
  }

  // Remove RAG-specific files only
  const ragFiles = ['rag-store.json', 'rag-exclude.txt', 'rag-index.json'];

  for (const file of ragFiles) {
    const filePath = path.join(wundrDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Check if .wundr is empty and remove if so
  const remainingFiles = fs.readdirSync(wundrDir);
  if (remainingFiles.length === 0) {
    fs.rmdirSync(wundrDir);
  }

  return true;
}

/**
 * Re-index project files
 *
 * @param projectPath - Path to the project
 * @returns Number of files indexed or -1 on error
 */
export async function reindexProject(projectPath: string): Promise<number> {
  const configPath = getRagStorePath(projectPath);

  if (!fs.existsSync(configPath)) {
    return -1;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as RagStoreConfig;
    const files = await indexProjectFiles(projectPath, config);
    return files.length;
  } catch {
    return -1;
  }
}
