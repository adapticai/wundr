/**
 * @wundr.io/agent-eval - Type Definitions
 *
 * TypeScript interfaces for the agent evaluation framework with LLM-based grading.
 * Defines structures for evaluation suites, test cases, grading rubrics, and results.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for grading criterion
 */
export const GradingCriterionSchema = z.object({
  /** Unique identifier for this criterion */
  id: z.string(),
  /** Human-readable name of the criterion */
  name: z.string(),
  /** Detailed description of what this criterion evaluates */
  description: z.string(),
  /** Weight of this criterion in the overall score (0-1) */
  weight: z.number().min(0).max(1).default(1),
  /** Minimum acceptable score for this criterion (0-10) */
  minAcceptableScore: z.number().min(0).max(10).default(5),
  /** Examples of good performance (optional) */
  goodExamples: z.array(z.string()).default([]),
  /** Examples of poor performance (optional) */
  badExamples: z.array(z.string()).default([]),
});

/**
 * Schema for grading rubric
 */
export const GradingRubricSchema = z.object({
  /** Unique identifier for this rubric */
  id: z.string(),
  /** Human-readable name of the rubric */
  name: z.string(),
  /** Description of what this rubric evaluates */
  description: z.string(),
  /** Version of the rubric */
  version: z.string().default('1.0.0'),
  /** Individual grading criteria */
  criteria: z.array(GradingCriterionSchema),
  /** Overall passing threshold (0-10) */
  passingThreshold: z.number().min(0).max(10).default(7),
  /** Custom prompt additions for LLM grading */
  customPrompt: z.string().optional(),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
});

/**
 * Schema for expected output specification
 */
export const ExpectedOutputSchema = z.object({
  /** Type of expectation check */
  type: z.enum([
    'exact',
    'contains',
    'regex',
    'semantic',
    'llm-judge',
    'custom',
  ]),
  /** Expected value or pattern */
  value: z.string().optional(),
  /** For semantic similarity, minimum similarity threshold (0-1) */
  similarityThreshold: z.number().min(0).max(1).optional(),
  /** Custom validation function name (for 'custom' type) */
  customValidator: z.string().optional(),
  /** Additional metadata for complex expectations */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for evaluation test case
 */
export const EvalTestCaseSchema = z.object({
  /** Unique identifier for this test case */
  id: z.string(),
  /** Human-readable name of the test case */
  name: z.string(),
  /** Description of what this test case evaluates */
  description: z.string(),
  /** Input to provide to the agent */
  input: z.string(),
  /** Context or system prompt for the agent */
  context: z.string().optional(),
  /** Expected output specifications */
  expectedOutput: ExpectedOutputSchema.optional(),
  /** Reference answer for comparison */
  referenceAnswer: z.string().optional(),
  /** Rubric to use for this test case (if different from suite default) */
  rubricId: z.string().optional(),
  /** Maximum execution time in milliseconds */
  timeoutMs: z.number().positive().default(30000),
  /** Number of times to run this test for consistency */
  iterations: z.number().positive().default(1),
  /** Tags for filtering and categorization */
  tags: z.array(z.string()).default([]),
  /** Priority level for test execution order */
  priority: z.number().min(0).max(10).default(5),
  /** Whether this test case is enabled */
  enabled: z.boolean().default(true),
  /** Custom metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for evaluation suite
 */
export const EvalSuiteSchema = z.object({
  /** Unique identifier for this suite */
  id: z.string(),
  /** Human-readable name of the suite */
  name: z.string(),
  /** Description of what this suite evaluates */
  description: z.string(),
  /** Version of the suite */
  version: z.string().default('1.0.0'),
  /** Test cases in this suite */
  testCases: z.array(EvalTestCaseSchema),
  /** Default rubric for test cases without explicit rubric */
  defaultRubric: GradingRubricSchema,
  /** Additional rubrics available in this suite */
  rubrics: z.array(GradingRubricSchema).default([]),
  /** Configuration for the evaluation run */
  config: z
    .object({
      /** Whether to run tests in parallel */
      parallel: z.boolean().default(false),
      /** Maximum concurrent tests when running in parallel */
      maxConcurrency: z.number().positive().default(5),
      /** Whether to stop on first failure */
      stopOnFailure: z.boolean().default(false),
      /** Default timeout for all tests */
      defaultTimeoutMs: z.number().positive().default(30000),
      /** Whether to collect detailed traces */
      collectTraces: z.boolean().default(true),
    })
    .default({}),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** Suite metadata */
  metadata: z.record(z.unknown()).default({}),
  /** When the suite was created */
  createdAt: z.date().optional(),
  /** When the suite was last modified */
  updatedAt: z.date().optional(),
});

/**
 * Schema for individual criterion result
 */
export const CriterionResultSchema = z.object({
  /** Criterion ID */
  criterionId: z.string(),
  /** Criterion name */
  criterionName: z.string(),
  /** Score for this criterion (0-10) */
  score: z.number().min(0).max(10),
  /** Weighted score based on criterion weight */
  weightedScore: z.number(),
  /** LLM explanation for the score */
  explanation: z.string(),
  /** Whether this criterion passed */
  passed: z.boolean(),
  /** Confidence in the assessment (0-1) */
  confidence: z.number().min(0).max(1).default(1),
});

/**
 * Schema for test case result
 */
export const TestCaseResultSchema = z.object({
  /** Test case ID */
  testCaseId: z.string(),
  /** Test case name */
  testCaseName: z.string(),
  /** Iteration number (1-based) */
  iteration: z.number().positive(),
  /** Whether the test passed */
  passed: z.boolean(),
  /** Overall score (0-10) */
  score: z.number().min(0).max(10),
  /** Agent's actual output */
  actualOutput: z.string(),
  /** Results for each criterion */
  criterionResults: z.array(CriterionResultSchema),
  /** LLM's overall assessment */
  overallAssessment: z.string(),
  /** Execution time in milliseconds */
  executionTimeMs: z.number().nonnegative(),
  /** Error if test failed to execute */
  error: z.string().optional(),
  /** Trace data if collected */
  trace: z.record(z.unknown()).optional(),
  /** Timestamp of the result */
  timestamp: z.date(),
});

/**
 * Schema for evaluation results summary
 */
export const EvalResultsSummarySchema = z.object({
  /** Total number of test cases */
  totalTests: z.number().nonnegative(),
  /** Number of passed tests */
  passedTests: z.number().nonnegative(),
  /** Number of failed tests */
  failedTests: z.number().nonnegative(),
  /** Number of errored tests */
  erroredTests: z.number().nonnegative(),
  /** Pass rate (0-1) */
  passRate: z.number().min(0).max(1),
  /** Average score across all tests */
  averageScore: z.number().min(0).max(10),
  /** Average score per criterion */
  criterionAverages: z.record(z.number()),
  /** Total execution time in milliseconds */
  totalExecutionTimeMs: z.number().nonnegative(),
  /** Average execution time per test */
  avgExecutionTimeMs: z.number().nonnegative(),
});

/**
 * Schema for full evaluation results
 */
export const EvalResultsSchema = z.object({
  /** Evaluation run ID */
  runId: z.string(),
  /** Suite ID */
  suiteId: z.string(),
  /** Suite name */
  suiteName: z.string(),
  /** Suite version */
  suiteVersion: z.string(),
  /** Individual test results */
  testResults: z.array(TestCaseResultSchema),
  /** Summary statistics */
  summary: EvalResultsSummarySchema,
  /** When the evaluation started */
  startedAt: z.date(),
  /** When the evaluation completed */
  completedAt: z.date(),
  /** Agent identifier being evaluated */
  agentId: z.string().optional(),
  /** Agent version being evaluated */
  agentVersion: z.string().optional(),
  /** Run configuration */
  config: z.record(z.unknown()).default({}),
  /** Run metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for human feedback on a test result
 */
export const HumanFeedbackSchema = z.object({
  /** Feedback ID */
  id: z.string(),
  /** Associated test result (testCaseId + iteration) */
  testResultRef: z.object({
    runId: z.string(),
    testCaseId: z.string(),
    iteration: z.number().positive(),
  }),
  /** Reviewer ID */
  reviewerId: z.string(),
  /** Whether reviewer agrees with LLM assessment */
  agreesWithLLM: z.boolean(),
  /** Reviewer's suggested score (if different) */
  suggestedScore: z.number().min(0).max(10).optional(),
  /** Detailed feedback comments */
  comments: z.string(),
  /** Per-criterion feedback */
  criterionFeedback: z
    .array(
      z.object({
        criterionId: z.string(),
        agreesWithScore: z.boolean(),
        suggestedScore: z.number().min(0).max(10).optional(),
        comment: z.string().optional(),
      }),
    )
    .default([]),
  /** Suggested improvements for the rubric */
  rubricSuggestions: z.string().optional(),
  /** When the feedback was submitted */
  submittedAt: z.date(),
  /** Feedback tags */
  tags: z.array(z.string()).default([]),
});

/**
 * Schema for failure analysis
 */
export const FailureAnalysisSchema = z.object({
  /** Analysis ID */
  id: z.string(),
  /** Run ID being analyzed */
  runId: z.string(),
  /** Failed test case IDs */
  failedTestCaseIds: z.array(z.string()),
  /** Identified failure patterns */
  patterns: z.array(
    z.object({
      /** Pattern name */
      name: z.string(),
      /** Pattern description */
      description: z.string(),
      /** Test case IDs matching this pattern */
      matchingTestCases: z.array(z.string()),
      /** Frequency of this pattern */
      frequency: z.number().min(0).max(1),
      /** Suggested remediation */
      suggestedRemediation: z.string().optional(),
    }),
  ),
  /** Common criteria that failed */
  commonFailingCriteria: z.array(
    z.object({
      criterionId: z.string(),
      criterionName: z.string(),
      failureRate: z.number().min(0).max(1),
      avgScore: z.number().min(0).max(10),
    }),
  ),
  /** Root cause hypotheses */
  rootCauses: z.array(z.string()),
  /** Recommended actions */
  recommendations: z.array(z.string()),
  /** When the analysis was performed */
  analyzedAt: z.date(),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

/**
 * A single grading criterion
 */
export type GradingCriterion = z.infer<typeof GradingCriterionSchema>;

/**
 * A grading rubric containing multiple criteria
 */
export type GradingRubric = z.infer<typeof GradingRubricSchema>;

/**
 * Specification for expected output
 */
export type ExpectedOutput = z.infer<typeof ExpectedOutputSchema>;

/**
 * A single evaluation test case
 */
export type EvalTestCase = z.infer<typeof EvalTestCaseSchema>;

/**
 * An evaluation suite containing multiple test cases
 */
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;

/**
 * Result for a single criterion evaluation
 */
export type CriterionResult = z.infer<typeof CriterionResultSchema>;

/**
 * Result for a single test case execution
 */
export type TestCaseResult = z.infer<typeof TestCaseResultSchema>;

/**
 * Summary statistics for an evaluation run
 */
export type EvalResultsSummary = z.infer<typeof EvalResultsSummarySchema>;

/**
 * Full evaluation results
 */
export type EvalResults = z.infer<typeof EvalResultsSchema>;

/**
 * Human feedback on evaluation results
 */
export type HumanFeedback = z.infer<typeof HumanFeedbackSchema>;

/**
 * Failure analysis for an evaluation run
 */
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

// ============================================================================
// Additional Types (Not Schema-Validated)
// ============================================================================

/**
 * Expected output check type
 */
export type ExpectedOutputType =
  | 'exact'
  | 'contains'
  | 'regex'
  | 'semantic'
  | 'llm-judge'
  | 'custom';

/**
 * Test case status
 */
export type TestStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'errored'
  | 'skipped';

/**
 * LLM provider configuration for grading
 */
export interface LLMProviderConfig {
  /** Provider name (e.g., 'openai', 'anthropic', 'custom') */
  provider: string;
  /** Model identifier */
  model: string;
  /** API key (or environment variable name) */
  apiKey?: string;
  /** API base URL for custom providers */
  baseUrl?: string;
  /** Temperature for LLM responses */
  temperature?: number;
  /** Maximum tokens for LLM response */
  maxTokens?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Agent execution interface
 */
export interface AgentExecutor {
  /**
   * Execute the agent with the given input
   * @param input - Input prompt for the agent
   * @param context - Optional context/system prompt
   * @returns Agent's output
   */
  execute(input: string, context?: string): Promise<AgentOutput>;
}

/**
 * Agent output from execution
 */
export interface AgentOutput {
  /** Agent's response text */
  response: string;
  /** Execution metadata */
  metadata?: {
    /** Tokens used in the response */
    tokensUsed?: number;
    /** Model used for the response */
    model?: string;
    /** Latency in milliseconds */
    latencyMs?: number;
    /** Any additional metadata */
    [key: string]: unknown;
  };
  /** Trace data for debugging */
  trace?: Record<string, unknown>;
}

/**
 * Options for running an evaluation suite
 */
export interface RunEvalSuiteOptions {
  /** Override suite configuration */
  configOverrides?: Partial<EvalSuite['config']>;
  /** Filter test cases by tags */
  filterTags?: string[];
  /** Filter test cases by IDs */
  filterIds?: string[];
  /** Agent ID for tracking */
  agentId?: string;
  /** Agent version for tracking */
  agentVersion?: string;
  /** Additional metadata for the run */
  metadata?: Record<string, unknown>;
  /** Progress callback */
  onProgress?: (progress: EvalProgress) => void;
}

/**
 * Progress update during evaluation
 */
export interface EvalProgress {
  /** Current test case index (0-based) */
  currentTest: number;
  /** Total number of tests */
  totalTests: number;
  /** Current test case name */
  currentTestName: string;
  /** Current iteration */
  currentIteration: number;
  /** Total iterations for current test */
  totalIterations: number;
  /** Status of current test */
  status: TestStatus;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

/**
 * Options for LLM-based grading
 */
export interface GradeWithLLMOptions {
  /** LLM provider configuration */
  llmConfig: LLMProviderConfig;
  /** Custom system prompt for the grader */
  customSystemPrompt?: string;
  /** Whether to include examples in the prompt */
  includeExamples?: boolean;
  /** Retry attempts on failure */
  retryAttempts?: number;
  /** Timeout for LLM call */
  timeoutMs?: number;
}

/**
 * Custom validator function type
 */
export type CustomValidator = (
  actualOutput: string,
  testCase: EvalTestCase,
  context?: Record<string, unknown>
) => Promise<CustomValidationResult>;

/**
 * Result from a custom validator
 */
export interface CustomValidationResult {
  /** Whether the validation passed */
  passed: boolean;
  /** Score for the validation (0-10) */
  score: number;
  /** Explanation of the result */
  explanation: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Event types emitted during evaluation
 */
export type EvalEventType =
  | 'eval:started'
  | 'eval:completed'
  | 'test:started'
  | 'test:completed'
  | 'test:failed'
  | 'test:errored'
  | 'grade:started'
  | 'grade:completed'
  | 'progress:update';

/**
 * Evaluation event payload
 */
export interface EvalEvent {
  /** Event type */
  type: EvalEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Event payload */
  payload: {
    runId?: string;
    suiteId?: string;
    testCaseId?: string;
    iteration?: number;
    result?: TestCaseResult;
    error?: string;
    progress?: EvalProgress;
    details?: Record<string, unknown>;
  };
}

/**
 * Event handler for evaluation events
 */
export type EvalEventHandler = (event: EvalEvent) => void | Promise<void>;

/**
 * Sampling strategy for human review
 */
export type SamplingStrategy =
  | 'random'
  | 'stratified'
  | 'low-confidence'
  | 'failures-only'
  | 'edge-cases';

/**
 * Options for sampling test results for review
 */
export interface SampleForReviewOptions {
  /** Sampling strategy */
  strategy: SamplingStrategy;
  /** Number of samples to select */
  sampleSize: number;
  /** Confidence threshold for 'low-confidence' strategy */
  confidenceThreshold?: number;
  /** Tags to focus on for 'stratified' strategy */
  stratifyByTags?: string[];
  /** Seed for reproducible random sampling */
  randomSeed?: number;
}

/**
 * Default grading rubric for general agent evaluation
 */
export const DEFAULT_GRADING_RUBRIC: GradingRubric = {
  id: 'default-rubric',
  name: 'Default Agent Evaluation Rubric',
  description: 'A general-purpose rubric for evaluating AI agent responses',
  version: '1.0.0',
  criteria: [
    {
      id: 'accuracy',
      name: 'Accuracy',
      description: 'How factually correct and accurate is the response?',
      weight: 0.3,
      minAcceptableScore: 6,
      goodExamples: [],
      badExamples: [],
    },
    {
      id: 'relevance',
      name: 'Relevance',
      description: 'How relevant is the response to the input/question?',
      weight: 0.25,
      minAcceptableScore: 6,
      goodExamples: [],
      badExamples: [],
    },
    {
      id: 'completeness',
      name: 'Completeness',
      description: 'Does the response fully address all aspects of the input?',
      weight: 0.2,
      minAcceptableScore: 5,
      goodExamples: [],
      badExamples: [],
    },
    {
      id: 'clarity',
      name: 'Clarity',
      description: 'How clear and well-structured is the response?',
      weight: 0.15,
      minAcceptableScore: 5,
      goodExamples: [],
      badExamples: [],
    },
    {
      id: 'helpfulness',
      name: 'Helpfulness',
      description: 'How helpful and actionable is the response for the user?',
      weight: 0.1,
      minAcceptableScore: 5,
      goodExamples: [],
      badExamples: [],
    },
  ],
  passingThreshold: 7,
  tags: ['general', 'default'],
};
