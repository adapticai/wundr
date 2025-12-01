/**
 * RAG Configuration Module
 *
 * Central export point for all RAG configuration, providing utilities
 * for loading, merging, and validating configuration.
 */

import * as fs from 'fs';
import * as path from 'path';

// Re-export all from defaults
export {
  RAG_ENV_VARS,
  RAG_DEFAULTS,
  DEFAULT_RAG_CONFIG,
  createRagConfig,
  isGeminiConfigured,
  getGeminiApiKey,
} from './defaults';

export type { RagConfig, RagLogLevel } from './defaults';

// Re-export all from excludes
export {
  GLOBAL_EXCLUDES,
  DEFAULT_INCLUDE_PATTERNS,
  FILE_TYPE_MAPPINGS,
  getPatternsForCategory,
  getExtensionsForCategory,
  categorizeFile,
  createIncludePatternsFromCategories,
  shouldExclude,
} from './excludes';

export type { FileTypeCategory, FileTypeMapping } from './excludes';

import { DEFAULT_RAG_CONFIG, RagConfig, RagLogLevel } from './defaults';
import {
  GLOBAL_EXCLUDES,
  DEFAULT_INCLUDE_PATTERNS,
  FileTypeCategory,
} from './excludes';

/**
 * User-provided RAG configuration (partial)
 * All fields are optional and will be merged with defaults
 */
export interface UserRagConfig {
  geminiApiKey?: string;
  storePath?: string;
  maxFileSizeMb?: number;
  chunkSize?: number;
  overlap?: number;
  autoSync?: boolean;
  logLevel?: RagLogLevel;
  embeddingModel?: string;
  similarityThreshold?: number;
  maxResults?: number;
  maxConcurrentOperations?: number;
  cacheTtlMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  /** Additional patterns to exclude */
  excludePatterns?: string[];
  /** Override include patterns */
  includePatterns?: string[];
  /** File type categories to include */
  includeCategories?: FileTypeCategory[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Extended RAG configuration with file filtering
 */
export interface ExtendedRagConfig extends RagConfig {
  excludePatterns: string[];
  includePatterns: string[];
  includeCategories: FileTypeCategory[];
}

/**
 * Loads RAG configuration from a JSON file
 *
 * @param configPath - Path to the configuration file
 * @returns Parsed user configuration or null if file doesn't exist
 */
export const loadConfigFromFile = (
  configPath: string
): UserRagConfig | null => {
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as UserRagConfig;
  } catch (error) {
    console.error(`Failed to load RAG config from ${configPath}:`, error);
    return null;
  }
};

/**
 * Searches for RAG configuration file in standard locations
 *
 * @param startDir - Directory to start searching from
 * @returns Path to configuration file or null if not found
 */
export const findConfigFile = (
  startDir: string = process.cwd()
): string | null => {
  const configNames = ['rag.config.json', '.ragrc.json', '.wundr/rag.json'];

  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    for (const configName of configNames) {
      const configPath = path.join(currentDir, configName);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
};

/**
 * Loads and merges RAG configuration from defaults, file, and user overrides
 *
 * @param userConfig - Optional user configuration to merge
 * @param configPath - Optional path to configuration file
 * @returns Merged configuration
 *
 * @example
 * ```typescript
 * // Load with defaults only
 * const config = loadRagConfig();
 *
 * // Load with user overrides
 * const config = loadRagConfig({
 *   chunkSize: 1000,
 *   overlap: 100,
 * });
 *
 * // Load from specific file
 * const config = loadRagConfig(undefined, './custom-rag.json');
 * ```
 */
export const loadRagConfig = (
  userConfig?: UserRagConfig,
  configPath?: string
): ExtendedRagConfig => {
  // Start with defaults
  let config: ExtendedRagConfig = {
    ...DEFAULT_RAG_CONFIG,
    excludePatterns: [...GLOBAL_EXCLUDES],
    includePatterns: [...DEFAULT_INCLUDE_PATTERNS],
    includeCategories: ['code', 'config', 'docs'],
  };

  // Try to load from file if path provided or search for one
  const resolvedConfigPath = configPath || findConfigFile();
  if (resolvedConfigPath) {
    const fileConfig = loadConfigFromFile(resolvedConfigPath);
    if (fileConfig) {
      config = mergeConfigs(config, fileConfig);
    }
  }

  // Apply user overrides
  if (userConfig) {
    config = mergeConfigs(config, userConfig);
  }

  return config;
};

/**
 * Merges user configuration into existing configuration
 *
 * @param base - Base configuration
 * @param override - Configuration to merge in
 * @returns Merged configuration
 */
const mergeConfigs = (
  base: ExtendedRagConfig,
  override: UserRagConfig
): ExtendedRagConfig => {
  return {
    geminiApiKey: override.geminiApiKey ?? base.geminiApiKey,
    storePath: override.storePath ?? base.storePath,
    maxFileSizeMb: override.maxFileSizeMb ?? base.maxFileSizeMb,
    chunkSize: override.chunkSize ?? base.chunkSize,
    overlap: override.overlap ?? base.overlap,
    autoSync: override.autoSync ?? base.autoSync,
    logLevel: override.logLevel ?? base.logLevel,
    embeddingModel: override.embeddingModel ?? base.embeddingModel,
    similarityThreshold:
      override.similarityThreshold ?? base.similarityThreshold,
    maxResults: override.maxResults ?? base.maxResults,
    maxConcurrentOperations:
      override.maxConcurrentOperations ?? base.maxConcurrentOperations,
    cacheTtlMs: override.cacheTtlMs ?? base.cacheTtlMs,
    retryAttempts: override.retryAttempts ?? base.retryAttempts,
    retryDelayMs: override.retryDelayMs ?? base.retryDelayMs,
    excludePatterns: override.excludePatterns
      ? [...base.excludePatterns, ...override.excludePatterns]
      : base.excludePatterns,
    includePatterns: override.includePatterns ?? base.includePatterns,
    includeCategories: override.includeCategories ?? base.includeCategories,
  };
};

/**
 * Validates RAG configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const config = loadRagConfig();
 * const result = validateRagConfig(config);
 *
 * if (!result.valid) {
 *   console.error('Configuration errors:', result.errors);
 * }
 *
 * if (result.warnings.length > 0) {
 *   console.warn('Configuration warnings:', result.warnings);
 * }
 * ```
 */
export const validateRagConfig = (
  config: Partial<RagConfig> | Partial<ExtendedRagConfig>
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate maxFileSizeMb
  if (config.maxFileSizeMb !== undefined) {
    if (typeof config.maxFileSizeMb !== 'number' || config.maxFileSizeMb <= 0) {
      errors.push({
        field: 'maxFileSizeMb',
        message: 'Must be a positive number',
        value: config.maxFileSizeMb,
      });
    } else if (config.maxFileSizeMb > 500) {
      warnings.push({
        field: 'maxFileSizeMb',
        message: 'Large file size limit may impact performance',
        value: config.maxFileSizeMb,
      });
    }
  }

  // Validate chunkSize
  if (config.chunkSize !== undefined) {
    if (typeof config.chunkSize !== 'number' || config.chunkSize < 50) {
      errors.push({
        field: 'chunkSize',
        message: 'Must be a number >= 50',
        value: config.chunkSize,
      });
    } else if (config.chunkSize > 2000) {
      warnings.push({
        field: 'chunkSize',
        message: 'Large chunk size may reduce search accuracy',
        value: config.chunkSize,
      });
    }
  }

  // Validate overlap
  if (config.overlap !== undefined) {
    if (typeof config.overlap !== 'number' || config.overlap < 0) {
      errors.push({
        field: 'overlap',
        message: 'Must be a non-negative number',
        value: config.overlap,
      });
    }

    if (config.chunkSize !== undefined && config.overlap >= config.chunkSize) {
      errors.push({
        field: 'overlap',
        message: 'Overlap must be less than chunk size',
        value: config.overlap,
      });
    }
  }

  // Validate similarityThreshold
  if (config.similarityThreshold !== undefined) {
    if (
      typeof config.similarityThreshold !== 'number' ||
      config.similarityThreshold < 0 ||
      config.similarityThreshold > 1
    ) {
      errors.push({
        field: 'similarityThreshold',
        message: 'Must be a number between 0 and 1',
        value: config.similarityThreshold,
      });
    }
  }

  // Validate maxResults
  if (config.maxResults !== undefined) {
    if (typeof config.maxResults !== 'number' || config.maxResults < 1) {
      errors.push({
        field: 'maxResults',
        message: 'Must be a positive integer',
        value: config.maxResults,
      });
    } else if (config.maxResults > 100) {
      warnings.push({
        field: 'maxResults',
        message: 'Large result set may impact performance',
        value: config.maxResults,
      });
    }
  }

  // Validate logLevel
  if (config.logLevel !== undefined) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.logLevel)) {
      errors.push({
        field: 'logLevel',
        message: `Must be one of: ${validLevels.join(', ')}`,
        value: config.logLevel,
      });
    }
  }

  // Validate storePath
  if (config.storePath !== undefined) {
    if (
      typeof config.storePath !== 'string' ||
      config.storePath.trim() === ''
    ) {
      errors.push({
        field: 'storePath',
        message: 'Must be a non-empty string',
        value: config.storePath,
      });
    }
  }

  // Validate retryAttempts
  if (config.retryAttempts !== undefined) {
    if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0) {
      errors.push({
        field: 'retryAttempts',
        message: 'Must be a non-negative integer',
        value: config.retryAttempts,
      });
    }
  }

  // Validate retryDelayMs
  if (config.retryDelayMs !== undefined) {
    if (typeof config.retryDelayMs !== 'number' || config.retryDelayMs < 0) {
      errors.push({
        field: 'retryDelayMs',
        message: 'Must be a non-negative number',
        value: config.retryDelayMs,
      });
    }
  }

  // Check for Gemini API key warning
  if (!config.geminiApiKey) {
    warnings.push({
      field: 'geminiApiKey',
      message: 'Gemini API key not configured. RAG features will be limited.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Creates a sample configuration file content
 *
 * @returns JSON string with sample configuration
 */
export const createSampleConfig = (): string => {
  const sampleConfig: UserRagConfig = {
    storePath: '~/.wundr/rag-stores',
    maxFileSizeMb: 100,
    chunkSize: 500,
    overlap: 50,
    autoSync: true,
    logLevel: 'info',
    embeddingModel: 'text-embedding-004',
    similarityThreshold: 0.7,
    maxResults: 10,
    excludePatterns: ['**/custom-exclude/**'],
    includeCategories: ['code', 'config', 'docs'],
  };

  return JSON.stringify(sampleConfig, null, 2);
};

/**
 * Saves configuration to a file
 *
 * @param config - Configuration to save
 * @param configPath - Path to save to
 */
export const saveConfigToFile = (
  config: UserRagConfig,
  configPath: string
): void => {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
};
