/**
 * @genesis/file-processor - In-Memory Processing Queue
 *
 * Development and testing queue implementation without Redis dependency.
 * Provides the same API as RedisProcessingQueue but stores jobs in memory.
 *
 * Features:
 * - No external dependencies required
 * - Priority queue with 10 priority levels
 * - Retry with exponential backoff
 * - Progress tracking
 * - Event-driven architecture
 *
 * @remarks
 * This queue is NOT suitable for production use as:
 * - Jobs are lost on process restart
 * - No distributed processing support
 * - Limited scalability
 *
 * @packageDocumentation
 */

import { BaseProcessingQueue } from './processing-queue';
import {
  JobStatus,
  QueueEvent,
  type ProcessingJob,
  type JobInfo,
  type QueueStats,
  type MemoryQueueConfig,
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

/**
 * Default configuration for memory queue
 */
const DEFAULT_CONFIG: MemoryQueueConfig = {
  queue: {
    name: 'file-processing-memory',
    defaultPriority: 5,
    concurrency: 2,
    defaultTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2,
    maxRetryDelay: 30000,
    removeOnComplete: 3600000, // 1 hour
    removeOnFail: 86400000, // 24 hours
  },
  maxSize: 10000,
  persistToFile: false,
};

/**
 * Internal job representation
 */
interface InternalJob {
  id: string;
  data: ProcessingJob;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  progress: number;
  progressMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  nextRetryAt?: Date;
  result?: ProcessingResult;
  error?: string;
  stackTrace?: string;
}

/**
 * In-Memory Processing Queue
 *
 * Development-friendly implementation for testing and local development.
 *
 * @example
 * ```typescript
 * const queue = new MemoryProcessingQueue({
 *   queue: { concurrency: 2 },
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
export class MemoryProcessingQueue extends BaseProcessingQueue {
  private config: MemoryQueueConfig;
  private jobs: Map<string, InternalJob> = new Map();
  private waitingQueue: string[] = []; // Job IDs sorted by priority
  private activeJobs: Set<string> = new Set();
  private processorRegistry: ProcessorRegistry | null = null;
  private paused = false;
  private processingLoop: NodeJS.Timeout | null = null;
  private cleanupLoop: NodeJS.Timeout | null = null;

  /**
   * Create a new in-memory processing queue
   *
   * @param config - Queue configuration
   * @param processorRegistry - Optional processor registry for job handling
   */
  constructor(
    config: Partial<MemoryQueueConfig> = {},
    processorRegistry?: ProcessorRegistry
  ) {
    super(config.queue?.name ?? DEFAULT_CONFIG.queue.name!);
    this.config = this.mergeConfig(config);
    this.processorRegistry = processorRegistry ?? null;
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(config: Partial<MemoryQueueConfig>): MemoryQueueConfig {
    return {
      queue: {
        ...DEFAULT_CONFIG.queue,
        ...config.queue,
      },
      maxSize: config.maxSize ?? DEFAULT_CONFIG.maxSize,
      persistToFile: config.persistToFile ?? DEFAULT_CONFIG.persistToFile,
      persistencePath: config.persistencePath,
    };
  }

  /**
   * Set the processor registry
   */
  setProcessorRegistry(registry: ProcessorRegistry): void {
    this.processorRegistry = registry;
  }

  /**
   * Initialize the queue
   */
  async initialize(): Promise<void> {
    if (this.ready) {
      return;
    }

    // Start processing loop
    this.processingLoop = setInterval(() => {
      this.processNextJobs().catch(error => {
        this.emit<QueueErrorEvent>(QueueEvent.QUEUE_ERROR, {
          error: error as Error,
          context: 'processing-loop',
        });
      });
    }, 100);

    // Start cleanup loop
    this.cleanupLoop = setInterval(() => {
      this.cleanupOldJobs().catch(error => {
        console.error('Cleanup error:', error);
      });
    }, 60000); // Every minute

    this.ready = true;
    this.emit(QueueEvent.WORKER_READY, { queueName: this.name });
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    if (!this.ready) {
      return;
    }

    this.ready = false;

    // Stop loops
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
      this.processingLoop = null;
    }

    if (this.cleanupLoop) {
      clearInterval(this.cleanupLoop);
      this.cleanupLoop = null;
    }

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clear data
    this.jobs.clear();
    this.waitingQueue = [];

    this.emit(QueueEvent.WORKER_CLOSED, { queueName: this.name });
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: ProcessingJob): Promise<string> {
    this.ensureReady();
    this.ensureCapacity();

    const jobId = this.generateJobId();
    const priority = job.priority ?? this.config.queue.defaultPriority ?? 5;

    const internalJob: InternalJob = {
      id: jobId,
      data: job,
      status: job.delay ? JobStatus.DELAYED : JobStatus.WAITING,
      priority,
      attempts: 0,
      maxAttempts: this.config.queue.maxRetries! + 1,
      progress: 0,
      createdAt: new Date(),
      nextRetryAt: job.delay ? new Date(Date.now() + job.delay) : undefined,
    };

    this.jobs.set(jobId, internalJob);

    if (!job.delay) {
      this.insertIntoWaitingQueue(jobId, priority);
    } else {
      // Schedule delayed job
      setTimeout(() => {
        const j = this.jobs.get(jobId);
        if (j && j.status === JobStatus.DELAYED) {
          j.status = JobStatus.WAITING;
          j.nextRetryAt = undefined;
          this.insertIntoWaitingQueue(jobId, priority);
        }
      }, job.delay);
    }

    this.emit<JobAddedEvent>(QueueEvent.JOB_ADDED, {
      jobId,
      job,
    });

    return jobId;
  }

  /**
   * Add multiple jobs in batch
   */
  async addBulkJobs(jobs: ProcessingJob[]): Promise<string[]> {
    const jobIds: string[] = [];
    for (const job of jobs) {
      const jobId = await this.addJob(job);
      jobIds.push(jobId);
    }
    return jobIds;
  }

  /**
   * Get job information
   */
  async getJob(jobId: string): Promise<JobInfo | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    return this.mapToJobInfo(job);
  }

  /**
   * Cancel a waiting job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === JobStatus.ACTIVE) {
      return false; // Cannot cancel active jobs
    }

    // Remove from waiting queue
    const index = this.waitingQueue.indexOf(jobId);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
    }

    job.status = JobStatus.CANCELLED;
    job.finishedAt = new Date();

    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status !== JobStatus.FAILED) {
      return false;
    }

    // Reset job state
    job.status = JobStatus.WAITING;
    job.attempts = 0;
    job.progress = 0;
    job.progressMessage = undefined;
    job.error = undefined;
    job.stackTrace = undefined;
    job.finishedAt = undefined;
    job.startedAt = undefined;

    this.insertIntoWaitingQueue(jobId, job.priority);

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
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.max(0, Math.min(100, progress));
      job.progressMessage = message;

      this.emit<JobProgressEvent>(QueueEvent.JOB_PROGRESS, {
        jobId,
        progress: job.progress,
        message,
      });
    }
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    this.paused = true;
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    this.paused = false;
  }

  /**
   * Check if queue is paused
   */
  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  /**
   * Clean jobs with a specific status
   */
  async clean(status: JobStatus, olderThan?: number): Promise<number> {
    const threshold = olderThan ? Date.now() - olderThan : 0;
    let cleaned = 0;

    for (const [jobId, job] of this.jobs) {
      if (job.status === status) {
        const jobTime = job.finishedAt?.getTime() ?? job.createdAt.getTime();
        if (jobTime < threshold || !olderThan) {
          this.jobs.delete(jobId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Drain the queue
   */
  async drain(): Promise<number> {
    const waiting = this.waitingQueue.length;

    for (const jobId of this.waitingQueue) {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = JobStatus.CANCELLED;
        job.finishedAt = new Date();
      }
    }

    this.waitingQueue = [];
    return waiting;
  }

  /**
   * Obliterate the queue
   */
  async obliterate(): Promise<void> {
    this.jobs.clear();
    this.waitingQueue = [];
    this.activeJobs.clear();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let delayed = 0;
    let paused = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case JobStatus.WAITING:
          waiting++;
          break;
        case JobStatus.ACTIVE:
          active++;
          break;
        case JobStatus.COMPLETED:
          completed++;
          break;
        case JobStatus.FAILED:
          failed++;
          break;
        case JobStatus.DELAYED:
          delayed++;
          break;
        case JobStatus.PAUSED:
          paused++;
          break;
      }
    }

    return { waiting, active, completed, failed, delayed, paused };
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(limit = 100): Promise<JobInfo[]> {
    return this.getJobsByStatus(JobStatus.ACTIVE, limit);
  }

  /**
   * Get waiting jobs
   */
  async getWaitingJobs(limit = 100): Promise<JobInfo[]> {
    return this.getJobsByStatus(JobStatus.WAITING, limit);
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(limit = 100): Promise<JobInfo[]> {
    return this.getJobsByStatus(JobStatus.FAILED, limit);
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(limit = 100): Promise<JobInfo[]> {
    return this.getJobsByStatus(JobStatus.COMPLETED, limit);
  }

  /**
   * Get delayed jobs
   */
  async getDelayedJobs(limit = 100): Promise<JobInfo[]> {
    return this.getJobsByStatus(JobStatus.DELAYED, limit);
  }

  /**
   * Get jobs by file ID
   */
  async getJobsByFileId(fileId: string): Promise<JobInfo[]> {
    const result: JobInfo[] = [];

    for (const job of this.jobs.values()) {
      if (job.data.fileId === fileId) {
        result.push(this.mapToJobInfo(job));
      }
    }

    return result;
  }

  /**
   * Get jobs by status
   */
  private getJobsByStatus(status: JobStatus, limit: number): JobInfo[] {
    const result: JobInfo[] = [];

    for (const job of this.jobs.values()) {
      if (job.status === status) {
        result.push(this.mapToJobInfo(job));
        if (result.length >= limit) {
          break;
        }
      }
    }

    return result;
  }

  /**
   * Process next available jobs
   */
  private async processNextJobs(): Promise<void> {
    if (this.paused || !this.ready) {
      return;
    }

    const concurrency = this.config.queue.concurrency ?? 2;
    const availableSlots = concurrency - this.activeJobs.size;

    for (let i = 0; i < availableSlots && this.waitingQueue.length > 0; i++) {
      const jobId = this.waitingQueue.shift();
      if (!jobId) {
        continue;
      }

      const job = this.jobs.get(jobId);
      if (!job || job.status !== JobStatus.WAITING) {
        continue;
      }

      this.processJob(job).catch(error => {
        console.error(`Error processing job ${jobId}:`, error);
      });
    }

    // Check if queue is drained
    if (this.waitingQueue.length === 0 && this.activeJobs.size === 0) {
      this.emit(QueueEvent.QUEUE_DRAINED, {});
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: InternalJob): Promise<void> {
    job.status = JobStatus.ACTIVE;
    job.startedAt = new Date();
    job.attempts++;
    this.activeJobs.add(job.id);

    this.emit<JobStartedEvent>(QueueEvent.JOB_STARTED, {
      jobId: job.id,
      job: job.data,
    });

    try {
      if (!this.processorRegistry) {
        throw new Error('No processor registry configured');
      }

      const processor = this.processorRegistry.get(job.data.type);
      if (!processor) {
        throw new Error(`No processor registered for type: ${job.data.type}`);
      }

      // Validate if validator exists
      if (processor.validate) {
        const isValid = await processor.validate(job.data);
        if (!isValid) {
          throw new Error(`Job validation failed for type: ${job.data.type}`);
        }
      }

      // Process with timeout
      const timeout =
        job.data.options?.timeout ?? this.config.queue.defaultTimeout ?? 300000;
      const result = await this.withTimeout(
        processor.process(job.data),
        timeout,
        `Job ${job.id} timed out after ${timeout}ms`
      );

      // Success
      job.status = JobStatus.COMPLETED;
      job.finishedAt = new Date();
      job.progress = 100;
      job.result = result;

      this.emit<JobCompletedEvent>(QueueEvent.JOB_COMPLETED, {
        jobId: job.id,
        result,
        duration: job.finishedAt.getTime() - job.startedAt!.getTime(),
      });

      processor.onComplete?.(job.data, result);
    } catch (error) {
      const err = error as Error;
      const willRetry = job.attempts < job.maxAttempts;

      if (willRetry) {
        // Schedule retry with exponential backoff
        const baseDelay = this.config.queue.retryDelay ?? 1000;
        const multiplier = this.config.queue.retryBackoffMultiplier ?? 2;
        const maxDelay = this.config.queue.maxRetryDelay ?? 30000;
        const delay = Math.min(
          baseDelay * Math.pow(multiplier, job.attempts - 1),
          maxDelay
        );

        job.status = JobStatus.DELAYED;
        job.nextRetryAt = new Date(Date.now() + delay);

        this.emit<JobRetryEvent>(QueueEvent.JOB_RETRY, {
          jobId: job.id,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          nextRetryAt: job.nextRetryAt,
        });

        // Schedule retry
        setTimeout(() => {
          if (job.status === JobStatus.DELAYED) {
            job.status = JobStatus.WAITING;
            job.nextRetryAt = undefined;
            this.insertIntoWaitingQueue(job.id, job.priority);
          }
        }, delay);
      } else {
        // Max retries exceeded
        job.status = JobStatus.FAILED;
        job.finishedAt = new Date();
        job.error = err.message;
        job.stackTrace = err.stack;
      }

      this.emit<JobFailedEvent>(QueueEvent.JOB_FAILED, {
        jobId: job.id,
        error: err.message,
        stackTrace: err.stack,
        attempts: job.attempts,
        willRetry,
      });

      // Call error handler
      if (this.processorRegistry) {
        const processor = this.processorRegistry.get(job.data.type);
        processor?.onError?.(job.data, err);
      }
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Insert job into waiting queue maintaining priority order
   */
  private insertIntoWaitingQueue(jobId: string, priority: number): void {
    // Higher priority = earlier in queue
    let inserted = false;
    for (let i = 0; i < this.waitingQueue.length; i++) {
      const existingJob = this.jobs.get(this.waitingQueue[i]!);
      if (existingJob && priority > existingJob.priority) {
        this.waitingQueue.splice(i, 0, jobId);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.waitingQueue.push(jobId);
    }
  }

  /**
   * Map internal job to JobInfo
   */
  private mapToJobInfo(job: InternalJob): JobInfo {
    return {
      id: job.id,
      data: job.data,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      progress: job.progress,
      progressMessage: job.progressMessage,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      nextRetryAt: job.nextRetryAt,
      result: job.result,
      error: job.error,
      stackTrace: job.stackTrace,
      duration:
        job.finishedAt && job.startedAt
          ? job.finishedAt.getTime() - job.startedAt.getTime()
          : undefined,
    };
  }

  /**
   * Cleanup old completed/failed jobs
   */
  private async cleanupOldJobs(): Promise<void> {
    const now = Date.now();
    const completedThreshold =
      now - (this.config.queue.removeOnComplete ?? 3600000);
    const failedThreshold = now - (this.config.queue.removeOnFail ?? 86400000);

    for (const [jobId, job] of this.jobs) {
      if (job.status === JobStatus.COMPLETED) {
        const finishedAt = job.finishedAt?.getTime() ?? 0;
        if (finishedAt < completedThreshold) {
          this.jobs.delete(jobId);
        }
      } else if (
        job.status === JobStatus.FAILED ||
        job.status === JobStatus.CANCELLED
      ) {
        const finishedAt = job.finishedAt?.getTime() ?? 0;
        if (finishedAt < failedThreshold) {
          this.jobs.delete(jobId);
        }
      }
    }
  }

  /**
   * Ensure queue is ready
   */
  private ensureReady(): void {
    if (!this.ready) {
      throw new Error('Queue not initialized. Call initialize() first.');
    }
  }

  /**
   * Ensure queue has capacity
   */
  private ensureCapacity(): void {
    const maxSize = this.config.maxSize ?? 10000;
    if (this.jobs.size >= maxSize) {
      throw new Error(`Queue capacity exceeded. Maximum size: ${maxSize}`);
    }
  }

  /**
   * Execute a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(message)), timeoutMs)
      ),
    ]);
  }
}

/**
 * Create an in-memory processing queue
 *
 * @param config - Queue configuration
 * @param processorRegistry - Optional processor registry
 * @returns MemoryProcessingQueue instance
 */
export function createMemoryProcessingQueue(
  config?: Partial<MemoryQueueConfig>,
  processorRegistry?: ProcessorRegistry
): MemoryProcessingQueue {
  return new MemoryProcessingQueue(config, processorRegistry);
}
