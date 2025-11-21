/**
 * @wundr/core - Core utilities and shared functionality for the Wundr platform
 */

// Types (Logger is re-exported from logger/index.js to avoid duplication)
export type {
  WundrError,
  EventBusEvent,
  EventHandler,
  EventBus,
  ValidationResult,
  UtilityFunction,
  AsyncUtilityFunction,
  Result,
  BaseConfig,
  CoreEventType,
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

// RAG (Retrieval-Augmented Generation)
export * from './rag/index.js';

// Package info
export const version = '1.0.0';
export const name = '@wundr/core';
