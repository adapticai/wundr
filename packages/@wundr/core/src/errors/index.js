"use strict";
/**
 * Error handling utilities for the Wundr platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBusError = exports.PluginError = exports.ConfigurationError = exports.ValidationError = exports.BaseWundrError = void 0;
exports.success = success;
exports.failure = failure;
exports.isSuccess = isSuccess;
exports.isFailure = isFailure;
exports.wrapWithResult = wrapWithResult;
exports.wrapWithResultAsync = wrapWithResultAsync;
class BaseWundrError extends Error {
    constructor(message, code, context) {
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
exports.BaseWundrError = BaseWundrError;
class ValidationError extends BaseWundrError {
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', context);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class ConfigurationError extends BaseWundrError {
    constructor(message, context) {
        super(message, 'CONFIGURATION_ERROR', context);
        Object.setPrototypeOf(this, ConfigurationError.prototype);
    }
}
exports.ConfigurationError = ConfigurationError;
class PluginError extends BaseWundrError {
    constructor(message, context) {
        super(message, 'PLUGIN_ERROR', context);
        Object.setPrototypeOf(this, PluginError.prototype);
    }
}
exports.PluginError = PluginError;
class EventBusError extends BaseWundrError {
    constructor(message, context) {
        super(message, 'EVENT_BUS_ERROR', context);
        Object.setPrototypeOf(this, EventBusError.prototype);
    }
}
exports.EventBusError = EventBusError;
/**
 * Creates a Result type success value
 */
function success(data) {
    return { success: true, data };
}
/**
 * Creates a Result type error value
 */
function failure(error) {
    return { success: false, error };
}
/**
 * Type guard to check if a Result is successful
 */
function isSuccess(result) {
    return result.success === true;
}
/**
 * Type guard to check if a Result is a failure
 */
function isFailure(result) {
    return result.success === false;
}
/**
 * Wraps a function to catch errors and return a Result type
 */
function wrapWithResult(fn) {
    return (...args) => {
        try {
            const result = fn(...args);
            return success(result);
        }
        catch (error) {
            const wundrError = error instanceof BaseWundrError
                ? error
                : new BaseWundrError(error instanceof Error ? error.message : String(error), 'UNKNOWN_ERROR', { originalError: error });
            return failure(wundrError);
        }
    };
}
/**
 * Async version of wrapWithResult
 */
function wrapWithResultAsync(fn) {
    return async (...args) => {
        try {
            const result = await fn(...args);
            return success(result);
        }
        catch (error) {
            const wundrError = error instanceof BaseWundrError
                ? error
                : new BaseWundrError(error instanceof Error ? error.message : String(error), 'UNKNOWN_ERROR', { originalError: error });
            return failure(wundrError);
        }
    };
}
//# sourceMappingURL=index.js.map