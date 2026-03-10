/**
 * @genesis/file-processor - BullMQ Queue Setup
 *
 * Job queue management for file processing operations.
 * Uses BullMQ for reliable, distributed job processing.
 */

import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { JobStatus, FileType } from './types';

import type { FileProcessorConfig } from './config';
import type { FileProcessingJob, JobProgress, ProcessorResult } from './types';

/**
 * Queue event types
 */
export enum QueueEvent {
  JOB_ADDED = 'job:added',
  JOB_STARTED = 'job:started',
  JOB_PROGRESS = 'job:progress',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  JOB_RETRY = 'job:retry',
  QUEUE_DRAINED = 'queue:drained',
  QUEUE_ERROR = 'queue:error',
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Number of waiting jobs */
  waiting: number;

  /** Number of active jobs */
  active: number;

  /** Number of completed jobs */
  completed: number;

  /** Number of failed jobs */
  failed: number;

  /** Number of delayed jobs */
  delayed: number;

  /** Number of paused jobs */
  paused: number;
}

/**
 * Job result with metadata
 */
export interface JobResult {
  jobId: string;
  status: JobStatus;
  result?: ProcessorResult;
  error?: string;
  attempts: number;
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
}

/**
 * Queue event listener
 */
export type QueueEventListener = (event: QueueEvent, data: unknown) => void;

/**
 * File processing queue manager
 */
export class FileProcessingQueue {
  private _config: FileProcessorConfig;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: IORedis | null = null;
  private eventListeners: Map<QueueEvent, QueueEventListener[]> = new Map();

  constructor(config: FileProcessorConfig) {
    this._config = config;
  }

  /**
   * Initialize the queue and worker
   */
  async initialize(): Promise<void> {
    const redisConfig = this._config.redis;

    try {
      this.connection = new IORedis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        tls: redisConfig.tls ? {} : undefined,
        connectTimeout: redisConfig.connectTimeout ?? 10000,
        maxRetriesPerRequest: null,
      });

      // Verify connection before proceeding
      await this.connection.ping();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect to Redis: ${message}`);
    }

    const connection: ConnectionOptions = this.connection;

    this.queue = new Queue(this._config.queue.name, { connection });

    this.worker = new Worker<FileProcessingJob, ProcessorResult>(
      this._config.queue.name,
      async (job: Job<FileProcessingJob, ProcessorResult>) => {
        return this._processJob(job);
      },
      {
        connection,
        concurrency: this._config.queue.concurrency,
      }
    );

    this._setupEventHandlers();
  }

  /**
   * Close queue and worker connections
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }

    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }
  }

  /**
   * Add a file processing job to the queue
   */
  async addJob(job: FileProcessingJob): Promise<string> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const bullJob = await this.queue.add(job.jobId, job, {
      priority: job.priority ?? 5,
      attempts: this._config.queue.maxRetries,
      backoff: {
        type: 'exponential',
        delay: this._config.queue.retryDelay,
      },
      removeOnComplete: {
        age: Math.floor(this._config.queue.removeOnComplete / 1000),
      },
      removeOnFail: {
        age: Math.floor(this._config.queue.removeOnFail / 1000),
      },
    });

    this.emit(QueueEvent.JOB_ADDED, { jobId: job.jobId });
    return bullJob.id ?? job.jobId;
  }

  /**
   * Add multiple jobs in batch
   */
  async addBulkJobs(jobs: FileProcessingJob[]): Promise<string[]> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const bullJobs = await this.queue.addBulk(
      jobs.map(job => ({
        name: job.jobId,
        data: job,
        opts: {
          priority: job.priority ?? 5,
          attempts: this._config.queue.maxRetries,
          backoff: {
            type: 'exponential' as const,
            delay: this._config.queue.retryDelay,
          },
          removeOnComplete: {
            age: Math.floor(this._config.queue.removeOnComplete / 1000),
          },
          removeOnFail: {
            age: Math.floor(this._config.queue.removeOnFail / 1000),
          },
        },
      }))
    );

    return bullJobs.map(j => j.id ?? j.name);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobResult | null> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();

    return {
      jobId: job.id ?? jobId,
      status: this._mapState(state),
      result: job.returnvalue ?? undefined,
      error: job.failedReason ?? undefined,
      attempts: job.attemptsMade,
      createdAt: new Date(job.timestamp),
      processedAt:
        job.processedOn != null ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn != null ? new Date(job.finishedOn) : undefined,
    };
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const [waiting, active, completed, failed, delayed, pausedCounts] =
      await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
        this.queue.getJobCounts('paused'),
      ]);
    const paused = pausedCounts.paused ?? 0;

    return { waiting, active, completed, failed, delayed, paused };
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.pause();
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    await this.queue.resume();
  }

  /**
   * Cancel a specific job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === 'active') {
      // Active jobs cannot be removed directly; caller must handle graceful shutdown
      return false;
    }

    await job.remove();
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state !== 'failed') {
      return false;
    }

    await job.retry();
    return true;
  }

  /**
   * Clear all completed jobs
   */
  async clearCompleted(): Promise<number> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const jobs = await this.queue.getCompleted();
    await Promise.all(jobs.map(job => job.remove()));
    return jobs.length;
  }

  /**
   * Clear all failed jobs
   */
  async clearFailed(): Promise<number> {
    if (!this.queue) {
      throw new Error('Queue not initialized');
    }

    const jobs = await this.queue.getFailed();
    await Promise.all(jobs.map(job => job.remove()));
    return jobs.length;
  }

  /**
   * Process a file processing job
   */
  private async _processJob(
    job: Job<FileProcessingJob, ProcessorResult>
  ): Promise<ProcessorResult> {
    const data = job.data;

    await this._updateProgress(job, {
      stage: 'initializing',
      percentage: 0,
    });

    // TODO: Import appropriate processor based on file type and run real processing.
    // const processor = this.getProcessor(data.fileType);
    // const result = await processor.process(data.filePath, data.options);

    await this._updateProgress(job, {
      stage: 'processing',
      percentage: 50,
    });

    const result: ProcessorResult = {
      success: true,
      content: '',
      metadata: {
        filename: data.filename,
        mimeType: 'application/octet-stream',
        size: 0,
        fileType: data.fileType ?? FileType.UNKNOWN,
      },
      processingTime: 0,
    };

    await this._updateProgress(job, {
      stage: 'complete',
      percentage: 100,
    });

    if (data.callbackUrl) {
      await this._sendCallback(data.callbackUrl, result);
    }

    return result;
  }

  /**
   * Update job progress
   */
  private async _updateProgress(
    job: Job<FileProcessingJob, ProcessorResult>,
    progress: JobProgress
  ): Promise<void> {
    await job.updateProgress(progress);
    this.emit(QueueEvent.JOB_PROGRESS, {
      jobId: job.id,
      progress,
    });
  }

  /**
   * Send callback with result
   */
  private async _sendCallback(
    callbackUrl: string,
    result: ProcessorResult
  ): Promise<void> {
    try {
      await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
    } catch (err) {
      // Log callback error but do not fail the job
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[FileProcessingQueue] Callback to ${callbackUrl} failed: ${message}`
      );
    }
  }

  /**
   * Setup event handlers for queue and worker
   */
  private _setupEventHandlers(): void {
    if (!this.worker || !this.queue) return;

    this.worker.on('completed', (job, result) => {
      this.emit(QueueEvent.JOB_COMPLETED, { jobId: job.id, result });
    });

    this.worker.on('failed', (job, error) => {
      this.emit(QueueEvent.JOB_FAILED, {
        jobId: job?.id,
        error: error.message,
      });
    });

    this.worker.on('active', job => {
      this.emit(QueueEvent.JOB_STARTED, { jobId: job.id });
    });

    this.worker.on('error', error => {
      this.emit(QueueEvent.QUEUE_ERROR, { error: error.message });
    });

    this.queue.on('error', error => {
      this.emit(QueueEvent.QUEUE_ERROR, { error: error.message });
    });

    // BullMQ Queue does not expose a 'drained' event directly; use the Worker event instead
    this.worker.on('drained', () => {
      this.emit(QueueEvent.QUEUE_DRAINED, {});
    });
  }

  /**
   * Map BullMQ state to JobStatus
   */
  private _mapState(state: string): JobStatus {
    const stateMap: Record<string, JobStatus> = {
      waiting: JobStatus.PENDING,
      'waiting-children': JobStatus.PENDING,
      active: JobStatus.PROCESSING,
      completed: JobStatus.COMPLETED,
      failed: JobStatus.FAILED,
      delayed: JobStatus.PENDING,
      paused: JobStatus.PENDING,
      prioritized: JobStatus.PENDING,
      unknown: JobStatus.PENDING,
    };

    return stateMap[state] ?? JobStatus.PENDING;
  }

  /**
   * Add event listener
   */
  on(event: QueueEvent, listener: QueueEventListener): void {
    const listeners = this.eventListeners.get(event) ?? [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Remove event listener
   */
  off(event: QueueEvent, listener: QueueEventListener): void {
    const listeners = this.eventListeners.get(event) ?? [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: QueueEvent, data: unknown): void {
    const listeners = this.eventListeners.get(event) ?? [];
    for (const listener of listeners) {
      try {
        listener(event, data);
      } catch {
        // Ignore listener errors to avoid disrupting queue operation
      }
    }
  }
}

/**
 * Create file processing queue instance
 */
export function createFileProcessingQueue(
  config: FileProcessorConfig
): FileProcessingQueue {
  return new FileProcessingQueue(config);
}
