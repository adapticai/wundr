/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Worker Pool Manager - High-performance concurrency with 30+ workers
 * Intelligent task scheduling and resource-aware parallelization
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import { Worker, MessageChannel } from 'worker_threads';

import type { MessagePort } from 'worker_threads';

export interface WorkerTask<T = any> {
  id: string;
  type: string;
  data: T;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface WorkerResult<T = any> {
  taskId: string;
  success: boolean;
  data?: T;
  error?: Error;
  executionTime: number;
  workerId: string;
}

export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  taskTimeout: number;
  maxQueueSize: number;
  enableAutoScaling: boolean;
  resourceThresholds: {
    cpu: number;
    memory: number;
  };
  workerScript: string;
}

export interface WorkerMetrics {
  activeWorkers: number;
  idleWorkers: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  queueSize: number;
  throughput: number;
  errorRate: number;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
}

interface WorkerInfo {
  id: string;
  worker: Worker;
  state: 'idle' | 'busy' | 'terminating';
  currentTask: string | null;
  tasksCompleted: number;
  totalExecutionTime: number;
  lastActivity: number;
  port: MessagePort;
}

/**
 * High-performance worker pool with intelligent task distribution
 */
export class WorkerPoolManager extends EventEmitter {
  private config: WorkerPoolConfig;
  private workers = new Map<string, WorkerInfo>();
  private taskQueue: WorkerTask[] = [];
  private activeTasks = new Map<
    string,
    { task: WorkerTask; workerId: string; startTime: number }
  >();
  private completedTasks: WorkerResult[] = [];
  private metrics: WorkerMetrics;
  private metricsInterval: NodeJS.Timer | null = null;
  private scalingInterval: NodeJS.Timer | null = null;
  private isShuttingDown = false;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    super();

    const cpuCount = os.cpus().length;

    this.config = {
      minWorkers: Math.max(2, Math.floor(cpuCount * 0.5)),
      maxWorkers: Math.max(30, cpuCount * 4), // Target 30+ workers
      idleTimeout: 60000, // 1 minute
      taskTimeout: 300000, // 5 minutes
      maxQueueSize: 10000,
      enableAutoScaling: true,
      resourceThresholds: {
        cpu: 0.8, // 80% CPU threshold
        memory: 0.85, // 85% memory threshold
      },
      workerScript: path.join(__dirname, 'analysis-worker.js'),
      ...config,
    };

    this.metrics = {
      activeWorkers: 0,
      idleWorkers: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      queueSize: 0,
      throughput: 0,
      errorRate: 0,
      resourceUsage: { cpu: 0, memory: 0 },
    };

    this.initializePool();
    this.startMetricsCollection();
    this.startAutoScaling();
  }

  /**
   * Initialize worker pool with minimum workers
   */
  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.createWorker();
    }

    this.emit('pool-initialized', {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
    });
  }

  /**
   * Submit a task to the worker pool
   */
  async submitTask<T, R>(task: WorkerTask<T>): Promise<WorkerResult<R>> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    if (this.taskQueue.length >= this.config.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    return new Promise((resolve, reject) => {
      const taskWithCallback = {
        ...task,
        resolve,
        reject,
        submittedAt: Date.now(),
      } as any;

      // Insert task based on priority
      this.insertTaskByPriority(taskWithCallback);

      this.metrics.totalTasks++;
      this.metrics.queueSize = this.taskQueue.length;

      this.emit('task-queued', task);

      // Try to process immediately
      this.processNextTask();
    });
  }

  /**
   * Submit multiple tasks concurrently
   */
  async submitTasks<T, R>(tasks: WorkerTask<T>[]): Promise<WorkerResult<R>[]> {
    const promises = tasks.map(task => this.submitTask<T, R>(task));
    return Promise.all(promises);
  }

  /**
   * Process batch of tasks with intelligent distribution
   */
  async processBatch<T, R>(
    tasks: WorkerTask<T>[],
    batchSize?: number
  ): Promise<WorkerResult<R>[]> {
    const actualBatchSize =
      batchSize || Math.min(tasks.length, this.workers.size * 2);

    const results: WorkerResult<R>[] = [];

    for (let i = 0; i < tasks.length; i += actualBatchSize) {
      const batch = tasks.slice(i, i + actualBatchSize);
      const batchResults = await this.submitTasks<T, R>(batch);
      results.push(...batchResults);

      // Emit batch progress
      this.emit('batch-progress', {
        completed: i + batch.length,
        total: tasks.length,
        progress: ((i + batch.length) / tasks.length) * 100,
      });
    }

    return results;
  }

  /**
   * Insert task into queue based on priority
   */
  private insertTaskByPriority(task: any): void {
    const priorities: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    const taskPriority = priorities[task.priority as string] || 1;

    let insertIndex = this.taskQueue.length;

    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedPriority =
        priorities[(this.taskQueue[i] as any).priority as string] || 1;
      if (taskPriority > queuedPriority) {
        insertIndex = i;
        break;
      }
    }

    this.taskQueue.splice(insertIndex, 0, task);
  }

  /**
   * Process next task from queue
   */
  private async processNextTask(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      // Try to scale up if needed
      if (this.config.enableAutoScaling) {
        await this.scaleUp();
      }
      return;
    }

    const task = this.taskQueue.shift()!;
    await this.executeTask(availableWorker, task as any);
  }

  /**
   * Execute task on specific worker
   */
  private async executeTask(workerInfo: WorkerInfo, task: any): Promise<void> {
    const startTime = Date.now();

    workerInfo.state = 'busy';
    workerInfo.currentTask = task.id;
    workerInfo.lastActivity = startTime;

    this.activeTasks.set(task.id, {
      task,
      workerId: workerInfo.id,
      startTime,
    });

    // Set up timeout
    const timeout = task.timeout || this.config.taskTimeout;
    const timeoutHandle = setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, timeout);

    try {
      // Send task to worker
      workerInfo.port.postMessage({
        type: 'execute-task',
        task: {
          id: task.id,
          type: task.type,
          data: task.data,
          metadata: task.metadata,
        },
      });

      // Wait for result
      const result = await this.waitForTaskResult(task.id, timeoutHandle);

      // Handle successful completion
      this.handleTaskCompletion(task, result, startTime);
      task.resolve(result);
    } catch (error) {
      // Handle task failure
      this.handleTaskFailure(task, error as Error, startTime);

      // Retry if configured
      if (task.retryCount < (task.maxRetries || 0)) {
        task.retryCount = (task.retryCount || 0) + 1;
        this.insertTaskByPriority(task);
        this.processNextTask();
      } else {
        task.reject(error);
      }
    } finally {
      clearTimeout(timeoutHandle);
      this.releaseWorker(workerInfo);
      this.metrics.queueSize = this.taskQueue.length;

      // Process next task
      setImmediate(() => this.processNextTask());
    }
  }

  /**
   * Wait for task result from worker
   */
  private waitForTaskResult(
    taskId: string,
    timeoutHandle: NodeJS.Timeout
  ): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const handler = (result: WorkerResult) => {
        if (result.taskId === taskId) {
          this.removeListener('task-result', handler);
          clearTimeout(timeoutHandle);

          if (result.success) {
            resolve(result);
          } else {
            reject(result.error || new Error('Task failed'));
          }
        }
      };

      this.on('task-result', handler);
    });
  }

  /**
   * Handle task completion
   */
  private handleTaskCompletion(
    task: any,
    result: WorkerResult,
    startTime: number
  ): void {
    const executionTime = Date.now() - startTime;

    this.activeTasks.delete(task.id);
    this.completedTasks.push(result);

    // Update metrics
    this.metrics.completedTasks++;
    this.updateAverageExecutionTime(executionTime);

    this.emit('task-completed', { task, result, executionTime });
  }

  /**
   * Handle task failure
   */
  private handleTaskFailure(task: any, error: Error, startTime: number): void {
    const executionTime = Date.now() - startTime;

    this.activeTasks.delete(task.id);
    this.metrics.failedTasks++;

    this.emit('task-failed', { task, error, executionTime });
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(taskId: string): void {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask) {
      return;
    }

    const workerInfo = this.workers.get(activeTask.workerId);
    if (!workerInfo) {
      return;
    }

    // Terminate worker due to timeout
    this.terminateWorker(workerInfo.id, 'Task timeout');

    this.metrics.failedTasks++;
    this.emit('task-timeout', { taskId, workerId: activeTask.workerId });
  }

  /**
   * Get available worker
   */
  private getAvailableWorker(): WorkerInfo | null {
    for (const worker of this.workers.values()) {
      if (worker.state === 'idle') {
        return worker;
      }
    }
    return null;
  }

  /**
   * Release worker back to idle state
   */
  private releaseWorker(workerInfo: WorkerInfo): void {
    workerInfo.state = 'idle';
    workerInfo.currentTask = null;
    workerInfo.lastActivity = Date.now();
    workerInfo.tasksCompleted++;
  }

  /**
   * Create new worker
   */
  private async createWorker(): Promise<WorkerInfo> {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new Error('Maximum worker limit reached');
    }

    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const worker = new Worker(this.config.workerScript, {
        workerData: { workerId },
      });

      const { port1, port2 } = new MessageChannel();

      const workerInfo: WorkerInfo = {
        id: workerId,
        worker,
        state: 'idle',
        currentTask: null,
        tasksCompleted: 0,
        totalExecutionTime: 0,
        lastActivity: Date.now(),
        port: port1,
      };

      // Set up worker message handling
      port1.on('message', message => {
        this.handleWorkerMessage(workerId, message);
      });

      worker.on('error', error => {
        this.handleWorkerError(workerId, error);
      });

      worker.on('exit', code => {
        this.handleWorkerExit(workerId, code);
      });

      // Initialize worker
      worker.postMessage({ type: 'init', port: port2 }, [port2]);

      this.workers.set(workerId, workerInfo);
      this.metrics.idleWorkers++;

      this.emit('worker-created', {
        workerId,
        totalWorkers: this.workers.size,
      });

      return workerInfo;
    } catch (error) {
      this.emit('worker-creation-error', { workerId, error });
      throw error;
    }
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(workerId: string, message: any): void {
    switch (message.type) {
      case 'task-result':
        this.emit('task-result', message.result);
        break;
      case 'task-progress':
        this.emit('task-progress', message.progress);
        break;
      case 'worker-ready':
        this.emit('worker-ready', { workerId });
        break;
      default:
        this.emit('worker-message', { workerId, message });
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, error: Error): void {
    this.emit('worker-error', { workerId, error });

    // Terminate and replace worker
    this.terminateWorker(workerId, 'Worker error');

    // Create replacement if below minimum
    if (this.workers.size < this.config.minWorkers && !this.isShuttingDown) {
      this.createWorker().catch(err => {
        this.emit('worker-replacement-error', { workerId, error: err });
      });
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string, code: number): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) {
      return;
    }

    this.workers.delete(workerId);

    if (workerInfo.state === 'idle') {
      this.metrics.idleWorkers--;
    } else {
      this.metrics.activeWorkers--;
    }

    this.emit('worker-exited', {
      workerId,
      code,
      totalWorkers: this.workers.size,
    });
  }

  /**
   * Terminate worker
   */
  private terminateWorker(workerId: string, reason: string): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) {
      return;
    }

    workerInfo.state = 'terminating';

    // Handle active task if any
    if (workerInfo.currentTask) {
      const activeTask = this.activeTasks.get(workerInfo.currentTask);
      if (activeTask) {
        this.activeTasks.delete(workerInfo.currentTask);
        // Re-queue the task
        this.insertTaskByPriority(activeTask.task);
      }
    }

    workerInfo.worker.terminate().then(() => {
      this.emit('worker-terminated', { workerId, reason });
    });
  }

  /**
   * Auto-scaling based on queue size and resource usage
   */
  private async scaleUp(): Promise<void> {
    if (this.workers.size >= this.config.maxWorkers) {
      return;
    }

    const queuePressure =
      this.taskQueue.length / Math.max(1, this.workers.size);
    const resourceUsage = await this.getResourceUsage();

    // Scale up conditions
    const shouldScale =
      queuePressure > 2 && // More than 2 tasks per worker
      resourceUsage.cpu < this.config.resourceThresholds.cpu &&
      resourceUsage.memory < this.config.resourceThresholds.memory;

    if (shouldScale) {
      const newWorkers = Math.min(
        Math.ceil(queuePressure / 2),
        this.config.maxWorkers - this.workers.size
      );

      for (let i = 0; i < newWorkers; i++) {
        try {
          await this.createWorker();
        } catch (error) {
          this.emit('scale-up-error', { error, attempt: i + 1 });
          break;
        }
      }

      this.emit('scaled-up', {
        newWorkers,
        totalWorkers: this.workers.size,
        reason: 'queue-pressure',
      });
    }
  }

  /**
   * Scale down idle workers
   */
  private async scaleDown(): Promise<void> {
    const now = Date.now();
    const idleWorkers = Array.from(this.workers.values()).filter(
      w => w.state === 'idle' && now - w.lastActivity > this.config.idleTimeout
    );

    const excessWorkers = Math.max(
      0,
      this.workers.size - this.config.minWorkers
    );
    const workersToTerminate = Math.min(idleWorkers.length, excessWorkers);

    if (workersToTerminate > 0) {
      // Terminate oldest idle workers
      idleWorkers
        .sort((a, b) => a.lastActivity - b.lastActivity)
        .slice(0, workersToTerminate)
        .forEach(worker => {
          this.terminateWorker(worker.id, 'Scale down - idle timeout');
        });

      this.emit('scaled-down', {
        terminatedWorkers: workersToTerminate,
        totalWorkers: this.workers.size,
        reason: 'idle-timeout',
      });
    }
  }

  /**
   * Start auto-scaling monitoring
   */
  private startAutoScaling(): void {
    if (!this.config.enableAutoScaling) {
      return;
    }

    this.scalingInterval = setInterval(async () => {
      try {
        await this.scaleDown();

        if (this.taskQueue.length > 0) {
          await this.scaleUp();
        }
      } catch (error) {
        this.emit('scaling-error', error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      await this.updateMetrics();
      this.emit('metrics-updated', this.metrics);
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    this.metrics.activeWorkers = Array.from(this.workers.values()).filter(
      w => w.state === 'busy'
    ).length;

    this.metrics.idleWorkers = Array.from(this.workers.values()).filter(
      w => w.state === 'idle'
    ).length;

    this.metrics.queueSize = this.taskQueue.length;

    // Calculate throughput (tasks per second)
    const completedInLastMinute = this.completedTasks.filter(
      task => Date.now() - (task as any).completedAt < 60000
    ).length;
    this.metrics.throughput = completedInLastMinute / 60;

    // Calculate error rate
    this.metrics.errorRate =
      this.metrics.totalTasks > 0
        ? this.metrics.failedTasks / this.metrics.totalTasks
        : 0;

    // Update resource usage
    this.metrics.resourceUsage = await this.getResourceUsage();
  }

  /**
   * Get current resource usage
   */
  private async getResourceUsage(): Promise<{ cpu: number; memory: number }> {
    const memUsage = process.memoryUsage();
    const memoryPercent = memUsage.heapUsed / memUsage.heapTotal;

    // Simple CPU estimation based on active workers
    const cpuPercent = this.metrics.activeWorkers / os.cpus().length;

    return {
      cpu: Math.min(1, cpuPercent),
      memory: Math.min(1, memoryPercent),
    };
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const total =
      this.metrics.averageExecutionTime * this.metrics.completedTasks;
    this.metrics.averageExecutionTime =
      (total + executionTime) / (this.metrics.completedTasks + 1);
  }

  /**
   * Get current metrics
   */
  getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get worker pool status
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      workers: Array.from(this.workers.values()).map(w => ({
        id: w.id,
        state: w.state,
        currentTask: w.currentTask,
        tasksCompleted: w.tasksCompleted,
        lastActivity: w.lastActivity,
      })),
      queue: {
        size: this.taskQueue.length,
        tasks: this.taskQueue.map(t => ({
          id: t.id,
          type: t.type,
          priority: t.priority,
        })),
      },
      activeTasks: Array.from(this.activeTasks.values()).map(t => ({
        taskId: t.task.id,
        workerId: t.workerId,
        duration: Date.now() - t.startTime,
      })),
    };
  }

  /**
   * Shutdown worker pool gracefully
   */
  async shutdown(timeout: number = 30000): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('shutdown-started');

    // Stop auto-scaling and metrics
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval as any);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval as any);
    }

    // Wait for active tasks to complete or timeout
    const shutdownPromise = new Promise<void>(resolve => {
      const checkActiveTasks = () => {
        if (this.activeTasks.size === 0) {
          resolve();
        } else {
          setTimeout(checkActiveTasks, 1000);
        }
      };
      checkActiveTasks();
    });

    try {
      await Promise.race([
        shutdownPromise,
        new Promise(resolve => setTimeout(resolve, timeout)),
      ]);
    } catch (error) {
      this.emit('shutdown-timeout', error);
    }

    // Terminate all workers
    const terminationPromises = Array.from(this.workers.keys()).map(workerId =>
      this.terminateWorker(workerId, 'Pool shutdown')
    );

    await Promise.all(terminationPromises);

    this.emit('shutdown-complete');
  }
}
