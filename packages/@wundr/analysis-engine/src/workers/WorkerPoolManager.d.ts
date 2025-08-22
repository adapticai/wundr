/**
 * Worker Pool Manager - High-performance concurrency with 30+ workers
 * Intelligent task scheduling and resource-aware parallelization
 */
import { EventEmitter } from 'events';
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
/**
 * High-performance worker pool with intelligent task distribution
 */
export declare class WorkerPoolManager extends EventEmitter {
    private config;
    private workers;
    private taskQueue;
    private activeTasks;
    private completedTasks;
    private metrics;
    private metricsInterval;
    private scalingInterval;
    private isShuttingDown;
    constructor(config?: Partial<WorkerPoolConfig>);
    /**
     * Initialize worker pool with minimum workers
     */
    private initializePool;
    /**
     * Submit a task to the worker pool
     */
    submitTask<T, R>(task: WorkerTask<T>): Promise<WorkerResult<R>>;
    /**
     * Submit multiple tasks concurrently
     */
    submitTasks<T, R>(tasks: WorkerTask<T>[]): Promise<WorkerResult<R>[]>;
    /**
     * Process batch of tasks with intelligent distribution
     */
    processBatch<T, R>(tasks: WorkerTask<T>[], batchSize?: number): Promise<WorkerResult<R>[]>;
    /**
     * Insert task into queue based on priority
     */
    private insertTaskByPriority;
    /**
     * Process next task from queue
     */
    private processNextTask;
    /**
     * Execute task on specific worker
     */
    private executeTask;
    /**
     * Wait for task result from worker
     */
    private waitForTaskResult;
    /**
     * Handle task completion
     */
    private handleTaskCompletion;
    /**
     * Handle task failure
     */
    private handleTaskFailure;
    /**
     * Handle task timeout
     */
    private handleTaskTimeout;
    /**
     * Get available worker
     */
    private getAvailableWorker;
    /**
     * Release worker back to idle state
     */
    private releaseWorker;
    /**
     * Create new worker
     */
    private createWorker;
    /**
     * Handle worker message
     */
    private handleWorkerMessage;
    /**
     * Handle worker error
     */
    private handleWorkerError;
    /**
     * Handle worker exit
     */
    private handleWorkerExit;
    /**
     * Terminate worker
     */
    private terminateWorker;
    /**
     * Auto-scaling based on queue size and resource usage
     */
    private scaleUp;
    /**
     * Scale down idle workers
     */
    private scaleDown;
    /**
     * Start auto-scaling monitoring
     */
    private startAutoScaling;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Update metrics
     */
    private updateMetrics;
    /**
     * Get current resource usage
     */
    private getResourceUsage;
    /**
     * Update average execution time
     */
    private updateAverageExecutionTime;
    /**
     * Get current metrics
     */
    getMetrics(): WorkerMetrics;
    /**
     * Get worker pool status
     */
    getStatus(): {
        isShuttingDown: boolean;
        workers: {
            id: string;
            state: "idle" | "busy" | "terminating";
            currentTask: string | null;
            tasksCompleted: number;
            lastActivity: number;
        }[];
        queue: {
            size: number;
            tasks: {
                id: string;
                type: string;
                priority: "critical" | "high" | "medium" | "low";
            }[];
        };
        activeTasks: {
            taskId: string;
            workerId: string;
            duration: number;
        }[];
    };
    /**
     * Shutdown worker pool gracefully
     */
    shutdown(timeout?: number): Promise<void>;
}
//# sourceMappingURL=WorkerPoolManager.d.ts.map