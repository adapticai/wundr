/**
 * @wundr/crew-orchestrator - AgentCrew
 *
 * Main orchestration class for CrewAI-style multi-agent team coordination.
 * Supports sequential, hierarchical, and consensus process execution.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { DelegationManager } from './delegation';
import { ReviewLoopManager } from './review-loop';
import { TaskManager } from './task-manager';
import {
  CrewError,
  CrewErrorCode,
  CrewConfigSchema,
  CrewMemberSchema,
} from './types';

import type { DelegationManagerOptions } from './delegation';
import type { ReviewLoopOptions } from './review-loop';
import type { TaskManagerOptions } from './task-manager';
import type {
  CrewConfig,
  CrewConfigInput,
  CrewMember,
  CrewMemberInput,
  CrewMemberStatus,
  CrewResult,
  Task,
  TaskInput,
  TaskResult,
  ExecutionContext,
  CrewEvent,
  TaskExecutor,
  StepCallbackData,
  TaskCallbackData,
} from './types';

/**
 * Options for AgentCrew configuration
 */
export interface AgentCrewOptions {
  readonly taskManager?: TaskManagerOptions;
  readonly delegation?: DelegationManagerOptions;
  readonly reviewLoop?: ReviewLoopOptions;
  readonly defaultExecutor?: TaskExecutor;
  readonly maxConcurrentTasks?: number;
  readonly executionTimeout?: number;
}

/**
 * AgentCrew - Main orchestration class for multi-agent teams
 *
 * @example
 * ```typescript
 * const crew = new AgentCrew({
 *   name: 'Research Team',
 *   description: 'A team for research tasks',
 *   members: [
 *     { name: 'Researcher', role: 'researcher', goal: 'Find information', capabilities: ['search'] },
 *     { name: 'Writer', role: 'writer', goal: 'Write reports', capabilities: ['writing'] },
 *   ],
 *   process: 'sequential',
 * });
 *
 * await crew.initialize();
 *
 * const result = await crew.kickoff([
 *   { title: 'Research Topic', description: 'Research AI trends', expectedOutput: 'Report' },
 *   { title: 'Write Summary', description: 'Summarize findings', expectedOutput: 'Summary document' },
 * ]);
 * ```
 */
export class AgentCrew extends EventEmitter {
  private config: CrewConfig;
  private members: Map<string, CrewMember> = new Map();
  private taskManager: TaskManager;
  private delegationManager: DelegationManager;
  private reviewLoopManager: ReviewLoopManager;
  private executionContext: ExecutionContext | null = null;
  private isRunning = false;
  private readonly options: AgentCrewOptions;
  private defaultExecutor: TaskExecutor;

  /**
   * Creates a new AgentCrew instance
   *
   * @param configInput - Crew configuration
   * @param options - Additional options
   */
  constructor(configInput: CrewConfigInput, options: AgentCrewOptions = {}) {
    super();
    this.options = options;

    // Validate and create config
    const now = new Date();
    const configData = {
      id: configInput.id ?? uuidv4(),
      name: configInput.name,
      description: configInput.description,
      members: configInput.members.map(m => this.createMember(m)),
      tasks: configInput.tasks ?? [],
      process: configInput.process ?? 'sequential',
      verbose: configInput.verbose ?? false,
      memory: configInput.memory ?? true,
      maxRpm: configInput.maxRpm,
      shareCrewContext: configInput.shareCrewContext ?? true,
      functionCallingLlm: configInput.functionCallingLlm,
      stepCallback: configInput.stepCallback,
      taskCallback: configInput.taskCallback,
      managerLlm: configInput.managerLlm,
      managerAgent: configInput.managerAgent,
      planningLlm: configInput.planningLlm,
      embedder: configInput.embedder,
      createdAt: configInput.createdAt ?? now,
      updatedAt: configInput.updatedAt ?? now,
    };

    const parseResult = CrewConfigSchema.safeParse(configData);
    if (!parseResult.success) {
      throw new CrewError(
        CrewErrorCode.INVALID_CONFIG,
        `Invalid crew configuration: ${parseResult.error.message}`,
        { validationErrors: parseResult.error.errors },
      );
    }

    this.config = parseResult.data;

    // Initialize managers
    this.taskManager = new TaskManager(options.taskManager);
    this.delegationManager = new DelegationManager(options.delegation);
    this.reviewLoopManager = new ReviewLoopManager(options.reviewLoop);

    // Set default executor
    this.defaultExecutor =
      options.defaultExecutor ?? this.placeholderExecutor.bind(this);

    // Initialize members map
    for (const member of this.config.members) {
      this.members.set(member.id, member);
    }

    // Forward events from managers
    this.setupEventForwarding();
  }

  /**
   * Initializes the crew and all managers
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.taskManager.initialize(),
      this.delegationManager.initialize(),
      this.reviewLoopManager.initialize(),
    ]);

    this.emit('initialized', { crewId: this.config.id });
  }

  /**
   * Kicks off crew execution with the given tasks
   *
   * @param taskInputs - Array of tasks to execute
   * @param executor - Optional custom task executor
   * @returns Crew execution result
   */
  async kickoff(
    taskInputs: TaskInput[],
    executor?: TaskExecutor,
  ): Promise<CrewResult> {
    if (this.isRunning) {
      throw new CrewError(
        CrewErrorCode.TASK_EXECUTION_FAILED,
        'Crew is already running',
      );
    }

    this.isRunning = true;
    const startTime = new Date();
    const taskExecutor = executor ?? this.defaultExecutor;

    // Initialize execution context
    this.executionContext = this.createExecutionContext();

    // Create tasks
    const tasks = taskInputs.map(input => this.taskManager.createTask(input));

    // Validate task dependencies
    this.taskManager.validateDependencies(tasks);

    this.emitEvent('crew:started', {
      crewId: this.config.id,
      taskCount: tasks.length,
      process: this.config.process,
    });

    let results: TaskResult[];
    try {
      // Execute based on process type
      switch (this.config.process) {
        case 'sequential':
          results = await this.executeSequential(tasks, taskExecutor);
          break;
        case 'hierarchical':
          results = await this.executeHierarchical(tasks, taskExecutor);
          break;
        case 'consensus':
          results = await this.executeConsensus(tasks, taskExecutor);
          break;
        default:
          throw new CrewError(
            CrewErrorCode.INVALID_CONFIG,
            `Unknown process type: ${this.config.process}`,
          );
      }
    } catch (error) {
      this.isRunning = false;
      this.emitEvent('crew:error', {
        crewId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const endTime = new Date();
    this.isRunning = false;

    // Build final result
    const crewResult = this.buildCrewResult(results, startTime, endTime);

    this.emitEvent('crew:completed', {
      crewId: this.config.id,
      success: crewResult.success,
      duration: crewResult.totalDuration,
    });

    return crewResult;
  }

  /**
   * Adds a new member to the crew
   *
   * @param memberInput - Member configuration
   * @returns The created member
   */
  addMember(memberInput: CrewMemberInput): CrewMember {
    const member = this.createMember(memberInput);
    this.members.set(member.id, member);
    this.config = {
      ...this.config,
      members: [...this.config.members, member],
      updatedAt: new Date(),
    };
    return member;
  }

  /**
   * Removes a member from the crew
   *
   * @param memberId - The member ID to remove
   * @returns True if member was removed
   */
  removeMember(memberId: string): boolean {
    if (!this.members.has(memberId)) {
      return false;
    }

    this.members.delete(memberId);
    this.config = {
      ...this.config,
      members: this.config.members.filter(m => m.id !== memberId),
      updatedAt: new Date(),
    };
    return true;
  }

  /**
   * Gets a member by ID
   *
   * @param memberId - The member ID
   * @returns The member or undefined
   */
  getMember(memberId: string): CrewMember | undefined {
    return this.members.get(memberId);
  }

  /**
   * Gets all crew members
   *
   * @returns Array of all members
   */
  getAllMembers(): CrewMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Updates a member's status
   *
   * @param memberId - The member ID
   * @param status - The new status
   */
  updateMemberStatus(memberId: string, status: CrewMemberStatus): void {
    const member = this.members.get(memberId);
    if (member) {
      const updatedMember: CrewMember = { ...member, status };
      this.members.set(memberId, updatedMember);

      this.emitEvent('member:status_changed', {
        memberId,
        previousStatus: member.status,
        newStatus: status,
      });
    }
  }

  /**
   * Gets the crew configuration
   *
   * @returns The crew configuration
   */
  getConfig(): CrewConfig {
    return { ...this.config };
  }

  /**
   * Gets the current execution context
   *
   * @returns The execution context or null if not running
   */
  getExecutionContext(): ExecutionContext | null {
    return this.executionContext;
  }

  /**
   * Checks if the crew is currently executing
   *
   * @returns True if running
   */
  isExecuting(): boolean {
    return this.isRunning;
  }

  /**
   * Gets available (idle) members
   *
   * @returns Array of idle members
   */
  getAvailableMembers(): CrewMember[] {
    return Array.from(this.members.values()).filter(m => m.status === 'idle');
  }

  /**
   * Gets the manager member (for hierarchical process)
   *
   * @returns The manager member or undefined
   */
  getManager(): CrewMember | undefined {
    if (this.config.managerAgent) {
      return this.members.get(this.config.managerAgent);
    }
    return Array.from(this.members.values()).find(m => m.role === 'manager');
  }

  /**
   * Sets a custom task executor
   *
   * @param executor - The task executor function
   */
  setExecutor(executor: TaskExecutor): void {
    this.defaultExecutor = executor;
  }

  /**
   * Shuts down the crew and all managers
   */
  async shutdown(): Promise<void> {
    this.isRunning = false;
    await Promise.all([
      this.taskManager.shutdown(),
      this.delegationManager.shutdown(),
      this.reviewLoopManager.shutdown(),
    ]);
    this.emit('shutdown');
  }

  // ==========================================================================
  // Process Execution Methods
  // ==========================================================================

  /**
   * Executes tasks sequentially
   */
  private async executeSequential(
    tasks: Task[],
    executor: TaskExecutor,
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];

    for (const task of tasks) {
      // Find best member for task
      const member = await this.taskManager.assignTask(
        task.id,
        this.getAvailableMembers(),
        this.executionContext!,
      );

      if (!member) {
        throw new CrewError(
          CrewErrorCode.NO_AVAILABLE_MEMBER,
          `No available member for task: ${task.id}`,
        );
      }

      // Execute task
      const result = await this.executeTask(task, member, executor);
      results.push(result);

      // Store result in context
      this.executionContext!.previousResults.set(task.id, result);

      // Handle failure with retry
      if (!result.success) {
        const canRetry = this.taskManager.retryTask(task.id);
        if (!canRetry) {
          // Continue to next task or fail based on configuration
          if (this.config.verbose) {
            this.emitEvent('task:retry_exhausted', {
              taskId: task.id,
            });
          }
        }
      }

      // Record result
      this.taskManager.recordResult(task.id, result);
    }

    return results;
  }

  /**
   * Executes tasks with hierarchical manager oversight
   */
  private async executeHierarchical(
    tasks: Task[],
    executor: TaskExecutor,
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const manager = this.getManager();

    if (!manager) {
      throw new CrewError(
        CrewErrorCode.MEMBER_NOT_FOUND,
        'No manager found for hierarchical process',
      );
    }

    for (const task of tasks) {
      // Assign task to worker
      const workers = this.getAvailableMembers().filter(
        m => m.id !== manager.id,
      );
      const worker = await this.taskManager.assignTask(
        task.id,
        workers,
        this.executionContext!,
      );

      if (!worker) {
        throw new CrewError(
          CrewErrorCode.NO_AVAILABLE_MEMBER,
          `No available worker for task: ${task.id}`,
        );
      }

      let result = await this.executeTask(task, worker, executor);

      // Manager review loop
      while (this.reviewLoopManager.canReview(task.id)) {
        const feedback = await this.reviewLoopManager.submitForReview(
          task,
          result,
          manager,
          this.executionContext!,
        );

        if (feedback.decision === 'approved') {
          break;
        }

        if (feedback.decision === 'rejected') {
          result = {
            ...result,
            success: false,
            error: {
              code: 'REVIEW_REJECTED',
              message: feedback.feedback,
              details: { suggestedChanges: feedback.suggestedChanges },
            },
          };
          break;
        }

        if (feedback.decision === 'needs_revision') {
          // Check for delegation
          if (
            worker.allowDelegation &&
            this.delegationManager.canDelegate(task.id)
          ) {
            const delegationRequest = this.delegationManager.requestDelegation(
              task,
              worker,
              feedback.feedback,
              this.executionContext!,
            );

            const delegationResponse =
              await this.delegationManager.processDelegation(
                delegationRequest,
                workers.filter(w => w.id !== worker.id),
                this.executionContext!,
              );

            if (delegationResponse.accepted) {
              const delegateMemberId = this.delegationManager
                .getDelegationChain(task.id)
                .pop();
              if (delegateMemberId) {
                const delegate = this.members.get(delegateMemberId);
                if (delegate) {
                  result = await this.executeTask(task, delegate, executor);
                  continue;
                }
              }
            }
          }

          // Re-execute with same worker
          result = await this.executeTask(task, worker, executor);
        }

        if (feedback.decision === 'escalate') {
          // Manager takes over
          result = await this.executeTask(task, manager, executor);
          break;
        }
      }

      results.push(result);
      this.executionContext!.previousResults.set(task.id, result);
      this.taskManager.recordResult(task.id, result);
    }

    return results;
  }

  /**
   * Executes tasks with consensus voting
   */
  private async executeConsensus(
    tasks: Task[],
    executor: TaskExecutor,
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const minVoters = Math.ceil(this.members.size / 2) + 1;

    for (const task of tasks) {
      const availableMembers = this.getAvailableMembers();

      if (availableMembers.length < minVoters) {
        throw new CrewError(
          CrewErrorCode.CONSENSUS_FAILED,
          `Not enough members for consensus: need ${minVoters}, have ${availableMembers.length}`,
        );
      }

      // Execute task with multiple members
      const memberResults: TaskResult[] = [];
      const voters = availableMembers.slice(
        0,
        Math.min(availableMembers.length, 3),
      );

      for (const member of voters) {
        const memberResult = await this.executeTask(task, member, executor);
        memberResults.push(memberResult);
      }

      // Determine consensus
      const successCount = memberResults.filter(r => r.success).length;
      const consensusReached = successCount >= Math.ceil(voters.length / 2);

      // Select best result
      const bestResult = memberResults
        .filter(r => r.success === consensusReached)
        .sort((a, b) => b.iterationsUsed - a.iterationsUsed)[0];

      if (!bestResult) {
        throw new CrewError(
          CrewErrorCode.CONSENSUS_FAILED,
          `Failed to reach consensus for task: ${task.id}`,
        );
      }

      // Add delegation chain to show consensus
      const consensusResult: TaskResult = {
        ...bestResult,
        delegationChain: voters.map(v => v.id),
      };

      results.push(consensusResult);
      this.executionContext!.previousResults.set(task.id, consensusResult);
      this.taskManager.recordResult(task.id, consensusResult);
    }

    return results;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Executes a single task with a member
   */
  private async executeTask(
    task: Task,
    member: CrewMember,
    executor: TaskExecutor,
  ): Promise<TaskResult> {
    const startTime = new Date();
    this.updateMemberStatus(member.id, 'working');
    this.taskManager.updateTaskStatus(task.id, 'in_progress');

    this.emitEvent('task:started', {
      taskId: task.id,
      memberId: member.id,
    });

    try {
      const result = await executor(task, member, this.executionContext!);
      this.updateMemberStatus(member.id, 'idle');

      this.emitEvent('task:completed', {
        taskId: task.id,
        memberId: member.id,
        success: result.success,
      });

      // Call task callback if configured
      if (this.config.taskCallback) {
        const callbackData: TaskCallbackData = {
          task,
          result,
          member,
        };
        this.config.taskCallback(callbackData);
      }

      return result;
    } catch (error) {
      this.updateMemberStatus(member.id, 'error');

      const errorResult: TaskResult = {
        taskId: task.id,
        success: false,
        output: null,
        error: {
          code: CrewErrorCode.TASK_EXECUTION_FAILED,
          message: error instanceof Error ? error.message : String(error),
        },
        executedBy: member.id,
        delegationChain: this.delegationManager.getDelegationChain(task.id),
        iterationsUsed: 1,
        duration: Date.now() - startTime.getTime(),
        startedAt: startTime,
        completedAt: new Date(),
        reviewHistory: [],
      };

      this.emitEvent('task:failed', {
        taskId: task.id,
        memberId: member.id,
        error: errorResult.error,
      });

      return errorResult;
    }
  }

  /**
   * Placeholder executor for demonstration
   */
  private async placeholderExecutor(
    task: Task,
    member: CrewMember,
    _context: ExecutionContext,
  ): Promise<TaskResult> {
    const startTime = new Date();

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      taskId: task.id,
      success: true,
      output: {
        message: `Task "${task.title}" completed by ${member.name}`,
        expectedOutput: task.expectedOutput,
      },
      executedBy: member.id,
      delegationChain: [],
      iterationsUsed: 1,
      duration: Date.now() - startTime.getTime(),
      startedAt: startTime,
      completedAt: new Date(),
      reviewHistory: [],
    };
  }

  /**
   * Creates a crew member from input
   */
  private createMember(input: CrewMemberInput): CrewMember {
    const memberData = {
      id: input.id ?? uuidv4(),
      name: input.name,
      role: input.role,
      goal: input.goal,
      backstory: input.backstory,
      capabilities: input.capabilities,
      tools: input.tools ?? [],
      allowDelegation: input.allowDelegation ?? true,
      verbose: input.verbose ?? false,
      memory: input.memory ?? true,
      maxIterations: input.maxIterations ?? 10,
      status: input.status ?? 'idle',
      metadata: input.metadata ?? {},
    };

    const parseResult = CrewMemberSchema.safeParse(memberData);
    if (!parseResult.success) {
      throw new CrewError(
        CrewErrorCode.INVALID_CONFIG,
        `Invalid member configuration: ${parseResult.error.message}`,
        { validationErrors: parseResult.error.errors },
      );
    }

    return parseResult.data;
  }

  /**
   * Creates initial execution context
   */
  private createExecutionContext(): ExecutionContext {
    return {
      crewId: this.config.id,
      currentTaskId: undefined,
      previousResults: new Map(),
      sharedMemory: new Map(),
      delegationHistory: [],
      reviewHistory: [],
      startTime: new Date(),
      metrics: {
        tasksStarted: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        delegationCount: 0,
        reviewCount: 0,
        totalIterations: 0,
        totalTokens: 0,
        averageTaskDuration: 0,
      },
    };
  }

  /**
   * Builds the final crew result
   */
  private buildCrewResult(
    taskResults: TaskResult[],
    startTime: Date,
    endTime: Date,
  ): CrewResult {
    const memberMetrics: CrewResult['memberMetrics'] = {};

    // Calculate per-member metrics
    for (const member of this.members.values()) {
      const memberTasks = taskResults.filter(r => r.executedBy === member.id);
      const completed = memberTasks.filter(r => r.success).length;
      const failed = memberTasks.filter(r => !r.success).length;
      const delegationsReceived = taskResults.filter(r =>
        r.delegationChain.includes(member.id),
      ).length;
      const delegationsSent = taskResults.filter(
        r => r.delegationChain[0] === member.id && r.delegationChain.length > 1,
      ).length;
      const totalDuration = memberTasks.reduce((sum, r) => sum + r.duration, 0);
      const avgIterations =
        memberTasks.length > 0
          ? memberTasks.reduce((sum, r) => sum + r.iterationsUsed, 0) /
            memberTasks.length
          : 0;

      memberMetrics[member.id] = {
        tasksCompleted: completed,
        tasksFailed: failed,
        delegationsReceived,
        delegationsSent,
        totalDuration,
        averageIterations: avgIterations,
      };
    }

    const success = taskResults.every(r => r.success);
    const totalIterations = taskResults.reduce(
      (sum, r) => sum + r.iterationsUsed,
      0,
    );
    const totalTokens = taskResults.reduce(
      (sum, r) => sum + (r.tokensUsed ?? 0),
      0,
    );

    // Get final output from last task
    const lastResult = taskResults[taskResults.length - 1];

    // Collect errors
    const errors = taskResults
      .filter(r => r.error)
      .map(r => ({
        taskId: r.taskId,
        memberId: r.executedBy,
        code: r.error!.code,
        message: r.error!.message,
        timestamp: r.completedAt,
      }));

    return {
      crewId: this.config.id,
      success,
      tasks: taskResults,
      finalOutput: lastResult?.output,
      totalDuration: endTime.getTime() - startTime.getTime(),
      totalIterations,
      totalTokensUsed: totalTokens > 0 ? totalTokens : undefined,
      startedAt: startTime,
      completedAt: endTime,
      memberMetrics,
      errors,
    };
  }

  /**
   * Sets up event forwarding from managers
   */
  private setupEventForwarding(): void {
    this.taskManager.on('event', (event: CrewEvent) => {
      this.emit(event.type, { ...event, crewId: this.config.id });
    });

    this.delegationManager.on('event', (event: CrewEvent) => {
      this.emit(event.type, { ...event, crewId: this.config.id });
    });

    this.reviewLoopManager.on('event', (event: CrewEvent) => {
      this.emit(event.type, { ...event, crewId: this.config.id });
    });
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
      crewId: this.config.id,
      timestamp: new Date(),
      data,
    };
    this.emit(type, event);
    this.emit('event', event);

    // Call step callback if configured
    if (this.config.stepCallback) {
      const stepData: StepCallbackData = {
        type: event.type,
        crewId: event.crewId,
        timestamp: event.timestamp,
        data: event.data,
      };
      this.config.stepCallback(stepData);
    }
  }
}
