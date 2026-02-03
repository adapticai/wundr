import { randomUUID } from 'crypto';

// Core batch types
export interface Batch {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: BatchStatus;
  priority: BatchPriority;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  currentStage?: string;
  currentTemplate?: string;
  data: any[];
  results?: BatchResults;
  errors: BatchError[];
  warnings: string[];
  config: BatchConfig;
  templateIds: string[];
  consolidationType: ConsolidationType;
  estimatedDuration: number;
  actualDuration?: number;
  executionIds: string[];
  metadata?: Record<string, any>;
}

export interface BatchJob {
  id: string;
  batchId: string;
  name: string;
  status: JobStatus;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
  retryCount: number;
  maxRetries: number;
  data: any;
  metadata?: Record<string, any>;
}

export interface BatchResults {
  templatesProcessed: number;
  duplicatesRemoved: number;
  conflictsResolved: number;
  filesCreated: number;
  filesModified: number;
  backupCreated: boolean;
  processingTime: number;
  throughput: number;
  successRate: number;
  artifacts: BatchArtifact[];
}

export interface BatchArtifact {
  id: string;
  type: 'file' | 'report' | 'backup' | 'log';
  name: string;
  path: string;
  size: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface BatchError {
  id: string;
  jobId?: string;
  timestamp: Date;
  message: string;
  code?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  stackTrace?: string;
}

export interface BatchConfig {
  backupStrategy: 'auto' | 'manual' | 'none';
  conflictResolution: 'interactive' | 'auto' | 'skip';
  maxConcurrentJobs?: number;
  retryAttempts?: number;
  timeoutPerTemplate?: number;
  rollbackOnFailure?: boolean;
  notificationSettings?: NotificationSettings;
  resourceLimits?: ResourceLimits;
}

export interface NotificationSettings {
  onStart: boolean;
  onComplete: boolean;
  onError: boolean;
  onProgress: boolean;
  progressInterval: number; // in percentage
  webhookUrl?: string;
  emailRecipients?: string[];
}

export interface ResourceLimits {
  maxMemory?: number; // in MB
  maxCpu?: number; // percentage
  maxDiskSpace?: number; // in MB
  timeout?: number; // in seconds
}

export interface CreateBatchRequest {
  name: string;
  description?: string;
  type?: string;
  data: any[];
  priority?: BatchPriority;
  templateIds?: string[];
  consolidationType?: ConsolidationType;
  config?: Partial<BatchConfig>;
  metadata?: Record<string, any>;
}

export interface UpdateBatchRequest {
  name?: string;
  description?: string;
  status?: BatchStatus;
  priority?: BatchPriority;
  config?: Partial<BatchConfig>;
  metadata?: Record<string, any>;
}

export interface BatchStats {
  totalBatches: number;
  activeBatches: number;
  completedBatches: number;
  failedBatches: number;
  totalProcessedItems: number;
  averageProcessingTime: number;
  successRate: number;
  throughput: number;
}

export interface BatchMetrics {
  batchId: string;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  throughput: number;
  latency: number;
  errorRate: number;
}

// Enums
export type BatchStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled'
  | 'retrying';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'skipped';

export type BatchPriority = 'low' | 'medium' | 'high' | 'critical';

export type ConsolidationType = 'merge' | 'replace' | 'archive';

// In-memory storage (in production, this would be a database)
class BatchStorage {
  private batches = new Map<string, Batch>();
  private jobs = new Map<string, BatchJob>();
  private metrics = new Map<string, BatchMetrics[]>();

  // Batch operations
  saveBatch(batch: Batch): void {
    this.batches.set(batch.id, { ...batch });
  }

  getBatch(id: string): Batch | undefined {
    return this.batches.get(id);
  }

  getAllBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  deleteBatch(id: string): boolean {
    return this.batches.delete(id);
  }

  // Job operations
  saveJob(job: BatchJob): void {
    this.jobs.set(job.id, { ...job });
  }

  getJob(id: string): BatchJob | undefined {
    return this.jobs.get(id);
  }

  getJobsByBatchId(batchId: string): BatchJob[] {
    return Array.from(this.jobs.values()).filter(
      job => job.batchId === batchId
    );
  }

  deleteJob(id: string): boolean {
    return this.jobs.delete(id);
  }

  // Metrics operations
  saveMetrics(batchId: string, metrics: BatchMetrics): void {
    const batchMetrics = this.metrics.get(batchId) || [];
    batchMetrics.push(metrics);
    this.metrics.set(batchId, batchMetrics);
  }

  getMetrics(batchId: string): BatchMetrics[] {
    return this.metrics.get(batchId) || [];
  }
}

// Main service class
export class BatchProcessingService {
  private static storage = new BatchStorage();
  private static activeJobs = new Map<string, Promise<void>>();
  private static jobQueues = new Map<string, BatchJob[]>();

  // Batch management
  static async createBatch(request: CreateBatchRequest): Promise<Batch> {
    const id = randomUUID();
    const now = new Date();

    const batch: Batch = {
      id,
      name: request.name,
      description: request.description,
      type: request.type || 'default',
      status: 'pending',
      priority: request.priority || 'medium',
      createdAt: now,
      updatedAt: now,
      progress: 0,
      totalItems: request.data.length,
      processedItems: 0,
      failedItems: 0,
      data: request.data,
      errors: [],
      warnings: [],
      templateIds: request.templateIds || [],
      consolidationType: request.consolidationType || 'merge',
      estimatedDuration: this.estimateDuration(
        request.data.length,
        request.type
      ),
      executionIds: [],
      config: {
        backupStrategy: 'auto',
        conflictResolution: 'interactive',
        maxConcurrentJobs: 5,
        retryAttempts: 3,
        timeoutPerTemplate: 30000,
        rollbackOnFailure: false,
        notificationSettings: {
          onStart: true,
          onComplete: true,
          onError: true,
          onProgress: false,
          progressInterval: 10,
        },
        resourceLimits: {
          maxMemory: 512,
          maxCpu: 80,
          timeout: 3600,
        },
        ...request.config,
      },
      metadata: request.metadata || {},
    };

    this.storage.saveBatch(batch);

    // Create jobs for each item
    await this.createJobsForBatch(batch);

    return batch;
  }

  static async getBatch(id: string): Promise<Batch | null> {
    const batch = this.storage.getBatch(id);
    if (!batch) return null;

    // Update progress from jobs
    const jobs = this.storage.getJobsByBatchId(id);
    const completedJobs = jobs.filter(job => job.status === 'completed');
    const failedJobs = jobs.filter(job => job.status === 'failed');

    batch.processedItems = completedJobs.length;
    batch.failedItems = failedJobs.length;
    batch.progress =
      jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0;

    // Update overall status
    if (jobs.length > 0 && completedJobs.length === jobs.length) {
      batch.status = 'completed';
      if (!batch.completedAt) {
        batch.completedAt = new Date();
        batch.actualDuration =
          batch.completedAt.getTime() -
          (batch.startedAt?.getTime() || batch.createdAt.getTime());
      }
    } else if (failedJobs.length > 0 && batch.status === 'running') {
      const shouldRollback = batch.config.rollbackOnFailure;
      if (shouldRollback || failedJobs.length === jobs.length) {
        batch.status = 'failed';
      }
    }

    this.storage.saveBatch(batch);
    return batch;
  }

  static async getAllBatches(): Promise<Batch[]> {
    const batches = this.storage.getAllBatches();

    // Update each batch's progress
    for (const batch of batches) {
      await this.getBatch(batch.id);
    }

    return this.storage
      .getAllBatches()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async updateBatch(
    id: string,
    updates: UpdateBatchRequest
  ): Promise<Batch | null> {
    const batch = this.storage.getBatch(id);
    if (!batch) return null;

    const updatedBatch: Batch = {
      ...batch,
      ...updates,
      updatedAt: new Date(),
      config: updates.config
        ? { ...batch.config, ...updates.config }
        : batch.config,
      metadata: updates.metadata
        ? { ...batch.metadata, ...updates.metadata }
        : batch.metadata,
    };

    // Handle status changes
    if (updates.status) {
      switch (updates.status) {
        case 'running':
          if (!updatedBatch.startedAt) {
            updatedBatch.startedAt = new Date();
          }
          await this.startBatchProcessing(updatedBatch);
          break;
        case 'paused':
          await this.pauseBatchProcessing(id);
          break;
        case 'cancelled':
          await this.cancelBatchProcessing(id);
          break;
        case 'failed':
          await this.failBatchProcessing(id);
          break;
      }
    }

    this.storage.saveBatch(updatedBatch);
    return updatedBatch;
  }

  static async deleteBatch(id: string): Promise<boolean> {
    const batch = this.storage.getBatch(id);
    if (!batch) return false;

    // Cancel if running
    if (batch.status === 'running') {
      await this.cancelBatchProcessing(id);
    }

    // Delete all associated jobs
    const jobs = this.storage.getJobsByBatchId(id);
    jobs.forEach(job => this.storage.deleteJob(job.id));

    return this.storage.deleteBatch(id);
  }

  // Job management
  private static async createJobsForBatch(batch: Batch): Promise<void> {
    const jobs: BatchJob[] = batch.data.map((item, index) => ({
      id: randomUUID(),
      batchId: batch.id,
      name: `${batch.name} - Item ${index + 1}`,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: batch.config.retryAttempts || 3,
      data: item,
    }));

    jobs.forEach(job => this.storage.saveJob(job));
  }

  static async getJobsByBatchId(batchId: string): Promise<BatchJob[]> {
    return this.storage.getJobsByBatchId(batchId);
  }

  static async retryJob(jobId: string): Promise<BatchJob | null> {
    const job = this.storage.getJob(jobId);
    if (!job || job.retryCount >= job.maxRetries) return null;

    const updatedJob: BatchJob = {
      ...job,
      status: 'retrying',
      retryCount: job.retryCount + 1,
      error: undefined,
    };

    this.storage.saveJob(updatedJob);

    // Restart job processing
    await this.processJob(updatedJob);

    return updatedJob;
  }

  // Batch processing
  private static async startBatchProcessing(batch: Batch): Promise<void> {
    const jobs = this.storage.getJobsByBatchId(batch.id);
    const pendingJobs = jobs.filter(job => job.status === 'pending');

    if (pendingJobs.length === 0) return;

    // Create processing promise
    const processingPromise = this.processBatchJobs(batch.id, pendingJobs);
    this.activeJobs.set(batch.id, processingPromise);

    // Start processing
    try {
      await processingPromise;
    } catch (error) {
      console.error(`Batch processing failed for ${batch.id}:`, error);
    } finally {
      this.activeJobs.delete(batch.id);
    }
  }

  private static async processBatchJobs(
    batchId: string,
    jobs: BatchJob[]
  ): Promise<void> {
    const batch = this.storage.getBatch(batchId);
    if (!batch) return;

    const concurrencyLimit = batch.config.maxConcurrentJobs || 5;
    const jobQueue = [...jobs];
    const activePromises = new Set<Promise<void>>();

    while (jobQueue.length > 0 || activePromises.size > 0) {
      // Check if batch was cancelled or paused
      const currentBatch = this.storage.getBatch(batchId);
      if (
        !currentBatch ||
        currentBatch.status === 'cancelled' ||
        currentBatch.status === 'paused'
      ) {
        break;
      }

      // Start new jobs up to concurrency limit
      while (jobQueue.length > 0 && activePromises.size < concurrencyLimit) {
        const job = jobQueue.shift()!;
        const jobPromise = this.processJob(job);
        activePromises.add(jobPromise);

        jobPromise.finally(() => activePromises.delete(jobPromise));
      }

      // Wait for at least one job to complete
      if (activePromises.size > 0) {
        await Promise.race(activePromises);
      }

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for all remaining jobs
    await Promise.all(activePromises);
  }

  private static async processJob(job: BatchJob): Promise<void> {
    const updatedJob: BatchJob = {
      ...job,
      status: 'running',
      startedAt: new Date(),
    };

    this.storage.saveJob(updatedJob);

    try {
      // Simulate job processing (replace with actual processing logic)
      const result = await this.executeJobLogic(job);

      const completedJob: BatchJob = {
        ...updatedJob,
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        result,
      };

      this.storage.saveJob(completedJob);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const failedJob: BatchJob = {
        ...updatedJob,
        status: 'failed',
        completedAt: new Date(),
        error: errorMessage,
      };

      this.storage.saveJob(failedJob);

      // Add error to batch
      const batch = this.storage.getBatch(job.batchId);
      if (batch) {
        batch.errors.push({
          id: randomUUID(),
          jobId: job.id,
          timestamp: new Date(),
          message: errorMessage,
          severity: 'high',
        });
        this.storage.saveBatch(batch);
      }
    }
  }

  private static async executeJobLogic(job: BatchJob): Promise<any> {
    // Simulate processing time
    const processingTime = Math.random() * 2000 + 500; // 500ms to 2.5s
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate occasional failures (10% chance)
    if (Math.random() < 0.1) {
      throw new Error(`Processing failed for job ${job.id}`);
    }

    // Return mock result
    return {
      processed: true,
      timestamp: new Date(),
      processingTime,
      outputFiles: [`output_${job.id}.txt`],
    };
  }

  private static async pauseBatchProcessing(batchId: string): Promise<void> {
    // The processing loop will check batch status and stop
    // Update pending jobs to paused
    const jobs = this.storage.getJobsByBatchId(batchId);
    const pendingJobs = jobs.filter(
      job => job.status === 'pending' || job.status === 'running'
    );

    pendingJobs.forEach(job => {
      if (job.status === 'pending') {
        this.storage.saveJob({ ...job, status: 'pending' });
      }
    });
  }

  private static async cancelBatchProcessing(batchId: string): Promise<void> {
    // Cancel all pending jobs
    const jobs = this.storage.getJobsByBatchId(batchId);
    const activejobs = jobs.filter(
      job => job.status === 'pending' || job.status === 'running'
    );

    activejobs.forEach(job => {
      this.storage.saveJob({
        ...job,
        status: job.status === 'running' ? 'failed' : 'skipped',
        completedAt: new Date(),
        error: 'Batch cancelled',
      });
    });
  }

  private static async failBatchProcessing(batchId: string): Promise<void> {
    // Similar to cancel but marks as failed
    await this.cancelBatchProcessing(batchId);
  }

  // Utility methods
  private static estimateDuration(itemCount: number, type?: string): number {
    // Base processing time per item in milliseconds
    const baseTimePerItem = 1000; // 1 second per item
    const typeMultiplier = type === 'complex' ? 2 : 1;

    return itemCount * baseTimePerItem * typeMultiplier;
  }

  // Statistics and monitoring
  static async getBatchStats(): Promise<BatchStats> {
    const batches = this.storage.getAllBatches();

    const totalBatches = batches.length;
    const activeBatches = batches.filter(
      b => b.status === 'running' || b.status === 'pending'
    ).length;
    const completedBatches = batches.filter(
      b => b.status === 'completed'
    ).length;
    const failedBatches = batches.filter(b => b.status === 'failed').length;

    const totalProcessedItems = batches.reduce(
      (sum, b) => sum + b.processedItems,
      0
    );
    const completedWithDuration = batches.filter(b => b.actualDuration);
    const averageProcessingTime =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce(
            (sum, b) => sum + (b.actualDuration || 0),
            0
          ) / completedWithDuration.length
        : 0;

    const successRate =
      totalBatches > 0 ? (completedBatches / totalBatches) * 100 : 0;
    const throughput = totalProcessedItems; // items per time period

    return {
      totalBatches,
      activeBatches,
      completedBatches,
      failedBatches,
      totalProcessedItems,
      averageProcessingTime,
      successRate,
      throughput,
    };
  }

  static async getBatchMetrics(batchId: string): Promise<BatchMetrics[]> {
    return this.storage.getMetrics(batchId);
  }

  static async recordMetrics(
    batchId: string,
    metrics: Omit<BatchMetrics, 'batchId' | 'timestamp'>
  ): Promise<void> {
    const batchMetrics: BatchMetrics = {
      batchId,
      timestamp: new Date(),
      ...metrics,
    };

    this.storage.saveMetrics(batchId, batchMetrics);
  }

  // Cleanup and maintenance
  static async cleanupOldBatches(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const batches = this.storage.getAllBatches();
    const oldBatches = batches.filter(
      batch =>
        (batch.status === 'completed' || batch.status === 'failed') &&
        batch.createdAt < cutoffDate
    );

    let cleanedCount = 0;
    for (const batch of oldBatches) {
      const deleted = await this.deleteBatch(batch.id);
      if (deleted) cleanedCount++;
    }

    return cleanedCount;
  }

  // Hook compatibility methods
  static async getAllBatchesForHook(): Promise<any[]> {
    const batches = await this.getAllBatches();
    return batches.map(batch => this.adaptBatchForHook(batch));
  }

  static async getBatchForHook(id: string): Promise<any | null> {
    const batch = await this.getBatch(id);
    return batch ? this.adaptBatchForHook(batch) : null;
  }

  private static adaptBatchForHook(batch: Batch): any {
    return {
      id: batch.id,
      name: batch.name,
      description: batch.description || '',
      status: batch.status === 'retrying' ? 'running' : batch.status,
      progress: batch.progress,
      createdAt: batch.createdAt,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      templateIds: batch.templateIds,
      consolidationType: batch.consolidationType,
      priority: batch.priority === 'critical' ? 'high' : batch.priority,
      estimatedDuration: batch.estimatedDuration,
      actualDuration: batch.actualDuration,
      errors: batch.errors.map(error => error.message),
      warnings: batch.warnings,
      currentStage: batch.currentStage,
      currentTemplate: batch.currentTemplate,
      results: batch.results
        ? {
            templatesProcessed: batch.results.templatesProcessed,
            duplicatesRemoved: batch.results.duplicatesRemoved,
            conflictsResolved: batch.results.conflictsResolved,
            filesCreated: batch.results.filesCreated,
            filesModified: batch.results.filesModified,
            backupCreated: batch.results.backupCreated,
          }
        : undefined,
      executionIds: batch.executionIds,
      config: {
        backupStrategy: batch.config.backupStrategy,
        conflictResolution: batch.config.conflictResolution,
        maxConcurrentJobs: batch.config.maxConcurrentJobs,
        retryAttempts: batch.config.retryAttempts,
        timeoutPerTemplate: batch.config.timeoutPerTemplate,
        rollbackOnFailure: batch.config.rollbackOnFailure,
      },
    };
  }
}

// Export singleton instance
export const batchService = BatchProcessingService;
