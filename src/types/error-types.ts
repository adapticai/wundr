/**
 * Enterprise-grade TypeScript error handling with no 'any' types
 * Replaces all error patterns with proper type safety
 */

// Strict error context typing
export type ErrorContextValue = string | number | boolean | null | readonly ErrorContextValue[] | ErrorContextObject;
export type ErrorContextObject = { readonly [key: string]: ErrorContextValue };
export type ErrorContext = ErrorContextObject;

// Base error with strict typing
export abstract class TypedBaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly category: ErrorCategory;

  constructor(
    message: string,
    public readonly context: ErrorContext = {},
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): ErrorSerialization {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      category: this.category,
      context: this.context,
      stack: this.stack || '',
      cause: this.cause?.message,
      timestamp: new Date().toISOString()
    };
  }
}

export interface ErrorSerialization {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly statusCode: number;
  readonly category: ErrorCategory;
  readonly context: ErrorContext;
  readonly stack: string;
  readonly cause?: string;
  readonly timestamp: string;
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  BUSINESS_RULE = 'business_rule',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  EXTERNAL_SERVICE = 'external_service',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  SYSTEM = 'system',
  NETWORK = 'network',
  DATABASE = 'database'
}

// Domain-specific error types with strict typing
export class TypedValidationError extends TypedBaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly category = ErrorCategory.VALIDATION;

  constructor(
    message: string,
    public readonly field: string,
    public readonly value: ErrorContextValue,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, field, value });
  }
}

export class TypedBusinessRuleError extends TypedBaseError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;
  readonly category = ErrorCategory.BUSINESS_RULE;

  constructor(
    message: string,
    public readonly rule: string,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, rule });
  }
}

export class TypedNotFoundError extends TypedBaseError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;
  readonly category = ErrorCategory.NOT_FOUND;

  constructor(
    resource: string,
    identifier: string,
    context: ErrorContext = {}
  ) {
    super(`${resource} with identifier '${identifier}' not found`, {
      ...context,
      resource,
      identifier
    });
  }
}

export class TypedConflictError extends TypedBaseError {
  readonly code = 'RESOURCE_CONFLICT';
  readonly statusCode = 409;
  readonly category = ErrorCategory.CONFLICT;

  constructor(
    message: string,
    public readonly conflictingResource: string,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, conflictingResource });
  }
}

export class TypedExternalServiceError extends TypedBaseError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly category = ErrorCategory.EXTERNAL_SERVICE;

  constructor(
    message: string,
    public readonly service: string,
    public readonly operation?: string,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, service, operation });
  }
}

export class TypedAuthenticationError extends TypedBaseError {
  readonly code = 'AUTHENTICATION_FAILED';
  readonly statusCode = 401;
  readonly category = ErrorCategory.AUTHENTICATION;

  constructor(
    message: string = 'Authentication failed',
    context: ErrorContext = {}
  ) {
    super(message, context);
  }
}

export class TypedAuthorizationError extends TypedBaseError {
  readonly code = 'AUTHORIZATION_FAILED';
  readonly statusCode = 403;
  readonly category = ErrorCategory.AUTHORIZATION;

  constructor(
    message: string = 'Authorization failed',
    public readonly requiredPermission?: string,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, requiredPermission });
  }
}

export class TypedRateLimitError extends TypedBaseError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  readonly category = ErrorCategory.RATE_LIMIT;

  constructor(
    message: string,
    public readonly limit: number,
    public readonly window: string,
    public readonly retryAfter?: number,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, limit, window, retryAfter });
  }
}

export class TypedTimeoutError extends TypedBaseError {
  readonly code = 'OPERATION_TIMEOUT';
  readonly statusCode = 408;
  readonly category = ErrorCategory.TIMEOUT;

  constructor(
    operation: string,
    public readonly timeoutMs: number,
    context: ErrorContext = {}
  ) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, {
      ...context,
      operation,
      timeoutMs
    });
  }
}

export class TypedSystemError extends TypedBaseError {
  readonly code = 'SYSTEM_ERROR';
  readonly statusCode = 500;
  readonly category = ErrorCategory.SYSTEM;

  constructor(
    message: string,
    public readonly component?: string,
    context: ErrorContext = {}
  ) {
    super(message, { ...context, component });
  }
}

// Result type for operations that can fail
export type Result<T, E extends TypedBaseError = TypedBaseError> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// Helper functions for Result type
export const success = <T>(data: T): Result<T, never> => ({ success: true, data });
export const failure = <E extends TypedBaseError>(error: E): Result<never, E> => ({ success: false, error });

// Type guards for error checking
export const isTypedError = (value: unknown): value is TypedBaseError => {
  return value instanceof TypedBaseError;
};

export const isValidationError = (error: TypedBaseError): error is TypedValidationError => {
  return error instanceof TypedValidationError;
};

export const isNotFoundError = (error: TypedBaseError): error is TypedNotFoundError => {
  return error instanceof TypedNotFoundError;
};

export const isExternalServiceError = (error: TypedBaseError): error is TypedExternalServiceError => {
  return error instanceof TypedExternalServiceError;
};

// Error handling utilities
export interface ErrorHandler<T = ErrorContextValue> {
  handle(error: TypedBaseError): Result<T, TypedBaseError>;
  canHandle(error: TypedBaseError): boolean;
}

export class TypedErrorRegistry {
  private handlers = new Map<ErrorCategory, ErrorHandler[]>();

  register<T>(category: ErrorCategory, handler: ErrorHandler<T>): void {
    const handlers = this.handlers.get(category) || [];
    handlers.push(handler);
    this.handlers.set(category, handlers);
  }

  handle<T>(error: TypedBaseError): Result<T, TypedBaseError> {
    const handlers = this.handlers.get(error.category) || [];

    for (const handler of handlers) {
      if (handler.canHandle(error)) {
        return handler.handle(error) as Result<T, TypedBaseError>;
      }
    }

    return failure(error);
  }

  unregister(category: ErrorCategory, handler: ErrorHandler): void {
    const handlers = this.handlers.get(category) || [];
    const index = handlers.indexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
      this.handlers.set(category, handlers);
    }
  }
}

// Express.js error handler with proper typing
export interface TypedExpressRequest {
  readonly body: ErrorContextValue;
  readonly params: { readonly [key: string]: string };
  readonly query: { readonly [key: string]: string | string[] };
  readonly headers: { readonly [key: string]: string | string[] };
  readonly user?: { readonly id: string; readonly [key: string]: ErrorContextValue };
}

export interface TypedExpressResponse {
  status(code: number): TypedExpressResponse;
  json(body: ErrorContextValue): TypedExpressResponse;
  send(body: string): TypedExpressResponse;
}

export interface TypedExpressNext {
  (error?: Error): void;
}

export interface ErrorHandlerMiddleware {
  (error: Error, req: TypedExpressRequest, res: TypedExpressResponse, next: TypedExpressNext): void;
}

export const createTypedErrorHandler = (): ErrorHandlerMiddleware => {
  return (error: Error, req: TypedExpressRequest, res: TypedExpressResponse, next: TypedExpressNext) => {
    if (isTypedError(error)) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          category: error.category,
          context: error.context
        }
      });
    } else {
      // Handle non-typed errors
      const systemError = new TypedSystemError(
        'An unexpected error occurred',
        'unknown',
        { originalError: error.message }
      );
      res.status(systemError.statusCode).json({
        error: systemError.toJSON()
      });
    }
  };
};

// Async wrapper with proper error handling
export const asyncWrapper = <T extends readonly unknown[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return (...args: T): Promise<Result<R, TypedBaseError>> => {
    return fn(...args)
      .then(data => success(data))
      .catch(error => {
        if (isTypedError(error)) {
          return failure(error);
        }
        return failure(new TypedSystemError(
          error.message || 'Unknown error occurred',
          'async_wrapper',
          { originalError: error.toString() }
        ));
      });
  };
};

// Validation utilities with strict typing
export interface ValidationRule<T> {
  readonly name: string;
  readonly message: string;
  validate(value: T): boolean;
}

export interface ValidationSchema<T> {
  readonly rules: readonly ValidationRule<T>[];
  validate(value: T): Result<T, TypedValidationError>;
}

export const createValidationSchema = <T>(rules: readonly ValidationRule<T>[]): ValidationSchema<T> => ({
  rules,
  validate(value: T): Result<T, TypedValidationError> {
    for (const rule of rules) {
      if (!rule.validate(value)) {
        return failure(new TypedValidationError(
          rule.message,
          rule.name,
          value as ErrorContextValue
        ));
      }
    }
    return success(value);
  }
});

// Logger interface with error context
export interface TypedLogger {
  error(message: string, context?: ErrorContext): void;
  warn(message: string, context?: ErrorContext): void;
  info(message: string, context?: ErrorContext): void;
  debug(message: string, context?: ErrorContext): void;
}

export const createTypedLogger = (): TypedLogger => ({
  error: (message: string, context?: ErrorContext) => {
    console.error(`[ERROR] ${message}`, context ? JSON.stringify(context) : '');
  },
  warn: (message: string, context?: ErrorContext) => {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  },
  info: (message: string, context?: ErrorContext) => {
    console.info(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  },
  debug: (message: string, context?: ErrorContext) => {
    console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '');
  }
});