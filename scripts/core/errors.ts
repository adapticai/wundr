/**
 * Core error classes following Wundr's golden error handling pattern
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
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

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

export class FileSystemError extends AppError {
  constructor(operation: string, path: string, cause?: Error) {
    super(`File system ${operation} failed for ${path}`, 'FS_ERROR', 500);
    if (cause && cause.stack) {
      this.stack = cause.stack;
    }
  }
}

export class AnalysisError extends AppError {
  constructor(message: string, public readonly file?: string) {
    super(message, 'ANALYSIS_ERROR', 500);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, public readonly configKey?: string) {
    super(message, 'CONFIG_ERROR', 400);
  }
}

export class CompilationError extends AppError {
  constructor(message: string, public readonly errors?: any[]) {
    super(message, 'COMPILATION_ERROR', 500);
  }
}