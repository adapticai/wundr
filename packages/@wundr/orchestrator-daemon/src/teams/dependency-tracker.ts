/**
 * Dependency Tracker - Task dependency graph and deadlock detection
 *
 * Maintains a directed acyclic graph (DAG) of task dependencies and provides:
 * - Dependency registration and validation
 * - Circular dependency / deadlock detection via cycle detection (DFS)
 * - Topological ordering for execution planning
 * - Blocking/blocked-by queries
 * - Dependency chain resolution (transitive dependencies)
 *
 * Integrates with SharedTaskList to enforce dependency constraints before
 * task claiming and to auto-unblock tasks when dependencies complete.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DependencyEdge {
  /** The task that is blocked. */
  readonly taskId: string;
  /** The task that must complete first. */
  readonly dependsOn: string;
  readonly addedAt: Date;
}

export interface DependencyInfo {
  /** Tasks that this task depends on (must complete before this task can start). */
  readonly blockedBy: string[];
  /** Tasks that depend on this task (will be unblocked when this task completes). */
  readonly blocking: string[];
}

export interface CycleDetectionResult {
  readonly hasCycle: boolean;
  /** The cycle path if one exists (e.g., ['A', 'B', 'C', 'A']). */
  readonly cyclePath: string[];
}

export interface TopologicalOrder {
  /** Tasks in valid execution order. */
  readonly ordered: string[];
  /** Tasks involved in cycles (cannot be ordered). */
  readonly cyclic: string[];
}

export interface DependencyTrackerEvents {
  'dependency:added': (edge: DependencyEdge) => void;
  'dependency:removed': (taskId: string, dependsOn: string) => void;
  'dependency:cycle-detected': (cyclePath: string[]) => void;
  'dependency:resolved': (taskId: string, dependsOn: string) => void;
  'dependency:all-resolved': (taskId: string) => void;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DependencyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DependencyError';
  }
}

export enum DependencyErrorCode {
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  SELF_DEPENDENCY = 'SELF_DEPENDENCY',
  DUPLICATE_DEPENDENCY = 'DUPLICATE_DEPENDENCY',
  TASK_NOT_TRACKED = 'TASK_NOT_TRACKED',
}

// ---------------------------------------------------------------------------
// Dependency Tracker
// ---------------------------------------------------------------------------

export class DependencyTracker extends EventEmitter<DependencyTrackerEvents> {
  /**
   * Adjacency list: taskId -> set of task IDs that taskId depends on.
   * Represents "blockedBy" edges.
   */
  private readonly dependsOn: Map<string, Set<string>> = new Map();

  /**
   * Reverse adjacency list: taskId -> set of task IDs that depend on taskId.
   * Represents "blocking" edges.
   */
  private readonly blockedByMe: Map<string, Set<string>> = new Map();

  /**
   * Set of all known task IDs.
   */
  private readonly knownTasks: Set<string> = new Set();

  /**
   * Set of completed task IDs (for resolution tracking).
   */
  private readonly completedTasks: Set<string> = new Set();

  // -------------------------------------------------------------------------
  // Task Registration
  // -------------------------------------------------------------------------

  /**
   * Register a task in the dependency graph.
   * Must be called before adding dependencies for the task.
   */
  registerTask(taskId: string): void {
    this.knownTasks.add(taskId);
    if (!this.dependsOn.has(taskId)) {
      this.dependsOn.set(taskId, new Set());
    }
    if (!this.blockedByMe.has(taskId)) {
      this.blockedByMe.set(taskId, new Set());
    }
  }

  /**
   * Remove a task and all its dependency edges from the graph.
   */
  unregisterTask(taskId: string): void {
    // Remove as a dependency of other tasks
    const blocking = this.blockedByMe.get(taskId);
    if (blocking) {
      for (const blockedId of blocking) {
        this.dependsOn.get(blockedId)?.delete(taskId);
      }
    }

    // Remove dependencies this task has on other tasks
    const deps = this.dependsOn.get(taskId);
    if (deps) {
      for (const depId of deps) {
        this.blockedByMe.get(depId)?.delete(taskId);
      }
    }

    this.dependsOn.delete(taskId);
    this.blockedByMe.delete(taskId);
    this.knownTasks.delete(taskId);
    this.completedTasks.delete(taskId);
  }

  // -------------------------------------------------------------------------
  // Dependency Management
  // -------------------------------------------------------------------------

  /**
   * Add a dependency: `taskId` depends on `dependsOnId`.
   * Validates that the dependency does not create a cycle.
   *
   * @throws DependencyError if the dependency creates a cycle or is invalid
   */
  addDependency(taskId: string, dependsOnId: string): DependencyEdge {
    // Self-dependency check
    if (taskId === dependsOnId) {
      throw new DependencyError(
        DependencyErrorCode.SELF_DEPENDENCY,
        `Task cannot depend on itself: ${taskId}`,
      );
    }

    // Auto-register unknown tasks
    if (!this.knownTasks.has(taskId)) {
      this.registerTask(taskId);
    }
    if (!this.knownTasks.has(dependsOnId)) {
      this.registerTask(dependsOnId);
    }

    // Duplicate check
    const existing = this.dependsOn.get(taskId);
    if (existing?.has(dependsOnId)) {
      throw new DependencyError(
        DependencyErrorCode.DUPLICATE_DEPENDENCY,
        `Dependency already exists: ${taskId} -> ${dependsOnId}`,
      );
    }

    // Cycle check: would adding this edge create a cycle?
    // Check if dependsOnId can reach taskId (if so, adding taskId -> dependsOnId creates a cycle)
    const cycle = this.wouldCreateCycle(taskId, dependsOnId);
    if (cycle.hasCycle) {
      this.emit('dependency:cycle-detected', cycle.cyclePath);
      throw new DependencyError(
        DependencyErrorCode.CIRCULAR_DEPENDENCY,
        `Adding dependency ${taskId} -> ${dependsOnId} would create a cycle: ${cycle.cyclePath.join(' -> ')}`,
        { cyclePath: cycle.cyclePath },
      );
    }

    // Add the edge
    this.dependsOn.get(taskId)!.add(dependsOnId);
    this.blockedByMe.get(dependsOnId)!.add(taskId);

    const edge: DependencyEdge = {
      taskId,
      dependsOn: dependsOnId,
      addedAt: new Date(),
    };

    this.emit('dependency:added', edge);
    return edge;
  }

  /**
   * Remove a dependency between two tasks.
   */
  removeDependency(taskId: string, dependsOnId: string): boolean {
    const deps = this.dependsOn.get(taskId);
    if (!deps?.has(dependsOnId)) {
return false;
}

    deps.delete(dependsOnId);
    this.blockedByMe.get(dependsOnId)?.delete(taskId);

    this.emit('dependency:removed', taskId, dependsOnId);
    return true;
  }

  /**
   * Mark a task as completed and resolve its dependencies.
   * Any task that was only blocked by this task will have its dependency resolved.
   */
  markCompleted(taskId: string): string[] {
    this.completedTasks.add(taskId);
    const unblockedTasks: string[] = [];

    const blocking = this.blockedByMe.get(taskId);
    if (!blocking) {
return unblockedTasks;
}

    for (const blockedId of blocking) {
      this.emit('dependency:resolved', blockedId, taskId);

      // Check if all dependencies of the blocked task are now completed
      const remainingDeps = this.getUnresolvedDependencies(blockedId);
      if (remainingDeps.length === 0) {
        unblockedTasks.push(blockedId);
        this.emit('dependency:all-resolved', blockedId);
      }
    }

    return unblockedTasks;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  /**
   * Get dependency info for a task.
   */
  getDependencyInfo(taskId: string): DependencyInfo {
    return {
      blockedBy: Array.from(this.dependsOn.get(taskId) ?? []),
      blocking: Array.from(this.blockedByMe.get(taskId) ?? []),
    };
  }

  /**
   * Get the unresolved (non-completed) dependencies of a task.
   */
  getUnresolvedDependencies(taskId: string): string[] {
    const deps = this.dependsOn.get(taskId);
    if (!deps) {
return [];
}
    return Array.from(deps).filter(depId => !this.completedTasks.has(depId));
  }

  /**
   * Check if a task is fully unblocked (all dependencies completed).
   */
  isUnblocked(taskId: string): boolean {
    return this.getUnresolvedDependencies(taskId).length === 0;
  }

  /**
   * Get all tasks that are currently blocked (have unresolved dependencies).
   */
  getBlockedTasks(): string[] {
    const blocked: string[] = [];
    for (const taskId of this.knownTasks) {
      if (this.completedTasks.has(taskId)) {
continue;
}
      if (this.getUnresolvedDependencies(taskId).length > 0) {
        blocked.push(taskId);
      }
    }
    return blocked;
  }

  /**
   * Get all tasks that are ready to execute (registered, not completed, and unblocked).
   */
  getReadyTasks(): string[] {
    const ready: string[] = [];
    for (const taskId of this.knownTasks) {
      if (this.completedTasks.has(taskId)) {
continue;
}
      if (this.getUnresolvedDependencies(taskId).length === 0) {
        ready.push(taskId);
      }
    }
    return ready;
  }

  /**
   * Get the full transitive dependency chain for a task.
   * Returns all tasks that must complete (directly or indirectly) before this task.
   */
  getTransitiveDependencies(taskId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
      const deps = this.dependsOn.get(id);
      if (!deps) {
return;
}

      for (const depId of deps) {
        if (!visited.has(depId)) {
          visited.add(depId);
          result.push(depId);
          visit(depId);
        }
      }
    };

    visit(taskId);
    return result;
  }

  /**
   * Get the full set of tasks that transitively depend on this task.
   * Returns all tasks that will eventually be unblocked when this task completes.
   */
  getTransitiveDependents(taskId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
      const blocking = this.blockedByMe.get(id);
      if (!blocking) {
return;
}

      for (const blockedId of blocking) {
        if (!visited.has(blockedId)) {
          visited.add(blockedId);
          result.push(blockedId);
          visit(blockedId);
        }
      }
    };

    visit(taskId);
    return result;
  }

  // -------------------------------------------------------------------------
  // Cycle Detection & Topological Sort
  // -------------------------------------------------------------------------

  /**
   * Detect all cycles in the dependency graph.
   */
  detectCycles(): CycleDetectionResult {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const parent = new Map<string, string>();

    for (const taskId of this.knownTasks) {
      if (!visited.has(taskId)) {
        const cycle = this.dfsDetectCycle(taskId, visited, recursionStack, parent);
        if (cycle) {
          return { hasCycle: true, cyclePath: cycle };
        }
      }
    }

    return { hasCycle: false, cyclePath: [] };
  }

  /**
   * Compute a topological ordering of tasks.
   * Tasks in cycles are reported separately.
   */
  getTopologicalOrder(): TopologicalOrder {
    const inDegree = new Map<string, number>();
    for (const taskId of this.knownTasks) {
      const deps = this.dependsOn.get(taskId);
      inDegree.set(taskId, deps?.size ?? 0);
    }

    // Start with tasks that have no dependencies
    const queue: string[] = [];
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    const ordered: string[] = [];

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      ordered.push(taskId);

      // Reduce in-degree of tasks that depend on this one
      const blocking = this.blockedByMe.get(taskId);
      if (blocking) {
        for (const blockedId of blocking) {
          const currentDegree = inDegree.get(blockedId) ?? 0;
          const newDegree = currentDegree - 1;
          inDegree.set(blockedId, newDegree);
          if (newDegree === 0) {
            queue.push(blockedId);
          }
        }
      }
    }

    // Tasks not in the ordered list are part of cycles
    const cyclic = Array.from(this.knownTasks).filter(id => !ordered.includes(id));

    return { ordered, cyclic };
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Get dependency graph statistics.
   */
  getStats(): {
    totalTasks: number;
    completedTasks: number;
    totalEdges: number;
    blockedTasks: number;
    readyTasks: number;
    maxDepth: number;
  } {
    let totalEdges = 0;
    for (const deps of this.dependsOn.values()) {
      totalEdges += deps.size;
    }

    // Calculate max depth (longest chain)
    let maxDepth = 0;
    for (const taskId of this.knownTasks) {
      const depth = this.getTransitiveDependencies(taskId).length;
      if (depth > maxDepth) {
maxDepth = depth;
}
    }

    return {
      totalTasks: this.knownTasks.size,
      completedTasks: this.completedTasks.size,
      totalEdges,
      blockedTasks: this.getBlockedTasks().length,
      readyTasks: this.getReadyTasks().length,
      maxDepth,
    };
  }

  /**
   * Clear all tracked data.
   */
  clear(): void {
    this.dependsOn.clear();
    this.blockedByMe.clear();
    this.knownTasks.clear();
    this.completedTasks.clear();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Check if adding taskId -> dependsOnId would create a cycle.
   * Uses BFS from dependsOnId to see if it can reach taskId.
   */
  private wouldCreateCycle(taskId: string, dependsOnId: string): CycleDetectionResult {
    // If dependsOnId can reach taskId via existing edges, adding the new edge creates a cycle
    const visited = new Set<string>();
    const queue: string[] = [dependsOnId];
    const parent = new Map<string, string>();

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === taskId) {
        // Reconstruct the cycle path
        const cyclePath = this.reconstructPath(parent, dependsOnId, taskId);
        cyclePath.unshift(taskId);
        cyclePath.push(taskId);
        return { hasCycle: true, cyclePath };
      }

      if (visited.has(current)) {
continue;
}
      visited.add(current);

      const deps = this.dependsOn.get(current);
      if (deps) {
        for (const depId of deps) {
          if (!visited.has(depId)) {
            parent.set(depId, current);
            queue.push(depId);
          }
        }
      }
    }

    return { hasCycle: false, cyclePath: [] };
  }

  /**
   * DFS cycle detection for the full graph scan.
   */
  private dfsDetectCycle(
    taskId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    parent: Map<string, string>,
  ): string[] | null {
    visited.add(taskId);
    recursionStack.add(taskId);

    const deps = this.dependsOn.get(taskId);
    if (deps) {
      for (const depId of deps) {
        if (!visited.has(depId)) {
          parent.set(depId, taskId);
          const cycle = this.dfsDetectCycle(depId, visited, recursionStack, parent);
          if (cycle) {
return cycle;
}
        } else if (recursionStack.has(depId)) {
          // Found a cycle -- reconstruct it
          const cyclePath: string[] = [depId];
          let current = taskId;
          while (current !== depId) {
            cyclePath.unshift(current);
            current = parent.get(current) ?? depId;
          }
          cyclePath.unshift(depId);
          return cyclePath;
        }
      }
    }

    recursionStack.delete(taskId);
    return null;
  }

  /**
   * Reconstruct a path from BFS parent map.
   */
  private reconstructPath(
    parent: Map<string, string>,
    from: string,
    to: string,
  ): string[] {
    const path: string[] = [];
    let current: string | undefined = to;
    const visited = new Set<string>();

    while (current !== undefined && current !== from && !visited.has(current)) {
      visited.add(current);
      path.unshift(current);
      current = parent.get(current);
    }

    if (current === from) {
      path.unshift(from);
    }

    return path;
  }
}
