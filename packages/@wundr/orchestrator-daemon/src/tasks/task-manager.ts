/**
 * Task Manager - Business logic layer for task management
 *
 * Coordinates the task store, enforces invariants (status transitions,
 * dependency cycles), manages the blocks/blockedBy graph, and emits events
 * for downstream consumers (WebSocket notifications, scheduler, metrics).
 *
 * This is the primary public API for task operations within the orchestrator
 * daemon. It wraps the ITaskStore with validation, event emission, and
 * automatic dependency resolution.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { Logger } from '../utils/logger';

import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  VALID_TRANSITIONS,
  PRIORITY_WEIGHTS,
  TaskNotFoundError,
  CircularDependencyError,
  InvalidTransitionError,
  TaskBlockedError,
  TaskError,
  TaskErrorCode,
} from './task-types';

import type {
  ITaskStore,
  ManagedTask,
  CreateTaskInput,
  UpdateTaskInput,
  TaskQuery,
  TaskStatus,
  TaskEventMap,
} from './task-types';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration options for the TaskManager.
 */
export interface TaskManagerConfig {
  /** Whether to automatically unblock dependent tasks when a task completes. Default: true */
  autoUnblock?: boolean;

  /** Whether to validate status transitions. Default: true */
  enforceTransitions?: boolean;

  /** Whether to detect circular dependencies on addDependency. Default: true */
  detectCycles?: boolean;
}

// =============================================================================
// TaskManager
// =============================================================================

/**
 * TaskManager provides the full CRUD lifecycle for managed tasks with
 * dependency tracking, status transition enforcement, and event emission.
 *
 * @example
 * ```typescript
 * const store = new InMemoryTaskStore();
 * await store.initialize();
 *
 * const manager = new TaskManager(store);
 * await manager.initialize();
 *
 * const task = await manager.createTask({
 *   subject: 'Implement auth module',
 *   description: 'JWT-based authentication with refresh tokens',
 *   priority: 'high',
 * });
 *
 * await manager.claimTask(task.id, 'agent-security-01');
 * await manager.updateTask(task.id, { activeForm: 'Writing implementation...' });
 * await manager.completeTask(task.id);
 * ```
 */
export class TaskManager extends EventEmitter<TaskEventMap> {
  private store: ITaskStore;
  private config: Required<TaskManagerConfig>;
  private logger: Logger;
  private initialized = false;

  constructor(store: ITaskStore, config: TaskManagerConfig = {}) {
    super();

    this.store = store;
    this.logger = new Logger('TaskManager');
    this.config = {
      autoUnblock: config.autoUnblock ?? true,
      enforceTransitions: config.enforceTransitions ?? true,
      detectCycles: config.detectCycles ?? true,
    };
  }

  /**
   * Initialize the task manager and its backing store.
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
    this.initialized = true;
    this.logger.info('TaskManager initialized');
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new task.
   *
   * @param input - Task creation parameters. Only `subject` is required.
   * @returns The created task with all fields populated.
   * @throws {TaskError} If validation fails.
   */
  async createTask(input: CreateTaskInput): Promise<ManagedTask> {
    this.ensureInitialized();

    // Validate input
    const parsed = CreateTaskInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new TaskError(
        TaskErrorCode.VALIDATION_ERROR,
        `Invalid task input: ${parsed.error.message}`,
        { validationErrors: parsed.error.errors },
      );
    }

    const now = new Date();
    const task: ManagedTask = {
      id: uuidv4(),
      subject: parsed.data.subject,
      description: parsed.data.description ?? '',
      status: 'pending',
      owner: parsed.data.owner ?? null,
      activeForm: parsed.data.activeForm ?? null,
      priority: parsed.data.priority ?? 'medium',
      blocks: parsed.data.blocks ?? [],
      blockedBy: parsed.data.blockedBy ?? [],
      metadata: parsed.data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    // If blocks/blockedBy are specified, validate they reference existing tasks
    // and set up the inverse relationships
    if (task.blocks.length > 0 || task.blockedBy.length > 0) {
      await this.setupInitialDependencies(task);
    }

    await this.store.create(task);

    this.logger.info(`Task created: ${task.id} - ${task.subject}`);
    this.emit('task:created', { task });

    return task;
  }

  /**
   * Get a task by ID.
   *
   * @param id - The task ID.
   * @returns The task, or null if not found.
   */
  async getTask(id: string): Promise<ManagedTask | null> {
    this.ensureInitialized();
    return this.store.get(id);
  }

  /**
   * Get a task by ID, throwing if not found.
   *
   * @param id - The task ID.
   * @returns The task.
   * @throws {TaskNotFoundError} If the task does not exist.
   */
  async getTaskOrThrow(id: string): Promise<ManagedTask> {
    const task = await this.getTask(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }
    return task;
  }

  /**
   * Update a task.
   *
   * Handles status transition validation, dependency array modifications
   * (addBlocks/removeBlocks/addBlockedBy/removeBlockedBy), and metadata
   * merging.
   *
   * @param id - The task ID to update.
   * @param input - Fields to update.
   * @returns The updated task.
   * @throws {TaskNotFoundError} If the task does not exist.
   * @throws {InvalidTransitionError} If the status transition is not allowed.
   */
  async updateTask(id: string, input: UpdateTaskInput): Promise<ManagedTask> {
    this.ensureInitialized();

    // Validate input
    const parsed = UpdateTaskInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new TaskError(
        TaskErrorCode.VALIDATION_ERROR,
        `Invalid update input: ${parsed.error.message}`,
        { validationErrors: parsed.error.errors },
      );
    }

    const existing = await this.getTaskOrThrow(id);
    const changes: string[] = [];

    // Build the update object
    const updates: Partial<ManagedTask> = {};

    // Simple field updates
    if (parsed.data.subject !== undefined && parsed.data.subject !== existing.subject) {
      updates.subject = parsed.data.subject;
      changes.push('subject');
    }
    if (parsed.data.description !== undefined && parsed.data.description !== existing.description) {
      updates.description = parsed.data.description;
      changes.push('description');
    }
    if (parsed.data.owner !== undefined && parsed.data.owner !== existing.owner) {
      updates.owner = parsed.data.owner;
      changes.push('owner');
    }
    if (parsed.data.activeForm !== undefined && parsed.data.activeForm !== existing.activeForm) {
      updates.activeForm = parsed.data.activeForm;
      changes.push('activeForm');
    }
    if (parsed.data.priority !== undefined && parsed.data.priority !== existing.priority) {
      updates.priority = parsed.data.priority;
      changes.push('priority');
    }

    // Status transition
    if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
      this.validateTransition(id, existing.status, parsed.data.status);

      // Block check: cannot move to in_progress if blockers exist
      if (parsed.data.status === 'in_progress') {
        const activeBlockers = await this.getActiveBlockers(existing);
        if (activeBlockers.length > 0) {
          throw new TaskBlockedError(id, activeBlockers);
        }
      }

      updates.status = parsed.data.status;
      changes.push('status');
    }

    // Metadata merge (shallow)
    if (parsed.data.metadata !== undefined) {
      updates.metadata = { ...existing.metadata, ...parsed.data.metadata };
      changes.push('metadata');
    }

    // Dependency modifications
    let blocks = [...existing.blocks];
    let blockedBy = [...existing.blockedBy];
    let depsChanged = false;

    if (parsed.data.addBlocks?.length) {
      for (const blockId of parsed.data.addBlocks) {
        if (!blocks.includes(blockId)) {
          blocks.push(blockId);
          depsChanged = true;
        }
      }
    }
    if (parsed.data.removeBlocks?.length) {
      const toRemove = new Set(parsed.data.removeBlocks);
      const before = blocks.length;
      blocks = blocks.filter((b) => !toRemove.has(b));
      if (blocks.length !== before) depsChanged = true;
    }
    if (parsed.data.addBlockedBy?.length) {
      for (const blockerId of parsed.data.addBlockedBy) {
        if (!blockedBy.includes(blockerId)) {
          blockedBy.push(blockerId);
          depsChanged = true;
        }
      }
    }
    if (parsed.data.removeBlockedBy?.length) {
      const toRemove = new Set(parsed.data.removeBlockedBy);
      const before = blockedBy.length;
      blockedBy = blockedBy.filter((b) => !toRemove.has(b));
      if (blockedBy.length !== before) depsChanged = true;
    }

    if (depsChanged) {
      updates.blocks = blocks;
      updates.blockedBy = blockedBy;
      changes.push('dependencies');
    }

    // Bail early if nothing changed
    if (changes.length === 0) {
      return existing;
    }

    updates.updatedAt = new Date();
    const updated = await this.store.update(id, updates);
    if (!updated) {
      throw new TaskNotFoundError(id);
    }

    this.logger.debug(`Task updated: ${id} [${changes.join(', ')}]`);
    this.emit('task:updated', { task: updated, changes });

    return updated;
  }

  /**
   * Soft-delete a task by setting its status to 'deleted'.
   *
   * Also cleans up any dependency references from other tasks.
   *
   * @param id - The task ID to delete.
   * @throws {TaskNotFoundError} If the task does not exist.
   */
  async deleteTask(id: string): Promise<void> {
    this.ensureInitialized();

    const task = await this.getTaskOrThrow(id);

    // Clean up dependency references in other tasks
    await this.removeDependencyReferences(id);

    // Set status to deleted
    await this.store.update(id, {
      status: 'deleted',
      activeForm: null,
      updatedAt: new Date(),
    });

    this.logger.info(`Task deleted: ${id}`);
    this.emit('task:deleted', { taskId: id });

    // Check if deleting this task unblocked others
    if (task.blocks.length > 0) {
      await this.checkAndUnblockTasks(task.blocks);
    }
  }

  /**
   * Query tasks with optional filters.
   *
   * @param query - Filter parameters.
   * @returns Array of matching tasks.
   */
  async queryTasks(query: TaskQuery = {}): Promise<ManagedTask[]> {
    this.ensureInitialized();
    return this.store.query(query);
  }

  /**
   * Get all tasks.
   *
   * @returns Array of all tasks.
   */
  async getAllTasks(): Promise<ManagedTask[]> {
    this.ensureInitialized();
    return this.store.getAll();
  }

  /**
   * Count tasks matching an optional query.
   *
   * @param query - Optional filter parameters.
   * @returns The count of matching tasks.
   */
  async countTasks(query?: TaskQuery): Promise<number> {
    this.ensureInitialized();
    return this.store.count(query);
  }

  // ===========================================================================
  // Task Lifecycle Operations
  // ===========================================================================

  /**
   * Complete a task.
   *
   * Sets status to 'completed', clears activeForm, and automatically
   * unblocks any tasks that were waiting on this one.
   *
   * @param id - The task ID to complete.
   * @returns The completed task and list of unblocked task IDs.
   */
  async completeTask(id: string): Promise<{ task: ManagedTask; unblocked: string[] }> {
    this.ensureInitialized();

    const existing = await this.getTaskOrThrow(id);
    this.validateTransition(id, existing.status, 'completed');

    const updated = await this.store.update(id, {
      status: 'completed',
      activeForm: null,
      updatedAt: new Date(),
    });
    if (!updated) {
      throw new TaskNotFoundError(id);
    }

    this.logger.info(`Task completed: ${id} - ${updated.subject}`);

    // Auto-unblock downstream tasks
    let unblocked: string[] = [];
    if (this.config.autoUnblock && updated.blocks.length > 0) {
      unblocked = await this.unblockDownstreamTasks(id, updated.blocks);
    }

    this.emit('task:completed', { task: updated, unblocked });
    return { task: updated, unblocked };
  }

  /**
   * Claim a task for an agent.
   *
   * Sets the owner and transitions status to 'in_progress'. The task must
   * not be blocked.
   *
   * @param id - The task ID to claim.
   * @param owner - The agent ID claiming the task.
   * @param activeForm - Optional spinner text (e.g., "Analyzing requirements...").
   * @returns The claimed task.
   * @throws {TaskBlockedError} If the task has unresolved blockers.
   */
  async claimTask(id: string, owner: string, activeForm?: string): Promise<ManagedTask> {
    this.ensureInitialized();

    const existing = await this.getTaskOrThrow(id);

    // Check for active blockers
    const activeBlockers = await this.getActiveBlockers(existing);
    if (activeBlockers.length > 0) {
      throw new TaskBlockedError(id, activeBlockers);
    }

    this.validateTransition(id, existing.status, 'in_progress');

    const updated = await this.store.update(id, {
      owner,
      status: 'in_progress',
      activeForm: activeForm ?? null,
      updatedAt: new Date(),
    });
    if (!updated) {
      throw new TaskNotFoundError(id);
    }

    this.logger.info(`Task claimed: ${id} by ${owner}`);
    this.emit('task:claimed', { task: updated, owner });

    return updated;
  }

  /**
   * Release a task back to the pool.
   *
   * Clears the owner and transitions status back to 'pending'.
   *
   * @param id - The task ID to release.
   * @returns The released task.
   */
  async releaseTask(id: string): Promise<ManagedTask> {
    this.ensureInitialized();

    const existing = await this.getTaskOrThrow(id);
    this.validateTransition(id, existing.status, 'pending');

    const updated = await this.store.update(id, {
      owner: null,
      status: 'pending',
      activeForm: null,
      updatedAt: new Date(),
    });
    if (!updated) {
      throw new TaskNotFoundError(id);
    }

    this.logger.info(`Task released: ${id}`);
    this.emit('task:released', { task: updated });

    return updated;
  }

  // ===========================================================================
  // Dependency Management
  // ===========================================================================

  /**
   * Add a dependency: blockerId must complete before blockedId can start.
   *
   * Sets blockerId.blocks += blockedId and blockedId.blockedBy += blockerId.
   * Performs cycle detection before committing.
   *
   * @param blockerId - The task that must complete first.
   * @param blockedId - The task that is blocked.
   * @throws {CircularDependencyError} If adding this dependency would create a cycle.
   */
  async addDependency(blockerId: string, blockedId: string): Promise<void> {
    this.ensureInitialized();

    if (blockerId === blockedId) {
      throw new CircularDependencyError([blockerId, blockedId]);
    }

    const blocker = await this.getTaskOrThrow(blockerId);
    const blocked = await this.getTaskOrThrow(blockedId);

    // Skip if dependency already exists
    if (blocker.blocks.includes(blockedId) && blocked.blockedBy.includes(blockerId)) {
      return;
    }

    // Cycle detection
    if (this.config.detectCycles) {
      await this.detectCycle(blockerId, blockedId);
    }

    // Update blocker: add blockedId to blocks
    if (!blocker.blocks.includes(blockedId)) {
      await this.store.update(blockerId, {
        blocks: [...blocker.blocks, blockedId],
        updatedAt: new Date(),
      });
    }

    // Update blocked: add blockerId to blockedBy
    if (!blocked.blockedBy.includes(blockerId)) {
      await this.store.update(blockedId, {
        blockedBy: [...blocked.blockedBy, blockerId],
        updatedAt: new Date(),
      });
    }

    this.logger.debug(`Dependency added: ${blockerId} blocks ${blockedId}`);
    this.emit('task:blocked', { taskId: blockedId, blockedBy: [...blocked.blockedBy, blockerId] });
  }

  /**
   * Remove a dependency between two tasks.
   *
   * @param blockerId - The task that was blocking.
   * @param blockedId - The task that was blocked.
   */
  async removeDependency(blockerId: string, blockedId: string): Promise<void> {
    this.ensureInitialized();

    const blocker = await this.store.get(blockerId);
    const blocked = await this.store.get(blockedId);

    if (blocker) {
      const newBlocks = blocker.blocks.filter((b) => b !== blockedId);
      if (newBlocks.length !== blocker.blocks.length) {
        await this.store.update(blockerId, { blocks: newBlocks, updatedAt: new Date() });
      }
    }

    if (blocked) {
      const newBlockedBy = blocked.blockedBy.filter((b) => b !== blockerId);
      if (newBlockedBy.length !== blocked.blockedBy.length) {
        await this.store.update(blockedId, { blockedBy: newBlockedBy, updatedAt: new Date() });

        // Check if this task is now unblocked
        if (newBlockedBy.length === 0) {
          this.emit('task:unblocked', { taskId: blockedId });
        }
      }
    }

    this.logger.debug(`Dependency removed: ${blockerId} no longer blocks ${blockedId}`);
  }

  /**
   * Get all tasks that are ready to execute (pending, unblocked, unowned).
   *
   * @returns Array of ready tasks, sorted by priority (highest first).
   */
  async getReadyTasks(): Promise<ManagedTask[]> {
    this.ensureInitialized();

    const pending = await this.store.query({
      status: 'pending',
      isBlocked: false,
      hasOwner: false,
    });

    // Sort by priority weight descending
    return pending.sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority],
    );
  }

  /**
   * Get a summary of task counts by status.
   */
  async getMetrics(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    deleted: number;
    blocked: number;
  }> {
    this.ensureInitialized();

    const [total, pending, inProgress, completed, deleted, blocked] = await Promise.all([
      this.store.count(),
      this.store.count({ status: 'pending' }),
      this.store.count({ status: 'in_progress' }),
      this.store.count({ status: 'completed' }),
      this.store.count({ status: 'deleted' }),
      this.store.count({ isBlocked: true }),
    ]);

    return { total, pending, inProgress, completed, deleted, blocked };
  }

  // ===========================================================================
  // Shutdown
  // ===========================================================================

  /**
   * Shut down the task manager and release store resources.
   */
  async shutdown(): Promise<void> {
    await this.store.close();
    this.removeAllListeners();
    this.initialized = false;
    this.logger.info('TaskManager shut down');
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Ensure the manager has been initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new TaskError(
        TaskErrorCode.STORE_ERROR,
        'TaskManager is not initialized. Call initialize() first.',
      );
    }
  }

  /**
   * Validate a status transition.
   */
  private validateTransition(taskId: string, from: TaskStatus, to: TaskStatus): void {
    if (!this.config.enforceTransitions) {
      return;
    }

    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new InvalidTransitionError(taskId, from, to);
    }
  }

  /**
   * Get task IDs from blockedBy that are still active (not completed/deleted).
   */
  private async getActiveBlockers(task: ManagedTask): Promise<string[]> {
    const activeBlockers: string[] = [];

    for (const blockerId of task.blockedBy) {
      const blocker = await this.store.get(blockerId);
      if (blocker && blocker.status !== 'completed' && blocker.status !== 'deleted') {
        activeBlockers.push(blockerId);
      }
    }

    return activeBlockers;
  }

  /**
   * Set up blocks/blockedBy inverse relationships for a newly created task.
   */
  private async setupInitialDependencies(task: ManagedTask): Promise<void> {
    // For each task this one blocks, add this task to their blockedBy
    for (const blockedId of task.blocks) {
      const blocked = await this.store.get(blockedId);
      if (blocked && !blocked.blockedBy.includes(task.id)) {
        await this.store.update(blockedId, {
          blockedBy: [...blocked.blockedBy, task.id],
          updatedAt: new Date(),
        });
      }
    }

    // For each task blocking this one, add this task to their blocks
    for (const blockerId of task.blockedBy) {
      const blocker = await this.store.get(blockerId);
      if (blocker && !blocker.blocks.includes(task.id)) {
        await this.store.update(blockerId, {
          blocks: [...blocker.blocks, task.id],
          updatedAt: new Date(),
        });
      }
    }
  }

  /**
   * Remove all dependency references to a task from other tasks.
   */
  private async removeDependencyReferences(taskId: string): Promise<void> {
    const allTasks = await this.store.getAll();

    for (const task of allTasks) {
      if (task.id === taskId) continue;

      let needsUpdate = false;
      let newBlocks = task.blocks;
      let newBlockedBy = task.blockedBy;

      if (task.blocks.includes(taskId)) {
        newBlocks = task.blocks.filter((b) => b !== taskId);
        needsUpdate = true;
      }

      if (task.blockedBy.includes(taskId)) {
        newBlockedBy = task.blockedBy.filter((b) => b !== taskId);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.store.update(task.id, {
          blocks: newBlocks,
          blockedBy: newBlockedBy,
          updatedAt: new Date(),
        });
      }
    }
  }

  /**
   * When a task completes, remove it from the blockedBy lists of tasks it blocks.
   * Returns the IDs of tasks that became fully unblocked.
   */
  private async unblockDownstreamTasks(
    completedId: string,
    blockedIds: string[],
  ): Promise<string[]> {
    const unblocked: string[] = [];

    for (const blockedId of blockedIds) {
      const blocked = await this.store.get(blockedId);
      if (!blocked) continue;

      const newBlockedBy = blocked.blockedBy.filter((b) => b !== completedId);
      await this.store.update(blockedId, {
        blockedBy: newBlockedBy,
        updatedAt: new Date(),
      });

      // Check if fully unblocked (no remaining active blockers)
      const stillBlocked = await this.getActiveBlockers({
        ...blocked,
        blockedBy: newBlockedBy,
      });

      if (stillBlocked.length === 0 && newBlockedBy.length === 0) {
        unblocked.push(blockedId);
        this.logger.info(`Task unblocked: ${blockedId}`);
        this.emit('task:unblocked', { taskId: blockedId });
      }
    }

    return unblocked;
  }

  /**
   * Check tasks in the given list and emit unblocked events for any that
   * no longer have active blockers.
   */
  private async checkAndUnblockTasks(taskIds: string[]): Promise<void> {
    for (const taskId of taskIds) {
      const task = await this.store.get(taskId);
      if (!task || task.status === 'completed' || task.status === 'deleted') continue;

      const activeBlockers = await this.getActiveBlockers(task);
      if (activeBlockers.length === 0 && task.blockedBy.length > 0) {
        // All blockers are complete/deleted, clean up the blockedBy array
        await this.store.update(taskId, {
          blockedBy: [],
          updatedAt: new Date(),
        });
        this.emit('task:unblocked', { taskId });
      }
    }
  }

  /**
   * Detect if adding an edge from blockerId -> blockedId would create a cycle.
   *
   * Uses DFS from blockedId following the "blocks" edges. If we reach blockerId,
   * there is a cycle.
   */
  private async detectCycle(blockerId: string, blockedId: string): Promise<void> {
    const visited = new Set<string>();
    const path: string[] = [blockedId];

    const hasCycle = async (current: string): Promise<boolean> => {
      if (current === blockerId) {
        return true;
      }

      if (visited.has(current)) {
        return false;
      }

      visited.add(current);
      const task = await this.store.get(current);
      if (!task) return false;

      for (const downstream of task.blocks) {
        path.push(downstream);
        if (await hasCycle(downstream)) {
          return true;
        }
        path.pop();
      }

      return false;
    };

    if (await hasCycle(blockedId)) {
      throw new CircularDependencyError([blockerId, ...path]);
    }
  }
}
