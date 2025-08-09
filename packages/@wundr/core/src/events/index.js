"use strict";
/**
 * Event bus system for the Wundr platform
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WundrEventBus = void 0;
exports.getEventBus = getEventBus;
exports.createEventBus = createEventBus;
exports.setDefaultEventBus = setDefaultEventBus;
const eventemitter3_1 = __importDefault(require("eventemitter3"));
const uuid_1 = require("uuid");
const index_js_1 = require("../errors/index.js");
const index_js_2 = require("../logger/index.js");
const logger = (0, index_js_2.getLogger)();
class WundrEventBus {
    constructor(maxHistorySize = 1000) {
        this.emitter = new eventemitter3_1.default();
        this.eventHistory = [];
        this.maxHistorySize = maxHistorySize;
    }
    emit(type, payload, source) {
        try {
            const event = {
                id: (0, uuid_1.v4)(),
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
        }
        catch (error) {
            const eventError = new index_js_1.EventBusError(`Failed to emit event: ${type}`, { type, source, error });
            logger.error(eventError);
            throw eventError;
        }
    }
    on(type, handler) {
        try {
            const wrappedHandler = async (event) => {
                try {
                    await handler(event);
                }
                catch (error) {
                    const handlerError = new index_js_1.EventBusError(`Event handler failed for type: ${type}`, { type, eventId: event.id, error });
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
        }
        catch (error) {
            const subscribeError = new index_js_1.EventBusError(`Failed to subscribe to event: ${type}`, { type, error });
            logger.error(subscribeError);
            throw subscribeError;
        }
    }
    off(type, handler) {
        try {
            this.emitter.off(type, handler);
        }
        catch (error) {
            const unsubscribeError = new index_js_1.EventBusError(`Failed to unsubscribe from event: ${type}`, { type, error });
            logger.error(unsubscribeError);
            throw unsubscribeError;
        }
    }
    once(type, handler) {
        try {
            const wrappedHandler = async (event) => {
                try {
                    await handler(event);
                }
                catch (error) {
                    const handlerError = new index_js_1.EventBusError(`One-time event handler failed for type: ${type}`, { type, eventId: event.id, error });
                    logger.error(handlerError);
                    this.emit('error', handlerError, 'event-bus');
                }
            };
            this.emitter.once(type, wrappedHandler);
        }
        catch (error) {
            const onceError = new index_js_1.EventBusError(`Failed to set one-time handler for event: ${type}`, { type, error });
            logger.error(onceError);
            throw onceError;
        }
    }
    removeAllListeners(type) {
        try {
            if (type) {
                this.emitter.removeAllListeners(type);
            }
            else {
                this.emitter.removeAllListeners();
            }
        }
        catch (error) {
            const removeError = new index_js_1.EventBusError(`Failed to remove listeners${type ? ` for type: ${type}` : ''}`, { type, error });
            logger.error(removeError);
            throw removeError;
        }
    }
    /**
     * Get event history
     */
    getHistory(type, limit) {
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
    clearHistory() {
        this.eventHistory = [];
    }
    /**
     * Get listener count for a specific event type
     */
    getListenerCount(type) {
        return this.emitter.listenerCount(type);
    }
    /**
     * Get all event types that have listeners
     */
    getEventTypes() {
        return this.emitter.eventNames();
    }
    addToHistory(event) {
        this.eventHistory.push(event);
        // Trim history if it exceeds max size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
        }
    }
}
exports.WundrEventBus = WundrEventBus;
// Default event bus instance
let defaultEventBus;
/**
 * Get the default event bus instance
 */
function getEventBus() {
    if (!defaultEventBus) {
        defaultEventBus = new WundrEventBus();
    }
    return defaultEventBus;
}
/**
 * Create a new event bus instance
 */
function createEventBus(maxHistorySize) {
    return new WundrEventBus(maxHistorySize);
}
/**
 * Set the default event bus instance
 */
function setDefaultEventBus(eventBus) {
    defaultEventBus = eventBus;
}
//# sourceMappingURL=index.js.map