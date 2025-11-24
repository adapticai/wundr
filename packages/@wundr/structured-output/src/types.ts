/**
 * @wundr.io/structured-output - Type definitions
 *
 * Provides TypeScript interfaces for Instructor-style LLM output validation
 * with retry loops and grammar enforcement.
 */

import type { z, ZodSchema, ZodError, ZodIssue } from 'zod';

// ============================================================================
// Core Configuration Types
// ============================================================================

/**
 * Configuration for the StructuredOutputGenerator
 */
export interface InstructorConfig {
  /** Maximum number of retry attempts for validation failures */
  readonly maxRetries: number;
  /** Retry strategy to use when validation fails */
  readonly retryStrategy: RetryStrategyType;
  /** Whether to include validation errors in retry prompts */
  readonly includeErrorFeedback: boolean;
  /** Temperature for LLM requests (0-2) */
  readonly temperature: number;
  /** Model identifier for the LLM */
  readonly model: string;
  /** Optional timeout in milliseconds */
  readonly timeout?: number;
  /** Whether to enable streaming responses */
  readonly streaming?: boolean;
  /** Custom system prompt prefix */
  readonly systemPromptPrefix?: string;
  /** Grammar enforcement configuration */
  readonly grammarEnforcement?: GrammarEnforcementConfig;
  /** Callback for logging/debugging */
  readonly onRetry?: RetryCallback;
  /** Callback for validation errors */
  readonly onValidationError?: ValidationErrorCallback;
}

/**
 * Partial configuration for overriding defaults
 */
export type PartialInstructorConfig = Partial<InstructorConfig>;

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of a validation operation
 */
export interface ValidationResult<T> {
  /** Whether validation succeeded */
  readonly success: boolean;
  /** The validated and parsed data (only present if success is true) */
  readonly data?: T;
  /** Validation errors (only present if success is false) */
  readonly errors?: ValidationError[];
  /** Raw response from the LLM before parsing */
  readonly rawResponse?: string;
  /** Number of retries attempted */
  readonly retryCount: number;
  /** Total time taken in milliseconds */
  readonly duration: number;
  /** Metadata about the generation process */
  readonly metadata: ValidationMetadata;
}

/**
 * Individual validation error
 */
export interface ValidationError {
  /** Path to the invalid field */
  readonly path: (string | number)[];
  /** Error message */
  readonly message: string;
  /** Error code (from Zod or custom) */
  readonly code: string;
  /** Expected type or value */
  readonly expected?: string;
  /** Received value */
  readonly received?: unknown;
}

/**
 * Metadata about the validation process
 */
export interface ValidationMetadata {
  /** Model used for generation */
  readonly model: string;
  /** Schema name (if available) */
  readonly schemaName?: string;
  /** Tokens used in generation */
  readonly tokensUsed?: TokenUsage;
  /** Timestamp of generation */
  readonly timestamp: Date;
  /** Grammar enforcement method used */
  readonly grammarMethod?: GrammarEnforcementMethod;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Prompt tokens */
  readonly promptTokens: number;
  /** Completion tokens */
  readonly completionTokens: number;
  /** Total tokens */
  readonly totalTokens: number;
}

// ============================================================================
// Retry Strategy Types
// ============================================================================

/**
 * Available retry strategy types
 */
export type RetryStrategyType =
  | 'simple'
  | 'exponential-backoff'
  | 'adaptive'
  | 'error-targeted'
  | 'schema-guided';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxRetries: number;
  /** Initial delay between retries in milliseconds */
  readonly initialDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  readonly maxDelayMs: number;
  /** Backoff multiplier for exponential strategies */
  readonly backoffMultiplier: number;
  /** Whether to add jitter to delays */
  readonly jitter: boolean;
  /** Strategy type */
  readonly strategy: RetryStrategyType;
}

/**
 * Context provided to retry strategies
 */
export interface RetryContext {
  /** Current attempt number (1-based) */
  readonly attemptNumber: number;
  /** Previous validation errors */
  readonly previousErrors: ValidationError[];
  /** Raw LLM response that failed validation */
  readonly rawResponse: string;
  /** Original prompt */
  readonly originalPrompt: string;
  /** Schema being validated against */
  readonly schema: ZodSchema;
  /** Time elapsed since first attempt in milliseconds */
  readonly elapsedTime: number;
}

/**
 * Result from a retry strategy
 */
export interface RetryStrategyResult {
  /** Whether to continue retrying */
  readonly shouldRetry: boolean;
  /** Delay before next retry in milliseconds */
  readonly delayMs: number;
  /** Modified prompt for retry (optional) */
  readonly modifiedPrompt?: string;
  /** Additional instructions to append */
  readonly additionalInstructions?: string;
  /** Reason for decision */
  readonly reason: string;
}

/**
 * Interface for retry strategy implementations
 */
export interface RetryStrategy {
  /** Strategy name */
  readonly name: RetryStrategyType;
  /** Determine next retry action */
  evaluate(context: RetryContext, config: RetryConfig): RetryStrategyResult;
  /** Generate error feedback for retry prompt */
  generateErrorFeedback(errors: ValidationError[]): string;
}

// ============================================================================
// Grammar Enforcement Types
// ============================================================================

/**
 * Methods for grammar enforcement
 */
export type GrammarEnforcementMethod =
  | 'json-schema'
  | 'regex'
  | 'peg-grammar'
  | 'context-free-grammar'
  | 'none';

/**
 * Configuration for grammar enforcement
 */
export interface GrammarEnforcementConfig {
  /** Method to use for grammar enforcement */
  readonly method: GrammarEnforcementMethod;
  /** Whether to strictly enforce the grammar */
  readonly strict: boolean;
  /** Custom grammar definition (for regex, peg, cfg methods) */
  readonly customGrammar?: string;
  /** Whether to allow partial matches */
  readonly allowPartialMatches: boolean;
}

/**
 * Result of grammar enforcement
 */
export interface GrammarEnforcementResult {
  /** Whether the output conforms to the grammar */
  readonly valid: boolean;
  /** Parsed/extracted data */
  readonly data?: unknown;
  /** Errors encountered during enforcement */
  readonly errors?: GrammarError[];
  /** The grammar used */
  readonly grammarUsed: GrammarEnforcementMethod;
}

/**
 * Grammar enforcement error
 */
export interface GrammarError {
  /** Position in the input where error occurred */
  readonly position: number;
  /** Expected token/pattern */
  readonly expected: string;
  /** Actual token/pattern found */
  readonly found: string;
  /** Error message */
  readonly message: string;
}

/**
 * Interface for grammar enforcer implementations
 */
export interface GrammarEnforcer {
  /** Enforce grammar on raw output */
  enforce(input: string, schema: ZodSchema): GrammarEnforcementResult;
  /** Generate grammar constraints for the schema */
  generateConstraints(schema: ZodSchema): GrammarConstraints;
  /** Get the enforcement method */
  getMethod(): GrammarEnforcementMethod;
}

/**
 * Grammar constraints derived from a schema
 */
export interface GrammarConstraints {
  /** JSON Schema representation */
  readonly jsonSchema?: Record<string, unknown>;
  /** Regex pattern for validation */
  readonly regexPattern?: string;
  /** PEG grammar definition */
  readonly pegGrammar?: string;
  /** Context-free grammar definition */
  readonly cfgGrammar?: string;
}

// ============================================================================
// Schema Utility Types
// ============================================================================

/**
 * Options for JSON Schema conversion
 */
export interface JsonSchemaOptions {
  /** Schema name/title */
  name?: string;
  /** Schema description */
  description?: string;
  /** Whether to include examples */
  includeExamples?: boolean;
  /** Target JSON Schema version */
  target?: 'jsonSchema7' | 'jsonSchema2019-09' | 'openApi3';
}

/**
 * Schema metadata extracted from Zod schemas
 */
export interface SchemaMetadata {
  /** Schema name/description */
  readonly name?: string;
  /** Schema type (object, array, string, etc.) */
  readonly type: ZodSchemaType;
  /** Whether the schema is optional */
  readonly optional: boolean;
  /** Whether the schema is nullable */
  readonly nullable: boolean;
  /** Default value if any */
  readonly defaultValue?: unknown;
  /** Description from .describe() */
  readonly description?: string;
  /** Nested field metadata for objects */
  readonly fields?: Record<string, SchemaMetadata>;
  /** Element metadata for arrays */
  readonly element?: SchemaMetadata;
}

/**
 * Zod schema types
 */
export type ZodSchemaType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'enum'
  | 'union'
  | 'literal'
  | 'date'
  | 'null'
  | 'undefined'
  | 'unknown'
  | 'any'
  | 'tuple'
  | 'record'
  | 'map'
  | 'set'
  | 'function'
  | 'promise'
  | 'lazy'
  | 'effects'
  | 'intersection'
  | 'discriminatedUnion'
  | 'nativeEnum';

/**
 * Options for schema introspection
 */
export interface SchemaIntrospectionOptions {
  /** Maximum depth to introspect */
  readonly maxDepth: number;
  /** Whether to include default values */
  readonly includeDefaults: boolean;
  /** Whether to include descriptions */
  readonly includeDescriptions: boolean;
}

// ============================================================================
// Generation Types
// ============================================================================

/**
 * Options for a single generation request
 */
export interface GenerationOptions<T> {
  /** The Zod schema to validate against */
  readonly schema: ZodSchema<T>;
  /** The prompt to send to the LLM */
  readonly prompt: string;
  /** Optional system prompt override */
  readonly systemPrompt?: string;
  /** Override configuration for this request */
  readonly config?: PartialInstructorConfig;
  /** Additional context for the LLM */
  readonly context?: GenerationContext;
}

/**
 * Additional context for generation
 */
export interface GenerationContext {
  /** Example outputs for few-shot learning */
  readonly examples?: Array<{
    readonly input: string;
    readonly output: unknown;
  }>;
  /** Additional instructions */
  readonly instructions?: string;
  /** Variables to interpolate into the prompt */
  readonly variables?: Record<string, unknown>;
}

/**
 * Streaming generation options
 */
export interface StreamingOptions<T> extends GenerationOptions<T> {
  /** Callback for partial results */
  readonly onPartial?: (partial: PartialResult<T>) => void;
  /** Callback for completion */
  readonly onComplete?: (result: ValidationResult<T>) => void;
  /** Callback for errors */
  readonly onError?: (error: Error) => void;
}

/**
 * Partial result during streaming
 */
export interface PartialResult<T> {
  /** Partially parsed data */
  readonly partial: Partial<T>;
  /** Raw text so far */
  readonly rawText: string;
  /** Whether parsing is complete */
  readonly isComplete: boolean;
  /** Confidence in current parse (0-1) */
  readonly confidence: number;
}

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Callback invoked on retry attempts
 */
export type RetryCallback = (
  attemptNumber: number,
  errors: ValidationError[],
  rawResponse: string
) => void;

/**
 * Callback invoked on validation errors
 */
export type ValidationErrorCallback = (
  errors: ValidationError[],
  rawResponse: string
) => void;

/**
 * LLM provider function type
 */
export type LLMProvider = (
  prompt: string,
  systemPrompt: string,
  config: InstructorConfig
) => Promise<LLMResponse>;

/**
 * LLM response structure
 */
export interface LLMResponse {
  /** Raw text response */
  readonly content: string;
  /** Token usage */
  readonly usage?: TokenUsage;
  /** Model used */
  readonly model: string;
  /** Finish reason */
  readonly finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

/**
 * Streaming LLM provider function type
 */
export type StreamingLLMProvider = (
  prompt: string,
  systemPrompt: string,
  config: InstructorConfig
) => AsyncIterable<StreamChunk>;

/**
 * Stream chunk from LLM
 */
export interface StreamChunk {
  /** Delta text */
  readonly delta: string;
  /** Accumulated text so far */
  readonly accumulated: string;
  /** Whether this is the final chunk */
  readonly isFinal: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error class for structured output errors
 */
export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly code: StructuredOutputErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'StructuredOutputError';
  }
}

/**
 * Error codes for structured output operations
 */
export type StructuredOutputErrorCode =
  | 'VALIDATION_FAILED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'TIMEOUT'
  | 'LLM_ERROR'
  | 'GRAMMAR_ENFORCEMENT_FAILED'
  | 'SCHEMA_ERROR'
  | 'PARSE_ERROR'
  | 'CONFIGURATION_ERROR';

/**
 * Validation failed after all retries
 */
export class MaxRetriesExceededError extends StructuredOutputError {
  constructor(
    public readonly attempts: number,
    public readonly lastErrors: ValidationError[],
    public readonly rawResponses: string[],
  ) {
    super(
      `Validation failed after ${attempts} attempts`,
      'MAX_RETRIES_EXCEEDED',
      { attempts, lastErrors, rawResponses },
    );
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * LLM request timeout
 */
export class TimeoutError extends StructuredOutputError {
  constructor(
    public readonly timeoutMs: number,
    public readonly elapsedMs: number,
  ) {
    super(
      `Request timed out after ${elapsedMs}ms (timeout: ${timeoutMs}ms)`,
      'TIMEOUT',
      { timeoutMs, elapsedMs },
    );
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract the inferred type from a Zod schema
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Make specified keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Convert Zod errors to ValidationErrors
 */
export function zodErrorToValidationErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? issue.received : undefined,
  }));
}

/**
 * Default instructor configuration
 */
export const DEFAULT_INSTRUCTOR_CONFIG: InstructorConfig = {
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

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  strategy: 'adaptive',
};
