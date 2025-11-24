/**
 * @wundr.io/agent-observability - Observability Pipeline
 *
 * Centralized logging and event processing pipeline for AI agent monitoring.
 * Provides unified event collection, processing, storage, and alerting.
 */

import { v4 as uuidv4 } from 'uuid';

import { AlertManager } from './alert-manager';
import { MetricsCollector } from './metrics-collector';
import { SensitiveDataRedactor } from './redactor';
import { DEFAULT_LOG_STORE_CONFIG } from './types';

import type { AlertManagerConfig } from './alert-manager';
import type { MetricsCollectorConfig } from './metrics-collector';
import type {
  ObservabilityEvent,
  LogStore,
  LogStoreConfig,
  LogQueryOptions,
  LogQueryResult,
  LogDeleteCriteria,
  LogStoreStatistics,
  CreateEventOptions,
  EventMetadata,
  LogLevel,
  EventCategory,
  PipelineEventHandler,
  PipelineEventType,
  RedactionConfig,
} from './types';

/**
 * Configuration for the Observability Pipeline
 */
export interface ObservabilityPipelineConfig {
  /** Log store configuration */
  logStore?: Partial<LogStoreConfig>;
  /** Redaction configuration */
  redaction?: Partial<RedactionConfig>;
  /** Metrics collector configuration */
  metrics?: Partial<MetricsCollectorConfig>;
  /** Alert manager configuration */
  alerts?: Partial<AlertManagerConfig>;
  /** Enable automatic metrics collection from events */
  autoMetrics?: boolean;
  /** Default metadata to attach to all events */
  defaultMetadata?: Partial<EventMetadata>;
  /** Minimum log level to process */
  minLogLevel?: LogLevel;
  /** Enable buffering for high throughput */
  bufferingEnabled?: boolean;
  /** Buffer flush interval in milliseconds */
  bufferFlushIntervalMs?: number;
  /** Maximum buffer size before forced flush */
  maxBufferSize?: number;
}

/**
 * Log level severity ordering
 */
const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * In-memory log store implementation
 */
class InMemoryLogStore implements LogStore {
  private events: Map<string, ObservabilityEvent> = new Map();
  private config: LogStoreConfig;
  private pendingEvents: ObservabilityEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<LogStoreConfig> = {}) {
    this.config = { ...DEFAULT_LOG_STORE_CONFIG, ...config };

    if (this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(
        () => this.flush(),
        this.config.flushIntervalMs,
      );
    }
  }

  async store(event: ObservabilityEvent): Promise<void> {
    this.events.set(event.id, event);

    // Enforce max events limit
    if (this.events.size > this.config.maxEvents) {
      const eventsArray = Array.from(this.events.entries()).sort(
        ([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      const toRemove = eventsArray.slice(
        0,
        this.events.size - this.config.maxEvents,
      );
      for (const [id] of toRemove) {
        this.events.delete(id);
      }
    }

    // TTL cleanup
    if (this.config.ttlMs) {
      const cutoff = new Date(Date.now() - this.config.ttlMs);
      for (const [id, evt] of this.events) {
        if (evt.timestamp < cutoff) {
          this.events.delete(id);
        }
      }
    }
  }

  async query(options: LogQueryOptions): Promise<LogQueryResult> {
    const startTime = Date.now();
    let results = Array.from(this.events.values());

    // Apply filters
    if (options.startTime) {
      results = results.filter(e => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      results = results.filter(e => e.timestamp <= options.endTime!);
    }
    if (options.levels && options.levels.length > 0) {
      results = results.filter(e => options.levels!.includes(e.level));
    }
    if (options.categories && options.categories.length > 0) {
      results = results.filter(e => options.categories!.includes(e.category));
    }
    if (options.agentId) {
      results = results.filter(e => e.metadata.agentId === options.agentId);
    }
    if (options.taskId) {
      results = results.filter(e => e.metadata.taskId === options.taskId);
    }
    if (options.sessionId) {
      results = results.filter(e => e.metadata.sessionId === options.sessionId);
    }
    if (options.traceId) {
      results = results.filter(e => e.metadata.traceId === options.traceId);
    }
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      results = results.filter(
        e =>
          e.message.toLowerCase().includes(queryLower) ||
          JSON.stringify(e.data).toLowerCase().includes(queryLower),
      );
    }
    if (options.labels) {
      results = results.filter(e =>
        Object.entries(options.labels!).every(
          ([k, v]) => e.metadata.labels[k] === v,
        ),
      );
    }

    // Sort
    const sortField = options.sortBy || 'timestamp';
    const sortDir = options.sortDirection || 'desc';
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'level':
          comparison = LOG_LEVEL_ORDER[a.level] - LOG_LEVEL_ORDER[b.level];
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    const totalCount = results.length;

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    results = results.slice(offset, offset + limit);

    return {
      events: results,
      totalCount,
      hasMore: offset + results.length < totalCount,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async get(id: string): Promise<ObservabilityEvent | null> {
    return this.events.get(id) || null;
  }

  async delete(criteria: LogDeleteCriteria): Promise<number> {
    let deletedCount = 0;

    for (const [id, event] of this.events) {
      let shouldDelete = false;

      if (criteria.ids && criteria.ids.includes(id)) {
        shouldDelete = true;
      }
      if (criteria.beforeTime && event.timestamp < criteria.beforeTime) {
        shouldDelete = true;
      }
      if (criteria.categories && criteria.categories.includes(event.category)) {
        shouldDelete = true;
      }
      if (criteria.levels && criteria.levels.includes(event.level)) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        this.events.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async clear(): Promise<void> {
    this.events.clear();
  }

  async getStatistics(): Promise<LogStoreStatistics> {
    const events = Array.from(this.events.values());

    const eventsByLevel: Record<LogLevel, number> = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    const eventsByCategory: Record<EventCategory, number> = {
      agent: 0,
      task: 0,
      memory: 0,
      llm: 0,
      tool: 0,
      system: 0,
      security: 0,
      performance: 0,
      user: 0,
      custom: 0,
    };

    let oldestEvent: Date | null = null;
    let newestEvent: Date | null = null;

    for (const event of events) {
      eventsByLevel[event.level]++;
      eventsByCategory[event.category]++;

      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }
    }

    // Estimate storage size (rough approximation)
    const storageSizeBytes = events.reduce(
      (sum, e) => sum + JSON.stringify(e).length,
      0,
    );

    return {
      totalEvents: events.length,
      eventsByLevel,
      eventsByCategory,
      oldestEvent,
      newestEvent,
      storageSizeBytes,
      pendingFlush: this.pendingEvents.length,
    };
  }

  async flush(): Promise<void> {
    // In-memory store doesn't need flushing
    this.pendingEvents = [];
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

/**
 * Observability Pipeline
 *
 * Centralized event processing pipeline that combines logging, metrics,
 * redaction, and alerting into a unified observability solution for
 * AI agent monitoring.
 *
 * @example
 * ```typescript
 * const pipeline = new ObservabilityPipeline({
 *   minLogLevel: 'info',
 *   autoMetrics: true,
 *   defaultMetadata: { service: 'agent-orchestrator' }
 * });
 *
 * // Log events
 * pipeline.info('agent', 'Agent started processing', { agentId: 'agent-1' });
 *
 * // Add alert
 * pipeline.alertManager.addAlert(CommonAlerts.highErrorRate());
 *
 * // Query logs
 * const result = await pipeline.query({ levels: ['error'], limit: 100 });
 * ```
 */
export class ObservabilityPipeline {
  private config: ObservabilityPipelineConfig;
  private store: LogStore;
  private eventHandlers: Map<PipelineEventType, Set<PipelineEventHandler>> =
    new Map();
  private buffer: ObservabilityEvent[] = [];
  private bufferFlushTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  /** Sensitive data redactor */
  public readonly redactor: SensitiveDataRedactor;
  /** Metrics collector */
  public readonly metrics: MetricsCollector;
  /** Alert manager */
  public readonly alertManager: AlertManager;

  /**
   * Creates a new ObservabilityPipeline instance
   *
   * @param config - Pipeline configuration
   */
  constructor(config: Partial<ObservabilityPipelineConfig> = {}) {
    this.config = {
      autoMetrics: config.autoMetrics ?? true,
      defaultMetadata: config.defaultMetadata ?? {},
      minLogLevel: config.minLogLevel ?? 'trace',
      bufferingEnabled: config.bufferingEnabled ?? false,
      bufferFlushIntervalMs: config.bufferFlushIntervalMs ?? 1000,
      maxBufferSize: config.maxBufferSize ?? 1000,
      ...config,
    };

    // Initialize components
    this.store = new InMemoryLogStore(config.logStore);
    this.redactor = new SensitiveDataRedactor(config.redaction);
    this.metrics = new MetricsCollector(config.metrics);
    this.alertManager = new AlertManager(config.alerts);

    // Define default metrics
    this.initializeDefaultMetrics();
  }

  /**
   * Start the pipeline
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    if (this.config.bufferingEnabled) {
      this.bufferFlushTimer = setInterval(
        () => this.flushBuffer(),
        this.config.bufferFlushIntervalMs,
      );
    }

    this.emit('pipeline:started', {} as ObservabilityEvent);
  }

  /**
   * Stop the pipeline
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.bufferFlushTimer) {
      clearInterval(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }

    await this.flushBuffer();
    await this.store.close();
    this.metrics.close();

    this.emit('pipeline:stopped', {} as ObservabilityEvent);
  }

  /**
   * Log an event at the specified level
   *
   * @param options - Event creation options
   * @returns The created event
   */
  async log(options: CreateEventOptions): Promise<ObservabilityEvent> {
    // Check minimum log level
    if (
      LOG_LEVEL_ORDER[options.level] < LOG_LEVEL_ORDER[this.config.minLogLevel!]
    ) {
      return this.createEvent(options); // Return event but don't process
    }

    const event = this.createEvent(options);
    await this.processEvent(event);
    return event;
  }

  /**
   * Log a trace level event
   */
  async trace(
    category: EventCategory,
    message: string,
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({ level: 'trace', category, message, data, metadata });
  }

  /**
   * Log a debug level event
   */
  async debug(
    category: EventCategory,
    message: string,
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({ level: 'debug', category, message, data, metadata });
  }

  /**
   * Log an info level event
   */
  async info(
    category: EventCategory,
    message: string,
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({ level: 'info', category, message, data, metadata });
  }

  /**
   * Log a warning level event
   */
  async warn(
    category: EventCategory,
    message: string,
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({ level: 'warn', category, message, data, metadata });
  }

  /**
   * Log an error level event
   */
  async error(
    category: EventCategory,
    message: string,
    error?:
      | Error
      | { name: string; message: string; stack?: string; code?: string },
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({
      level: 'error',
      category,
      message,
      error,
      data,
      metadata,
    });
  }

  /**
   * Log a fatal level event
   */
  async fatal(
    category: EventCategory,
    message: string,
    error?:
      | Error
      | { name: string; message: string; stack?: string; code?: string },
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({
      level: 'fatal',
      category,
      message,
      error,
      data,
      metadata,
    });
  }

  /**
   * Log a timed event (with duration)
   */
  async timed(
    category: EventCategory,
    message: string,
    durationMs: number,
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>,
  ): Promise<ObservabilityEvent> {
    return this.log({
      level: 'info',
      category,
      message,
      durationMs,
      data,
      metadata,
    });
  }

  /**
   * Create a timer for measuring duration
   *
   * @returns Timer object with end method
   */
  startTimer(): {
    end: (
      category: EventCategory,
      message: string,
      data?: Record<string, unknown>,
      metadata?: Partial<EventMetadata>
    ) => Promise<ObservabilityEvent>;
  } {
    const startTime = Date.now();

    return {
      end: async (
        category: EventCategory,
        message: string,
        data?: Record<string, unknown>,
        metadata?: Partial<EventMetadata>,
      ) => {
        const durationMs = Date.now() - startTime;
        return this.timed(category, message, durationMs, data, metadata);
      },
    };
  }

  /**
   * Query stored events
   *
   * @param options - Query options
   * @returns Query result
   */
  async query(options: LogQueryOptions): Promise<LogQueryResult> {
    return this.store.query(options);
  }

  /**
   * Get a specific event by ID
   *
   * @param id - Event ID
   * @returns Event or null
   */
  async get(id: string): Promise<ObservabilityEvent | null> {
    return this.store.get(id);
  }

  /**
   * Delete events matching criteria
   *
   * @param criteria - Delete criteria
   * @returns Number of deleted events
   */
  async delete(criteria: LogDeleteCriteria): Promise<number> {
    return this.store.delete(criteria);
  }

  /**
   * Get store statistics
   *
   * @returns Store statistics
   */
  async getStatistics(): Promise<LogStoreStatistics> {
    return this.store.getStatistics();
  }

  /**
   * Clear all stored events
   */
  async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Register an event handler
   *
   * @param eventType - Event type to listen for
   * @param handler - Handler function
   */
  on(eventType: PipelineEventType, handler: PipelineEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Remove an event handler
   *
   * @param eventType - Event type
   * @param handler - Handler to remove
   */
  off(eventType: PipelineEventType, handler: PipelineEventHandler): void {
    this.eventHandlers.get(eventType)?.delete(handler);
  }

  /**
   * Get the underlying log store
   *
   * @returns Log store instance
   */
  getStore(): LogStore {
    return this.store;
  }

  /**
   * Set a custom log store
   *
   * @param store - Custom log store implementation
   */
  setStore(store: LogStore): void {
    this.store = store;
  }

  /**
   * Flush the event buffer
   */
  async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const events = [...this.buffer];
    this.buffer = [];

    for (const event of events) {
      await this.store.store(event);
    }
  }

  /**
   * Create an event object
   */
  private createEvent(options: CreateEventOptions): ObservabilityEvent {
    const metadata: EventMetadata = {
      ...this.config.defaultMetadata,
      ...options.metadata,
      labels: {
        ...(this.config.defaultMetadata?.labels || {}),
        ...(options.metadata?.labels || {}),
      },
      attributes: {
        ...(this.config.defaultMetadata?.attributes || {}),
        ...(options.metadata?.attributes || {}),
      },
    };

    let errorInfo: ObservabilityEvent['error'];
    if (options.error) {
      if (options.error instanceof Error) {
        errorInfo = {
          name: options.error.name,
          message: options.error.message,
          stack: options.error.stack,
        };
      } else {
        errorInfo = options.error;
      }
    }

    return {
      id: uuidv4(),
      timestamp: new Date(),
      level: options.level,
      category: options.category,
      message: options.message,
      metadata,
      data: options.data || {},
      error: errorInfo,
      durationMs: options.durationMs,
      redacted: false,
      redactedFields: [],
    };
  }

  /**
   * Process an event through the pipeline
   */
  private async processEvent(event: ObservabilityEvent): Promise<void> {
    this.emit('event:received', event);

    // Redact sensitive data
    const redactedEvent = this.redactor.redactEvent(event);
    if (redactedEvent.redacted) {
      this.emit('event:redacted', redactedEvent);
    }

    // Update metrics
    if (this.config.autoMetrics) {
      this.updateMetrics(redactedEvent);
    }

    // Evaluate alerts
    const triggeredAlerts = this.alertManager.evaluate(redactedEvent);
    for (const alert of triggeredAlerts) {
      this.emit('alert:triggered', {
        ...redactedEvent,
        data: { ...redactedEvent.data, triggeredAlert: alert },
      });
    }

    // Store event
    if (this.config.bufferingEnabled) {
      this.buffer.push(redactedEvent);

      if (this.buffer.length >= this.config.maxBufferSize!) {
        await this.flushBuffer();
      }
    } else {
      await this.store.store(redactedEvent);
    }

    this.emit('event:stored', redactedEvent);
    this.emit('event:processed', redactedEvent);
  }

  /**
   * Update metrics based on event
   */
  private updateMetrics(event: ObservabilityEvent): void {
    // Count events by level
    this.metrics.incrementCounter('observability_events_total', {
      level: event.level,
      category: event.category,
    });

    // Track errors
    if (event.level === 'error' || event.level === 'fatal') {
      this.metrics.incrementCounter('observability_errors_total', {
        category: event.category,
      });
    }

    // Track duration if available
    if (event.durationMs !== undefined) {
      this.metrics.observeHistogram(
        'observability_event_duration_ms',
        event.durationMs,
        {
          category: event.category,
        },
      );
    }

    this.emit('metric:recorded', event);
  }

  /**
   * Initialize default metric definitions
   */
  private initializeDefaultMetrics(): void {
    this.metrics.defineMetric({
      name: 'observability_events_total',
      type: 'counter',
      description: 'Total number of observability events',
      labels: ['level', 'category'],
    });

    this.metrics.defineMetric({
      name: 'observability_errors_total',
      type: 'counter',
      description: 'Total number of error events',
      labels: ['category'],
    });

    this.metrics.defineMetric({
      name: 'observability_event_duration_ms',
      type: 'histogram',
      description: 'Event duration in milliseconds',
      labels: ['category'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    });
  }

  /**
   * Emit a pipeline event
   */
  private emit(eventType: PipelineEventType, event: ObservabilityEvent): void {
    const handlers = this.eventHandlers.get(eventType);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(
          `Error in pipeline event handler for ${eventType}:`,
          error,
        );
      }
    }
  }
}

/**
 * Create a pre-configured observability pipeline
 *
 * @param config - Pipeline configuration
 * @returns Configured ObservabilityPipeline instance
 */
export function createObservabilityPipeline(
  config: Partial<ObservabilityPipelineConfig> = {},
): ObservabilityPipeline {
  return new ObservabilityPipeline(config);
}
