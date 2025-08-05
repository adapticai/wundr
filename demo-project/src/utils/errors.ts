/**
 * Base error class following the golden error handling pattern
 */
export class AppError extends Error {
  public readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Domain-specific error classes
 */
export class ValidationError extends AppError {
  constructor(message: string, public readonly fields: string[]) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, resource: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, public readonly rule: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', 422);
  }
}

export class ExternalServiceError extends AppError {
  constructor(serviceName: string, operation: string, cause?: Error) {
    super(
      `${serviceName} service failed during ${operation}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      true
    );
    if (cause) {
      this.stack = cause.stack;
    }
  }
}