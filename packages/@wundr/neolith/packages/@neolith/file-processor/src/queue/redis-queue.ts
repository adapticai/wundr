/**
 * @genesis/file-processor - Redis Processing Queue
 *
 * Production-ready processing queue implementation using BullMQ.
 * Provides distributed job processing with Redis as the backend.
 *
 * Features:
 * - Reliable job processing with Redis persistence
 * - Priority queues with 10 priority levels
 * - Exponential backoff retry mechanism
 * - Dead letter queue for failed jobs
 * - Progress tracking
 * - Event-driven architecture
 *
 * @packageDocumentation
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

import { BaseProcessingQueue } from './processing-queue';
import {
  JobStatus,
  QueueEvent,
  type ProcessingJob,
  type JobInfo,
  type QueueStats,
  type RedisQueueConfig,
  type ProcessingResult,
  type ProcessorRegistry,
  type JobAddedEvent,
  type JobStartedEvent,
  type JobProgressEvent,
  type JobCompletedEvent,
  type JobFailedEvent,
  type JobRetryEvent,
  type QueueErrorEvent,
} from './types';

import type { Job } from 'bullmq';

/**
 * Default configuration for Redis queue
 */
const DEFAULT_CONFIG: RedisQueueConfig = {
  connection: {
    host: 'localhost',
    port: 6379,
    db: 0,
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
  },
  queue: {
    name: 'file-processing',
    defaultPriority: 5,
    concurrency: 3,
    defaultTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000,
    retryBackoffMultiplier: 2,
    maxRetryDelay: 60000, // 1 minute
    removeOnComplete: 3600000, // 1 hour
    removeOnFail: 86400000, // 24 hours
    stalledJobRecovery: true,
    stalledJobInterval: 30000, // 30 seconds
  },
  deadLetterQueue: {
    enabled: true,
    queueName: 'file-processing-dlq',
    maxSize: 1000,
    retentionTime: 604800000, // 7 days
  },
};

/**
 * Redis-based Processing Queue using BullMQ
 *
 * Production-ready implementation for distributed job processing.
 *
 * @example
 * ```typescript
 * const queue = new RedisProcessingQueue({
 *   connection: { host: 'redis.example.com', port: 6379 },
 *   queue: { concurrency: 5 },
 * });
 *
 * await queue.initialize();
 *
 * const jobId = await queue.addJob({
 *   fileId: 'file-123',
 *   type: 'text-extraction',
 * });
 * ```
 */
export class RedisProcessingQueue extends BaseProcessingQueue {
  private config: RedisQueueConfig;
  private connection: Redis | null = null;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private queueEvents: QueueEvents | null = null;
  private deadLetterQueue: Queue | null = null;
  private processorRegistry: ProcessorRegistry | null = null;
  private paused = false;

  /**
   * Create a new Redis processing queue
   *
   * @param config - Queue configuration
   * @param processorRegistry - Optional processor registry for job handling
   */
  constructor(
    config: Partial<RedisQueueConfig> = {},
    processorRegistry?: ProcessorRegistry
  ) {
    super(config.queue?.name ?? DEFAULT_CONFIG.queue.name!);
    this.config = this.mergeConfig(config);
    this.processorRegistry = processorRegistry ?? null;
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(config: Partial<RedisQueueConfig>): RedisQueueConfig {
    return {
      connection: {
        ...DEFAULT_CONFIG.connection,
        ...config.connection,
      },
      queue: {
        ...DEFAULT_CONFIG.queue,
        ...config.queue,
      },
      deadLetterQueue: {
        enabled:
          config.deadLetterQueue?.enabled ??
          DEFAULT_CONFIG.deadLetterQueue!.enabled,
        queueName:
          config.deadLetterQueue?.queueName ??
          DEFAULT_CONFIG.deadLetterQueue!.queueName,
        maxSize:
          config.deadLetterQueue?.maxSize ??
          DEFAULT_CONFIG.deadLetterQueue!.maxSize,
        retentionTime:
          config.deadLetterQueue?.retentionTime ??
          DEFAULT_CONFIG.deadLetterQueue!.retentionTime,
      },
    };
  }

  /**
   * Set the processor registry
   */
  setProcessorRegistry(registry: ProcessorRegistry): void {
    this.processorRegistry = registry;
  }

  /**
   * Initialize the queue, worker, and connections
   */
  async initialize(): Promise<void> {
    if (this.ready) {
      return;
    }

    try {
      // Create Redis connection
      this.connection = new Redis({
        host: this.config.connection.host,
        port: this.config.connection.port,
        password: this.config.connection.password,
        db: this.config.connection.db,
        connectTimeout: this.config.connection.connectTimeout,
        maxRetriesPerRequest: this.config.connection.maxRetriesPerRequest,
        tls: this.config.connection.tls ? {} : undefined,
        keyPrefix: this.config.connection.keyPrefix,
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        this.connection!.on('connect', () => resolve());
        this.connection!.on('error', err => reject(err));
        setTimeout(
          () => reject(new Error('Redis connection timeout')),
          this.config.connection.connectTimeout
        );
      });

      // Create main queue
      this.queue = new Queue(this.config.queue.name!, {
        connection: this.connection.duplicate(),
        defaultJobOptions: {
          attempts: this.config.queue.maxRetries! + 1,
          backoff: {
            type: 'exponential',
            delay: this.config.queue.retryDelay!,
          },
          removeOnComplete: {
            age: Math.floor(this.config.queue.removeOnComplete! / 1000),
          },
          removeOnFail: {
            age: Math.floor(this.config.queue.removeOnFail! / 1000),
          },
        },
      });

      // Create dead letter queue if enabled
      if (this.config.deadLetterQueue?.enabled) {
        this.deadLetterQueue = new Queue(
          this.config.deadLetterQueue.queueName!,
          {
            connection: this.connection.duplicate(),
          }
        );
      }

      // Create worker
      this.worker = new Worker(
        this.config.queue.name!,
        async job => this.processJob(job),
        {
          connection: this.connection.duplicate(),
          concurrency: this.config.queue.concurrency!,
          stalledInterval: this.config.queue.stalledJobInterval,
        }
      );

      // Create queue events listener
      this.queueEvents = new QueueEvents(this.config.queue.name!, {
        connection: this.connection.duplicate(),
      });

      // Setup event handlers
      this.setupEventHandlers();

      this.ready = true;
      this.emit(QueueEvent.WORKER_READY, { queueName: this.name });
    } catch (error) {
      this.emit<QueueErrorEvent>(QueueEvent.QUEUE_ERROR, {
        error: error as Error,
        context: 'initialization',
      });
      throw error;
    }
  }

  /**
   * Setup BullMQ event handlers
   */
  private setupEventHandlers(): void {
    if (!this.worker || !this.queueEvents) {
      return;
    }

    // Worker events
    this.worker.on('completed', (job: Job, result: ProcessingResult) => {
      this.emit<JobCompletedEvent>(QueueEvent.JOB_COMPLETED, {
        jobId: job.id!,
        result,
        duration: Date.now() - job.timestamp,
      });
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (!job) {
        return;
      }

      const willRetry = job.attemptsMade < this.config.queue.maxRetries! + 1;

      this.emit<JobFailedEvent>(QueueEvent.JOB_FAILED, {
        jobId: job.id!,
        error: error.message,
        stackTrace: error.stack,
        attempts: job.attemptsMade,
        willRetry,
      });

      // Move to dead letter queue if exhausted retries
      if (!willRetry && this.deadLetterQueue) {
        this.moveToDeadLetterQueue(job, error).catch(dlqError => {
          console.error('Failed to move job to DLQ:', dlqError);
        });
      }
    });

    this.worker.on('active', (job: Job) => {
      this.emit<JobStartedEvent>(QueueEvent.JOB_STARTED, {
        jobId: job.id!,
        job: job.data as ProcessingJob,
      });
    });

    this.worker.on('stalled', (jobId: string) => {
      this.emit(QueueEvent.JOB_STALLED, { jobId });
    });

    this.worker.on('error', (error: Error) => {
      this.emit<QueueErrorEvent>(QueueEvent.QUEUE_ERROR, {
        error,
        context: 'worker',
      });
    });

    // Queue events
    this.queueEvents.on('waiting', ({ jobId: _jobId }) => {
      // Job added event is emitted in addJob
    });

    this.queueEvents.on('delayed', ({ jobId, delay }) => {
      this.emit<JobRetryEvent>(QueueEvent.JOB_RETRY, {
        jobId,
        attempt: 0, // Will be updated in job
        maxAttempts: this.config.queue.maxRetries! + 1,
        nextRetryAt: new Date(Date.now() + Number(delay)),
      });
    });

    this.queueEvents.on('drained', () => {
      this.emit(QueueEvent.QUEUE_DRAINED, {});
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      const progress =
        typeof data === 'number'
          ? data
          : ((data as { progress?: number })?.progress ?? 0);
      this.emit<JobProgressEvent>(QueueEvent.JOB_PROGRESS, {
        jobId,
        progress,
        message:
          typeof data === 'object'
            ? (data as { message?: string })?.message
            : undefined,
      });
    });
  }

  /**
   * Process a job
   */
  private async processJob(job: Job): Promise<ProcessingResult> {
    const data = job.data as ProcessingJob;

    if (!this.processorRegistry) {
      throw new Error('No processor registry configured');
    }

    const processor = this.processorRegistry.get(data.type);
    if (!processor) {
      throw new Error(`No processor registered for type: ${data.type}`);
    }

    // Validate job if validator exists
    if (processor.validate) {
      const isValid = await processor.validate(data);
      if (!isValid) {
        throw new Error(`Job validation failed for type: ${data.type}`);
      }
    }

    // Process with progress tracking
    const progressCallback = (progress: number, message?: string) => {
      job.updateProgress({ progress, message }).catch(() => {
        // Ignore progress update errors
      });
      processor.onProgress?.(data, progress, message);
    };

    try {
      // Start processing
      progressCallback(0, 'Starting processing');

      const result = await processor.process(data);

      // Complete
      progressCallback(100, 'Processing complete');
      processor.onComplete?.(data, result);

      return result;
    } catch (error) {
      processor.onError?.(data, error as Error);
      throw error;
    }
  }

  /**
   * Move a job to the dead letter queue
   */
  private async moveToDeadLetterQueue(job: Job, error: Error): Promise<void> {
    if (!this.deadLetterQueue) {
      return;
    }

    await this.deadLetterQueue.add(
      'dead-letter',
      {
        originalJob: job.data,
        error: error.message,
        stackTrace: error.stack,
        failedAt: new Date().toISOString(),
        attempts: job.attemptsMade,
      },
      {
        removeOnComplete: {
          age: Math.floor(
            (this.config.deadLetterQueue?.retentionTime ?? 604800000) / 1000
          ),
        },
      }
    );
  }

  /**
   * Close all connections gracefully
   */
  async close(): Promise<void> {
    if (!this.ready) {
      return;
    }

    this.ready = false;

    // Close worker (wait for active jobs)
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    // Close queue events
    if (this.queueEvents) {
      await this.queueEvents.close();
      this.queueEvents = null;
    }

    // Close queues
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }

    if (this.deadLetterQueue) {
      await this.deadLetterQueue.close();
      this.deadLetterQueue = null;
    }

    // Close Redis connection
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }

    this.emit(QueueEvent.WORKER_CLOSED, { queueName: this.name });
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: ProcessingJob): Promise<string> {
    this.ensureReady();

    const jobId = this.generateJobId();
    const priority = this.normalizePriority(
      job.priority ?? this.config.queue.defaultPriority ?? 5
    );

    const bullJob = await this.queue!.add(job.type, job, {
      jobId,
      priority,
      delay: job.delay,
    });

    this.emit<JobAddedEvent>(QueueEvent.JOB_ADDED, {
      jobId: bullJob.id!,
      job,
    });

    return bullJob.id!;
  }

  /**
   * Add multiple jobs in batch
   */
  async addBulkJobs(jobs: ProcessingJob[]): Promise<string[]> {
    this.ensureReady();

    const bulkJobs = jobs.map(job => ({
      name: job.type,
      data: job,
      opts: {
        jobId: this.generateJobId(),
        priority: this.normalizePriority(
          job.priority ?? this.config.queue.defaultPriority ?? 5
        ),
        delay: job.delay,
      },
    }));

    const addedJobs = await this.queue!.addBulk(bulkJobs);

    const jobIds = addedJobs.map(j => j.id!);

    // Emit events for each job
    jobs.forEach((job, index) => {
      this.emit<JobAddedEvent>(QueueEvent.JOB_ADDED, {
        jobId: jobIds[index]!,
        job,
      });
    });

    return jobIds;
  }

  /**
   * Get job information
   */
  async getJob(jobId: string): Promise<JobInfo | null> {
    this.ensureReady();

    const job = await this.queue!.getJob(jobId);
    if (!job) {
      return null;
    }

    return this.mapJobToInfo(job);
  }

  /**
   * Cancel a waiting job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    this.ensureReady();

    const job = await this.queue!.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state === 'active') {
      return false; // Cannot cancel active jobs
    }

    await job.remove();
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    this.ensureReady();

    const job = await this.queue!.getJob(jobId);
    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state !== 'failed') {
      return false;
    }

    await job.retry();
    return true;
  }

  /**
   * Update job progress
   */
  async updateProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void> {
    this.ensureReady();

    const job = await this.queue!.getJob(jobId);
    if (job) {
      await job.updateProgress({ progress, message });
    }
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    this.ensureReady();
    await this.queue!.pause();
    this.paused = true;
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    this.ensureReady();
    await this.queue!.resume();
    this.paused = false;
  }

  /**
   * Check if queue is paused
   */
  async isPaused(): Promise<boolean> {
    this.ensureReady();
    return this.paused;
  }

  /**
   * Clean jobs with a specific status
   */
  async clean(status: JobStatus, olderThan?: number): Promise<number> {
    this.ensureReady();

    const bullState = this.mapStatusToBullState(status);
    const cleaned = await this.queue!.clean(olderThan ?? 0, 1000, bullState);
    return cleaned.length;
  }

  /**
   * Drain the queue
   */
  async drain(): Promise<number> {
    this.ensureReady();

    const waiting = await this.queue!.getWaitingCount();
    await this.queue!.drain();
    return waiting;
  }

  /**
   * Obliterate the queue
   */
  async obliterate(): Promise<void> {
    this.ensureReady();
    await this.queue!.obliterate({ force: true });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    this.ensureReady();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue!.getWaitingCount(),
      this.queue!.getActiveCount(),
      this.queue!.getCompletedCount(),
      this.queue!.getFailedCount(),
      this.queue!.getDelayedCount(),
    ]);

    // BullMQ doesn't have a separate paused count - paused jobs stay in waiting state
    // We track paused state separately
    const paused = this.paused ? waiting : 0;

    return {
      waiting: this.paused ? 0 : waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
    };
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(limit = 100): Promise<JobInfo[]> {
    this.ensureReady();
    const jobs = await this.queue!.getActive(0, limit - 1);
    return Promise.all(jobs.map(job => this.mapJobToInfo(job)));
  }

  /**
   * Get waiting jobs
   */
  async getWaitingJobs(limit = 100): Promise<JobInfo[]> {
    this.ensureReady();
    const jobs = await this.queue!.getWaiting(0, limit - 1);
    return Promise.all(jobs.map(job => this.mapJobToInfo(job)));
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(limit = 100): Promise<JobInfo[]> {
    this.ensureReady();
    const jobs = await this.queue!.getFailed(0, limit - 1);
    return Promise.all(jobs.map(job => this.mapJobToInfo(job)));
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(limit = 100): Promise<JobInfo[]> {
    this.ensureReady();
    const jobs = await this.queue!.getCompleted(0, limit - 1);
    return Promise.all(jobs.map(job => this.mapJobToInfo(job)));
  }

  /**
   * Get delayed jobs
   */
  async getDelayedJobs(limit = 100): Promise<JobInfo[]> {
    this.ensureReady();
    const jobs = await this.queue!.getDelayed(0, limit - 1);
    return Promise.all(jobs.map(job => this.mapJobToInfo(job)));
  }

  /**
   * Get jobs by file ID
   */
  async getJobsByFileId(fileId: string): Promise<JobInfo[]> {
    this.ensureReady();

    // Get all jobs and filter by fileId
    // Note: This is not efficient for large queues. Consider using a secondary index.
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      this.queue!.getWaiting(),
      this.queue!.getActive(),
      this.queue!.getDelayed(),
      this.queue!.getCompleted(0, 100),
      this.queue!.getFailed(0, 100),
    ]);

    const allJobs = [
      ...waiting,
      ...active,
      ...delayed,
      ...completed,
      ...failed,
    ];
    const matchingJobs = allJobs.filter(
      job => (job.data as ProcessingJob).fileId === fileId
    );

    return Promise.all(matchingJobs.map(job => this.mapJobToInfo(job)));
  }

  /**
   * Map a BullMQ job to JobInfo
   */
  private async mapJobToInfo(job: Job): Promise<JobInfo> {
    const state = await job.getState();
    const progress = job.progress as
      | { progress?: number; message?: string }
      | number;

    return {
      id: job.id!,
      data: job.data as ProcessingJob,
      status: this.mapBullStateToStatus(state),
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? this.config.queue.maxRetries! + 1,
      progress:
        typeof progress === 'number' ? progress : (progress?.progress ?? 0),
      progressMessage:
        typeof progress === 'object' ? progress?.message : undefined,
      createdAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      result: job.returnvalue as ProcessingResult | undefined,
      error: job.failedReason,
      duration:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    };
  }

  /**
   * Map BullMQ state to JobStatus
   */
  private mapBullStateToStatus(state: string): JobStatus {
    const stateMap: Record<string, JobStatus> = {
      waiting: JobStatus.WAITING,
      active: JobStatus.ACTIVE,
      completed: JobStatus.COMPLETED,
      failed: JobStatus.FAILED,
      delayed: JobStatus.DELAYED,
      paused: JobStatus.PAUSED,
    };
    return stateMap[state] ?? JobStatus.WAITING;
  }

  /**
   * Map JobStatus to BullMQ state
   */
  private mapStatusToBullState(
    status: JobStatus
  ): 'completed' | 'failed' | 'wait' | 'active' | 'delayed' | 'paused' {
    const statusMap: Record<
      JobStatus,
      'completed' | 'failed' | 'wait' | 'active' | 'delayed' | 'paused'
    > = {
      [JobStatus.WAITING]: 'wait',
      [JobStatus.ACTIVE]: 'active',
      [JobStatus.COMPLETED]: 'completed',
      [JobStatus.FAILED]: 'failed',
      [JobStatus.DELAYED]: 'delayed',
      [JobStatus.PAUSED]: 'paused',
      [JobStatus.CANCELLED]: 'failed',
    };
    return statusMap[status];
  }

  /**
   * Normalize priority to BullMQ format (1-10, inverted)
   * BullMQ uses lower number = higher priority
   */
  private normalizePriority(priority: number): number {
    // Invert so 10 becomes 1 (highest) and 1 becomes 10 (lowest)
    return Math.max(1, Math.min(10, 11 - priority));
  }

  /**
   * Ensure queue is ready
   */
  private ensureReady(): void {
    if (!this.ready || !this.queue) {
      throw new Error('Queue not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create a Redis processing queue
 *
 * @param config - Queue configuration
 * @param processorRegistry - Optional processor registry
 * @returns RedisProcessingQueue instance
 */
export function createRedisProcessingQueue(
  config?: Partial<RedisQueueConfig>,
  processorRegistry?: ProcessorRegistry
): RedisProcessingQueue {
  return new RedisProcessingQueue(config, processorRegistry);
}
