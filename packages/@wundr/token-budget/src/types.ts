/**
 * @wundr.io/token-budget - Type Definitions
 *
 * TypeScript interfaces and Zod schemas for token budget management.
 * Defines structures for budget configuration, status tracking, and optimization suggestions.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for model pricing configuration (per 1K tokens)
 */
export const ModelPricingSchema = z.object({
  /** Model identifier */
  modelId: z.string(),
  /** Cost per 1K input tokens in USD */
  inputCostPer1K: z.number().nonnegative(),
  /** Cost per 1K output tokens in USD */
  outputCostPer1K: z.number().nonnegative(),
  /** Optional context window size */
  contextWindow: z.number().positive().optional(),
  /** Whether this is a cached/discounted model */
  isCached: z.boolean().default(false),
  /** Discount rate for cached requests (0-1) */
  cacheDiscount: z.number().min(0).max(1).default(0),
});

/**
 * Schema for budget limit configuration
 */
export const BudgetLimitSchema = z.object({
  /** Maximum tokens allowed (input + output) */
  maxTotalTokens: z.number().positive().optional(),
  /** Maximum input tokens allowed */
  maxInputTokens: z.number().positive().optional(),
  /** Maximum output tokens allowed */
  maxOutputTokens: z.number().positive().optional(),
  /** Maximum cost allowed in USD */
  maxCostUsd: z.number().positive().optional(),
  /** Time window for limits in milliseconds (undefined = no window) */
  timeWindowMs: z.number().positive().optional(),
  /** Soft warning threshold (0-1, triggers warning before hard limit) */
  warningThreshold: z.number().min(0).max(1).default(0.8),
  /** Critical threshold (0-1, triggers urgent action) */
  criticalThreshold: z.number().min(0).max(1).default(0.95),
});

/**
 * Schema for token budget configuration
 */
export const TokenBudgetConfigSchema = z.object({
  /** Default model for cost calculations */
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  /** Budget limits */
  limits: BudgetLimitSchema,
  /** Model pricing overrides */
  pricingOverrides: z.array(ModelPricingSchema).default([]),
  /** Enable automatic optimization suggestions */
  enableOptimizations: z.boolean().default(true),
  /** Enable usage tracking */
  enableTracking: z.boolean().default(true),
  /** Session ID for tracking */
  sessionId: z.string().optional(),
  /** Agent ID for tracking */
  agentId: z.string().optional(),
  /** Custom metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for token usage record
 */
export const TokenUsageSchema = z.object({
  /** Unique usage record ID */
  id: z.string(),
  /** Timestamp of the usage */
  timestamp: z.date(),
  /** Model used */
  model: z.string(),
  /** Input tokens consumed */
  inputTokens: z.number().nonnegative(),
  /** Output tokens consumed */
  outputTokens: z.number().nonnegative(),
  /** Total tokens (input + output) */
  totalTokens: z.number().nonnegative(),
  /** Cost in USD */
  costUsd: z.number().nonnegative(),
  /** Session ID */
  sessionId: z.string().optional(),
  /** Agent ID */
  agentId: z.string().optional(),
  /** Task ID */
  taskId: z.string().optional(),
  /** Operation type */
  operationType: z
    .enum([
      'chat',
      'completion',
      'embedding',
      'function_call',
      'tool_use',
      'other',
    ])
    .default('chat'),
  /** Whether cache was used */
  cacheHit: z.boolean().default(false),
  /** Custom metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for budget status
 */
export const BudgetStatusSchema = z.object({
  /** Current total tokens used */
  totalTokensUsed: z.number().nonnegative(),
  /** Current input tokens used */
  inputTokensUsed: z.number().nonnegative(),
  /** Current output tokens used */
  outputTokensUsed: z.number().nonnegative(),
  /** Current cost in USD */
  costUsedUsd: z.number().nonnegative(),
  /** Remaining total tokens (if limit set) */
  totalTokensRemaining: z.number().optional(),
  /** Remaining input tokens (if limit set) */
  inputTokensRemaining: z.number().optional(),
  /** Remaining output tokens (if limit set) */
  outputTokensRemaining: z.number().optional(),
  /** Remaining cost in USD (if limit set) */
  costRemainingUsd: z.number().optional(),
  /** Utilization percentage (0-100) */
  utilizationPercent: z.number().min(0).max(100),
  /** Current status level */
  status: z.enum(['ok', 'warning', 'critical', 'exceeded']),
  /** Time window start (if applicable) */
  windowStartTime: z.date().optional(),
  /** Time window end (if applicable) */
  windowEndTime: z.date().optional(),
  /** Number of operations in current window */
  operationCount: z.number().nonnegative(),
  /** Average tokens per operation */
  avgTokensPerOperation: z.number().nonnegative(),
  /** Average cost per operation */
  avgCostPerOperation: z.number().nonnegative(),
  /** Timestamp of last update */
  lastUpdated: z.date(),
});

/**
 * Schema for optimization suggestion
 */
export const OptimizationSuggestionSchema = z.object({
  /** Unique suggestion ID */
  id: z.string(),
  /** Suggestion type */
  type: z.enum([
    'reduce_context',
    'use_smaller_model',
    'enable_caching',
    'batch_requests',
    'truncate_output',
    'compress_input',
    'use_streaming',
    'reduce_frequency',
    'other',
  ]),
  /** Priority level */
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  /** Human-readable title */
  title: z.string(),
  /** Detailed description */
  description: z.string(),
  /** Estimated token savings */
  estimatedTokenSavings: z.number().nonnegative().optional(),
  /** Estimated cost savings in USD */
  estimatedCostSavingsUsd: z.number().nonnegative().optional(),
  /** Estimated savings percentage */
  estimatedSavingsPercent: z.number().min(0).max(100).optional(),
  /** Implementation difficulty */
  difficulty: z.enum(['easy', 'medium', 'hard']),
  /** Actionable steps */
  steps: z.array(z.string()).default([]),
  /** Related configuration keys */
  relatedConfig: z.array(z.string()).default([]),
  /** Whether this suggestion is auto-applicable */
  autoApplicable: z.boolean().default(false),
});

/**
 * Schema for session usage summary
 */
export const SessionUsageSummarySchema = z.object({
  /** Session ID */
  sessionId: z.string(),
  /** Session start time */
  startTime: z.date(),
  /** Session end time (if ended) */
  endTime: z.date().optional(),
  /** Total input tokens */
  totalInputTokens: z.number().nonnegative(),
  /** Total output tokens */
  totalOutputTokens: z.number().nonnegative(),
  /** Total tokens */
  totalTokens: z.number().nonnegative(),
  /** Total cost in USD */
  totalCostUsd: z.number().nonnegative(),
  /** Number of operations */
  operationCount: z.number().nonnegative(),
  /** Breakdown by model */
  byModel: z.record(
    z.object({
      inputTokens: z.number().nonnegative(),
      outputTokens: z.number().nonnegative(),
      totalTokens: z.number().nonnegative(),
      costUsd: z.number().nonnegative(),
      operationCount: z.number().nonnegative(),
    }),
  ),
  /** Breakdown by operation type */
  byOperationType: z.record(
    z.object({
      inputTokens: z.number().nonnegative(),
      outputTokens: z.number().nonnegative(),
      totalTokens: z.number().nonnegative(),
      costUsd: z.number().nonnegative(),
      operationCount: z.number().nonnegative(),
    }),
  ),
  /** Cache hit rate */
  cacheHitRate: z.number().min(0).max(1),
  /** Peak tokens per minute */
  peakTokensPerMinute: z.number().nonnegative().optional(),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

/**
 * Model pricing configuration
 */
export type ModelPricing = z.infer<typeof ModelPricingSchema>;

/**
 * Budget limit configuration
 */
export type BudgetLimit = z.infer<typeof BudgetLimitSchema>;

/**
 * Token budget configuration
 */
export type TokenBudgetConfig = z.infer<typeof TokenBudgetConfigSchema>;

/**
 * Token usage record
 */
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Budget status
 */
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

/**
 * Optimization suggestion
 */
export type OptimizationSuggestion = z.infer<
  typeof OptimizationSuggestionSchema
>;

/**
 * Session usage summary
 */
export type SessionUsageSummary = z.infer<typeof SessionUsageSummarySchema>;

// ============================================================================
// Additional Types (Not Schema-Validated)
// ============================================================================

/**
 * Operation types for token usage
 */
export type OperationType =
  | 'chat'
  | 'completion'
  | 'embedding'
  | 'function_call'
  | 'tool_use'
  | 'other';

/**
 * Budget status levels
 */
export type BudgetStatusLevel = 'ok' | 'warning' | 'critical' | 'exceeded';

/**
 * Optimization suggestion types
 */
export type OptimizationType =
  | 'reduce_context'
  | 'use_smaller_model'
  | 'enable_caching'
  | 'batch_requests'
  | 'truncate_output'
  | 'compress_input'
  | 'use_streaming'
  | 'reduce_frequency'
  | 'other';

/**
 * Suggestion priority levels
 */
export type SuggestionPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Difficulty levels for implementing suggestions
 */
export type SuggestionDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Options for checking budget
 */
export interface CheckBudgetOptions {
  /** Input tokens to check */
  inputTokens?: number;
  /** Output tokens to check (estimated) */
  outputTokens?: number;
  /** Model to use for cost calculation */
  model?: string;
  /** Whether to include current usage in check */
  includeCurrentUsage?: boolean;
}

/**
 * Result of a budget check
 */
export interface BudgetCheckResult {
  /** Whether the operation is within budget */
  withinBudget: boolean;
  /** Current budget status */
  status: BudgetStatus;
  /** Estimated cost of the operation */
  estimatedCostUsd: number;
  /** Warnings (if any) */
  warnings: string[];
  /** Suggestions for optimization */
  suggestions: OptimizationSuggestion[];
}

/**
 * Options for recording token usage
 */
export interface RecordUsageOptions {
  /** Model used */
  model: string;
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens consumed */
  outputTokens: number;
  /** Task ID */
  taskId?: string;
  /** Operation type */
  operationType?: OperationType;
  /** Whether cache was used */
  cacheHit?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for getting usage history
 */
export interface GetUsageHistoryOptions {
  /** Start time filter */
  startTime?: Date;
  /** End time filter */
  endTime?: Date;
  /** Model filter */
  model?: string;
  /** Agent ID filter */
  agentId?: string;
  /** Task ID filter */
  taskId?: string;
  /** Maximum records to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Budget event types
 */
export type BudgetEventType =
  | 'usage:recorded'
  | 'budget:warning'
  | 'budget:critical'
  | 'budget:exceeded'
  | 'session:started'
  | 'session:ended'
  | 'optimization:suggested';

/**
 * Budget event payload
 */
export interface BudgetEvent {
  /** Event type */
  type: BudgetEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Event payload */
  payload: {
    usage?: TokenUsage;
    status?: BudgetStatus;
    suggestions?: OptimizationSuggestion[];
    sessionId?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Handler for budget events
 */
export type BudgetEventHandler = (event: BudgetEvent) => void | Promise<void>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default token budget configuration
 */
export const DEFAULT_TOKEN_BUDGET_CONFIG: TokenBudgetConfig = {
  defaultModel: 'claude-sonnet-4-20250514',
  limits: {
    maxTotalTokens: 1000000,
    maxCostUsd: 100,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  },
  pricingOverrides: [],
  enableOptimizations: true,
  enableTracking: true,
  metadata: {},
};

/**
 * Default model pricing (Claude models as of 2025)
 */
export const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  {
    modelId: 'claude-sonnet-4-20250514',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 200000,
    isCached: false,
    cacheDiscount: 0,
  },
  {
    modelId: 'claude-sonnet-4-5-20250929',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 200000,
    isCached: false,
    cacheDiscount: 0,
  },
  {
    modelId: 'claude-opus-4-20250514',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    contextWindow: 200000,
    isCached: false,
    cacheDiscount: 0,
  },
  {
    modelId: 'claude-3-haiku-20240307',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
    contextWindow: 200000,
    isCached: false,
    cacheDiscount: 0,
  },
  {
    modelId: 'gpt-4-turbo',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    contextWindow: 128000,
    isCached: false,
    cacheDiscount: 0,
  },
  {
    modelId: 'gpt-4o',
    inputCostPer1K: 0.005,
    outputCostPer1K: 0.015,
    contextWindow: 128000,
    isCached: false,
    cacheDiscount: 0,
  },
  {
    modelId: 'gpt-4o-mini',
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    contextWindow: 128000,
    isCached: false,
    cacheDiscount: 0,
  },
];
