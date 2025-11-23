/**
 * @wundr/agent-delegation - Audit Log Manager
 *
 * Provides comprehensive audit logging for delegation activities,
 * including task assignments, agent interactions, and result synthesis.
 * Supports multiple storage backends and log analysis.
 */

import { v4 as uuidv4 } from 'uuid';

import { DelegationError } from './types';

import type {
  AuditLogEntry,
  AuditEventType,
  DelegationTask,
  DelegationResult,
  AgentDefinition,
  SynthesisResult,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for configuring the audit log manager
 */
export interface AuditLogManagerOptions {
  /** Enable or disable audit logging */
  readonly enabled?: boolean;
  /** Maximum number of entries to retain in memory */
  readonly maxEntries?: number;
  /** Session identifier for grouping related logs */
  readonly sessionId?: string;
  /** Custom log handler for external storage */
  readonly logHandler?: (entry: AuditLogEntry) => Promise<void>;
  /** Log level filter */
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to include detailed context in logs */
  readonly includeContext?: boolean;
}

/**
 * Query options for retrieving audit logs
 */
export interface AuditLogQuery {
  /** Filter by event types */
  eventTypes?: AuditEventType[];
  /** Filter by hub agent ID */
  hubAgentId?: string;
  /** Filter by spoke agent ID */
  spokeAgentId?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Filter by correlation ID */
  correlationId?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Start time for date range filter */
  startTime?: Date;
  /** End time for date range filter */
  endTime?: Date;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit log statistics
 */
export interface AuditLogStats {
  totalEntries: number;
  entriesByType: Record<AuditEventType, number>;
  entriesByAgent: Record<string, number>;
  errorCount: number;
  timeRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

// =============================================================================
// Audit Log Manager Class
// =============================================================================

/**
 * AuditLogManager - Manages audit logging for delegation operations
 *
 * @example
 * ```typescript
 * const auditLog = new AuditLogManager({
 *   enabled: true,
 *   maxEntries: 10000,
 *   sessionId: 'session-123',
 * });
 *
 * await auditLog.logDelegationCreated('hub-1', task);
 * await auditLog.logDelegationCompleted('hub-1', result, agent);
 *
 * const logs = auditLog.query({ taskId: 'task-1' });
 * ```
 */
export class AuditLogManager {
  private entries: AuditLogEntry[] = [];
  private readonly options: Required<
    Omit<AuditLogManagerOptions, 'logHandler'>
  > & {
    logHandler?: (entry: AuditLogEntry) => Promise<void>;
  };

  /**
   * Creates a new AuditLogManager instance
   *
   * @param options - Configuration options
   */
  constructor(options: AuditLogManagerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      maxEntries: options.maxEntries ?? 10000,
      sessionId: options.sessionId ?? uuidv4(),
      logHandler: options.logHandler,
      logLevel: options.logLevel ?? 'info',
      includeContext: options.includeContext ?? true,
    };
  }

  /**
   * Gets the current session ID
   */
  get sessionId(): string {
    return this.options.sessionId;
  }

  /**
   * Gets whether logging is enabled
   */
  get isEnabled(): boolean {
    return this.options.enabled;
  }

  // ==========================================================================
  // Delegation Lifecycle Logging
  // ==========================================================================

  /**
   * Logs a delegation creation event
   *
   * @param hubAgentId - The hub agent creating the delegation
   * @param task - The task being delegated
   * @param correlationId - Optional correlation ID for grouping
   */
  async logDelegationCreated(
    hubAgentId: string,
    task: DelegationTask,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'delegation_created',
      hubAgentId,
      taskId: task.id,
      correlationId,
      details: {
        description: task.description,
        requiredCapabilities: task.requiredCapabilities,
        priority: task.priority,
        preferredAgentId: task.preferredAgentId,
      },
    });
  }

  /**
   * Logs a delegation assignment event
   *
   * @param hubAgentId - The hub agent ID
   * @param task - The task being assigned
   * @param agent - The agent receiving the assignment
   * @param correlationId - Optional correlation ID
   */
  async logDelegationAssigned(
    hubAgentId: string,
    task: DelegationTask,
    agent: AgentDefinition,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'delegation_assigned',
      hubAgentId,
      spokeAgentId: agent.id,
      taskId: task.id,
      correlationId,
      details: {
        agentName: agent.name,
        agentRole: agent.role,
        agentCapabilities: agent.capabilities,
      },
    });
  }

  /**
   * Logs a delegation start event
   *
   * @param hubAgentId - The hub agent ID
   * @param taskId - The task ID
   * @param agentId - The agent starting execution
   * @param correlationId - Optional correlation ID
   */
  async logDelegationStarted(
    hubAgentId: string,
    taskId: string,
    agentId: string,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'delegation_started',
      hubAgentId,
      spokeAgentId: agentId,
      taskId,
      correlationId,
      details: {
        startedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Logs a delegation completion event
   *
   * @param hubAgentId - The hub agent ID
   * @param result - The delegation result
   * @param agent - The agent that completed the task
   * @param correlationId - Optional correlation ID
   */
  async logDelegationCompleted(
    hubAgentId: string,
    result: DelegationResult,
    agent: AgentDefinition,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'delegation_completed',
      hubAgentId,
      spokeAgentId: agent.id,
      taskId: result.taskId,
      correlationId,
      details: {
        duration: result.duration,
        tokensUsed: result.tokensUsed,
        retryCount: result.retryCount,
        hasOutput: result.output !== undefined,
      },
    });
  }

  /**
   * Logs a delegation failure event
   *
   * @param hubAgentId - The hub agent ID
   * @param result - The delegation result with error
   * @param agent - The agent that failed
   * @param correlationId - Optional correlation ID
   */
  async logDelegationFailed(
    hubAgentId: string,
    result: DelegationResult,
    agent: AgentDefinition,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'delegation_failed',
      hubAgentId,
      spokeAgentId: agent.id,
      taskId: result.taskId,
      correlationId,
      details: {
        error: result.error,
        duration: result.duration,
        retryCount: result.retryCount,
      },
    });
  }

  /**
   * Logs a delegation cancellation event
   *
   * @param hubAgentId - The hub agent ID
   * @param taskId - The task ID
   * @param reason - Reason for cancellation
   * @param correlationId - Optional correlation ID
   */
  async logDelegationCancelled(
    hubAgentId: string,
    taskId: string,
    reason: string,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'delegation_cancelled',
      hubAgentId,
      taskId,
      correlationId,
      details: {
        reason,
        cancelledAt: new Date().toISOString(),
      },
    });
  }

  // ==========================================================================
  // Result and Synthesis Logging
  // ==========================================================================

  /**
   * Logs a result received event
   *
   * @param hubAgentId - The hub agent ID
   * @param result - The delegation result
   * @param correlationId - Optional correlation ID
   */
  async logResultReceived(
    hubAgentId: string,
    result: DelegationResult,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'result_received',
      hubAgentId,
      spokeAgentId: result.agentId,
      taskId: result.taskId,
      correlationId,
      details: {
        status: result.status,
        duration: result.duration,
        hasOutput: result.output !== undefined,
      },
    });
  }

  /**
   * Logs a synthesis start event
   *
   * @param hubAgentId - The hub agent ID
   * @param resultIds - IDs of results being synthesized
   * @param strategy - Synthesis strategy
   * @param correlationId - Optional correlation ID
   */
  async logSynthesisStarted(
    hubAgentId: string,
    resultIds: string[],
    strategy: string,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'synthesis_started',
      hubAgentId,
      correlationId,
      details: {
        resultCount: resultIds.length,
        resultIds,
        strategy,
      },
    });
  }

  /**
   * Logs a synthesis completion event
   *
   * @param hubAgentId - The hub agent ID
   * @param synthesis - The synthesis result
   * @param correlationId - Optional correlation ID
   */
  async logSynthesisCompleted(
    hubAgentId: string,
    synthesis: SynthesisResult,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'synthesis_completed',
      hubAgentId,
      correlationId,
      details: {
        synthesisId: synthesis.id,
        strategy: synthesis.strategy,
        inputCount: synthesis.inputResults.length,
        conflictCount: synthesis.conflicts.length,
        confidence: synthesis.confidence,
        duration: synthesis.duration,
      },
    });
  }

  // ==========================================================================
  // Model and Agent Logging
  // ==========================================================================

  /**
   * Logs a model selection event
   *
   * @param hubAgentId - The hub agent ID
   * @param taskId - The task ID
   * @param selectedModel - The selected model ID
   * @param criteria - Selection criteria used
   * @param correlationId - Optional correlation ID
   */
  async logModelSelected(
    hubAgentId: string,
    taskId: string,
    selectedModel: string,
    criteria: Record<string, unknown>,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'model_selected',
      hubAgentId,
      taskId,
      correlationId,
      details: {
        selectedModel,
        criteria,
      },
    });
  }

  /**
   * Logs an agent spawn event
   *
   * @param hubAgentId - The hub agent ID
   * @param agent - The spawned agent
   * @param correlationId - Optional correlation ID
   */
  async logAgentSpawned(
    hubAgentId: string,
    agent: AgentDefinition,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'agent_spawned',
      hubAgentId,
      spokeAgentId: agent.id,
      correlationId,
      details: {
        agentName: agent.name,
        agentRole: agent.role,
        capabilities: agent.capabilities,
      },
    });
  }

  /**
   * Logs an agent termination event
   *
   * @param hubAgentId - The hub agent ID
   * @param agentId - The terminated agent ID
   * @param reason - Reason for termination
   * @param correlationId - Optional correlation ID
   */
  async logAgentTerminated(
    hubAgentId: string,
    agentId: string,
    reason: string,
    correlationId?: string
  ): Promise<void> {
    await this.log({
      eventType: 'agent_terminated',
      hubAgentId,
      spokeAgentId: agentId,
      correlationId,
      details: {
        reason,
        terminatedAt: new Date().toISOString(),
      },
    });
  }

  // ==========================================================================
  // Error Logging
  // ==========================================================================

  /**
   * Logs an error event
   *
   * @param hubAgentId - The hub agent ID
   * @param error - The error that occurred
   * @param context - Additional context
   * @param correlationId - Optional correlation ID
   */
  async logError(
    hubAgentId: string,
    error: Error | DelegationError,
    context: Record<string, unknown> = {},
    correlationId?: string
  ): Promise<void> {
    const errorDetails: Record<string, unknown> = {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...context,
    };

    if (error instanceof DelegationError) {
      errorDetails['errorCode'] = error.code;
      errorDetails['errorDetails'] = error.details;
    }

    await this.log({
      eventType: 'error_occurred',
      hubAgentId,
      taskId: context['taskId'] as string | undefined,
      spokeAgentId: context['agentId'] as string | undefined,
      correlationId,
      details: errorDetails,
    });
  }

  // ==========================================================================
  // Query and Analysis
  // ==========================================================================

  /**
   * Queries audit logs with filters
   *
   * @param query - Query options
   * @returns Filtered audit log entries
   */
  query(query: AuditLogQuery = {}): AuditLogEntry[] {
    let results = [...this.entries];

    if (query.eventTypes && query.eventTypes.length > 0) {
      results = results.filter(e => query.eventTypes!.includes(e.eventType));
    }

    if (query.hubAgentId) {
      results = results.filter(e => e.hubAgentId === query.hubAgentId);
    }

    if (query.spokeAgentId) {
      results = results.filter(e => e.spokeAgentId === query.spokeAgentId);
    }

    if (query.taskId) {
      results = results.filter(e => e.taskId === query.taskId);
    }

    if (query.correlationId) {
      results = results.filter(e => e.correlationId === query.correlationId);
    }

    if (query.sessionId) {
      results = results.filter(e => e.sessionId === query.sessionId);
    }

    if (query.startTime) {
      results = results.filter(e => e.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      results = results.filter(e => e.timestamp <= query.endTime!);
    }

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Gets statistics about audit logs
   *
   * @returns Audit log statistics
   */
  getStats(): AuditLogStats {
    const entriesByType: Record<string, number> = {};
    const entriesByAgent: Record<string, number> = {};
    let errorCount = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const entry of this.entries) {
      // Count by type
      entriesByType[entry.eventType] =
        (entriesByType[entry.eventType] ?? 0) + 1;

      // Count by agent
      if (entry.spokeAgentId) {
        entriesByAgent[entry.spokeAgentId] =
          (entriesByAgent[entry.spokeAgentId] ?? 0) + 1;
      }

      // Count errors
      if (
        entry.eventType === 'error_occurred' ||
        entry.eventType === 'delegation_failed'
      ) {
        errorCount++;
      }

      // Track time range
      if (!earliest || entry.timestamp < earliest) {
        earliest = entry.timestamp;
      }
      if (!latest || entry.timestamp > latest) {
        latest = entry.timestamp;
      }
    }

    return {
      totalEntries: this.entries.length,
      entriesByType: entriesByType as Record<AuditEventType, number>,
      entriesByAgent,
      errorCount,
      timeRange: {
        earliest,
        latest,
      },
    };
  }

  /**
   * Gets the timeline of events for a task
   *
   * @param taskId - The task ID
   * @returns Ordered list of events for the task
   */
  getTaskTimeline(taskId: string): AuditLogEntry[] {
    return this.entries
      .filter(e => e.taskId === taskId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Gets the correlation chain for a correlation ID
   *
   * @param correlationId - The correlation ID
   * @returns Ordered list of correlated events
   */
  getCorrelationChain(correlationId: string): AuditLogEntry[] {
    return this.entries
      .filter(e => e.correlationId === correlationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Exports all audit logs
   *
   * @returns Array of all audit log entries
   */
  export(): AuditLogEntry[] {
    return [...this.entries];
  }

  /**
   * Imports audit logs
   *
   * @param entries - Entries to import
   */
  import(entries: AuditLogEntry[]): void {
    this.entries.push(...entries);
    this.enforceMaxEntries();
  }

  /**
   * Clears all audit logs
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Gets the total number of entries
   */
  get entryCount(): number {
    return this.entries.length;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Internal logging method
   */
  private async log(params: {
    eventType: AuditEventType;
    hubAgentId: string;
    spokeAgentId?: string;
    taskId?: string;
    correlationId?: string;
    details: Record<string, unknown>;
  }): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      eventType: params.eventType,
      hubAgentId: params.hubAgentId,
      spokeAgentId: params.spokeAgentId,
      taskId: params.taskId,
      correlationId: params.correlationId,
      sessionId: this.options.sessionId,
      details: this.options.includeContext ? params.details : {},
    };

    this.entries.push(entry);
    this.enforceMaxEntries();

    // Call external log handler if provided
    if (this.options.logHandler) {
      try {
        await this.options.logHandler(entry);
      } catch (error) {
        // Don't throw - audit logging should not break the main flow
        console.error('Audit log handler error:', error);
      }
    }
  }

  /**
   * Enforces the maximum entries limit
   */
  private enforceMaxEntries(): void {
    if (this.entries.length > this.options.maxEntries) {
      // Remove oldest entries
      const excess = this.entries.length - this.options.maxEntries;
      this.entries.splice(0, excess);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new audit log manager with default options
 *
 * @param sessionId - Optional session ID
 * @returns Configured AuditLogManager instance
 */
export function createAuditLog(sessionId?: string): AuditLogManager {
  return new AuditLogManager({
    enabled: true,
    sessionId,
  });
}

/**
 * Creates an audit log manager with a custom log handler
 *
 * @param handler - Custom log handler function
 * @param sessionId - Optional session ID
 * @returns Configured AuditLogManager instance
 */
export function createAuditLogWithHandler(
  handler: (entry: AuditLogEntry) => Promise<void>,
  sessionId?: string
): AuditLogManager {
  return new AuditLogManager({
    enabled: true,
    logHandler: handler,
    sessionId,
  });
}
