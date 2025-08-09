/**
 * Error handling utilities for the Wundr platform
 */
import { WundrError } from '../types/index.js';
export declare class BaseWundrError extends Error implements WundrError {
    readonly name: string;
    readonly code: string;
    readonly timestamp: Date;
    readonly context: Record<string, unknown> | undefined;
    constructor(message: string, code: string, context?: Record<string, unknown>);
    toJSON(): {
        name: string;
        message: string;
        code: string;
        timestamp: Date;
        stack: string | undefined;
        context: Record<string, unknown> | undefined;
    };
}
export declare class ValidationError extends BaseWundrError {
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class ConfigurationError extends BaseWundrError {
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class PluginError extends BaseWundrError {
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class EventBusError extends BaseWundrError {
    constructor(message: string, context?: Record<string, unknown>);
}
/**
 * Creates a Result type success value
 */
export declare function success<T>(data: T): {
    success: true;
    data: T;
};
/**
 * Creates a Result type error value
 */
export declare function failure<E = WundrError>(error: E): {
    success: false;
    error: E;
};
/**
 * Type guard to check if a Result is successful
 */
export declare function isSuccess<T, E>(result: {
    success: boolean;
    data?: T;
    error?: E;
}): result is {
    success: true;
    data: T;
};
/**
 * Type guard to check if a Result is a failure
 */
export declare function isFailure<T, E>(result: {
    success: boolean;
    data?: T;
    error?: E;
}): result is {
    success: false;
    error: E;
};
/**
 * Wraps a function to catch errors and return a Result type
 */
export declare function wrapWithResult<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => {
    success: true;
    data: R;
} | {
    success: false;
    error: WundrError;
};
/**
 * Async version of wrapWithResult
 */
export declare function wrapWithResultAsync<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<{
    success: true;
    data: R;
} | {
    success: false;
    error: WundrError;
}>;
//# sourceMappingURL=index.d.ts.map