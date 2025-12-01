/**
 * @genesis/file-processor - Processing Queue Interface
 *
 * Defines the abstract interface for processing queues.
 * Implementations include Redis-based (BullMQ) and in-memory queues.
 *
 * @packageDocumentation
 */

import type {
  ProcessingJob,
  JobInfo,
  JobStatus,
  QueueEvent,
  QueueStats,
  EventHandler,
} from './types';

/**
 * Processing Queue Interface
 *
 * Defines the contract for job queue implementations.
 * Supports both Redis-based distributed queues and in-memory queues.
 *
 * @example
 * ```typescript
 * const queue = new RedisProcessingQueue(config);
 * await queue.initialize();
 *
 * // Add a job
 * const jobId = await queue.addJob({
 *   fileId: 'file-123',
 *   type: 'text-extraction',
 *   priority: 5,
 * });
 *
 * // Monitor progress
 * queue.on(QueueEvent.JOB_PROGRESS, ({ jobId, progress }) => {
 *   console.log(`Job ${jobId}: ${progress}%`);
 * });
 *
 * // Get job status
 * const info = await queue.getJob(jobId);
 * console.log(info?.status);
 * ```
 */
export interface ProcessingQueue {
  // =====================
  // Lifecycle Methods
  // =====================

  /**
   * Initialize the queue connection and workers
   * Must be called before using the queue
   */
  initialize(): Promise<void>;

  /**
   * Gracefully close the queue and all connections
   * Waits for active jobs to complete
   */
  close(): Promise<void>;

  /**
   * Check if the queue is initialized and ready
   */
  isReady(): boolean;

  // =====================
  // Job Management
  // =====================

  /**
   * Add a single job to the queue
   *
   * @param job - The processing job to add
   * @returns The unique job identifier
   *
   * @example
   * ```typescript
   * const jobId = await queue.addJob({
   *   fileId: 'file-123',
   *   type: 'text-extraction',
   *   priority: 7,
   *   options: { enableOcr: true },
   * });
   * ```
   */
  addJob(job: ProcessingJob): Promise<string>;

  /**
   * Add multiple jobs to the queue in a single operation
   *
   * @param jobs - Array of processing jobs to add
   * @returns Array of job identifiers in the same order
   *
   * @example
   * ```typescript
   * const jobIds = await queue.addBulkJobs([
   *   { fileId: 'file-1', type: 'thumbnail' },
   *   { fileId: 'file-2', type: 'thumbnail' },
   *   { fileId: 'file-3', type: 'thumbnail' },
   * ]);
   * ```
   */
  addBulkJobs(jobs: ProcessingJob[]): Promise<string[]>;

  /**
   * Get information about a specific job
   *
   * @param jobId - The job identifier
   * @returns Job information or null if not found
   */
  getJob(jobId: string): Promise<JobInfo | null>;

  /**
   * Cancel a job if it hasn't started processing
   *
   * @param jobId - The job identifier to cancel
   * @returns True if the job was cancelled, false otherwise
   *
   * @remarks
   * Jobs that are already being processed cannot be cancelled.
   * Use with caution as it removes the job from the queue.
   */
  cancelJob(jobId: string): Promise<boolean>;

  /**
   * Retry a failed job
   *
   * @param jobId - The job identifier to retry
   * @returns True if the job was queued for retry, false otherwise
   *
   * @remarks
   * Only failed jobs can be retried. This resets the attempt counter
   * and moves the job back to the waiting state.
   */
  retryJob(jobId: string): Promise<boolean>;

  /**
   * Update job progress
   *
   * @param jobId - The job identifier
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  updateProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void>;

  // =====================
  // Queue Operations
  // =====================

  /**
   * Pause the queue
   *
   * @remarks
   * Pausing prevents new jobs from being processed.
   * Currently active jobs will complete.
   */
  pause(): Promise<void>;

  /**
   * Resume a paused queue
   */
  resume(): Promise<void>;

  /**
   * Check if the queue is paused
   */
  isPaused(): Promise<boolean>;

  /**
   * Clean jobs with a specific status
   *
   * @param status - The status of jobs to clean
   * @param olderThan - Only clean jobs older than this duration (ms)
   * @returns Number of jobs cleaned
   *
   * @example
   * ```typescript
   * // Clean completed jobs older than 1 hour
   * const cleaned = await queue.clean(JobStatus.COMPLETED, 3600000);
   * console.log(`Cleaned ${cleaned} jobs`);
   * ```
   */
  clean(status: JobStatus, olderThan?: number): Promise<number>;

  /**
   * Drain the queue (remove all waiting jobs)
   *
   * @returns Number of jobs drained
   *
   * @remarks
   * This only removes waiting jobs. Active jobs will continue processing.
   */
  drain(): Promise<number>;

  /**
   * Obliterate the queue (remove all jobs and data)
   *
   * @remarks
   * This is a destructive operation. Use with extreme caution.
   */
  obliterate(): Promise<void>;

  // =====================
  // Event Handling
  // =====================

  /**
   * Subscribe to queue events
   *
   * @param event - The event type to subscribe to
   * @param handler - The event handler function
   *
   * @example
   * ```typescript
   * queue.on(QueueEvent.JOB_COMPLETED, ({ jobId, result }) => {
   *   console.log(`Job ${jobId} completed:`, result);
   * });
   *
   * queue.on(QueueEvent.JOB_FAILED, ({ jobId, error }) => {
   *   console.error(`Job ${jobId} failed:`, error);
   * });
   * ```
   */
  on<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void;

  /**
   * Unsubscribe from queue events
   *
   * @param event - The event type to unsubscribe from
   * @param handler - The event handler to remove
   */
  off<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void;

  /**
   * Subscribe to an event once
   *
   * @param event - The event type to subscribe to
   * @param handler - The event handler function (called once)
   */
  once<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void;

  // =====================
  // Statistics & Monitoring
  // =====================

  /**
   * Get queue statistics
   *
   * @returns Current queue statistics
   *
   * @example
   * ```typescript
   * const stats = await queue.getStats();
   * console.log(`Waiting: ${stats.waiting}, Active: ${stats.active}`);
   * ```
   */
  getStats(): Promise<QueueStats>;

  /**
   * Get all active jobs
   *
   * @param limit - Maximum number of jobs to return
   * @returns Array of active job information
   */
  getActiveJobs(limit?: number): Promise<JobInfo[]>;

  /**
   * Get all waiting jobs
   *
   * @param limit - Maximum number of jobs to return
   * @returns Array of waiting job information
   */
  getWaitingJobs(limit?: number): Promise<JobInfo[]>;

  /**
   * Get all failed jobs
   *
   * @param limit - Maximum number of jobs to return
   * @returns Array of failed job information
   */
  getFailedJobs(limit?: number): Promise<JobInfo[]>;

  /**
   * Get all completed jobs
   *
   * @param limit - Maximum number of jobs to return
   * @returns Array of completed job information
   */
  getCompletedJobs(limit?: number): Promise<JobInfo[]>;

  /**
   * Get all delayed jobs
   *
   * @param limit - Maximum number of jobs to return
   * @returns Array of delayed job information
   */
  getDelayedJobs(limit?: number): Promise<JobInfo[]>;

  /**
   * Get jobs by file ID
   *
   * @param fileId - The file identifier
   * @returns Array of jobs for this file
   */
  getJobsByFileId(fileId: string): Promise<JobInfo[]>;

  /**
   * Get the queue name
   */
  getName(): string;
}

/**
 * Abstract base class for processing queues
 *
 * Provides common functionality and event handling infrastructure.
 * Concrete implementations should extend this class.
 */
export abstract class BaseProcessingQueue implements ProcessingQueue {
  protected readonly name: string;
  protected ready = false;
  protected eventHandlers: Map<QueueEvent, Set<EventHandler>> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  // =====================
  // Abstract Methods
  // =====================

  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract addJob(job: ProcessingJob): Promise<string>;
  abstract addBulkJobs(jobs: ProcessingJob[]): Promise<string[]>;
  abstract getJob(jobId: string): Promise<JobInfo | null>;
  abstract cancelJob(jobId: string): Promise<boolean>;
  abstract retryJob(jobId: string): Promise<boolean>;
  abstract updateProgress(
    jobId: string,
    progress: number,
    message?: string
  ): Promise<void>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract isPaused(): Promise<boolean>;
  abstract clean(status: JobStatus, olderThan?: number): Promise<number>;
  abstract drain(): Promise<number>;
  abstract obliterate(): Promise<void>;
  abstract getStats(): Promise<QueueStats>;
  abstract getActiveJobs(limit?: number): Promise<JobInfo[]>;
  abstract getWaitingJobs(limit?: number): Promise<JobInfo[]>;
  abstract getFailedJobs(limit?: number): Promise<JobInfo[]>;
  abstract getCompletedJobs(limit?: number): Promise<JobInfo[]>;
  abstract getDelayedJobs(limit?: number): Promise<JobInfo[]>;
  abstract getJobsByFileId(fileId: string): Promise<JobInfo[]>;

  // =====================
  // Implemented Methods
  // =====================

  isReady(): boolean {
    return this.ready;
  }

  getName(): string {
    return this.name;
  }

  on<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);
  }

  off<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  once<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = (data: T) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    this.on(event, wrappedHandler);
  }

  /**
   * Emit an event to all registered handlers
   *
   * @param event - The event type
   * @param data - The event data
   */
  protected emit<T = unknown>(event: QueueEvent, data: T): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(data);
          // Handle async handlers
          if (result instanceof Promise) {
            result.catch(error => {
              console.error(`Error in event handler for ${event}:`, error);
            });
          }
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Generate a unique job ID
   */
  protected generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `job_${timestamp}_${random}`;
  }
}
