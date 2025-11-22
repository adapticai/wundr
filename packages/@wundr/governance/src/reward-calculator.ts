/**
 * Reward Calculator Module
 *
 * Implements weighted objective scoring for governance metrics.
 * Calculates composite scores based on configurable weights across
 * multiple dimensions including customer value, code quality,
 * delivery speed, technical debt reduction, and documentation.
 */

/**
 * Weight configuration for each scoring dimension.
 * All weights should sum to 1.0 for normalized scoring.
 */
export interface RewardWeights {
  customer_value: number;
  code_quality: number;
  delivery_speed: number;
  technical_debt_reduction: number;
  documentation: number;
}

/**
 * Input metrics for reward calculation.
 * Each dimension accepts a value from 0-100.
 */
export interface RewardMetrics {
  customer_value: number;
  code_quality: number;
  delivery_speed: number;
  technical_debt_reduction: number;
  documentation: number;
}

/**
 * Calculated reward score with breakdown by dimension.
 */
export interface RewardScore {
  overall: number;
  byDimension: Record<string, number>;
  timestamp: Date;
}

/**
 * Comparison between current and baseline scores.
 */
export interface ScoreComparison {
  overallDelta: number;
  overallPercentChange: number;
  dimensionDeltas: Record<string, number>;
  improved: boolean;
  significantChanges: string[];
}

/**
 * Default weight configuration emphasizing customer value
 * and code quality as primary metrics.
 */
const DEFAULT_WEIGHTS: RewardWeights = {
  customer_value: 0.35,
  code_quality: 0.25,
  delivery_speed: 0.2,
  technical_debt_reduction: 0.15,
  documentation: 0.05,
};

/**
 * Threshold for considering a score change significant.
 */
const SIGNIFICANT_CHANGE_THRESHOLD = 5;

/**
 * Threshold for identifying areas needing improvement.
 */
const IMPROVEMENT_THRESHOLD = 70;

/**
 * RewardCalculator class for weighted objective scoring.
 *
 * Provides methods to calculate, compare, and analyze scores
 * across multiple governance dimensions with configurable weights.
 *
 * @example
 * ```typescript
 * const calculator = new RewardCalculator();
 * const score = calculator.calculateScore({
 *   customer_value: 85,
 *   code_quality: 90,
 *   delivery_speed: 75,
 *   technical_debt_reduction: 60,
 *   documentation: 80
 * });
 * console.log(score.overall); // Weighted average
 * ```
 */
export class RewardCalculator {
  private weights: RewardWeights;

  /**
   * Creates a new RewardCalculator instance.
   *
   * @param weights - Optional custom weights. Defaults to standard weights
   *                  prioritizing customer value (0.35) and code quality (0.25).
   */
  constructor(weights: Partial<RewardWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.validateWeights();
  }

  /**
   * Calculates the overall reward score from provided metrics.
   *
   * @param metrics - Input metrics with values 0-100 for each dimension.
   * @returns RewardScore with overall weighted average and per-dimension scores.
   * @throws Error if any metric value is outside 0-100 range.
   */
  calculateScore(metrics: RewardMetrics): RewardScore {
    this.validateMetrics(metrics);

    const byDimension: Record<string, number> = {};
    let overall = 0;

    for (const dimension of Object.keys(this.weights) as Array<
      keyof RewardWeights
    >) {
      const weightedScore = this.getWeightedScore(
        dimension,
        metrics[dimension],
      );
      byDimension[dimension] = weightedScore;
      overall += weightedScore;
    }

    return {
      overall: Math.round(overall * 100) / 100,
      byDimension,
      timestamp: new Date(),
    };
  }

  /**
   * Calculates the weighted score for a single dimension.
   *
   * @param dimension - The dimension name (must be a valid weight key).
   * @param value - The raw value (0-100) for this dimension.
   * @returns The weighted score contribution.
   * @throws Error if dimension is not recognized.
   */
  getWeightedScore(dimension: string, value: number): number {
    if (!(dimension in this.weights)) {
      throw new Error(`Unknown dimension: ${dimension}`);
    }

    const weight = this.weights[dimension as keyof RewardWeights];
    return Math.round(value * weight * 100) / 100;
  }

  /**
   * Normalizes a set of scores to sum to 100.
   *
   * @param scores - Record of dimension names to raw scores.
   * @returns Normalized scores that sum to 100.
   */
  normalizeScores(scores: Record<string, number>): Record<string, number> {
    const total = Object.values(scores).reduce((sum, val) => sum + val, 0);

    if (total === 0) {
      const keys = Object.keys(scores);
      const equalShare = 100 / keys.length;
      return keys.reduce(
        (acc, key) => {
          acc[key] = Math.round(equalShare * 100) / 100;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(scores)) {
      normalized[key] = Math.round((value / total) * 100 * 100) / 100;
    }

    return normalized;
  }

  /**
   * Updates the weight configuration.
   *
   * @param newWeights - Partial weights to merge with existing configuration.
   * @throws Error if resulting weights don't sum to approximately 1.0.
   */
  updateWeights(newWeights: Partial<RewardWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
    this.validateWeights();
  }

  /**
   * Returns the current weight configuration.
   *
   * @returns A copy of the current weights.
   */
  getWeights(): RewardWeights {
    return { ...this.weights };
  }

  /**
   * Compares current score against a baseline score.
   *
   * @param current - The current RewardScore to evaluate.
   * @param baseline - The baseline RewardScore to compare against.
   * @returns ScoreComparison with deltas and improvement indicators.
   */
  compareToBaseline(
    current: RewardScore,
    baseline: RewardScore,
  ): ScoreComparison {
    const overallDelta =
      Math.round((current.overall - baseline.overall) * 100) / 100;
    const overallPercentChange =
      baseline.overall === 0
        ? current.overall > 0
          ? 100
          : 0
        : Math.round(
            ((current.overall - baseline.overall) / baseline.overall) *
              100 *
              100,
          ) / 100;

    const dimensionDeltas: Record<string, number> = {};
    const significantChanges: string[] = [];

    for (const dimension of Object.keys(current.byDimension)) {
      const currentVal = current.byDimension[dimension] || 0;
      const baselineVal = baseline.byDimension[dimension] || 0;
      const delta = Math.round((currentVal - baselineVal) * 100) / 100;

      dimensionDeltas[dimension] = delta;

      if (
        Math.abs(delta) >=
        SIGNIFICANT_CHANGE_THRESHOLD * this.getWeightForDimension(dimension)
      ) {
        const direction = delta > 0 ? 'improved' : 'declined';
        significantChanges.push(
          `${dimension} ${direction} by ${Math.abs(delta).toFixed(2)}`,
        );
      }
    }

    return {
      overallDelta,
      overallPercentChange,
      dimensionDeltas,
      improved: overallDelta > 0,
      significantChanges,
    };
  }

  /**
   * Identifies dimensions that need improvement based on their scores.
   *
   * @param score - The RewardScore to analyze.
   * @returns Array of dimension names that are below the improvement threshold.
   */
  identifyImprovementAreas(score: RewardScore): string[] {
    const improvementAreas: Array<{
      dimension: string;
      effectiveScore: number;
      priority: number;
    }> = [];

    for (const [dimension, weightedScore] of Object.entries(
      score.byDimension,
    )) {
      const weight = this.getWeightForDimension(dimension);
      if (weight === 0) {
        continue;
      }

      // Calculate the effective raw score from the weighted score
      const effectiveScore = weightedScore / weight;

      if (effectiveScore < IMPROVEMENT_THRESHOLD) {
        // Priority is based on how much below threshold and the weight importance
        const priority = (IMPROVEMENT_THRESHOLD - effectiveScore) * weight;
        improvementAreas.push({ dimension, effectiveScore, priority });
      }
    }

    // Sort by priority (highest first) and return dimension names
    return improvementAreas
      .sort((a, b) => b.priority - a.priority)
      .map(area => area.dimension);
  }

  /**
   * Gets the weight for a specific dimension.
   *
   * @param dimension - The dimension name.
   * @returns The weight value or 0 if not found.
   */
  private getWeightForDimension(dimension: string): number {
    return this.weights[dimension as keyof RewardWeights] || 0;
  }

  /**
   * Validates that weights sum to approximately 1.0.
   *
   * @throws Error if weights don't sum to 1.0 (within tolerance).
   */
  private validateWeights(): void {
    const sum = Object.values(this.weights).reduce((acc, val) => acc + val, 0);
    const tolerance = 0.001;

    if (Math.abs(sum - 1.0) > tolerance) {
      throw new Error(
        `Weights must sum to 1.0, but sum to ${sum.toFixed(4)}. ` +
          `Current weights: ${JSON.stringify(this.weights)}`,
      );
    }
  }

  /**
   * Validates that all metric values are within 0-100 range.
   *
   * @param metrics - The metrics to validate.
   * @throws Error if any metric is outside valid range.
   */
  private validateMetrics(metrics: RewardMetrics): void {
    for (const [dimension, value] of Object.entries(metrics)) {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(
          `Invalid metric value for ${dimension}: must be a number`,
        );
      }
      if (value < 0 || value > 100) {
        throw new Error(
          `Metric value for ${dimension} must be between 0 and 100, got ${value}`,
        );
      }
    }
  }
}

/**
 * Factory function to create a RewardCalculator instance.
 *
 * @param weights - Optional custom weights configuration.
 * @returns A new RewardCalculator instance.
 *
 * @example
 * ```typescript
 * // Create with default weights
 * const calculator = createRewardCalculator();
 *
 * // Create with custom weights
 * const customCalculator = createRewardCalculator({
 *   customer_value: 0.40,
 *   code_quality: 0.30,
 *   delivery_speed: 0.15,
 *   technical_debt_reduction: 0.10,
 *   documentation: 0.05
 * });
 * ```
 */
export function createRewardCalculator(
  weights?: Partial<RewardWeights>,
): RewardCalculator {
  return new RewardCalculator(weights);
}
