/**
 * @wundr.io/structured-output
 *
 * Pydantic/Instructor-style LLM output validation with retry loops and grammar enforcement.
 *
 * This package provides tools for generating validated structured output from LLMs:
 * - Schema-based validation using Zod
 * - Multiple retry strategies with error feedback
 * - Grammar enforcement (JSON Schema, Regex, PEG, CFG)
 * - Streaming support with partial result parsing
 *
 * @example
 * ```typescript
 * import { createInstructor, z } from '@wundr.io/structured-output';
 *
 * const instructor = createInstructor({
 *   model: 'gpt-4',
 *   maxRetries: 3,
 *   retryStrategy: 'adaptive',
 * });
 *
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   email: z.string().email(),
 * });
 *
 * // Set your LLM provider
 * instructor.setLLMProvider(async (prompt, systemPrompt, config) => {
 *   // Call your LLM here
 *   return { content: '{"name": "John", "age": 30, "email": "john@example.com"}', model: config.model };
 * });
 *
 * const result = await instructor.generate({
 *   schema,
 *   prompt: 'Extract user info from: John Doe, 30 years old, john@example.com',
 * });
 *
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */

// =============================================================================
// Main Exports
// =============================================================================

// Core class and factory
export {
  StructuredOutputGenerator,
  createInstructor,
  createMockLLMProvider,
  createMockStreamingProvider,
} from './instructor';

// Retry strategies
export {
  SimpleRetryStrategy,
  ExponentialBackoffRetryStrategy,
  AdaptiveRetryStrategy,
  ErrorTargetedRetryStrategy,
  SchemaGuidedRetryStrategy,
  createRetryStrategy,
  sleep,
  executeWithRetry,
} from './retry-strategies';

// Grammar enforcers
export {
  JsonSchemaGrammarEnforcer,
  RegexGrammarEnforcer,
  PegGrammarEnforcer,
  CfgGrammarEnforcer,
  createGrammarEnforcer,
} from './grammar-enforcer';

// Schema utilities
export {
  getSchemaType,
  unwrapSchema,
  introspectSchema,
  getSchemaDescription,
  toJsonSchema,
  generateSchemaPrompt,
  createObjectSchema,
  makePartial,
  makeRequired,
  pickFields,
  omitFields,
  extendSchema,
  mergeSchemas,
  safeParse,
  parseWithCoercion,
  extractJson,
  parseJsonWithSchema,
  schemasMatch,
  getRequiredFields,
  getOptionalFields,
  // Re-export Zod for convenience
  z,
  ZodSchema,
  ZodObject,
  ZodArray,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodEnum,
} from './schema-utils';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Configuration types
  InstructorConfig,
  PartialInstructorConfig,

  // Validation types
  ValidationResult,
  ValidationError,
  ValidationMetadata,
  TokenUsage,

  // Retry types
  RetryStrategyType,
  RetryConfig,
  RetryContext,
  RetryStrategyResult,
  RetryStrategy,

  // Grammar types
  GrammarEnforcementMethod,
  GrammarEnforcementConfig,
  GrammarEnforcementResult,
  GrammarError,
  GrammarEnforcer,
  GrammarConstraints,

  // Schema types
  SchemaMetadata,
  ZodSchemaType,
  SchemaIntrospectionOptions,
  JsonSchemaOptions,

  // Generation types
  GenerationOptions,
  GenerationContext,
  StreamingOptions,
  PartialResult,

  // Callback types
  RetryCallback,
  ValidationErrorCallback,
  LLMProvider,
  LLMResponse,
  StreamingLLMProvider,
  StreamChunk,

  // Utility types
  InferSchema,
  DeepPartial,
  RequireKeys,
} from './types';

// Error classes
export {
  StructuredOutputError,
  MaxRetriesExceededError,
  TimeoutError,
  zodErrorToValidationErrors,
  DEFAULT_INSTRUCTOR_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types';

// =============================================================================
// Package Info
// =============================================================================

/** Package version */
export const version = '1.0.3';

/** Package name */
export const name = '@wundr.io/structured-output';
