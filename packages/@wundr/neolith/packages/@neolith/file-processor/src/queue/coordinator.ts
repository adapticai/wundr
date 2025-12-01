/**
 * @genesis/file-processor - Processing Coordinator
 *
 * High-level coordinator for file processing operations.
 * Integrates queue, storage, and file records management.
 *
 * @packageDocumentation
 */

import {
  QueueEvent,
  type ProcessingJob,
  type ProcessingType,
  type ProcessingResult,
  type JobInfo,
  type QueueStats,
  type EventHandler,
} from './types';

import type { ProcessingQueue } from './processing-queue';

/**
 * Storage service interface
 *
 * Abstract interface for file storage operations.
 */
export interface StorageService {
  /**
   * Get a file by ID
   */
  getFile(fileId: string): Promise<StoredFile | null>;

  /**
   * Get file content/stream
   */
  getFileContent(fileId: string): Promise<Buffer>;

  /**
   * Get file URL (for download)
   */
  getFileUrl(fileId: string): Promise<string>;

  /**
   * Store processing result
   */
  storeResult(fileId: string, result: ProcessingResult): Promise<void>;

  /**
   * Get files by workspace
   */
  getWorkspaceFiles(workspaceId: string): Promise<StoredFile[]>;

  /**
   * Get files by channel
   */
  getChannelFiles(channelId: string): Promise<StoredFile[]>;
}

/**
 * Stored file metadata
 */
export interface StoredFile {
  /** File ID */
  id: string;
  /** Original filename */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Workspace ID */
  workspaceId?: string;
  /** Channel ID */
  channelId?: string;
  /** Upload timestamp */
  uploadedAt: Date;
  /** User who uploaded */
  uploadedBy?: string;
  /** Processing status */
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  /** Storage path/key */
  storagePath: string;
}

/**
 * File record service interface
 *
 * Abstract interface for file record/metadata management.
 */
export interface FileRecordService {
  /**
   * Get file record by ID
   */
  getRecord(fileId: string): Promise<FileRecord | null>;

  /**
   * Update file record
   */
  updateRecord(fileId: string, updates: Partial<FileRecord>): Promise<void>;

  /**
   * Create file record
   */
  createRecord(
    record: Omit<FileRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FileRecord>;

  /**
   * Get unprocessed files
   */
  getUnprocessedFiles(limit?: number): Promise<FileRecord[]>;

  /**
   * Mark file as processing
   */
  markProcessing(fileId: string, jobId: string): Promise<void>;

  /**
   * Mark file as processed
   */
  markProcessed(fileId: string, result: ProcessingResult): Promise<void>;

  /**
   * Mark file as failed
   */
  markFailed(fileId: string, error: string): Promise<void>;
}

/**
 * File record structure
 */
export interface FileRecord {
  /** Record ID */
  id: string;
  /** File ID */
  fileId: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size */
  size: number;
  /** Workspace ID */
  workspaceId?: string;
  /** Channel ID */
  channelId?: string;
  /** User ID */
  userId?: string;
  /** Processing status */
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  /** Current job ID */
  jobId?: string;
  /** Processing result */
  result?: ProcessingResult;
  /** Error message */
  error?: string;
  /** Extracted text content */
  extractedText?: string;
  /** Number of processing attempts */
  attempts: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Uploaded file for processing
 */
export interface UploadedFile {
  /** Temporary file path or buffer */
  path?: string;
  buffer?: Buffer;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size */
  size: number;
  /** Workspace ID */
  workspaceId?: string;
  /** Channel ID */
  channelId?: string;
  /** User ID */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  /** Default processing type */
  defaultProcessingType?: ProcessingType;
  /** Default job priority */
  defaultPriority?: number;
  /** Auto-process uploaded files */
  autoProcess?: boolean;
  /** Enable callbacks */
  enableCallbacks?: boolean;
  /** Callback URL template */
  callbackUrlTemplate?: string;
  /** Maximum concurrent batch size */
  maxBatchSize?: number;
}

/**
 * Batch processing options
 */
export interface BatchProcessOptions {
  /** Processing type override */
  processingType?: ProcessingType;
  /** Priority override */
  priority?: number;
  /** Delay between jobs (ms) */
  delayBetweenJobs?: number;
  /** Callback URL */
  callbackUrl?: string;
}

/**
 * Processing Coordinator
 *
 * High-level interface for coordinating file processing operations.
 * Integrates queue management with storage and record keeping.
 *
 * @example
 * ```typescript
 * const coordinator = new ProcessingCoordinator(queue, storage, fileRecords);
 *
 * // Process a single file
 * const result = await coordinator.processFile('file-123');
 *
 * // Process uploaded file
 * await coordinator.processUploadedFile({
 *   buffer: fileBuffer,
 *   filename: 'document.pdf',
 *   mimeType: 'application/pdf',
 *   workspaceId: 'ws-456',
 * });
 *
 * // Batch process workspace files
 * await coordinator.processWorkspaceFiles('ws-456');
 * ```
 */
export class ProcessingCoordinator {
  private queue: ProcessingQueue;
  private storage: StorageService;
  private fileRecords: FileRecordService;
  private config: Required<CoordinatorConfig>;

  /**
   * Create a new processing coordinator
   *
   * @param queue - Processing queue instance
   * @param storage - Storage service instance
   * @param fileRecords - File records service instance
   * @param config - Coordinator configuration
   */
  constructor(
    queue: ProcessingQueue,
    storage: StorageService,
    fileRecords: FileRecordService,
    config: CoordinatorConfig = {}
  ) {
    this.queue = queue;
    this.storage = storage;
    this.fileRecords = fileRecords;
    this.config = {
      defaultProcessingType: config.defaultProcessingType ?? 'text-extraction',
      defaultPriority: config.defaultPriority ?? 5,
      autoProcess: config.autoProcess ?? true,
      enableCallbacks: config.enableCallbacks ?? false,
      callbackUrlTemplate: config.callbackUrlTemplate ?? '',
      maxBatchSize: config.maxBatchSize ?? 100,
    };

    this.setupQueueHandlers();
  }

  /**
   * Process a file by ID
   *
   * Creates a processing job for an existing file in storage.
   *
   * @param fileId - The file ID to process
   * @param options - Processing options
   * @returns Processing result promise that resolves when job completes
   */
  async processFile(
    fileId: string,
    options: {
      type?: ProcessingType;
      priority?: number;
      waitForCompletion?: boolean;
    } = {}
  ): Promise<ProcessingResult | string> {
    // Get file info from storage
    const file = await this.storage.getFile(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Determine processing type
    const processingType =
      options.type ?? this.determineProcessingType(file.mimeType);

    // Create job
    const job: ProcessingJob = {
      fileId,
      type: processingType,
      priority: (options.priority ?? this.config.defaultPriority) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
        | 9
        | 10,
      metadata: {
        filename: file.name,
        mimeType: file.mimeType,
        size: file.size,
        workspaceId: file.workspaceId,
        channelId: file.channelId,
      },
    };

    // Add callback if enabled
    if (this.config.enableCallbacks && this.config.callbackUrlTemplate) {
      job.callbackUrl = this.config.callbackUrlTemplate.replace(
        '{fileId}',
        fileId
      );
    }

    // Add to queue
    const jobId = await this.queue.addJob(job);

    // Update file record
    await this.fileRecords.markProcessing(fileId, jobId);

    // Wait for completion if requested
    if (options.waitForCompletion) {
      return this.waitForJobCompletion(jobId);
    }

    return jobId;
  }

  /**
   * Process an uploaded file
   *
   * Handles a newly uploaded file - stores it and creates a processing job.
   *
   * @param file - The uploaded file
   * @returns Job ID
   */
  async processUploadedFile(file: UploadedFile): Promise<string> {
    // Create file record
    const record = await this.fileRecords.createRecord({
      fileId: '', // Will be set by storage
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      workspaceId: file.workspaceId,
      channelId: file.channelId,
      userId: file.userId,
      status: 'pending',
      attempts: 0,
    });

    // Determine processing type
    const processingType = this.determineProcessingType(file.mimeType);

    // Create job
    const job: ProcessingJob = {
      fileId: record.id,
      type: processingType,
      priority: this.config.defaultPriority as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
        | 9
        | 10,
      workspaceId: file.workspaceId,
      channelId: file.channelId,
      userId: file.userId,
      metadata: {
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        ...(file.metadata ?? {}),
      },
    };

    // Add to queue
    const jobId = await this.queue.addJob(job);

    // Update record
    await this.fileRecords.updateRecord(record.id, {
      status: 'queued',
      jobId,
    });

    return jobId;
  }

  /**
   * Reprocess a file
   *
   * Queues a file for reprocessing, useful for retrying failed jobs
   * or updating extracted content.
   *
   * @param fileId - The file ID to reprocess
   * @param options - Processing options
   * @returns Job ID
   */
  async reprocessFile(
    fileId: string,
    options: {
      type?: ProcessingType;
      priority?: number;
    } = {}
  ): Promise<string> {
    // Get current record
    const record = await this.fileRecords.getRecord(fileId);
    if (!record) {
      throw new Error(`File record not found: ${fileId}`);
    }

    // Cancel any existing jobs for this file
    const existingJobs = await this.queue.getJobsByFileId(fileId);
    for (const job of existingJobs) {
      if (job.status === 'waiting' || job.status === 'delayed') {
        await this.queue.cancelJob(job.id);
      }
    }

    // Process the file
    const jobId = (await this.processFile(fileId, {
      type: options.type,
      priority: options.priority ?? 7, // Higher priority for reprocessing
      waitForCompletion: false,
    })) as string;

    return jobId;
  }

  /**
   * Process all files in a workspace
   *
   * Queues processing jobs for all unprocessed files in a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param options - Batch processing options
   * @returns Array of job IDs
   */
  async processWorkspaceFiles(
    workspaceId: string,
    options: BatchProcessOptions = {}
  ): Promise<string[]> {
    // Get workspace files
    const files = await this.storage.getWorkspaceFiles(workspaceId);

    return this.processBatch(
      files.map(f => f.id),
      {
        ...options,
        metadata: { workspaceId },
      }
    );
  }

  /**
   * Process all files in a channel
   *
   * Queues processing jobs for all unprocessed files in a channel.
   *
   * @param channelId - The channel ID
   * @param options - Batch processing options
   * @returns Array of job IDs
   */
  async processChannelFiles(
    channelId: string,
    options: BatchProcessOptions = {}
  ): Promise<string[]> {
    // Get channel files
    const files = await this.storage.getChannelFiles(channelId);

    return this.processBatch(
      files.map(f => f.id),
      {
        ...options,
        metadata: { channelId },
      }
    );
  }

  /**
   * Process unprocessed files
   *
   * Finds and queues all files that haven't been processed yet.
   *
   * @param limit - Maximum number of files to process
   * @returns Array of job IDs
   */
  async processUnprocessedFiles(limit?: number): Promise<string[]> {
    const files = await this.fileRecords.getUnprocessedFiles(
      limit ?? this.config.maxBatchSize
    );

    return this.processBatch(
      files.map(f => f.fileId),
      {}
    );
  }

  /**
   * Get processing status for a file
   *
   * @param fileId - The file ID
   * @returns Current job info or null
   */
  async getFileProcessingStatus(fileId: string): Promise<JobInfo | null> {
    const jobs = await this.queue.getJobsByFileId(fileId);
    if (jobs.length === 0) {
      return null;
    }

    // Return the most recent job
    return (
      jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
      null
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    return this.queue.getStats();
  }

  /**
   * Subscribe to processing events
   */
  on<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void {
    this.queue.on(event, handler);
  }

  /**
   * Unsubscribe from processing events
   */
  off<T = unknown>(event: QueueEvent, handler: EventHandler<T>): void {
    this.queue.off(event, handler);
  }

  /**
   * Pause processing
   */
  async pause(): Promise<void> {
    await this.queue.pause();
  }

  /**
   * Resume processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
  }

  /**
   * Process a batch of files
   */
  private async processBatch(
    fileIds: string[],
    options: BatchProcessOptions & { metadata?: Record<string, unknown> }
  ): Promise<string[]> {
    const jobs: ProcessingJob[] = [];

    for (const fileId of fileIds.slice(0, this.config.maxBatchSize)) {
      const file = await this.storage.getFile(fileId);
      if (!file) {
        continue;
      }

      const processingType =
        options.processingType ?? this.determineProcessingType(file.mimeType);

      jobs.push({
        fileId,
        type: processingType,
        priority: (options.priority ?? this.config.defaultPriority) as
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9
          | 10,
        delay: options.delayBetweenJobs,
        callbackUrl: options.callbackUrl,
        metadata: {
          filename: file.name,
          mimeType: file.mimeType,
          size: file.size,
          ...options.metadata,
        },
      });
    }

    if (jobs.length === 0) {
      return [];
    }

    const jobIds = await this.queue.addBulkJobs(jobs);

    // Update file records
    await Promise.all(
      jobIds.map((jobId, index) =>
        this.fileRecords.markProcessing(fileIds[index]!, jobId)
      )
    );

    return jobIds;
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueHandlers(): void {
    // Handle job completion
    this.queue.on(QueueEvent.JOB_COMPLETED, async data => {
      const { jobId, result } = data as {
        jobId: string;
        result: ProcessingResult;
      };

      // Get job info to find file ID
      const job = await this.queue.getJob(jobId);
      if (job) {
        await this.fileRecords.markProcessed(job.data.fileId, result);

        // Store result
        await this.storage.storeResult(job.data.fileId, result);
      }
    });

    // Handle job failure
    this.queue.on(QueueEvent.JOB_FAILED, async data => {
      const { jobId, error, willRetry } = data as {
        jobId: string;
        error: string;
        willRetry: boolean;
      };

      // Only mark as failed if no more retries
      if (!willRetry) {
        const job = await this.queue.getJob(jobId);
        if (job) {
          await this.fileRecords.markFailed(job.data.fileId, error);
        }
      }
    });
  }

  /**
   * Determine processing type from MIME type
   */
  private determineProcessingType(mimeType: string): ProcessingType {
    const mimeTypeMap: Record<string, ProcessingType> = {
      'application/pdf': 'text-extraction',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'document-convert',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'spreadsheet-parse',
      'application/vnd.ms-excel': 'spreadsheet-parse',
      'image/png': 'ocr',
      'image/jpeg': 'ocr',
      'image/tiff': 'ocr',
      'image/webp': 'thumbnail',
    };

    return mimeTypeMap[mimeType] ?? this.config.defaultProcessingType;
  }

  /**
   * Wait for a job to complete
   */
  private waitForJobCompletion(jobId: string): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      const checkJob = async () => {
        const job = await this.queue.getJob(jobId);
        if (!job) {
          reject(new Error(`Job not found: ${jobId}`));
          return;
        }

        if (job.status === 'completed' && job.result) {
          resolve(job.result);
          return;
        }

        if (job.status === 'failed') {
          reject(new Error(job.error ?? 'Job failed'));
          return;
        }

        // Check again in 500ms
        setTimeout(checkJob, 500);
      };

      checkJob();
    });
  }
}

/**
 * Create a processing coordinator
 *
 * @param queue - Processing queue
 * @param storage - Storage service
 * @param fileRecords - File records service
 * @param config - Coordinator configuration
 * @returns ProcessingCoordinator instance
 */
export function createProcessingCoordinator(
  queue: ProcessingQueue,
  storage: StorageService,
  fileRecords: FileRecordService,
  config?: CoordinatorConfig
): ProcessingCoordinator {
  return new ProcessingCoordinator(queue, storage, fileRecords, config);
}
