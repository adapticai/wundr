// Type adapters and shared interfaces for BatchProcessingService
import type {
  Batch,
  BatchJob as ServiceBatchJob,
} from './BatchProcessingService.ts';

// Hook-compatible batch interface (from use-batch-management.ts)
export interface HookBatchJob {
  id: string;
  name: string;
  description: string;
  status:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'paused'
    | 'cancelled';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  templateIds: string[];
  consolidationType: 'merge' | 'replace' | 'archive';
  priority: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  actualDuration?: number;
  errors: string[];
  warnings: string[];
  currentStage?: string;
  currentTemplate?: string;
  results?: {
    templatesProcessed: number;
    duplicatesRemoved: number;
    conflictsResolved: number;
    filesCreated: number;
    filesModified: number;
    backupCreated: boolean;
  };
  executionIds: string[];
  config: {
    backupStrategy: 'auto' | 'manual' | 'none';
    conflictResolution: 'interactive' | 'auto' | 'skip';
    maxConcurrentJobs?: number;
    retryAttempts?: number;
    timeoutPerTemplate?: number;
    rollbackOnFailure?: boolean;
  };
}

// Adapter functions to convert between service and hook types
export class BatchTypeAdapter {
  /**
   * Converts a service Batch to hook-compatible BatchJob
   */
  static toHookBatchJob(batch: Batch): HookBatchJob {
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

  /**
   * Converts multiple service Batches to hook-compatible BatchJobs
   */
  static toHookBatchJobs(batches: Batch[]): HookBatchJob[] {
    return batches.map(batch => this.toHookBatchJob(batch));
  }

  /**
   * Validates that a batch has all required fields for hook compatibility
   */
  static validateHookCompatibility(batch: Batch): boolean {
    try {
      const converted = this.toHookBatchJob(batch);
      return !!(
        converted.id &&
        converted.name &&
        converted.status &&
        typeof converted.progress === 'number'
      );
    } catch {
      return false;
    }
  }
}

// Re-export service types for convenience
export type {
  Batch,
  BatchJob as ServiceBatchJob,
  BatchResults,
  BatchArtifact,
  BatchError,
  BatchConfig,
  NotificationSettings,
  ResourceLimits,
  CreateBatchRequest,
  UpdateBatchRequest,
  BatchStats,
  BatchMetrics,
  BatchStatus,
  JobStatus,
  BatchPriority,
  ConsolidationType,
} from './BatchProcessingService.ts';
