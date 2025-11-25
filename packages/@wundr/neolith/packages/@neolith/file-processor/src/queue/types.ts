/**
 * @genesis/file-processor - Queue Type Definitions
 *
 * Core type definitions for the processing queue system.
 * Defines interfaces for jobs, processors, events, and statistics.
 *
 * @packageDocumentation
 */

import type { ProcessorResult, ProcessingOptions } from '../types';

/**
 * Processing job types supported by the queue
 */
export type ProcessingType =
  | 'text-extraction'
  | 'ocr'
  | 'thumbnail'
  | 'pdf-to-images'
  | 'spreadsheet-parse'
  | 'document-convert';

/**
 * Job priority levels (1 = lowest, 10 = highest)
 */
export type JobPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Job status enumeration
 */
export enum JobStatus {
  /** Job is waiting to be processed */
  WAITING = 'waiting',
  /** Job is currently being processed */
  ACTIVE = 'active',
  /** Job has completed successfully */
  COMPLETED = 'completed',
  /** Job has failed */
  FAILED = 'failed',
  /** Job is delayed for retry */
  DELAYED = 'delayed',
  /** Job is paused */
  PAUSED = 'paused',
  /** Job was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Queue event types
 */
export enum QueueEvent {
  /** Job was added to the queue */
  JOB_ADDED = 'job:added',
  /** Job started processing */
  JOB_STARTED = 'job:started',
  /** Job progress updated */
  JOB_PROGRESS = 'job:progress',
  /** Job completed successfully */
  JOB_COMPLETED = 'job:completed',
  /** Job failed */
  JOB_FAILED = 'job:failed',
  /** Job is being retried */
  JOB_RETRY = 'job:retry',
  /** Job was stalled (worker died) */
  JOB_STALLED = 'job:stalled',
  /** Queue has no more waiting jobs */
  QUEUE_DRAINED = 'queue:drained',
  /** Queue encountered an error */
  QUEUE_ERROR = 'queue:error',
  /** Worker is ready */
  WORKER_READY = 'worker:ready',
  /** Worker has closed */
  WORKER_CLOSED = 'worker:closed',
}

/**
 * Processing job definition
 */
export interface ProcessingJob {
  /** File identifier to process */
  fileId: string;
  /** Type of processing to perform */
  type: ProcessingType;
  /** Job priority (1-10, default: 5) */
  priority?: JobPriority;
  /** Processing options */
  options?: ProcessingOptions;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Workspace ID (for context) */
  workspaceId?: string;
  /** Channel ID (for context) */
  channelId?: string;
  /** User ID who initiated the job */
  userId?: string;
  /** Callback URL for completion notification */
  callbackUrl?: string;
  /** Delay before processing (in milliseconds) */
  delay?: number;
}

/**
 * Job information with status and metadata
 */
export interface JobInfo {
  /** Unique job identifier */
  id: string;
  /** Original job data */
  data: ProcessingJob;
  /** Current job status */
  status: JobStatus;
  /** Number of processing attempts */
  attempts: number;
  /** Maximum allowed attempts */
  maxAttempts: number;
  /** Current progress (0-100) */
  progress: number;
  /** Progress message */
  progressMessage?: string;
  /** Timestamp when job was created */
  createdAt: Date;
  /** Timestamp when job started processing */
  startedAt?: Date;
  /** Timestamp when job completed/failed */
  finishedAt?: Date;
  /** Timestamp for next retry (if delayed) */
  nextRetryAt?: Date;
  /** Processing result (if completed) */
  result?: ProcessingResult;
  /** Error message (if failed) */
  error?: string;
  /** Error stack trace */
  stackTrace?: string;
  /** Processing duration in milliseconds */
  duration?: number;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  /** Whether processing succeeded */
  success: boolean;
  /** Result data */
  data?: ProcessorResult;
  /** Output file paths (if any) */
  outputFiles?: string[];
  /** Processing metrics */
  metrics?: ProcessingMetrics;
}

/**
 * Processing metrics
 */
export interface ProcessingMetrics {
  /** Time spent downloading file */
  downloadTime?: number;
  /** Time spent processing */
  processingTime: number;
  /** Time spent uploading results */
  uploadTime?: number;
  /** Total time */
  totalTime: number;
  /** Memory usage peak (bytes) */
  memoryPeak?: number;
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
  /** Total jobs processed (all time) */
  totalProcessed?: number;
  /** Average processing time (ms) */
  avgProcessingTime?: number;
  /** Jobs processed per minute */
  throughput?: number;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Event data for JOB_ADDED event
 */
export interface JobAddedEvent {
  jobId: string;
  job: ProcessingJob;
}

/**
 * Event data for JOB_STARTED event
 */
export interface JobStartedEvent {
  jobId: string;
  job: ProcessingJob;
}

/**
 * Event data for JOB_PROGRESS event
 */
export interface JobProgressEvent {
  jobId: string;
  progress: number;
  message?: string;
}

/**
 * Event data for JOB_COMPLETED event
 */
export interface JobCompletedEvent {
  jobId: string;
  result: ProcessingResult;
  duration: number;
}

/**
 * Event data for JOB_FAILED event
 */
export interface JobFailedEvent {
  jobId: string;
  error: string;
  stackTrace?: string;
  attempts: number;
  willRetry: boolean;
}

/**
 * Event data for JOB_RETRY event
 */
export interface JobRetryEvent {
  jobId: string;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date;
}

/**
 * Event data for QUEUE_ERROR event
 */
export interface QueueErrorEvent {
  error: Error;
  context?: string;
}

/**
 * Job processor interface
 */
export interface JobProcessor {
  /**
   * Process a job
   * @param job - The job to process
   * @returns Processing result
   */
  process(job: ProcessingJob): Promise<ProcessingResult>;

  /**
   * Validate a job before processing
   * @param job - The job to validate
   * @returns True if valid, false otherwise
   */
  validate?(job: ProcessingJob): Promise<boolean>;

  /**
   * Called when progress updates
   * @param job - The job being processed
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  onProgress?(job: ProcessingJob, progress: number, message?: string): void;

  /**
   * Called when processing completes successfully
   * @param job - The completed job
   * @param result - Processing result
   */
  onComplete?(job: ProcessingJob, result: ProcessingResult): void;

  /**
   * Called when processing fails
   * @param job - The failed job
   * @param error - The error that occurred
   */
  onError?(job: ProcessingJob, error: Error): void;
}

/**
 * Processor registry for managing job processors
 */
export interface ProcessorRegistry {
  /**
   * Register a processor for a processing type
   * @param type - Processing type
   * @param processor - The processor to register
   */
  register(type: ProcessingType, processor: JobProcessor): void;

  /**
   * Unregister a processor
   * @param type - Processing type to unregister
   */
  unregister(type: ProcessingType): void;

  /**
   * Get a processor for a processing type
   * @param type - Processing type
   * @returns The processor or undefined
   */
  get(type: ProcessingType): JobProcessor | undefined;

  /**
   * Check if a processor is registered
   * @param type - Processing type
   * @returns True if registered
   */
  has(type: ProcessingType): boolean;

  /**
   * Get all registered processing types
   * @returns Array of processing types
   */
  getTypes(): ProcessingType[];
}

/**
 * Queue configuration options
 */
export interface QueueOptions {
  /** Queue name */
  name?: string;
  /** Default job priority */
  defaultPriority?: JobPriority;
  /** Maximum concurrent jobs */
  concurrency?: number;
  /** Default job timeout (ms) */
  defaultTimeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Initial retry delay (ms) */
  retryDelay?: number;
  /** Retry backoff multiplier */
  retryBackoffMultiplier?: number;
  /** Maximum retry delay (ms) */
  maxRetryDelay?: number;
  /** Keep completed jobs for (ms) */
  removeOnComplete?: number;
  /** Keep failed jobs for (ms) */
  removeOnFail?: number;
  /** Enable stalled job recovery */
  stalledJobRecovery?: boolean;
  /** Stalled job check interval (ms) */
  stalledJobInterval?: number;
}

/**
 * Redis connection options
 */
export interface RedisConnectionOptions {
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** Enable TLS */
  tls?: boolean;
  /** Connection timeout (ms) */
  connectTimeout?: number;
  /** Maximum reconnection attempts */
  maxRetriesPerRequest?: number | null;
  /** Enable read-only mode */
  readOnly?: boolean;
  /** Key prefix */
  keyPrefix?: string;
}

/**
 * Dead letter queue options
 */
export interface DeadLetterQueueOptions {
  /** Enable dead letter queue */
  enabled: boolean;
  /** Dead letter queue name */
  queueName?: string;
  /** Maximum jobs to keep in DLQ */
  maxSize?: number;
  /** Time to keep jobs in DLQ (ms) */
  retentionTime?: number;
}

/**
 * Full Redis queue configuration
 */
export interface RedisQueueConfig {
  /** Redis connection options */
  connection: RedisConnectionOptions;
  /** Queue options */
  queue: QueueOptions;
  /** Dead letter queue options */
  deadLetterQueue?: DeadLetterQueueOptions;
}

/**
 * In-memory queue configuration
 */
export interface MemoryQueueConfig {
  /** Queue options */
  queue: QueueOptions;
  /** Maximum queue size */
  maxSize?: number;
  /** Enable persistence to file */
  persistToFile?: boolean;
  /** Persistence file path */
  persistencePath?: string;
}
