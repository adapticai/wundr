# BatchProcessingService

A comprehensive, production-ready batch processing service for managing and executing batch
operations with advanced features including concurrency control, error handling, progress tracking,
and monitoring.

## Features

### Core Batch Management

- ✅ **Batch Creation & Management** - Create, update, delete, and retrieve batches
- ✅ **Job Processing** - Automatic job creation and parallel execution
- ✅ **Status Management** - Complete lifecycle management (pending → running → completed/failed)
- ✅ **Progress Tracking** - Real-time progress updates and status monitoring

### Advanced Processing

- ✅ **Concurrency Control** - Configurable concurrent job limits
- ✅ **Retry Logic** - Automatic retries with configurable attempts
- ✅ **Error Handling** - Comprehensive error tracking and reporting
- ✅ **Resource Management** - Memory, CPU, and disk usage monitoring

### Monitoring & Analytics

- ✅ **Real-time Metrics** - Performance metrics collection and reporting
- ✅ **Statistics** - Comprehensive batch statistics and throughput analysis
- ✅ **Progress Updates** - Real-time progress tracking with hooks
- ✅ **Error Reporting** - Detailed error logging with severity levels

### Integration Features

- ✅ **Hook Compatibility** - Seamless integration with existing React hooks
- ✅ **TypeScript Support** - Full type safety with comprehensive interfaces
- ✅ **API Ready** - Direct integration with Next.js API routes
- ✅ **Production Ready** - Built for high-volume production environments

## Quick Start

### Basic Usage

```typescript
import { BatchProcessingService } from '@/lib/services/batch';

// Create a batch
const batch = await BatchProcessingService.createBatch({
  name: 'My Batch',
  description: 'Process user data',
  type: 'user-processing',
  data: [
    { id: 1, name: 'User 1', action: 'process' },
    { id: 2, name: 'User 2', action: 'validate' },
  ],
  priority: 'high',
});

// Start processing
await BatchProcessingService.updateBatch(batch.id, { status: 'running' });

// Monitor progress
const updatedBatch = await BatchProcessingService.getBatch(batch.id);
console.log(`Progress: ${updatedBatch.progress}%`);
```

### Advanced Configuration

```typescript
const batch = await BatchProcessingService.createBatch({
  name: 'Advanced Batch',
  data: items,
  config: {
    maxConcurrentJobs: 10,
    retryAttempts: 3,
    timeoutPerTemplate: 30000,
    rollbackOnFailure: true,
    backupStrategy: 'auto',
    conflictResolution: 'auto',
    notificationSettings: {
      onStart: true,
      onComplete: true,
      onError: true,
      progressInterval: 25,
    },
    resourceLimits: {
      maxMemory: 1024, // MB
      maxCpu: 80, // percentage
      timeout: 3600, // seconds
    },
  },
});
```

## API Reference

### Core Methods

#### `createBatch(request: CreateBatchRequest): Promise<Batch>`

Creates a new batch with the specified configuration and data items.

#### `getBatch(id: string): Promise<Batch | null>`

Retrieves a batch by ID with updated progress information.

#### `getAllBatches(): Promise<Batch[]>`

Returns all batches sorted by creation date (newest first).

#### `updateBatch(id: string, updates: UpdateBatchRequest): Promise<Batch | null>`

Updates batch properties and handles status transitions.

#### `deleteBatch(id: string): Promise<boolean>`

Deletes a batch and all associated jobs and data.

### Job Management

#### `getJobsByBatchId(batchId: string): Promise<BatchJob[]>`

Returns all jobs associated with a batch.

#### `retryJob(jobId: string): Promise<BatchJob | null>`

Retries a failed job if it hasn't exceeded retry limits.

### Monitoring & Statistics

#### `getBatchStats(): Promise<BatchStats>`

Returns comprehensive statistics about all batches.

#### `getBatchMetrics(batchId: string): Promise<BatchMetrics[]>`

Returns performance metrics for a specific batch.

#### `recordMetrics(batchId: string, metrics): Promise<void>`

Records performance metrics for monitoring.

### Hook Compatibility

#### `getAllBatchesForHook(): Promise<HookBatchJob[]>`

Returns batches in format compatible with `use-batch-management` hook.

#### `getBatchForHook(id: string): Promise<HookBatchJob | null>`

Returns a single batch in hook-compatible format.

## Types

### Core Interfaces

```typescript
interface Batch {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: BatchStatus;
  priority: BatchPriority;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  data: any[];
  results?: BatchResults;
  errors: BatchError[];
  warnings: string[];
  config: BatchConfig;
  // ... additional fields
}

interface BatchJob {
  id: string;
  batchId: string;
  name: string;
  status: JobStatus;
  progress: number;
  data: any;
  retryCount: number;
  maxRetries: number;
  // ... additional fields
}
```

### Status Types

```typescript
type BatchStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled'
  | 'retrying';

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying' | 'skipped';

type BatchPriority = 'low' | 'medium' | 'high' | 'critical';
```

## Integration with API Routes

The service is designed to work seamlessly with Next.js API routes:

```typescript
// app/api/batches/route.ts
import { BatchProcessingService } from '@/lib/services/batch/BatchProcessingService';

export async function GET() {
  const batches = await BatchProcessingService.getAllBatches();
  return NextResponse.json({ success: true, data: batches });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const batch = await BatchProcessingService.createBatch(body);
  return NextResponse.json({ success: true, data: batch });
}
```

## Error Handling

The service provides comprehensive error handling:

- **Automatic Retries** - Failed jobs are automatically retried up to configured limits
- **Error Categorization** - Errors are categorized by severity (low, medium, high, critical)
- **Rollback Support** - Optional rollback on batch failure
- **Context Preservation** - Error context and stack traces are preserved

## Performance Features

- **Concurrency Control** - Configurable parallel job execution
- **Resource Monitoring** - CPU, memory, and disk usage tracking
- **Throughput Optimization** - Batch processing optimized for high throughput
- **Memory Management** - Efficient memory usage with configurable limits

## Production Considerations

- **In-Memory Storage** - Current implementation uses in-memory storage; replace with database for
  production
- **Scalability** - Service is designed to handle high-volume batch processing
- **Monitoring** - Built-in metrics collection for production monitoring
- **Cleanup** - Automatic cleanup of old batches to prevent memory leaks

## File Structure

```
lib/services/batch/
├── BatchProcessingService.ts  # Main service implementation
├── types.ts                  # Type adapters and compatibility
├── index.ts                 # Public exports
└── README.md               # This documentation
```

## Dependencies

- Node.js built-in `crypto` module for UUID generation
- No external dependencies - pure TypeScript/JavaScript implementation

## License

This service is part of the Wundr web client application.
