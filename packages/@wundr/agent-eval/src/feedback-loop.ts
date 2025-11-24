/**
 * @wundr.io/agent-eval - Feedback Loop
 *
 * Implements continuous improvement through human feedback collection,
 * systematic sampling for review, and failure analysis.
 */

import { v4 as uuidv4 } from 'uuid';

import { analyzeFailures, calculateInterRaterReliability } from './metrics';
import { HumanFeedbackSchema } from './types';

import type {
  EvalResults,
  TestCaseResult,
  HumanFeedback,
  FailureAnalysis,
  SampleForReviewOptions,
} from './types';

// ============================================================================
// FeedbackLoop Class
// ============================================================================

/**
 * FeedbackLoop - Continuous improvement through human feedback
 *
 * Manages the collection, analysis, and application of human feedback
 * on AI agent evaluation results to improve grading accuracy and rubric quality.
 */
export class FeedbackLoop {
  private feedbackStore: Map<string, HumanFeedback[]> = new Map();
  private analysisCache: Map<string, FailureAnalysis> = new Map();

  /**
   * Collect human feedback on a specific test result
   * @param evalResults - Evaluation results containing the test
   * @param testCaseId - ID of the test case to provide feedback on
   * @param iteration - Iteration number (1-based)
   * @param feedbackData - Feedback data from reviewer
   * @returns Created feedback record
   */
  collectFeedback(
    evalResults: EvalResults,
    testCaseId: string,
    iteration: number,
    feedbackData: {
      reviewerId: string;
      agreesWithLLM: boolean;
      suggestedScore?: number;
      comments: string;
      criterionFeedback?: Array<{
        criterionId: string;
        agreesWithScore: boolean;
        suggestedScore?: number;
        comment?: string;
      }>;
      rubricSuggestions?: string;
      tags?: string[];
    },
  ): HumanFeedback {
    // Find the test result
    const testResult = evalResults.testResults.find(
      r => r.testCaseId === testCaseId && r.iteration === iteration,
    );

    if (!testResult) {
      throw new Error(
        `Test result not found: ${testCaseId} iteration ${iteration}`,
      );
    }

    // Create feedback record
    const feedback: HumanFeedback = HumanFeedbackSchema.parse({
      id: uuidv4(),
      testResultRef: {
        runId: evalResults.runId,
        testCaseId,
        iteration,
      },
      reviewerId: feedbackData.reviewerId,
      agreesWithLLM: feedbackData.agreesWithLLM,
      suggestedScore: feedbackData.suggestedScore,
      comments: feedbackData.comments,
      criterionFeedback: feedbackData.criterionFeedback || [],
      rubricSuggestions: feedbackData.rubricSuggestions,
      submittedAt: new Date(),
      tags: feedbackData.tags || [],
    });

    // Store feedback
    const key = `${evalResults.runId}:${testCaseId}:${iteration}`;
    const existing = this.feedbackStore.get(key) || [];
    existing.push(feedback);
    this.feedbackStore.set(key, existing);

    return feedback;
  }

  /**
   * Sample test results for human review based on strategy
   * @param evalResults - Evaluation results to sample from
   * @param options - Sampling options
   * @returns Selected test results for review
   */
  sampleForReview(
    evalResults: EvalResults,
    options: SampleForReviewOptions,
  ): TestCaseResult[] {
    const { strategy, sampleSize } = options;
    let candidates = [...evalResults.testResults];

    switch (strategy) {
      case 'failures-only':
        candidates = candidates.filter(r => !r.passed || r.error);
        break;

      case 'low-confidence': {
        const threshold = options.confidenceThreshold || 0.7;
        candidates = candidates.filter(r => {
          const avgConfidence =
            r.criterionResults.length > 0
              ? r.criterionResults.reduce((sum, cr) => sum + cr.confidence, 0) /
                r.criterionResults.length
              : 1;
          return avgConfidence < threshold;
        });
        break;
      }

      case 'edge-cases':
        // Select results with scores near the passing threshold
        candidates = candidates.filter(r => {
          const score = r.score;
          return score >= 5 && score <= 8; // Near-threshold scores
        });
        break;

      case 'stratified':
        // Stratify by tags if specified
        if (options.stratifyByTags && options.stratifyByTags.length > 0) {
          const tagGroups = new Map<string, TestCaseResult[]>();

          for (const result of candidates) {
            // Note: We need to match against original test case tags
            // For simplicity, using testCaseId as proxy
            const groupKey = result.testCaseId.split('-')[0] || 'other';
            const group = tagGroups.get(groupKey) || [];
            group.push(result);
            tagGroups.set(groupKey, group);
          }

          // Sample proportionally from each group
          const sampled: TestCaseResult[] = [];
          const groupCount = tagGroups.size;
          const perGroup = Math.ceil(sampleSize / groupCount);

          for (const group of tagGroups.values()) {
            const shuffled = this.shuffleArray(group, options.randomSeed);
            sampled.push(...shuffled.slice(0, perGroup));
          }

          return sampled.slice(0, sampleSize);
        }
        break;

      case 'random':
      default:
        // Random sampling is applied at the end
        break;
    }

    // Apply random sampling to remaining candidates
    const shuffled = this.shuffleArray(candidates, options.randomSeed);
    return shuffled.slice(0, sampleSize);
  }

  /**
   * Analyze failures in evaluation results
   * @param evalResults - Evaluation results to analyze
   * @param useCache - Whether to use cached analysis
   * @returns Failure analysis
   */
  analyzeFailures(
    evalResults: EvalResults,
    useCache: boolean = true,
  ): FailureAnalysis {
    if (useCache && this.analysisCache.has(evalResults.runId)) {
      return this.analysisCache.get(evalResults.runId)!;
    }

    const analysis = analyzeFailures(evalResults);
    this.analysisCache.set(evalResults.runId, analysis);

    return analysis;
  }

  /**
   * Get feedback statistics for a run
   * @param runId - Evaluation run ID
   * @returns Feedback statistics
   */
  getFeedbackStats(runId: string): {
    totalFeedback: number;
    agreementRate: number;
    avgScoreDelta: number;
    mostDisagreedCriteria: string[];
    rubricSuggestionCount: number;
  } {
    const allFeedback: HumanFeedback[] = [];

    for (const [key, feedback] of this.feedbackStore.entries()) {
      if (key.startsWith(runId)) {
        allFeedback.push(...feedback);
      }
    }

    if (allFeedback.length === 0) {
      return {
        totalFeedback: 0,
        agreementRate: 0,
        avgScoreDelta: 0,
        mostDisagreedCriteria: [],
        rubricSuggestionCount: 0,
      };
    }

    // Calculate agreement rate
    const agreementCount = allFeedback.filter(f => f.agreesWithLLM).length;
    const agreementRate = agreementCount / allFeedback.length;

    // Calculate average score delta
    const scoreDeltas = allFeedback
      .filter(f => f.suggestedScore !== undefined)
      .map(f => Math.abs(f.suggestedScore! - 7)); // Assume 7 as default LLM score
    const avgScoreDelta =
      scoreDeltas.length > 0
        ? scoreDeltas.reduce((sum, d) => sum + d, 0) / scoreDeltas.length
        : 0;

    // Find most disagreed criteria
    const criterionDisagreements = new Map<string, number>();
    for (const feedback of allFeedback) {
      for (const cf of feedback.criterionFeedback) {
        if (!cf.agreesWithScore) {
          const count = criterionDisagreements.get(cf.criterionId) || 0;
          criterionDisagreements.set(cf.criterionId, count + 1);
        }
      }
    }

    const mostDisagreedCriteria = [...criterionDisagreements.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    // Count rubric suggestions
    const rubricSuggestionCount = allFeedback.filter(
      f => f.rubricSuggestions && f.rubricSuggestions.trim().length > 0,
    ).length;

    return {
      totalFeedback: allFeedback.length,
      agreementRate,
      avgScoreDelta,
      mostDisagreedCriteria,
      rubricSuggestionCount,
    };
  }

  /**
   * Calculate inter-rater reliability between LLM and human reviewers
   * @param runId - Evaluation run ID
   * @param evalResults - Original evaluation results
   * @returns Reliability metrics
   */
  calculateReliability(
    runId: string,
    evalResults: EvalResults,
  ): {
    correlation: number;
    meanAbsoluteError: number;
    agreement: number;
    kappa: number;
    sampleSize: number;
  } {
    const llmScores: number[] = [];
    const humanScores: number[] = [];

    for (const result of evalResults.testResults) {
      const key = `${runId}:${result.testCaseId}:${result.iteration}`;
      const feedback = this.feedbackStore.get(key);

      if (feedback && feedback.length > 0) {
        // Use the most recent feedback with a suggested score
        const relevantFeedback = feedback.find(
          f => f.suggestedScore !== undefined,
        );
        if (relevantFeedback) {
          llmScores.push(result.score);
          humanScores.push(relevantFeedback.suggestedScore!);
        }
      }
    }

    if (llmScores.length === 0) {
      return {
        correlation: 0,
        meanAbsoluteError: 0,
        agreement: 0,
        kappa: 0,
        sampleSize: 0,
      };
    }

    const reliability = calculateInterRaterReliability(llmScores, humanScores);
    return {
      ...reliability,
      sampleSize: llmScores.length,
    };
  }

  /**
   * Get all feedback for a specific test result
   * @param runId - Evaluation run ID
   * @param testCaseId - Test case ID
   * @param iteration - Iteration number
   * @returns Array of feedback records
   */
  getFeedback(
    runId: string,
    testCaseId: string,
    iteration: number,
  ): HumanFeedback[] {
    const key = `${runId}:${testCaseId}:${iteration}`;
    return this.feedbackStore.get(key) || [];
  }

  /**
   * Get all feedback for a run
   * @param runId - Evaluation run ID
   * @returns Array of all feedback records
   */
  getAllFeedbackForRun(runId: string): HumanFeedback[] {
    const allFeedback: HumanFeedback[] = [];

    for (const [key, feedback] of this.feedbackStore.entries()) {
      if (key.startsWith(runId)) {
        allFeedback.push(...feedback);
      }
    }

    return allFeedback;
  }

  /**
   * Export feedback for rubric improvement analysis
   * @param runId - Evaluation run ID
   * @returns Structured feedback for analysis
   */
  exportFeedbackForAnalysis(runId: string): {
    summary: ReturnType<FeedbackLoop['getFeedbackStats']>;
    criterionInsights: Array<{
      criterionId: string;
      agreementRate: number;
      avgSuggestedDelta: number;
      comments: string[];
    }>;
    rubricSuggestions: string[];
    rawFeedback: HumanFeedback[];
  } {
    const allFeedback = this.getAllFeedbackForRun(runId);
    const summary = this.getFeedbackStats(runId);

    // Aggregate criterion-level insights
    const criterionMap = new Map<
      string,
      { agrees: number; total: number; deltas: number[]; comments: string[] }
    >();

    for (const feedback of allFeedback) {
      for (const cf of feedback.criterionFeedback) {
        const existing = criterionMap.get(cf.criterionId) || {
          agrees: 0,
          total: 0,
          deltas: [],
          comments: [],
        };

        existing.total++;
        if (cf.agreesWithScore) {
          existing.agrees++;
        }
        if (cf.suggestedScore !== undefined) {
          existing.deltas.push(cf.suggestedScore);
        }
        if (cf.comment) {
          existing.comments.push(cf.comment);
        }

        criterionMap.set(cf.criterionId, existing);
      }
    }

    const criterionInsights = [...criterionMap.entries()].map(([id, data]) => ({
      criterionId: id,
      agreementRate: data.total > 0 ? data.agrees / data.total : 0,
      avgSuggestedDelta:
        data.deltas.length > 0
          ? data.deltas.reduce((sum, d) => sum + d, 0) / data.deltas.length
          : 0,
      comments: data.comments,
    }));

    const rubricSuggestions = allFeedback
      .map(f => f.rubricSuggestions)
      .filter((s): s is string => !!s && s.trim().length > 0);

    return {
      summary,
      criterionInsights,
      rubricSuggestions,
      rawFeedback: allFeedback,
    };
  }

  /**
   * Clear all feedback data
   */
  clearFeedback(): void {
    this.feedbackStore.clear();
    this.analysisCache.clear();
  }

  /**
   * Clear feedback for a specific run
   * @param runId - Evaluation run ID
   */
  clearRunFeedback(runId: string): void {
    for (const key of this.feedbackStore.keys()) {
      if (key.startsWith(runId)) {
        this.feedbackStore.delete(key);
      }
    }
    this.analysisCache.delete(runId);
  }

  /**
   * Shuffle array with optional seed for reproducibility
   */
  private shuffleArray<T>(array: T[], seed?: number): T[] {
    const shuffled = [...array];
    const random = seed !== undefined ? this.seededRandom(seed) : Math.random;

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Create a seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new FeedbackLoop instance
 * @returns FeedbackLoop instance
 */
export function createFeedbackLoop(): FeedbackLoop {
  return new FeedbackLoop();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a human-readable summary of failure analysis
 * @param analysis - Failure analysis to summarize
 * @returns Human-readable summary string
 */
export function summarizeFailureAnalysis(analysis: FailureAnalysis): string {
  const lines: string[] = [];

  lines.push('# Failure Analysis Report');
  lines.push(`Run ID: ${analysis.runId}`);
  lines.push(`Analyzed: ${analysis.analyzedAt.toISOString()}`);
  lines.push(`Failed Tests: ${analysis.failedTestCaseIds.length}`);
  lines.push('');

  if (analysis.patterns.length > 0) {
    lines.push('## Identified Patterns');
    for (const pattern of analysis.patterns) {
      lines.push(`### ${pattern.name}`);
      lines.push(pattern.description);
      lines.push(`- Frequency: ${(pattern.frequency * 100).toFixed(1)}%`);
      lines.push(`- Affected tests: ${pattern.matchingTestCases.length}`);
      if (pattern.suggestedRemediation) {
        lines.push(`- Suggested fix: ${pattern.suggestedRemediation}`);
      }
      lines.push('');
    }
  }

  if (analysis.commonFailingCriteria.length > 0) {
    lines.push('## Commonly Failing Criteria');
    for (const criterion of analysis.commonFailingCriteria) {
      lines.push(
        `- ${criterion.criterionName}: ${(criterion.failureRate * 100).toFixed(1)}% failure rate (avg score: ${criterion.avgScore.toFixed(1)})`,
      );
    }
    lines.push('');
  }

  if (analysis.rootCauses.length > 0) {
    lines.push('## Root Causes');
    for (const cause of analysis.rootCauses) {
      lines.push(`- ${cause}`);
    }
    lines.push('');
  }

  if (analysis.recommendations.length > 0) {
    lines.push('## Recommendations');
    for (const rec of analysis.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join('\n');
}
