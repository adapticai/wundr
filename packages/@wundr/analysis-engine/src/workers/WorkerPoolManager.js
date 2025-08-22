"use strict";
/**
 * Worker Pool Manager - High-performance concurrency with 30+ workers
 * Intelligent task scheduling and resource-aware parallelization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerPoolManager = void 0;
const tslib_1 = require("tslib");
const worker_threads_1 = require("worker_threads");
const events_1 = require("events");
const os = tslib_1.__importStar(require("os"));
const path = tslib_1.__importStar(require("path"));
/**
 * High-performance worker pool with intelligent task distribution
 */
class WorkerPoolManager extends events_1.EventEmitter {
    config;
    workers = new Map();
    taskQueue = [];
    activeTasks = new Map();
    completedTasks = [];
    metrics;
    metricsInterval = null;
    scalingInterval = null;
    isShuttingDown = false;
    constructor(config = {}) {
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
                memory: 0.85 // 85% memory threshold
            },
            workerScript: path.join(__dirname, 'analysis-worker.js'),
            ...config
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
            resourceUsage: { cpu: 0, memory: 0 }
        };
        this.initializePool();
        this.startMetricsCollection();
        this.startAutoScaling();
    }
    /**
     * Initialize worker pool with minimum workers
     */
    async initializePool() {
        for (let i = 0; i < this.config.minWorkers; i++) {
            await this.createWorker();
        }
        this.emit('pool-initialized', {
            minWorkers: this.config.minWorkers,
            maxWorkers: this.config.maxWorkers
        });
    }
    /**
     * Submit a task to the worker pool
     */
    async submitTask(task) {
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
                submittedAt: Date.now()
            };
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
    async submitTasks(tasks) {
        const promises = tasks.map(task => this.submitTask(task));
        return Promise.all(promises);
    }
    /**
     * Process batch of tasks with intelligent distribution
     */
    async processBatch(tasks, batchSize) {
        const actualBatchSize = batchSize || Math.min(tasks.length, this.workers.size * 2);
        const results = [];
        for (let i = 0; i < tasks.length; i += actualBatchSize) {
            const batch = tasks.slice(i, i + actualBatchSize);
            const batchResults = await this.submitTasks(batch);
            results.push(...batchResults);
            // Emit batch progress
            this.emit('batch-progress', {
                completed: i + batch.length,
                total: tasks.length,
                progress: ((i + batch.length) / tasks.length) * 100
            });
        }
        return results;
    }
    /**
     * Insert task into queue based on priority
     */
    insertTaskByPriority(task) {
        const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
        const taskPriority = priorities[task.priority] || 1;
        let insertIndex = this.taskQueue.length;
        for (let i = 0; i < this.taskQueue.length; i++) {
            const queuedPriority = priorities[this.taskQueue[i].priority] || 1;
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
    async processNextTask() {
        if (this.taskQueue.length === 0)
            return;
        const availableWorker = this.getAvailableWorker();
        if (!availableWorker) {
            // Try to scale up if needed
            if (this.config.enableAutoScaling) {
                await this.scaleUp();
            }
            return;
        }
        const task = this.taskQueue.shift();
        await this.executeTask(availableWorker, task);
    }
    /**
     * Execute task on specific worker
     */
    async executeTask(workerInfo, task) {
        const startTime = Date.now();
        workerInfo.state = 'busy';
        workerInfo.currentTask = task.id;
        workerInfo.lastActivity = startTime;
        this.activeTasks.set(task.id, {
            task,
            workerId: workerInfo.id,
            startTime
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
                    metadata: task.metadata
                }
            });
            // Wait for result
            const result = await this.waitForTaskResult(task.id, timeoutHandle);
            // Handle successful completion
            this.handleTaskCompletion(task, result, startTime);
            task.resolve(result);
        }
        catch (error) {
            // Handle task failure
            this.handleTaskFailure(task, error, startTime);
            // Retry if configured
            if (task.retryCount < (task.maxRetries || 0)) {
                task.retryCount = (task.retryCount || 0) + 1;
                this.insertTaskByPriority(task);
                this.processNextTask();
            }
            else {
                task.reject(error);
            }
        }
        finally {
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
    waitForTaskResult(taskId, timeoutHandle) {
        return new Promise((resolve, reject) => {
            const handler = (result) => {
                if (result.taskId === taskId) {
                    this.removeListener('task-result', handler);
                    clearTimeout(timeoutHandle);
                    if (result.success) {
                        resolve(result);
                    }
                    else {
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
    handleTaskCompletion(task, result, startTime) {
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
    handleTaskFailure(task, error, startTime) {
        const executionTime = Date.now() - startTime;
        this.activeTasks.delete(task.id);
        this.metrics.failedTasks++;
        this.emit('task-failed', { task, error, executionTime });
    }
    /**
     * Handle task timeout
     */
    handleTaskTimeout(taskId) {
        const activeTask = this.activeTasks.get(taskId);
        if (!activeTask)
            return;
        const workerInfo = this.workers.get(activeTask.workerId);
        if (!workerInfo)
            return;
        // Terminate worker due to timeout
        this.terminateWorker(workerInfo.id, 'Task timeout');
        this.metrics.failedTasks++;
        this.emit('task-timeout', { taskId, workerId: activeTask.workerId });
    }
    /**
     * Get available worker
     */
    getAvailableWorker() {
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
    releaseWorker(workerInfo) {
        workerInfo.state = 'idle';
        workerInfo.currentTask = null;
        workerInfo.lastActivity = Date.now();
        workerInfo.tasksCompleted++;
    }
    /**
     * Create new worker
     */
    async createWorker() {
        if (this.workers.size >= this.config.maxWorkers) {
            throw new Error('Maximum worker limit reached');
        }
        const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        try {
            const worker = new worker_threads_1.Worker(this.config.workerScript, {
                workerData: { workerId }
            });
            const { port1, port2 } = new worker_threads_1.MessageChannel();
            const workerInfo = {
                id: workerId,
                worker,
                state: 'idle',
                currentTask: null,
                tasksCompleted: 0,
                totalExecutionTime: 0,
                lastActivity: Date.now(),
                port: port1
            };
            // Set up worker message handling
            port1.on('message', (message) => {
                this.handleWorkerMessage(workerId, message);
            });
            worker.on('error', (error) => {
                this.handleWorkerError(workerId, error);
            });
            worker.on('exit', (code) => {
                this.handleWorkerExit(workerId, code);
            });
            // Initialize worker
            worker.postMessage({ type: 'init', port: port2 }, [port2]);
            this.workers.set(workerId, workerInfo);
            this.metrics.idleWorkers++;
            this.emit('worker-created', { workerId, totalWorkers: this.workers.size });
            return workerInfo;
        }
        catch (error) {
            this.emit('worker-creation-error', { workerId, error });
            throw error;
        }
    }
    /**
     * Handle worker message
     */
    handleWorkerMessage(workerId, message) {
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
    handleWorkerError(workerId, error) {
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
    handleWorkerExit(workerId, code) {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo)
            return;
        this.workers.delete(workerId);
        if (workerInfo.state === 'idle') {
            this.metrics.idleWorkers--;
        }
        else {
            this.metrics.activeWorkers--;
        }
        this.emit('worker-exited', { workerId, code, totalWorkers: this.workers.size });
    }
    /**
     * Terminate worker
     */
    terminateWorker(workerId, reason) {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo)
            return;
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
    async scaleUp() {
        if (this.workers.size >= this.config.maxWorkers)
            return;
        const queuePressure = this.taskQueue.length / Math.max(1, this.workers.size);
        const resourceUsage = await this.getResourceUsage();
        // Scale up conditions
        const shouldScale = (queuePressure > 2 && // More than 2 tasks per worker
            resourceUsage.cpu < this.config.resourceThresholds.cpu &&
            resourceUsage.memory < this.config.resourceThresholds.memory);
        if (shouldScale) {
            const newWorkers = Math.min(Math.ceil(queuePressure / 2), this.config.maxWorkers - this.workers.size);
            for (let i = 0; i < newWorkers; i++) {
                try {
                    await this.createWorker();
                }
                catch (error) {
                    this.emit('scale-up-error', { error, attempt: i + 1 });
                    break;
                }
            }
            this.emit('scaled-up', {
                newWorkers,
                totalWorkers: this.workers.size,
                reason: 'queue-pressure'
            });
        }
    }
    /**
     * Scale down idle workers
     */
    async scaleDown() {
        const now = Date.now();
        const idleWorkers = Array.from(this.workers.values())
            .filter(w => w.state === 'idle' &&
            (now - w.lastActivity) > this.config.idleTimeout);
        const excessWorkers = Math.max(0, this.workers.size - this.config.minWorkers);
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
                reason: 'idle-timeout'
            });
        }
    }
    /**
     * Start auto-scaling monitoring
     */
    startAutoScaling() {
        if (!this.config.enableAutoScaling)
            return;
        this.scalingInterval = setInterval(async () => {
            try {
                await this.scaleDown();
                if (this.taskQueue.length > 0) {
                    await this.scaleUp();
                }
            }
            catch (error) {
                this.emit('scaling-error', error);
            }
        }, 10000); // Check every 10 seconds
    }
    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        this.metricsInterval = setInterval(async () => {
            await this.updateMetrics();
            this.emit('metrics-updated', this.metrics);
        }, 5000); // Update every 5 seconds
    }
    /**
     * Update metrics
     */
    async updateMetrics() {
        this.metrics.activeWorkers = Array.from(this.workers.values())
            .filter(w => w.state === 'busy').length;
        this.metrics.idleWorkers = Array.from(this.workers.values())
            .filter(w => w.state === 'idle').length;
        this.metrics.queueSize = this.taskQueue.length;
        // Calculate throughput (tasks per second)
        const completedInLastMinute = this.completedTasks.filter(task => Date.now() - task.completedAt < 60000).length;
        this.metrics.throughput = completedInLastMinute / 60;
        // Calculate error rate
        this.metrics.errorRate = this.metrics.totalTasks > 0
            ? this.metrics.failedTasks / this.metrics.totalTasks
            : 0;
        // Update resource usage
        this.metrics.resourceUsage = await this.getResourceUsage();
    }
    /**
     * Get current resource usage
     */
    async getResourceUsage() {
        const memUsage = process.memoryUsage();
        const memoryPercent = memUsage.heapUsed / memUsage.heapTotal;
        // Simple CPU estimation based on active workers
        const cpuPercent = this.metrics.activeWorkers / os.cpus().length;
        return {
            cpu: Math.min(1, cpuPercent),
            memory: Math.min(1, memoryPercent)
        };
    }
    /**
     * Update average execution time
     */
    updateAverageExecutionTime(executionTime) {
        const total = this.metrics.averageExecutionTime * this.metrics.completedTasks;
        this.metrics.averageExecutionTime = (total + executionTime) / (this.metrics.completedTasks + 1);
    }
    /**
     * Get current metrics
     */
    getMetrics() {
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
                lastActivity: w.lastActivity
            })),
            queue: {
                size: this.taskQueue.length,
                tasks: this.taskQueue.map(t => ({
                    id: t.id,
                    type: t.type,
                    priority: t.priority
                }))
            },
            activeTasks: Array.from(this.activeTasks.values()).map(t => ({
                taskId: t.task.id,
                workerId: t.workerId,
                duration: Date.now() - t.startTime
            }))
        };
    }
    /**
     * Shutdown worker pool gracefully
     */
    async shutdown(timeout = 30000) {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        this.emit('shutdown-started');
        // Stop auto-scaling and metrics
        if (this.scalingInterval) {
            clearInterval(this.scalingInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        // Wait for active tasks to complete or timeout
        const shutdownPromise = new Promise((resolve) => {
            const checkActiveTasks = () => {
                if (this.activeTasks.size === 0) {
                    resolve();
                }
                else {
                    setTimeout(checkActiveTasks, 1000);
                }
            };
            checkActiveTasks();
        });
        try {
            await Promise.race([
                shutdownPromise,
                new Promise(resolve => setTimeout(resolve, timeout))
            ]);
        }
        catch (error) {
            this.emit('shutdown-timeout', error);
        }
        // Terminate all workers
        const terminationPromises = Array.from(this.workers.keys()).map(workerId => this.terminateWorker(workerId, 'Pool shutdown'));
        await Promise.all(terminationPromises);
        this.emit('shutdown-complete');
    }
}
exports.WorkerPoolManager = WorkerPoolManager;
//# sourceMappingURL=WorkerPoolManager.js.map