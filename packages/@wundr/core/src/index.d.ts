/**
 * @wundr/core - Core utilities and shared functionality for the Wundr platform
 */
export type { WundrError, Logger, EventBusEvent, EventHandler, EventBus, ValidationResult, UtilityFunction, AsyncUtilityFunction, Result, BaseConfig, CoreEventType } from './types/index.js';
export { CORE_EVENTS } from './types/index.js';
export * from './errors/index.js';
export * from './logger/index.js';
export * from './events/index.js';
export * from './utils/index.js';
export declare const version = "1.0.0";
export declare const name = "@wundr/core";
export { getLogger, log } from './logger/index.js';
export { getEventBus } from './events/index.js';
export { success, failure, isSuccess, isFailure, BaseWundrError } from './errors/index.js';
//# sourceMappingURL=index.d.ts.map