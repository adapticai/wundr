/**
 * Token Budget Validation Schemas
 * @module lib/validations/token-budget
 */

import { z } from 'zod';

export const TOKEN_BUDGET_ERROR_CODES = {
  INSUFFICIENT_TOKENS: 'TOKEN_BUDGET_INSUFFICIENT',
  BUDGET_EXCEEDED: 'TOKEN_BUDGET_EXCEEDED',
  INVALID_ALLOCATION: 'TOKEN_BUDGET_INVALID_ALLOCATION',
  NOT_FOUND: 'TOKEN_BUDGET_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'TOKEN_BUDGET_RATE_LIMIT',
} as const;

export const BUDGET_ERROR_CODES = {
  INSUFFICIENT_TOKENS: 'BUDGET_INSUFFICIENT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  INVALID_ALLOCATION: 'BUDGET_INVALID_ALLOCATION',
  NOT_FOUND: 'BUDGET_NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'BUDGET_RATE_LIMIT',
  INVALID_ALERT_CONFIG: 'BUDGET_INVALID_ALERT_CONFIG',
  ALERT_NOT_FOUND: 'BUDGET_ALERT_NOT_FOUND',
  UNAUTHORIZED: 'BUDGET_UNAUTHORIZED',
  VALIDATION_ERROR: 'BUDGET_VALIDATION_ERROR',
  ORCHESTRATOR_NOT_FOUND: 'BUDGET_ORCHESTRATOR_NOT_FOUND',
  FORBIDDEN: 'BUDGET_FORBIDDEN',
  INTERNAL_ERROR: 'BUDGET_INTERNAL_ERROR',
  INVALID_TIME_RANGE: 'BUDGET_INVALID_TIME_RANGE',
} as const;

export type TokenBudgetErrorCode =
  (typeof TOKEN_BUDGET_ERROR_CODES)[keyof typeof TOKEN_BUDGET_ERROR_CODES];

export const tokenBudgetSchema = z.object({
  id: z.string(),
  scope: z.enum(['global', 'workspace', 'user', 'task', 'agent']),
  scopeId: z.string().optional(),
  totalTokens: z.number().positive(),
  usedTokens: z.number().nonnegative(),
  remainingTokens: z.number().nonnegative(),
  resetAt: z.string().datetime().optional(),
  period: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'unlimited']),
  limits: z
    .object({
      maxTokensPerRequest: z.number().positive().optional(),
      maxRequestsPerMinute: z.number().positive().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTokenBudgetSchema = tokenBudgetSchema.omit({
  id: true,
  usedTokens: true,
  remainingTokens: true,
  createdAt: true,
  updatedAt: true,
});

export const tokenUsageSchema = z.object({
  budgetId: z.string(),
  tokens: z.number().positive(),
  operation: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export const tokenAllocationSchema = z.object({
  fromBudgetId: z.string(),
  toBudgetId: z.string(),
  tokens: z.number().positive(),
  reason: z.string().optional(),
});

export const tokenBudgetStatsSchema = z.object({
  budgetId: z.string(),
  period: z.string(),
  totalUsage: z.number().nonnegative(),
  averagePerRequest: z.number().nonnegative(),
  peakUsage: z.number().nonnegative(),
  requestCount: z.number().nonnegative(),
  topOperations: z
    .array(
      z.object({
        operation: z.string(),
        tokens: z.number().nonnegative(),
        count: z.number().nonnegative(),
      }),
    )
    .optional(),
});

// Enums for alerts and time windows
export const alertStatusEnum = z.enum([
  'ACTIVE',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED',
]);
export const timeWindowEnum = z.enum([
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
]);
export const timeRangePresetEnum = z.enum([
  'LAST_24_HOURS',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_YEAR',
  'CUSTOM',
]);
export const granularityEnum = z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH']);
export const severityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);

// Type exports from enums
export type AlertStatus = z.infer<typeof alertStatusEnum>;
export type TimeWindow = z.infer<typeof timeWindowEnum>;
export type TimeRangePreset = z.infer<typeof timeRangePresetEnum>;
export type Granularity = z.infer<typeof granularityEnum>;

// Alert schema
export const alertSchema = z.object({
  id: z.string(),
  orchestratorId: z.string(),
  timeWindow: timeWindowEnum,
  usagePercentage: z.number(),
  threshold: z.number(),
  severity: severityEnum,
  status: alertStatusEnum,
  triggeredAt: z.date(),
  acknowledgedAt: z.date().nullable().optional(),
  acknowledgedBy: z.string().nullable().optional(),
  resolvedAt: z.date().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Alert = z.infer<typeof alertSchema>;

// Alert configuration schema
export const configureAlertsSchema = z.object({
  orchestratorId: z.string(),
  thresholds: z
    .object({
      warningPercent: z.number().min(0).max(100).optional(),
      criticalPercent: z.number().min(0).max(100).optional(),
    })
    .optional(),
  globalSettings: z.record(z.unknown()).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      webhook: z.string().url().optional(),
    })
    .optional(),
});

export type ConfigureAlertsInput = z.infer<typeof configureAlertsSchema>;

// Budget status schema
export const budgetStatusSchema = z.object({
  currentUsage: z.number(),
  limit: z.number(),
  remaining: z.number(),
  usagePercentage: z.number(),
  timeWindow: timeWindowEnum,
  windowStart: z.date(),
  windowEnd: z.date(),
  projectedUsage: z.number(),
  willExceedBudget: z.boolean(),
});

export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

// Update budget limits schema
export const updateBudgetLimitsSchema = z.object({
  orchestratorId: z.string().optional(),
  hourlyLimit: z.number().positive().optional(),
  dailyLimit: z.number().positive().optional(),
  weeklyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  yearlyLimit: z.number().positive().optional(),
});

export type UpdateBudgetLimitsInput = z.infer<typeof updateBudgetLimitsSchema>;

// Usage history entry schema
export const usageHistoryEntrySchema = z.object({
  periodStart: z.date(),
  periodEnd: z.date(),
  tokensUsed: z.number(),
  requestCount: z.number(),
  avgTokensPerRequest: z.number(),
  peakTokensPerRequest: z.number().optional(),
});

export type UsageHistoryEntry = z.infer<typeof usageHistoryEntrySchema>;

// Usage history query schema
export const usageHistoryQuerySchema = z.object({
  orchestratorId: z.string().optional(),
  timeRange: timeRangePresetEnum.default('LAST_7_DAYS'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: granularityEnum.default('DAY'),
  limit: z.coerce.number().positive().default(100),
  offset: z.coerce.number().nonnegative().default(0),
});

export type UsageHistoryQuery = z.infer<typeof usageHistoryQuerySchema>;

// Alert acknowledgement schema
export const acknowledgeAlertSchema = z.object({
  alertId: z.string().optional(),
  acknowledgedBy: z.string().optional(),
  note: z.string().optional(),
  suppressSimilar: z.boolean().optional(),
  suppressionDurationMinutes: z.number().positive().optional(),
});

export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;

// Parameter validation schemas
export const orchestratorIdParamSchema = z.object({
  orchestratorId: z.string(),
});

export const alertIdParamSchema = z.object({
  alertId: z.string(),
});

// Error response helper
export const createErrorResponse = (
  message: string,
  code: string,
  details?: Record<string, unknown>,
) => ({
  error: {
    code,
    message,
    details,
  },
});
