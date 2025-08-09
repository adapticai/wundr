/**
 * Event bus system for the Wundr platform
 */

import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { EventBus, EventBusEvent, EventHandler } from '../types/index.js';
import { EventBusError } from '../errors/index.js';
import { getLogger } from '../logger/index.js';

const logger = getLogger();

export class WundrEventBus implements EventBus {
  private emitter: EventEmitter;
  private eventHistory: EventBusEvent[];
  private maxHistorySize: number;

  constructor(maxHistorySize = 1000) {
    this.emitter = new EventEmitter();
    this.eventHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  emit<T = unknown>(type: string, payload: T, source?: string): void {
    try {
      const event: EventBusEvent & { source: string | undefined } = {
        id: uuidv4(),
        type,
        timestamp: new Date(),
        payload,
        source,
      };

      // Add to history
      this.addToHistory(event);

      // Emit the event
      this.emitter.emit(type, event);

      logger.debug(`Event emitted: ${type}`, {
        eventId: event.id,
        source,
        payloadType: typeof payload,
      });
    } catch (error) {
      const eventError = new EventBusError(
        `Failed to emit event: ${type}`,
        { type, source, error }
      );
      logger.error(eventError);
      throw eventError;
    }
  }

  on<T = unknown>(type: string, handler: EventHandler<T>): () => void {
    try {
      const wrappedHandler = async (event: EventBusEvent) => {
        try {
          await handler(event as EventBusEvent & { payload: T });
        } catch (error) {
          const handlerError = new EventBusError(
            `Event handler failed for type: ${type}`,
            { type, eventId: event.id, error }
          );
          logger.error(handlerError);
          // Re-emit as error event
          this.emit('error', handlerError, 'event-bus');
        }
      };

      this.emitter.on(type, wrappedHandler);

      // Return unsubscribe function
      return () => {
        this.emitter.off(type, wrappedHandler);
      };
    } catch (error) {
      const subscribeError = new EventBusError(
        `Failed to subscribe to event: ${type}`,
        { type, error }
      );
      logger.error(subscribeError);
      throw subscribeError;
    }
  }

  off(type: string, handler: EventHandler): void {
    try {
      this.emitter.off(type, handler);
    } catch (error) {
      const unsubscribeError = new EventBusError(
        `Failed to unsubscribe from event: ${type}`,
        { type, error }
      );
      logger.error(unsubscribeError);
      throw unsubscribeError;
    }
  }

  once<T = unknown>(type: string, handler: EventHandler<T>): void {
    try {
      const wrappedHandler = async (event: EventBusEvent) => {
        try {
          await handler(event as EventBusEvent & { payload: T });
        } catch (error) {
          const handlerError = new EventBusError(
            `One-time event handler failed for type: ${type}`,
            { type, eventId: event.id, error }
          );
          logger.error(handlerError);
          this.emit('error', handlerError, 'event-bus');
        }
      };

      this.emitter.once(type, wrappedHandler);
    } catch (error) {
      const onceError = new EventBusError(
        `Failed to set one-time handler for event: ${type}`,
        { type, error }
      );
      logger.error(onceError);
      throw onceError;
    }
  }

  removeAllListeners(type?: string): void {
    try {
      if (type) {
        this.emitter.removeAllListeners(type);
      } else {
        this.emitter.removeAllListeners();
      }
    } catch (error) {
      const removeError = new EventBusError(
        `Failed to remove listeners${type ? ` for type: ${type}` : ''}`,
        { type, error }
      );
      logger.error(removeError);
      throw removeError;
    }
  }

  /**
   * Get event history
   */
  getHistory(type?: string, limit?: number): EventBusEvent[] {
    let history = type
      ? this.eventHistory.filter(event => event.type === type)
      : this.eventHistory;

    if (limit) {
      history = history.slice(-limit);
    }

    return [...history]; // Return copy
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get listener count for a specific event type
   */
  getListenerCount(type: string): number {
    return this.emitter.listenerCount(type);
  }

  /**
   * Get all event types that have listeners
   */
  getEventTypes(): string[] {
    return this.emitter.eventNames() as string[];
  }

  private addToHistory(event: EventBusEvent): void {
    this.eventHistory.push(event);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }
}

// Default event bus instance
let defaultEventBus: EventBus;

/**
 * Get the default event bus instance
 */
export function getEventBus(): EventBus {
  if (!defaultEventBus) {
    defaultEventBus = new WundrEventBus();
  }
  return defaultEventBus;
}

/**
 * Create a new event bus instance
 */
export function createEventBus(maxHistorySize?: number): EventBus {
  return new WundrEventBus(maxHistorySize);
}

/**
 * Set the default event bus instance
 */
export function setDefaultEventBus(eventBus: EventBus): void {
  defaultEventBus = eventBus;
}