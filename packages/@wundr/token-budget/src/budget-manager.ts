/**
 * @wundr.io/token-budget - Budget Manager
 *
 * Core budget management class that combines cost calculation, usage tracking,
 * and optimization suggestions to provide comprehensive token budget control.
 */

import { CostCalculator } from './cost-calculator';
import {
  TokenBudgetConfigSchema,
  BudgetStatusSchema,
  OptimizationSuggestionSchema,
  DEFAULT_TOKEN_BUDGET_CONFIG,
} from './types';
import { UsageTracker } from './usage-tracker';

import type {
  TokenBudgetConfig,
  BudgetStatus,
  OptimizationSuggestion,
  BudgetCheckResult,
  CheckBudgetOptions,
  RecordUsageOptions,
  BudgetEvent,
  BudgetEventHandler,
  BudgetStatusLevel,
} from './types';
import type { UsageTotals } from './usage-tracker';

// ============================================================================
// Budget Manager Class
// ============================================================================

/**
 * Comprehensive token budget manager for AI agents
 *
 * @example
 * ```typescript
 * const manager = new TokenBudgetManager({
 *   limits: {
 *     maxTotalTokens: 100000,
 *     maxCostUsd: 10,
 *     warningThreshold: 0.8,
 *   },
 * });
 *
 * // Check budget before operation
 * const check = manager.checkBudget({
 *   inputTokens: 5000,
 *   outputTokens: 2000,
 * });
 *
 * if (check.withinBudget) {
 *   // Proceed with operation
 *   manager.recordUsage({
 *     model: 'claude-sonnet-4-20250514',
 *     inputTokens: 5000,
 *     outputTokens: 1800,
 *   });
 * }
 *
 * // Get optimization suggestions
 * const suggestions = manager.suggestOptimization();
 * ```
 */
export class TokenBudgetManager {
  private config: TokenBudgetConfig;
  private costCalculator: CostCalculator;
  private usageTracker: UsageTracker;
  private eventHandlers: Set<BudgetEventHandler>;
  private windowStartTime?: Date;

  /**
   * Creates a new TokenBudgetManager instance
   *
   * @param config - Budget configuration (merged with defaults)
   */
  constructor(config: Partial<TokenBudgetConfig> = {}) {
    // Merge with defaults and validate
    this.config = TokenBudgetConfigSchema.parse({
      ...DEFAULT_TOKEN_BUDGET_CONFIG,
      ...config,
      limits: {
        ...DEFAULT_TOKEN_BUDGET_CONFIG.limits,
        ...config.limits,
      },
    });

    this.costCalculator = new CostCalculator(this.config.pricingOverrides);
    this.usageTracker = new UsageTracker({
      sessionId: this.config.sessionId,
      agentId: this.config.agentId,
      costCalculator: this.costCalculator,
    });
    this.eventHandlers = new Set();

    // Initialize time window if configured
    if (this.config.limits.timeWindowMs) {
      this.windowStartTime = new Date();
    }
  }

  /**
   * Checks if an operation would be within budget
   *
   * @param options - Budget check options
   * @returns Budget check result with status and suggestions
   */
  checkBudget(options: CheckBudgetOptions = {}): BudgetCheckResult {
    const {
      inputTokens = 0,
      outputTokens = 0,
      model = this.config.defaultModel,
      includeCurrentUsage = true,
    } = options;

    const estimatedCost = this.costCalculator.calculateCost({
      model,
      inputTokens,
      outputTokens,
    });

    const currentTotals = includeCurrentUsage
      ? this.getCurrentTotals()
      : {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          operationCount: 0,
        };

    const projectedTotals = {
      totalTokens: currentTotals.totalTokens + inputTokens + outputTokens,
      inputTokens: currentTotals.totalInputTokens + inputTokens,
      outputTokens: currentTotals.totalOutputTokens + outputTokens,
      costUsd: currentTotals.totalCostUsd + estimatedCost,
    };

    const warnings: string[] = [];
    let withinBudget = true;

    // Check against limits
    const { limits } = this.config;

    if (
      limits.maxTotalTokens &&
      projectedTotals.totalTokens > limits.maxTotalTokens
    ) {
      withinBudget = false;
      warnings.push(
        `Total tokens (${projectedTotals.totalTokens}) would exceed limit (${limits.maxTotalTokens})`,
      );
    }

    if (
      limits.maxInputTokens &&
      projectedTotals.inputTokens > limits.maxInputTokens
    ) {
      withinBudget = false;
      warnings.push(
        `Input tokens (${projectedTotals.inputTokens}) would exceed limit (${limits.maxInputTokens})`,
      );
    }

    if (
      limits.maxOutputTokens &&
      projectedTotals.outputTokens > limits.maxOutputTokens
    ) {
      withinBudget = false;
      warnings.push(
        `Output tokens (${projectedTotals.outputTokens}) would exceed limit (${limits.maxOutputTokens})`,
      );
    }

    if (limits.maxCostUsd && projectedTotals.costUsd > limits.maxCostUsd) {
      withinBudget = false;
      warnings.push(
        `Cost ($${projectedTotals.costUsd.toFixed(4)}) would exceed limit ($${limits.maxCostUsd})`,
      );
    }

    // Check warning thresholds
    if (withinBudget) {
      const utilization = this.calculateUtilization(projectedTotals);
      if (utilization >= limits.criticalThreshold) {
        warnings.push(
          `Approaching critical budget threshold (${(utilization * 100).toFixed(1)}%)`,
        );
      } else if (utilization >= limits.warningThreshold) {
        warnings.push(
          `Approaching budget warning threshold (${(utilization * 100).toFixed(1)}%)`,
        );
      }
    }

    const status = this.getBudgetStatus();
    const suggestions =
      this.config.enableOptimizations && (!withinBudget || warnings.length > 0)
        ? this.suggestOptimization()
        : [];

    return {
      withinBudget,
      status,
      estimatedCostUsd: estimatedCost,
      warnings,
      suggestions,
    };
  }

  /**
   * Records token usage and updates budget status
   *
   * @param options - Usage recording options
   * @returns Updated budget status
   */
  recordUsage(options: RecordUsageOptions): BudgetStatus {
    if (!this.config.enableTracking) {
      throw new BudgetManagerError('Usage tracking is disabled');
    }

    this.usageTracker.recordUsage(options);

    const status = this.getBudgetStatus();

    // Emit events based on status
    if (status.status === 'exceeded') {
      this.emitEvent({
        type: 'budget:exceeded',
        timestamp: new Date(),
        payload: { status, sessionId: this.config.sessionId },
      });
    } else if (status.status === 'critical') {
      this.emitEvent({
        type: 'budget:critical',
        timestamp: new Date(),
        payload: { status, sessionId: this.config.sessionId },
      });
    } else if (status.status === 'warning') {
      this.emitEvent({
        type: 'budget:warning',
        timestamp: new Date(),
        payload: { status, sessionId: this.config.sessionId },
      });
    }

    return status;
  }

  /**
   * Gets the current budget status
   *
   * @returns Current budget status
   */
  getBudgetStatus(): BudgetStatus {
    const totals = this.getCurrentTotals();
    const { limits } = this.config;

    // Calculate remaining amounts
    const totalTokensRemaining = limits.maxTotalTokens
      ? Math.max(0, limits.maxTotalTokens - totals.totalTokens)
      : undefined;
    const inputTokensRemaining = limits.maxInputTokens
      ? Math.max(0, limits.maxInputTokens - totals.totalInputTokens)
      : undefined;
    const outputTokensRemaining = limits.maxOutputTokens
      ? Math.max(0, limits.maxOutputTokens - totals.totalOutputTokens)
      : undefined;
    const costRemainingUsd = limits.maxCostUsd
      ? Math.max(0, limits.maxCostUsd - totals.totalCostUsd)
      : undefined;

    // Calculate utilization
    const utilization = this.calculateUtilization(totals);
    const utilizationPercent = Math.min(100, utilization * 100);

    // Determine status level
    let statusLevel: BudgetStatusLevel = 'ok';
    if (utilization >= 1) {
      statusLevel = 'exceeded';
    } else if (utilization >= limits.criticalThreshold) {
      statusLevel = 'critical';
    } else if (utilization >= limits.warningThreshold) {
      statusLevel = 'warning';
    }

    const status: BudgetStatus = {
      totalTokensUsed: totals.totalTokens,
      inputTokensUsed: totals.totalInputTokens,
      outputTokensUsed: totals.totalOutputTokens,
      costUsedUsd: totals.totalCostUsd,
      totalTokensRemaining,
      inputTokensRemaining,
      outputTokensRemaining,
      costRemainingUsd,
      utilizationPercent,
      status: statusLevel,
      windowStartTime: this.windowStartTime,
      windowEndTime:
        this.windowStartTime && limits.timeWindowMs
          ? new Date(this.windowStartTime.getTime() + limits.timeWindowMs)
          : undefined,
      operationCount: totals.operationCount,
      avgTokensPerOperation:
        totals.operationCount > 0
          ? totals.totalTokens / totals.operationCount
          : 0,
      avgCostPerOperation:
        totals.operationCount > 0
          ? totals.totalCostUsd / totals.operationCount
          : 0,
      lastUpdated: new Date(),
    };

    // Validate with Zod schema
    BudgetStatusSchema.parse(status);

    return status;
  }

  /**
   * Generates optimization suggestions based on current usage patterns
   *
   * @returns Array of optimization suggestions
   */
  suggestOptimization(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const status = this.getBudgetStatus();
    const summary = this.usageTracker.getSessionSummary();

    // Suggestion: Use smaller model if cost is high
    if (status.avgCostPerOperation > 0.01) {
      const suggestion: OptimizationSuggestion = {
        id: this.generateSuggestionId(),
        type: 'use_smaller_model',
        priority: status.status === 'exceeded' ? 'critical' : 'high',
        title: 'Consider Using a Smaller Model',
        description:
          'Your average cost per operation is relatively high. Consider using a smaller, more cost-effective model for simpler tasks.',
        estimatedCostSavingsUsd:
          status.avgCostPerOperation * 0.5 * status.operationCount,
        estimatedSavingsPercent: 50,
        difficulty: 'easy',
        steps: [
          'Identify operations that do not require the full capability of the current model',
          'Route simpler tasks to claude-3-haiku or gpt-4o-mini',
          'Implement model routing based on task complexity',
        ],
        relatedConfig: ['defaultModel'],
        autoApplicable: false,
      };
      OptimizationSuggestionSchema.parse(suggestion);
      suggestions.push(suggestion);
    }

    // Suggestion: Enable caching if not used
    if (summary.cacheHitRate < 0.1 && status.operationCount > 5) {
      const suggestion: OptimizationSuggestion = {
        id: this.generateSuggestionId(),
        type: 'enable_caching',
        priority: 'medium',
        title: 'Enable Response Caching',
        description:
          'Your cache hit rate is very low. Enabling caching for repeated prompts can significantly reduce costs.',
        estimatedCostSavingsUsd: status.costUsedUsd * 0.3,
        estimatedSavingsPercent: 30,
        difficulty: 'medium',
        steps: [
          'Identify frequently repeated prompts or system messages',
          'Enable prompt caching in your API calls',
          'Use consistent prompt formatting to maximize cache hits',
        ],
        relatedConfig: ['pricingOverrides'],
        autoApplicable: false,
      };
      OptimizationSuggestionSchema.parse(suggestion);
      suggestions.push(suggestion);
    }

    // Suggestion: Reduce context if input tokens are high
    if (status.avgTokensPerOperation > 10000) {
      const suggestion: OptimizationSuggestion = {
        id: this.generateSuggestionId(),
        type: 'reduce_context',
        priority: status.status === 'critical' ? 'critical' : 'high',
        title: 'Reduce Context Window Size',
        description:
          'Average tokens per operation is very high. Consider trimming unnecessary context to reduce costs.',
        estimatedTokenSavings:
          (status.avgTokensPerOperation - 5000) * status.operationCount,
        estimatedSavingsPercent: 40,
        difficulty: 'medium',
        steps: [
          'Review and trim system prompts to essential information',
          'Implement conversation summarization for long sessions',
          'Use selective context inclusion based on relevance',
        ],
        relatedConfig: ['limits.maxTotalTokens'],
        autoApplicable: false,
      };
      OptimizationSuggestionSchema.parse(suggestion);
      suggestions.push(suggestion);
    }

    // Suggestion: Batch requests if operation rate is high
    const rate = this.usageTracker.getCurrentRate();
    if (rate.operationsPerMinute > 10) {
      const suggestion: OptimizationSuggestion = {
        id: this.generateSuggestionId(),
        type: 'batch_requests',
        priority: 'medium',
        title: 'Batch API Requests',
        description:
          'High operation frequency detected. Batching multiple requests can reduce overhead and improve efficiency.',
        estimatedCostSavingsUsd: status.costUsedUsd * 0.15,
        estimatedSavingsPercent: 15,
        difficulty: 'hard',
        steps: [
          'Identify requests that can be combined',
          'Implement request batching logic',
          'Use async processing for non-urgent operations',
        ],
        relatedConfig: [],
        autoApplicable: false,
      };
      OptimizationSuggestionSchema.parse(suggestion);
      suggestions.push(suggestion);
    }

    // Suggestion: Truncate output if output tokens are high relative to input
    const outputRatio = status.outputTokensUsed / (status.inputTokensUsed || 1);
    if (outputRatio > 0.8 && status.outputTokensUsed > 5000) {
      const suggestion: OptimizationSuggestion = {
        id: this.generateSuggestionId(),
        type: 'truncate_output',
        priority: 'low',
        title: 'Limit Output Length',
        description:
          'Output tokens are relatively high. Consider setting max_tokens to limit response length.',
        estimatedTokenSavings: status.outputTokensUsed * 0.3,
        estimatedSavingsPercent: 20,
        difficulty: 'easy',
        steps: [
          'Set appropriate max_tokens parameter in API calls',
          'Request concise responses in system prompts',
          'Implement streaming for long responses',
        ],
        relatedConfig: ['limits.maxOutputTokens'],
        autoApplicable: true,
      };
      OptimizationSuggestionSchema.parse(suggestion);
      suggestions.push(suggestion);
    }

    // Emit event for suggestions
    if (suggestions.length > 0) {
      this.emitEvent({
        type: 'optimization:suggested',
        timestamp: new Date(),
        payload: { suggestions, sessionId: this.config.sessionId },
      });
    }

    return suggestions;
  }

  /**
   * Resets the budget tracking (clears usage history)
   */
  resetBudget(): void {
    this.usageTracker.clearRecords();
    if (this.config.limits.timeWindowMs) {
      this.windowStartTime = new Date();
    }
  }

  /**
   * Updates the budget configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<TokenBudgetConfig>): void {
    this.config = TokenBudgetConfigSchema.parse({
      ...this.config,
      ...config,
      limits: {
        ...this.config.limits,
        ...config.limits,
      },
    });

    // Update cost calculator with new pricing
    if (config.pricingOverrides) {
      this.costCalculator = new CostCalculator(this.config.pricingOverrides);
    }
  }

  /**
   * Registers an event handler
   *
   * @param handler - Event handler function
   */
  onEvent(handler: BudgetEventHandler): void {
    this.eventHandlers.add(handler);
    this.usageTracker.onEvent(handler);
  }

  /**
   * Removes an event handler
   *
   * @param handler - Event handler function
   */
  offEvent(handler: BudgetEventHandler): void {
    this.eventHandlers.delete(handler);
    this.usageTracker.offEvent(handler);
  }

  /**
   * Gets the underlying cost calculator
   *
   * @returns CostCalculator instance
   */
  getCostCalculator(): CostCalculator {
    return this.costCalculator;
  }

  /**
   * Gets the underlying usage tracker
   *
   * @returns UsageTracker instance
   */
  getUsageTracker(): UsageTracker {
    return this.usageTracker;
  }

  /**
   * Gets the current configuration
   *
   * @returns Current configuration
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config };
  }

  /**
   * Exports budget data as JSON
   *
   * @returns JSON string of budget data
   */
  exportAsJson(): string {
    return JSON.stringify(
      {
        config: this.config,
        status: this.getBudgetStatus(),
        summary: this.usageTracker.getSessionSummary(),
        suggestions: this.suggestOptimization(),
      },
      null,
      2,
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getCurrentTotals(): UsageTotals {
    // If time window is configured, only count usage within the window
    if (this.config.limits.timeWindowMs && this.windowStartTime) {
      const windowEnd =
        this.windowStartTime.getTime() + this.config.limits.timeWindowMs;

      // Check if window has expired
      if (Date.now() > windowEnd) {
        // Reset window
        this.windowStartTime = new Date();
        this.usageTracker.clearRecords();
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          operationCount: 0,
        };
      }

      return this.usageTracker.getUsageInWindow(
        this.config.limits.timeWindowMs,
      );
    }

    return this.usageTracker.getCurrentTotals();
  }

  private calculateUtilization(totals: {
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalCostUsd?: number;
  }): number {
    const { limits } = this.config;
    const utilizations: number[] = [];

    const totalTokens = totals.totalTokens ?? 0;
    const inputTokens = totals.inputTokens ?? totals.totalInputTokens ?? 0;
    const outputTokens = totals.outputTokens ?? totals.totalOutputTokens ?? 0;
    const costUsd = totals.costUsd ?? totals.totalCostUsd ?? 0;

    if (limits.maxTotalTokens) {
      utilizations.push(totalTokens / limits.maxTotalTokens);
    }
    if (limits.maxInputTokens) {
      utilizations.push(inputTokens / limits.maxInputTokens);
    }
    if (limits.maxOutputTokens) {
      utilizations.push(outputTokens / limits.maxOutputTokens);
    }
    if (limits.maxCostUsd) {
      utilizations.push(costUsd / limits.maxCostUsd);
    }

    // Return the highest utilization (most constrained resource)
    return utilizations.length > 0 ? Math.max(...utilizations) : 0;
  }

  private generateSuggestionId(): string {
    return `suggestion-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private emitEvent(event: BudgetEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.warn('Budget event handler error:', error);
      }
    }
  }
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown by the budget manager
 */
export class BudgetManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetManagerError';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new budget manager instance
 *
 * @param config - Budget configuration
 * @returns TokenBudgetManager instance
 */
export function createBudgetManager(
  config: Partial<TokenBudgetConfig> = {},
): TokenBudgetManager {
  return new TokenBudgetManager(config);
}

/**
 * Creates a budget manager with strict limits
 *
 * @param maxTokens - Maximum total tokens
 * @param maxCostUsd - Maximum cost in USD
 * @returns TokenBudgetManager instance
 */
export function createStrictBudgetManager(
  maxTokens: number,
  maxCostUsd: number,
): TokenBudgetManager {
  return new TokenBudgetManager({
    limits: {
      maxTotalTokens: maxTokens,
      maxCostUsd: maxCostUsd,
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
    },
    enableOptimizations: true,
    enableTracking: true,
  });
}

/**
 * Creates a budget manager for a specific session
 *
 * @param sessionId - Session identifier
 * @param agentId - Optional agent identifier
 * @param config - Additional configuration
 * @returns TokenBudgetManager instance
 */
export function createSessionBudgetManager(
  sessionId: string,
  agentId?: string,
  config: Partial<TokenBudgetConfig> = {},
): TokenBudgetManager {
  return new TokenBudgetManager({
    ...config,
    sessionId,
    agentId,
  });
}
