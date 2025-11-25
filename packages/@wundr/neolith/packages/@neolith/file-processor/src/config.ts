/**
 * @genesis/file-processor - Configuration
 *
 * Configuration management for file processing service.
 */

import type { ProcessingOptions } from './types';

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  /** Redis host */
  host: string;

  /** Redis port */
  port: number;

  /** Redis password */
  password?: string;

  /** Redis database number */
  db?: number;

  /** TLS enabled */
  tls?: boolean;

  /** Connection timeout in milliseconds */
  connectTimeout?: number;

  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Queue name */
  name: string;

  /** Number of concurrent workers */
  concurrency: number;

  /** Job timeout in milliseconds */
  jobTimeout: number;

  /** Maximum retry attempts per job */
  maxRetries: number;

  /** Retry delay in milliseconds */
  retryDelay: number;

  /** Remove completed jobs after (milliseconds) */
  removeOnComplete: number;

  /** Remove failed jobs after (milliseconds) */
  removeOnFail: number;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage type */
  type: 'local' | 's3' | 'gcs' | 'azure';

  /** Local storage base path */
  basePath?: string;

  /** S3/Cloud bucket name */
  bucket?: string;

  /** S3/Cloud region */
  region?: string;

  /** Temporary file directory */
  tempDir: string;

  /** Clean up temp files after processing */
  cleanupTemp: boolean;
}

/**
 * OCR configuration
 */
export interface OcrConfig {
  /** Default OCR languages */
  defaultLanguages: string[];

  /** Tesseract worker pool size */
  workerPoolSize: number;

  /** Cache trained data */
  cacheTrainedData: boolean;

  /** Trained data path */
  trainedDataPath?: string;
}

/**
 * Main file processor configuration
 */
export interface FileProcessorConfig {
  /** Redis connection settings */
  redis: RedisConfig;

  /** Queue settings */
  queue: QueueConfig;

  /** Storage settings */
  storage: StorageConfig;

  /** OCR settings */
  ocr: OcrConfig;

  /** Default processing options */
  defaultProcessingOptions: ProcessingOptions;

  /** Maximum file size in bytes */
  maxFileSize: number;

  /** Supported MIME types */
  supportedMimeTypes: string[];

  /** Enable metrics collection */
  enableMetrics: boolean;

  /** Logging level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default configuration values
 */
export const defaultConfig: FileProcessorConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    tls: process.env.REDIS_TLS === 'true',
    connectTimeout: 10000,
    maxRetries: 3,
  },

  queue: {
    name: 'file-processing',
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3', 10),
    jobTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000,
    removeOnComplete: 3600000, // 1 hour
    removeOnFail: 86400000, // 24 hours
  },

  storage: {
    type:
      (process.env.STORAGE_TYPE as 'local' | 's3' | 'gcs' | 'azure') || 'local',
    basePath: process.env.STORAGE_BASE_PATH || './uploads',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    tempDir: process.env.TEMP_DIR || '/tmp/genesis-file-processor',
    cleanupTemp: true,
  },

  ocr: {
    defaultLanguages: ['eng'],
    workerPoolSize: 2,
    cacheTrainedData: true,
    trainedDataPath: process.env.TESSERACT_DATA_PATH,
  },

  defaultProcessingOptions: {
    enableOcr: true,
    ocrLanguages: ['eng'],
    extractTables: true,
    extractImages: false,
    maxPages: 100,
    timeout: 300000,
  },

  maxFileSize: 100 * 1024 * 1024, // 100 MB

  supportedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/tiff',
    'image/webp',
  ],

  enableMetrics: true,

  logLevel:
    (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
};

/**
 * Create configuration with overrides
 */
export function createConfig(
  overrides: Partial<FileProcessorConfig> = {},
): FileProcessorConfig {
  return {
    ...defaultConfig,
    ...overrides,
    redis: {
      ...defaultConfig.redis,
      ...overrides.redis,
    },
    queue: {
      ...defaultConfig.queue,
      ...overrides.queue,
    },
    storage: {
      ...defaultConfig.storage,
      ...overrides.storage,
    },
    ocr: {
      ...defaultConfig.ocr,
      ...overrides.ocr,
    },
    defaultProcessingOptions: {
      ...defaultConfig.defaultProcessingOptions,
      ...overrides.defaultProcessingOptions,
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: FileProcessorConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.redis.host) {
    errors.push('Redis host is required');
  }

  if (config.redis.port < 1 || config.redis.port > 65535) {
    errors.push('Redis port must be between 1 and 65535');
  }

  if (config.queue.concurrency < 1) {
    errors.push('Queue concurrency must be at least 1');
  }

  if (config.queue.jobTimeout < 1000) {
    errors.push('Job timeout must be at least 1000ms');
  }

  if (config.maxFileSize < 1024) {
    errors.push('Max file size must be at least 1KB');
  }

  if (config.storage.type === 's3' && !config.storage.bucket) {
    errors.push('S3 bucket is required when storage type is s3');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
