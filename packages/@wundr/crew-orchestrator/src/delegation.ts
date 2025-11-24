/**
 * @wundr/crew-orchestrator - Delegation Manager
 *
 * Handles inter-agent task delegation, including request handling,
 * member selection, and delegation chain tracking.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { CrewError, CrewErrorCode } from './types';

import type {
  CrewMember,
  DelegationRequest,
  DelegationResponse,
  DelegationStrategy,
  ExecutionContext,
  CrewEvent,
  Task,
} from './types';

/**
 * Options for delegation manager configuration
 */
export interface DelegationManagerOptions {
  readonly maxDelegationDepth?: number;
  readonly delegationTimeout?: number;
  readonly allowSelfDelegation?: boolean;
  readonly requireReason?: boolean;
  readonly strategy?: DelegationStrategy;
}

/**
 * Delegation history entry for tracking
 */
interface DelegationHistoryEntry {
  readonly request: DelegationRequest;
  readonly response?: DelegationResponse;
  readonly outcome: 'pending' | 'accepted' | 'rejected' | 'timeout';
}

/**
 * DelegationManager - Manages inter-agent task delegation
 *
 * @example
 * ```typescript
 * const delegationManager = new DelegationManager({
 *   maxDelegationDepth: 3,
 *   delegationTimeout: 30000,
 * });
 *
 * const request = await delegationManager.requestDelegation(
 *   task,
 *   fromMember,
 *   'Need specialized expertise',
 *   context
 * );
 *
 * const response = await delegationManager.processDelegation(
 *   request,
 *   availableMembers,
 *   context
 * );
 * ```
 */
export class DelegationManager extends EventEmitter {
  private pendingRequests: Map<string, DelegationRequest> = new Map();
  private delegationHistory: Map<string, DelegationHistoryEntry[]> = new Map();
  private delegationChains: Map<string, string[]> = new Map();
  private readonly options: Required<DelegationManagerOptions>;

  /**
   * Creates a new DelegationManager instance
   *
   * @param options - Configuration options
   */
  constructor(options: DelegationManagerOptions = {}) {
    super();
    this.options = {
      maxDelegationDepth: options.maxDelegationDepth ?? 5,
      delegationTimeout: options.delegationTimeout ?? 30000,
      allowSelfDelegation: options.allowSelfDelegation ?? false,
      requireReason: options.requireReason ?? true,
      strategy: options.strategy ?? this.defaultDelegationStrategy.bind(this),
    };
  }

  /**
   * Initializes the delegation manager
   */
  async initialize(): Promise<void> {
    this.pendingRequests.clear();
    this.delegationHistory.clear();
    this.delegationChains.clear();
    this.emit('initialized');
  }

  /**
   * Creates a delegation request from one member to find a suitable delegate
   *
   * @param task - The task to delegate
   * @param fromMember - The member requesting delegation
   * @param reason - Reason for delegation
   * @param context - Execution context
   * @returns The delegation request
   * @throws {CrewError} If delegation is not allowed
   */
  requestDelegation(
    task: Task,
    fromMember: CrewMember,
    reason: string,
    context: ExecutionContext,
  ): DelegationRequest {
    // Check if member is allowed to delegate
    if (!fromMember.allowDelegation) {
      throw new CrewError(
        CrewErrorCode.DELEGATION_FAILED,
        `Member ${fromMember.id} is not allowed to delegate tasks`,
      );
    }

    // Check reason requirement
    if (this.options.requireReason && !reason.trim()) {
      throw new CrewError(
        CrewErrorCode.DELEGATION_FAILED,
        'Delegation reason is required',
      );
    }

    // Check delegation depth
    const currentChain = this.delegationChains.get(task.id) ?? [];
    if (currentChain.length >= this.options.maxDelegationDepth) {
      throw new CrewError(
        CrewErrorCode.DELEGATION_FAILED,
        `Maximum delegation depth (${this.options.maxDelegationDepth}) exceeded for task ${task.id}`,
        { currentDepth: currentChain.length },
      );
    }

    // Check for circular delegation
    if (currentChain.includes(fromMember.id)) {
      throw new CrewError(
        CrewErrorCode.DELEGATION_FAILED,
        `Circular delegation detected: ${fromMember.id} is already in the delegation chain`,
        { delegationChain: currentChain },
      );
    }

    const request: DelegationRequest = {
      id: uuidv4(),
      fromMemberId: fromMember.id,
      toMemberId: '', // Will be filled when processed
      taskId: task.id,
      reason,
      context: {
        previousResults: Object.fromEntries(context.previousResults),
        delegationDepth: currentChain.length,
        originalAssignee: currentChain[0] ?? fromMember.id,
      },
      timestamp: new Date(),
    };

    this.pendingRequests.set(request.id, request);
    this.addToHistory(task.id, { request, outcome: 'pending' });

    this.emitEvent('delegation:requested', {
      requestId: request.id,
      taskId: task.id,
      fromMemberId: fromMember.id,
      reason,
    });

    return request;
  }

  /**
   * Processes a delegation request and finds a suitable member
   *
   * @param request - The delegation request
   * @param availableMembers - List of available crew members
   * @param context - Execution context
   * @returns The delegation response
   */
  async processDelegation(
    request: DelegationRequest,
    availableMembers: CrewMember[],
    context: ExecutionContext,
  ): Promise<DelegationResponse> {
    // Note: context.previousResults is available for future use in delegation decisions
    void context.previousResults;

    // Filter out the requesting member if self-delegation is not allowed
    let candidates = availableMembers;
    if (!this.options.allowSelfDelegation) {
      candidates = candidates.filter(m => m.id !== request.fromMemberId);
    }

    // Filter out members already in the delegation chain
    const currentChain = this.delegationChains.get(request.taskId) ?? [];
    candidates = candidates.filter(m => !currentChain.includes(m.id));

    // Use strategy to find best member
    const fromMember = availableMembers.find(
      m => m.id === request.fromMemberId,
    );
    if (!fromMember) {
      return this.createRejectionResponse(request, 'Original member not found');
    }

    // Create a minimal task object for the strategy
    const taskForStrategy: Task = {
      id: request.taskId,
      title: '',
      description: request.reason,
      expectedOutput: '',
      priority: 'medium',
      status: 'delegated',
      dependencies: [],
      context: request.context,
      tools: [],
      asyncExecution: false,
      humanInput: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      maxRetries: 3,
      retryCount: 0,
    };

    const selectedMember = await this.options.strategy(
      taskForStrategy,
      fromMember,
      candidates,
      context,
    );

    if (!selectedMember) {
      const response = this.createRejectionResponse(
        request,
        'No suitable member found for delegation',
      );
      this.updateHistory(request.taskId, request.id, 'rejected', response);
      this.emitEvent('delegation:rejected', {
        requestId: request.id,
        taskId: request.taskId,
        reason: response.reason,
      });
      return response;
    }

    // Update the request with the target member
    const updatedRequest: DelegationRequest = {
      ...request,
      toMemberId: selectedMember.id,
    };
    this.pendingRequests.set(request.id, updatedRequest);

    // Update delegation chain
    const newChain = [...currentChain, request.fromMemberId];
    this.delegationChains.set(request.taskId, newChain);

    const response: DelegationResponse = {
      requestId: request.id,
      accepted: true,
      reason: `Delegated to ${selectedMember.name} (${selectedMember.role})`,
      estimatedDuration: this.estimateDuration(taskForStrategy, selectedMember),
      timestamp: new Date(),
    };

    this.updateHistory(request.taskId, request.id, 'accepted', response);
    this.pendingRequests.delete(request.id);

    this.emitEvent('delegation:accepted', {
      requestId: request.id,
      taskId: request.taskId,
      toMemberId: selectedMember.id,
      delegationChain: newChain,
    });

    return response;
  }

  /**
   * Gets the delegation chain for a task
   *
   * @param taskId - The task ID
   * @returns Array of member IDs in the delegation chain
   */
  getDelegationChain(taskId: string): string[] {
    return [...(this.delegationChains.get(taskId) ?? [])];
  }

  /**
   * Gets the current delegation depth for a task
   *
   * @param taskId - The task ID
   * @returns The delegation depth
   */
  getDelegationDepth(taskId: string): number {
    return this.delegationChains.get(taskId)?.length ?? 0;
  }

  /**
   * Gets the delegation history for a task
   *
   * @param taskId - The task ID
   * @returns Array of delegation history entries
   */
  getDelegationHistory(taskId: string): DelegationHistoryEntry[] {
    return [...(this.delegationHistory.get(taskId) ?? [])];
  }

  /**
   * Checks if further delegation is allowed for a task
   *
   * @param taskId - The task ID
   * @returns True if delegation is allowed
   */
  canDelegate(taskId: string): boolean {
    const depth = this.getDelegationDepth(taskId);
    return depth < this.options.maxDelegationDepth;
  }

  /**
   * Cancels a pending delegation request
   *
   * @param requestId - The request ID to cancel
   * @returns True if cancelled successfully
   */
  cancelRequest(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return false;
    }

    this.pendingRequests.delete(requestId);
    this.updateHistory(request.taskId, requestId, 'rejected', {
      requestId,
      accepted: false,
      reason: 'Request cancelled',
      timestamp: new Date(),
    });

    return true;
  }

  /**
   * Resets the delegation chain for a task
   *
   * @param taskId - The task ID
   */
  resetDelegationChain(taskId: string): void {
    this.delegationChains.delete(taskId);
  }

  /**
   * Gets metrics about delegation activity
   *
   * @returns Delegation metrics
   */
  getMetrics(): {
    totalRequests: number;
    acceptedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    averageChainLength: number;
    maxChainLength: number;
  } {
    let totalRequests = 0;
    let acceptedRequests = 0;
    let rejectedRequests = 0;

    for (const entries of this.delegationHistory.values()) {
      for (const entry of entries) {
        totalRequests++;
        if (entry.outcome === 'accepted') {
          acceptedRequests++;
        } else if (
          entry.outcome === 'rejected' ||
          entry.outcome === 'timeout'
        ) {
          rejectedRequests++;
        }
      }
    }

    const chainLengths = Array.from(this.delegationChains.values()).map(
      chain => chain.length,
    );
    const averageChainLength =
      chainLengths.length > 0
        ? chainLengths.reduce((a, b) => a + b, 0) / chainLengths.length
        : 0;
    const maxChainLength =
      chainLengths.length > 0 ? Math.max(...chainLengths) : 0;

    return {
      totalRequests,
      acceptedRequests,
      rejectedRequests,
      pendingRequests: this.pendingRequests.size,
      averageChainLength,
      maxChainLength,
    };
  }

  /**
   * Shuts down the delegation manager
   */
  async shutdown(): Promise<void> {
    // Cancel all pending requests
    for (const request of this.pendingRequests.values()) {
      this.cancelRequest(request.id);
    }
    this.pendingRequests.clear();
    this.emit('shutdown');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Default delegation strategy - finds member with best capability match
   */
  private async defaultDelegationStrategy(
    task: Task,
    _fromMember: CrewMember,
    availableMembers: CrewMember[],
    _context: ExecutionContext,
  ): Promise<CrewMember | null> {
    if (availableMembers.length === 0) {
      return null;
    }

    // Filter to idle members only
    const idleMembers = availableMembers.filter(m => m.status === 'idle');
    if (idleMembers.length === 0) {
      return null;
    }

    // Score members based on capabilities and role
    const scoredMembers = idleMembers.map(member => {
      let score = 0;

      // Check if member has required tools
      if (task.tools && member.tools) {
        const hasTools = task.tools.filter(t => member.tools?.includes(t));
        score += hasTools.length * 10;
      }

      // Role matching
      const taskDescription = task.description.toLowerCase();
      if (taskDescription.includes(member.role)) {
        score += 20;
      }

      // Capability matching
      for (const cap of member.capabilities) {
        if (taskDescription.includes(cap.toLowerCase())) {
          score += 5;
        }
      }

      // Prefer members with delegation disabled (they won't delegate further)
      if (!member.allowDelegation) {
        score += 3;
      }

      return { member, score };
    });

    // Sort by score and return best match
    scoredMembers.sort((a, b) => b.score - a.score);
    return scoredMembers[0]?.member ?? null;
  }

  /**
   * Creates a rejection response
   */
  private createRejectionResponse(
    request: DelegationRequest,
    reason: string,
  ): DelegationResponse {
    return {
      requestId: request.id,
      accepted: false,
      reason,
      timestamp: new Date(),
    };
  }

  /**
   * Estimates task duration based on member capabilities
   */
  private estimateDuration(task: Task, member: CrewMember): number {
    // Base estimate of 5 minutes
    let estimate = 300000;

    // Reduce estimate if member has matching capabilities
    const matchingCaps = member.capabilities.filter(cap =>
      task.description.toLowerCase().includes(cap.toLowerCase()),
    );
    estimate -= matchingCaps.length * 30000;

    // Ensure minimum estimate
    return Math.max(estimate, 60000);
  }

  /**
   * Adds an entry to delegation history
   */
  private addToHistory(taskId: string, entry: DelegationHistoryEntry): void {
    const history = this.delegationHistory.get(taskId) ?? [];
    history.push(entry);
    this.delegationHistory.set(taskId, history);
  }

  /**
   * Updates a delegation history entry
   */
  private updateHistory(
    taskId: string,
    requestId: string,
    outcome: DelegationHistoryEntry['outcome'],
    response?: DelegationResponse,
  ): void {
    const history = this.delegationHistory.get(taskId) ?? [];
    const entryIndex = history.findIndex(e => e.request.id === requestId);
    if (entryIndex >= 0) {
      const existingEntry = history[entryIndex];
      if (existingEntry) {
        history[entryIndex] = { ...existingEntry, response, outcome };
        this.delegationHistory.set(taskId, history);
      }
    }
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
      crewId: '',
      timestamp: new Date(),
      data,
    };
    this.emit(type, event);
    this.emit('event', event);
  }
}
