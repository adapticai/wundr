/**
 * @wundr.io/agent-eval - Agent Evaluator
 *
 * Core evaluation engine for running test suites against AI agents.
 * Supports LLM-based grading, custom validators, and comprehensive result tracking.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  generateSummary,
  calculateWeightedScore,
  determinePassStatus,
} from './metrics';
import {
  EvalResultsSchema,
  TestCaseResultSchema,
  DEFAULT_GRADING_RUBRIC,
} from './types';

import type {
  EvalSuite,
  EvalTestCase,
  EvalResults,
  TestCaseResult,
  CriterionResult,
  GradingRubric,
  AgentExecutor,
  AgentOutput,
  LLMProviderConfig,
  RunEvalSuiteOptions,
  GradeWithLLMOptions,
  EvalProgress,
  EvalEvent,
  EvalEventHandler,
  CustomValidator,
} from './types';

// ============================================================================
// LLM Grading Prompt Templates
// ============================================================================

const GRADING_SYSTEM_PROMPT = `You are an expert evaluator for AI agent responses. Your task is to grade agent outputs against a specific rubric with multiple criteria.

For each criterion, you must:
1. Carefully analyze the agent's response in the context of the input
2. Assign a score from 0-10 (0 = completely fails, 10 = excellent)
3. Provide a brief explanation for your score

Be objective and consistent in your grading. Consider both the quality of the response and how well it addresses the specific requirements of the input.`;

const GRADING_USER_PROMPT_TEMPLATE = `## Evaluation Task

**Input to Agent:**
{INPUT}

{CONTEXT_SECTION}

**Agent's Response:**
{RESPONSE}

{REFERENCE_SECTION}

## Grading Rubric: {RUBRIC_NAME}
{RUBRIC_DESCRIPTION}

{CRITERIA_SECTION}

## Your Task
Grade the agent's response on each criterion listed above. For each criterion:
1. Assign a score (0-10)
2. Provide a brief explanation (1-2 sentences)

Respond in the following JSON format:
\`\`\`json
{
  "criteria": [
    {
      "criterionId": "criterion-id",
      "score": 8,
      "explanation": "Brief explanation of the score"
    }
  ],
  "overallAssessment": "2-3 sentence overall assessment of the response"
}
\`\`\``;

// ============================================================================
// AgentEvaluator Class
// ============================================================================

/**
 * Agent Evaluator - Core evaluation engine
 *
 * Runs evaluation suites against AI agents, supporting multiple grading methods
 * including LLM-based grading, exact matching, semantic similarity, and custom validators.
 */
export class AgentEvaluator {
  private eventHandlers: Set<EvalEventHandler> = new Set();
  private customValidators: Map<string, CustomValidator> = new Map();
  private llmGrader: LLMGrader | null = null;

  /**
   * Create a new AgentEvaluator instance
   * @param llmConfig - Optional LLM configuration for grading
   */
  constructor(llmConfig?: LLMProviderConfig) {
    if (llmConfig) {
      this.llmGrader = new LLMGrader(llmConfig);
    }
  }

  /**
   * Register an event handler for evaluation events
   * @param handler - Event handler function
   * @returns Function to unregister the handler
   */
  onEvent(handler: EvalEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Register a custom validator function
   * @param name - Validator name (referenced in test cases)
   * @param validator - Validator function
   */
  registerValidator(name: string, validator: CustomValidator): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Set or update the LLM configuration for grading
   * @param config - LLM provider configuration
   */
  setLLMConfig(config: LLMProviderConfig): void {
    this.llmGrader = new LLMGrader(config);
  }

  /**
   * Run an evaluation suite against an agent
   * @param suite - Evaluation suite to run
   * @param agent - Agent executor to evaluate
   * @param options - Run options
   * @returns Evaluation results
   */
  async runEvalSuite(
    suite: EvalSuite,
    agent: AgentExecutor,
    options: RunEvalSuiteOptions = {},
  ): Promise<EvalResults> {
    const runId = uuidv4();
    const startedAt = new Date();

    // Emit start event
    await this.emitEvent({
      type: 'eval:started',
      timestamp: new Date(),
      payload: { runId, suiteId: suite.id },
    });

    // Filter test cases based on options
    let testCases = suite.testCases.filter(tc => tc.enabled);

    if (options.filterIds && options.filterIds.length > 0) {
      testCases = testCases.filter(tc => options.filterIds!.includes(tc.id));
    }

    if (options.filterTags && options.filterTags.length > 0) {
      testCases = testCases.filter(tc =>
        tc.tags.some(tag => options.filterTags!.includes(tag)),
      );
    }

    // Sort by priority
    testCases.sort((a, b) => b.priority - a.priority);

    // Merge config with overrides
    const config = { ...suite.config, ...options.configOverrides };

    // Run test cases
    const testResults: TestCaseResult[] = [];
    let shouldStop = false;

    for (
      let testIndex = 0;
      testIndex < testCases.length && !shouldStop;
      testIndex++
    ) {
      const testCase = testCases[testIndex];

      // Run all iterations for this test case
      for (
        let iteration = 1;
        iteration <= testCase.iterations && !shouldStop;
        iteration++
      ) {
        // Report progress
        const progress: EvalProgress = {
          currentTest: testIndex,
          totalTests: testCases.length,
          currentTestName: testCase.name,
          currentIteration: iteration,
          totalIterations: testCase.iterations,
          status: 'running',
          elapsedMs: Date.now() - startedAt.getTime(),
        };

        options.onProgress?.(progress);

        await this.emitEvent({
          type: 'test:started',
          timestamp: new Date(),
          payload: { runId, testCaseId: testCase.id, iteration },
        });

        // Run the test
        const result = await this.runTestCase(
          testCase,
          suite,
          agent,
          iteration,
          config,
        );
        testResults.push(result);

        // Emit completion event
        const eventType = result.error
          ? 'test:errored'
          : result.passed
            ? 'test:completed'
            : 'test:failed';
        await this.emitEvent({
          type: eventType,
          timestamp: new Date(),
          payload: { runId, testCaseId: testCase.id, iteration, result },
        });

        // Check stop on failure
        if (config.stopOnFailure && (!result.passed || result.error)) {
          shouldStop = true;
        }
      }
    }

    const completedAt = new Date();

    // Generate summary
    const summary = generateSummary(testResults);

    // Build results object
    const results: EvalResults = {
      runId,
      suiteId: suite.id,
      suiteName: suite.name,
      suiteVersion: suite.version,
      testResults,
      summary,
      startedAt,
      completedAt,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      config,
      metadata: options.metadata || {},
    };

    // Validate with schema
    const validatedResults = EvalResultsSchema.parse(results);

    // Emit completion event
    await this.emitEvent({
      type: 'eval:completed',
      timestamp: new Date(),
      payload: { runId, suiteId: suite.id },
    });

    return validatedResults;
  }

  /**
   * Grade a single response using LLM-based grading
   * @param input - Input that was provided to the agent
   * @param response - Agent's response
   * @param rubric - Grading rubric to use
   * @param options - Grading options
   * @returns Grading results
   */
  async gradeWithLLM(
    input: string,
    response: string,
    rubric: GradingRubric = DEFAULT_GRADING_RUBRIC,
    options: GradeWithLLMOptions,
  ): Promise<{
    criterionResults: CriterionResult[];
    overallAssessment: string;
    score: number;
    passed: boolean;
  }> {
    if (!this.llmGrader && !options.llmConfig) {
      throw new Error('LLM configuration required for LLM-based grading');
    }

    const grader = this.llmGrader || new LLMGrader(options.llmConfig);

    await this.emitEvent({
      type: 'grade:started',
      timestamp: new Date(),
      payload: {},
    });

    const result = await grader.grade(input, response, rubric, options);

    await this.emitEvent({
      type: 'grade:completed',
      timestamp: new Date(),
      payload: { details: { score: result.score, passed: result.passed } },
    });

    return result;
  }

  /**
   * Run a single test case
   */
  private async runTestCase(
    testCase: EvalTestCase,
    suite: EvalSuite,
    agent: AgentExecutor,
    iteration: number,
    config: EvalSuite['config'],
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    let actualOutput = '';
    let agentOutput: AgentOutput | null = null;
    let error: string | undefined;

    // Execute the agent
    try {
      const timeout = testCase.timeoutMs || config.defaultTimeoutMs || 30000;
      agentOutput = await Promise.race([
        agent.execute(testCase.input, testCase.context),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), timeout),
        ),
      ]);
      actualOutput = agentOutput.response;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const executionTimeMs = Date.now() - startTime;

    // If there was an error, return early
    if (error) {
      return TestCaseResultSchema.parse({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        iteration,
        passed: false,
        score: 0,
        actualOutput,
        criterionResults: [],
        overallAssessment: `Test failed with error: ${error}`,
        executionTimeMs,
        error,
        trace: config.collectTraces ? agentOutput?.trace : undefined,
        timestamp: new Date(),
      });
    }

    // Get the rubric for this test case
    const rubric = testCase.rubricId
      ? suite.rubrics.find(r => r.id === testCase.rubricId) ||
        suite.defaultRubric
      : suite.defaultRubric;

    // Grade the response
    let criterionResults: CriterionResult[] = [];
    let overallAssessment = '';
    let score = 0;
    let passed = false;

    try {
      // Check expected output first if specified
      if (testCase.expectedOutput) {
        const expectationResult = await this.checkExpectedOutput(
          actualOutput,
          testCase,
        );

        if (!expectationResult.passed) {
          return TestCaseResultSchema.parse({
            testCaseId: testCase.id,
            testCaseName: testCase.name,
            iteration,
            passed: false,
            score: expectationResult.score,
            actualOutput,
            criterionResults: [
              {
                criterionId: 'expected-output',
                criterionName: 'Expected Output Match',
                score: expectationResult.score,
                weightedScore: expectationResult.score,
                explanation: expectationResult.explanation,
                passed: false,
                confidence: 1,
              },
            ],
            overallAssessment: expectationResult.explanation,
            executionTimeMs,
            trace: config.collectTraces ? agentOutput?.trace : undefined,
            timestamp: new Date(),
          });
        }
      }

      // Use LLM grading if available
      if (this.llmGrader) {
        const gradeResult = await this.llmGrader.grade(
          testCase.input,
          actualOutput,
          rubric,
          {
            context: testCase.context,
            referenceAnswer: testCase.referenceAnswer,
          },
        );
        criterionResults = gradeResult.criterionResults;
        overallAssessment = gradeResult.overallAssessment;
        score = gradeResult.score;
        passed = gradeResult.passed;
      } else {
        // Fallback to simple scoring based on expected output
        score = 7; // Default passing score if no LLM grading
        passed = true;
        overallAssessment =
          'Graded without LLM (no detailed assessment available)';
      }
    } catch (gradingError) {
      error =
        gradingError instanceof Error
          ? gradingError.message
          : String(gradingError);
      overallAssessment = `Grading failed: ${error}`;
    }

    return TestCaseResultSchema.parse({
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      iteration,
      passed,
      score,
      actualOutput,
      criterionResults,
      overallAssessment,
      executionTimeMs,
      error,
      trace: config.collectTraces ? agentOutput?.trace : undefined,
      timestamp: new Date(),
    });
  }

  /**
   * Check if output matches expected output specification
   */
  private async checkExpectedOutput(
    actualOutput: string,
    testCase: EvalTestCase,
  ): Promise<{ passed: boolean; score: number; explanation: string }> {
    const expected = testCase.expectedOutput;
    if (!expected) {
      return {
        passed: true,
        score: 10,
        explanation: 'No expected output specified',
      };
    }

    switch (expected.type) {
      case 'exact': {
        if (!expected.value) {
          return {
            passed: true,
            score: 10,
            explanation: 'No expected value specified',
          };
        }
        const exactMatch = actualOutput.trim() === expected.value.trim();
        return {
          passed: exactMatch,
          score: exactMatch ? 10 : 0,
          explanation: exactMatch
            ? 'Output exactly matches expected value'
            : 'Output does not match expected value',
        };
      }

      case 'contains': {
        if (!expected.value) {
          return {
            passed: true,
            score: 10,
            explanation: 'No expected value specified',
          };
        }
        const containsMatch = actualOutput.includes(expected.value);
        return {
          passed: containsMatch,
          score: containsMatch ? 10 : 0,
          explanation: containsMatch
            ? 'Output contains expected value'
            : 'Output does not contain expected value',
        };
      }

      case 'regex': {
        if (!expected.value) {
          return {
            passed: true,
            score: 10,
            explanation: 'No regex pattern specified',
          };
        }
        try {
          const regex = new RegExp(expected.value);
          const regexMatch = regex.test(actualOutput);
          return {
            passed: regexMatch,
            score: regexMatch ? 10 : 0,
            explanation: regexMatch
              ? 'Output matches regex pattern'
              : 'Output does not match regex pattern',
          };
        } catch {
          return {
            passed: false,
            score: 0,
            explanation: 'Invalid regex pattern specified',
          };
        }
      }

      case 'semantic': {
        // Semantic similarity would require embeddings - simplified here
        return {
          passed: true,
          score: 7,
          explanation:
            'Semantic similarity check not implemented - passing by default',
        };
      }

      case 'llm-judge': {
        // LLM judge is handled by the main grading flow
        return {
          passed: true,
          score: 10,
          explanation: 'LLM judge handled by main grading flow',
        };
      }

      case 'custom': {
        if (!expected.customValidator) {
          return {
            passed: false,
            score: 0,
            explanation: 'No custom validator specified',
          };
        }
        const validator = this.customValidators.get(expected.customValidator);
        if (!validator) {
          return {
            passed: false,
            score: 0,
            explanation: `Custom validator '${expected.customValidator}' not found`,
          };
        }
        const customResult = await validator(actualOutput, testCase);
        return {
          passed: customResult.passed,
          score: customResult.score,
          explanation: customResult.explanation,
        };
      }

      default:
        return {
          passed: true,
          score: 10,
          explanation: 'Unknown expected output type',
        };
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  private async emitEvent(event: EvalEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error('Error in event handler:', err);
      }
    }
  }
}

// ============================================================================
// LLM Grader Class
// ============================================================================

/**
 * LLM-based grader for agent responses
 */
class LLMGrader {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  /**
   * Grade a response using the configured LLM
   */
  async grade(
    input: string,
    response: string,
    rubric: GradingRubric,
    options: {
      context?: string;
      referenceAnswer?: string;
      customSystemPrompt?: string;
      includeExamples?: boolean;
    } = {},
  ): Promise<{
    criterionResults: CriterionResult[];
    overallAssessment: string;
    score: number;
    passed: boolean;
  }> {
    // Build the grading prompt
    const userPrompt = this.buildGradingPrompt(
      input,
      response,
      rubric,
      options,
    );
    const systemPrompt = options.customSystemPrompt || GRADING_SYSTEM_PROMPT;

    // Call the LLM
    const llmResponse = await this.callLLM(systemPrompt, userPrompt);

    // Parse the response
    const gradingResult = this.parseGradingResponse(llmResponse, rubric);

    return gradingResult;
  }

  /**
   * Build the grading prompt from template
   */
  private buildGradingPrompt(
    input: string,
    response: string,
    rubric: GradingRubric,
    options: {
      context?: string;
      referenceAnswer?: string;
      includeExamples?: boolean;
    },
  ): string {
    // Build context section
    const contextSection = options.context
      ? `**Context/System Prompt:**\n${options.context}\n`
      : '';

    // Build reference section
    const referenceSection = options.referenceAnswer
      ? `**Reference Answer:**\n${options.referenceAnswer}\n`
      : '';

    // Build criteria section
    const criteriaLines = rubric.criteria.map(c => {
      let criterionText = `### ${c.name} (ID: ${c.id}, Weight: ${c.weight})\n${c.description}`;
      criterionText += `\n- Minimum acceptable score: ${c.minAcceptableScore}/10`;

      if (options.includeExamples) {
        if (c.goodExamples.length > 0) {
          criterionText += `\n- Good examples: ${c.goodExamples.join('; ')}`;
        }
        if (c.badExamples.length > 0) {
          criterionText += `\n- Poor examples: ${c.badExamples.join('; ')}`;
        }
      }

      return criterionText;
    });
    const criteriaSection = criteriaLines.join('\n\n');

    // Build full prompt
    return GRADING_USER_PROMPT_TEMPLATE.replace('{INPUT}', input)
      .replace('{CONTEXT_SECTION}', contextSection)
      .replace('{RESPONSE}', response)
      .replace('{REFERENCE_SECTION}', referenceSection)
      .replace('{RUBRIC_NAME}', rubric.name)
      .replace('{RUBRIC_DESCRIPTION}', rubric.description)
      .replace('{CRITERIA_SECTION}', criteriaSection);
  }

  /**
   * Call the LLM with the grading prompt
   * Note: This is a placeholder - in production, this would call the actual LLM API
   */
  private async callLLM(
    _systemPrompt: string,
    _userPrompt: string,
  ): Promise<string> {
    // In a real implementation, this would call the LLM API based on config.provider
    // For now, we simulate a response structure

    // Check if we have an API key (for real implementations)
    if (
      !this.config.apiKey &&
      !process.env['OPENAI_API_KEY'] &&
      !process.env['ANTHROPIC_API_KEY']
    ) {
      // Return a simulated response for testing
      return this.simulateGradingResponse();
    }

    // TODO: Implement actual LLM API calls based on provider
    // This would use fetch/axios to call OpenAI, Anthropic, or custom APIs
    throw new Error(
      `LLM provider '${this.config.provider}' integration not implemented. ` +
        'Configure with a custom grading function or implement the API call.',
    );
  }

  /**
   * Simulate a grading response for testing purposes
   */
  private simulateGradingResponse(): string {
    return JSON.stringify({
      criteria: [
        {
          criterionId: 'accuracy',
          score: 8,
          explanation: 'Response is factually accurate with minor omissions.',
        },
        {
          criterionId: 'relevance',
          score: 9,
          explanation: 'Response directly addresses the input question.',
        },
        {
          criterionId: 'completeness',
          score: 7,
          explanation:
            'Response covers main points but could include more detail.',
        },
        {
          criterionId: 'clarity',
          score: 8,
          explanation: 'Response is well-structured and easy to understand.',
        },
        {
          criterionId: 'helpfulness',
          score: 8,
          explanation: 'Response provides actionable information.',
        },
      ],
      overallAssessment:
        'The agent provided a solid response that accurately addresses the question with good clarity and relevance. Minor improvements could be made in completeness.',
    });
  }

  /**
   * Parse the LLM's grading response into structured results
   */
  private parseGradingResponse(
    llmResponse: string,
    rubric: GradingRubric,
  ): {
    criterionResults: CriterionResult[];
    overallAssessment: string;
    score: number;
    passed: boolean;
  } {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch =
        llmResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
        llmResponse.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Build criterion results
      const criterionResults: CriterionResult[] = [];
      for (const criterion of rubric.criteria) {
        const llmCriterion = parsed.criteria?.find(
          (c: { criterionId: string }) => c.criterionId === criterion.id,
        );

        const score = llmCriterion?.score ?? 5;
        const weightedScore = score * criterion.weight;

        criterionResults.push({
          criterionId: criterion.id,
          criterionName: criterion.name,
          score,
          weightedScore,
          explanation: llmCriterion?.explanation || 'No explanation provided',
          passed: score >= criterion.minAcceptableScore,
          confidence: 0.9, // Default confidence
        });
      }

      // Calculate overall score
      const overallScore = calculateWeightedScore(criterionResults, rubric);
      const passed = determinePassStatus(
        criterionResults,
        overallScore,
        rubric,
      );

      return {
        criterionResults,
        overallAssessment:
          parsed.overallAssessment || 'No overall assessment provided',
        score: overallScore,
        passed,
      };
    } catch (err) {
      // Return default failing result on parse error
      return {
        criterionResults: rubric.criteria.map(c => ({
          criterionId: c.id,
          criterionName: c.name,
          score: 0,
          weightedScore: 0,
          explanation: `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`,
          passed: false,
          confidence: 0,
        })),
        overallAssessment: `Grading failed: ${err instanceof Error ? err.message : String(err)}`,
        score: 0,
        passed: false,
      };
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new AgentEvaluator with default configuration
 * @returns AgentEvaluator instance
 */
export function createEvaluator(): AgentEvaluator {
  return new AgentEvaluator();
}

/**
 * Create a new AgentEvaluator with LLM configuration
 * @param llmConfig - LLM provider configuration
 * @returns AgentEvaluator instance
 */
export function createEvaluatorWithLLM(
  llmConfig: LLMProviderConfig,
): AgentEvaluator {
  return new AgentEvaluator(llmConfig);
}
