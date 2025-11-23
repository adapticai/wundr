/**
 * @wundr.io/token-budget
 *
 * Token budget management for AI agents - cost calculation, usage tracking,
 * and optimization suggestions for efficient token consumption.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types and Schemas
// ============================================================================

// Zod Schemas (runtime values)
export {
  ModelPricingSchema,
  BudgetLimitSchema,
  TokenBudgetConfigSchema,
  TokenUsageSchema,
  BudgetStatusSchema,
  OptimizationSuggestionSchema,
  SessionUsageSummarySchema,
  DEFAULT_TOKEN_BUDGET_CONFIG,
  DEFAULT_MODEL_PRICING,
} from './types';

// Types (type-only exports)
export type {
  ModelPricing,
  BudgetLimit,
  TokenBudgetConfig,
  TokenUsage,
  BudgetStatus,
  OptimizationSuggestion,
  SessionUsageSummary,
  OperationType,
  BudgetStatusLevel,
  OptimizationType,
  SuggestionPriority,
  SuggestionDifficulty,
  CheckBudgetOptions,
  BudgetCheckResult,
  RecordUsageOptions,
  GetUsageHistoryOptions,
  BudgetEventType,
  BudgetEvent,
  BudgetEventHandler,
} from './types';

// ============================================================================
// Budget Manager
// ============================================================================

export {
  TokenBudgetManager,
  BudgetManagerError,
  createBudgetManager,
  createStrictBudgetManager,
  createSessionBudgetManager,
} from './budget-manager';

// ============================================================================
// Cost Calculator
// ============================================================================

export {
  CostCalculator,
  CostCalculationError,
  createCostCalculator,
  quickCostCalculation,
  estimateTokensFromText,
  formatCost,
} from './cost-calculator';

// Cost Calculator Types
export type {
  CostEstimate,
  ModelCostBreakdown,
  OperationCostBreakdown,
  BatchCostResult,
  ModelComparison,
  CacheSavings,
} from './cost-calculator';

// ============================================================================
// Usage Tracker
// ============================================================================

export {
  UsageTracker,
  UsageTrackingError,
  createUsageTracker,
} from './usage-tracker';

// Usage Tracker Types
export type {
  UsageTrackerOptions,
  UsageTotals,
  UsageRate,
} from './usage-tracker';
