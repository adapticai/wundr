/**
 * @wundr.io/agent-eval
 *
 * Agent evaluation framework with LLM-based grading for AI agent quality assessment.
 * Provides comprehensive tools for testing, evaluating, and improving AI agents through
 * automated evaluation suites, LLM-based grading, and continuous feedback loops.
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Exports (using export type for type-only exports)
// ============================================================================

// Zod Schemas (runtime values)
// ============================================================================
// Utility Functions
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

import {
  EvalSuiteSchema,
  EvalTestCaseSchema,
  GradingRubricSchema,
  DEFAULT_GRADING_RUBRIC,
} from './types';

import type { EvalSuite, EvalTestCase, GradingRubric } from './types';

export {
  GradingCriterionSchema,
  GradingRubricSchema,
  ExpectedOutputSchema,
  EvalTestCaseSchema,
  EvalSuiteSchema,
  CriterionResultSchema,
  TestCaseResultSchema,
  EvalResultsSummarySchema,
  EvalResultsSchema,
  HumanFeedbackSchema,
  FailureAnalysisSchema,
  // Constants
  DEFAULT_GRADING_RUBRIC,
} from './types';

// Types (type-only exports)
export type {
  GradingCriterion,
  GradingRubric,
  ExpectedOutput,
  EvalTestCase,
  EvalSuite,
  CriterionResult,
  TestCaseResult,
  EvalResultsSummary,
  EvalResults,
  HumanFeedback,
  FailureAnalysis,
  ExpectedOutputType,
  TestStatus,
  LLMProviderConfig,
  AgentExecutor,
  AgentOutput,
  RunEvalSuiteOptions,
  GradeWithLLMOptions,
  EvalProgress,
  CustomValidator,
  CustomValidationResult,
  EvalEventType,
  EvalEvent,
  EvalEventHandler,
  SamplingStrategy,
  SampleForReviewOptions,
} from './types';

// ============================================================================
// Evaluator Exports
// ============================================================================

export {
  AgentEvaluator,
  createEvaluator,
  createEvaluatorWithLLM,
} from './evaluator';

// ============================================================================
// Feedback Loop Exports
// ============================================================================

export {
  FeedbackLoop,
  createFeedbackLoop,
  summarizeFailureAnalysis,
} from './feedback-loop';

// ============================================================================
// Metrics Exports
// ============================================================================

export {
  // Statistical utilities
  calculateMean,
  calculateStdDev,
  calculateMedian,
  calculatePercentile,
  calculateConfidenceInterval,
  // Score calculations
  calculateWeightedScore,
  determinePassStatus,
  calculateConsistencyScore,
  // Summary calculations
  generateSummary,
  // Trend analysis
  calculateScoreTrend,
  compareEvalRuns,
  // Failure analysis
  analyzeFailures,
  // Metric aggregation
  aggregateIterationMetrics,
  calculateInterRaterReliability,
} from './metrics';

// ============================================================================
// Reporter Exports
// ============================================================================

export {
  ResultsReporter,
  createReporter,
  generateReport,
  generateComparisonReport,
} from './reporters';

export type { ReportFormat, ReportOptions, ReportOutput } from './reporters';

/**
 * Create a new evaluation suite with default configuration
 * @param name - Suite name
 * @param description - Suite description
 * @param testCases - Test cases to include
 * @param rubric - Default grading rubric (uses DEFAULT_GRADING_RUBRIC if not provided)
 * @returns Validated evaluation suite
 */
export function createEvalSuite(
  name: string,
  description: string,
  testCases: EvalTestCase[],
  rubric: GradingRubric = DEFAULT_GRADING_RUBRIC
): EvalSuite {
  const suite: EvalSuite = {
    id: uuidv4(),
    name,
    description,
    version: '1.0.0',
    testCases,
    defaultRubric: rubric,
    rubrics: [],
    config: {
      parallel: false,
      maxConcurrency: 5,
      stopOnFailure: false,
      defaultTimeoutMs: 30000,
      collectTraces: true,
    },
    tags: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return EvalSuiteSchema.parse(suite);
}

/**
 * Create a new test case with default configuration
 * @param name - Test case name
 * @param input - Input to provide to the agent
 * @param options - Additional test case options
 * @returns Validated test case
 */
export function createTestCase(
  name: string,
  input: string,
  options: Partial<Omit<EvalTestCase, 'id' | 'name' | 'input'>> = {}
): EvalTestCase {
  const testCase: EvalTestCase = {
    id: uuidv4(),
    name,
    description: options.description || name,
    input,
    context: options.context,
    expectedOutput: options.expectedOutput,
    referenceAnswer: options.referenceAnswer,
    rubricId: options.rubricId,
    timeoutMs: options.timeoutMs || 30000,
    iterations: options.iterations || 1,
    tags: options.tags || [],
    priority: options.priority || 5,
    enabled: options.enabled !== false,
    metadata: options.metadata || {},
  };

  return EvalTestCaseSchema.parse(testCase);
}

/**
 * Create a new grading rubric
 * @param name - Rubric name
 * @param description - Rubric description
 * @param criteria - Grading criteria
 * @param options - Additional rubric options
 * @returns Validated grading rubric
 */
export function createGradingRubric(
  name: string,
  description: string,
  criteria: GradingRubric['criteria'],
  options: Partial<
    Omit<GradingRubric, 'id' | 'name' | 'description' | 'criteria'>
  > = {}
): GradingRubric {
  const rubric: GradingRubric = {
    id: uuidv4(),
    name,
    description,
    version: options.version || '1.0.0',
    criteria,
    passingThreshold: options.passingThreshold || 7,
    customPrompt: options.customPrompt,
    tags: options.tags || [],
  };

  return GradingRubricSchema.parse(rubric);
}

/**
 * Validate an evaluation suite against its schema
 * @param suite - Suite to validate
 * @returns Validation result
 */
export function validateSuite(suite: unknown): {
  valid: boolean;
  errors: string[];
  suite?: EvalSuite;
} {
  try {
    const validated = EvalSuiteSchema.parse(suite);
    return { valid: true, errors: [], suite: validated };
  } catch (err) {
    const errors: string[] = [];
    if (err && typeof err === 'object' && 'errors' in err) {
      const zodErrors = (
        err as { errors: Array<{ message: string; path: (string | number)[] }> }
      ).errors;
      for (const e of zodErrors) {
        errors.push(`${e.path.join('.')}: ${e.message}`);
      }
    } else {
      errors.push(err instanceof Error ? err.message : String(err));
    }
    return { valid: false, errors };
  }
}

/**
 * Merge multiple evaluation suites into one
 * @param suites - Suites to merge
 * @param name - Name for the merged suite
 * @param description - Description for the merged suite
 * @returns Merged suite
 */
export function mergeSuites(
  suites: EvalSuite[],
  name: string,
  description: string
): EvalSuite {
  if (suites.length === 0) {
    throw new Error('At least one suite is required to merge');
  }

  // Collect all test cases, deduplicating by ID
  const testCaseMap = new Map<string, EvalTestCase>();
  for (const suite of suites) {
    for (const tc of suite.testCases) {
      if (!testCaseMap.has(tc.id)) {
        testCaseMap.set(tc.id, tc);
      }
    }
  }

  // Collect all rubrics, deduplicating by ID
  const rubricMap = new Map<string, GradingRubric>();
  for (const suite of suites) {
    if (!rubricMap.has(suite.defaultRubric.id)) {
      rubricMap.set(suite.defaultRubric.id, suite.defaultRubric);
    }
    for (const rubric of suite.rubrics) {
      if (!rubricMap.has(rubric.id)) {
        rubricMap.set(rubric.id, rubric);
      }
    }
  }

  // Collect all tags
  const allTags = new Set<string>();
  for (const suite of suites) {
    for (const tag of suite.tags) {
      allTags.add(tag);
    }
  }

  return createEvalSuite(
    name,
    description,
    [...testCaseMap.values()],
    suites[0].defaultRubric
  );
}
