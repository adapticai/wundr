/**
 * @wundr.io/agent-eval - Evaluation Metrics
 *
 * Utilities for calculating and analyzing evaluation metrics.
 * Includes statistical functions, scoring calculations, and metric aggregation.
 */

import { v4 as uuidv4 } from 'uuid';

import { FailureAnalysisSchema } from './types';

import type {
  TestCaseResult,
  CriterionResult,
  EvalResults,
  EvalResultsSummary,
  GradingRubric,
  FailureAnalysis,
} from './types';

// ============================================================================
// Statistical Utilities
// ============================================================================

/**
 * Calculate the mean of an array of numbers
 * @param values - Array of numbers
 * @returns Mean value, or 0 if array is empty
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 * @param values - Array of numbers
 * @returns Standard deviation, or 0 if array has less than 2 elements
 */
export function calculateStdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return Math.sqrt(calculateMean(squaredDiffs));
}

/**
 * Calculate the median of an array of numbers
 * @param values - Array of numbers
 * @returns Median value, or 0 if array is empty
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate percentile of an array of numbers
 * @param values - Array of numbers
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value, or 0 if array is empty
 */
export function calculatePercentile(
  values: number[],
  percentile: number
): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

/**
 * Calculate confidence interval using bootstrapping
 * @param values - Array of numbers
 * @param confidence - Confidence level (0-1, default 0.95)
 * @param iterations - Number of bootstrap iterations
 * @returns Confidence interval bounds
 */
export function calculateConfidenceInterval(
  values: number[],
  confidence: number = 0.95,
  iterations: number = 1000
): { lower: number; upper: number } {
  if (values.length === 0) {
    return { lower: 0, upper: 0 };
  }
  if (values.length === 1) {
    return { lower: values[0], upper: values[0] };
  }

  const bootstrapMeans: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample = Array.from(
      { length: values.length },
      () => values[Math.floor(Math.random() * values.length)]
    );
    bootstrapMeans.push(calculateMean(sample));
  }

  const alpha = 1 - confidence;
  return {
    lower: calculatePercentile(bootstrapMeans, (alpha / 2) * 100),
    upper: calculatePercentile(bootstrapMeans, (1 - alpha / 2) * 100),
  };
}

// ============================================================================
// Score Calculations
// ============================================================================

/**
 * Calculate weighted score from criterion results
 * @param criterionResults - Array of criterion results
 * @param rubric - The grading rubric used
 * @returns Weighted overall score (0-10)
 */
export function calculateWeightedScore(
  criterionResults: CriterionResult[],
  rubric: GradingRubric
): number {
  if (criterionResults.length === 0) {
    return 0;
  }

  const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = criterionResults.reduce((sum, result) => {
    return sum + result.weightedScore;
  }, 0);

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Determine if a test case passed based on results and rubric
 * @param criterionResults - Array of criterion results
 * @param overallScore - The overall score
 * @param rubric - The grading rubric used
 * @returns Whether the test passed
 */
export function determinePassStatus(
  criterionResults: CriterionResult[],
  overallScore: number,
  rubric: GradingRubric
): boolean {
  // Check overall threshold
  if (overallScore < rubric.passingThreshold) {
    return false;
  }

  // Check individual criterion thresholds
  for (const result of criterionResults) {
    const criterion = rubric.criteria.find(c => c.id === result.criterionId);
    if (criterion && result.score < criterion.minAcceptableScore) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate consistency score across multiple iterations
 * @param iterationScores - Scores from multiple iterations of the same test
 * @returns Consistency score (0-1, where 1 is perfectly consistent)
 */
export function calculateConsistencyScore(iterationScores: number[]): number {
  if (iterationScores.length <= 1) {
    return 1;
  }
  const stdDev = calculateStdDev(iterationScores);
  // Normalize: 0 stdDev = 1 consistency, 10 stdDev (max possible) = 0 consistency
  return Math.max(0, 1 - stdDev / 10);
}

// ============================================================================
// Summary Calculations
// ============================================================================

/**
 * Generate summary statistics from test results
 * @param testResults - Array of test case results
 * @returns Summary statistics
 */
export function generateSummary(
  testResults: TestCaseResult[]
): EvalResultsSummary {
  if (testResults.length === 0) {
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      erroredTests: 0,
      passRate: 0,
      averageScore: 0,
      criterionAverages: {},
      totalExecutionTimeMs: 0,
      avgExecutionTimeMs: 0,
    };
  }

  // Count test statuses
  const passedTests = testResults.filter(r => r.passed && !r.error).length;
  const erroredTests = testResults.filter(r => r.error).length;
  const failedTests = testResults.length - passedTests - erroredTests;

  // Calculate score statistics
  const validScores = testResults.filter(r => !r.error).map(r => r.score);
  const averageScore = calculateMean(validScores);

  // Calculate criterion averages
  const criterionScores: Record<string, number[]> = {};
  for (const result of testResults) {
    if (!result.error) {
      for (const cr of result.criterionResults) {
        if (!criterionScores[cr.criterionId]) {
          criterionScores[cr.criterionId] = [];
        }
        criterionScores[cr.criterionId].push(cr.score);
      }
    }
  }

  const criterionAverages: Record<string, number> = {};
  for (const [criterionId, scores] of Object.entries(criterionScores)) {
    criterionAverages[criterionId] = calculateMean(scores);
  }

  // Calculate timing statistics
  const executionTimes = testResults.map(r => r.executionTimeMs);
  const totalExecutionTimeMs = executionTimes.reduce((sum, t) => sum + t, 0);
  const avgExecutionTimeMs = calculateMean(executionTimes);

  return {
    totalTests: testResults.length,
    passedTests,
    failedTests,
    erroredTests,
    passRate: testResults.length > 0 ? passedTests / testResults.length : 0,
    averageScore,
    criterionAverages,
    totalExecutionTimeMs,
    avgExecutionTimeMs,
  };
}

// ============================================================================
// Trend Analysis
// ============================================================================

/**
 * Calculate score trend across multiple evaluation runs
 * @param evalResults - Array of evaluation results (chronologically ordered)
 * @returns Trend analysis
 */
export function calculateScoreTrend(evalResults: EvalResults[]): {
  trend: 'improving' | 'declining' | 'stable';
  slope: number;
  rSquared: number;
  recentChange: number;
} {
  if (evalResults.length < 2) {
    return { trend: 'stable', slope: 0, rSquared: 0, recentChange: 0 };
  }

  const scores = evalResults.map(r => r.summary.averageScore);
  const n = scores.length;

  // Calculate linear regression
  const xMean = (n - 1) / 2;
  const yMean = calculateMean(scores);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (scores[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate R-squared
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = yMean + slope * (i - xMean);
    ssRes += Math.pow(scores[i] - predicted, 2);
    ssTot += Math.pow(scores[i] - yMean, 2);
  }
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Calculate recent change
  const recentChange = scores[scores.length - 1] - scores[scores.length - 2];

  // Determine trend
  let trend: 'improving' | 'declining' | 'stable';
  if (Math.abs(slope) < 0.1 && Math.abs(recentChange) < 0.5) {
    trend = 'stable';
  } else if (slope > 0) {
    trend = 'improving';
  } else {
    trend = 'declining';
  }

  return { trend, slope, rSquared, recentChange };
}

/**
 * Compare two evaluation runs and identify significant changes
 * @param baseline - Baseline evaluation results
 * @param current - Current evaluation results
 * @returns Comparison analysis
 */
export function compareEvalRuns(
  baseline: EvalResults,
  current: EvalResults
): {
  overallChange: number;
  criterionChanges: Record<string, { change: number; significant: boolean }>;
  newFailures: string[];
  fixedTests: string[];
  consistencyChange: number;
} {
  const overallChange =
    current.summary.averageScore - baseline.summary.averageScore;

  // Calculate criterion changes
  const criterionChanges: Record<
    string,
    { change: number; significant: boolean }
  > = {};
  for (const [criterionId, currentAvg] of Object.entries(
    current.summary.criterionAverages
  )) {
    const baselineAvg = baseline.summary.criterionAverages[criterionId] || 0;
    const change = currentAvg - baselineAvg;
    criterionChanges[criterionId] = {
      change,
      significant: Math.abs(change) >= 1, // 1 point change is significant
    };
  }

  // Find new failures and fixed tests
  const baselinePassedIds = new Set(
    baseline.testResults.filter(r => r.passed).map(r => r.testCaseId)
  );
  const _currentPassedIds = new Set(
    current.testResults.filter(r => r.passed).map(r => r.testCaseId)
  );

  const newFailures = current.testResults
    .filter(r => !r.passed && baselinePassedIds.has(r.testCaseId))
    .map(r => r.testCaseId);

  const fixedTests = current.testResults
    .filter(r => r.passed && !baselinePassedIds.has(r.testCaseId))
    .map(r => r.testCaseId);

  // Calculate consistency change
  const baselineConsistency = calculateConsistencyScore(
    baseline.testResults.map(r => r.score)
  );
  const currentConsistency = calculateConsistencyScore(
    current.testResults.map(r => r.score)
  );
  const consistencyChange = currentConsistency - baselineConsistency;

  return {
    overallChange,
    criterionChanges,
    newFailures,
    fixedTests,
    consistencyChange,
  };
}

// ============================================================================
// Failure Analysis
// ============================================================================

/**
 * Analyze failures in evaluation results to identify patterns
 * @param evalResults - Evaluation results to analyze
 * @returns Failure analysis
 */
export function analyzeFailures(evalResults: EvalResults): FailureAnalysis {
  const failedResults = evalResults.testResults.filter(
    r => !r.passed || r.error
  );
  const failedTestCaseIds = [...new Set(failedResults.map(r => r.testCaseId))];

  // Analyze criterion failures
  const criterionFailures: Record<string, { count: number; scores: number[] }> =
    {};
  for (const result of failedResults) {
    if (!result.error) {
      for (const cr of result.criterionResults) {
        if (!cr.passed) {
          if (!criterionFailures[cr.criterionId]) {
            criterionFailures[cr.criterionId] = { count: 0, scores: [] };
          }
          criterionFailures[cr.criterionId].count++;
          criterionFailures[cr.criterionId].scores.push(cr.score);
        }
      }
    }
  }

  const commonFailingCriteria = Object.entries(criterionFailures)
    .map(([criterionId, data]) => ({
      criterionId,
      criterionName:
        failedResults
          .flatMap(r => r.criterionResults)
          .find(cr => cr.criterionId === criterionId)?.criterionName ||
        criterionId,
      failureRate: data.count / failedResults.filter(r => !r.error).length,
      avgScore: calculateMean(data.scores),
    }))
    .sort((a, b) => b.failureRate - a.failureRate);

  // Identify patterns (simple heuristic-based pattern detection)
  const patterns: FailureAnalysis['patterns'] = [];

  // Pattern: Low scores on specific criterion
  for (const criterion of commonFailingCriteria) {
    if (criterion.failureRate >= 0.5) {
      patterns.push({
        name: `High ${criterion.criterionName} Failure Rate`,
        description: `${Math.round(criterion.failureRate * 100)}% of failed tests have low ${criterion.criterionName} scores`,
        matchingTestCases: failedResults
          .filter(r =>
            r.criterionResults.some(
              cr => cr.criterionId === criterion.criterionId && !cr.passed
            )
          )
          .map(r => r.testCaseId),
        frequency: criterion.failureRate,
        suggestedRemediation: `Focus on improving ${criterion.criterionName} in agent responses`,
      });
    }
  }

  // Pattern: Execution errors
  const erroredResults = failedResults.filter(r => r.error);
  if (erroredResults.length > 0) {
    patterns.push({
      name: 'Execution Errors',
      description: `${erroredResults.length} tests failed due to execution errors`,
      matchingTestCases: erroredResults.map(r => r.testCaseId),
      frequency: erroredResults.length / failedResults.length,
      suggestedRemediation: 'Review agent error handling and timeout settings',
    });
  }

  // Generate root causes and recommendations
  const rootCauses: string[] = [];
  const recommendations: string[] = [];

  if (
    commonFailingCriteria.length > 0 &&
    commonFailingCriteria[0].failureRate >= 0.5
  ) {
    rootCauses.push(
      `Primary weakness in ${commonFailingCriteria[0].criterionName} (avg score: ${commonFailingCriteria[0].avgScore.toFixed(1)})`
    );
    recommendations.push(
      `Improve agent's ${commonFailingCriteria[0].criterionName.toLowerCase()} through targeted training or prompt refinement`
    );
  }

  if (erroredResults.length > 0) {
    rootCauses.push('Agent execution instability causing test failures');
    recommendations.push(
      'Increase timeout limits and implement better error handling'
    );
  }

  if (failedResults.length > evalResults.testResults.length * 0.5) {
    rootCauses.push('Widespread performance issues across the test suite');
    recommendations.push(
      'Consider fundamental improvements to the agent before re-evaluation'
    );
  }

  const analysis: FailureAnalysis = {
    id: uuidv4(),
    runId: evalResults.runId,
    failedTestCaseIds,
    patterns,
    commonFailingCriteria,
    rootCauses,
    recommendations,
    analyzedAt: new Date(),
  };

  // Validate with schema
  return FailureAnalysisSchema.parse(analysis);
}

// ============================================================================
// Metric Aggregation
// ============================================================================

/**
 * Aggregate metrics from multiple test iterations
 * @param results - Test results from multiple iterations of the same test
 * @returns Aggregated metrics
 */
export function aggregateIterationMetrics(results: TestCaseResult[]): {
  meanScore: number;
  stdDev: number;
  minScore: number;
  maxScore: number;
  consistency: number;
  confidenceInterval: { lower: number; upper: number };
  allPassed: boolean;
  passRate: number;
} {
  const scores = results.map(r => r.score);
  const passedCount = results.filter(r => r.passed).length;

  return {
    meanScore: calculateMean(scores),
    stdDev: calculateStdDev(scores),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    consistency: calculateConsistencyScore(scores),
    confidenceInterval: calculateConfidenceInterval(scores),
    allPassed: passedCount === results.length,
    passRate: results.length > 0 ? passedCount / results.length : 0,
  };
}

/**
 * Calculate inter-rater reliability between LLM and human scores
 * @param llmScores - Scores from LLM grading
 * @param humanScores - Scores from human review
 * @returns Reliability metrics
 */
export function calculateInterRaterReliability(
  llmScores: number[],
  humanScores: number[]
): {
  correlation: number;
  meanAbsoluteError: number;
  agreement: number;
  kappa: number;
} {
  if (llmScores.length !== humanScores.length || llmScores.length === 0) {
    return { correlation: 0, meanAbsoluteError: 0, agreement: 0, kappa: 0 };
  }

  const n = llmScores.length;

  // Calculate Pearson correlation
  const llmMean = calculateMean(llmScores);
  const humanMean = calculateMean(humanScores);

  let numerator = 0;
  let llmDenominator = 0;
  let humanDenominator = 0;

  for (let i = 0; i < n; i++) {
    const llmDiff = llmScores[i] - llmMean;
    const humanDiff = humanScores[i] - humanMean;
    numerator += llmDiff * humanDiff;
    llmDenominator += llmDiff * llmDiff;
    humanDenominator += humanDiff * humanDiff;
  }

  const correlation =
    llmDenominator > 0 && humanDenominator > 0
      ? numerator / Math.sqrt(llmDenominator * humanDenominator)
      : 0;

  // Calculate mean absolute error
  const absoluteErrors = llmScores.map((score, i) =>
    Math.abs(score - humanScores[i])
  );
  const meanAbsoluteError = calculateMean(absoluteErrors);

  // Calculate exact agreement (within 1 point)
  const agreementCount = llmScores.filter(
    (score, i) => Math.abs(score - humanScores[i]) <= 1
  ).length;
  const agreement = agreementCount / n;

  // Calculate Cohen's Kappa (simplified for pass/fail agreement)
  const threshold = 7; // Passing threshold
  const llmPass = llmScores.map(s => s >= threshold);
  const humanPass = humanScores.map(s => s >= threshold);

  let bothPass = 0;
  let bothFail = 0;
  let llmPassHumanFail = 0;
  let llmFailHumanPass = 0;

  for (let i = 0; i < n; i++) {
    if (llmPass[i] && humanPass[i]) {
      bothPass++;
    } else if (!llmPass[i] && !humanPass[i]) {
      bothFail++;
    } else if (llmPass[i] && !humanPass[i]) {
      llmPassHumanFail++;
    } else {
      llmFailHumanPass++;
    }
  }

  const observedAgreement = (bothPass + bothFail) / n;
  const llmPassRate = (bothPass + llmPassHumanFail) / n;
  const humanPassRate = (bothPass + llmFailHumanPass) / n;
  const expectedAgreement =
    llmPassRate * humanPassRate + (1 - llmPassRate) * (1 - humanPassRate);

  const kappa =
    expectedAgreement < 1
      ? (observedAgreement - expectedAgreement) / (1 - expectedAgreement)
      : 1;

  return { correlation, meanAbsoluteError, agreement, kappa };
}
