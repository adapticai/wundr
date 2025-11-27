/**
 * Types for Guardian Dashboard
 */

// ============================================================================
// Intervention Types
// ============================================================================

/**
 * Types of intervention that can be triggered
 */
export type InterventionType =
  | 'reduce_autonomy'
  | 'trigger_audit'
  | 'pause_execution'
  | 'notify_guardian'
  | 'rollback';

// ============================================================================
// Orchestrator Alignment Drift Metrics (for Orchestrator Daemon integration)
// ============================================================================

/**
 * Metrics for detecting alignment drift in Orchestrator Daemon context
 * Uses rate-based metrics (0.0 - 1.0 scale)
 */
export interface VPAlignmentDriftMetrics {
  /** Rate of policy violations (0.0 - 1.0) */
  policyViolationRate: number;
  /** Gap between intended and actual outcomes (0.0 - 1.0) */
  intentOutcomeGap: number;
  /** Disagreement rate between evaluators (0.0 - 1.0) */
  evaluatorDisagreement: number;
  /** Rate of suppressed escalations (0.0 - 1.0) */
  escalationSuppression: number;
  /** Detected reward hacking score (0.0 - 1.0) */
  rewardHacking: number;
}

// ============================================================================
// Drift Thresholds
// ============================================================================

/**
 * Drift thresholds for determining health status
 */
export interface DriftThresholds {
  /** Score below this is considered CRITICAL */
  critical: number;
  /** Score below this (but above critical) is considered CONCERNING */
  concerning: number;
  /** Score above concerning threshold is considered HEALTHY */
  healthy: number;
}

/**
 * Metrics for calculating alignment drift
 */
export interface AlignmentDriftMetrics {
  /** Test coverage percentage (0-100) */
  testCoverage: number;
  /** Percentage of code following established patterns (0-100) */
  codePatternAdherence: number;
  /** Documentation coverage percentage (0-100) */
  documentationCoverage: number;
  /** Security compliance score (0-100) */
  securityCompliance: number;
  /** Performance benchmark score (0-100) */
  performanceBenchmark: number;
  /** Custom metrics with weights */
  customMetrics?: CustomMetric[];
}

/**
 * Custom metric with optional weight
 */
export interface CustomMetric {
  name: string;
  value: number;
  weight?: number;
}

/**
 * Health status for alignment
 */
export type HealthStatus = 'HEALTHY' | 'CONCERNING' | 'CRITICAL';

/**
 * Drift data for a single session
 */
export interface SessionDriftData {
  /** Unique session identifier */
  sessionId: string;
  /** Session timestamp */
  timestamp: Date;
  /** Drift score for this session (0-100) */
  driftScore: number;
  /** Metrics that contributed to the score */
  metrics: AlignmentDriftMetrics;
  /** Optional session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Trend direction for drift scores
 */
export type DriftTrend = 'improving' | 'stable' | 'degrading';

/**
 * Aggregated drift report across multiple sessions
 */
export interface AggregatedDriftReport {
  /** Total number of sessions analyzed */
  totalSessions: number;
  /** Average drift score across all sessions */
  averageScore: number;
  /** Minimum drift score observed */
  minScore: number;
  /** Maximum drift score observed */
  maxScore: number;
  /** Standard deviation of scores */
  standardDeviation: number;
  /** Overall health status based on average */
  overallStatus: HealthStatus;
  /** Trend direction */
  trend: DriftTrend;
  /** Sessions with critical scores */
  criticalSessions: SessionDriftData[];
  /** Sessions with concerning scores */
  concerningSessions: SessionDriftData[];
  /** Report generation timestamp */
  generatedAt: Date;
  /** Time range of analyzed sessions */
  timeRange: {
    start: Date;
    end: Date;
  };
}
