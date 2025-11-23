/**
 * @wundr.io/typechat-output
 *
 * TypeScript-first validation using TypeChat patterns with schema-driven
 * correction prompts and intelligent retry mechanisms.
 *
 * This package provides tools for validating LLM outputs against TypeScript types:
 * - Schema-based validation using Zod
 * - Intelligent correction prompt generation
 * - TypeScript schema loading and generation
 * - Configurable retry strategies
 *
 * @example
 * ```typescript
 * import { TypeChatValidator, z } from '@wundr.io/typechat-output';
 *
 * // Create a validator
 * const validator = new TypeChatValidator({
 *   maxRetries: 3,
 *   includeDetailedErrors: true,
 * });
 *
 * // Define your schema
 * const UserSchema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 *   email: z.string().email(),
 * });
 *
 * // Validate LLM response
 * const result = validator.validate(llmResponse, UserSchema);
 *
 * if (result.success) {
 *   console.log('Valid user:', result.data);
 * } else {
 *   console.log('Correction prompt:', result.correctionPrompt);
 * }
 *
 * // Or use with automatic retry
 * const resultWithRetry = await validator.validateWithRetry(
 *   llmResponse,
 *   UserSchema,
 *   async (correctionPrompt) => {
 *     return await myLLM.complete(correctionPrompt);
 *   }
 * );
 * ```
 */

// =============================================================================
// Main Exports
// =============================================================================

// Core validator class and factory
export {
  TypeChatValidator,
  createTypeChatValidator,
  validateResponse,
  validateWithRetry,
} from './validator';

// Correction prompt generator
export {
  CorrectionPromptGenerator,
  createCorrectionPromptGenerator,
  generateCorrectionPrompt,
  generateCorrectionHint,
  formatValidationErrors,
} from './correction-prompt';

// Schema loader utilities
export {
  SchemaLoader,
  createSchemaLoader,
  loadSchema,
  generateTypeScriptFromZod,
  DEFAULT_SCHEMA_LOAD_OPTIONS,
  // Re-export Zod for convenience
  z,
  ZodSchema,
  ZodObject,
  ZodArray,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodEnum,
} from './schema-loader';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Configuration types
  TypeChatConfig,
  PartialTypeChatConfig,

  // Result types
  TypeChatResult,
  TypeChatSuccessResult,
  TypeChatFailureResult,
  TypeChatError,
  TypeInfo,
  TypeChatMetadata,

  // Schema types
  TypeScriptSchema,
  SchemaLoadOptions,
  SchemaLoadResult,
  SchemaLoadDiagnostic,

  // Correction prompt types
  CorrectionPromptConfig,
  CorrectionContext,

  // Callback types
  RetryCallback,
  ValidationErrorCallback,

  // Error types
  TypeChatErrorCode,
} from './types';

// Error classes and utilities
export {
  TypeChatValidationError,
  MaxRetriesExceededError,
  TimeoutError,
  zodErrorToTypeChatErrors,
  formatErrorPath,
  DEFAULT_TYPECHAT_CONFIG,
  DEFAULT_CORRECTION_PROMPT_CONFIG,
} from './types';

// =============================================================================
// Package Info
// =============================================================================

/** Package version */
export const version = '1.0.3';

/** Package name */
export const name = '@wundr.io/typechat-output';
