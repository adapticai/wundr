/**
 * Drift Score Aggregator
 *
 * Aggregates drift scores across multiple sessions to provide
 * trend analysis and comprehensive reporting.
 */

import { AlignmentDebtCalculator } from './alignment-debt-calculator';

import type {
  SessionDriftData,
  AggregatedDriftReport,
  DriftTrend,
  HealthStatus,
  DriftThresholds,
} from './types';

/**
 * Default thresholds for determining health status
 */
const DEFAULT_THRESHOLDS: DriftThresholds = {
  critical: 40,
  concerning: 70,
  healthy: 70,
};

/**
 * Configuration for trend calculation
 */
const TREND_CONFIG = {
  /** Minimum improvement to be considered "improving" */
  improvementThreshold: 2,
  /** Minimum degradation to be considered "degrading" */
  degradationThreshold: -2,
} as const;

/**
 * Aggregates drift scores from multiple sessions and provides
 * trend analysis and comprehensive reporting capabilities.
 */
export class DriftScoreAggregator {
  private sessions: SessionDriftData[] = [];
  private readonly calculator: AlignmentDebtCalculator;
  private readonly thresholds: DriftThresholds;

  /**
   * Creates a new DriftScoreAggregator instance
   *
   * @param customThresholds - Optional custom thresholds for health status
   */
  constructor(customThresholds?: Partial<DriftThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
    this.calculator = new AlignmentDebtCalculator(this.thresholds);
  }

  /**
   * Adds sessions to the aggregator
   *
   * @param sessions - Array of session drift data to add
   */
  addSessions(sessions: SessionDriftData[]): void {
    this.sessions.push(...sessions);
    // Keep sessions sorted by timestamp
    this.sessions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clears all stored sessions
   */
  clearSessions(): void {
    this.sessions = [];
  }

  /**
   * Aggregates scores from provided sessions into a comprehensive report
   *
   * @param sessions - Array of session drift data to aggregate
   * @returns Aggregated drift report with statistics and analysis
   */
  aggregateSessionScores(sessions: SessionDriftData[]): AggregatedDriftReport {
    if (sessions.length === 0) {
      return this.createEmptyReport();
    }

    // Sort sessions by timestamp for accurate trend calculation
    const sortedSessions = [...sessions].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const scores = sortedSessions.map(s => s.driftScore);
    const averageScore = this.calculateAverage(scores);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const standardDeviation = this.calculateStandardDeviation(scores);
    const trend = this.calculateTrend(scores);
    const overallStatus = this.calculator.getStatus(averageScore);

    // Categorize sessions by health status
    const criticalSessions = sortedSessions.filter(
      s => s.driftScore < this.thresholds.critical,
    );
    const concerningSessions = sortedSessions.filter(
      s =>
        s.driftScore >= this.thresholds.critical &&
        s.driftScore < this.thresholds.concerning,
    );

    const timestamps = sortedSessions.map(s => s.timestamp);

    return {
      totalSessions: sessions.length,
      averageScore: Math.round(averageScore * 100) / 100,
      minScore,
      maxScore,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      overallStatus,
      trend,
      criticalSessions,
      concerningSessions,
      generatedAt: new Date(),
      timeRange: {
        start: timestamps[0]!,
        end: timestamps[timestamps.length - 1]!,
      },
    };
  }

  /**
   * Returns the top drifting sessions sorted by drift score (lowest first)
   *
   * @param count - Number of top drifting sessions to return
   * @returns Array of sessions with the worst drift scores
   */
  getTopDriftingSessions(count: number): SessionDriftData[] {
    if (this.sessions.length === 0) {
      return [];
    }

    // Sort by drift score ascending (worst scores first)
    const sorted = [...this.sessions].sort(
      (a, b) => a.driftScore - b.driftScore,
    );

    return sorted.slice(0, Math.min(count, sorted.length));
  }

  /**
   * Calculates the trend direction based on score history
   *
   * Uses linear regression to determine if scores are improving,
   * stable, or degrading over time.
   *
   * @param history - Array of historical scores (oldest to newest)
   * @returns Trend direction: 'improving', 'stable', or 'degrading'
   */
  calculateTrend(history: number[]): DriftTrend {
    if (history.length < 2) {
      return 'stable';
    }

    // Calculate simple linear regression slope
    const slope = this.calculateLinearRegressionSlope(history);

    // Determine trend based on slope magnitude
    if (slope > TREND_CONFIG.improvementThreshold) {
      return 'improving';
    }
    if (slope < TREND_CONFIG.degradationThreshold) {
      return 'degrading';
    }
    return 'stable';
  }

  /**
   * Gets sessions within a specific time range
   *
   * @param start - Start of time range
   * @param end - End of time range
   * @returns Sessions within the specified time range
   */
  getSessionsInRange(start: Date, end: Date): SessionDriftData[] {
    return this.sessions.filter(
      s => s.timestamp >= start && s.timestamp <= end,
    );
  }

  /**
   * Gets sessions by health status
   *
   * @param status - The health status to filter by
   * @returns Sessions matching the specified status
   */
  getSessionsByStatus(status: HealthStatus): SessionDriftData[] {
    return this.sessions.filter(
      s => this.calculator.getStatus(s.driftScore) === status,
    );
  }

  /**
   * Gets the current session count
   */
  get sessionCount(): number {
    return this.sessions.length;
  }

  /**
   * Creates an empty report when no sessions are available
   */
  private createEmptyReport(): AggregatedDriftReport {
    const now = new Date();
    return {
      totalSessions: 0,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      standardDeviation: 0,
      overallStatus: 'CRITICAL',
      trend: 'stable',
      criticalSessions: [],
      concerningSessions: [],
      generatedAt: now,
      timeRange: {
        start: now,
        end: now,
      },
    };
  }

  /**
   * Calculates the average of an array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculates the standard deviation of an array of numbers
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const avg = this.calculateAverage(values);
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquaredDiff = this.calculateAverage(squaredDiffs);

    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculates the slope of a linear regression line through the data points
   *
   * Uses least squares method to find the best-fit line.
   */
  private calculateLinearRegressionSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) {
      return 0;
    }

    // Use indices as x values (0, 1, 2, ...)
    const xMean = (n - 1) / 2;
    const yMean = this.calculateAverage(values);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = i - xMean;
      const yDiff = values[i]! - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }
}
