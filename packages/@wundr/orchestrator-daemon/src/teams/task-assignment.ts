/**
 * Task Assignment - Strategies for distributing tasks to teammates
 *
 * Provides pluggable assignment strategies for the SharedTaskList:
 * - Round-robin: Cycle through available teammates in order
 * - Capability-based: Match task requirements to teammate capabilities
 * - Load-balanced: Assign to the teammate with the fewest active tasks
 *
 * The TaskAssigner integrates with TeamCoordinator and SharedTaskList to
 * auto-assign pending tasks when teammates become idle.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssignmentStrategy =
  | 'round-robin'
  | 'capability-based'
  | 'load-balanced';

export interface TeammateCapabilities {
  readonly memberId: string;
  readonly capabilities: string[];
  readonly maxConcurrent: number;
}

export interface AssignmentCandidate {
  readonly memberId: string;
  readonly name: string;
  readonly activeTaskCount: number;
  readonly capabilities: string[];
  readonly maxConcurrent: number;
}

export interface AssignmentDecision {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly assigneeId: string;
  readonly strategy: AssignmentStrategy;
  readonly reason: string;
  readonly score: number;
}

export interface TaskAssignmentEvents {
  'assignment:decided': (decision: AssignmentDecision) => void;
  'assignment:no-candidate': (taskId: string, reason: string) => void;
  'assignment:strategy-changed': (strategy: AssignmentStrategy) => void;
}

export interface AssignableTask {
  readonly id: string;
  readonly title: string;
  readonly priority: string;
  readonly metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AssignmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AssignmentError';
  }
}

export enum AssignmentErrorCode {
  NO_CANDIDATES = 'NO_CANDIDATES',
  STRATEGY_NOT_FOUND = 'STRATEGY_NOT_FOUND',
  MEMBER_AT_CAPACITY = 'MEMBER_AT_CAPACITY',
}

// ---------------------------------------------------------------------------
// Task Assigner
// ---------------------------------------------------------------------------

export class TaskAssigner extends EventEmitter<TaskAssignmentEvents> {
  private strategy: AssignmentStrategy;

  /**
   * Tracks the round-robin index per team.
   */
  private roundRobinIndex: number = 0;

  /**
   * Registered capabilities per team member.
   */
  private readonly memberCapabilities: Map<string, TeammateCapabilities> =
    new Map();

  /**
   * Default max concurrent tasks per member if not specified.
   */
  private readonly defaultMaxConcurrent: number;

  constructor(options?: {
    strategy?: AssignmentStrategy;
    defaultMaxConcurrent?: number;
  }) {
    super();
    this.strategy = options?.strategy ?? 'load-balanced';
    this.defaultMaxConcurrent = options?.defaultMaxConcurrent ?? 3;
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Get the current assignment strategy.
   */
  getStrategy(): AssignmentStrategy {
    return this.strategy;
  }

  /**
   * Change the assignment strategy.
   */
  setStrategy(strategy: AssignmentStrategy): void {
    this.strategy = strategy;
    this.emit('assignment:strategy-changed', strategy);
  }

  /**
   * Register capabilities for a team member.
   */
  registerCapabilities(config: TeammateCapabilities): void {
    this.memberCapabilities.set(config.memberId, config);
  }

  /**
   * Remove capabilities registration for a member.
   */
  unregisterCapabilities(memberId: string): void {
    this.memberCapabilities.delete(memberId);
  }

  /**
   * Get capabilities for a member.
   */
  getCapabilities(memberId: string): TeammateCapabilities | undefined {
    return this.memberCapabilities.get(memberId);
  }

  // -------------------------------------------------------------------------
  // Assignment
  // -------------------------------------------------------------------------

  /**
   * Select the best candidate for a task based on the current strategy.
   *
   * @param task - The task to assign
   * @param candidates - Available teammates with their current workload
   * @returns The assignment decision, or null if no candidate is suitable
   */
  selectAssignee(
    task: AssignableTask,
    candidates: AssignmentCandidate[]
  ): AssignmentDecision | null {
    if (candidates.length === 0) {
      this.emit('assignment:no-candidate', task.id, 'No candidates available');
      return null;
    }

    // Filter out members at capacity
    const available = candidates.filter(c => {
      const caps = this.memberCapabilities.get(c.memberId);
      const maxConcurrent = caps?.maxConcurrent ?? c.maxConcurrent;
      return c.activeTaskCount < maxConcurrent;
    });

    if (available.length === 0) {
      this.emit(
        'assignment:no-candidate',
        task.id,
        'All candidates at capacity'
      );
      return null;
    }

    let decision: AssignmentDecision | null = null;

    switch (this.strategy) {
      case 'round-robin':
        decision = this.assignRoundRobin(task, available);
        break;
      case 'capability-based':
        decision = this.assignByCapability(task, available);
        break;
      case 'load-balanced':
        decision = this.assignLoadBalanced(task, available);
        break;
    }

    if (decision) {
      this.emit('assignment:decided', decision);
    } else {
      this.emit(
        'assignment:no-candidate',
        task.id,
        `Strategy '${this.strategy}' found no match`
      );
    }

    return decision;
  }

  /**
   * Select assignees for multiple tasks at once.
   * Simulates the assignments sequentially so load counts update correctly.
   */
  selectAssignees(
    tasks: AssignableTask[],
    candidates: AssignmentCandidate[]
  ): AssignmentDecision[] {
    const decisions: AssignmentDecision[] = [];

    // Work with mutable copies so we can track simulated assignments
    const workingCandidates = candidates.map(c => ({ ...c }));

    for (const task of tasks) {
      const decision = this.selectAssignee(task, workingCandidates);
      if (decision) {
        decisions.push(decision);

        // Update the working candidate's active count
        const candidate = workingCandidates.find(
          c => c.memberId === decision.assigneeId
        );
        if (candidate) {
          (candidate as { activeTaskCount: number }).activeTaskCount += 1;
        }
      }
    }

    return decisions;
  }

  /**
   * Reset the round-robin index.
   */
  resetRoundRobin(): void {
    this.roundRobinIndex = 0;
  }

  /**
   * Clear all capability registrations.
   */
  clear(): void {
    this.memberCapabilities.clear();
    this.roundRobinIndex = 0;
  }

  // -------------------------------------------------------------------------
  // Strategy Implementations
  // -------------------------------------------------------------------------

  /**
   * Round-robin: Assign to each teammate in turn.
   */
  private assignRoundRobin(
    task: AssignableTask,
    candidates: AssignmentCandidate[]
  ): AssignmentDecision {
    const index = this.roundRobinIndex % candidates.length;
    const selected = candidates[index];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % candidates.length;

    return {
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: selected.memberId,
      strategy: 'round-robin',
      reason: `Round-robin selection (index ${index})`,
      score: 1,
    };
  }

  /**
   * Capability-based: Match task requirements to teammate capabilities.
   *
   * The task metadata can include a `requiredCapabilities` array.
   * If no requirements are specified, falls back to load-balanced.
   */
  private assignByCapability(
    task: AssignableTask,
    candidates: AssignmentCandidate[]
  ): AssignmentDecision | null {
    const requiredCapabilities =
      (task.metadata['requiredCapabilities'] as string[] | undefined) ?? [];

    if (requiredCapabilities.length === 0) {
      // No capability requirements -- fall back to load-balanced
      return this.assignLoadBalanced(task, candidates);
    }

    // Score each candidate by how many required capabilities they have
    const scored = candidates.map(candidate => {
      const caps = this.memberCapabilities.get(candidate.memberId);
      const memberCaps = caps?.capabilities ?? candidate.capabilities;

      const matchCount = requiredCapabilities.filter(req =>
        memberCaps.some(cap => cap.toLowerCase() === req.toLowerCase())
      ).length;

      const matchRatio = matchCount / requiredCapabilities.length;

      // Tie-break by load (fewer active tasks is better)
      const loadPenalty = candidate.activeTaskCount * 0.1;
      const score = matchRatio - loadPenalty;

      return { candidate, score, matchCount };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best.matchCount === 0) {
      // No candidate has any of the required capabilities -- fall back to load-balanced
      return this.assignLoadBalanced(task, candidates);
    }

    return {
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: best.candidate.memberId,
      strategy: 'capability-based',
      reason: `Matched ${best.matchCount}/${requiredCapabilities.length} capabilities`,
      score: best.score,
    };
  }

  /**
   * Load-balanced: Assign to the teammate with the fewest active tasks.
   * Tie-break by priority weighting (higher priority tasks get assigned to less loaded members).
   */
  private assignLoadBalanced(
    task: AssignableTask,
    candidates: AssignmentCandidate[]
  ): AssignmentDecision {
    // Sort by active task count ascending, then by max concurrent descending
    const sorted = [...candidates].sort((a, b) => {
      const loadDiff = a.activeTaskCount - b.activeTaskCount;
      if (loadDiff !== 0) {
        return loadDiff;
      }

      // Prefer members with higher capacity as tie-breaker
      const capA = this.memberCapabilities.get(a.memberId);
      const capB = this.memberCapabilities.get(b.memberId);
      const maxA = capA?.maxConcurrent ?? a.maxConcurrent;
      const maxB = capB?.maxConcurrent ?? b.maxConcurrent;
      return maxB - maxA;
    });

    const selected = sorted[0];

    // Score: inverse of load ratio (0 tasks = 1.0, at capacity = 0.0)
    const caps = this.memberCapabilities.get(selected.memberId);
    const maxConcurrent = caps?.maxConcurrent ?? selected.maxConcurrent;
    const score =
      maxConcurrent > 0 ? 1 - selected.activeTaskCount / maxConcurrent : 0;

    return {
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: selected.memberId,
      strategy: 'load-balanced',
      reason: `Lowest load: ${selected.activeTaskCount} active tasks (capacity: ${maxConcurrent})`,
      score,
    };
  }
}
