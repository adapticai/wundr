/**
 * Divergence Detector
 * Statistical drift detection for risk twin metrics comparison
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Metric series containing timestamped data points
 */
export interface MetricSeries {
  name: string;
  data: TimeSeriesPoint[];
  color?: string;
  unit?: string;
}

/**
 * Configuration for divergence detection
 */
export interface DivergenceConfig {
  /** Confidence threshold for statistical tests (default: 0.95) */
  confidenceThreshold?: number;
  /** Early deviation threshold as a percentage (default: 0.15 = 15%) */
  earlyDeviationThreshold?: number;
  /** Minimum sample size for statistical significance */
  minSampleSize?: number;
  /** Window size in hours for early deviation detection */
  earlyDeviationWindowHours?: number;
}

/**
 * Result of confidence interval check
 */
export interface ConfidenceCheck {
  /** Whether confidence interval is exceeded */
  exceeded: boolean;
  /** Twin mean value */
  twinMean: number;
  /** Baseline mean value */
  baselineMean: number;
  /** Lower bound of confidence interval */
  lowerBound: number;
  /** Upper bound of confidence interval */
  upperBound: number;
  /** Z-score of the comparison */
  zScore: number;
  /** Standard error of the difference */
  standardError: number;
}

/**
 * Result of early deviation check
 */
export interface DeviationCheck {
  /** Whether early deviation is detected */
  detected: boolean;
  /** Deviation percentage from baseline */
  deviationPercent: number;
  /** Window size in hours used for detection */
  windowHours: number;
  /** Twin window mean */
  twinWindowMean: number;
  /** Baseline window mean */
  baselineWindowMean: number;
  /** Threshold that was used */
  threshold: number;
}

/**
 * Drift metrics for detailed analysis
 */
export interface DriftMetrics {
  /** Overall drift score (0-1) */
  driftScore: number;
  /** Mean absolute deviation */
  meanAbsoluteDeviation: number;
  /** Root mean square deviation */
  rootMeanSquareDeviation: number;
  /** Maximum deviation observed */
  maxDeviation: number;
  /** Correlation coefficient between twin and baseline */
  correlationCoefficient: number;
  /** Trend direction: increasing, decreasing, or stable */
  trendDirection: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Individual metric comparison result
 */
export interface MetricComparison {
  /** Metric name */
  metric: string;
  /** Twin value */
  twinValue: number;
  /** Baseline value */
  baselineValue: number;
  /** Deviation from baseline */
  deviation: number;
}

/**
 * Complete divergence detection result
 */
export interface DivergenceResult {
  /** Whether divergence was detected */
  detected: boolean;
  /** Whether confidence interval was exceeded */
  confidenceIntervalExceeded: boolean;
  /** Whether early deviation was detected */
  earlyDeviationDetected: boolean;
  /** Overall drift score (0-1) */
  driftScore: number;
  /** Detailed metrics comparison */
  metrics: MetricComparison[];
  /** Confidence check details */
  confidenceCheck?: ConfidenceCheck;
  /** Deviation check details */
  deviationCheck?: DeviationCheck;
  /** Drift metrics details */
  driftMetrics?: DriftMetrics;
  /** Timestamp of the analysis */
  timestamp: Date;
}

// ============================================================================
// Statistical Utility Functions
// ============================================================================

/**
 * Calculate the mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
function calculateStandardDeviation(values: number[], mean?: number): number {
  if (values.length === 0) {
    return 0;
  }
  const avg = mean ?? calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate the z-score for a value given mean and standard deviation
 * Exported for use in advanced statistical analysis
 */
export function calculateZScore(
  value: number,
  mean: number,
  stdDev: number
): number {
  if (stdDev === 0) {
    return 0;
  }
  return (value - mean) / stdDev;
}

/**
 * Calculate the standard error of the difference between two means
 */
function calculateStandardError(
  stdDev1: number,
  n1: number,
  stdDev2: number,
  n2: number
): number {
  if (n1 === 0 || n2 === 0) {
    return 0;
  }
  return Math.sqrt(Math.pow(stdDev1, 2) / n1 + Math.pow(stdDev2, 2) / n2);
}

/**
 * Get z-value for a given confidence level
 * Common values: 0.90 -> 1.645, 0.95 -> 1.96, 0.99 -> 2.576
 */
function getZValueForConfidence(confidence: number): number {
  // Using common z-values for standard confidence levels
  if (confidence >= 0.99) {
    return 2.576;
  }
  if (confidence >= 0.95) {
    return 1.96;
  }
  if (confidence >= 0.9) {
    return 1.645;
  }
  if (confidence >= 0.85) {
    return 1.44;
  }
  if (confidence >= 0.8) {
    return 1.28;
  }
  // For other values, use a simple approximation
  return 1.96; // Default to 95%
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) {
    return 0;
  }

  const meanX = calculateMean(x.slice(0, n));
  const meanY = calculateMean(y.slice(0, n));

  let numerator = 0;
  let sumSquaredX = 0;
  let sumSquaredY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumSquaredX += diffX * diffX;
    sumSquaredY += diffY * diffY;
  }

  const denominator = Math.sqrt(sumSquaredX * sumSquaredY);
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * Extract numeric values from a MetricSeries
 */
function extractValues(series: MetricSeries): number[] {
  return series.data.map(point => point.value);
}

/**
 * Get data points within a time window
 * Exported for use in time-series analysis
 */
export function getDataInWindow(
  series: MetricSeries,
  windowHours: number
): number[] {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  return series.data
    .filter(point => {
      const timestamp =
        point.timestamp instanceof Date
          ? point.timestamp
          : new Date(point.timestamp);
      return timestamp >= windowStart;
    })
    .map(point => point.value);
}

// ============================================================================
// DivergenceDetector Class
// ============================================================================

/**
 * DivergenceDetector
 *
 * Performs statistical drift detection between twin and baseline metrics.
 * Uses confidence intervals, early deviation detection, and drift scoring.
 */
export class DivergenceDetector {
  private confidenceThreshold: number;
  private earlyDeviationThreshold: number;
  private earlyDeviationWindowHours: number;

  constructor(config: DivergenceConfig = {}) {
    this.confidenceThreshold = config.confidenceThreshold ?? 0.95;
    this.earlyDeviationThreshold = config.earlyDeviationThreshold ?? 0.15;
    this.earlyDeviationWindowHours = config.earlyDeviationWindowHours ?? 24;
  }

  /**
   * Detect divergence between twin and baseline metrics
   */
  detect(
    twinMetrics: MetricSeries,
    baselineMetrics: MetricSeries
  ): DivergenceResult {
    const twinValues = extractValues(twinMetrics);
    const baselineValues = extractValues(baselineMetrics);

    // Check confidence interval
    const confidenceCheck = this.checkConfidenceInterval(
      twinValues,
      baselineValues
    );

    // Check early deviation
    const deviationCheck = this.checkEarlyDeviation(
      twinValues,
      baselineValues,
      this.earlyDeviationWindowHours
    );

    // Calculate statistical drift
    const driftMetrics = this.calculateStatisticalDrift(
      twinMetrics,
      baselineMetrics
    );

    // Build metrics comparison array
    const metrics = this.buildMetricsComparison(twinMetrics, baselineMetrics);

    const result: DivergenceResult = {
      detected:
        confidenceCheck.exceeded ||
        deviationCheck.detected ||
        driftMetrics.driftScore > 0.5,
      confidenceIntervalExceeded: confidenceCheck.exceeded,
      earlyDeviationDetected: deviationCheck.detected,
      driftScore: driftMetrics.driftScore,
      metrics,
      confidenceCheck,
      deviationCheck,
      driftMetrics,
      timestamp: new Date(),
    };

    return result;
  }

  /**
   * Check if twin values fall outside the confidence interval of baseline
   */
  checkConfidenceInterval(twin: number[], baseline: number[]): ConfidenceCheck {
    const twinMean = calculateMean(twin);
    const baselineMean = calculateMean(baseline);
    const twinStdDev = calculateStandardDeviation(twin, twinMean);
    const baselineStdDev = calculateStandardDeviation(baseline, baselineMean);

    const standardError = calculateStandardError(
      twinStdDev,
      twin.length,
      baselineStdDev,
      baseline.length
    );

    const zValue = getZValueForConfidence(this.confidenceThreshold);
    const marginOfError = zValue * standardError;

    const lowerBound = baselineMean - marginOfError;
    const upperBound = baselineMean + marginOfError;

    const exceeded = twinMean < lowerBound || twinMean > upperBound;

    // Calculate z-score for the difference
    const zScore =
      standardError > 0 ? (twinMean - baselineMean) / standardError : 0;

    return {
      exceeded,
      twinMean,
      baselineMean,
      lowerBound,
      upperBound,
      zScore,
      standardError,
    };
  }

  /**
   * Check for early deviation within a specified time window
   */
  checkEarlyDeviation(
    twin: number[],
    baseline: number[],
    windowHours: number
  ): DeviationCheck {
    // For array inputs, use the most recent data points based on window
    // Assuming data is sorted by time, take the last N points proportional to window
    const windowSize = Math.max(
      1,
      Math.floor(twin.length * (windowHours / 24))
    );

    const twinWindow = twin.slice(-windowSize);
    const baselineWindow = baseline.slice(-windowSize);

    const twinWindowMean = calculateMean(twinWindow);
    const baselineWindowMean = calculateMean(baselineWindow);

    // Calculate deviation percentage
    const deviationPercent =
      baselineWindowMean !== 0
        ? Math.abs(twinWindowMean - baselineWindowMean) /
          Math.abs(baselineWindowMean)
        : twinWindowMean !== 0
          ? 1
          : 0;

    const detected = deviationPercent > this.earlyDeviationThreshold;

    return {
      detected,
      deviationPercent,
      windowHours,
      twinWindowMean,
      baselineWindowMean,
      threshold: this.earlyDeviationThreshold,
    };
  }

  /**
   * Calculate comprehensive statistical drift metrics
   */
  calculateStatisticalDrift(
    twin: MetricSeries,
    baseline: MetricSeries
  ): DriftMetrics {
    const twinValues = extractValues(twin);
    const baselineValues = extractValues(baseline);

    const n = Math.min(twinValues.length, baselineValues.length);

    if (n === 0) {
      return {
        driftScore: 0,
        meanAbsoluteDeviation: 0,
        rootMeanSquareDeviation: 0,
        maxDeviation: 0,
        correlationCoefficient: 0,
        trendDirection: 'stable',
      };
    }

    // Calculate point-wise deviations
    const deviations: number[] = [];
    for (let i = 0; i < n; i++) {
      deviations.push(twinValues[i] - baselineValues[i]);
    }

    // Mean Absolute Deviation
    const meanAbsoluteDeviation = calculateMean(deviations.map(Math.abs));

    // Root Mean Square Deviation
    const squaredDeviations = deviations.map(d => d * d);
    const rootMeanSquareDeviation = Math.sqrt(calculateMean(squaredDeviations));

    // Maximum Deviation
    const maxDeviation = Math.max(...deviations.map(Math.abs));

    // Correlation Coefficient
    const correlationCoefficient = calculateCorrelation(
      twinValues.slice(0, n),
      baselineValues.slice(0, n)
    );

    // Determine trend direction
    const trendDirection = this.determineTrendDirection(deviations);

    // Calculate drift score (normalized 0-1)
    const driftScore = this.calculateDriftScore(
      meanAbsoluteDeviation,
      rootMeanSquareDeviation,
      correlationCoefficient,
      baselineValues
    );

    return {
      driftScore,
      meanAbsoluteDeviation,
      rootMeanSquareDeviation,
      maxDeviation,
      correlationCoefficient,
      trendDirection,
    };
  }

  /**
   * Determine if the divergence is statistically significant
   */
  isSignificantDivergence(result: DivergenceResult): boolean {
    // Divergence is significant if:
    // 1. Confidence interval is exceeded, OR
    // 2. Early deviation is detected AND drift score is above threshold, OR
    // 3. Drift score is very high (> 0.7)

    if (result.confidenceIntervalExceeded) {
      return true;
    }

    if (result.earlyDeviationDetected && result.driftScore > 0.3) {
      return true;
    }

    if (result.driftScore > 0.7) {
      return true;
    }

    return false;
  }

  /**
   * Build metrics comparison array
   */
  private buildMetricsComparison(
    twin: MetricSeries,
    baseline: MetricSeries
  ): MetricComparison[] {
    const twinValues = extractValues(twin);
    const baselineValues = extractValues(baseline);

    const n = Math.min(twinValues.length, baselineValues.length);

    if (n === 0) {
      return [];
    }

    // Calculate aggregate statistics
    const twinMean = calculateMean(twinValues);
    const baselineMean = calculateMean(baselineValues);
    const twinStdDev = calculateStandardDeviation(twinValues, twinMean);
    const baselineStdDev = calculateStandardDeviation(
      baselineValues,
      baselineMean
    );

    const comparisons: MetricComparison[] = [
      {
        metric: `${twin.name}_mean`,
        twinValue: twinMean,
        baselineValue: baselineMean,
        deviation:
          baselineMean !== 0 ? (twinMean - baselineMean) / baselineMean : 0,
      },
      {
        metric: `${twin.name}_stddev`,
        twinValue: twinStdDev,
        baselineValue: baselineStdDev,
        deviation:
          baselineStdDev !== 0
            ? (twinStdDev - baselineStdDev) / baselineStdDev
            : 0,
      },
      {
        metric: `${twin.name}_min`,
        twinValue: Math.min(...twinValues),
        baselineValue: Math.min(...baselineValues),
        deviation:
          Math.min(...baselineValues) !== 0
            ? (Math.min(...twinValues) - Math.min(...baselineValues)) /
              Math.abs(Math.min(...baselineValues))
            : 0,
      },
      {
        metric: `${twin.name}_max`,
        twinValue: Math.max(...twinValues),
        baselineValue: Math.max(...baselineValues),
        deviation:
          Math.max(...baselineValues) !== 0
            ? (Math.max(...twinValues) - Math.max(...baselineValues)) /
              Math.abs(Math.max(...baselineValues))
            : 0,
      },
    ];

    return comparisons;
  }

  /**
   * Determine trend direction from deviations
   */
  private determineTrendDirection(
    deviations: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (deviations.length < 2) {
      return 'stable';
    }

    // Calculate linear regression slope
    const n = deviations.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += deviations[i];
      sumXY += i * deviations[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Determine direction based on slope magnitude
    const threshold = 0.01 * calculateMean(deviations.map(Math.abs));

    if (slope > threshold) {
      return 'increasing';
    } else if (slope < -threshold) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Calculate normalized drift score (0-1)
   */
  private calculateDriftScore(
    mad: number,
    rmsd: number,
    correlation: number,
    baselineValues: number[]
  ): number {
    if (baselineValues.length === 0) {
      return 0;
    }

    const baselineRange =
      Math.max(...baselineValues) - Math.min(...baselineValues);
    const baselineMean = calculateMean(baselineValues);
    const normalizer =
      baselineRange > 0 ? baselineRange : Math.abs(baselineMean) || 1;

    // Normalize MAD and RMSD by baseline range/mean
    const normalizedMad = Math.min(1, mad / normalizer);
    const normalizedRmsd = Math.min(1, rmsd / normalizer);

    // Convert correlation to dissimilarity (1 - |correlation|)
    const dissimilarity = 1 - Math.abs(correlation);

    // Weighted combination
    const driftScore =
      0.4 * normalizedMad + 0.4 * normalizedRmsd + 0.2 * dissimilarity;

    return Math.min(1, Math.max(0, driftScore));
  }
}
