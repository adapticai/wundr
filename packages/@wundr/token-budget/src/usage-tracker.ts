/**
 * @wundr.io/token-budget - Usage Tracker
 *
 * Session-based token usage tracking with aggregation, filtering, and export capabilities.
 * Supports real-time monitoring and historical analysis of token consumption.
 */

import { CostCalculator } from './cost-calculator';
import { TokenUsageSchema, SessionUsageSummarySchema } from './types';

import type {
  TokenUsage,
  SessionUsageSummary,
  RecordUsageOptions,
  GetUsageHistoryOptions,
  BudgetEvent,
  BudgetEventHandler,
} from './types';

// ============================================================================
// Usage Tracker Class
// ============================================================================

/**
 * Token usage tracker for AI agent sessions
 *
 * @example
 * ```typescript
 * const tracker = new UsageTracker({
 *   sessionId: 'session-123',
 *   agentId: 'agent-456',
 * });
 *
 * // Record usage
 * tracker.recordUsage({
 *   model: 'claude-sonnet-4-20250514',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 * });
 *
 * // Get summary
 * const summary = tracker.getSessionSummary();
 * ```
 */
export class UsageTracker {
  private sessionId: string;
  private agentId?: string;
  private usageRecords: TokenUsage[];
  private costCalculator: CostCalculator;
  private startTime: Date;
  private eventHandlers: Set<BudgetEventHandler>;
  private isActive: boolean;

  /**
   * Creates a new UsageTracker instance
   *
   * @param options - Tracker options
   */
  constructor(options: UsageTrackerOptions = {}) {
    this.sessionId = options.sessionId || this.generateSessionId();
    this.agentId = options.agentId;
    this.usageRecords = [];
    this.costCalculator = options.costCalculator || new CostCalculator();
    this.startTime = new Date();
    this.eventHandlers = new Set();
    this.isActive = true;
  }

  /**
   * Records a token usage event
   *
   * @param options - Usage recording options
   * @returns The recorded usage entry
   */
  recordUsage(options: RecordUsageOptions): TokenUsage {
    if (!this.isActive) {
      throw new UsageTrackingError('Cannot record usage on inactive session');
    }

    const cost = this.costCalculator.calculateCost({
      model: options.model,
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      cacheHit: options.cacheHit,
    });

    const usage: TokenUsage = {
      id: this.generateUsageId(),
      timestamp: new Date(),
      model: options.model,
      inputTokens: options.inputTokens,
      outputTokens: options.outputTokens,
      totalTokens: options.inputTokens + options.outputTokens,
      costUsd: cost,
      sessionId: this.sessionId,
      agentId: this.agentId,
      taskId: options.taskId,
      operationType: options.operationType || 'chat',
      cacheHit: options.cacheHit || false,
      metadata: options.metadata || {},
    };

    // Validate with Zod schema
    TokenUsageSchema.parse(usage);

    this.usageRecords.push(usage);

    // Emit event
    this.emitEvent({
      type: 'usage:recorded',
      timestamp: new Date(),
      payload: { usage, sessionId: this.sessionId },
    });

    return usage;
  }

  /**
   * Gets usage history with optional filtering
   *
   * @param options - Filter and pagination options
   * @returns Array of usage records
   */
  getUsageHistory(options: GetUsageHistoryOptions = {}): TokenUsage[] {
    let records = [...this.usageRecords];

    // Apply filters
    if (options.startTime) {
      records = records.filter(r => r.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      records = records.filter(r => r.timestamp <= options.endTime!);
    }
    if (options.model) {
      records = records.filter(r => r.model === options.model);
    }
    if (options.agentId) {
      records = records.filter(r => r.agentId === options.agentId);
    }
    if (options.taskId) {
      records = records.filter(r => r.taskId === options.taskId);
    }

    // Sort
    const sortDirection = options.sortDirection || 'desc';
    records.sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return sortDirection === 'asc' ? diff : -diff;
    });

    // Pagination
    if (options.offset) {
      records = records.slice(options.offset);
    }
    if (options.limit) {
      records = records.slice(0, options.limit);
    }

    return records;
  }

  /**
   * Gets a summary of the current session's usage
   *
   * @returns Session usage summary
   */
  getSessionSummary(): SessionUsageSummary {
    const byModel: SessionUsageSummary['byModel'] = {};
    const byOperationType: SessionUsageSummary['byOperationType'] = {};

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;
    let cacheHits = 0;

    for (const usage of this.usageRecords) {
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCostUsd += usage.costUsd;
      if (usage.cacheHit) {
        cacheHits++;
      }

      // Aggregate by model
      if (!byModel[usage.model]) {
        byModel[usage.model] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          operationCount: 0,
        };
      }
      byModel[usage.model].inputTokens += usage.inputTokens;
      byModel[usage.model].outputTokens += usage.outputTokens;
      byModel[usage.model].totalTokens += usage.totalTokens;
      byModel[usage.model].costUsd += usage.costUsd;
      byModel[usage.model].operationCount += 1;

      // Aggregate by operation type
      const opType = usage.operationType || 'other';
      if (!byOperationType[opType]) {
        byOperationType[opType] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          operationCount: 0,
        };
      }
      byOperationType[opType].inputTokens += usage.inputTokens;
      byOperationType[opType].outputTokens += usage.outputTokens;
      byOperationType[opType].totalTokens += usage.totalTokens;
      byOperationType[opType].costUsd += usage.costUsd;
      byOperationType[opType].operationCount += 1;
    }

    const summary: SessionUsageSummary = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: this.isActive ? undefined : new Date(),
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      operationCount: this.usageRecords.length,
      byModel,
      byOperationType,
      cacheHitRate:
        this.usageRecords.length > 0 ? cacheHits / this.usageRecords.length : 0,
      peakTokensPerMinute: this.calculatePeakTokensPerMinute(),
    };

    // Validate with Zod schema
    SessionUsageSummarySchema.parse(summary);

    return summary;
  }

  /**
   * Gets current totals without full summary computation
   *
   * @returns Quick totals
   */
  getCurrentTotals(): UsageTotals {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;

    for (const usage of this.usageRecords) {
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCostUsd += usage.costUsd;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      operationCount: this.usageRecords.length,
    };
  }

  /**
   * Gets usage statistics for a specific time window
   *
   * @param windowMs - Time window in milliseconds
   * @returns Usage within the window
   */
  getUsageInWindow(windowMs: number): UsageTotals {
    const windowStart = new Date(Date.now() - windowMs);
    const recordsInWindow = this.usageRecords.filter(
      r => r.timestamp >= windowStart
    );

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;

    for (const usage of recordsInWindow) {
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCostUsd += usage.costUsd;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
      operationCount: recordsInWindow.length,
    };
  }

  /**
   * Gets the rate of token usage (tokens per minute)
   *
   * @returns Current rate
   */
  getCurrentRate(): UsageRate {
    const sessionDurationMs = Date.now() - this.startTime.getTime();
    const sessionDurationMinutes = sessionDurationMs / (1000 * 60);

    const totals = this.getCurrentTotals();

    return {
      tokensPerMinute:
        sessionDurationMinutes > 0
          ? totals.totalTokens / sessionDurationMinutes
          : 0,
      costPerMinute:
        sessionDurationMinutes > 0
          ? totals.totalCostUsd / sessionDurationMinutes
          : 0,
      operationsPerMinute:
        sessionDurationMinutes > 0
          ? totals.operationCount / sessionDurationMinutes
          : 0,
      sessionDurationMinutes,
    };
  }

  /**
   * Registers an event handler
   *
   * @param handler - Event handler function
   */
  onEvent(handler: BudgetEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Removes an event handler
   *
   * @param handler - Event handler function
   */
  offEvent(handler: BudgetEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Ends the current session
   *
   * @returns Final session summary
   */
  endSession(): SessionUsageSummary {
    this.isActive = false;

    const summary = this.getSessionSummary();

    this.emitEvent({
      type: 'session:ended',
      timestamp: new Date(),
      payload: {
        sessionId: this.sessionId,
        details: summary as unknown as Record<string, unknown>,
      },
    });

    return summary;
  }

  /**
   * Clears all usage records
   */
  clearRecords(): void {
    this.usageRecords = [];
  }

  /**
   * Exports usage data as JSON
   *
   * @returns JSON string of usage data
   */
  exportAsJson(): string {
    return JSON.stringify(
      {
        sessionId: this.sessionId,
        agentId: this.agentId,
        startTime: this.startTime,
        isActive: this.isActive,
        records: this.usageRecords,
        summary: this.getSessionSummary(),
      },
      null,
      2
    );
  }

  /**
   * Exports usage data as CSV
   *
   * @returns CSV string of usage records
   */
  exportAsCsv(): string {
    const headers = [
      'id',
      'timestamp',
      'model',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'costUsd',
      'operationType',
      'cacheHit',
      'taskId',
    ];

    const rows = this.usageRecords.map(r =>
      [
        r.id,
        r.timestamp.toISOString(),
        r.model,
        r.inputTokens,
        r.outputTokens,
        r.totalTokens,
        r.costUsd,
        r.operationType,
        r.cacheHit,
        r.taskId || '',
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Gets the session ID
   *
   * @returns Session identifier
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Gets the agent ID
   *
   * @returns Agent identifier or undefined
   */
  getAgentId(): string | undefined {
    return this.agentId;
  }

  /**
   * Checks if the session is active
   *
   * @returns True if active
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  /**
   * Gets the number of records
   *
   * @returns Record count
   */
  getRecordCount(): number {
    return this.usageRecords.length;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateUsageId(): string {
    return `usage-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculatePeakTokensPerMinute(): number {
    if (this.usageRecords.length === 0) {
      return 0;
    }

    // Group by minute buckets
    const buckets: Map<number, number> = new Map();

    for (const record of this.usageRecords) {
      const minuteBucket = Math.floor(record.timestamp.getTime() / 60000);
      const current = buckets.get(minuteBucket) || 0;
      buckets.set(minuteBucket, current + record.totalTokens);
    }

    // Find max
    let peak = 0;
    for (const tokens of buckets.values()) {
      if (tokens > peak) {
        peak = tokens;
      }
    }

    return peak;
  }

  private emitEvent(event: BudgetEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        // Silently ignore handler errors to prevent affecting tracking
        console.warn('Budget event handler error:', error);
      }
    }
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a UsageTracker
 */
export interface UsageTrackerOptions {
  sessionId?: string;
  agentId?: string;
  costCalculator?: CostCalculator;
}

/**
 * Usage totals
 */
export interface UsageTotals {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  operationCount: number;
}

/**
 * Usage rate metrics
 */
export interface UsageRate {
  tokensPerMinute: number;
  costPerMinute: number;
  operationsPerMinute: number;
  sessionDurationMinutes: number;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown during usage tracking operations
 */
export class UsageTrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageTrackingError';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new usage tracker instance
 *
 * @param options - Tracker options
 * @returns UsageTracker instance
 */
export function createUsageTracker(
  options: UsageTrackerOptions = {}
): UsageTracker {
  return new UsageTracker(options);
}
