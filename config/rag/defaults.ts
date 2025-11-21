/**
 * RAG (Retrieval-Augmented Generation) Configuration Defaults
 *
 * This module provides default configuration values for the RAG system,
 * with support for environment variable overrides.
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Environment variable names for RAG configuration
 */
export const RAG_ENV_VARS = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  DEFAULT_STORE_PATH: 'RAG_DEFAULT_STORE_PATH',
  MAX_FILE_SIZE_MB: 'RAG_MAX_FILE_SIZE_MB',
  DEFAULT_CHUNK_SIZE: 'RAG_DEFAULT_CHUNK_SIZE',
  DEFAULT_OVERLAP: 'RAG_DEFAULT_OVERLAP',
  AUTO_SYNC: 'RAG_AUTO_SYNC',
  LOG_LEVEL: 'RAG_LOG_LEVEL',
  EMBEDDING_MODEL: 'RAG_EMBEDDING_MODEL',
  SIMILARITY_THRESHOLD: 'RAG_SIMILARITY_THRESHOLD',
  MAX_RESULTS: 'RAG_MAX_RESULTS',
} as const;

/**
 * Default values for RAG configuration
 */
export const RAG_DEFAULTS = {
  /** Default path for storing RAG vector stores */
  STORE_PATH: path.join(os.homedir(), '.wundr', 'rag-stores'),
  /** Maximum file size in megabytes to process */
  MAX_FILE_SIZE_MB: 100,
  /** Default chunk size for text splitting (in tokens/characters) */
  CHUNK_SIZE: 500,
  /** Default overlap between chunks */
  OVERLAP: 50,
  /** Whether to automatically sync changes */
  AUTO_SYNC: true,
  /** Default log level for RAG operations */
  LOG_LEVEL: 'info' as const,
  /** Default embedding model to use */
  EMBEDDING_MODEL: 'text-embedding-004',
  /** Default similarity threshold for search results (0-1) */
  SIMILARITY_THRESHOLD: 0.7,
  /** Default maximum number of search results */
  MAX_RESULTS: 10,
  /** Maximum concurrent file processing operations */
  MAX_CONCURRENT_OPERATIONS: 5,
  /** Cache TTL in milliseconds (1 hour) */
  CACHE_TTL_MS: 3600000,
  /** Retry attempts for API calls */
  RETRY_ATTEMPTS: 3,
  /** Retry delay in milliseconds */
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Log level options
 */
export type RagLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Complete RAG configuration interface
 */
export interface RagConfig {
  /** Gemini API key for embeddings */
  geminiApiKey: string | undefined;
  /** Path to store RAG vector databases */
  storePath: string;
  /** Maximum file size in MB to process */
  maxFileSizeMb: number;
  /** Chunk size for text splitting */
  chunkSize: number;
  /** Overlap between chunks */
  overlap: number;
  /** Enable automatic synchronization */
  autoSync: boolean;
  /** Log level for RAG operations */
  logLevel: RagLogLevel;
  /** Embedding model identifier */
  embeddingModel: string;
  /** Minimum similarity score for results */
  similarityThreshold: number;
  /** Maximum number of search results */
  maxResults: number;
  /** Maximum concurrent operations */
  maxConcurrentOperations: number;
  /** Cache time-to-live in milliseconds */
  cacheTtlMs: number;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
}

/**
 * Helper to safely parse integer from environment variable
 */
const parseEnvInt = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Helper to safely parse float from environment variable
 */
const parseEnvFloat = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Helper to safely parse boolean from environment variable
 */
const parseEnvBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
};

/**
 * Helper to validate log level
 */
const parseLogLevel = (value: string | undefined, defaultValue: RagLogLevel): RagLogLevel => {
  const validLevels: RagLogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (value && validLevels.includes(value as RagLogLevel)) {
    return value as RagLogLevel;
  }
  return defaultValue;
};

/**
 * Default RAG configuration with environment variable overrides
 *
 * This configuration object reads from environment variables when available,
 * falling back to sensible defaults.
 *
 * @example
 * ```typescript
 * import { DEFAULT_RAG_CONFIG } from '@config/rag/defaults';
 *
 * console.log(DEFAULT_RAG_CONFIG.storePath);
 * // => ~/.wundr/rag-stores (or RAG_DEFAULT_STORE_PATH env var)
 * ```
 */
export const DEFAULT_RAG_CONFIG: RagConfig = {
  geminiApiKey: process.env[RAG_ENV_VARS.GEMINI_API_KEY],
  storePath: process.env[RAG_ENV_VARS.DEFAULT_STORE_PATH] || RAG_DEFAULTS.STORE_PATH,
  maxFileSizeMb: parseEnvInt(
    process.env[RAG_ENV_VARS.MAX_FILE_SIZE_MB],
    RAG_DEFAULTS.MAX_FILE_SIZE_MB
  ),
  chunkSize: parseEnvInt(
    process.env[RAG_ENV_VARS.DEFAULT_CHUNK_SIZE],
    RAG_DEFAULTS.CHUNK_SIZE
  ),
  overlap: parseEnvInt(
    process.env[RAG_ENV_VARS.DEFAULT_OVERLAP],
    RAG_DEFAULTS.OVERLAP
  ),
  autoSync: parseEnvBool(
    process.env[RAG_ENV_VARS.AUTO_SYNC],
    RAG_DEFAULTS.AUTO_SYNC
  ),
  logLevel: parseLogLevel(
    process.env[RAG_ENV_VARS.LOG_LEVEL],
    RAG_DEFAULTS.LOG_LEVEL
  ),
  embeddingModel: process.env[RAG_ENV_VARS.EMBEDDING_MODEL] || RAG_DEFAULTS.EMBEDDING_MODEL,
  similarityThreshold: parseEnvFloat(
    process.env[RAG_ENV_VARS.SIMILARITY_THRESHOLD],
    RAG_DEFAULTS.SIMILARITY_THRESHOLD
  ),
  maxResults: parseEnvInt(
    process.env[RAG_ENV_VARS.MAX_RESULTS],
    RAG_DEFAULTS.MAX_RESULTS
  ),
  maxConcurrentOperations: RAG_DEFAULTS.MAX_CONCURRENT_OPERATIONS,
  cacheTtlMs: RAG_DEFAULTS.CACHE_TTL_MS,
  retryAttempts: RAG_DEFAULTS.RETRY_ATTEMPTS,
  retryDelayMs: RAG_DEFAULTS.RETRY_DELAY_MS,
};

/**
 * Creates a fresh RAG configuration by reading current environment variables
 *
 * Use this function when you need to reload configuration after environment
 * variables have been modified at runtime.
 *
 * @returns Fresh RagConfig object with current environment values
 */
export const createRagConfig = (): RagConfig => ({
  geminiApiKey: process.env[RAG_ENV_VARS.GEMINI_API_KEY],
  storePath: process.env[RAG_ENV_VARS.DEFAULT_STORE_PATH] || RAG_DEFAULTS.STORE_PATH,
  maxFileSizeMb: parseEnvInt(
    process.env[RAG_ENV_VARS.MAX_FILE_SIZE_MB],
    RAG_DEFAULTS.MAX_FILE_SIZE_MB
  ),
  chunkSize: parseEnvInt(
    process.env[RAG_ENV_VARS.DEFAULT_CHUNK_SIZE],
    RAG_DEFAULTS.CHUNK_SIZE
  ),
  overlap: parseEnvInt(
    process.env[RAG_ENV_VARS.DEFAULT_OVERLAP],
    RAG_DEFAULTS.OVERLAP
  ),
  autoSync: parseEnvBool(
    process.env[RAG_ENV_VARS.AUTO_SYNC],
    RAG_DEFAULTS.AUTO_SYNC
  ),
  logLevel: parseLogLevel(
    process.env[RAG_ENV_VARS.LOG_LEVEL],
    RAG_DEFAULTS.LOG_LEVEL
  ),
  embeddingModel: process.env[RAG_ENV_VARS.EMBEDDING_MODEL] || RAG_DEFAULTS.EMBEDDING_MODEL,
  similarityThreshold: parseEnvFloat(
    process.env[RAG_ENV_VARS.SIMILARITY_THRESHOLD],
    RAG_DEFAULTS.SIMILARITY_THRESHOLD
  ),
  maxResults: parseEnvInt(
    process.env[RAG_ENV_VARS.MAX_RESULTS],
    RAG_DEFAULTS.MAX_RESULTS
  ),
  maxConcurrentOperations: RAG_DEFAULTS.MAX_CONCURRENT_OPERATIONS,
  cacheTtlMs: RAG_DEFAULTS.CACHE_TTL_MS,
  retryAttempts: RAG_DEFAULTS.RETRY_ATTEMPTS,
  retryDelayMs: RAG_DEFAULTS.RETRY_DELAY_MS,
});

/**
 * Checks if the Gemini API key is configured
 *
 * @returns true if GEMINI_API_KEY is set in environment
 */
export const isGeminiConfigured = (): boolean => {
  return Boolean(process.env[RAG_ENV_VARS.GEMINI_API_KEY]);
};

/**
 * Gets the Gemini API key from environment
 *
 * @throws Error if GEMINI_API_KEY is not set
 * @returns The Gemini API key
 */
export const getGeminiApiKey = (): string => {
  const key = process.env[RAG_ENV_VARS.GEMINI_API_KEY];
  if (!key) {
    throw new Error(
      `${RAG_ENV_VARS.GEMINI_API_KEY} environment variable is not set. ` +
      'Please set it to use RAG features with Gemini embeddings.'
    );
  }
  return key;
};
