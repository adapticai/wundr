/**
 * Shared Task List - Cross-session task coordination for Agent Teams
 *
 * Provides create/update/list/get/claim/complete operations on a shared task list.
 * All teammates in a team can read the list, claim available tasks, and mark them
 * complete. File locking (via in-memory mutex) prevents race conditions when
 * multiple teammates try to claim the same task simultaneously.
 *
 * Modeled after Claude Code Agent Teams' shared task list:
 * - Tasks have states: pending, in_progress, completed, blocked
 * - Tasks can depend on other tasks (blocked until dependencies complete)
 * - Claiming uses locking to prevent double-assignment
 * - Completing a task auto-unblocks dependent tasks
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SharedTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type SharedTaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SharedTask {
  readonly id: string;
  readonly teamId: string;
  title: string;
  description: string;
  status: SharedTaskStatus;
  priority: SharedTaskPriority;
  assigneeId: string | null;
  readonly dependencies: string[];
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface CreateTaskInput {
  readonly title: string;
  readonly description: string;
  readonly priority?: SharedTaskPriority;
  readonly assigneeId?: string;
  readonly dependencies?: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly description?: string;
  readonly status?: SharedTaskStatus;
  readonly priority?: SharedTaskPriority;
  readonly assigneeId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskFilter {
  readonly status?: SharedTaskStatus;
  readonly assigneeId?: string;
  readonly priority?: SharedTaskPriority;
  readonly createdBy?: string;
}

export interface SharedTaskListEvents {
  'task:created': (task: SharedTask) => void;
  'task:updated': (task: SharedTask, previousStatus: SharedTaskStatus) => void;
  'task:claimed': (task: SharedTask, teammateId: string) => void;
  'task:completed': (task: SharedTask, teammateId: string) => void;
  'task:unblocked': (task: SharedTask) => void;
  'task:released': (task: SharedTask) => void;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TaskListError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TaskListError';
  }
}

export enum TaskListErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ALREADY_CLAIMED = 'TASK_ALREADY_CLAIMED',
  TASK_BLOCKED = 'TASK_BLOCKED',
  TASK_NOT_IN_PROGRESS = 'TASK_NOT_IN_PROGRESS',
  DEPENDENCY_NOT_FOUND = 'DEPENDENCY_NOT_FOUND',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  COMPLETION_REJECTED = 'COMPLETION_REJECTED',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
}

// ---------------------------------------------------------------------------
// In-memory Mutex
// ---------------------------------------------------------------------------

/**
 * Simple async mutex for preventing concurrent modifications.
 * Replaces file locking for the in-process use case.
 */
class AsyncMutex {
  private locked = false;
  private readonly waiters: Array<() => void> = [];

  async acquire(timeoutMs = 5000): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(resolve);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        reject(
          new TaskListError(
            TaskListErrorCode.LOCK_TIMEOUT,
            `Failed to acquire lock within ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  release(): void {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      // Keep locked, transfer to next waiter
      next();
    } else {
      this.locked = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Task Completion Hook Callback
// ---------------------------------------------------------------------------

/**
 * Callback type for the TaskCompleted hook integration.
 * The TeamHooks module injects this callback so SharedTaskList does not depend
 * on hooks directly. Returns { allowed: true } or { allowed: false, feedback }.
 */
export type TaskCompletedHookFn = (context: {
  teamId: string;
  taskId: string;
  taskTitle: string;
  completedBy: string;
  duration: number;
  dependentTaskIds: string[];
}) => Promise<{ allowed: boolean; feedback?: string }>;

// ---------------------------------------------------------------------------
// Shared Task List
// ---------------------------------------------------------------------------

export class SharedTaskList extends EventEmitter<SharedTaskListEvents> {
  private readonly tasks: Map<string, SharedTask> = new Map();
  private readonly mutex = new AsyncMutex();
  private taskCompletedHook: TaskCompletedHookFn | null = null;
  private nextTaskNumber = 1;

  constructor(private readonly teamId: string) {
    super();
  }

  // -------------------------------------------------------------------------
  // Hook Registration
  // -------------------------------------------------------------------------

  /**
   * Register the TaskCompleted hook callback.
   * Called by TeamHooks during team initialization.
   */
  setTaskCompletedHook(hook: TaskCompletedHookFn): void {
    this.taskCompletedHook = hook;
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Create a new task in the shared list.
   */
  createTask(createdBy: string, input: CreateTaskInput): SharedTask {
    const taskId = `task_${this.teamId}_${this.nextTaskNumber++}`;
    const dependencies = input.dependencies ?? [];

    // Validate that all dependencies exist
    for (const depId of dependencies) {
      if (!this.tasks.has(depId)) {
        throw new TaskListError(
          TaskListErrorCode.DEPENDENCY_NOT_FOUND,
          `Dependency task not found: ${depId}`,
          { dependencyId: depId },
        );
      }
    }

    // Determine initial status based on dependencies
    const hasUnresolvedDeps = dependencies.some(depId => {
      const dep = this.tasks.get(depId);
      return dep !== undefined && dep.status !== 'completed';
    });

    const now = new Date();
    const task: SharedTask = {
      id: taskId,
      teamId: this.teamId,
      title: input.title,
      description: input.description,
      status: hasUnresolvedDeps ? 'blocked' : 'pending',
      priority: input.priority ?? 'medium',
      assigneeId: input.assigneeId ?? null,
      dependencies,
      createdBy,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      metadata: input.metadata ?? {},
    };

    this.tasks.set(taskId, task);
    this.emit('task:created', task);

    return task;
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): SharedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * List tasks with optional filtering.
   */
  listTasks(filter?: TaskFilter): SharedTask[] {
    let result = Array.from(this.tasks.values());

    if (filter) {
      if (filter.status !== undefined) {
        result = result.filter(t => t.status === filter.status);
      }
      if (filter.assigneeId !== undefined) {
        result = result.filter(t => t.assigneeId === filter.assigneeId);
      }
      if (filter.priority !== undefined) {
        result = result.filter(t => t.priority === filter.priority);
      }
      if (filter.createdBy !== undefined) {
        result = result.filter(t => t.createdBy === filter.createdBy);
      }
    }

    // Sort: critical first, then high, medium, low; within same priority, oldest first
    const priorityOrder: Record<SharedTaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    result.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) {
return pDiff;
}
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return result;
  }

  /**
   * Update a task's mutable fields.
   * Does NOT allow direct status changes to 'completed' -- use completeTask() instead.
   */
  async updateTask(taskId: string, input: UpdateTaskInput): Promise<SharedTask> {
    await this.mutex.acquire();
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new TaskListError(
          TaskListErrorCode.TASK_NOT_FOUND,
          `Task not found: ${taskId}`,
        );
      }

      const previousStatus = task.status;

      if (input.title !== undefined) {
task.title = input.title;
}
      if (input.description !== undefined) {
task.description = input.description;
}
      if (input.priority !== undefined) {
task.priority = input.priority;
}
      if (input.assigneeId !== undefined) {
task.assigneeId = input.assigneeId;
}
      if (input.metadata !== undefined) {
        task.metadata = { ...task.metadata, ...input.metadata };
      }

      // Allow manual status overrides (except completed, use completeTask)
      if (input.status !== undefined && input.status !== 'completed') {
        this.validateStatusTransition(task.status, input.status);
        task.status = input.status;
      }

      task.updatedAt = new Date();
      this.emit('task:updated', task, previousStatus);

      return task;
    } finally {
      this.mutex.release();
    }
  }

  // -------------------------------------------------------------------------
  // Claim / Complete
  // -------------------------------------------------------------------------

  /**
   * Claim a pending task for a teammate.
   * Uses mutex to prevent race conditions when multiple teammates claim simultaneously.
   */
  async claimTask(taskId: string, teammateId: string): Promise<SharedTask> {
    await this.mutex.acquire();
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new TaskListError(
          TaskListErrorCode.TASK_NOT_FOUND,
          `Task not found: ${taskId}`,
        );
      }

      if (task.status === 'blocked') {
        throw new TaskListError(
          TaskListErrorCode.TASK_BLOCKED,
          `Task ${taskId} is blocked by unresolved dependencies`,
          { dependencies: task.dependencies },
        );
      }

      if (task.status === 'in_progress' && task.assigneeId !== teammateId) {
        throw new TaskListError(
          TaskListErrorCode.TASK_ALREADY_CLAIMED,
          `Task ${taskId} is already claimed by ${task.assigneeId}`,
          { currentAssignee: task.assigneeId },
        );
      }

      if (task.status === 'completed') {
        throw new TaskListError(
          TaskListErrorCode.INVALID_STATUS_TRANSITION,
          `Task ${taskId} is already completed`,
        );
      }

      task.status = 'in_progress';
      task.assigneeId = teammateId;
      task.updatedAt = new Date();

      this.emit('task:claimed', task, teammateId);

      return task;
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Mark a task as completed.
   * Runs the TaskCompleted hook if registered (exit code 2 rejects completion).
   * Auto-unblocks dependent tasks.
   */
  async completeTask(taskId: string, teammateId: string): Promise<SharedTask> {
    // Pre-check outside lock for the hook
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new TaskListError(
        TaskListErrorCode.TASK_NOT_FOUND,
        `Task not found: ${taskId}`,
      );
    }

    if (task.status !== 'in_progress') {
      throw new TaskListError(
        TaskListErrorCode.TASK_NOT_IN_PROGRESS,
        `Task ${taskId} is not in progress (current status: ${task.status})`,
      );
    }

    // Run TaskCompleted hook (before acquiring lock to avoid holding it during hook execution)
    if (this.taskCompletedHook) {
      const dependentTaskIds = this.findDependentTaskIds(taskId);
      const duration = new Date().getTime() - task.createdAt.getTime();

      const hookResult = await this.taskCompletedHook({
        teamId: this.teamId,
        taskId,
        taskTitle: task.title,
        completedBy: teammateId,
        duration,
        dependentTaskIds,
      });

      if (!hookResult.allowed) {
        throw new TaskListError(
          TaskListErrorCode.COMPLETION_REJECTED,
          hookResult.feedback ?? 'Task completion rejected by hook',
          { feedback: hookResult.feedback },
        );
      }
    }

    // Now acquire lock for the actual state change
    await this.mutex.acquire();
    try {
      // Re-check state under lock (could have changed during hook execution)
      if (task.status !== 'in_progress') {
        throw new TaskListError(
          TaskListErrorCode.TASK_NOT_IN_PROGRESS,
          `Task ${taskId} status changed during hook execution`,
        );
      }

      const now = new Date();
      task.status = 'completed';
      task.completedAt = now;
      task.updatedAt = now;

      this.emit('task:completed', task, teammateId);

      // Resolve dependencies: unblock tasks that depended on this one
      this.resolveDependencies(taskId);

      return task;
    } finally {
      this.mutex.release();
    }
  }

  /**
   * Release a claimed task back to pending (e.g., teammate crashed).
   */
  async releaseTask(taskId: string): Promise<SharedTask> {
    await this.mutex.acquire();
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new TaskListError(
          TaskListErrorCode.TASK_NOT_FOUND,
          `Task not found: ${taskId}`,
        );
      }

      if (task.status !== 'in_progress') {
        throw new TaskListError(
          TaskListErrorCode.INVALID_STATUS_TRANSITION,
          `Cannot release task ${taskId} (status: ${task.status})`,
        );
      }

      task.status = 'pending';
      task.assigneeId = null;
      task.updatedAt = new Date();

      this.emit('task:released', task);

      return task;
    } finally {
      this.mutex.release();
    }
  }

  // -------------------------------------------------------------------------
  // Query Helpers
  // -------------------------------------------------------------------------

  /**
   * Get tasks that a teammate can claim right now.
   * A claimable task is: pending, not blocked, and either unassigned or assigned to the teammate.
   */
  getClaimableTasks(teammateId?: string): SharedTask[] {
    return Array.from(this.tasks.values()).filter(task => {
      if (task.status !== 'pending') {
return false;
}
      if (task.assigneeId !== null && task.assigneeId !== teammateId) {
return false;
}
      return true;
    });
  }

  /**
   * Get all tasks assigned to a specific teammate.
   */
  getTasksForTeammate(teammateId: string): SharedTask[] {
    return Array.from(this.tasks.values()).filter(
      task => task.assigneeId === teammateId,
    );
  }

  /**
   * Get summary statistics for the task list.
   */
  getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
  } {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let blocked = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          pending++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'completed':
          completed++;
          break;
        case 'blocked':
          blocked++;
          break;
      }
    }

    return {
      total: this.tasks.size,
      pending,
      inProgress,
      completed,
      blocked,
    };
  }

  /**
   * Get the total number of tasks.
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Clear all tasks (used during team cleanup).
   */
  clear(): void {
    this.tasks.clear();
    this.nextTaskNumber = 1;
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  /**
   * Find task IDs that depend on the given task.
   */
  private findDependentTaskIds(taskId: string): string[] {
    const dependents: string[] = [];
    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(taskId)) {
        dependents.push(task.id);
      }
    }
    return dependents;
  }

  /**
   * When a task is completed, check if any blocked tasks can now be unblocked.
   */
  private resolveDependencies(completedTaskId: string): void {
    for (const task of this.tasks.values()) {
      if (task.status !== 'blocked') {
continue;
}
      if (!task.dependencies.includes(completedTaskId)) {
continue;
}

      // Check if ALL dependencies are now completed
      const allDepsCompleted = task.dependencies.every(depId => {
        const dep = this.tasks.get(depId);
        return dep !== undefined && dep.status === 'completed';
      });

      if (allDepsCompleted) {
        task.status = 'pending';
        task.updatedAt = new Date();
        this.emit('task:unblocked', task);
      }
    }
  }

  /**
   * Validate that a status transition is allowed.
   */
  private validateStatusTransition(
    from: SharedTaskStatus,
    to: SharedTaskStatus,
  ): void {
    const allowed: Record<SharedTaskStatus, SharedTaskStatus[]> = {
      pending: ['in_progress', 'blocked'],
      in_progress: ['pending', 'completed'],
      blocked: ['pending'],
      completed: [], // completed is terminal (no transitions out via updateTask)
    };

    if (!allowed[from].includes(to)) {
      throw new TaskListError(
        TaskListErrorCode.INVALID_STATUS_TRANSITION,
        `Cannot transition from '${from}' to '${to}'`,
        { from, to },
      );
    }
  }
}
