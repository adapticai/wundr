/**
 * @wundr.io/typechat-output - Type definitions
 *
 * TypeScript interfaces for TypeChat-style validation with schema-driven
 * correction prompts and retry mechanisms.
 */

import type { ZodSchema, ZodError, ZodIssue } from 'zod';

// ============================================================================
// Core Configuration Types
// ============================================================================

/**
 * Configuration for the TypeChatValidator
 */
export interface TypeChatConfig {
  /** Maximum number of retry attempts for validation failures */
  readonly maxRetries: number;
  /** Whether to include detailed error feedback in correction prompts */
  readonly includeDetailedErrors: boolean;
  /** TypeScript schema source code for LLM context */
  readonly schemaSource?: string;
  /** Custom correction prompt template */
  readonly correctionPromptTemplate?: string;
  /** Timeout in milliseconds for validation operations */
  readonly timeout?: number;
  /** Callback invoked on each retry attempt */
  readonly onRetry?: RetryCallback;
  /** Callback invoked on validation errors */
  readonly onValidationError?: ValidationErrorCallback;
  /** Whether to attempt JSON repair before validation */
  readonly attemptJsonRepair: boolean;
  /** Whether to strip markdown code blocks from responses */
  readonly stripMarkdownCodeBlocks: boolean;
}

/**
 * Partial configuration for overriding defaults
 */
export type PartialTypeChatConfig = Partial<TypeChatConfig>;

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Result of a TypeChat validation operation
 */
export interface TypeChatResult<T> {
  /** Whether validation succeeded */
  readonly success: boolean;
  /** The validated and parsed data (only present if success is true) */
  readonly data?: T;
  /** Validation errors (only present if success is false) */
  readonly errors?: TypeChatError[];
  /** Raw response before parsing */
  readonly rawResponse?: string;
  /** Number of retries attempted */
  readonly retryCount: number;
  /** Total time taken in milliseconds */
  readonly duration: number;
  /** Correction prompt generated (if validation failed) */
  readonly correctionPrompt?: string;
  /** Metadata about the validation process */
  readonly metadata: TypeChatMetadata;
}

/**
 * Successful validation result
 */
export interface TypeChatSuccessResult<T> extends TypeChatResult<T> {
  readonly success: true;
  readonly data: T;
  readonly errors?: undefined;
}

/**
 * Failed validation result
 */
export interface TypeChatFailureResult<T> extends TypeChatResult<T> {
  readonly success: false;
  readonly data?: undefined;
  readonly errors: TypeChatError[];
  readonly correctionPrompt: string;
}

/**
 * Individual validation error with path and context
 */
export interface TypeChatError {
  /** Path to the invalid field (e.g., ['user', 'email']) */
  readonly path: (string | number)[];
  /** Human-readable error message */
  readonly message: string;
  /** Error code from Zod or custom */
  readonly code: string;
  /** Expected type or value */
  readonly expected?: string;
  /** Actual value received */
  readonly received?: unknown;
  /** TypeScript type information for correction */
  readonly typeInfo?: TypeInfo;
}

/**
 * TypeScript type information for error context
 */
export interface TypeInfo {
  /** TypeScript type name */
  readonly typeName: string;
  /** TypeScript type definition snippet */
  readonly typeDefinition?: string;
  /** Example valid values */
  readonly examples?: unknown[];
}

/**
 * Metadata about the validation process
 */
export interface TypeChatMetadata {
  /** Schema name (if available) */
  readonly schemaName?: string;
  /** Timestamp of validation */
  readonly timestamp: Date;
  /** TypeScript version used for schema */
  readonly typescriptVersion?: string;
  /** Parser used for JSON extraction */
  readonly parserUsed: 'strict' | 'lenient' | 'repair';
}

// ============================================================================
// Schema Types
// ============================================================================

/**
 * TypeScript schema definition
 */
export interface TypeScriptSchema {
  /** Schema name/identifier */
  readonly name: string;
  /** TypeScript source code defining the types */
  readonly source: string;
  /** Zod schema for runtime validation */
  readonly zodSchema: ZodSchema;
  /** Description for LLM context */
  readonly description?: string;
  /** Example instances */
  readonly examples?: unknown[];
}

/**
 * Options for loading TypeScript schemas
 */
export interface SchemaLoadOptions {
  /** Base directory for resolving imports */
  readonly baseDir?: string;
  /** Whether to resolve type references */
  readonly resolveReferences: boolean;
  /** Whether to include JSDoc comments */
  readonly includeComments: boolean;
  /** Custom type mappings */
  readonly typeMappings?: Record<string, ZodSchema>;
}

/**
 * Result of loading a TypeScript schema
 */
export interface SchemaLoadResult {
  /** Whether loading succeeded */
  readonly success: boolean;
  /** Loaded schema (if successful) */
  readonly schema?: TypeScriptSchema;
  /** Error message (if failed) */
  readonly error?: string;
  /** Diagnostics from TypeScript compilation */
  readonly diagnostics?: SchemaLoadDiagnostic[];
}

/**
 * Diagnostic from schema loading
 */
export interface SchemaLoadDiagnostic {
  /** Severity level */
  readonly severity: 'error' | 'warning' | 'info';
  /** Diagnostic message */
  readonly message: string;
  /** Source location */
  readonly location?: {
    readonly line: number;
    readonly column: number;
  };
}

// ============================================================================
// Correction Prompt Types
// ============================================================================

/**
 * Configuration for correction prompt generation
 */
export interface CorrectionPromptConfig {
  /** Include the original response in the correction prompt */
  readonly includeOriginalResponse: boolean;
  /** Include the TypeScript schema source */
  readonly includeSchemaSource: boolean;
  /** Maximum number of errors to include */
  readonly maxErrors: number;
  /** Include example valid responses */
  readonly includeExamples: boolean;
  /** Custom prompt template */
  readonly template?: string;
}

/**
 * Context for generating correction prompts
 */
export interface CorrectionContext {
  /** Validation errors encountered */
  readonly errors: TypeChatError[];
  /** Original LLM response */
  readonly originalResponse: string;
  /** TypeScript schema source */
  readonly schemaSource?: string;
  /** Schema name */
  readonly schemaName?: string;
  /** Previous correction attempts */
  readonly previousAttempts: number;
  /** Example valid responses */
  readonly examples?: unknown[];
}

// ============================================================================
// Callback Types
// ============================================================================

/**
 * Callback invoked on retry attempts
 */
export type RetryCallback = (
  attemptNumber: number,
  errors: TypeChatError[],
  correctionPrompt: string
) => void;

/**
 * Callback invoked on validation errors
 */
export type ValidationErrorCallback = (
  errors: TypeChatError[],
  rawResponse: string
) => void;

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error code types for TypeChat operations
 */
export type TypeChatErrorCode =
  | 'VALIDATION_FAILED'
  | 'MAX_RETRIES_EXCEEDED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'SCHEMA_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'JSON_REPAIR_FAILED';

/**
 * Base error class for TypeChat operations
 */
export class TypeChatValidationError extends Error {
  constructor(
    message: string,
    public readonly code: TypeChatErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TypeChatValidationError';
  }
}

/**
 * Maximum retries exceeded error
 */
export class MaxRetriesExceededError extends TypeChatValidationError {
  constructor(
    public readonly attempts: number,
    public readonly lastErrors: TypeChatError[],
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
 * Timeout error
 */
export class TimeoutError extends TypeChatValidationError {
  constructor(
    public readonly timeoutMs: number,
    public readonly elapsedMs: number,
  ) {
    super(
      `Operation timed out after ${elapsedMs}ms (timeout: ${timeoutMs}ms)`,
      'TIMEOUT',
      { timeoutMs, elapsedMs },
    );
    this.name = 'TimeoutError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Zod errors to TypeChatErrors
 *
 * @param error - Zod validation error
 * @returns Array of TypeChatError objects
 */
export function zodErrorToTypeChatErrors(error: ZodError): TypeChatError[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? issue.received : undefined,
  }));
}

/**
 * Format error path as a string
 *
 * @param path - Error path array
 * @returns Formatted path string (e.g., "user.profile.email")
 */
export function formatErrorPath(path: (string | number)[]): string {
  if (path.length === 0) {
    return 'root';
  }

  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      return index === 0 ? segment : `.${segment}`;
    })
    .join('');
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default TypeChat configuration
 */
export const DEFAULT_TYPECHAT_CONFIG: TypeChatConfig = {
  maxRetries: 3,
  includeDetailedErrors: true,
  attemptJsonRepair: true,
  stripMarkdownCodeBlocks: true,
  timeout: 30000,
};

/**
 * Default correction prompt configuration
 */
export const DEFAULT_CORRECTION_PROMPT_CONFIG: CorrectionPromptConfig = {
  includeOriginalResponse: true,
  includeSchemaSource: true,
  maxErrors: 10,
  includeExamples: true,
};
