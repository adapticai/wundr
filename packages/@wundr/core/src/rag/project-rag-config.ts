/**
 * Project RAG Configuration
 *
 * Defines the default RAG configuration structure and provides
 * utilities for loading, saving, and managing RAG configurations.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Chunking configuration for RAG processing
 */
export interface ChunkingConfig {
  readonly maxTokensPerChunk: number;
  readonly maxOverlapTokens: number;
}

/**
 * Metadata configuration for RAG store
 */
export interface RagMetadata {
  readonly projectType: string;
  readonly framework: string;
  readonly [key: string]: string;
}

/**
 * RAG store configuration structure
 */
export interface RagStoreConfig {
  readonly storeName: string;
  readonly autoSync: boolean;
  readonly syncOnSave: boolean;
  readonly excludePatterns: readonly string[];
  readonly includePatterns: readonly string[];
  readonly chunkingConfig: ChunkingConfig;
  readonly metadata: RagMetadata;
}

/**
 * Default RAG exclusion patterns
 */
export const DEFAULT_EXCLUDE_PATTERNS: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/*.lock',
  '**/coverage/**',
  '**/.wundr/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/out/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/tmp/**',
  '**/temp/**',
] as const;

/**
 * Default RAG include patterns
 */
export const DEFAULT_INCLUDE_PATTERNS: readonly string[] = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.md',
  '**/*.json',
  '**/*.yaml',
  '**/*.yml',
  '**/*.py',
  '**/*.rs',
  '**/*.go',
  '**/*.java',
  '**/*.kt',
  '**/*.swift',
  '**/*.css',
  '**/*.scss',
  '**/*.vue',
  '**/*.svelte',
] as const;

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxTokensPerChunk: 500,
  maxOverlapTokens: 50,
} as const;

/**
 * Default metadata configuration
 */
export const DEFAULT_METADATA: RagMetadata = {
  projectType: 'typescript',
  framework: 'auto-detect',
} as const;

/**
 * Create default RAG store configuration
 *
 * @param projectName - The name of the project
 * @returns Default RAG store configuration
 */
export function createDefaultRagConfig(projectName: string): RagStoreConfig {
  return {
    storeName: `project-${projectName}`,
    autoSync: true,
    syncOnSave: false,
    excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
    includePatterns: [...DEFAULT_INCLUDE_PATTERNS],
    chunkingConfig: { ...DEFAULT_CHUNKING_CONFIG },
    metadata: { ...DEFAULT_METADATA },
  };
}

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
  readonly framework: string;
  readonly projectType: string;
  readonly confidence: number;
}

/**
 * Framework detection patterns
 */
const FRAMEWORK_PATTERNS: ReadonlyArray<{
  readonly files: readonly string[];
  readonly framework: string;
  readonly projectType: string;
}> = [
  { files: ['next.config.js', 'next.config.ts', 'next.config.mjs'], framework: 'nextjs', projectType: 'typescript' },
  { files: ['nuxt.config.js', 'nuxt.config.ts'], framework: 'nuxt', projectType: 'typescript' },
  { files: ['angular.json', '.angular'], framework: 'angular', projectType: 'typescript' },
  { files: ['svelte.config.js', 'svelte.config.ts'], framework: 'svelte', projectType: 'typescript' },
  { files: ['vue.config.js', 'vite.config.ts'], framework: 'vue', projectType: 'typescript' },
  { files: ['remix.config.js', 'remix.config.ts'], framework: 'remix', projectType: 'typescript' },
  { files: ['astro.config.mjs', 'astro.config.ts'], framework: 'astro', projectType: 'typescript' },
  { files: ['gatsby-config.js', 'gatsby-config.ts'], framework: 'gatsby', projectType: 'typescript' },
  { files: ['express.js', 'app.js'], framework: 'express', projectType: 'javascript' },
  { files: ['nest-cli.json'], framework: 'nestjs', projectType: 'typescript' },
  { files: ['Cargo.toml'], framework: 'rust', projectType: 'rust' },
  { files: ['go.mod'], framework: 'go', projectType: 'go' },
  { files: ['requirements.txt', 'pyproject.toml', 'setup.py'], framework: 'python', projectType: 'python' },
  { files: ['pom.xml', 'build.gradle'], framework: 'java', projectType: 'java' },
  { files: ['Package.swift'], framework: 'swift', projectType: 'swift' },
] as const;

/**
 * Auto-detect project framework based on configuration files
 *
 * @param projectPath - Path to the project directory
 * @returns Detected framework information
 */
export function detectFramework(projectPath: string): FrameworkDetectionResult {
  for (const pattern of FRAMEWORK_PATTERNS) {
    for (const file of pattern.files) {
      const filePath = path.join(projectPath, file);
      if (fs.existsSync(filePath)) {
        return {
          framework: pattern.framework,
          projectType: pattern.projectType,
          confidence: 1.0,
        };
      }
    }
  }

  // Check for TypeScript
  const tsConfigPath = path.join(projectPath, 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) {
    return {
      framework: 'typescript',
      projectType: 'typescript',
      confidence: 0.8,
    };
  }

  // Check for package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    return {
      framework: 'nodejs',
      projectType: 'javascript',
      confidence: 0.6,
    };
  }

  // Default to unknown
  return {
    framework: 'unknown',
    projectType: 'unknown',
    confidence: 0.0,
  };
}

/**
 * Load RAG configuration from file
 *
 * @param configPath - Path to the RAG configuration file
 * @returns Loaded configuration or null if not found
 */
export function loadRagConfig(configPath: string): RagStoreConfig | null {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as RagStoreConfig;
  } catch {
    return null;
  }
}

/**
 * Save RAG configuration to file
 *
 * @param config - The configuration to save
 * @param configPath - Path to save the configuration
 */
export function saveRagConfig(config: RagStoreConfig, configPath: string): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Merge user configuration with defaults
 *
 * @param userConfig - Partial user configuration
 * @param projectName - Project name for default config
 * @returns Merged configuration
 */
export function mergeRagConfig(
  userConfig: Partial<RagStoreConfig>,
  projectName: string,
): RagStoreConfig {
  const defaultConfig = createDefaultRagConfig(projectName);
  return {
    storeName: userConfig.storeName ?? defaultConfig.storeName,
    autoSync: userConfig.autoSync ?? defaultConfig.autoSync,
    syncOnSave: userConfig.syncOnSave ?? defaultConfig.syncOnSave,
    excludePatterns: userConfig.excludePatterns ?? defaultConfig.excludePatterns,
    includePatterns: userConfig.includePatterns ?? defaultConfig.includePatterns,
    chunkingConfig: {
      ...defaultConfig.chunkingConfig,
      ...userConfig.chunkingConfig,
    },
    metadata: {
      ...defaultConfig.metadata,
      ...userConfig.metadata,
    },
  };
}

/**
 * Get the default RAG store path within a project
 *
 * @param projectPath - Path to the project
 * @returns Path to the RAG store configuration file
 */
export function getRagStorePath(projectPath: string): string {
  return path.join(projectPath, '.wundr', 'rag-store.json');
}

/**
 * Get the default RAG exclusions path within a project
 *
 * @param projectPath - Path to the project
 * @returns Path to the RAG exclusions file
 */
export function getRagExcludePath(projectPath: string): string {
  return path.join(projectPath, '.wundr', 'rag-exclude.txt');
}
