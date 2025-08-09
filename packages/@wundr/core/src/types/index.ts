/**
 * Core type definitions for the Wundr platform
 */

export interface WundrError {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly timestamp: Date;
  readonly stack?: string;
  readonly context: Record<string, unknown> | undefined;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string | Error, meta?: Record<string, unknown>): void;
}

export interface EventBusEvent {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly payload: unknown;
  readonly source?: string;
}

export interface EventHandler<T = unknown> {
  (event: EventBusEvent & { payload: T }): void | Promise<void>;
}

export interface EventBus {
  emit<T = unknown>(type: string, payload: T, source?: string): void;
  on<T = unknown>(type: string, handler: EventHandler<T>): () => void;
  off(type: string, handler: EventHandler): void;
  once<T = unknown>(type: string, handler: EventHandler<T>): void;
  removeAllListeners(type?: string): void;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export interface UtilityFunction<T = unknown, R = unknown> {
  (...args: T[]): R;
}

export interface AsyncUtilityFunction<T = unknown, R = unknown> {
  (...args: T[]): Promise<R>;
}

// Generic result type for operations that can fail
export type Result<T, E = WundrError> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Common configuration interface
export interface BaseConfig {
  readonly version: string;
  readonly environment: 'development' | 'production' | 'test';
  readonly debug?: boolean;
}

// Event types for the event bus
export const CORE_EVENTS = {
  ERROR_OCCURRED: 'core:error:occurred',
  CONFIG_CHANGED: 'core:config:changed',
  LOG_MESSAGE: 'core:log:message',
  VALIDATION_FAILED: 'core:validation:failed',
} as const;

export type CoreEventType = typeof CORE_EVENTS[keyof typeof CORE_EVENTS];