/**
 * @wundr.io/typechat-output - TypeChatValidator
 *
 * Main validator class implementing TypeChat-style validation with schema-driven
 * correction prompts and retry mechanisms.
 */

import { CorrectionPromptGenerator } from './correction-prompt';
import { SchemaLoader } from './schema-loader';
import {
  DEFAULT_TYPECHAT_CONFIG,
  zodErrorToTypeChatErrors,
  MaxRetriesExceededError,
  TimeoutError,
} from './types';

import type {
  TypeChatConfig,
  PartialTypeChatConfig,
  TypeChatResult,
  TypeChatSuccessResult,
  TypeChatFailureResult,
  TypeChatError,
  TypeChatMetadata,
  TypeScriptSchema,
  CorrectionContext,
} from './types';
import type { ZodSchema } from 'zod';

// ============================================================================
// TypeChatValidator Class
// ============================================================================

/**
 * TypeChat-style validator for LLM outputs
 *
 * Provides TypeScript-first validation with intelligent correction prompts
 * and configurable retry mechanisms.
 *
 * @example
 * ```typescript
 * import { TypeChatValidator, z } from '@wundr.io/typechat-output';
 *
 * const validator = new TypeChatValidator({
 *   maxRetries: 3,
 *   includeDetailedErrors: true,
 * });
 *
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   email: z.string().email(),
 * });
 *
 * // Simple validation
 * const result = validator.validate(llmResponse, schema);
 *
 * // Validation with retry using LLM
 * const resultWithRetry = await validator.validateWithRetry(
 *   llmResponse,
 *   schema,
 *   async (correctionPrompt) => {
 *     // Call your LLM with the correction prompt
 *     return await llm.complete(correctionPrompt);
 *   }
 * );
 * ```
 */
export class TypeChatValidator {
  private readonly config: TypeChatConfig;
  private readonly correctionGenerator: CorrectionPromptGenerator;
  private readonly schemaLoader: SchemaLoader;

  constructor(config: PartialTypeChatConfig = {}) {
    this.config = { ...DEFAULT_TYPECHAT_CONFIG, ...config };
    this.correctionGenerator = new CorrectionPromptGenerator({
      includeOriginalResponse: true,
      includeSchemaSource: !!this.config.schemaSource,
      maxErrors: 10,
      includeExamples: true,
      template: this.config.correctionPromptTemplate,
    });
    this.schemaLoader = new SchemaLoader();
  }

  /**
   * Validate a response against a Zod schema
   *
   * @template T - The expected output type
   * @param response - Raw response string (JSON)
   * @param schema - Zod schema to validate against
   * @param schemaSource - Optional TypeScript source for correction prompts
   * @returns Validation result with data or errors
   */
  validate<T>(
    response: string,
    schema: ZodSchema<T>,
    schemaSource?: string
  ): TypeChatResult<T> {
    const startTime = Date.now();

    try {
      // Pre-process response
      const processedResponse = this.preprocessResponse(response);

      // Attempt to parse JSON
      const parsed = this.parseJson(processedResponse);

      // Validate against schema
      const validationResult = schema.safeParse(parsed);

      if (validationResult.success) {
        return this.createSuccessResult<T>(
          validationResult.data,
          response,
          startTime
        );
      }

      // Validation failed - create correction prompt
      const errors = zodErrorToTypeChatErrors(validationResult.error);
      const correctionPrompt = this.generateCorrectionPrompt(
        errors,
        response,
        schemaSource ?? this.config.schemaSource
      );

      return this.createFailureResult<T>(
        errors,
        response,
        correctionPrompt,
        startTime
      );
    } catch (error) {
      // Parse error
      const parseError = this.createParseError(error);
      const correctionPrompt = this.generateCorrectionPrompt(
        [parseError],
        response,
        schemaSource ?? this.config.schemaSource
      );

      return this.createFailureResult<T>(
        [parseError],
        response,
        correctionPrompt,
        startTime
      );
    }
  }

  /**
   * Validate a response against a TypeScript schema
   *
   * @template T - The expected output type
   * @param response - Raw response string
   * @param schema - TypeScript schema with Zod validator
   * @returns Validation result
   */
  validateWithSchema<T>(
    response: string,
    schema: TypeScriptSchema
  ): TypeChatResult<T> {
    return this.validate<T>(
      response,
      schema.zodSchema as ZodSchema<T>,
      schema.source
    );
  }

  /**
   * Validate with automatic retry using an LLM
   *
   * @template T - The expected output type
   * @param initialResponse - Initial LLM response to validate
   * @param schema - Zod schema to validate against
   * @param llmCallback - Function to call LLM with correction prompt
   * @param schemaSource - Optional TypeScript source
   * @returns Final validation result after retries
   */
  async validateWithRetry<T>(
    initialResponse: string,
    schema: ZodSchema<T>,
    llmCallback: (correctionPrompt: string) => Promise<string>,
    schemaSource?: string
  ): Promise<TypeChatResult<T>> {
    const startTime = Date.now();
    const rawResponses: string[] = [];
    let currentResponse = initialResponse;
    let lastErrors: TypeChatError[] = [];

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Check timeout
      if (this.config.timeout) {
        const elapsed = Date.now() - startTime;
        if (elapsed > this.config.timeout) {
          throw new TimeoutError(this.config.timeout, elapsed);
        }
      }

      rawResponses.push(currentResponse);

      // Validate current response
      const result = this.validate<T>(currentResponse, schema, schemaSource);

      if (result.success) {
        // Add overall timing
        return {
          ...result,
          retryCount: attempt,
          duration: Date.now() - startTime,
        };
      }

      // Store errors for potential exception
      lastErrors = result.errors ?? [];

      // Check if we've exhausted retries
      if (attempt >= this.config.maxRetries) {
        break;
      }

      // Notify callback
      this.config.onValidationError?.(lastErrors, currentResponse);
      this.config.onRetry?.(
        attempt + 1,
        lastErrors,
        result.correctionPrompt ?? ''
      );

      // Generate correction prompt
      const correctionPrompt = this.generateCorrectionPrompt(
        lastErrors,
        currentResponse,
        schemaSource ?? this.config.schemaSource,
        attempt
      );

      // Call LLM for correction
      try {
        currentResponse = await llmCallback(correctionPrompt);
      } catch (error) {
        // LLM call failed - create error and continue
        lastErrors = [
          {
            path: [],
            message: `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
            code: 'LLM_ERROR',
          },
        ];

        if (attempt >= this.config.maxRetries - 1) {
          break;
        }
      }
    }

    // All retries exhausted
    throw new MaxRetriesExceededError(
      this.config.maxRetries + 1,
      lastErrors,
      rawResponses
    );
  }

  /**
   * Validate with retry using a TypeScript schema
   *
   * @template T - The expected output type
   * @param initialResponse - Initial LLM response
   * @param schema - TypeScript schema
   * @param llmCallback - LLM callback function
   * @returns Final validation result
   */
  async validateWithRetrySchema<T>(
    initialResponse: string,
    schema: TypeScriptSchema,
    llmCallback: (correctionPrompt: string) => Promise<string>
  ): Promise<TypeChatResult<T>> {
    return this.validateWithRetry<T>(
      initialResponse,
      schema.zodSchema as ZodSchema<T>,
      llmCallback,
      schema.source
    );
  }

  /**
   * Generate a correction prompt from validation errors
   *
   * @param errors - Validation errors
   * @param originalResponse - Original response that failed
   * @param schemaSource - TypeScript schema source
   * @param previousAttempts - Number of previous attempts
   * @returns Generated correction prompt
   */
  generateCorrectionPrompt(
    errors: TypeChatError[],
    originalResponse: string,
    schemaSource?: string,
    previousAttempts = 0
  ): string {
    const context: CorrectionContext = {
      errors,
      originalResponse,
      schemaSource,
      previousAttempts,
    };

    return this.correctionGenerator.generate(context);
  }

  /**
   * Get a short correction hint from errors
   *
   * @param errors - Validation errors
   * @returns Short hint string
   */
  getCorrectionHint(errors: TypeChatError[]): string {
    return this.correctionGenerator.generateHint(errors);
  }

  /**
   * Load a TypeScript schema from source
   *
   * @param source - TypeScript source code
   * @param typeName - Name of the type to extract
   * @returns Loaded schema or undefined if failed
   */
  loadSchema(source: string, typeName: string): TypeScriptSchema | undefined {
    const result = this.schemaLoader.loadFromSource(source, typeName);
    return result.success ? result.schema : undefined;
  }

  /**
   * Create a TypeScript schema from a Zod schema
   *
   * @param zodSchema - Zod schema
   * @param name - Schema name
   * @param description - Optional description
   * @returns TypeScript schema
   */
  createSchema(
    zodSchema: ZodSchema,
    name: string,
    description?: string
  ): TypeScriptSchema {
    return this.schemaLoader.createFromZod(zodSchema, name, description);
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<TypeChatConfig> {
    return this.config;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Pre-process response before parsing
   */
  private preprocessResponse(response: string): string {
    let processed = response.trim();

    // Strip markdown code blocks if configured
    if (this.config.stripMarkdownCodeBlocks) {
      processed = this.stripCodeBlocks(processed);
    }

    return processed;
  }

  /**
   * Strip markdown code blocks from response
   */
  private stripCodeBlocks(text: string): string {
    // Remove ```json ... ``` blocks
    let result = text.replace(/```json\s*([\s\S]*?)```/gi, '$1');

    // Remove ``` ... ``` blocks
    result = result.replace(/```\s*([\s\S]*?)```/g, '$1');

    return result.trim();
  }

  /**
   * Parse JSON with optional repair
   */
  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (error) {
      if (this.config.attemptJsonRepair) {
        const repaired = this.attemptJsonRepair(text);
        if (repaired !== null) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Attempt to repair malformed JSON
   */
  private attemptJsonRepair(text: string): unknown | null {
    // Try to extract JSON from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    let jsonText = jsonMatch[0];

    // Try basic repairs
    const repairs = [
      // Fix trailing commas
      () => jsonText.replace(/,\s*([\]}])/g, '$1'),
      // Fix single quotes to double quotes
      () => jsonText.replace(/'/g, '"'),
      // Fix unquoted keys
      () => jsonText.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":'),
      // Fix missing quotes on string values
      () =>
        jsonText.replace(/:\s*([a-zA-Z][a-zA-Z0-9_]*)\s*(,|\})/g, ':"$1"$2'),
    ];

    for (const repair of repairs) {
      try {
        jsonText = repair();
        return JSON.parse(jsonText);
      } catch {
        // Continue to next repair
      }
    }

    return null;
  }

  /**
   * Create a parse error
   */
  private createParseError(error: unknown): TypeChatError {
    const message =
      error instanceof Error ? error.message : 'Failed to parse JSON';

    return {
      path: [],
      message: `JSON Parse Error: ${message}`,
      code: 'PARSE_ERROR',
      expected: 'valid JSON',
    };
  }

  /**
   * Create a successful validation result
   */
  private createSuccessResult<T>(
    data: T,
    rawResponse: string,
    startTime: number
  ): TypeChatSuccessResult<T> {
    return {
      success: true,
      data,
      rawResponse,
      retryCount: 0,
      duration: Date.now() - startTime,
      metadata: this.createMetadata('strict'),
    };
  }

  /**
   * Create a failed validation result
   */
  private createFailureResult<T>(
    errors: TypeChatError[],
    rawResponse: string,
    correctionPrompt: string,
    startTime: number
  ): TypeChatFailureResult<T> {
    return {
      success: false,
      errors,
      rawResponse,
      correctionPrompt,
      retryCount: 0,
      duration: Date.now() - startTime,
      metadata: this.createMetadata('strict'),
    };
  }

  /**
   * Create validation metadata
   */
  private createMetadata(
    parserUsed: TypeChatMetadata['parserUsed']
  ): TypeChatMetadata {
    return {
      timestamp: new Date(),
      parserUsed,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a TypeChatValidator instance with default options
 *
 * @param config - Optional configuration overrides
 * @returns Configured TypeChatValidator instance
 */
export function createTypeChatValidator(
  config?: PartialTypeChatConfig
): TypeChatValidator {
  return new TypeChatValidator(config);
}

/**
 * Validate a response against a Zod schema (one-shot)
 *
 * @template T - Expected output type
 * @param response - LLM response to validate
 * @param schema - Zod schema
 * @returns Validation result
 */
export function validateResponse<T>(
  response: string,
  schema: ZodSchema<T>
): TypeChatResult<T> {
  const validator = new TypeChatValidator();
  return validator.validate(response, schema);
}

/**
 * Validate with automatic retry
 *
 * @template T - Expected output type
 * @param response - Initial response
 * @param schema - Zod schema
 * @param llmCallback - LLM callback for corrections
 * @param maxRetries - Maximum retry attempts
 * @returns Final validation result
 */
export async function validateWithRetry<T>(
  response: string,
  schema: ZodSchema<T>,
  llmCallback: (correctionPrompt: string) => Promise<string>,
  maxRetries = 3
): Promise<TypeChatResult<T>> {
  const validator = new TypeChatValidator({ maxRetries });
  return validator.validateWithRetry(response, schema, llmCallback);
}
