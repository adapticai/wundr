/**
 * @genesis/file-processor - Job Worker
 *
 * Manages job processing with registered processors.
 * Provides a unified interface for processing different job types.
 *
 * @packageDocumentation
 */

import {
  QueueEvent,
  type ProcessingJob,
  type ProcessingType,
  type JobProcessor,
  type ProcessorRegistry,
  type ProcessingResult,
  type EventHandler,
} from './types';

import type { ProcessingQueue } from './processing-queue';

/**
 * Job worker configuration
 */
export interface JobWorkerConfig {
  /** Auto-start processing on initialization */
  autoStart?: boolean;
  /** Enable detailed logging */
  verbose?: boolean;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Default console logger
 */
/* eslint-disable no-console -- Intentional fallback logger implementation */
const defaultLogger: Logger = {
  debug: (msg, ...args) => console.debug(`[JobWorker] ${msg}`, ...args),
  info: (msg, ...args) => console.info(`[JobWorker] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[JobWorker] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[JobWorker] ${msg}`, ...args),
};
/* eslint-enable no-console */

/**
 * Simple processor registry implementation
 */
export class SimpleProcessorRegistry implements ProcessorRegistry {
  private processors: Map<ProcessingType, JobProcessor> = new Map();

  /**
   * Register a processor for a processing type
   */
  register(type: ProcessingType, processor: JobProcessor): void {
    if (this.processors.has(type)) {
      throw new Error(`Processor already registered for type: ${type}`);
    }
    this.processors.set(type, processor);
  }

  /**
   * Unregister a processor
   */
  unregister(type: ProcessingType): void {
    this.processors.delete(type);
  }

  /**
   * Get a processor for a processing type
   */
  get(type: ProcessingType): JobProcessor | undefined {
    return this.processors.get(type);
  }

  /**
   * Check if a processor is registered
   */
  has(type: ProcessingType): boolean {
    return this.processors.has(type);
  }

  /**
   * Get all registered processing types
   */
  getTypes(): ProcessingType[] {
    return Array.from(this.processors.keys());
  }
}

/**
 * Job Worker
 *
 * Coordinates job processing by managing processors and queue interaction.
 *
 * @example
 * ```typescript
 * const registry = new SimpleProcessorRegistry();
 * registry.register('text-extraction', myTextExtractor);
 *
 * const worker = new JobWorker(queue, registry);
 * worker.start();
 *
 * // Later...
 * await worker.stop();
 * ```
 */
export class JobWorker {
  private queue: ProcessingQueue;
  private registry: ProcessorRegistry;
  private config: Required<JobWorkerConfig>;
  private running = false;
  private eventCleanup: Array<() => void> = [];

  /**
   * Create a new job worker
   *
   * @param queue - The processing queue to work from
   * @param processors - Registry of job processors
   * @param config - Worker configuration
   */
  constructor(
    queue: ProcessingQueue,
    processors: ProcessorRegistry,
    config: JobWorkerConfig = {},
  ) {
    this.queue = queue;
    this.registry = processors;
    this.config = {
      autoStart: config.autoStart ?? false,
      verbose: config.verbose ?? false,
      logger: config.logger ?? defaultLogger,
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start the worker
   *
   * Sets up event handlers and begins listening for jobs.
   */
  start(): void {
    if (this.running) {
      this.config.logger.warn('Worker is already running');
      return;
    }

    this.running = true;
    this.setupEventHandlers();

    this.config.logger.info('Job worker started');
    this.config.logger.info(`Registered processors: ${this.registry.getTypes().join(', ')}`);
  }

  /**
   * Stop the worker
   *
   * Removes event handlers and stops processing new jobs.
   * Active jobs will complete before the worker fully stops.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.config.logger.warn('Worker is not running');
      return;
    }

    this.running = false;

    // Clean up event handlers
    for (const cleanup of this.eventCleanup) {
      cleanup();
    }
    this.eventCleanup = [];

    this.config.logger.info('Job worker stopped');
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Register a processor for a processing type
   *
   * @param type - The processing type
   * @param processor - The processor to register
   */
  registerProcessor(type: ProcessingType, processor: JobProcessor): void {
    this.registry.register(type, processor);
    this.config.logger.info(`Registered processor for type: ${type}`);
  }

  /**
   * Unregister a processor
   *
   * @param type - The processing type to unregister
   */
  unregisterProcessor(type: ProcessingType): void {
    this.registry.unregister(type);
    this.config.logger.info(`Unregistered processor for type: ${type}`);
  }

  /**
   * Get the processor registry
   */
  getRegistry(): ProcessorRegistry {
    return this.registry;
  }

  /**
   * Get registered processor types
   */
  getRegisteredTypes(): ProcessingType[] {
    return this.registry.getTypes();
  }

  /**
   * Check if a processor is registered for a type
   */
  hasProcessor(type: ProcessingType): boolean {
    return this.registry.has(type);
  }

  /**
   * Process a job directly (bypassing queue)
   *
   * Useful for synchronous processing or testing.
   *
   * @param job - The job to process
   * @returns Processing result
   */
  async processJobDirect(job: ProcessingJob): Promise<ProcessingResult> {
    const processor = this.registry.get(job.type);
    if (!processor) {
      throw new Error(`No processor registered for type: ${job.type}`);
    }

    // Validate if validator exists
    if (processor.validate) {
      const isValid = await processor.validate(job);
      if (!isValid) {
        throw new Error(`Job validation failed for type: ${job.type}`);
      }
    }

    // Process
    try {
      processor.onProgress?.(job, 0, 'Starting');
      const result = await processor.process(job);
      processor.onProgress?.(job, 100, 'Complete');
      processor.onComplete?.(job, result);
      return result;
    } catch (error) {
      processor.onError?.(job, error as Error);
      throw error;
    }
  }

  /**
   * Setup event handlers for queue events
   */
  private setupEventHandlers(): void {
    // Job started
    const onJobStarted: EventHandler = (data) => {
      const { jobId, job } = data as { jobId: string; job: ProcessingJob };
      if (this.config.verbose) {
        this.config.logger.debug(`Job started: ${jobId} (type: ${job.type})`);
      }
    };
    this.queue.on(QueueEvent.JOB_STARTED, onJobStarted);
    this.eventCleanup.push(() => this.queue.off(QueueEvent.JOB_STARTED, onJobStarted));

    // Job completed
    const onJobCompleted: EventHandler = (data) => {
      const { jobId, duration } = data as { jobId: string; duration: number };
      this.config.logger.info(`Job completed: ${jobId} (${duration}ms)`);
    };
    this.queue.on(QueueEvent.JOB_COMPLETED, onJobCompleted);
    this.eventCleanup.push(() => this.queue.off(QueueEvent.JOB_COMPLETED, onJobCompleted));

    // Job failed
    const onJobFailed: EventHandler = (data) => {
      const { jobId, error, willRetry } = data as {
        jobId: string;
        error: string;
        willRetry: boolean;
      };
      if (willRetry) {
        this.config.logger.warn(`Job failed (will retry): ${jobId} - ${error}`);
      } else {
        this.config.logger.error(`Job failed permanently: ${jobId} - ${error}`);
      }
    };
    this.queue.on(QueueEvent.JOB_FAILED, onJobFailed);
    this.eventCleanup.push(() => this.queue.off(QueueEvent.JOB_FAILED, onJobFailed));

    // Job progress
    if (this.config.verbose) {
      const onJobProgress: EventHandler = (data) => {
        const { jobId, progress, message } = data as {
          jobId: string;
          progress: number;
          message?: string;
        };
        this.config.logger.debug(
          `Job progress: ${jobId} - ${progress}%${message ? ` (${message})` : ''}`,
        );
      };
      this.queue.on(QueueEvent.JOB_PROGRESS, onJobProgress);
      this.eventCleanup.push(() => this.queue.off(QueueEvent.JOB_PROGRESS, onJobProgress));
    }

    // Queue drained
    const onQueueDrained: EventHandler = () => {
      if (this.config.verbose) {
        this.config.logger.debug('Queue drained - no more waiting jobs');
      }
    };
    this.queue.on(QueueEvent.QUEUE_DRAINED, onQueueDrained);
    this.eventCleanup.push(() => this.queue.off(QueueEvent.QUEUE_DRAINED, onQueueDrained));

    // Queue error
    const onQueueError: EventHandler = (data) => {
      const { error, context } = data as { error: Error; context?: string };
      this.config.logger.error(`Queue error${context ? ` (${context})` : ''}: ${error.message}`);
    };
    this.queue.on(QueueEvent.QUEUE_ERROR, onQueueError);
    this.eventCleanup.push(() => this.queue.off(QueueEvent.QUEUE_ERROR, onQueueError));
  }
}

/**
 * Create a job worker
 *
 * @param queue - The processing queue
 * @param processors - Processor registry
 * @param config - Worker configuration
 * @returns JobWorker instance
 */
export function createJobWorker(
  queue: ProcessingQueue,
  processors: ProcessorRegistry,
  config?: JobWorkerConfig,
): JobWorker {
  return new JobWorker(queue, processors, config);
}

/**
 * Create a processor registry
 *
 * @returns SimpleProcessorRegistry instance
 */
export function createProcessorRegistry(): SimpleProcessorRegistry {
  return new SimpleProcessorRegistry();
}
