/**
 * Alignment Debt Calculator
 *
 * Calculates alignment drift scores based on various code quality metrics.
 * Higher scores indicate better alignment; lower scores indicate more "debt".
 */

import type {
  AlignmentDriftMetrics,
  DriftThresholds,
  HealthStatus,
  CustomMetric,
} from './types';

/**
 * Default weights for each metric category
 */
const DEFAULT_WEIGHTS = {
  testCoverage: 0.25,
  codePatternAdherence: 0.25,
  documentationCoverage: 0.15,
  securityCompliance: 0.2,
  performanceBenchmark: 0.15,
} as const;

/**
 * Default thresholds for health status determination
 */
const DEFAULT_THRESHOLDS: DriftThresholds = {
  critical: 40,
  concerning: 70,
  healthy: 70,
};

/**
 * Calculator for alignment debt scores based on code quality metrics.
 *
 * The alignment debt score represents how well the codebase adheres to
 * established quality standards. A score of 100 indicates perfect alignment,
 * while lower scores indicate accumulated "debt" that needs addressing.
 */
export class AlignmentDebtCalculator {
  private readonly thresholds: DriftThresholds;
  private readonly weights: typeof DEFAULT_WEIGHTS;

  /**
   * Creates a new AlignmentDebtCalculator instance
   *
   * @param customThresholds - Optional custom thresholds for health status
   * @param customWeights - Optional custom weights for metrics
   */
  constructor(
    customThresholds?: Partial<DriftThresholds>,
    customWeights?: Partial<typeof DEFAULT_WEIGHTS>
  ) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };
  }

  /**
   * Calculates the alignment score based on provided metrics
   *
   * @param metrics - The alignment drift metrics to evaluate
   * @returns A score from 0-100 where higher is better alignment
   */
  calculateScore(metrics: AlignmentDriftMetrics): number {
    const {
      testCoverage,
      codePatternAdherence,
      documentationCoverage,
      securityCompliance,
      performanceBenchmark,
      customMetrics,
    } = metrics;

    // Validate input metrics are within expected range
    this.validateMetricRange('testCoverage', testCoverage);
    this.validateMetricRange('codePatternAdherence', codePatternAdherence);
    this.validateMetricRange('documentationCoverage', documentationCoverage);
    this.validateMetricRange('securityCompliance', securityCompliance);
    this.validateMetricRange('performanceBenchmark', performanceBenchmark);

    // Calculate weighted base score
    let weightedScore =
      testCoverage * this.weights.testCoverage +
      codePatternAdherence * this.weights.codePatternAdherence +
      documentationCoverage * this.weights.documentationCoverage +
      securityCompliance * this.weights.securityCompliance +
      performanceBenchmark * this.weights.performanceBenchmark;

    // Add custom metrics if provided
    if (customMetrics && customMetrics.length > 0) {
      const customScore = this.calculateCustomMetricsScore(customMetrics);
      // Blend custom metrics (20% influence on final score)
      weightedScore = weightedScore * 0.8 + customScore * 0.2;
    }

    // Clamp to valid range and round to 2 decimal places
    return Math.round(Math.max(0, Math.min(100, weightedScore)) * 100) / 100;
  }

  /**
   * Determines the health status based on a given score
   *
   * @param score - The alignment score (0-100)
   * @returns The health status: HEALTHY, CONCERNING, or CRITICAL
   */
  getStatus(score: number): HealthStatus {
    if (score < this.thresholds.critical) {
      return 'CRITICAL';
    }
    if (score < this.thresholds.concerning) {
      return 'CONCERNING';
    }
    return 'HEALTHY';
  }

  /**
   * Returns the current threshold configuration
   *
   * @returns The drift thresholds being used
   */
  getThresholds(): DriftThresholds {
    return { ...this.thresholds };
  }

  /**
   * Calculates the "debt" amount - how much improvement is needed
   *
   * @param metrics - The metrics to evaluate
   * @returns The debt amount (100 - score)
   */
  calculateDebt(metrics: AlignmentDriftMetrics): number {
    return 100 - this.calculateScore(metrics);
  }

  /**
   * Identifies which metrics are contributing most to debt
   *
   * @param metrics - The metrics to analyze
   * @returns Array of metric names sorted by their contribution to debt
   */
  identifyDebtSources(
    metrics: AlignmentDriftMetrics
  ): Array<{ metric: string; contribution: number; value: number }> {
    const sources = [
      {
        metric: 'testCoverage',
        contribution: (100 - metrics.testCoverage) * this.weights.testCoverage,
        value: metrics.testCoverage,
      },
      {
        metric: 'codePatternAdherence',
        contribution:
          (100 - metrics.codePatternAdherence) *
          this.weights.codePatternAdherence,
        value: metrics.codePatternAdherence,
      },
      {
        metric: 'documentationCoverage',
        contribution:
          (100 - metrics.documentationCoverage) *
          this.weights.documentationCoverage,
        value: metrics.documentationCoverage,
      },
      {
        metric: 'securityCompliance',
        contribution:
          (100 - metrics.securityCompliance) * this.weights.securityCompliance,
        value: metrics.securityCompliance,
      },
      {
        metric: 'performanceBenchmark',
        contribution:
          (100 - metrics.performanceBenchmark) *
          this.weights.performanceBenchmark,
        value: metrics.performanceBenchmark,
      },
    ];

    return sources.sort((a, b) => b.contribution - a.contribution);
  }

  /**
   * Validates that a metric value is within the expected 0-100 range
   */
  private validateMetricRange(name: string, value: number): void {
    if (value < 0 || value > 100) {
      throw new Error(
        `Invalid metric value for ${name}: ${value}. Expected value between 0 and 100.`
      );
    }
  }

  /**
   * Calculates weighted score from custom metrics
   */
  private calculateCustomMetricsScore(customMetrics: CustomMetric[]): number {
    const totalWeight = customMetrics.reduce(
      (sum, m) => sum + (m.weight ?? 1),
      0
    );

    if (totalWeight === 0) {
      return 0;
    }

    const weightedSum = customMetrics.reduce((sum, m) => {
      const weight = m.weight ?? 1;
      return sum + m.value * weight;
    }, 0);

    return weightedSum / totalWeight;
  }
}
