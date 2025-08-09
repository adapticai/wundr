/**
 * @wundr/core - Core utilities and shared functionality for the Wundr platform
 */

// Types (excluding ValidationError to avoid conflict)
export type {
  WundrError,
  Logger,
  EventBusEvent,
  EventHandler,
  EventBus,
  ValidationResult,
  UtilityFunction,
  AsyncUtilityFunction,
  Result,
  BaseConfig,
  CoreEventType
} from './types/index.js';
export { CORE_EVENTS } from './types/index.js';

// Error handling
export * from './errors/index.js';

// Logging
export * from './logger/index.js';

// Event system
export * from './events/index.js';

// Utilities
export * from './utils/index.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/core';

// Default exports for convenience
export { getLogger, log } from './logger/index.js';
export { getEventBus } from './events/index.js';
export { 
  success, 
  failure, 
  isSuccess, 
  isFailure,
  BaseWundrError 
} from './errors/index.js';