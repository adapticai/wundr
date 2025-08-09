/**
 * Error handling utilities for the Wundr platform
 */

import { WundrError } from '../types/index.js';

export class BaseWundrError extends Error implements WundrError {
  public override readonly name: string;
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = context;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, BaseWundrError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      stack: this.stack,
      context: this.context,
    };
  }
}

export class ValidationError extends BaseWundrError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConfigurationError extends BaseWundrError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', context);
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class PluginError extends BaseWundrError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PLUGIN_ERROR', context);
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

export class EventBusError extends BaseWundrError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'EVENT_BUS_ERROR', context);
    Object.setPrototypeOf(this, EventBusError.prototype);
  }
}

/**
 * Creates a Result type success value
 */
export function success<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * Creates a Result type error value
 */
export function failure<E = WundrError>(error: E): { success: false; error: E } {
  return { success: false, error };
}

/**
 * Type guard to check if a Result is successful
 */
export function isSuccess<T, E>(result: { success: boolean; data?: T; error?: E }): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if a Result is a failure
 */
export function isFailure<T, E>(result: { success: boolean; data?: T; error?: E }): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Wraps a function to catch errors and return a Result type
 */
export function wrapWithResult<T extends unknown[], R>(
  fn: (...args: T) => R
): (...args: T) => { success: true; data: R } | { success: false; error: WundrError } {
  return (...args: T) => {
    try {
      const result = fn(...args);
      return success(result);
    } catch (error) {
      const wundrError = error instanceof BaseWundrError
        ? error
        : new BaseWundrError(
            error instanceof Error ? error.message : String(error),
            'UNKNOWN_ERROR',
            { originalError: error }
          );
      return failure(wundrError);
    }
  };
}

/**
 * Async version of wrapWithResult
 */
export function wrapWithResultAsync<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<{ success: true; data: R } | { success: false; error: WundrError }> {
  return async (...args: T) => {
    try {
      const result = await fn(...args);
      return success(result);
    } catch (error) {
      const wundrError = error instanceof BaseWundrError
        ? error
        : new BaseWundrError(
            error instanceof Error ? error.message : String(error),
            'UNKNOWN_ERROR',
            { originalError: error }
          );
      return failure(wundrError);
    }
  };
}