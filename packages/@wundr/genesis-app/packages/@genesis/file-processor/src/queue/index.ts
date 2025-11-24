/**
 * @genesis/file-processor - Queue Module
 *
 * Background job queue system for file processing operations.
 * Provides both Redis-based (production) and in-memory (development) implementations.
 *
 * @packageDocumentation
 */

// Types
// Factory functions for convenience
import { MemoryProcessingQueue } from './memory-queue';
import { RedisProcessingQueue } from './redis-queue';

import type { RedisQueueConfig, MemoryQueueConfig, ProcessorRegistry } from './types';

export {
  // Processing types
  ProcessingType,
  JobPriority,
  JobStatus,
  QueueEvent,

  // Job interfaces
  ProcessingJob,
  JobInfo,
  ProcessingResult,
  ProcessingMetrics,

  // Event interfaces
  EventHandler,
  JobAddedEvent,
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobRetryEvent,
  QueueErrorEvent,

  // Processor interfaces
  JobProcessor,
  ProcessorRegistry,

  // Configuration interfaces
  QueueOptions,
  RedisConnectionOptions,
  DeadLetterQueueOptions,
  RedisQueueConfig,
  MemoryQueueConfig,

  // Statistics
  QueueStats,
} from './types';

// Processing Queue Interface
export {
  ProcessingQueue,
  BaseProcessingQueue,
} from './processing-queue';

// Redis Queue Implementation
export {
  RedisProcessingQueue,
  createRedisProcessingQueue,
} from './redis-queue';

// Memory Queue Implementation
export {
  MemoryProcessingQueue,
  createMemoryProcessingQueue,
} from './memory-queue';

// Job Worker
export {
  JobWorker,
  JobWorkerConfig,
  Logger,
  SimpleProcessorRegistry,
  createJobWorker,
  createProcessorRegistry,
} from './job-worker';

// Processing Coordinator
export {
  ProcessingCoordinator,
  StorageService,
  StoredFile,
  FileRecordService,
  FileRecord,
  UploadedFile,
  CoordinatorConfig,
  BatchProcessOptions,
  createProcessingCoordinator,
} from './coordinator';

/**
 * Queue type selection
 */
export type QueueType = 'redis' | 'memory';

/**
 * Queue factory options
 */
export interface QueueFactoryOptions {
  /** Queue type */
  type: QueueType;
  /** Redis configuration (for redis type) */
  redis?: Partial<RedisQueueConfig>;
  /** Memory configuration (for memory type) */
  memory?: Partial<MemoryQueueConfig>;
  /** Processor registry */
  processorRegistry?: ProcessorRegistry;
}

/**
 * Create a processing queue based on configuration
 *
 * Factory function that creates the appropriate queue implementation
 * based on the specified type.
 *
 * @param options - Queue factory options
 * @returns ProcessingQueue instance
 *
 * @example
 * ```typescript
 * // Create Redis queue for production
 * const prodQueue = createQueue({
 *   type: 'redis',
 *   redis: {
 *     connection: { host: 'redis.example.com' },
 *     queue: { concurrency: 5 },
 *   },
 * });
 *
 * // Create memory queue for development
 * const devQueue = createQueue({
 *   type: 'memory',
 *   memory: {
 *     queue: { concurrency: 2 },
 *   },
 * });
 * ```
 */
export function createQueue(options: QueueFactoryOptions): RedisProcessingQueue | MemoryProcessingQueue {
  switch (options.type) {
    case 'redis':
      return new RedisProcessingQueue(options.redis, options.processorRegistry);
    case 'memory':
      return new MemoryProcessingQueue(options.memory, options.processorRegistry);
    default:
      throw new Error(`Unknown queue type: ${options.type}`);
  }
}

/**
 * Create a queue from environment configuration
 *
 * Automatically selects Redis or memory queue based on environment variables.
 *
 * Environment variables:
 * - QUEUE_TYPE: 'redis' or 'memory' (default: 'memory')
 * - REDIS_HOST: Redis host (default: 'localhost')
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database (default: 0)
 * - QUEUE_CONCURRENCY: Number of concurrent workers (default: 3)
 *
 * @param processorRegistry - Optional processor registry
 * @returns ProcessingQueue instance
 *
 * @example
 * ```typescript
 * // Uses environment variables
 * const queue = createQueueFromEnv();
 * await queue.initialize();
 * ```
 */
export function createQueueFromEnv(
  processorRegistry?: ProcessorRegistry,
): RedisProcessingQueue | MemoryProcessingQueue {
  const queueType = (process.env.QUEUE_TYPE ?? 'memory') as QueueType;

  if (queueType === 'redis') {
    return new RedisProcessingQueue(
      {
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB ?? '0', 10),
          tls: process.env.REDIS_TLS === 'true',
        },
        queue: {
          concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '3', 10),
        },
      },
      processorRegistry,
    );
  }

  return new MemoryProcessingQueue(
    {
      queue: {
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '2', 10),
      },
    },
    processorRegistry,
  );
}
