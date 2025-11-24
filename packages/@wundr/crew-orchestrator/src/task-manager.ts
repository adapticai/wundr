/**
 * @wundr/crew-orchestrator - Task Manager
 *
 * Handles task assignment, tracking, dependency resolution, and execution scheduling.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { CrewError, CrewErrorCode, TaskSchema } from './types';

import type {
  Task,
  TaskInput,
  TaskResult,
  TaskStatus,
  TaskPriority,
  CrewMember,
  ExecutionContext,
  CrewEvent,
} from './types';

/**
 * Task queue item with priority weighting
 */
interface QueuedTask {
  readonly task: Task;
  readonly priority: number;
  readonly queuedAt: Date;
}

/**
 * Task execution record for tracking
 */
interface TaskExecution {
  readonly taskId: string;
  readonly memberId: string;
  readonly startedAt: Date;
  completedAt?: Date;
  result?: TaskResult;
  error?: Error;
}

/**
 * Options for task manager configuration
 */
export interface TaskManagerOptions {
  readonly maxConcurrentTasks?: number;
  readonly defaultTimeout?: number;
  readonly retryDelay?: number;
  readonly priorityWeights?: {
    readonly critical?: number;
    readonly high?: number;
    readonly medium?: number;
    readonly low?: number;
  };
}

/**
 * TaskManager - Manages task assignment, scheduling, and tracking
 *
 * @example
 * ```typescript
 * const manager = new TaskManager({ maxConcurrentTasks: 5 });
 * await manager.initialize();
 *
 * const task = manager.createTask({
 *   title: 'Research API',
 *   description: 'Research the target API',
 *   expectedOutput: 'API documentation summary',
 *   priority: 'high',
 * });
 *
 * const member = await manager.assignTask(task.id, crewMembers);
 * ```
 */
export class TaskManager extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private taskQueue: QueuedTask[] = [];
  private activeExecutions: Map<string, TaskExecution> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private readonly options: Required<TaskManagerOptions>;

  /**
   * Creates a new TaskManager instance
   *
   * @param options - Configuration options for the task manager
   */
  constructor(options: TaskManagerOptions = {}) {
    super();
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks ?? 10,
      defaultTimeout: options.defaultTimeout ?? 300000, // 5 minutes
      retryDelay: options.retryDelay ?? 1000,
      priorityWeights: {
        critical: options.priorityWeights?.critical ?? 100,
        high: options.priorityWeights?.high ?? 75,
        medium: options.priorityWeights?.medium ?? 50,
        low: options.priorityWeights?.low ?? 25,
      },
    };
  }

  /**
   * Initializes the task manager
   *
   * @returns Promise resolving when initialization is complete
   */
  async initialize(): Promise<void> {
    this.tasks.clear();
    this.taskQueue = [];
    this.activeExecutions.clear();
    this.completedTasks.clear();
    this.emit('initialized');
  }

  /**
   * Creates a new task with the given configuration
   *
   * @param input - Task configuration input
   * @returns The created task
   * @throws {CrewError} If task configuration is invalid
   */
  createTask(input: TaskInput): Task {
    const now = new Date();
    const taskData = {
      id: input.id ?? uuidv4(),
      title: input.title,
      description: input.description,
      expectedOutput: input.expectedOutput,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'pending',
      assignedTo: input.assignedTo,
      delegatedFrom: input.delegatedFrom,
      dependencies: input.dependencies ?? [],
      context: input.context ?? {},
      tools: input.tools ?? [],
      asyncExecution: input.asyncExecution ?? false,
      humanInput: input.humanInput ?? false,
      outputFile: input.outputFile,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      maxRetries: input.maxRetries ?? 3,
      retryCount: input.retryCount ?? 0,
      timeout: input.timeout ?? this.options.defaultTimeout,
    };

    const parseResult = TaskSchema.safeParse(taskData);
    if (!parseResult.success) {
      throw new CrewError(
        CrewErrorCode.INVALID_CONFIG,
        `Invalid task configuration: ${parseResult.error.message}`,
        { validationErrors: parseResult.error.errors },
      );
    }

    const task = parseResult.data;
    this.tasks.set(task.id, task);
    this.enqueueTask(task);

    this.emitEvent('task:started', { taskId: task.id, task });
    return task;
  }

  /**
   * Gets a task by ID
   *
   * @param taskId - The task ID to look up
   * @returns The task or undefined if not found
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Gets all tasks
   *
   * @returns Array of all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Gets tasks by status
   *
   * @param status - The status to filter by
   * @returns Array of tasks with the given status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(
      task => task.status === status,
    );
  }

  /**
   * Updates a task's status and emits appropriate events
   *
   * @param taskId - The task ID to update
   * @param status - The new status
   * @param additionalData - Additional data to merge into the task
   * @returns The updated task
   * @throws {CrewError} If task is not found
   */
  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    additionalData: Partial<Task> = {},
  ): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new CrewError(
        CrewErrorCode.TASK_NOT_FOUND,
        `Task ${taskId} not found`,
      );
    }

    const updatedTask: Task = {
      ...task,
      ...additionalData,
      status,
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, updatedTask);

    // Emit status change event
    const eventType =
      status === 'completed'
        ? 'task:completed'
        : status === 'failed'
          ? 'task:failed'
          : 'task:started';
    this.emitEvent(eventType, {
      taskId,
      task: updatedTask,
      previousStatus: task.status,
    });

    return updatedTask;
  }

  /**
   * Assigns a task to the best available crew member
   *
   * @param taskId - The task ID to assign
   * @param availableMembers - List of available crew members
   * @param context - Execution context
   * @returns The assigned crew member or null if no suitable member found
   * @throws {CrewError} If task is not found
   */
  async assignTask(
    taskId: string,
    availableMembers: CrewMember[],
    _context?: ExecutionContext,
  ): Promise<CrewMember | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new CrewError(
        CrewErrorCode.TASK_NOT_FOUND,
        `Task ${taskId} not found`,
      );
    }

    // Check dependencies are met
    const unmetDependencies = this.getUnmetDependencies(task);
    if (unmetDependencies.length > 0) {
      throw new CrewError(
        CrewErrorCode.DEPENDENCY_NOT_MET,
        `Task ${taskId} has unmet dependencies: ${unmetDependencies.join(', ')}`,
        { unmetDependencies },
      );
    }

    // Find best matching member based on capabilities
    const bestMember = this.findBestMember(task, availableMembers);
    if (!bestMember) {
      return null;
    }

    // Update task with assignment
    this.updateTaskStatus(taskId, 'assigned', {
      assignedTo: bestMember.id,
      startedAt: new Date(),
    });

    // Track execution
    this.activeExecutions.set(taskId, {
      taskId,
      memberId: bestMember.id,
      startedAt: new Date(),
    });

    return bestMember;
  }

  /**
   * Records a task result and updates tracking
   *
   * @param taskId - The task ID
   * @param result - The task execution result
   */
  recordResult(taskId: string, result: TaskResult): void {
    const execution = this.activeExecutions.get(taskId);
    if (execution) {
      this.activeExecutions.delete(taskId);
    }

    this.completedTasks.set(taskId, result);

    const newStatus = result.success ? 'completed' : 'failed';
    this.updateTaskStatus(taskId, newStatus, {
      completedAt: result.completedAt,
    });

    // Remove from queue if present
    this.taskQueue = this.taskQueue.filter(qt => qt.task.id !== taskId);
  }

  /**
   * Gets the result of a completed task
   *
   * @param taskId - The task ID
   * @returns The task result or undefined if not completed
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.completedTasks.get(taskId);
  }

  /**
   * Gets the next task from the priority queue
   *
   * @returns The next task to execute or undefined if queue is empty
   */
  getNextTask(): Task | undefined {
    // Re-sort queue by priority (higher priority first)
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    // Find first task with met dependencies
    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedTask = this.taskQueue[i];
      if (queuedTask) {
        const unmet = this.getUnmetDependencies(queuedTask.task);
        if (unmet.length === 0) {
          this.taskQueue.splice(i, 1);
          return queuedTask.task;
        }
      }
    }

    return undefined;
  }

  /**
   * Checks if there are pending tasks in the queue
   *
   * @returns True if there are pending tasks
   */
  hasPendingTasks(): boolean {
    return this.taskQueue.length > 0;
  }

  /**
   * Gets the number of currently active task executions
   *
   * @returns The count of active executions
   */
  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Checks if more tasks can be executed concurrently
   *
   * @returns True if more tasks can be started
   */
  canExecuteMore(): boolean {
    return this.activeExecutions.size < this.options.maxConcurrentTasks;
  }

  /**
   * Handles task retry logic
   *
   * @param taskId - The task ID to retry
   * @returns True if retry is allowed, false if max retries exceeded
   */
  retryTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.retryCount >= task.maxRetries) {
      return false;
    }

    this.updateTaskStatus(taskId, 'pending', {
      retryCount: task.retryCount + 1,
      assignedTo: undefined,
      startedAt: undefined,
    });

    // Re-enqueue the task
    this.enqueueTask(this.tasks.get(taskId)!);
    return true;
  }

  /**
   * Validates task dependencies for circular references
   *
   * @param tasks - Array of tasks to validate
   * @throws {CrewError} If circular dependency is detected
   */
  validateDependencies(tasks: Task[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) {
        return true;
      }
      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (hasCycle(task.id)) {
        throw new CrewError(
          CrewErrorCode.CIRCULAR_DEPENDENCY,
          `Circular dependency detected involving task: ${task.id}`,
        );
      }
    }
  }

  /**
   * Gets execution metrics for all tasks
   *
   * @returns Execution metrics summary
   */
  getMetrics(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    averageDuration: number;
  } {
    const tasks = this.getAllTasks();
    const completedResults = Array.from(this.completedTasks.values());

    const totalDuration = completedResults.reduce(
      (sum, r) => sum + r.duration,
      0,
    );
    const averageDuration =
      completedResults.length > 0 ? totalDuration / completedResults.length : 0;

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      averageDuration,
    };
  }

  /**
   * Shuts down the task manager
   */
  async shutdown(): Promise<void> {
    // Cancel any active executions
    for (const [taskId] of this.activeExecutions) {
      this.updateTaskStatus(taskId, 'cancelled');
    }
    this.activeExecutions.clear();
    this.taskQueue = [];
    this.emit('shutdown');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Enqueues a task with priority weighting
   */
  private enqueueTask(task: Task): void {
    const priorityWeight = this.getPriorityWeight(task.priority);
    this.taskQueue.push({
      task,
      priority: priorityWeight,
      queuedAt: new Date(),
    });
  }

  /**
   * Gets the priority weight for a task priority level
   */
  private getPriorityWeight(priority: TaskPriority): number {
    return this.options.priorityWeights[priority];
  }

  /**
   * Gets unmet dependencies for a task
   */
  private getUnmetDependencies(task: Task): string[] {
    return task.dependencies.filter(depId => {
      const depTask = this.tasks.get(depId);
      if (!depTask) {
        return true; // Dependency task not found
      }
      return depTask.status !== 'completed';
    });
  }

  /**
   * Finds the best crew member for a task based on capabilities
   */
  private findBestMember(
    task: Task,
    availableMembers: CrewMember[],
  ): CrewMember | null {
    if (availableMembers.length === 0) {
      return null;
    }

    // Filter members that are idle and have required tools
    const eligibleMembers = availableMembers.filter(member => {
      if (member.status !== 'idle') {
        return false;
      }

      // Check if member has required tools
      if (task.tools && task.tools.length > 0) {
        const memberTools = member.tools ?? [];
        const hasAllTools = task.tools.every(tool =>
          memberTools.includes(tool),
        );
        if (!hasAllTools) {
          return false;
        }
      }

      return true;
    });

    if (eligibleMembers.length === 0) {
      // Fall back to any idle member
      return availableMembers.find(m => m.status === 'idle') ?? null;
    }

    // Score members based on capability match
    const scoredMembers = eligibleMembers.map(member => {
      let score = 0;

      // Role matching bonus
      if (task.title.toLowerCase().includes(member.role)) {
        score += 10;
      }

      // Capability matching
      if (member.capabilities) {
        for (const cap of member.capabilities) {
          if (
            task.description.toLowerCase().includes(cap.toLowerCase()) ||
            task.title.toLowerCase().includes(cap.toLowerCase())
          ) {
            score += 5;
          }
        }
      }

      return { member, score };
    });

    // Sort by score descending and return best match
    scoredMembers.sort((a, b) => b.score - a.score);
    return scoredMembers[0]?.member ?? null;
  }

  /**
   * Emits a crew event
   */
  private emitEvent(
    type: CrewEvent['type'],
    data: Record<string, unknown>,
  ): void {
    const event: CrewEvent = {
      type,
      crewId: '', // Will be set by crew
      timestamp: new Date(),
      data,
    };
    this.emit(type, event);
    this.emit('event', event);
  }
}
