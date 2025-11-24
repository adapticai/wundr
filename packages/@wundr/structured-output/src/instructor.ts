/**
 * @wundr.io/structured-output - StructuredOutputGenerator
 *
 * Main class for generating validated structured output from LLMs.
 * Implements Pydantic/Instructor-style validation with retry loops.
 */

import { createGrammarEnforcer } from './grammar-enforcer';
import { createRetryStrategy, sleep } from './retry-strategies';
import {
  toJsonSchema,
  generateSchemaPrompt,
  parseJsonWithSchema,
} from './schema-utils';
import {
  StructuredOutputError,
  MaxRetriesExceededError,
  TimeoutError,
} from './types';

import type {
  InstructorConfig,
  PartialInstructorConfig,
  ValidationResult,
  ValidationError,
  ValidationMetadata,
  GenerationOptions,
  StreamingOptions,
  LLMProvider,
  StreamingLLMProvider,
  LLMResponse,
  StreamChunk,
  RetryContext,
  RetryConfig,
  GrammarEnforcer,
  RetryStrategy,
} from './types';
import type { ZodSchema } from 'zod';

// Default configurations
const defaultInstructorConfig: InstructorConfig = {
  maxRetries: 3,
  retryStrategy: 'adaptive',
  includeErrorFeedback: true,
  temperature: 0.7,
  model: 'gpt-4',
  timeout: 30000,
  streaming: false,
  grammarEnforcement: {
    method: 'json-schema',
    strict: true,
    allowPartialMatches: false,
  },
};

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  strategy: 'adaptive',
};

// ============================================================================
// StructuredOutputGenerator
// ============================================================================

/**
 * Main class for generating validated structured output from LLMs.
 *
 * @example
 * ```typescript
 * const generator = new StructuredOutputGenerator({
 *   model: 'gpt-4',
 *   maxRetries: 3,
 *   retryStrategy: 'adaptive',
 * });
 *
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 * });
 *
 * // Set your LLM provider
 * generator.setLLMProvider(async (prompt, systemPrompt, config) => {
 *   // Call your LLM here
 *   return { content: '{"name": "John", "age": 30}', model: config.model };
 * });
 *
 * const result = await generator.generate({
 *   schema,
 *   prompt: 'Extract: John Doe is 30 years old',
 * });
 *
 * if (result.success) {
 *   console.log(result.data); // { name: 'John Doe', age: 30 }
 * }
 * ```
 */
export class StructuredOutputGenerator {
  private readonly config: InstructorConfig;
  private readonly retryStrategy: RetryStrategy;
  private readonly grammarEnforcer: GrammarEnforcer;
  private llmProvider?: LLMProvider;
  private streamingProvider?: StreamingLLMProvider;

  constructor(config: PartialInstructorConfig = {}) {
    this.config = { ...defaultInstructorConfig, ...config };
    this.retryStrategy = createRetryStrategy(this.config.retryStrategy);
    this.grammarEnforcer = createGrammarEnforcer(
      this.config.grammarEnforcement?.method ?? 'json-schema',
      this.config.grammarEnforcement,
    );
  }

  /**
   * Set the LLM provider function
   */
  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Set the streaming LLM provider function
   */
  setStreamingProvider(provider: StreamingLLMProvider): void {
    this.streamingProvider = provider;
  }

  /**
   * Generate validated structured output from an LLM
   *
   * @template T - The expected output type (inferred from schema)
   * @param options - Generation options including schema and prompt
   * @returns Validation result with parsed data or errors
   */
  async generate<T>(
    options: GenerationOptions<T>,
  ): Promise<ValidationResult<T>> {
    const startTime = Date.now();
    const mergedConfig = { ...this.config, ...options.config };

    // Validate we have an LLM provider
    if (!this.llmProvider) {
      throw new StructuredOutputError(
        'No LLM provider configured. Call setLLMProvider() first.',
        'CONFIGURATION_ERROR',
      );
    }

    // Build the system prompt with schema information
    const systemPrompt = this.buildSystemPrompt(
      options.schema,
      mergedConfig,
      options.systemPrompt,
    );

    // Build the user prompt with context
    const userPrompt = this.buildUserPrompt(options.prompt, options.context);

    // Track retry state
    const rawResponses: string[] = [];
    let lastErrors: ValidationError[] = [];
    let attemptNumber = 0;
    let currentPrompt = userPrompt;

    while (attemptNumber <= mergedConfig.maxRetries) {
      attemptNumber++;

      try {
        // Check timeout
        const elapsed = Date.now() - startTime;
        if (mergedConfig.timeout && elapsed > mergedConfig.timeout) {
          throw new TimeoutError(mergedConfig.timeout, elapsed);
        }

        // Call the LLM
        const response = await this.callLLM(
          currentPrompt,
          systemPrompt,
          mergedConfig,
        );
        rawResponses.push(response.content);

        // Try to parse and validate
        const validationResult = this.validateResponse<T>(
          response.content,
          options.schema,
        );

        if (validationResult.success) {
          return {
            success: true,
            data: validationResult.data,
            rawResponse: response.content,
            retryCount: attemptNumber - 1,
            duration: Date.now() - startTime,
            metadata: this.buildMetadata(mergedConfig, response),
          };
        }

        // Validation failed
        lastErrors = validationResult.errors ?? [];

        // Notify callback if configured
        mergedConfig.onValidationError?.(lastErrors, response.content);

        // Check if we should retry
        const retryContext: RetryContext = {
          attemptNumber,
          previousErrors: lastErrors,
          rawResponse: response.content,
          originalPrompt: userPrompt,
          schema: options.schema,
          elapsedTime: Date.now() - startTime,
        };

        const retryResult = this.retryStrategy.evaluate(retryContext, {
          ...defaultRetryConfig,
          maxRetries: mergedConfig.maxRetries,
          strategy: mergedConfig.retryStrategy,
        });

        if (!retryResult.shouldRetry) {
          break;
        }

        // Notify retry callback
        mergedConfig.onRetry?.(attemptNumber, lastErrors, response.content);

        // Wait before retry
        await sleep(retryResult.delayMs);

        // Build retry prompt with error feedback
        currentPrompt = this.buildRetryPrompt(
          userPrompt,
          lastErrors,
          mergedConfig.includeErrorFeedback,
          retryResult.additionalInstructions,
        );
      } catch (error) {
        if (
          error instanceof TimeoutError ||
          error instanceof MaxRetriesExceededError
        ) {
          throw error;
        }

        // LLM call failed
        lastErrors = [
          {
            path: [],
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'LLM_ERROR',
          },
        ];

        if (attemptNumber >= mergedConfig.maxRetries) {
          break;
        }

        // Wait and retry on LLM errors
        await sleep(1000 * attemptNumber);
      }
    }

    // All retries exhausted
    throw new MaxRetriesExceededError(attemptNumber, lastErrors, rawResponses);
  }

  /**
   * Generate with streaming, providing partial results as they arrive
   *
   * @template T - The expected output type (inferred from schema)
   * @param options - Streaming generation options
   * @returns Final validation result
   */
  async streamPartial<T>(
    options: StreamingOptions<T>,
  ): Promise<ValidationResult<T>> {
    const startTime = Date.now();
    const mergedConfig = { ...this.config, ...options.config };

    // Validate we have a streaming provider
    if (!this.streamingProvider) {
      // Fall back to regular generation if no streaming provider
      if (this.llmProvider) {
        return this.generate(options);
      }
      throw new StructuredOutputError(
        'No streaming provider configured. Call setStreamingProvider() first.',
        'CONFIGURATION_ERROR',
      );
    }

    // Build prompts
    const systemPrompt = this.buildSystemPrompt(
      options.schema,
      mergedConfig,
      options.systemPrompt,
    );
    const userPrompt = this.buildUserPrompt(options.prompt, options.context);

    // Track retry state
    const rawResponses: string[] = [];
    let lastErrors: ValidationError[] = [];
    let attemptNumber = 0;
    let currentPrompt = userPrompt;

    while (attemptNumber <= mergedConfig.maxRetries) {
      attemptNumber++;

      try {
        // Check timeout
        const elapsed = Date.now() - startTime;
        if (mergedConfig.timeout && elapsed > mergedConfig.timeout) {
          throw new TimeoutError(mergedConfig.timeout, elapsed);
        }

        // Stream from LLM
        let accumulated = '';
        const stream = this.streamingProvider(
          currentPrompt,
          systemPrompt,
          mergedConfig,
        );

        for await (const chunk of stream) {
          accumulated = chunk.accumulated;

          // Try to parse partial result
          const partialResult = this.tryParsePartial<T>(
            accumulated,
            options.schema,
          );

          if (partialResult) {
            options.onPartial?.({
              partial: partialResult,
              rawText: accumulated,
              isComplete: chunk.isFinal,
              confidence: this.calculateConfidence(
                partialResult,
                options.schema,
              ),
            });
          }

          if (chunk.isFinal) {
            break;
          }
        }

        rawResponses.push(accumulated);

        // Final validation
        const validationResult = this.validateResponse<T>(
          accumulated,
          options.schema,
        );

        if (validationResult.success) {
          const result: ValidationResult<T> = {
            success: true,
            data: validationResult.data,
            rawResponse: accumulated,
            retryCount: attemptNumber - 1,
            duration: Date.now() - startTime,
            metadata: this.buildMetadata(mergedConfig),
          };

          options.onComplete?.(result);
          return result;
        }

        // Validation failed
        lastErrors = validationResult.errors ?? [];
        mergedConfig.onValidationError?.(lastErrors, accumulated);

        // Check retry
        const retryContext: RetryContext = {
          attemptNumber,
          previousErrors: lastErrors,
          rawResponse: accumulated,
          originalPrompt: userPrompt,
          schema: options.schema,
          elapsedTime: Date.now() - startTime,
        };

        const retryResult = this.retryStrategy.evaluate(retryContext, {
          ...defaultRetryConfig,
          maxRetries: mergedConfig.maxRetries,
          strategy: mergedConfig.retryStrategy,
        });

        if (!retryResult.shouldRetry) {
          break;
        }

        mergedConfig.onRetry?.(attemptNumber, lastErrors, accumulated);
        await sleep(retryResult.delayMs);

        currentPrompt = this.buildRetryPrompt(
          userPrompt,
          lastErrors,
          mergedConfig.includeErrorFeedback,
          retryResult.additionalInstructions,
        );
      } catch (error) {
        if (
          error instanceof TimeoutError ||
          error instanceof MaxRetriesExceededError
        ) {
          options.onError?.(error);
          throw error;
        }

        lastErrors = [
          {
            path: [],
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'LLM_ERROR',
          },
        ];

        options.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );

        if (attemptNumber >= mergedConfig.maxRetries) {
          break;
        }

        await sleep(1000 * attemptNumber);
      }
    }

    const error = new MaxRetriesExceededError(
      attemptNumber,
      lastErrors,
      rawResponses,
    );
    options.onError?.(error);
    throw error;
  }

  /**
   * Validate a raw response against a schema without calling an LLM
   *
   * @template T - The expected output type
   * @param response - Raw response string (JSON or text containing JSON)
   * @param schema - Zod schema to validate against
   * @returns Validation result
   */
  validate<T>(response: string, schema: ZodSchema<T>): ValidationResult<T> {
    const startTime = Date.now();
    const result = this.validateResponse<T>(response, schema);

    return {
      ...result,
      rawResponse: response,
      retryCount: 0,
      duration: Date.now() - startTime,
      metadata: {
        model: 'validation-only',
        timestamp: new Date(),
      },
    };
  }

  /**
   * Get the JSON Schema representation of a Zod schema
   */
  getJsonSchema(schema: ZodSchema): Record<string, unknown> {
    return toJsonSchema(schema);
  }

  /**
   * Get a prompt-friendly description of a schema
   */
  getSchemaPrompt(schema: ZodSchema, name?: string): string {
    return generateSchemaPrompt(schema, name);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build the system prompt with schema information
   */
  private buildSystemPrompt(
    schema: ZodSchema,
    config: InstructorConfig,
    customSystemPrompt?: string,
  ): string {
    const parts: string[] = [];

    // Custom prefix
    if (config.systemPromptPrefix) {
      parts.push(config.systemPromptPrefix);
    }

    // Custom system prompt or default
    if (customSystemPrompt) {
      parts.push(customSystemPrompt);
    } else {
      parts.push(
        'You are a helpful assistant that produces structured output.',
      );
    }

    // Schema information
    const jsonSchema = toJsonSchema(schema);
    parts.push(
      '\nYou must respond with valid JSON that matches the following schema:',
    );
    parts.push('```json');
    parts.push(JSON.stringify(jsonSchema, null, 2));
    parts.push('```');

    // Output format instructions
    parts.push('\nIMPORTANT:');
    parts.push('- Respond ONLY with valid JSON, no additional text.');
    parts.push('- Ensure all required fields are present.');
    parts.push(
      '- Use the exact field names and types specified in the schema.',
    );
    parts.push(
      '- Do not include any markdown formatting or code blocks in your response.',
    );

    return parts.join('\n');
  }

  /**
   * Build the user prompt with context
   */
  private buildUserPrompt(
    prompt: string,
    context?: {
      examples?: Array<{ input: string; output: unknown }>;
      instructions?: string;
      variables?: Record<string, unknown>;
    },
  ): string {
    const parts: string[] = [];

    // Add examples for few-shot learning
    if (context?.examples && context.examples.length > 0) {
      parts.push('Here are some examples:');
      for (const example of context.examples) {
        parts.push(`\nInput: ${example.input}`);
        parts.push(`Output: ${JSON.stringify(example.output)}`);
      }
      parts.push('');
    }

    // Add additional instructions
    if (context?.instructions) {
      parts.push(context.instructions);
      parts.push('');
    }

    // Main prompt with variable interpolation
    let finalPrompt = prompt;
    if (context?.variables) {
      for (const [key, value] of Object.entries(context.variables)) {
        finalPrompt = finalPrompt.replace(
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          String(value),
        );
      }
    }

    parts.push(finalPrompt);

    return parts.join('\n');
  }

  /**
   * Build a retry prompt with error feedback
   */
  private buildRetryPrompt(
    originalPrompt: string,
    errors: ValidationError[],
    includeErrorFeedback: boolean,
    additionalInstructions?: string,
  ): string {
    const parts: string[] = [originalPrompt];

    if (includeErrorFeedback && errors.length > 0) {
      parts.push('\n' + this.retryStrategy.generateErrorFeedback(errors));
    }

    if (additionalInstructions) {
      parts.push('\n' + additionalInstructions);
    }

    return parts.join('');
  }

  /**
   * Call the LLM provider
   */
  private async callLLM(
    prompt: string,
    systemPrompt: string,
    config: InstructorConfig,
  ): Promise<LLMResponse> {
    if (!this.llmProvider) {
      throw new StructuredOutputError(
        'No LLM provider configured',
        'CONFIGURATION_ERROR',
      );
    }

    return this.llmProvider(prompt, systemPrompt, config);
  }

  /**
   * Validate a response against the schema
   */
  private validateResponse<T>(
    response: string,
    schema: ZodSchema<T>,
  ):
    | { success: true; data: T }
    | { success: false; errors: ValidationError[] } {
    try {
      // First, apply grammar enforcement
      const grammarResult = this.grammarEnforcer.enforce(response, schema);

      if (!grammarResult.valid && grammarResult.errors) {
        return {
          success: false,
          errors: grammarResult.errors.map(
            (e: { message: string; expected: string; found: string }) => ({
              path: [],
              message: e.message,
              code: 'GRAMMAR_ERROR',
              expected: e.expected,
              received: e.found,
            }),
          ),
        };
      }

      // Parse and validate with Zod
      const data = parseJsonWithSchema(schema, response);

      return { success: true, data };
    } catch (error) {
      if (error && typeof error === 'object' && 'issues' in error) {
        // Zod error
        const zodError = error as {
          issues: Array<{
            path: (string | number)[];
            message: string;
            code: string;
          }>;
        };
        return {
          success: false,
          errors: zodError.issues.map(issue => ({
            path: issue.path,
            message: issue.message,
            code: issue.code,
          })),
        };
      }

      // Parse or other error
      return {
        success: false,
        errors: [
          {
            path: [],
            message:
              error instanceof Error
                ? error.message
                : 'Failed to parse response',
            code: 'PARSE_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Try to parse a partial response
   */
  private tryParsePartial<T>(
    text: string,
    _schema: ZodSchema<T>,
  ): Partial<T> | null {
    try {
      // Try to extract JSON even if incomplete
      const json = this.extractPartialJson(text);
      if (!json) {
        return null;
      }

      // Don't validate strictly - just return what we have
      return json as Partial<T>;
    } catch {
      return null;
    }
  }

  /**
   * Extract partial JSON from text
   */
  private extractPartialJson(text: string): unknown {
    // Find the start of JSON
    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) {
      return null;
    }

    let jsonText = text.substring(jsonStart);

    // Try to balance braces for incomplete JSON
    const openBraces = (jsonText.match(/{/g) ?? []).length;
    const closeBraces = (jsonText.match(/}/g) ?? []).length;

    if (openBraces > closeBraces) {
      // Add missing closing braces
      jsonText += '}'.repeat(openBraces - closeBraces);
    }

    // Try to handle incomplete strings
    const lastQuote = jsonText.lastIndexOf('"');
    if (lastQuote > 0) {
      const beforeQuote = jsonText.substring(0, lastQuote);
      const quotes = (beforeQuote.match(/(?<!\\)"/g) ?? []).length;
      if (quotes % 2 === 1) {
        // Unclosed string - close it
        jsonText = beforeQuote + '"' + jsonText.substring(lastQuote + 1);
      }
    }

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }

  /**
   * Calculate confidence in a partial result
   */
  private calculateConfidence<T>(
    partial: Partial<T>,
    schema: ZodSchema<T>,
  ): number {
    // Simple confidence based on how complete the partial result appears
    const result = schema.safeParse(partial);

    if (result.success) {
      return 1.0;
    }

    // Count how many fields are valid vs total
    const issues = result.error.issues.length;
    const totalFieldEstimate = Math.max(
      issues + Object.keys(partial as object).length,
      1,
    );

    return Math.max(0, 1 - issues / totalFieldEstimate);
  }

  /**
   * Build validation metadata
   */
  private buildMetadata(
    config: InstructorConfig,
    response?: LLMResponse,
  ): ValidationMetadata {
    return {
      model: config.model,
      timestamp: new Date(),
      tokensUsed: response?.usage,
      grammarMethod: config.grammarEnforcement?.method,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a configured StructuredOutputGenerator instance
 */
export function createInstructor(
  config?: PartialInstructorConfig,
): StructuredOutputGenerator {
  return new StructuredOutputGenerator(config);
}

/**
 * Create a mock LLM provider for testing
 */
export function createMockLLMProvider(
  responses: string | string[] | ((prompt: string) => string),
): LLMProvider {
  let responseIndex = 0;
  const responseArray = Array.isArray(responses)
    ? responses
    : typeof responses === 'string'
      ? [responses]
      : [];

  return async (
    prompt: string,
    _systemPrompt: string,
    config: InstructorConfig,
  ) => {
    let content: string;

    if (typeof responses === 'function') {
      content = responses(prompt);
    } else {
      content = responseArray[responseIndex % responseArray.length] ?? '';
      responseIndex++;
    }

    return {
      content,
      model: config.model,
      usage: {
        promptTokens: Math.round(prompt.length / 4),
        completionTokens: Math.round(content.length / 4),
        totalTokens: Math.round((prompt.length + content.length) / 4),
      },
    };
  };
}

/**
 * Create a mock streaming provider for testing
 */
export function createMockStreamingProvider(
  response: string,
  chunkSize = 10,
): StreamingLLMProvider {
  return async function* (
    _prompt: string,
    _systemPrompt: string,
    _config: InstructorConfig,
  ): AsyncIterable<StreamChunk> {
    let accumulated = '';

    for (let i = 0; i < response.length; i += chunkSize) {
      const delta = response.substring(i, i + chunkSize);
      accumulated += delta;

      yield {
        delta,
        accumulated,
        isFinal: i + chunkSize >= response.length,
      };

      // Simulate streaming delay
      await sleep(10);
    }
  };
}

// ============================================================================
// Exports
// ============================================================================

export { createRetryStrategy, createGrammarEnforcer };
