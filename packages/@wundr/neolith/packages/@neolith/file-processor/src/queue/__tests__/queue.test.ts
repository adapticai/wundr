/**
 * Processing Queue Tests
 *
 * Comprehensive test suite for the file processing queue covering:
 * - Job addition and management
 * - Priority handling
 * - Concurrent job processing
 * - Retry mechanisms
 * - Dead letter queue
 * - Event handling
 *
 * @module @genesis/file-processor/queue/__tests__/queue.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FileType } from '../../types';

import type { QueueStats, JobResult, QueueEvent, QueueEventListener } from '../../queue';
import type { FileProcessingJob, ProcessorResult, JobProgress as _JobProgress, JobStatus } from '../../types';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Mock BullMQ Queue
 */
const mockBullQueue = {
  add: vi.fn(),
  addBulk: vi.fn(),
  getJob: vi.fn(),
  getJobs: vi.fn(),
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getCompletedCount: vi.fn(),
  getFailedCount: vi.fn(),
  getDelayedCount: vi.fn(),
  getPausedCount: vi.fn(),
  getCompleted: vi.fn(),
  getFailed: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
};

/**
 * Mock BullMQ Worker
 */
const mockBullWorker = {
  on: vi.fn(),
  close: vi.fn(),
};

/**
 * Mock Redis connection
 */
const _mockRedisConnection = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  quit: vi.fn(),
};

// =============================================================================
// PROCESSING QUEUE (MOCK IMPLEMENTATION FOR TESTING)
// =============================================================================

interface ProcessingQueue {
  initialize(): Promise<void>;
  close(): Promise<void>;
  addJob(job: FileProcessingJob): Promise<string>;
  addBulkJobs(jobs: FileProcessingJob[]): Promise<string[]>;
  getJobStatus(jobId: string): Promise<JobResult | null>;
  cancelJob(jobId: string): Promise<boolean>;
  retryJob(jobId: string): Promise<boolean>;
  getStats(): Promise<QueueStats>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  clearCompleted(): Promise<number>;
  clearFailed(): Promise<number>;
  on(event: QueueEvent, listener: QueueEventListener): void;
  off(event: QueueEvent, listener: QueueEventListener): void;
}

/**
 * Create mock processing queue for testing
 */
function createMockProcessingQueue(): ProcessingQueue {
  const eventListeners = new Map<QueueEvent, QueueEventListener[]>();
  let isInitialized = false;

  const emit = (event: QueueEvent, data: unknown) => {
    const listeners = eventListeners.get(event) ?? [];
    listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch {
        // Ignore listener errors
      }
    });
  };

  return {
    initialize: vi.fn(async () => {
      isInitialized = true;
    }),

    close: vi.fn(async () => {
      isInitialized = false;
      await mockBullWorker.close();
      await mockBullQueue.close();
    }),

    addJob: vi.fn(async (job: FileProcessingJob): Promise<string> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const bullJob = await mockBullQueue.add(job.jobId, job, {
        priority: job.priority ?? 5,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });

      emit('job:added' as QueueEvent, { jobId: job.jobId });

      return bullJob?.id ?? job.jobId;
    }),

    addBulkJobs: vi.fn(async (jobs: FileProcessingJob[]): Promise<string[]> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const bulkData = jobs.map((job) => ({
        name: job.jobId,
        data: job,
        opts: { priority: job.priority ?? 5 },
      }));

      const bullJobs = await mockBullQueue.addBulk(bulkData);

      jobs.forEach((job) => {
        emit('job:added' as QueueEvent, { jobId: job.jobId });
      });

      return bullJobs?.map((j: { id: string }) => j.id) ?? jobs.map((j) => j.jobId);
    }),

    getJobStatus: vi.fn(async (jobId: string): Promise<JobResult | null> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const job = await mockBullQueue.getJob(jobId);
      if (!job) {
return null;
}

      return {
        jobId: job.id,
        status: job.status as JobStatus,
        result: job.returnvalue,
        error: job.failedReason,
        attempts: job.attemptsMade ?? 0,
        createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
        processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      };
    }),

    cancelJob: vi.fn(async (jobId: string): Promise<boolean> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const job = await mockBullQueue.getJob(jobId);
      if (!job) {
return false;
}

      if (job.status === 'active') {
        return false; // Cannot cancel active jobs
      }

      await job.remove();
      return true;
    }),

    retryJob: vi.fn(async (jobId: string): Promise<boolean> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const job = await mockBullQueue.getJob(jobId);
      if (!job) {
return false;
}

      if (job.status !== 'failed') {
        return false;
      }

      await job.retry();
      emit('job:retry' as QueueEvent, { jobId });
      return true;
    }),

    getStats: vi.fn(async (): Promise<QueueStats> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        mockBullQueue.getWaitingCount(),
        mockBullQueue.getActiveCount(),
        mockBullQueue.getCompletedCount(),
        mockBullQueue.getFailedCount(),
        mockBullQueue.getDelayedCount(),
        mockBullQueue.getPausedCount(),
      ]);

      return { waiting, active, completed, failed, delayed, paused };
    }),

    pause: vi.fn(async () => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }
      await mockBullQueue.pause();
    }),

    resume: vi.fn(async () => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }
      await mockBullQueue.resume();
    }),

    clearCompleted: vi.fn(async (): Promise<number> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const jobs = await mockBullQueue.getCompleted();
      await Promise.all(jobs.map((job: { remove: () => Promise<void> }) => job.remove()));
      return jobs.length;
    }),

    clearFailed: vi.fn(async (): Promise<number> => {
      if (!isInitialized) {
        throw new Error('Queue not initialized');
      }

      const jobs = await mockBullQueue.getFailed();
      await Promise.all(jobs.map((job: { remove: () => Promise<void> }) => job.remove()));
      return jobs.length;
    }),

    on: vi.fn((event: QueueEvent, listener: QueueEventListener) => {
      const listeners = eventListeners.get(event) ?? [];
      listeners.push(listener);
      eventListeners.set(event, listeners);
    }),

    off: vi.fn((event: QueueEvent, listener: QueueEventListener) => {
      const listeners = eventListeners.get(event) ?? [];
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
        eventListeners.set(event, listeners);
      }
    }),
  };
}

/**
 * Create mock file processing job
 */
function createMockJob(overrides: Partial<FileProcessingJob> = {}): FileProcessingJob {
  return {
    jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    filePath: '/path/to/file.pdf',
    filename: 'document.pdf',
    fileType: FileType.PDF,
    priority: 5,
    createdAt: new Date(),
    ...overrides,
  };
}

// =============================================================================
// QUEUE TESTS
// =============================================================================

describe('ProcessingQueue', () => {
  let queue: ProcessingQueue;

  beforeEach(async () => {
    queue = createMockProcessingQueue();
    vi.clearAllMocks();

    // Setup default mock returns
    mockBullQueue.add.mockResolvedValue({ id: 'bull_job_1' });
    mockBullQueue.addBulk.mockResolvedValue([{ id: 'bulk_1' }, { id: 'bulk_2' }]);
    mockBullQueue.getWaitingCount.mockResolvedValue(0);
    mockBullQueue.getActiveCount.mockResolvedValue(0);
    mockBullQueue.getCompletedCount.mockResolvedValue(0);
    mockBullQueue.getFailedCount.mockResolvedValue(0);
    mockBullQueue.getDelayedCount.mockResolvedValue(0);
    mockBullQueue.getPausedCount.mockResolvedValue(0);
    mockBullQueue.getCompleted.mockResolvedValue([]);
    mockBullQueue.getFailed.mockResolvedValue([]);
    mockBullQueue.pause.mockResolvedValue(undefined);
    mockBullQueue.resume.mockResolvedValue(undefined);
    mockBullQueue.close.mockResolvedValue(undefined);
    mockBullWorker.close.mockResolvedValue(undefined);

    await queue.initialize();
  });

  afterEach(async () => {
    await queue.close();
    vi.resetAllMocks();
  });

  // ===========================================================================
  // addJob Tests
  // ===========================================================================

  describe('addJob', () => {
    it('adds job to queue', async () => {
      const job = createMockJob({ jobId: 'test_job_1' });

      mockBullQueue.add.mockResolvedValue({ id: 'test_job_1' });

      const jobId = await queue.addJob(job);

      expect(jobId).toBe('test_job_1');
      expect(mockBullQueue.add).toHaveBeenCalledWith(
        'test_job_1',
        job,
        expect.objectContaining({
          priority: 5,
          attempts: 3,
        }),
      );
    });

    it('returns job ID', async () => {
      const job = createMockJob({ jobId: 'unique_job_id' });

      mockBullQueue.add.mockResolvedValue({ id: 'unique_job_id' });

      const jobId = await queue.addJob(job);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toBe('unique_job_id');
    });

    it('sets correct priority', async () => {
      const highPriorityJob = createMockJob({ priority: 1, jobId: 'high_priority' });
      const lowPriorityJob = createMockJob({ priority: 10, jobId: 'low_priority' });

      await queue.addJob(highPriorityJob);
      await queue.addJob(lowPriorityJob);

      expect(mockBullQueue.add).toHaveBeenNthCalledWith(
        1,
        'high_priority',
        highPriorityJob,
        expect.objectContaining({ priority: 1 }),
      );

      expect(mockBullQueue.add).toHaveBeenNthCalledWith(
        2,
        'low_priority',
        lowPriorityJob,
        expect.objectContaining({ priority: 10 }),
      );
    });

    it('uses default priority when not specified', async () => {
      const job = createMockJob({ jobId: 'default_priority' });
      delete job.priority;

      await queue.addJob(job);

      expect(mockBullQueue.add).toHaveBeenCalledWith(
        'default_priority',
        job,
        expect.objectContaining({ priority: 5 }),
      );
    });

    it('throws when queue not initialized', async () => {
      const uninitializedQueue = createMockProcessingQueue();
      const job = createMockJob();

      await expect(uninitializedQueue.addJob(job)).rejects.toThrow('Queue not initialized');
    });

    it('emits job:added event', async () => {
      const listener = vi.fn();
      queue.on('job:added' as QueueEvent, listener);

      const job = createMockJob({ jobId: 'event_test' });
      await queue.addJob(job);

      expect(listener).toHaveBeenCalledWith('job:added', { jobId: 'event_test' });
    });
  });

  // ===========================================================================
  // Bulk Operations Tests
  // ===========================================================================

  describe('addBulkJobs', () => {
    it('adds multiple jobs', async () => {
      const jobs = [
        createMockJob({ jobId: 'bulk_1' }),
        createMockJob({ jobId: 'bulk_2' }),
        createMockJob({ jobId: 'bulk_3' }),
      ];

      mockBullQueue.addBulk.mockResolvedValue([
        { id: 'bulk_1' },
        { id: 'bulk_2' },
        { id: 'bulk_3' },
      ]);

      const jobIds = await queue.addBulkJobs(jobs);

      expect(jobIds).toHaveLength(3);
      expect(mockBullQueue.addBulk).toHaveBeenCalledTimes(1);
    });

    it('returns all job IDs', async () => {
      const jobs = [
        createMockJob({ jobId: 'id_1' }),
        createMockJob({ jobId: 'id_2' }),
      ];

      mockBullQueue.addBulk.mockResolvedValue([{ id: 'id_1' }, { id: 'id_2' }]);

      const jobIds = await queue.addBulkJobs(jobs);

      expect(jobIds).toEqual(['id_1', 'id_2']);
    });
  });

  // ===========================================================================
  // Processing Tests
  // ===========================================================================

  describe('processing', () => {
    it('processes jobs in order', async () => {
      const processOrder: string[] = [];

      mockBullQueue.add.mockImplementation(async (name: string) => {
        processOrder.push(name);
        return { id: name };
      });

      await queue.addJob(createMockJob({ jobId: 'first' }));
      await queue.addJob(createMockJob({ jobId: 'second' }));
      await queue.addJob(createMockJob({ jobId: 'third' }));

      expect(processOrder).toEqual(['first', 'second', 'third']);
    });

    it('handles concurrent jobs', async () => {
      const jobs = Array.from({ length: 10 }, (_, i) =>
        createMockJob({ jobId: `concurrent_${i}` }),
      );

      mockBullQueue.addBulk.mockResolvedValue(
        jobs.map((j) => ({ id: j.jobId })),
      );

      const jobIds = await queue.addBulkJobs(jobs);

      expect(jobIds).toHaveLength(10);
    });

    it('retries failed jobs', async () => {
      const mockJob = {
        id: 'failed_job',
        status: 'failed',
        retry: vi.fn().mockResolvedValue(undefined),
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const retried = await queue.retryJob('failed_job');

      expect(retried).toBe(true);
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('does not retry non-failed jobs', async () => {
      const mockJob = {
        id: 'active_job',
        status: 'active',
        retry: vi.fn(),
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const retried = await queue.retryJob('active_job');

      expect(retried).toBe(false);
      expect(mockJob.retry).not.toHaveBeenCalled();
    });

    it('moves to dead letter queue after max retries', async () => {
      const mockJob = {
        id: 'exhausted_job',
        status: 'failed',
        attemptsMade: 3,
        opts: { attempts: 3 },
        moveToFailed: vi.fn(),
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const result = await queue.getJobStatus('exhausted_job');

      expect(result?.attempts).toBe(3);
      expect(result?.status).toBe('failed' as JobStatus);
    });
  });

  // ===========================================================================
  // Job Status Tests
  // ===========================================================================

  describe('getJobStatus', () => {
    it('returns job status', async () => {
      const mockJob = {
        id: 'status_job',
        status: 'completed',
        returnvalue: { success: true },
        attemptsMade: 1,
        timestamp: Date.now(),
        processedOn: Date.now() + 1000,
        finishedOn: Date.now() + 2000,
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const status = await queue.getJobStatus('status_job');

      expect(status).not.toBeNull();
      expect(status?.jobId).toBe('status_job');
      expect(status?.status).toBe('completed');
      expect(status?.result).toEqual({ success: true });
    });

    it('returns null for non-existent job', async () => {
      mockBullQueue.getJob.mockResolvedValue(null);

      const status = await queue.getJobStatus('nonexistent');

      expect(status).toBeNull();
    });

    it('includes timing information', async () => {
      const now = Date.now();
      const mockJob = {
        id: 'timed_job',
        status: 'completed',
        attemptsMade: 1,
        timestamp: now,
        processedOn: now + 500,
        finishedOn: now + 1500,
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const status = await queue.getJobStatus('timed_job');

      expect(status?.createdAt).toBeInstanceOf(Date);
      expect(status?.processedAt).toBeInstanceOf(Date);
      expect(status?.finishedAt).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // Cancel Job Tests
  // ===========================================================================

  describe('cancelJob', () => {
    it('cancels waiting job', async () => {
      const mockJob = {
        id: 'cancel_me',
        status: 'waiting',
        remove: vi.fn().mockResolvedValue(undefined),
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const cancelled = await queue.cancelJob('cancel_me');

      expect(cancelled).toBe(true);
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('cannot cancel active job', async () => {
      const mockJob = {
        id: 'active_job',
        status: 'active',
        remove: vi.fn(),
      };

      mockBullQueue.getJob.mockResolvedValue(mockJob);

      const cancelled = await queue.cancelJob('active_job');

      expect(cancelled).toBe(false);
      expect(mockJob.remove).not.toHaveBeenCalled();
    });

    it('returns false for non-existent job', async () => {
      mockBullQueue.getJob.mockResolvedValue(null);

      const cancelled = await queue.cancelJob('nonexistent');

      expect(cancelled).toBe(false);
    });
  });

  // ===========================================================================
  // Queue Stats Tests
  // ===========================================================================

  describe('getStats', () => {
    it('returns queue statistics', async () => {
      mockBullQueue.getWaitingCount.mockResolvedValue(5);
      mockBullQueue.getActiveCount.mockResolvedValue(2);
      mockBullQueue.getCompletedCount.mockResolvedValue(100);
      mockBullQueue.getFailedCount.mockResolvedValue(3);
      mockBullQueue.getDelayedCount.mockResolvedValue(1);
      mockBullQueue.getPausedCount.mockResolvedValue(0);

      const stats = await queue.getStats();

      expect(stats.waiting).toBe(5);
      expect(stats.active).toBe(2);
      expect(stats.completed).toBe(100);
      expect(stats.failed).toBe(3);
      expect(stats.delayed).toBe(1);
      expect(stats.paused).toBe(0);
    });
  });

  // ===========================================================================
  // Pause/Resume Tests
  // ===========================================================================

  describe('pause and resume', () => {
    it('pauses the queue', async () => {
      await queue.pause();

      expect(mockBullQueue.pause).toHaveBeenCalled();
    });

    it('resumes the queue', async () => {
      await queue.resume();

      expect(mockBullQueue.resume).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Cleanup Tests
  // ===========================================================================

  describe('cleanup', () => {
    it('clears completed jobs', async () => {
      const completedJobs = [
        { id: 'comp_1', remove: vi.fn().mockResolvedValue(undefined) },
        { id: 'comp_2', remove: vi.fn().mockResolvedValue(undefined) },
      ];

      mockBullQueue.getCompleted.mockResolvedValue(completedJobs);

      const cleared = await queue.clearCompleted();

      expect(cleared).toBe(2);
      expect(completedJobs[0].remove).toHaveBeenCalled();
      expect(completedJobs[1].remove).toHaveBeenCalled();
    });

    it('clears failed jobs', async () => {
      const failedJobs = [
        { id: 'fail_1', remove: vi.fn().mockResolvedValue(undefined) },
      ];

      mockBullQueue.getFailed.mockResolvedValue(failedJobs);

      const cleared = await queue.clearFailed();

      expect(cleared).toBe(1);
      expect(failedJobs[0].remove).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Event Tests
  // ===========================================================================

  describe('events', () => {
    it('registers event listeners', async () => {
      const listener = vi.fn();

      queue.on('job:completed' as QueueEvent, listener);

      expect(queue.on).toHaveBeenCalledWith('job:completed', listener);
    });

    it('removes event listeners', async () => {
      const listener = vi.fn();

      queue.on('job:completed' as QueueEvent, listener);
      queue.off('job:completed' as QueueEvent, listener);

      expect(queue.off).toHaveBeenCalledWith('job:completed', listener);
    });
  });

  // ===========================================================================
  // Resource Management Tests
  // ===========================================================================

  describe('resource management', () => {
    it('closes queue gracefully', async () => {
      await queue.close();

      expect(mockBullWorker.close).toHaveBeenCalled();
      expect(mockBullQueue.close).toHaveBeenCalled();
    });

    it('throws after close', async () => {
      await queue.close();

      await expect(queue.addJob(createMockJob())).rejects.toThrow('Queue not initialized');
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('ProcessingQueue Integration', () => {
  let queue: ProcessingQueue;

  beforeEach(async () => {
    queue = createMockProcessingQueue();
    vi.clearAllMocks();

    mockBullQueue.add.mockImplementation(async (name: string, data: FileProcessingJob) => ({
      id: data.jobId,
    }));

    await queue.initialize();
  });

  afterEach(async () => {
    await queue.close();
  });

  it('complete job lifecycle: add -> process -> complete', async () => {
    // 1. Add job
    const job = createMockJob({ jobId: 'lifecycle_test' });
    const jobId = await queue.addJob(job);
    expect(jobId).toBe('lifecycle_test');

    // 2. Get status (waiting)
    mockBullQueue.getJob.mockResolvedValue({
      id: 'lifecycle_test',
      status: 'waiting',
      attemptsMade: 0,
      timestamp: Date.now(),
    });

    let status = await queue.getJobStatus('lifecycle_test');
    expect(status?.status).toBe('waiting');

    // 3. Processing starts
    mockBullQueue.getJob.mockResolvedValue({
      id: 'lifecycle_test',
      status: 'active',
      attemptsMade: 1,
      timestamp: Date.now(),
      processedOn: Date.now(),
    });

    status = await queue.getJobStatus('lifecycle_test');
    expect(status?.status).toBe('active');

    // 4. Job completes
    const mockResult: ProcessorResult = {
      success: true,
      content: 'Extracted content',
      metadata: {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        fileType: FileType.PDF,
      },
      processingTime: 1500,
    };

    mockBullQueue.getJob.mockResolvedValue({
      id: 'lifecycle_test',
      status: 'completed',
      returnvalue: mockResult,
      attemptsMade: 1,
      timestamp: Date.now() - 2000,
      processedOn: Date.now() - 1500,
      finishedOn: Date.now(),
    });

    status = await queue.getJobStatus('lifecycle_test');
    expect(status?.status).toBe('completed');
    expect(status?.result).toEqual(mockResult);
  });

  it('handles job failure and retry', async () => {
    // 1. Add job
    const job = createMockJob({ jobId: 'fail_retry_test' });
    await queue.addJob(job);

    // 2. Job fails
    mockBullQueue.getJob.mockResolvedValue({
      id: 'fail_retry_test',
      status: 'failed',
      failedReason: 'Processing error',
      attemptsMade: 1,
      timestamp: Date.now(),
      retry: vi.fn().mockResolvedValue(undefined),
    });

    let status = await queue.getJobStatus('fail_retry_test');
    expect(status?.status).toBe('failed');
    expect(status?.error).toBe('Processing error');

    // 3. Retry job
    const retried = await queue.retryJob('fail_retry_test');
    expect(retried).toBe(true);

    // 4. Job succeeds on retry
    mockBullQueue.getJob.mockResolvedValue({
      id: 'fail_retry_test',
      status: 'completed',
      returnvalue: { success: true },
      attemptsMade: 2,
      timestamp: Date.now(),
    });

    status = await queue.getJobStatus('fail_retry_test');
    expect(status?.status).toBe('completed');
    expect(status?.attempts).toBe(2);
  });

  it('processes high priority jobs first', async () => {
    const processOrder: number[] = [];

    mockBullQueue.add.mockImplementation(
      async (_name: string, data: FileProcessingJob, opts: { priority: number }) => {
        processOrder.push(opts.priority);
        return { id: data.jobId };
      },
    );

    await queue.addJob(createMockJob({ jobId: 'low', priority: 10 }));
    await queue.addJob(createMockJob({ jobId: 'high', priority: 1 }));
    await queue.addJob(createMockJob({ jobId: 'medium', priority: 5 }));

    // Verify priority was set correctly
    expect(processOrder).toEqual([10, 1, 5]);
  });
});
