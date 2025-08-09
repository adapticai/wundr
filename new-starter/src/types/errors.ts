/**
 * Error types for proper error handling throughout the application
 */

/**
 * Base error interface with common properties
 */
export interface BaseError {
  message: string;
  code?: string;
  stack?: string;
}

/**
 * System error that extends the base Error class
 */
export interface SystemError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

/**
 * Shell execution error from execa or similar tools
 */
export interface ShellExecutionError extends Error {
  exitCode?: number;
  signal?: NodeJS.Signals;
  signalDescription?: string;
  stdout?: string;
  stderr?: string;
  failed?: boolean;
  timedOut?: boolean;
  isCanceled?: boolean;
  killed?: boolean;
  command?: string;
  escapedCommand?: string;
  cwd?: string;
  shortMessage?: string;
}

/**
 * Type guard to check if an error is a ShellExecutionError
 */
export function isShellExecutionError(error: unknown): error is ShellExecutionError {
  return (
    error instanceof Error &&
    'exitCode' in error &&
    (typeof (error as ShellExecutionError).exitCode === 'number' || 
     (error as ShellExecutionError).exitCode === undefined)
  );
}

/**
 * Type guard to check if an error is a SystemError
 */
export function isSystemError(error: unknown): error is SystemError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as SystemError).code === 'string'
  );
}

/**
 * Type guard to check if an error is a standard Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isShellExecutionError(error)) {
    return error.shortMessage || error.message || 'Shell execution failed';
  }
  
  if (isSystemError(error)) {
    return `${error.message}${error.code ? ` (${error.code})` : ''}`;
  }
  
  if (isError(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return String(error);
}

/**
 * Create a formatted error message with details
 */
export function formatError(error: unknown, context?: string): string {
  const message = getErrorMessage(error);
  
  if (context) {
    return `${context}: ${message}`;
  }
  
  return message;
}