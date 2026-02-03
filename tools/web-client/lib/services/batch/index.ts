// Re-export all types and service from BatchProcessingService
export {
  BatchProcessingService,
  batchService,
  type Batch,
  type BatchJob,
  type BatchResults,
  type BatchArtifact,
  type BatchError,
  type BatchConfig,
  type NotificationSettings,
  type ResourceLimits,
  type CreateBatchRequest,
  type UpdateBatchRequest,
  type BatchStats,
  type BatchMetrics,
  type BatchStatus,
  type JobStatus,
  type BatchPriority,
  type ConsolidationType,
} from './BatchProcessingService';

// Re-export type adapters and compatibility types
export { BatchTypeAdapter, type HookBatchJob } from './types';

// Import for default export
import { BatchProcessingService } from './BatchProcessingService';

// Convenience re-export for the main service
export default BatchProcessingService;
