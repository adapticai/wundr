# @wundr.io/agent-eval

Agent evaluation framework with LLM-based grading for AI agent quality assessment. Provides comprehensive tools for testing, evaluating, and improving AI agents through automated evaluation suites, LLM-based grading, and continuous feedback loops.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Package Overview](#package-overview)
- [Core Concepts](#core-concepts)
- [Evaluation Metrics and Scoring](#evaluation-metrics-and-scoring)
- [Benchmark Suites](#benchmark-suites)
- [Performance Tracking](#performance-tracking)
- [Comparative Analysis](#comparative-analysis)
- [Feedback Loop and Continuous Improvement](#feedback-loop-and-continuous-improvement)
- [Integration with IPRE Governance](#integration-with-ipre-governance)
- [API Reference](#api-reference)
- [Examples](#examples)

## Installation

```bash
npm install @wundr.io/agent-eval
# or
yarn add @wundr.io/agent-eval
# or
pnpm add @wundr.io/agent-eval
```

## Quick Start

```typescript
import {
  createEvaluator,
  createEvalSuite,
  createTestCase,
  createReporter,
} from '@wundr.io/agent-eval';

// 1. Create test cases
const testCases = [
  createTestCase('basic-qa', 'What is the capital of France?', {
    description: 'Basic factual question',
    referenceAnswer: 'Paris is the capital of France.',
    tags: ['factual', 'geography'],
  }),
];

// 2. Create an evaluation suite
const suite = createEvalSuite(
  'Agent QA Benchmark',
  'Evaluates agent performance on question-answering tasks',
  testCases
);

// 3. Define your agent executor
const agent = {
  execute: async (input: string) => {
    // Your agent implementation
    const response = await yourAgent.respond(input);
    return { response };
  },
};

// 4. Run evaluation
const evaluator = createEvaluator();
const results = await evaluator.runEvalSuite(suite, agent);

// 5. Generate report
const reporter = createReporter();
const report = reporter.generate(results, { format: 'markdown' });
console.log(report.content);
```

## Package Overview

The `@wundr.io/agent-eval` package provides:

- **Agent Evaluation Engine**: Run comprehensive test suites against AI agents
- **LLM-Based Grading**: Use LLMs as judges for subjective quality assessment
- **Multiple Output Check Types**: exact, contains, regex, semantic, llm-judge, custom
- **Grading Rubrics**: Customizable multi-criteria evaluation rubrics
- **Statistical Metrics**: Mean, std dev, percentiles, confidence intervals
- **Trend Analysis**: Track performance over time across multiple runs
- **Failure Analysis**: Identify patterns and root causes in failures
- **Feedback Loop**: Collect human feedback to improve grading accuracy
- **Multiple Report Formats**: Console, JSON, Markdown, HTML, CSV

## Core Concepts

### Evaluation Suite

An `EvalSuite` contains a collection of test cases, grading rubrics, and configuration:

```typescript
interface EvalSuite {
  id: string;
  name: string;
  description: string;
  version: string;
  testCases: EvalTestCase[];
  defaultRubric: GradingRubric;
  rubrics: GradingRubric[];
  config: {
    parallel: boolean;
    maxConcurrency: number;
    stopOnFailure: boolean;
    defaultTimeoutMs: number;
    collectTraces: boolean;
  };
  tags: string[];
  metadata: Record<string, unknown>;
}
```

### Test Case

Each `EvalTestCase` defines an input, expected output, and evaluation parameters:

```typescript
interface EvalTestCase {
  id: string;
  name: string;
  description: string;
  input: string;
  context?: string;
  expectedOutput?: ExpectedOutput;
  referenceAnswer?: string;
  rubricId?: string;
  timeoutMs: number;
  iterations: number;
  tags: string[];
  priority: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}
```

### Expected Output Types

```typescript
type ExpectedOutputType =
  | 'exact' // Exact string match
  | 'contains' // Output contains expected value
  | 'regex' // Regex pattern match
  | 'semantic' // Semantic similarity (requires embeddings)
  | 'llm-judge' // LLM-based evaluation
  | 'custom'; // Custom validator function
```

### Grading Rubric

Define multi-criteria evaluation rubrics:

```typescript
interface GradingRubric {
  id: string;
  name: string;
  description: string;
  version: string;
  criteria: GradingCriterion[];
  passingThreshold: number; // 0-10
  customPrompt?: string;
  tags: string[];
}

interface GradingCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1
  minAcceptableScore: number; // 0-10
  goodExamples: string[];
  badExamples: string[];
}
```

### Default Grading Rubric

The package includes a default rubric with five criteria:

| Criterion     | Weight | Min Score | Description                            |
| ------------- | ------ | --------- | -------------------------------------- |
| Accuracy      | 0.30   | 6         | Factual correctness of the response    |
| Relevance     | 0.25   | 6         | How relevant the response is to input  |
| Completeness  | 0.20   | 5         | Coverage of all aspects in the input   |
| Clarity       | 0.15   | 5         | Structure and readability              |
| Helpfulness   | 0.10   | 5         | Actionable value for the user          |

## Evaluation Metrics and Scoring

### Statistical Utilities

```typescript
import {
  calculateMean,
  calculateStdDev,
  calculateMedian,
  calculatePercentile,
  calculateConfidenceInterval,
} from '@wundr.io/agent-eval';

const scores = [7.5, 8.2, 6.8, 9.1, 7.9];

const mean = calculateMean(scores); // 7.9
const stdDev = calculateStdDev(scores); // ~0.84
const median = calculateMedian(scores); // 7.9
const p95 = calculatePercentile(scores, 95); // 9.02
const ci = calculateConfidenceInterval(scores, 0.95); // { lower: 7.2, upper: 8.6 }
```

### Score Calculations

```typescript
import {
  calculateWeightedScore,
  determinePassStatus,
  calculateConsistencyScore,
} from '@wundr.io/agent-eval';

// Calculate weighted score from criterion results
const weightedScore = calculateWeightedScore(criterionResults, rubric);

// Determine if test passed based on threshold and criteria
const passed = determinePassStatus(criterionResults, overallScore, rubric);

// Calculate consistency across multiple iterations
const consistency = calculateConsistencyScore([7.5, 7.8, 7.2, 7.6]); // 0-1
```

### Summary Generation

```typescript
import { generateSummary } from '@wundr.io/agent-eval';

const summary = generateSummary(testResults);
// Returns:
// {
//   totalTests: number,
//   passedTests: number,
//   failedTests: number,
//   erroredTests: number,
//   passRate: number,       // 0-1
//   averageScore: number,   // 0-10
//   criterionAverages: Record<string, number>,
//   totalExecutionTimeMs: number,
//   avgExecutionTimeMs: number
// }
```

## Benchmark Suites

### Creating a Benchmark Suite

```typescript
import {
  createEvalSuite,
  createTestCase,
  createGradingRubric,
} from '@wundr.io/agent-eval';

// Create custom rubric for coding tasks
const codingRubric = createGradingRubric(
  'Coding Quality Rubric',
  'Evaluates code generation quality',
  [
    {
      id: 'correctness',
      name: 'Correctness',
      description: 'Does the code produce correct output?',
      weight: 0.4,
      minAcceptableScore: 7,
      goodExamples: ['Handles all edge cases'],
      badExamples: ['Off-by-one errors'],
    },
    {
      id: 'efficiency',
      name: 'Efficiency',
      description: 'Is the solution optimally efficient?',
      weight: 0.3,
      minAcceptableScore: 5,
      goodExamples: ['O(n) time complexity'],
      badExamples: ['Unnecessary nested loops'],
    },
    {
      id: 'readability',
      name: 'Readability',
      description: 'Is the code clean and well-documented?',
      weight: 0.3,
      minAcceptableScore: 5,
      goodExamples: ['Clear variable names', 'Proper comments'],
      badExamples: ['Single-letter variables', 'No documentation'],
    },
  ],
  { passingThreshold: 7 }
);

// Create test cases
const testCases = [
  createTestCase('fizzbuzz', 'Write a FizzBuzz function in TypeScript', {
    description: 'Classic FizzBuzz coding challenge',
    referenceAnswer: `function fizzbuzz(n: number): string {
      if (n % 15 === 0) return 'FizzBuzz';
      if (n % 3 === 0) return 'Fizz';
      if (n % 5 === 0) return 'Buzz';
      return String(n);
    }`,
    tags: ['coding', 'algorithms', 'basic'],
    iterations: 3, // Run 3 times for consistency check
  }),
  createTestCase('reverse-string', 'Implement string reversal without built-ins', {
    description: 'Reverse a string without using reverse()',
    expectedOutput: {
      type: 'contains',
      value: 'function',
    },
    tags: ['coding', 'strings'],
  }),
];

// Create the suite
const codingSuite = createEvalSuite(
  'Code Generation Benchmark',
  'Comprehensive evaluation of code generation capabilities',
  testCases,
  codingRubric
);
```

### Merging Multiple Suites

```typescript
import { mergeSuites } from '@wundr.io/agent-eval';

const mergedSuite = mergeSuites(
  [qaSuite, codingSuite, reasoningSuite],
  'Comprehensive Agent Benchmark',
  'Combined evaluation across multiple capabilities'
);
```

### Suite Validation

```typescript
import { validateSuite } from '@wundr.io/agent-eval';

const result = validateSuite(suiteData);
if (result.valid) {
  console.log('Suite is valid:', result.suite);
} else {
  console.error('Validation errors:', result.errors);
}
```

## Performance Tracking

### Running Evaluations with Progress Tracking

```typescript
import { createEvaluator } from '@wundr.io/agent-eval';

const evaluator = createEvaluator();

// Register event handlers for detailed tracking
evaluator.onEvent((event) => {
  switch (event.type) {
    case 'eval:started':
      console.log(`Starting evaluation: ${event.payload.runId}`);
      break;
    case 'test:started':
      console.log(`Running test: ${event.payload.testCaseId}`);
      break;
    case 'test:completed':
      console.log(`Test passed: ${event.payload.result?.passed}`);
      break;
    case 'test:failed':
      console.log(`Test failed: ${event.payload.testCaseId}`);
      break;
    case 'eval:completed':
      console.log('Evaluation complete!');
      break;
  }
});

// Run with progress callback
const results = await evaluator.runEvalSuite(suite, agent, {
  agentId: 'my-agent-v1',
  agentVersion: '1.0.0',
  onProgress: (progress) => {
    const pct = ((progress.currentTest + 1) / progress.totalTests) * 100;
    console.log(`Progress: ${pct.toFixed(1)}% - ${progress.currentTestName}`);
  },
});
```

### Aggregating Iteration Metrics

```typescript
import { aggregateIterationMetrics } from '@wundr.io/agent-eval';

// Get results for a specific test case across iterations
const testCaseResults = results.testResults.filter(
  (r) => r.testCaseId === 'my-test'
);

const aggregated = aggregateIterationMetrics(testCaseResults);
// Returns:
// {
//   meanScore: number,
//   stdDev: number,
//   minScore: number,
//   maxScore: number,
//   consistency: number,        // 0-1
//   confidenceInterval: { lower: number, upper: number },
//   allPassed: boolean,
//   passRate: number
// }
```

## Comparative Analysis

### Trend Analysis Across Runs

```typescript
import { calculateScoreTrend } from '@wundr.io/agent-eval';

// Analyze trend across multiple evaluation runs (chronologically ordered)
const trend = calculateScoreTrend([run1Results, run2Results, run3Results]);
// Returns:
// {
//   trend: 'improving' | 'declining' | 'stable',
//   slope: number,
//   rSquared: number,
//   recentChange: number
// }

if (trend.trend === 'declining') {
  console.warn(`Performance declining with slope: ${trend.slope.toFixed(3)}`);
}
```

### Comparing Two Evaluation Runs

```typescript
import { compareEvalRuns } from '@wundr.io/agent-eval';

const comparison = compareEvalRuns(baselineResults, currentResults);
// Returns:
// {
//   overallChange: number,
//   criterionChanges: Record<string, { change: number, significant: boolean }>,
//   newFailures: string[],    // Test IDs that newly failed
//   fixedTests: string[],     // Test IDs that now pass
//   consistencyChange: number
// }

// Identify regressions
if (comparison.newFailures.length > 0) {
  console.error('Regressions detected:', comparison.newFailures);
}

// Celebrate improvements
if (comparison.fixedTests.length > 0) {
  console.log('Tests now passing:', comparison.fixedTests);
}
```

### Generating Comparison Reports

```typescript
import { generateComparisonReport } from '@wundr.io/agent-eval';

// Generate markdown comparison
const report = generateComparisonReport(baselineResults, currentResults, 'markdown');
console.log(report);

// Or JSON for programmatic use
const jsonReport = generateComparisonReport(baselineResults, currentResults, 'json');
```

## Feedback Loop and Continuous Improvement

### Setting Up Feedback Collection

```typescript
import { createFeedbackLoop } from '@wundr.io/agent-eval';

const feedbackLoop = createFeedbackLoop();

// Collect human feedback on a test result
const feedback = feedbackLoop.collectFeedback(
  evalResults,
  'test-case-id',
  1, // iteration
  {
    reviewerId: 'reviewer-123',
    agreesWithLLM: false,
    suggestedScore: 6.5,
    comments: 'The response was accurate but missed a key edge case.',
    criterionFeedback: [
      {
        criterionId: 'completeness',
        agreesWithScore: false,
        suggestedScore: 5,
        comment: 'Did not cover edge cases',
      },
    ],
    rubricSuggestions: 'Add criterion for edge case handling',
    tags: ['edge-cases', 'review-needed'],
  }
);
```

### Sampling for Human Review

```typescript
// Sample test results for human review
const samplesToReview = feedbackLoop.sampleForReview(evalResults, {
  strategy: 'low-confidence', // or 'random', 'failures-only', 'edge-cases', 'stratified'
  sampleSize: 10,
  confidenceThreshold: 0.7,
});

// Process samples for review
for (const sample of samplesToReview) {
  console.log(`Review needed: ${sample.testCaseName} (score: ${sample.score})`);
}
```

### Analyzing Feedback and Reliability

```typescript
// Get feedback statistics
const stats = feedbackLoop.getFeedbackStats(evalResults.runId);
console.log(`Agreement rate: ${(stats.agreementRate * 100).toFixed(1)}%`);
console.log(`Most disagreed criteria: ${stats.mostDisagreedCriteria.join(', ')}`);

// Calculate inter-rater reliability (LLM vs Human)
const reliability = feedbackLoop.calculateReliability(evalResults.runId, evalResults);
console.log(`Correlation: ${reliability.correlation.toFixed(3)}`);
console.log(`Cohen's Kappa: ${reliability.kappa.toFixed(3)}`);
console.log(`Agreement (within 1 point): ${(reliability.agreement * 100).toFixed(1)}%`);
```

### Failure Analysis

```typescript
import { analyzeFailures, summarizeFailureAnalysis } from '@wundr.io/agent-eval';

// Analyze failures to identify patterns
const analysis = analyzeFailures(evalResults);

// Get human-readable summary
const summary = summarizeFailureAnalysis(analysis);
console.log(summary);

// Programmatic access to patterns
for (const pattern of analysis.patterns) {
  console.log(`Pattern: ${pattern.name}`);
  console.log(`  Frequency: ${(pattern.frequency * 100).toFixed(1)}%`);
  console.log(`  Affected tests: ${pattern.matchingTestCases.length}`);
  console.log(`  Suggested fix: ${pattern.suggestedRemediation}`);
}

// Access recommendations
for (const rec of analysis.recommendations) {
  console.log(`Recommendation: ${rec}`);
}
```

## Integration with IPRE Governance

The `@wundr.io/agent-eval` package integrates with the IPRE (Immutable Performance and Reward Engine) governance framework to provide reward signals based on agent performance.

### Generating Reward Signals

Evaluation results can be transformed into reward signals for IPRE governance:

```typescript
import { createEvaluator, generateSummary } from '@wundr.io/agent-eval';

// Run evaluation
const evaluator = createEvaluator();
const results = await evaluator.runEvalSuite(suite, agent, {
  agentId: 'agent-001',
  agentVersion: '1.2.0',
});

// Transform results into IPRE reward signal
const rewardSignal = {
  agentId: results.agentId,
  timestamp: results.completedAt,
  metrics: {
    passRate: results.summary.passRate,
    averageScore: results.summary.averageScore,
    totalTests: results.summary.totalTests,
    errorRate: results.summary.erroredTests / results.summary.totalTests,
  },
  criterionScores: results.summary.criterionAverages,
  evaluationRunId: results.runId,
};

// Submit to IPRE governance (integration with @wundr.io/ipre)
// ipreGovernance.submitRewardSignal(rewardSignal);
```

### Performance-Based Reward Calculation

```typescript
import { calculateScoreTrend, compareEvalRuns } from '@wundr.io/agent-eval';

// Calculate performance delta for reward adjustment
const comparison = compareEvalRuns(previousResults, currentResults);

// Generate reward multiplier based on improvement
const calculateRewardMultiplier = (comparison: ReturnType<typeof compareEvalRuns>) => {
  const baseMultiplier = 1.0;

  // Bonus for improvement
  if (comparison.overallChange > 0.5) {
    return baseMultiplier + 0.1 * comparison.overallChange;
  }

  // Penalty for regression
  if (comparison.newFailures.length > 0) {
    return baseMultiplier - 0.05 * comparison.newFailures.length;
  }

  return baseMultiplier;
};

const rewardMultiplier = calculateRewardMultiplier(comparison);
```

### Continuous Monitoring Integration

```typescript
// Track performance trends for governance decisions
const trendAnalysis = calculateScoreTrend(historicalRuns);

// Flag agents with declining performance
if (trendAnalysis.trend === 'declining' && trendAnalysis.slope < -0.5) {
  // Trigger governance review
  console.warn('Agent performance declining - governance review required');
}
```

## API Reference

### Evaluator

```typescript
// Create evaluator without LLM grading
const evaluator = createEvaluator();

// Create evaluator with LLM grading
const evaluatorWithLLM = createEvaluatorWithLLM({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
});

// Run evaluation suite
const results = await evaluator.runEvalSuite(suite, agent, {
  filterTags: ['priority-high'],
  filterIds: ['specific-test-id'],
  agentId: 'agent-001',
  agentVersion: '1.0.0',
  metadata: { environment: 'production' },
  configOverrides: { parallel: true, maxConcurrency: 10 },
  onProgress: (progress) => console.log(progress),
});

// Register custom validator
evaluator.registerValidator('custom-check', async (output, testCase) => {
  const passed = myCustomValidation(output);
  return { passed, score: passed ? 10 : 0, explanation: 'Custom validation' };
});

// Register event handler
const unsubscribe = evaluator.onEvent((event) => {
  console.log(event.type, event.payload);
});
```

### Reporter

```typescript
import { createReporter, generateReport } from '@wundr.io/agent-eval';

// Using reporter instance
const reporter = createReporter();
const output = reporter.generate(results, {
  format: 'markdown', // 'console' | 'json' | 'markdown' | 'html' | 'csv'
  includeTestDetails: true,
  includeCriterionDetails: true,
  includeTraces: false,
  includeFailureAnalysis: true,
  title: 'Weekly Agent Evaluation Report',
  timestampFormat: 'iso',
});

// Quick report generation
const consoleReport = generateReport(results, 'console');
const jsonReport = generateReport(results, 'json');
```

### Metrics Functions

| Function | Description |
|----------|-------------|
| `calculateMean(values)` | Calculate arithmetic mean |
| `calculateStdDev(values)` | Calculate standard deviation |
| `calculateMedian(values)` | Calculate median value |
| `calculatePercentile(values, p)` | Calculate p-th percentile |
| `calculateConfidenceInterval(values, confidence, iterations)` | Bootstrap confidence interval |
| `calculateWeightedScore(criterionResults, rubric)` | Calculate weighted overall score |
| `determinePassStatus(criterionResults, score, rubric)` | Determine pass/fail status |
| `calculateConsistencyScore(scores)` | Calculate consistency (0-1) |
| `generateSummary(testResults)` | Generate summary statistics |
| `calculateScoreTrend(evalResults[])` | Analyze score trend over time |
| `compareEvalRuns(baseline, current)` | Compare two evaluation runs |
| `analyzeFailures(evalResults)` | Analyze failure patterns |
| `aggregateIterationMetrics(results)` | Aggregate metrics from iterations |
| `calculateInterRaterReliability(llmScores, humanScores)` | Calculate LLM-human agreement |

## Examples

### Complete Evaluation Workflow

```typescript
import {
  createEvaluator,
  createEvalSuite,
  createTestCase,
  createReporter,
  createFeedbackLoop,
  analyzeFailures,
  summarizeFailureAnalysis,
} from '@wundr.io/agent-eval';

async function runAgentEvaluation() {
  // 1. Setup
  const evaluator = createEvaluator();
  const reporter = createReporter();
  const feedbackLoop = createFeedbackLoop();

  // 2. Define test suite
  const suite = createEvalSuite(
    'Production Agent Eval',
    'Comprehensive production readiness evaluation',
    [
      createTestCase('greeting', 'Hello, how are you?', {
        referenceAnswer: 'Hello! I am doing well, thank you for asking.',
        tags: ['conversation'],
      }),
      createTestCase('calculation', 'What is 15% of 200?', {
        expectedOutput: { type: 'contains', value: '30' },
        tags: ['math'],
      }),
    ]
  );

  // 3. Define agent
  const agent = {
    execute: async (input: string) => ({
      response: await myAgentAPI.generate(input),
    }),
  };

  // 4. Run evaluation
  const results = await evaluator.runEvalSuite(suite, agent, {
    agentId: 'prod-agent',
    agentVersion: '2.1.0',
  });

  // 5. Generate reports
  const markdownReport = reporter.generate(results, { format: 'markdown' });
  await fs.writeFile('eval-report.md', markdownReport.content);

  // 6. Analyze failures if any
  if (results.summary.failedTests > 0) {
    const analysis = analyzeFailures(results);
    console.log(summarizeFailureAnalysis(analysis));
  }

  // 7. Sample for human review
  const reviewSamples = feedbackLoop.sampleForReview(results, {
    strategy: 'low-confidence',
    sampleSize: 5,
  });

  return results;
}
```

### CI/CD Integration

```typescript
import { createEvaluator, createEvalSuite, loadSuiteFromFile } from '@wundr.io/agent-eval';

async function ciEvaluation() {
  const evaluator = createEvaluator();
  const suite = await loadSuiteFromFile('./eval-suite.json');

  const results = await evaluator.runEvalSuite(suite, agent, {
    agentVersion: process.env.GIT_SHA,
  });

  // CI gate: fail if pass rate below threshold
  if (results.summary.passRate < 0.9) {
    console.error(`Pass rate ${results.summary.passRate} below threshold 0.9`);
    process.exit(1);
  }

  // CI gate: fail if average score below threshold
  if (results.summary.averageScore < 7.5) {
    console.error(`Average score ${results.summary.averageScore} below threshold 7.5`);
    process.exit(1);
  }

  console.log('Evaluation passed all CI gates');
  process.exit(0);
}
```

## License

MIT

## Contributing

Contributions are welcome! Please see the [contributing guide](../../CONTRIBUTING.md) for details.

## Related Packages

- `@wundr.io/ipre` - Immutable Performance and Reward Engine
- `@wundr.io/agent-sdk` - Agent development SDK
- `@wundr.io/governance` - Governance framework
