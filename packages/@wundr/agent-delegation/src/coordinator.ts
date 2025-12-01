/**
 * @wundr/agent-delegation - Hub Coordinator
 *
 * Implements the hub-and-spoke delegation pattern for multi-agent coordination.
 * The hub coordinator manages task distribution, agent lifecycle, result
 * synthesis, and audit logging.
 */

import { v4 as uuidv4 } from 'uuid';

import { AuditLogManager } from './audit-log';
import { ModelSelector } from './model-selector';
import { ResultSynthesizer } from './result-synthesizer';
import { DelegationError, DelegationErrorCode } from './types';

import type { AuditLogManagerOptions } from './audit-log';
import type { ModelSelectorOptions } from './model-selector';
import type { ResultSynthesizerOptions } from './result-synthesizer';
import type {
  AgentDefinition,
  AgentDefinitionInput,
  DelegationConfig,
  DelegationConfigInput,
  DelegationTask,
  DelegationTaskInput,
  DelegationResult,
  SynthesisResult,
  SynthesisStrategy,
  CoordinatorMetrics,
  TaskExecutor,
  ParallelDelegationRequest,
  ParallelDelegationResponse,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the hub coordinator
 */
export interface HubCoordinatorOptions {
  /** Configuration for the coordinator */
  readonly config: DelegationConfigInput;
  /** Options for audit logging */
  readonly auditOptions?: AuditLogManagerOptions;
  /** Options for model selection */
  readonly modelOptions?: ModelSelectorOptions;
  /** Options for result synthesis */
  readonly synthesizerOptions?: ResultSynthesizerOptions;
  /** Custom task executor */
  readonly taskExecutor?: TaskExecutor;
  /** Event handlers */
  readonly onTaskStarted?: (
    task: DelegationTask,
    agent: AgentDefinition
  ) => void;
  readonly onTaskCompleted?: (
    result: DelegationResult,
    agent: AgentDefinition
  ) => void;
  readonly onTaskFailed?: (
    result: DelegationResult,
    agent: AgentDefinition
  ) => void;
  readonly onSynthesisCompleted?: (synthesis: SynthesisResult) => void;
}

/**
 * Active delegation tracking
 */
interface ActiveDelegation {
  task: DelegationTask;
  agent: AgentDefinition;
  startedAt: Date;
  timeout?: NodeJS.Timeout;
}

// =============================================================================
// Hub Coordinator Class
// =============================================================================

/**
 * HubCoordinator - Central coordinator for hub-and-spoke delegation
 *
 * @example
 * ```typescript
 * const coordinator = new HubCoordinator({
 *   config: {
 *     hubAgentId: 'hub-1',
 *     maxParallelDelegations: 5,
 *     synthesisStrategy: 'merge',
 *   },
 * });
 *
 * // Register agents
 * coordinator.registerAgent({
 *   name: 'Code Reviewer',
 *   role: 'reviewer',
 *   capabilities: ['code-review', 'security-audit'],
 * });
 *
 * // Delegate a task
 * const result = await coordinator.delegateTask({
 *   description: 'Review the authentication module',
 *   requiredCapabilities: ['code-review'],
 * });
 *
 * // Parallel delegation
 * const parallelResult = await coordinator.delegateParallel({
 *   tasks: [task1, task2, task3],
 *   agents: [agent1, agent2, agent3],
 * });
 * ```
 */
export class HubCoordinator {
  private readonly config: DelegationConfig;
  private readonly auditLog: AuditLogManager;
  private readonly modelSelector: ModelSelector;
  private readonly resultSynthesizer: ResultSynthesizer;
  private readonly taskExecutor: TaskExecutor;

  private agents: Map<string, AgentDefinition> = new Map();
  private activeDelegations: Map<string, ActiveDelegation> = new Map();
  private completedResults: Map<string, DelegationResult> = new Map();
  private metrics: CoordinatorMetrics;

  private readonly onTaskStarted?: (
    task: DelegationTask,
    agent: AgentDefinition
  ) => void;
  private readonly onTaskCompleted?: (
    result: DelegationResult,
    agent: AgentDefinition
  ) => void;
  private readonly onTaskFailed?: (
    result: DelegationResult,
    agent: AgentDefinition
  ) => void;
  private readonly onSynthesisCompleted?: (synthesis: SynthesisResult) => void;

  /**
   * Creates a new HubCoordinator instance
   *
   * @param options - Configuration options
   */
  constructor(options: HubCoordinatorOptions) {
    // Initialize configuration with defaults
    this.config = {
      hubAgentId: options.config.hubAgentId,
      maxParallelDelegations: options.config.maxParallelDelegations ?? 5,
      defaultTimeout: options.config.defaultTimeout ?? 60000,
      synthesisStrategy: options.config.synthesisStrategy ?? 'merge',
      enableAuditLogging: options.config.enableAuditLogging ?? true,
      retryFailedDelegations: options.config.retryFailedDelegations ?? true,
      maxRetries: options.config.maxRetries ?? 3,
      aggregatePartialResults: options.config.aggregatePartialResults ?? true,
      modelSelectionStrategy:
        options.config.modelSelectionStrategy ?? 'balanced',
      metadata: options.config.metadata,
    };

    // Initialize components
    this.auditLog = new AuditLogManager({
      enabled: this.config.enableAuditLogging,
      ...options.auditOptions,
    });

    this.modelSelector = new ModelSelector({
      strategy: this.config.modelSelectionStrategy,
      ...options.modelOptions,
    });

    this.resultSynthesizer = new ResultSynthesizer({
      defaultStrategy: this.config.synthesisStrategy,
      ...options.synthesizerOptions,
    });

    this.taskExecutor =
      options.taskExecutor ?? this.defaultTaskExecutor.bind(this);

    // Store event handlers
    this.onTaskStarted = options.onTaskStarted;
    this.onTaskCompleted = options.onTaskCompleted;
    this.onTaskFailed = options.onTaskFailed;
    this.onSynthesisCompleted = options.onSynthesisCompleted;

    // Initialize metrics
    this.metrics = {
      totalDelegations: 0,
      successfulDelegations: 0,
      failedDelegations: 0,
      averageDuration: 0,
      totalTokensUsed: 0,
      activeAgents: 0,
      pendingTasks: 0,
      synthesisCount: 0,
      lastActivityAt: null,
    };
  }

  // ==========================================================================
  // Agent Management
  // ==========================================================================

  /**
   * Registers a new agent with the coordinator
   *
   * @param input - Agent definition input
   * @returns The registered agent with assigned ID
   */
  registerAgent(input: AgentDefinitionInput): AgentDefinition {
    const agent: AgentDefinition = {
      ...input,
      id: input.id ?? uuidv4(),
      maxConcurrentTasks: input.maxConcurrentTasks ?? 3,
    };

    this.agents.set(agent.id, agent);
    this.metrics.activeAgents = this.agents.size;

    this.auditLog.logAgentSpawned(this.config.hubAgentId, agent);

    return agent;
  }

  /**
   * Registers multiple agents
   *
   * @param inputs - Array of agent definition inputs
   * @returns Array of registered agents
   */
  registerAgents(inputs: AgentDefinitionInput[]): AgentDefinition[] {
    return inputs.map(input => this.registerAgent(input));
  }

  /**
   * Gets an agent by ID
   *
   * @param agentId - The agent ID
   * @returns The agent or undefined
   */
  getAgent(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Gets all registered agents
   *
   * @returns Array of registered agents
   */
  getAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Gets available agents that can accept tasks
   *
   * @returns Array of available agents
   */
  getAvailableAgents(): AgentDefinition[] {
    const agentTaskCounts = new Map<string, number>();

    // Count active tasks per agent
    for (const delegation of this.activeDelegations.values()) {
      const count = agentTaskCounts.get(delegation.agent.id) ?? 0;
      agentTaskCounts.set(delegation.agent.id, count + 1);
    }

    return Array.from(this.agents.values()).filter(agent => {
      const activeCount = agentTaskCounts.get(agent.id) ?? 0;
      return activeCount < agent.maxConcurrentTasks;
    });
  }

  /**
   * Removes an agent from the coordinator
   *
   * @param agentId - The agent ID to remove
   * @returns True if removed, false if not found
   */
  removeAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Cancel any active delegations for this agent
    for (const [taskId, delegation] of this.activeDelegations.entries()) {
      if (delegation.agent.id === agentId) {
        this.cancelDelegation(taskId);
      }
    }

    this.agents.delete(agentId);
    this.metrics.activeAgents = this.agents.size;

    this.auditLog.logAgentTerminated(
      this.config.hubAgentId,
      agentId,
      'Removed from coordinator'
    );

    return true;
  }

  // ==========================================================================
  // Task Delegation
  // ==========================================================================

  /**
   * Delegates a task to an appropriate agent
   *
   * @param input - Task input
   * @param correlationId - Optional correlation ID
   * @returns The delegation result
   * @throws {DelegationError} If delegation fails
   */
  async delegateTask(
    input: DelegationTaskInput,
    correlationId?: string
  ): Promise<DelegationResult> {
    // Create task
    const task = this.createTask(input);

    // Log task creation
    await this.auditLog.logDelegationCreated(
      this.config.hubAgentId,
      task,
      correlationId
    );

    // Select agent
    const agent = await this.selectAgent(task);

    // Execute delegation
    return this.executeDelegation(task, agent, correlationId);
  }

  /**
   * Delegates multiple tasks in parallel
   *
   * @param request - Parallel delegation request
   * @returns The parallel delegation response
   */
  async delegateParallel(
    request: ParallelDelegationRequest
  ): Promise<ParallelDelegationResponse> {
    const startTime = Date.now();
    const correlationId = request.correlationId ?? uuidv4();

    // Check concurrent limit
    const pendingCount = this.activeDelegations.size;
    if (
      pendingCount + request.tasks.length >
      this.config.maxParallelDelegations
    ) {
      throw new DelegationError(
        DelegationErrorCode.CONCURRENT_LIMIT_EXCEEDED,
        `Would exceed max parallel delegations (${this.config.maxParallelDelegations})`,
        { pendingCount, requestedCount: request.tasks.length }
      );
    }

    // Create tasks
    const tasks = request.tasks.map(input => this.createTask(input));

    // Register any provided agents
    for (const agentInput of request.agents) {
      if (!this.agents.has(agentInput.id ?? '')) {
        this.registerAgent(agentInput);
      }
    }

    // Execute delegations in parallel
    const delegationPromises = tasks.map(async task => {
      try {
        const agent = await this.selectAgent(task);
        return this.executeDelegation(task, agent, correlationId);
      } catch (error) {
        // Return failed result
        return this.createFailedResult(task, error as Error);
      }
    });

    const results = await Promise.all(delegationPromises);

    // Separate successes and failures
    const successful = results.filter(r => r.status === 'completed');
    const failed = results.filter(r => r.status !== 'completed');

    // Synthesize results if multiple successes
    let synthesis: SynthesisResult | undefined;
    if (successful.length > 1) {
      try {
        synthesis = await this.synthesizeResults(
          successful,
          this.config.synthesisStrategy,
          { correlationId }
        );
      } catch (error) {
        await this.auditLog.logError(
          this.config.hubAgentId,
          error as Error,
          { correlationId, phase: 'synthesis' },
          correlationId
        );
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      correlationId,
      results,
      synthesis,
      totalDuration,
      successCount: successful.length,
      failureCount: failed.length,
    };
  }

  /**
   * Cancels an active delegation
   *
   * @param taskId - The task ID to cancel
   * @returns True if cancelled, false if not found
   */
  cancelDelegation(taskId: string): boolean {
    const delegation = this.activeDelegations.get(taskId);
    if (!delegation) {
      return false;
    }

    // Clear timeout
    if (delegation.timeout) {
      clearTimeout(delegation.timeout);
    }

    // Remove from active
    this.activeDelegations.delete(taskId);
    this.metrics.pendingTasks = this.activeDelegations.size;

    // Log cancellation
    this.auditLog.logDelegationCancelled(
      this.config.hubAgentId,
      taskId,
      'Manually cancelled'
    );

    return true;
  }

  // ==========================================================================
  // Result Synthesis
  // ==========================================================================

  /**
   * Synthesizes results from multiple delegations
   *
   * @param results - Array of delegation results
   * @param strategy - Synthesis strategy
   * @param context - Additional context
   * @returns The synthesis result
   */
  async synthesizeResults(
    results: DelegationResult[],
    strategy?: SynthesisStrategy,
    context: Record<string, unknown> = {}
  ): Promise<SynthesisResult> {
    const correlationId = context['correlationId'] as string | undefined;
    const synthesisStrategy = strategy ?? this.config.synthesisStrategy;

    await this.auditLog.logSynthesisStarted(
      this.config.hubAgentId,
      results.map(r => r.taskId),
      synthesisStrategy,
      correlationId
    );

    const synthesis = await this.resultSynthesizer.synthesize(
      results,
      synthesisStrategy,
      context
    );

    await this.auditLog.logSynthesisCompleted(
      this.config.hubAgentId,
      synthesis,
      correlationId
    );

    this.metrics.synthesisCount++;
    this.metrics.lastActivityAt = new Date();

    if (this.onSynthesisCompleted) {
      this.onSynthesisCompleted(synthesis);
    }

    return synthesis;
  }

  // ==========================================================================
  // Metrics and Status
  // ==========================================================================

  /**
   * Gets coordinator metrics
   *
   * @returns Current coordinator metrics
   */
  getMetrics(): CoordinatorMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets the audit log manager
   *
   * @returns The audit log manager instance
   */
  getAuditLog(): AuditLogManager {
    return this.auditLog;
  }

  /**
   * Gets the model selector
   *
   * @returns The model selector instance
   */
  getModelSelector(): ModelSelector {
    return this.modelSelector;
  }

  /**
   * Gets the result synthesizer
   *
   * @returns The result synthesizer instance
   */
  getResultSynthesizer(): ResultSynthesizer {
    return this.resultSynthesizer;
  }

  /**
   * Gets a completed result by task ID
   *
   * @param taskId - The task ID
   * @returns The result or undefined
   */
  getResult(taskId: string): DelegationResult | undefined {
    return this.completedResults.get(taskId);
  }

  /**
   * Gets all completed results
   *
   * @returns Array of completed results
   */
  getResults(): DelegationResult[] {
    return Array.from(this.completedResults.values());
  }

  /**
   * Clears completed results
   */
  clearResults(): void {
    this.completedResults.clear();
  }

  /**
   * Shuts down the coordinator
   */
  async shutdown(): Promise<void> {
    // Cancel all active delegations
    for (const taskId of this.activeDelegations.keys()) {
      this.cancelDelegation(taskId);
    }

    // Clear all state
    this.agents.clear();
    this.completedResults.clear();
    this.metrics.activeAgents = 0;
    this.metrics.pendingTasks = 0;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Creates a task from input
   */
  private createTask(input: DelegationTaskInput): DelegationTask {
    return {
      ...input,
      id: input.id ?? uuidv4(),
      createdAt: input.createdAt ?? new Date(),
      requiredCapabilities: input.requiredCapabilities ?? [],
      priority: input.priority ?? 'medium',
    };
  }

  /**
   * Selects an appropriate agent for a task
   */
  private async selectAgent(task: DelegationTask): Promise<AgentDefinition> {
    // Check for preferred agent
    if (task.preferredAgentId) {
      const preferred = this.agents.get(task.preferredAgentId);
      if (preferred) {
        const available = this.getAvailableAgents();
        if (available.some(a => a.id === preferred.id)) {
          return preferred;
        }
      }
    }

    // Get available agents
    const available = this.getAvailableAgents();
    if (available.length === 0) {
      throw new DelegationError(
        DelegationErrorCode.NO_AVAILABLE_AGENT,
        'No agents available for task delegation'
      );
    }

    // Filter by capabilities
    let candidates = available;
    if (task.requiredCapabilities.length > 0) {
      candidates = available.filter(agent =>
        task.requiredCapabilities.every(cap => agent.capabilities.includes(cap))
      );

      if (candidates.length === 0) {
        throw new DelegationError(
          DelegationErrorCode.CAPABILITY_MISMATCH,
          'No agent has the required capabilities',
          { required: task.requiredCapabilities }
        );
      }
    }

    // Score and select best agent
    const scored = candidates.map(agent => ({
      agent,
      score: this.scoreAgent(agent, task),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored[0].agent;
  }

  /**
   * Scores an agent for a task
   */
  private scoreAgent(agent: AgentDefinition, task: DelegationTask): number {
    let score = 0;

    // Capability match score
    const matchCount = task.requiredCapabilities.filter(cap =>
      agent.capabilities.includes(cap)
    ).length;
    if (task.requiredCapabilities.length > 0) {
      score += (matchCount / task.requiredCapabilities.length) * 50;
    }

    // Extra capability bonus
    const extraCaps =
      agent.capabilities.length - task.requiredCapabilities.length;
    score += Math.min(10, extraCaps * 2);

    // Capability level bonus
    if (agent.capabilityLevels) {
      for (const cap of task.requiredCapabilities) {
        const level = agent.capabilityLevels[cap];
        if (level === 'expert') {
          score += 10;
        } else if (level === 'proficient') {
          score += 5;
        }
      }
    }

    // Current load penalty
    const activeCount = this.getAgentActiveCount(agent.id);
    score -= activeCount * 10;

    return score;
  }

  /**
   * Gets count of active tasks for an agent
   */
  private getAgentActiveCount(agentId: string): number {
    let count = 0;
    for (const delegation of this.activeDelegations.values()) {
      if (delegation.agent.id === agentId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Executes a delegation
   */
  private async executeDelegation(
    task: DelegationTask,
    agent: AgentDefinition,
    correlationId?: string
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    // Log assignment
    await this.auditLog.logDelegationAssigned(
      this.config.hubAgentId,
      task,
      agent,
      correlationId
    );

    // Set up timeout
    const timeout = task.timeout ?? agent.timeout ?? this.config.defaultTimeout;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new DelegationError(
            DelegationErrorCode.TIMEOUT,
            `Task ${task.id} timed out after ${timeout}ms`
          )
        );
      }, timeout);
    });

    // Track active delegation
    this.activeDelegations.set(task.id, {
      task,
      agent,
      startedAt: new Date(),
      timeout: timeoutHandle,
    });
    this.metrics.pendingTasks = this.activeDelegations.size;

    // Log start
    await this.auditLog.logDelegationStarted(
      this.config.hubAgentId,
      task.id,
      agent.id,
      correlationId
    );

    if (this.onTaskStarted) {
      this.onTaskStarted(task, agent);
    }

    let result: DelegationResult;

    try {
      // Execute with timeout
      result = await Promise.race([
        this.executeWithRetry(task, agent),
        timeoutPromise,
      ]);
    } catch (error) {
      result = this.createFailedResult(
        task,
        error as Error,
        agent.id,
        startTime
      );
    } finally {
      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Remove from active
      this.activeDelegations.delete(task.id);
      this.metrics.pendingTasks = this.activeDelegations.size;
    }

    // Store result
    this.completedResults.set(task.id, result);

    // Update metrics
    this.metrics.totalDelegations++;
    if (result.status === 'completed') {
      this.metrics.successfulDelegations++;
      await this.auditLog.logDelegationCompleted(
        this.config.hubAgentId,
        result,
        agent,
        correlationId
      );
      if (this.onTaskCompleted) {
        this.onTaskCompleted(result, agent);
      }
    } else {
      this.metrics.failedDelegations++;
      await this.auditLog.logDelegationFailed(
        this.config.hubAgentId,
        result,
        agent,
        correlationId
      );
      if (this.onTaskFailed) {
        this.onTaskFailed(result, agent);
      }
    }

    // Update average duration
    const totalDuration =
      this.metrics.averageDuration * (this.metrics.totalDelegations - 1);
    this.metrics.averageDuration =
      (totalDuration + result.duration) / this.metrics.totalDelegations;

    if (result.tokensUsed) {
      this.metrics.totalTokensUsed += result.tokensUsed;
    }

    this.metrics.lastActivityAt = new Date();

    return result;
  }

  /**
   * Executes task with retry logic
   */
  private async executeWithRetry(
    task: DelegationTask,
    agent: AgentDefinition
  ): Promise<DelegationResult> {
    const maxRetries = agent.retryPolicy?.maxRetries ?? this.config.maxRetries;
    const backoffMs = agent.retryPolicy?.backoffMs ?? 1000;
    const backoffMultiplier = agent.retryPolicy?.backoffMultiplier ?? 2;

    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const result = await this.taskExecutor(task, agent, task.context ?? {});
        return {
          ...result,
          retryCount,
        };
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        if (retryCount <= maxRetries && this.config.retryFailedDelegations) {
          const delay = backoffMs * Math.pow(backoffMultiplier, retryCount - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Unknown error during task execution');
  }

  /**
   * Creates a failed result
   */
  private createFailedResult(
    task: DelegationTask,
    error: Error,
    agentId?: string,
    startTime?: number
  ): DelegationResult {
    const now = new Date();
    const start = startTime ? new Date(startTime) : now;

    return {
      taskId: task.id,
      agentId: agentId ?? 'unknown',
      status: 'failed',
      error: {
        code: error instanceof DelegationError ? error.code : 'UNKNOWN_ERROR',
        message: error.message,
        details: error instanceof DelegationError ? error.details : undefined,
      },
      duration: now.getTime() - start.getTime(),
      startedAt: start,
      completedAt: now,
      retryCount: 0,
    };
  }

  /**
   * Default task executor - placeholder for actual execution
   */
  private async defaultTaskExecutor(
    task: DelegationTask,
    agent: AgentDefinition,
    _context: Record<string, unknown>
  ): Promise<DelegationResult> {
    // This is a placeholder - actual implementation would call the agent
    const startTime = new Date();

    // Simulate execution time
    await this.sleep(100);

    return {
      taskId: task.id,
      agentId: agent.id,
      status: 'completed',
      output: {
        message: `Task "${task.description}" completed by ${agent.name}`,
        agent: agent.name,
        role: agent.role,
      },
      duration: Date.now() - startTime.getTime(),
      startedAt: startTime,
      completedAt: new Date(),
      retryCount: 0,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a hub coordinator with default configuration
 *
 * @param hubAgentId - The hub agent ID
 * @returns Configured HubCoordinator instance
 */
export function createHubCoordinator(hubAgentId: string): HubCoordinator {
  return new HubCoordinator({
    config: { hubAgentId },
  });
}

/**
 * Creates a hub coordinator with custom task executor
 *
 * @param hubAgentId - The hub agent ID
 * @param executor - Custom task executor function
 * @returns Configured HubCoordinator instance
 */
export function createHubCoordinatorWithExecutor(
  hubAgentId: string,
  executor: TaskExecutor
): HubCoordinator {
  return new HubCoordinator({
    config: { hubAgentId },
    taskExecutor: executor,
  });
}

/**
 * Creates a hub coordinator optimized for parallel execution
 *
 * @param hubAgentId - The hub agent ID
 * @param maxParallel - Maximum parallel delegations
 * @returns Configured HubCoordinator instance
 */
export function createParallelCoordinator(
  hubAgentId: string,
  maxParallel: number = 10
): HubCoordinator {
  return new HubCoordinator({
    config: {
      hubAgentId,
      maxParallelDelegations: maxParallel,
      synthesisStrategy: 'merge',
    },
  });
}
