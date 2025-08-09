/**
 * Event bus system for the Wundr platform
 */
import { EventBus, EventBusEvent, EventHandler } from '../types/index.js';
export declare class WundrEventBus implements EventBus {
    private emitter;
    private eventHistory;
    private maxHistorySize;
    constructor(maxHistorySize?: number);
    emit<T = unknown>(type: string, payload: T, source?: string): void;
    on<T = unknown>(type: string, handler: EventHandler<T>): () => void;
    off(type: string, handler: EventHandler): void;
    once<T = unknown>(type: string, handler: EventHandler<T>): void;
    removeAllListeners(type?: string): void;
    /**
     * Get event history
     */
    getHistory(type?: string, limit?: number): EventBusEvent[];
    /**
     * Clear event history
     */
    clearHistory(): void;
    /**
     * Get listener count for a specific event type
     */
    getListenerCount(type: string): number;
    /**
     * Get all event types that have listeners
     */
    getEventTypes(): string[];
    private addToHistory;
}
/**
 * Get the default event bus instance
 */
export declare function getEventBus(): EventBus;
/**
 * Create a new event bus instance
 */
export declare function createEventBus(maxHistorySize?: number): EventBus;
/**
 * Set the default event bus instance
 */
export declare function setDefaultEventBus(eventBus: EventBus): void;
//# sourceMappingURL=index.d.ts.map