/**
 * @genesis/core - Error Classes
 *
 * Custom error classes for VP service operations.
 * Provides structured error handling with error codes and metadata.
 *
 * @packageDocumentation
 */

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Base error class for all Genesis Core errors.
 * Provides consistent error structure with codes and metadata.
 */
export class GenesisError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;

  /** HTTP status code suggestion */
  public readonly statusCode: number;

  /** Additional error metadata */
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GenesisError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts the error to a JSON-serializable object.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }
}

// =============================================================================
// VP Errors
// =============================================================================

/**
 * Error thrown when a VP is not found.
 */
export class VPNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'slug' | 'email' = 'id') {
    super(
      `VP not found with ${identifierType}: ${identifier}`,
      'VP_NOT_FOUND',
      404,
      { identifier, identifierType },
    );
    this.name = 'VPNotFoundError';
  }
}

/**
 * Error thrown when a VP with the given identifier already exists.
 */
export class VPAlreadyExistsError extends GenesisError {
  constructor(identifier: string, identifierType: 'email' | 'slug' = 'email') {
    super(
      `VP already exists with ${identifierType}: ${identifier}`,
      'VP_ALREADY_EXISTS',
      409,
      { identifier, identifierType },
    );
    this.name = 'VPAlreadyExistsError';
  }
}

/**
 * Error thrown when VP validation fails.
 */
export class VPValidationError extends GenesisError {
  /** Validation errors by field */
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'VP_VALIDATION_ERROR', 400, { errors });
    this.name = 'VPValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when VP operation is not permitted.
 */
export class VPOperationNotPermittedError extends GenesisError {
  constructor(operation: string, reason: string) {
    super(
      `VP operation '${operation}' not permitted: ${reason}`,
      'VP_OPERATION_NOT_PERMITTED',
      403,
      { operation, reason },
    );
    this.name = 'VPOperationNotPermittedError';
  }
}

/**
 * Error thrown when VP is in an invalid state for the requested operation.
 */
export class VPInvalidStateError extends GenesisError {
  constructor(vpId: string, currentState: string, requiredState: string) {
    super(
      `VP ${vpId} is in state '${currentState}', but '${requiredState}' is required`,
      'VP_INVALID_STATE',
      409,
      { vpId, currentState, requiredState },
    );
    this.name = 'VPInvalidStateError';
  }
}

// =============================================================================
// Service Account Errors
// =============================================================================

/**
 * Error thrown when API key operations fail.
 */
export class APIKeyError extends GenesisError {
  constructor(message: string, code: string, metadata?: Record<string, unknown>) {
    super(message, code, 400, metadata);
    this.name = 'APIKeyError';
  }
}

/**
 * Error thrown when API key is invalid.
 */
export class InvalidAPIKeyError extends GenesisError {
  constructor(reason: 'invalid' | 'expired' | 'revoked' | 'malformed' = 'invalid') {
    const messages = {
      invalid: 'The provided API key is invalid',
      expired: 'The API key has expired',
      revoked: 'The API key has been revoked',
      malformed: 'The API key format is invalid',
    } as const;

    super(messages[reason], 'INVALID_API_KEY', 401, { reason });
    this.name = 'InvalidAPIKeyError';
  }
}

/**
 * Error thrown when API key generation fails.
 */
export class APIKeyGenerationError extends GenesisError {
  constructor(vpId: string, reason: string) {
    super(
      `Failed to generate API key for VP ${vpId}: ${reason}`,
      'API_KEY_GENERATION_FAILED',
      500,
      { vpId, reason },
    );
    this.name = 'APIKeyGenerationError';
  }
}

// =============================================================================
// Organization Errors
// =============================================================================

/**
 * Error thrown when an organization is not found.
 */
export class OrganizationNotFoundError extends GenesisError {
  constructor(identifier: string, identifierType: 'id' | 'slug' = 'id') {
    super(
      `Organization not found with ${identifierType}: ${identifier}`,
      'ORGANIZATION_NOT_FOUND',
      404,
      { identifier, identifierType },
    );
    this.name = 'OrganizationNotFoundError';
  }
}

// =============================================================================
// Database Errors
// =============================================================================

/**
 * Error thrown when a database operation fails.
 */
export class DatabaseError extends GenesisError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Database operation '${operation}' failed: ${originalError?.message || 'Unknown error'}`,
      'DATABASE_ERROR',
      500,
      { operation, originalError: originalError?.message },
    );
    this.name = 'DatabaseError';
  }
}

/**
 * Error thrown when a database transaction fails.
 */
export class TransactionError extends GenesisError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Transaction failed during '${operation}': ${originalError?.message || 'Unknown error'}`,
      'TRANSACTION_ERROR',
      500,
      { operation, originalError: originalError?.message },
    );
    this.name = 'TransactionError';
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Type guard to check if an error is a GenesisError.
 */
export function isGenesisError(error: unknown): error is GenesisError {
  return error instanceof GenesisError;
}

/**
 * Type guard to check if an error is a VP-related error.
 */
export function isVPError(error: unknown): error is GenesisError {
  if (!isGenesisError(error)) {
    return false;
  }
  return error.code.startsWith('VP_');
}

/**
 * Type guard to check if an error is an API key error.
 */
export function isAPIKeyError(error: unknown): error is GenesisError {
  if (!isGenesisError(error)) {
    return false;
  }
  return error.code.includes('API_KEY');
}

/**
 * Wraps an error in a GenesisError if it isn't already one.
 */
export function wrapError(error: unknown, context: string): GenesisError {
  if (isGenesisError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new GenesisError(
      `${context}: ${error.message}`,
      'WRAPPED_ERROR',
      500,
      { originalError: error.message, context },
    );
  }

  return new GenesisError(
    `${context}: Unknown error`,
    'UNKNOWN_ERROR',
    500,
    { context },
  );
}
