/**
 * Novelty Detector - Out-of-Distribution Detection
 *
 * Implements statistical methods to detect when inputs deviate from
 * the learned distribution of "normal" operational data.
 *
 * ============================================================================
 * KNOWN LIMITATIONS (documented for transparency):
 * ============================================================================
 *
 * 1. CANNOT DETECT BLACK SWAN EVENTS
 *    - By definition, black swan events are unprecedented and outside historical patterns
 *    - The detector can only recognize novelty relative to observed distributions
 *    - Truly novel catastrophic events may not trigger appropriate warnings
 *    - Recommendation: Combine with human oversight for high-stakes decisions
 *
 * 2. NON-STATIONARY ENVIRONMENTS MAY FOOL DETECTOR
 *    - Gradual distribution shifts (concept drift) may go undetected
 *    - Seasonal patterns not captured in training data appear as novelty
 *    - Adversarial inputs specifically crafted to appear in-distribution
 *    - Recommendation: Regular model retraining and drift monitoring
 *
 * 3. EMERGENT MULTI-AGENT INTERACTIONS AT SCALE
 *    - Single-input novelty doesn't capture emergent system behaviors
 *    - Interactions between multiple agents may produce novel outcomes
 *    - Scale effects (many small changes) may compound unexpectedly
 *    - Recommendation: System-level monitoring alongside input-level detection
 *
 * ============================================================================
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Numeric vector representing input features for novelty detection
 */
export interface InputVector {
  /** Unique identifier for this input */
  id: string;
  /** Feature values as numeric array */
  features: number[];
  /** Optional timestamp for temporal analysis */
  timestamp?: string;
  /** Optional source identifier */
  source?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the NoveltyDetector
 */
export interface NoveltyConfig {
  /** Sensitivity threshold for novelty detection (0-1, default 0.8) */
  sensitivityThreshold: number;
  /** Number of standard deviations for outlier detection */
  standardDeviationMultiplier: number;
  /** Minimum samples required before detection is reliable */
  minimumSamples: number;
  /** Enable Mahalanobis distance calculation */
  useMahalanobisDistance: boolean;
  /** Enable isolation forest-style scoring */
  useIsolationScoring: boolean;
  /** Maximum history size for distribution model */
  maxHistorySize: number;
  /** Decay factor for older samples (0-1, 1 = no decay) */
  temporalDecayFactor: number;
}

/**
 * Result of novelty detection analysis
 */
export interface NoveltyResult {
  /** Whether novelty was detected above threshold */
  detected: boolean;
  /** Overall novelty score (0-1, higher = more novel) */
  score: number;
  /** Inputs classified as out-of-distribution */
  outOfDistributionInputs: InputVector[];
  /** Warning flags raised during analysis */
  flags: string[];
  /** Recommended action based on novelty level */
  recommendation: 'proceed' | 'caution' | 'halt';
  /** Detailed breakdown by input */
  breakdown?: NoveltyBreakdown[];
  /** Timestamp of analysis */
  timestamp: string;
  /** Analysis duration in milliseconds */
  duration: number;
}

/**
 * Detailed novelty breakdown for individual inputs
 */
export interface NoveltyBreakdown {
  /** Reference to input */
  inputId: string;
  /** Individual novelty score */
  score: number;
  /** Whether this specific input is OOD */
  isOutOfDistribution: boolean;
  /** Contributing factors to novelty score */
  factors: NoveltyFactor[];
}

/**
 * Factor contributing to novelty score
 */
export interface NoveltyFactor {
  /** Name of the factor */
  name: string;
  /** Factor's contribution to score */
  contribution: number;
  /** Description of why this factor contributed */
  description: string;
}

/**
 * Statistical summary of learned distribution
 */
export interface DistributionStats {
  /** Number of samples in the model */
  sampleCount: number;
  /** Mean of each feature dimension */
  featureMeans: number[];
  /** Standard deviation of each feature dimension */
  featureStdDevs: number[];
  /** Covariance matrix (if computed) */
  covarianceMatrix?: number[][];
  /** Range [min, max] for each feature */
  featureRanges: Array<{ min: number; max: number }>;
  /** Timestamp of last model update */
  lastUpdated: string;
  /** Model confidence level (0-1) */
  confidence: number;
}

/**
 * Internal distribution model state
 */
interface DistributionModel {
  /** Accumulated sample data */
  samples: InputVector[];
  /** Running statistics */
  stats: DistributionStats;
  /** Whether model has been initialized with sufficient data */
  initialized: boolean;
}

/**
 * Mitigation recommendations for detected novelty
 */
export interface MitigationRecommendation {
  /** Type of mitigation */
  type:
    | 'canary_release'
    | 'increased_oversight'
    | 'rapid_rollback'
    | 'full_halt';
  /** Detailed description */
  description: string;
  /** Urgency level */
  urgency: 'low' | 'medium' | 'high' | 'critical';
  /** Specific actions to take */
  actions: string[];
}

// ============================================================================
// NoveltyDetector Class
// ============================================================================

/**
 * NoveltyDetector - Out-of-Distribution Detection Engine
 *
 * Monitors incoming inputs against a learned distribution model to detect
 * anomalies that may indicate unexpected system behavior or conditions.
 */
export class NoveltyDetector {
  private readonly config: NoveltyConfig;
  private distributionModel: DistributionModel;

  /**
   * Create a new NoveltyDetector instance
   * @param config - Configuration for detection behavior
   */
  constructor(config: Partial<NoveltyConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.distributionModel = this.initializeDistributionModel();
  }

  /**
   * Merge provided config with defaults
   */
  private mergeWithDefaults(config: Partial<NoveltyConfig>): NoveltyConfig {
    return {
      sensitivityThreshold: config.sensitivityThreshold ?? 0.8,
      standardDeviationMultiplier: config.standardDeviationMultiplier ?? 3,
      minimumSamples: config.minimumSamples ?? 100,
      useMahalanobisDistance: config.useMahalanobisDistance ?? true,
      useIsolationScoring: config.useIsolationScoring ?? false,
      maxHistorySize: config.maxHistorySize ?? 10000,
      temporalDecayFactor: config.temporalDecayFactor ?? 0.99,
    };
  }

  /**
   * Initialize empty distribution model
   */
  private initializeDistributionModel(): DistributionModel {
    return {
      samples: [],
      stats: {
        sampleCount: 0,
        featureMeans: [],
        featureStdDevs: [],
        featureRanges: [],
        lastUpdated: new Date().toISOString(),
        confidence: 0,
      },
      initialized: false,
    };
  }

  /**
   * Detect novelty in a batch of inputs
   * @param inputs - Array of input vectors to analyze
   * @returns NoveltyResult with detection outcomes
   */
  detect(inputs: InputVector[]): NoveltyResult {
    const startTime = Date.now();
    const flags: string[] = [];
    const outOfDistributionInputs: InputVector[] = [];
    const breakdown: NoveltyBreakdown[] = [];

    // Check if model is initialized
    if (!this.distributionModel.initialized) {
      flags.push(
        'WARNING: Distribution model not initialized with sufficient samples',
      );
      flags.push(
        `Current samples: ${this.distributionModel.stats.sampleCount}, Required: ${this.config.minimumSamples}`,
      );
    }

    // Process each input
    let totalScore = 0;
    for (const input of inputs) {
      const score = this.calculateNoveltyScore(input);
      const isOOD = this.isOutOfDistribution(input);

      if (isOOD) {
        outOfDistributionInputs.push(input);
      }

      totalScore += score;

      breakdown.push({
        inputId: input.id,
        score,
        isOutOfDistribution: isOOD,
        factors: this.getNoveltyFactors(input, score),
      });
    }

    const averageScore = inputs.length > 0 ? totalScore / inputs.length : 0;
    const detected = averageScore >= this.config.sensitivityThreshold;

    // Generate flags based on detection results
    if (detected) {
      flags.push(
        `NOVELTY_DETECTED: Average score ${averageScore.toFixed(3)} exceeds threshold`,
      );
    }

    if (outOfDistributionInputs.length > inputs.length * 0.5) {
      flags.push(
        `HIGH_OOD_RATE: ${outOfDistributionInputs.length}/${inputs.length} inputs are out-of-distribution`,
      );
    }

    // Add limitation warnings for high-stakes scenarios
    if (detected && averageScore > 0.9) {
      flags.push(
        'LIMITATION: Cannot determine if this represents a black swan event - recommend human review',
      );
    }

    const recommendation = this.determineRecommendation(
      averageScore,
      outOfDistributionInputs.length,
      inputs.length,
    );

    return {
      detected,
      score: averageScore,
      outOfDistributionInputs,
      flags,
      recommendation,
      breakdown,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check if a single input is out-of-distribution
   * @param input - Input vector to check
   * @returns true if input is considered out-of-distribution
   */
  isOutOfDistribution(input: InputVector): boolean {
    const score = this.calculateNoveltyScore(input);
    return score >= this.config.sensitivityThreshold;
  }

  /**
   * Calculate novelty score for a single input
   * Score ranges from 0 (typical) to 1 (highly novel)
   * @param input - Input vector to score
   * @returns Novelty score between 0 and 1
   */
  calculateNoveltyScore(input: InputVector): number {
    if (!this.distributionModel.initialized || input.features.length === 0) {
      // Without a trained model, we can't reliably detect novelty
      // Return 0.5 (uncertain) rather than falsely claiming novelty
      return 0.5;
    }

    const { stats } = this.distributionModel;

    // Ensure feature dimensions match
    if (input.features.length !== stats.featureMeans.length) {
      // Dimension mismatch is inherently novel
      return 1.0;
    }

    let noveltyScore: number;

    if (this.config.useMahalanobisDistance && stats.covarianceMatrix) {
      // Use Mahalanobis distance for correlated features
      noveltyScore = this.calculateMahalanobisScore(input.features, stats);
    } else {
      // Use standardized z-score approach
      noveltyScore = this.calculateZScoreNovelty(input.features, stats);
    }

    // Clamp to [0, 1] range
    return Math.max(0, Math.min(1, noveltyScore));
  }

  /**
   * Calculate novelty using z-score method
   */
  private calculateZScoreNovelty(
    features: number[],
    stats: DistributionStats,
  ): number {
    let maxZScore = 0;
    let sumZScores = 0;

    for (let i = 0; i < features.length; i++) {
      const stdDev = stats.featureStdDevs[i] || 1;
      const zScore = Math.abs(features[i] - stats.featureMeans[i]) / stdDev;
      maxZScore = Math.max(maxZScore, zScore);
      sumZScores += zScore;
    }

    // avgZScore is calculated but not used; max z-score is more indicative
    void (sumZScores / features.length);

    // Convert z-score to 0-1 scale using sigmoid-like function
    // At 3 std devs, score should be ~0.95
    const multiplier = this.config.standardDeviationMultiplier;
    const normalizedScore = maxZScore / multiplier;

    // Use tanh to smoothly map to [0, 1]
    return Math.tanh(normalizedScore * 1.5);
  }

  /**
   * Calculate novelty using Mahalanobis distance
   */
  private calculateMahalanobisScore(
    features: number[],
    stats: DistributionStats,
  ): number {
    if (!stats.covarianceMatrix) {
      return this.calculateZScoreNovelty(features, stats);
    }

    // Calculate Mahalanobis distance
    const diff = features.map((f, i) => f - stats.featureMeans[i]);

    // For simplicity, use diagonal approximation if full inverse is not computed
    // Full Mahalanobis would require matrix inversion
    let mahalanobis = 0;
    for (let i = 0; i < diff.length; i++) {
      const variance = stats.covarianceMatrix[i]?.[i] || 1;
      mahalanobis += (diff[i] * diff[i]) / variance;
    }
    mahalanobis = Math.sqrt(mahalanobis);

    // Chi-squared distribution: for n dimensions, mean is n, std is sqrt(2n)
    // Normalize to 0-1 scale
    const expectedDistance = Math.sqrt(features.length);
    const normalizedScore =
      mahalanobis /
      (expectedDistance * this.config.standardDeviationMultiplier);

    return Math.tanh(normalizedScore);
  }

  /**
   * Update the distribution model with new training data
   * @param newData - New input vectors to incorporate into the model
   */
  updateDistributionModel(newData: InputVector[]): void {
    if (newData.length === 0) {
      return;
    }

    // Add new samples
    this.distributionModel.samples.push(...newData);

    // Enforce max history size (FIFO)
    if (this.distributionModel.samples.length > this.config.maxHistorySize) {
      const excess =
        this.distributionModel.samples.length - this.config.maxHistorySize;
      this.distributionModel.samples.splice(0, excess);
    }

    // Recompute statistics
    this.recomputeStatistics();

    // Check if model is now initialized
    if (
      this.distributionModel.stats.sampleCount >= this.config.minimumSamples
    ) {
      this.distributionModel.initialized = true;
    }
  }

  /**
   * Recompute distribution statistics from samples
   */
  private recomputeStatistics(): void {
    const samples = this.distributionModel.samples;
    if (samples.length === 0) {
      return;
    }

    const featureCount = samples[0].features.length;
    const sampleCount = samples.length;

    // Initialize accumulators
    const sums = new Array(featureCount).fill(0);
    const mins = new Array(featureCount).fill(Infinity);
    const maxs = new Array(featureCount).fill(-Infinity);

    // First pass: compute means and ranges
    for (const sample of samples) {
      for (let i = 0; i < featureCount; i++) {
        const value = sample.features[i];
        sums[i] += value;
        mins[i] = Math.min(mins[i], value);
        maxs[i] = Math.max(maxs[i], value);
      }
    }

    const means = sums.map(sum => sum / sampleCount);

    // Second pass: compute standard deviations
    const varianceSums = new Array(featureCount).fill(0);
    for (const sample of samples) {
      for (let i = 0; i < featureCount; i++) {
        const diff = sample.features[i] - means[i];
        varianceSums[i] += diff * diff;
      }
    }

    const stdDevs = varianceSums.map(v => Math.sqrt(v / sampleCount));

    // Compute covariance matrix if enabled
    let covarianceMatrix: number[][] | undefined;
    if (this.config.useMahalanobisDistance && sampleCount > featureCount) {
      covarianceMatrix = this.computeCovarianceMatrix(
        samples,
        means,
        featureCount,
      );
    }

    // Update stats
    this.distributionModel.stats = {
      sampleCount,
      featureMeans: means,
      featureStdDevs: stdDevs,
      featureRanges: mins.map((min, i) => ({ min, max: maxs[i] })),
      covarianceMatrix,
      lastUpdated: new Date().toISOString(),
      confidence: this.calculateModelConfidence(sampleCount),
    };
  }

  /**
   * Compute covariance matrix from samples
   */
  private computeCovarianceMatrix(
    samples: InputVector[],
    means: number[],
    featureCount: number,
  ): number[][] {
    const matrix: number[][] = [];
    const n = samples.length;

    for (let i = 0; i < featureCount; i++) {
      matrix[i] = [];
      for (let j = 0; j < featureCount; j++) {
        let sum = 0;
        for (const sample of samples) {
          sum +=
            (sample.features[i] - means[i]) * (sample.features[j] - means[j]);
        }
        matrix[i][j] = sum / n;
      }
    }

    return matrix;
  }

  /**
   * Calculate model confidence based on sample count
   */
  private calculateModelConfidence(sampleCount: number): number {
    const minSamples = this.config.minimumSamples;
    if (sampleCount < minSamples) {
      return sampleCount / minSamples;
    }
    // Asymptotic approach to 1.0 with more samples
    const extraSamples = sampleCount - minSamples;
    return 0.8 + 0.2 * (1 - Math.exp(-extraSamples / 1000));
  }

  /**
   * Get current distribution statistics
   * @returns Current state of the distribution model
   */
  getDistributionStats(): DistributionStats {
    return { ...this.distributionModel.stats };
  }

  /**
   * Determine recommended action based on novelty detection
   */
  private determineRecommendation(
    score: number,
    oodCount: number,
    totalCount: number,
  ): 'proceed' | 'caution' | 'halt' {
    const oodRatio = totalCount > 0 ? oodCount / totalCount : 0;

    // HALT conditions
    if (score >= 0.9 || oodRatio >= 0.8) {
      return 'halt';
    }

    // CAUTION conditions
    if (score >= 0.6 || oodRatio >= 0.3) {
      return 'caution';
    }

    // PROCEED if novelty is low
    return 'proceed';
  }

  /**
   * Generate novelty factors for explanation
   */
  private getNoveltyFactors(
    input: InputVector,
    score: number,
  ): NoveltyFactor[] {
    const factors: NoveltyFactor[] = [];
    const { stats } = this.distributionModel;

    if (!this.distributionModel.initialized) {
      factors.push({
        name: 'insufficient_training',
        contribution: 0.5,
        description:
          'Model has insufficient training data for reliable detection',
      });
      return factors;
    }

    // Analyze each feature's contribution
    for (
      let i = 0;
      i < input.features.length && i < stats.featureMeans.length;
      i++
    ) {
      const value = input.features[i];
      const mean = stats.featureMeans[i];
      const stdDev = stats.featureStdDevs[i] || 1;
      const zScore = Math.abs(value - mean) / stdDev;

      if (zScore > this.config.standardDeviationMultiplier) {
        factors.push({
          name: `feature_${i}_outlier`,
          contribution: Math.min(
            zScore / (this.config.standardDeviationMultiplier * 2),
            0.5,
          ),
          description: `Feature ${i} value ${value.toFixed(3)} is ${zScore.toFixed(1)} std devs from mean`,
        });
      }
    }

    // Check for range violations
    for (
      let i = 0;
      i < input.features.length && i < stats.featureRanges.length;
      i++
    ) {
      const value = input.features[i];
      const range = stats.featureRanges[i];

      if (value < range.min || value > range.max) {
        factors.push({
          name: `feature_${i}_range_violation`,
          contribution: 0.3,
          description: `Feature ${i} value ${value.toFixed(3)} outside observed range [${range.min.toFixed(3)}, ${range.max.toFixed(3)}]`,
        });
      }
    }

    // If no specific factors found but score is high, add general factor
    if (factors.length === 0 && score > 0.5) {
      factors.push({
        name: 'general_deviation',
        contribution: score,
        description: 'Combined deviation across multiple features',
      });
    }

    return factors;
  }

  /**
   * Get mitigation recommendations for detected novelty
   *
   * When novelty is detected, these mitigations are recommended:
   * - Canary releases: Limit exposure while monitoring
   * - Increased oversight: Human-in-the-loop for decisions
   * - Rapid rollback: Ability to quickly revert changes
   *
   * @param result - The novelty detection result
   * @returns Array of mitigation recommendations
   */
  getMitigationRecommendations(
    result: NoveltyResult,
  ): MitigationRecommendation[] {
    const recommendations: MitigationRecommendation[] = [];

    if (!result.detected) {
      return recommendations;
    }

    // Always recommend increased oversight for detected novelty
    recommendations.push({
      type: 'increased_oversight',
      description: 'Enable enhanced human oversight for all decisions',
      urgency: result.score >= 0.8 ? 'high' : 'medium',
      actions: [
        'Enable guardian review for every decision',
        'Log all inputs and outputs for audit',
        'Set up real-time alerting for further anomalies',
      ],
    });

    // Canary release for caution level
    if (result.recommendation === 'caution') {
      recommendations.push({
        type: 'canary_release',
        description: 'Deploy changes to limited canary population first',
        urgency: 'medium',
        actions: [
          'Limit deployment to 5% of traffic',
          'Monitor error rates and user feedback closely',
          'Prepare rollback automation',
          'Set automatic rollback triggers for error rate > 1%',
        ],
      });
    }

    // Rapid rollback capability for halt level
    if (result.recommendation === 'halt') {
      recommendations.push({
        type: 'rapid_rollback',
        description: 'Ensure immediate rollback capability is active',
        urgency: 'critical',
        actions: [
          'Verify single-click rollback is functional',
          'Test rollback procedure before any deployment',
          'Stage previous known-good version for instant switch',
          'Alert on-call engineering team',
        ],
      });

      recommendations.push({
        type: 'full_halt',
        description: 'Halt deployment pending investigation',
        urgency: 'critical',
        actions: [
          'Do not proceed with deployment',
          'Escalate to architect for investigation',
          'Document all anomalous inputs for analysis',
          'Review limitation warnings - may be black swan or drift scenario',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Reset the distribution model to initial state
   */
  reset(): void {
    this.distributionModel = this.initializeDistributionModel();
  }

  /**
   * Get current configuration
   */
  getConfig(): NoveltyConfig {
    return { ...this.config };
  }

  /**
   * Check if model is ready for reliable detection
   */
  isModelReady(): boolean {
    return this.distributionModel.initialized;
  }
}

export default NoveltyDetector;
