/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Resource Allocator for VP Daemon
 *
 * Implements token budgeting and tiered model allocation for
 * efficient resource management across VP sessions and sub-agents.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ModelTier = 'tier1VP' | 'tier2SessionManager' | 'tier3SubAgent';

export type TaskComplexity = 'high' | 'medium' | 'low';

export type BillingType = 'subscription' | 'api';

export type ThrottlingLevel =
  | 'none'
  | 'light'
  | 'moderate'
  | 'severe'
  | 'paused';

export interface ModelConfig {
  name: string;
  tier: ModelTier;
  billingType: BillingType;
  maxTokensPerRequest: number;
  costPerMillionTokens?: number; // Only for API billing
}

export interface TieredModelConfig {
  tier1VP: ModelConfig;
  tier2SessionManager: ModelConfig;
  tier3SubAgent: ModelConfig;
}

export interface TokenBudget {
  dailyLimit: number;
  monthlyLimit: number;
  warningThreshold: number; // Percentage (0-1)
  criticalThreshold: number; // Percentage (0-1)
  currentDailyUsage: number;
  currentMonthlyUsage: number;
  lastResetDate: Date;
  lastMonthlyResetDate: Date;
}

export interface UsageEntry {
  sessionId: string;
  tier: ModelTier;
  tokens: number;
  timestamp: Date;
  taskId?: string;
}

export interface UsageTracker {
  entries: UsageEntry[];
  sessionTotals: Map<string, number>;
  tierTotals: Map<ModelTier, number>;
}

export interface Task {
  id: string;
  sessionId: string;
  description: string;
  complexity: TaskComplexity;
  priority: 'critical' | 'high' | 'normal' | 'low';
  estimatedTokens?: number;
}

export interface AllocationResult {
  success: boolean;
  tier: ModelTier;
  model: ModelConfig;
  allocatedTokens: number;
  warnings: string[];
  throttlingApplied: boolean;
  estimatedCost?: number;
}

export interface BudgetStatus {
  dailyUsed: number;
  dailyLimit: number;
  dailyPercentage: number;
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyPercentage: number;
  status: 'healthy' | 'warning' | 'critical' | 'exhausted';
  remainingDaily: number;
  remainingMonthly: number;
}

export interface ThrottlingAction {
  sessionId: string;
  action: 'throttle' | 'pause' | 'resume' | 'downgrade';
  previousLevel: ThrottlingLevel;
  newLevel: ThrottlingLevel;
  reason: string;
  timestamp: Date;
}

export interface UsageReport {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  totalTokens: number;
  tokensByTier: Record<ModelTier, number>;
  tokensBySession: Record<string, number>;
  estimatedCost: number;
  budgetStatus: BudgetStatus;
  throttlingActions: ThrottlingAction[];
  recommendations: string[];
}

export interface ResourceAllocatorConfig {
  budget: Partial<TokenBudget>;
  modelConfig?: Partial<TieredModelConfig>;
  autoThrottle?: boolean;
  autoDowngrade?: boolean;
}

interface SessionThrottleState {
  sessionId: string;
  level: ThrottlingLevel;
  pausedAt?: Date;
  originalTier?: ModelTier;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_TIERED_MODEL_CONFIG: TieredModelConfig = {
  tier1VP: {
    name: 'claude-3-5-sonnet-20241022',
    tier: 'tier1VP',
    billingType: 'subscription',
    maxTokensPerRequest: 8192,
  },
  tier2SessionManager: {
    name: 'claude-3-5-sonnet-20241022',
    tier: 'tier2SessionManager',
    billingType: 'subscription',
    maxTokensPerRequest: 4096,
  },
  tier3SubAgent: {
    name: 'claude-3-5-haiku-20241022',
    tier: 'tier3SubAgent',
    billingType: 'api',
    maxTokensPerRequest: 2048,
    costPerMillionTokens: 0.25, // Input cost for Haiku
  },
};

const DEFAULT_BUDGET: TokenBudget = {
  dailyLimit: 1_000_000,
  monthlyLimit: 25_000_000,
  warningThreshold: 0.8, // 80%
  criticalThreshold: 0.95, // 95%
  currentDailyUsage: 0,
  currentMonthlyUsage: 0,
  lastResetDate: new Date(),
  lastMonthlyResetDate: new Date(),
};

// ============================================================================
// ResourceAllocator Class
// ============================================================================

export class ResourceAllocator {
  private budget: TokenBudget;
  private modelConfig: TieredModelConfig;
  private usageTracking: UsageTracker;
  private throttlingActions: ThrottlingAction[] = [];
  private sessionThrottleStates: Map<string, SessionThrottleState> = new Map();
  private autoThrottle: boolean;
  private autoDowngrade: boolean;

  constructor(config: ResourceAllocatorConfig) {
    this.budget = { ...DEFAULT_BUDGET, ...config.budget };
    this.modelConfig = {
      ...DEFAULT_TIERED_MODEL_CONFIG,
      ...config.modelConfig,
    };
    this.autoThrottle = config.autoThrottle ?? true;
    this.autoDowngrade = config.autoDowngrade ?? true;

    this.usageTracking = {
      entries: [],
      sessionTotals: new Map(),
      tierTotals: new Map(),
    };

    // Initialize tier totals
    this.usageTracking.tierTotals.set('tier1VP', 0);
    this.usageTracking.tierTotals.set('tier2SessionManager', 0);
    this.usageTracking.tierTotals.set('tier3SubAgent', 0);

    // Check if we need to reset daily/monthly counters
    this.checkAndResetCounters();
  }

  /**
   * Allocates resources for a given task based on complexity and budget
   */
  async allocateForTask(task: Task): Promise<AllocationResult> {
    this.checkAndResetCounters();

    const warnings: string[] = [];
    let throttlingApplied = false;

    // Determine the appropriate model tier
    let tier = this.determineModelTier(task.complexity);
    const budgetStatus = await this.checkBudgetAvailability(tier);

    // Handle budget constraints
    if (budgetStatus.status === 'exhausted') {
      return {
        success: false,
        tier,
        model: this.modelConfig[tier],
        allocatedTokens: 0,
        warnings: ['Budget exhausted. Cannot allocate resources.'],
        throttlingApplied: false,
      };
    }

    // Apply throttling if needed
    if (budgetStatus.status === 'critical' && this.autoThrottle) {
      warnings.push('Critical budget threshold reached. Throttling applied.');
      throttlingApplied = true;

      // Downgrade non-critical tasks to lower tier
      if (this.autoDowngrade && task.priority !== 'critical') {
        const originalTier = tier;
        tier = this.downgradeToLowerTier(tier);
        if (tier !== originalTier) {
          warnings.push(
            `Task downgraded from ${originalTier} to ${tier} due to budget constraints.`
          );
        }
      }
    } else if (budgetStatus.status === 'warning') {
      warnings.push('Warning: Approaching budget threshold (80%).');
    }

    const model = this.modelConfig[tier];
    const allocatedTokens = task.estimatedTokens ?? model.maxTokensPerRequest;

    // Calculate estimated cost for API-billed models
    let estimatedCost: number | undefined;
    if (model.billingType === 'api' && model.costPerMillionTokens) {
      estimatedCost =
        (allocatedTokens / 1_000_000) * model.costPerMillionTokens;
    }

    return {
      success: true,
      tier,
      model,
      allocatedTokens,
      warnings,
      throttlingApplied,
      estimatedCost,
    };
  }

  /**
   * Determines the appropriate model tier based on task complexity
   */
  determineModelTier(taskComplexity: TaskComplexity): ModelTier {
    switch (taskComplexity) {
      case 'high':
        return 'tier1VP';
      case 'medium':
        return 'tier2SessionManager';
      case 'low':
        return 'tier3SubAgent';
      default:
        return 'tier2SessionManager';
    }
  }

  /**
   * Checks budget availability for a given tier
   */
  async checkBudgetAvailability(tier: ModelTier): Promise<BudgetStatus> {
    this.checkAndResetCounters();
    return this.getCurrentBudgetStatus();
  }

  /**
   * Tracks token usage for a session
   */
  async trackUsage(
    sessionId: string,
    tokens: number,
    tier?: ModelTier
  ): Promise<void> {
    const effectiveTier = tier ?? 'tier2SessionManager';

    const entry: UsageEntry = {
      sessionId,
      tier: effectiveTier,
      tokens,
      timestamp: new Date(),
    };

    this.usageTracking.entries.push(entry);

    // Update session totals
    const currentSessionTotal =
      this.usageTracking.sessionTotals.get(sessionId) ?? 0;
    this.usageTracking.sessionTotals.set(
      sessionId,
      currentSessionTotal + tokens
    );

    // Update tier totals
    const currentTierTotal =
      this.usageTracking.tierTotals.get(effectiveTier) ?? 0;
    this.usageTracking.tierTotals.set(effectiveTier, currentTierTotal + tokens);

    // Update budget counters
    this.budget.currentDailyUsage += tokens;
    this.budget.currentMonthlyUsage += tokens;

    // Check if throttling is needed
    if (this.autoThrottle) {
      await this.enforceThrottling();
    }
  }

  /**
   * Enforces throttling based on current budget status
   */
  async enforceThrottling(): Promise<ThrottlingAction[]> {
    const actions: ThrottlingAction[] = [];
    const budgetStatus = this.getCurrentBudgetStatus();

    if (budgetStatus.status === 'healthy') {
      // Resume any throttled sessions
      const resumeActions = await this.resumeThrottledSessionsInternal();
      actions.push(...resumeActions);
      return actions;
    }

    if (budgetStatus.status === 'warning') {
      // Light throttling: reduce allocation for low-priority sessions
      for (const [sessionId, state] of this.sessionThrottleStates) {
        if (state.level === 'none') {
          const action: ThrottlingAction = {
            sessionId,
            action: 'throttle',
            previousLevel: 'none',
            newLevel: 'light',
            reason: 'Budget warning threshold reached',
            timestamp: new Date(),
          };
          state.level = 'light';
          actions.push(action);
          this.throttlingActions.push(action);
        }
      }
    }

    if (budgetStatus.status === 'critical') {
      // Moderate to severe throttling
      for (const [sessionId, state] of this.sessionThrottleStates) {
        if (state.level === 'none' || state.level === 'light') {
          const action: ThrottlingAction = {
            sessionId,
            action: 'throttle',
            previousLevel: state.level,
            newLevel: 'severe',
            reason: 'Budget critical threshold reached',
            timestamp: new Date(),
          };
          state.level = 'severe';
          actions.push(action);
          this.throttlingActions.push(action);
        }
      }
    }

    if (budgetStatus.status === 'exhausted') {
      // Pause all non-critical sessions
      await this.pauseNonCriticalSessions();
    }

    return actions;
  }

  /**
   * Gets the current budget status
   */
  getCurrentBudgetStatus(): BudgetStatus {
    this.checkAndResetCounters();

    const dailyPercentage =
      this.budget.currentDailyUsage / this.budget.dailyLimit;
    const monthlyPercentage =
      this.budget.currentMonthlyUsage / this.budget.monthlyLimit;

    const maxPercentage = Math.max(dailyPercentage, monthlyPercentage);

    let status: BudgetStatus['status'];
    if (maxPercentage >= 1) {
      status = 'exhausted';
    } else if (maxPercentage >= this.budget.criticalThreshold) {
      status = 'critical';
    } else if (maxPercentage >= this.budget.warningThreshold) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      dailyUsed: this.budget.currentDailyUsage,
      dailyLimit: this.budget.dailyLimit,
      dailyPercentage: dailyPercentage * 100,
      monthlyUsed: this.budget.currentMonthlyUsage,
      monthlyLimit: this.budget.monthlyLimit,
      monthlyPercentage: monthlyPercentage * 100,
      status,
      remainingDaily: Math.max(
        0,
        this.budget.dailyLimit - this.budget.currentDailyUsage
      ),
      remainingMonthly: Math.max(
        0,
        this.budget.monthlyLimit - this.budget.currentMonthlyUsage
      ),
    };
  }

  /**
   * Generates a comprehensive usage report
   */
  getUsageReport(): UsageReport {
    const budgetStatus = this.getCurrentBudgetStatus();
    const tokensByTier: Record<ModelTier, number> = {
      tier1VP: this.usageTracking.tierTotals.get('tier1VP') ?? 0,
      tier2SessionManager:
        this.usageTracking.tierTotals.get('tier2SessionManager') ?? 0,
      tier3SubAgent: this.usageTracking.tierTotals.get('tier3SubAgent') ?? 0,
    };

    const tokensBySession: Record<string, number> = {};
    for (const [sessionId, tokens] of this.usageTracking.sessionTotals) {
      tokensBySession[sessionId] = tokens;
    }

    // Calculate estimated cost (only for API-billed tier3)
    const tier3Cost = this.modelConfig.tier3SubAgent.costPerMillionTokens ?? 0;
    const estimatedCost = (tokensByTier.tier3SubAgent / 1_000_000) * tier3Cost;

    const recommendations = this.generateRecommendations(
      budgetStatus,
      tokensByTier
    );

    return {
      generatedAt: new Date(),
      period: {
        start: this.budget.lastResetDate,
        end: new Date(),
      },
      totalTokens: this.budget.currentDailyUsage,
      tokensByTier,
      tokensBySession,
      estimatedCost,
      budgetStatus,
      throttlingActions: [...this.throttlingActions],
      recommendations,
    };
  }

  /**
   * Pauses all non-critical sessions
   */
  async pauseNonCriticalSessions(): Promise<void> {
    for (const [sessionId, state] of this.sessionThrottleStates) {
      if (state.level !== 'paused') {
        const action: ThrottlingAction = {
          sessionId,
          action: 'pause',
          previousLevel: state.level,
          newLevel: 'paused',
          reason: 'Budget exhausted - pausing non-critical sessions',
          timestamp: new Date(),
        };
        state.level = 'paused';
        state.pausedAt = new Date();
        this.throttlingActions.push(action);
      }
    }
  }

  /**
   * Resumes all throttled sessions
   */
  async resumeThrottledSessions(): Promise<void> {
    await this.resumeThrottledSessionsInternal();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async resumeThrottledSessionsInternal(): Promise<ThrottlingAction[]> {
    const actions: ThrottlingAction[] = [];

    for (const [sessionId, state] of this.sessionThrottleStates) {
      if (state.level !== 'none') {
        const action: ThrottlingAction = {
          sessionId,
          action: 'resume',
          previousLevel: state.level,
          newLevel: 'none',
          reason: 'Budget recovered - resuming sessions',
          timestamp: new Date(),
        };
        state.level = 'none';
        state.pausedAt = undefined;
        actions.push(action);
        this.throttlingActions.push(action);
      }
    }

    return actions;
  }

  private downgradeToLowerTier(currentTier: ModelTier): ModelTier {
    switch (currentTier) {
      case 'tier1VP':
        return 'tier2SessionManager';
      case 'tier2SessionManager':
        return 'tier3SubAgent';
      case 'tier3SubAgent':
        return 'tier3SubAgent'; // Already at lowest
      default:
        return currentTier;
    }
  }

  private checkAndResetCounters(): void {
    const now = new Date();
    const lastReset = this.budget.lastResetDate;
    const lastMonthlyReset = this.budget.lastMonthlyResetDate;

    // Check for daily reset
    if (this.isDifferentDay(now, lastReset)) {
      this.budget.currentDailyUsage = 0;
      this.budget.lastResetDate = now;
      this.usageTracking.entries = this.usageTracking.entries.filter(entry =>
        this.isSameDay(entry.timestamp, now)
      );
    }

    // Check for monthly reset
    if (this.isDifferentMonth(now, lastMonthlyReset)) {
      this.budget.currentMonthlyUsage = 0;
      this.budget.lastMonthlyResetDate = now;
      this.throttlingActions = [];
    }
  }

  private isDifferentDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() !== date2.getFullYear() ||
      date1.getMonth() !== date2.getMonth() ||
      date1.getDate() !== date2.getDate()
    );
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return !this.isDifferentDay(date1, date2);
  }

  private isDifferentMonth(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() !== date2.getFullYear() ||
      date1.getMonth() !== date2.getMonth()
    );
  }

  private generateRecommendations(
    budgetStatus: BudgetStatus,
    tokensByTier: Record<ModelTier, number>
  ): string[] {
    const recommendations: string[] = [];

    if (
      budgetStatus.status === 'warning' ||
      budgetStatus.status === 'critical'
    ) {
      recommendations.push(
        'Consider reducing task complexity to use lower-tier models.'
      );
      recommendations.push('Review and optimize high-token-usage sessions.');
    }

    if (budgetStatus.dailyPercentage > budgetStatus.monthlyPercentage * 1.5) {
      recommendations.push(
        'Daily usage is higher than average. Consider pacing tasks throughout the month.'
      );
    }

    const tier1Percentage =
      (tokensByTier.tier1VP / (budgetStatus.dailyUsed || 1)) * 100;
    if (tier1Percentage > 50) {
      recommendations.push(
        'Over 50% of tokens used by Tier 1. Consider delegating more tasks to lower tiers.'
      );
    }

    if (this.throttlingActions.length > 10) {
      recommendations.push(
        'Frequent throttling detected. Consider increasing budget or reducing workload.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Resource usage is healthy. No immediate actions needed.'
      );
    }

    return recommendations;
  }

  /**
   * Registers a session for throttle tracking
   */
  registerSession(sessionId: string, tier?: ModelTier): void {
    if (!this.sessionThrottleStates.has(sessionId)) {
      this.sessionThrottleStates.set(sessionId, {
        sessionId,
        level: 'none',
        originalTier: tier,
      });
    }
  }

  /**
   * Unregisters a session from throttle tracking
   */
  unregisterSession(sessionId: string): void {
    this.sessionThrottleStates.delete(sessionId);
    this.usageTracking.sessionTotals.delete(sessionId);
  }

  /**
   * Gets the throttle state for a specific session
   */
  getSessionThrottleState(sessionId: string): SessionThrottleState | undefined {
    return this.sessionThrottleStates.get(sessionId);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a default ResourceAllocator with standard configuration
 */
export function createDefaultAllocator(): ResourceAllocator {
  return new ResourceAllocator({
    budget: DEFAULT_BUDGET,
    modelConfig: DEFAULT_TIERED_MODEL_CONFIG,
    autoThrottle: true,
    autoDowngrade: true,
  });
}

/**
 * Creates a ResourceAllocator with custom budget limits
 */
export function createAllocatorWithBudget(
  dailyLimit: number,
  monthlyLimit: number
): ResourceAllocator {
  return new ResourceAllocator({
    budget: {
      dailyLimit,
      monthlyLimit,
    },
    autoThrottle: true,
    autoDowngrade: true,
  });
}
