/**
 * Token Budget Types
 */

/**
 * Token usage record
 */
/**
 * Usage reporter configuration
 */
import { z } from 'zod';

export interface TokenUsage {
  orchestratorId: string;
  sessionId: string;
  timestamp: Date;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Budget period type
 */
export type BudgetPeriod = 'hourly' | 'daily' | 'monthly';

/**
 * Token budget configuration
 */
export interface TokenBudget {
  hourly?: number;
  daily?: number;
  monthly?: number;
}

/**
 * Budget check result
 */
export interface BudgetCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  period: BudgetPeriod;
  percentUsed: number;
  estimatedTokens: number;
  wouldExceed: boolean;
  message?: string;
}

/**
 * Token reservation
 */
export interface TokenReservation {
  id: string;
  orchestratorId: string;
  tokens: number;
  period: BudgetPeriod;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Reservation result
 */
export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  reservation?: TokenReservation;
  remaining: number;
  error?: string;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  orchestratorId: string;
  period: BudgetPeriod;
  totalUsed: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  reservedTokens: number;
  activeReservations: number;
  periodStart: Date;
  periodEnd: Date;
  breakdown: {
    promptTokens: number;
    completionTokens: number;
  };
  topModels: Array<{
    model: string;
    tokens: number;
    percentage: number;
  }>;
}

/**
 * Budget override for priority tasks
 */
export interface BudgetOverride {
  orchestratorId: string;
  period: BudgetPeriod;
  additionalTokens: number;
  reason: string;
  expiresAt: Date;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Budget threshold event
 */
export interface BudgetThresholdEvent {
  orchestratorId: string;
  period: BudgetPeriod;
  threshold: number; // 0.5 for 50%, 0.75 for 75%, etc.
  currentUsage: number;
  limit: number;
  percentUsed: number;
  timestamp: Date;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  defaultBudget: TokenBudget;
  orchestratorBudgets: Record<string, TokenBudget>;
  thresholds: number[]; // e.g., [0.5, 0.75, 0.9, 1.0]
  reservationTTL: number; // milliseconds
  enableOverrides: boolean;
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix: string;
  };
}

/**
 * Period window calculation result
 */
export interface PeriodWindow {
  period: BudgetPeriod;
  start: Date;
  end: Date;
  ttlSeconds: number;
  key: string;
}

/**
 * Redis budget keys
 */
export interface BudgetKeys {
  usage: string;
  reservations: string;
  overrides: string;
  metadata: string;
}

/**
 * Model pricing configuration
 */
export interface ModelPricing {
  modelId: string;
  provider: 'anthropic' | 'openai' | 'google' | 'custom';
  inputTokenCost: number; // Cost per 1M tokens
  outputTokenCost: number; // Cost per 1M tokens
  currency: 'USD' | 'EUR' | 'GBP';
  effectiveDate: Date;
}

/**
 * Token usage record for reporting
 */
export interface TokenUsageRecord {
  id: string;
  orchestratorId: string;
  sessionId: string;
  timestamp: Date;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolName?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Report parameters
 */
export interface ReportParams {
  orchestratorId?: string;
  sessionId?: string;
  startTime: Date;
  endTime: Date;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
  groupBy?: ('orchestrator' | 'session' | 'model' | 'tool')[];
  includeAnomalies?: boolean;
}

/**
 * Usage report
 */
export interface UsageReport {
  period: {
    startTime: Date;
    endTime: Date;
    granularity: string;
  };
  summary: UsageSummary;
  breakdown: UsageBreakdown[];
  anomalies?: Anomaly[];
  costEstimate: CostEstimate;
}

/**
 * Usage summary
 */
export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalRecords: number;
  uniqueOrchestrators: number;
  uniqueSessions: number;
  averageTokensPerSession: number;
  peakUsageTimestamp?: Date;
  peakUsageTokens?: number;
}

/**
 * Usage breakdown
 */
export interface UsageBreakdown {
  key: string; // orchestrator ID, session ID, model ID, or tool name
  type: 'orchestrator' | 'session' | 'model' | 'tool';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  percentage: number;
  recordCount: number;
  cost?: number;
}

/**
 * Cost estimation parameters
 */
export interface CostParams {
  orchestratorId?: string;
  sessionId?: string;
  startTime: Date;
  endTime: Date;
  currency?: 'USD' | 'EUR' | 'GBP';
  includeProjection?: boolean;
}

/**
 * Cost estimate
 */
export interface CostEstimate {
  totalCost: number;
  currency: string;
  breakdown: CostBreakdown[];
  projection?: CostProjection;
}

/**
 * Cost breakdown
 */
export interface CostBreakdown {
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  percentage: number;
}

/**
 * Cost projection
 */
export interface CostProjection {
  projectionPeriod: 'daily' | 'weekly' | 'monthly';
  projectedCost: number;
  confidence: number; // 0-1
  basedOnDays: number;
}

/**
 * Usage anomaly
 */
export interface Anomaly {
  id: string;
  orchestratorId: string;
  sessionId?: string;
  timestamp: Date;
  type: 'spike' | 'unusual_pattern' | 'budget_exceeded' | 'rate_limit_approached';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  actualValue: number;
  expectedValue: number;
  deviationPercentage: number;
  metadata?: Record<string, unknown>;
}

/**
 * Historical usage data point
 */
export interface UsageDataPoint {
  timestamp: Date;
  orchestratorId: string;
  sessionId?: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  enabled: boolean;
  spikeThreshold: number; // Standard deviations from mean
  windowSize: number; // Number of data points to analyze
  minDataPoints: number; // Minimum data points needed for detection
  budgetWarningThreshold: number; // Percentage of budget (e.g., 0.8 for 80%)
  budgetCriticalThreshold: number; // Percentage of budget (e.g., 0.95 for 95%)
}

/**
 * Usage statistics for anomaly detection
 */
export interface UsageStatistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number; // First quartile
  q3: number; // Third quartile
  dataPoints: number;
}

/**
 * Budget status (extended from existing)
 */
export interface BudgetStatusExtended {
  orchestratorId: string;
  period: 'hourly' | 'daily' | 'monthly';
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
  status: 'healthy' | 'warning' | 'critical' | 'exceeded';
  resetAt: Date;
}

export const UsageReporterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  persistToDatabase: z.boolean().default(true),
  retentionDays: z.number().int().positive().default(90),
  aggregationIntervals: z.array(
    z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  ).default(['hourly', 'daily', 'monthly']),
  anomalyDetection: z.object({
    enabled: z.boolean().default(true),
    spikeThreshold: z.number().positive().default(2.5),
    windowSize: z.number().int().positive().default(100),
    minDataPoints: z.number().int().positive().default(10),
    budgetWarningThreshold: z.number().min(0).max(1).default(0.8),
    budgetCriticalThreshold: z.number().min(0).max(1).default(0.95),
  }),
  defaultCurrency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
});

export type UsageReporterConfig = z.infer<typeof UsageReporterConfigSchema>;

// Re-export BudgetStatus as alias to BudgetStatusExtended for compatibility
export type BudgetStatus = BudgetStatusExtended;
