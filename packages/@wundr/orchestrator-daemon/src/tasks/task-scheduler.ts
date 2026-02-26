/**
 * Task Scheduler - Agent assignment, load balancing, and dependency resolution
 *
 * The scheduler sits atop the TaskManager and provides intelligent task
 * distribution across available agents. It supports three assignment strategies:
 *
 * - round-robin:       Distributes tasks evenly regardless of capability
 * - least-loaded:      Assigns to the agent with the fewest active tasks
 * - capability-match:  Scores agents by capability fit, load, and availability
 *
 * The scheduler can run in manual mode (call autoAssign explicitly) or with
 * automatic polling intervals for both assignment and unblock checking.
 */

import { EventEmitter } from 'eventemitter3';

import { PRIORITY_WEIGHTS } from './task-types';
import { Logger } from '../utils/logger';

import type { TaskManager } from './task-manager';
import type { ManagedTask, AgentInfo, SchedulerConfig } from './task-types';

// =============================================================================
// Scorer Types
// =============================================================================

/**
 * Score breakdown for agent selection.
 */
export interface AgentScore {
  agentId: string;
  score: number;
  breakdown: {
    capabilityMatch: number;
    loadFactor: number;
    availabilityFactor: number;
    priorityBonus: number;
  };
  reasons: string[];
}

/**
 * Result of an auto-assignment cycle.
 */
export interface AssignmentResult {
  assigned: Array<{ taskId: string; agentId: string }>;
  skipped: Array<{ taskId: string; reason: string }>;
}

/**
 * Events emitted by the scheduler.
 */
export interface SchedulerEventMap {
  'scheduler:assigned': (event: {
    taskId: string;
    agentId: string;
    score: AgentScore;
  }) => void;
  'scheduler:no_agent': (event: { taskId: string; reason: string }) => void;
  'scheduler:rebalanced': (event: {
    reassignments: Array<{ taskId: string; from: string; to: string }>;
  }) => void;
  'scheduler:cycle_complete': (event: AssignmentResult) => void;
}

// =============================================================================
// TaskScheduler
// =============================================================================

/**
 * TaskScheduler manages intelligent task distribution across agents.
 *
 * @example
 * ```typescript
 * const scheduler = new TaskScheduler(taskManager, {
 *   assignmentStrategy: 'capability-match',
 *   maxTasksPerAgent: 3,
 * });
 *
 * const agents: AgentInfo[] = [
 *   { id: 'a1', name: 'Security Agent', capabilities: ['security', 'auth'],
 *     currentLoad: 1, maxLoad: 5, available: true },
 *   { id: 'a2', name: 'Frontend Agent', capabilities: ['ui', 'css'],
 *     currentLoad: 3, maxLoad: 5, available: true },
 * ];
 *
 * const result = await scheduler.autoAssign(agents);
 * // Tasks matched to best-fit agents
 * ```
 */
export class TaskScheduler extends EventEmitter<SchedulerEventMap> {
  private taskManager: TaskManager;
  private config: Required<SchedulerConfig>;
  private logger: Logger;
  private roundRobinIndex: number = 0;
  private autoAssignTimer: ReturnType<typeof setInterval> | null = null;
  private unblockCheckTimer: ReturnType<typeof setInterval> | null = null;

  /** Cached agent list for polling-based auto-assignment */
  private registeredAgents: AgentInfo[] = [];

  constructor(taskManager: TaskManager, config: SchedulerConfig = {}) {
    super();

    this.taskManager = taskManager;
    this.logger = new Logger('TaskScheduler');
    this.config = {
      maxTasksPerAgent: config.maxTasksPerAgent ?? 5,
      assignmentStrategy: config.assignmentStrategy ?? 'capability-match',
      autoAssignInterval: config.autoAssignInterval ?? 0,
      unblockCheckInterval: config.unblockCheckInterval ?? 0,
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the scheduler. If polling intervals are configured, begins
   * automatic assignment and unblock checking.
   */
  start(): void {
    if (this.config.autoAssignInterval > 0) {
      this.autoAssignTimer = setInterval(() => {
        this.autoAssign(this.registeredAgents).catch(err => {
          this.logger.error('Auto-assign cycle failed:', err);
        });
      }, this.config.autoAssignInterval);
      this.logger.info(
        `Auto-assign polling started (${this.config.autoAssignInterval}ms)`
      );
    }

    if (this.config.unblockCheckInterval > 0) {
      this.unblockCheckTimer = setInterval(() => {
        this.checkAndUnblock().catch(err => {
          this.logger.error('Unblock check failed:', err);
        });
      }, this.config.unblockCheckInterval);
      this.logger.info(
        `Unblock check polling started (${this.config.unblockCheckInterval}ms)`
      );
    }

    this.logger.info(
      `TaskScheduler started (strategy: ${this.config.assignmentStrategy})`
    );
  }

  /**
   * Stop the scheduler and clear all timers.
   */
  stop(): void {
    if (this.autoAssignTimer) {
      clearInterval(this.autoAssignTimer);
      this.autoAssignTimer = null;
    }
    if (this.unblockCheckTimer) {
      clearInterval(this.unblockCheckTimer);
      this.unblockCheckTimer = null;
    }
    this.removeAllListeners();
    this.logger.info('TaskScheduler stopped');
  }

  /**
   * Register agents for polling-based auto-assignment.
   */
  registerAgents(agents: AgentInfo[]): void {
    this.registeredAgents = [...agents];
    this.logger.debug(`Registered ${agents.length} agents`);
  }

  /**
   * Update a single agent's info (e.g., load change).
   */
  updateAgent(agent: AgentInfo): void {
    const index = this.registeredAgents.findIndex(a => a.id === agent.id);
    if (index >= 0) {
      this.registeredAgents[index] = { ...agent };
    } else {
      this.registeredAgents.push({ ...agent });
    }
  }

  /**
   * Remove an agent from the registered pool.
   */
  removeAgent(agentId: string): void {
    this.registeredAgents = this.registeredAgents.filter(a => a.id !== agentId);
  }

  // ===========================================================================
  // Core Scheduling
  // ===========================================================================

  /**
   * Select the best agent for a given task.
   *
   * @param task - The task to assign.
   * @param agents - Available agents.
   * @returns The best agent and its score, or null if no suitable agent.
   */
  selectBestAgent(
    task: ManagedTask,
    agents: AgentInfo[]
  ): { agent: AgentInfo; score: AgentScore } | null {
    switch (this.config.assignmentStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(task, agents);
      case 'least-loaded':
        return this.selectLeastLoaded(task, agents);
      case 'capability-match':
        return this.selectCapabilityMatch(task, agents);
      default:
        return this.selectCapabilityMatch(task, agents);
    }
  }

  /**
   * Run an auto-assignment cycle.
   *
   * Gets all ready tasks (pending, unblocked, unowned) and assigns each
   * to the best available agent.
   *
   * @param agents - Available agents.
   * @returns Summary of assignments made and tasks skipped.
   */
  async autoAssign(agents: AgentInfo[]): Promise<AssignmentResult> {
    const readyTasks = await this.taskManager.getReadyTasks();
    const result: AssignmentResult = { assigned: [], skipped: [] };

    if (readyTasks.length === 0 || agents.length === 0) {
      return result;
    }

    // Track load changes during this cycle to avoid over-assigning
    const loadDelta = new Map<string, number>();

    for (const task of readyTasks) {
      // Build adjusted agent list with load deltas
      const adjustedAgents = agents
        .map(a => ({
          ...a,
          currentLoad: a.currentLoad + (loadDelta.get(a.id) ?? 0),
        }))
        .filter(
          a => a.available && a.currentLoad < this.config.maxTasksPerAgent
        );

      if (adjustedAgents.length === 0) {
        result.skipped.push({
          taskId: task.id,
          reason: 'All agents at capacity',
        });
        continue;
      }

      const selection = this.selectBestAgent(task, adjustedAgents);
      if (!selection) {
        result.skipped.push({
          taskId: task.id,
          reason: 'No suitable agent found',
        });
        this.emit('scheduler:no_agent', {
          taskId: task.id,
          reason: 'No suitable agent found',
        });
        continue;
      }

      try {
        await this.taskManager.claimTask(task.id, selection.agent.id);
        loadDelta.set(
          selection.agent.id,
          (loadDelta.get(selection.agent.id) ?? 0) + 1
        );
        result.assigned.push({ taskId: task.id, agentId: selection.agent.id });
        this.emit('scheduler:assigned', {
          taskId: task.id,
          agentId: selection.agent.id,
          score: selection.score,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to assign task ${task.id} to ${selection.agent.id}:`,
          error
        );
        result.skipped.push({
          taskId: task.id,
          reason: `Assignment failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    if (result.assigned.length > 0) {
      this.logger.info(
        `Auto-assign cycle: ${result.assigned.length} assigned, ${result.skipped.length} skipped`
      );
    }

    this.emit('scheduler:cycle_complete', result);
    return result;
  }

  /**
   * Rebalance tasks across agents.
   *
   * Releases tasks from overloaded agents and re-assigns to less loaded ones.
   *
   * @param agents - Current agent pool.
   * @returns List of reassignments made.
   */
  async rebalance(
    agents: AgentInfo[]
  ): Promise<Array<{ taskId: string; from: string; to: string }>> {
    const reassignments: Array<{ taskId: string; from: string; to: string }> =
      [];

    // Find overloaded agents (over maxTasksPerAgent)
    const overloaded = agents.filter(
      a => a.currentLoad > this.config.maxTasksPerAgent
    );

    for (const agent of overloaded) {
      const excess = agent.currentLoad - this.config.maxTasksPerAgent;
      if (excess <= 0) {
        continue;
      }

      // Get this agent's in_progress tasks, ordered by priority (lowest first
      // -- we move the lowest-priority tasks)
      const agentTasks = await this.taskManager.queryTasks({
        owner: agent.id,
        status: 'in_progress',
      });

      const sortedByPriority = agentTasks.sort(
        (a, b) => PRIORITY_WEIGHTS[a.priority] - PRIORITY_WEIGHTS[b.priority]
      );

      const toRelease = sortedByPriority.slice(0, excess);

      for (const task of toRelease) {
        try {
          await this.taskManager.releaseTask(task.id);

          // Try to find a new agent
          const available = agents.filter(
            a =>
              a.id !== agent.id &&
              a.available &&
              a.currentLoad < this.config.maxTasksPerAgent
          );

          const selection = this.selectBestAgent(task, available);
          if (selection) {
            await this.taskManager.claimTask(task.id, selection.agent.id);
            reassignments.push({
              taskId: task.id,
              from: agent.id,
              to: selection.agent.id,
            });
          }
        } catch (error) {
          this.logger.warn(`Rebalance failed for task ${task.id}:`, error);
        }
      }
    }

    if (reassignments.length > 0) {
      this.logger.info(`Rebalanced ${reassignments.length} tasks`);
      this.emit('scheduler:rebalanced', { reassignments });
    }

    return reassignments;
  }

  /**
   * Check for tasks that should be unblocked.
   *
   * Scans in_progress and completed tasks and verifies that downstream
   * tasks have had their blockedBy arrays updated. This is a safety net
   * in case an event was missed.
   */
  async checkAndUnblock(): Promise<string[]> {
    const allTasks = await this.taskManager.getAllTasks();
    const completedIds = new Set(
      allTasks
        .filter(t => t.status === 'completed' || t.status === 'deleted')
        .map(t => t.id)
    );

    const unblocked: string[] = [];

    for (const task of allTasks) {
      if (task.status !== 'pending' || task.blockedBy.length === 0) {
        continue;
      }

      // Check if all blockers are completed/deleted
      const stillBlocked = task.blockedBy.filter(id => !completedIds.has(id));
      if (stillBlocked.length < task.blockedBy.length) {
        // Some blockers completed; update
        await this.taskManager.updateTask(task.id, {
          removeBlockedBy: task.blockedBy.filter(id => completedIds.has(id)),
        });

        if (stillBlocked.length === 0) {
          unblocked.push(task.id);
        }
      }
    }

    if (unblocked.length > 0) {
      this.logger.info(`Unblock check: ${unblocked.length} tasks unblocked`);
    }

    return unblocked;
  }

  /**
   * Get a topologically sorted execution order for pending tasks.
   *
   * Returns tasks in an order that respects dependency constraints:
   * a task appears only after all of its blockers.
   */
  async getExecutionOrder(): Promise<ManagedTask[]> {
    const allTasks = await this.taskManager.queryTasks({
      status: ['pending', 'in_progress'],
    });

    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const order: ManagedTask[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const task = taskMap.get(id);
      if (!task) {
        return;
      }

      // Visit blockers first
      for (const blockerId of task.blockedBy) {
        visit(blockerId);
      }

      order.push(task);
    };

    for (const task of allTasks) {
      visit(task.id);
    }

    return order;
  }

  // ===========================================================================
  // Strategy Implementations
  // ===========================================================================

  /**
   * Round-robin selection. Cycles through available agents in order.
   */
  private selectRoundRobin(
    task: ManagedTask,
    agents: AgentInfo[]
  ): { agent: AgentInfo; score: AgentScore } | null {
    const available = agents.filter(
      a => a.available && a.currentLoad < a.maxLoad
    );

    if (available.length === 0) {
      return null;
    }

    const selected = available[this.roundRobinIndex % available.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % available.length;

    return {
      agent: selected,
      score: {
        agentId: selected.id,
        score: 50, // Neutral score for round-robin
        breakdown: {
          capabilityMatch: 0,
          loadFactor: 0,
          availabilityFactor: 50,
          priorityBonus: 0,
        },
        reasons: ['Round-robin selection'],
      },
    };
  }

  /**
   * Least-loaded selection. Picks the agent with the lowest current load.
   */
  private selectLeastLoaded(
    task: ManagedTask,
    agents: AgentInfo[]
  ): { agent: AgentInfo; score: AgentScore } | null {
    const available = agents.filter(
      a => a.available && a.currentLoad < a.maxLoad
    );

    if (available.length === 0) {
      return null;
    }

    // Sort by load ascending
    const sorted = [...available].sort((a, b) => {
      const aLoad = a.currentLoad / a.maxLoad;
      const bLoad = b.currentLoad / b.maxLoad;
      return aLoad - bLoad;
    });

    const selected = sorted[0];
    const loadPct = selected.currentLoad / selected.maxLoad;

    return {
      agent: selected,
      score: {
        agentId: selected.id,
        score: 100 * (1 - loadPct),
        breakdown: {
          capabilityMatch: 0,
          loadFactor: 100 * (1 - loadPct),
          availabilityFactor: 0,
          priorityBonus: 0,
        },
        reasons: [`Least loaded: ${(loadPct * 100).toFixed(0)}% utilized`],
      },
    };
  }

  /**
   * Capability-match selection. Scores each agent on four factors:
   *
   * - Capability match (0-40): How well agent capabilities match the task
   * - Load factor (0-30): Inverse of current load percentage
   * - Availability (0-20): Whether the agent is available
   * - Priority bonus (0-10): Higher-priority tasks get a bonus for better agents
   */
  private selectCapabilityMatch(
    task: ManagedTask,
    agents: AgentInfo[]
  ): { agent: AgentInfo; score: AgentScore } | null {
    const available = agents.filter(
      a => a.available && a.currentLoad < a.maxLoad
    );

    if (available.length === 0) {
      return null;
    }

    const scores: Array<{ agent: AgentInfo; score: AgentScore }> = [];

    for (const agent of available) {
      const breakdown = {
        capabilityMatch: 0,
        loadFactor: 0,
        availabilityFactor: 0,
        priorityBonus: 0,
      };
      const reasons: string[] = [];

      // 1. Capability match (0-40)
      const capScore = this.scoreCapabilityMatch(agent, task);
      breakdown.capabilityMatch = capScore;
      if (capScore > 30) {
        reasons.push('Excellent capability match');
      } else if (capScore > 20) {
        reasons.push('Good capability match');
      } else if (capScore > 10) {
        reasons.push('Moderate capability match');
      } else {
        reasons.push('Weak capability match');
      }

      // 2. Load factor (0-30)
      const loadPct = agent.currentLoad / agent.maxLoad;
      const loadScore = Math.max(0, 30 * (1 - loadPct));
      breakdown.loadFactor = loadScore;

      if (loadPct < 0.3) {
        reasons.push('Low current load');
      } else if (loadPct < 0.6) {
        reasons.push('Moderate current load');
      } else {
        reasons.push('High current load');
      }

      // 3. Availability (0-20)
      breakdown.availabilityFactor = agent.available ? 20 : 0;

      // 4. Priority bonus (0-10)
      const priorityMap: Record<string, number> = {
        critical: 10,
        high: 7,
        medium: 4,
        low: 0,
      };
      breakdown.priorityBonus = priorityMap[task.priority] ?? 0;

      const totalScore =
        breakdown.capabilityMatch +
        breakdown.loadFactor +
        breakdown.availabilityFactor +
        breakdown.priorityBonus;

      scores.push({
        agent,
        score: {
          agentId: agent.id,
          score: totalScore,
          breakdown,
          reasons,
        },
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score.score - a.score.score);

    return scores[0] ?? null;
  }

  /**
   * Score how well an agent's capabilities match a task.
   *
   * Checks the task's subject, description, and metadata for keywords
   * matching agent capabilities.
   */
  private scoreCapabilityMatch(agent: AgentInfo, task: ManagedTask): number {
    if (agent.capabilities.length === 0) {
      return 10; // Base score for agents without declared capabilities
    }

    let score = 0;
    const searchText = `${task.subject} ${task.description}`.toLowerCase();

    // Check each capability against the task text
    for (const cap of agent.capabilities) {
      if (searchText.includes(cap.toLowerCase())) {
        score += 10;
      }
    }

    // Check metadata for capability hints
    const requiredCaps = task.metadata['requiredCapabilities'] as
      | string[]
      | undefined;
    if (requiredCaps && Array.isArray(requiredCaps)) {
      const matched = requiredCaps.filter(rc =>
        agent.capabilities.some(ac => ac.toLowerCase() === rc.toLowerCase())
      );
      score += (matched.length / requiredCaps.length) * 20;
    }

    // Cap at 40
    return Math.min(score, 40);
  }
}
