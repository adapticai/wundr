/**
 * Distributed Tracing for Orchestrator Daemon
 *
 * Provides lightweight W3C Trace Context-compatible distributed tracing
 * across agent boundaries, session lifecycles, tool executions, and
 * federation delegation requests.
 *
 * Trace IDs are 32-char hex strings. Span IDs are 16-char hex strings.
 * This format is directly compatible with OpenTelemetry, Jaeger, and Zipkin
 * for future export without ID conversion.
 *
 * Environment variables:
 *   - TRACING_ENABLED: "true" | "false" (default: "true")
 *   - TRACING_SAMPLE_RATE: 0.0 - 1.0 (default: 1.0)
 *   - TRACING_MAX_SPANS: Maximum spans per trace before eviction (default: 1000)
 *   - TRACING_SPAN_TTL_MS: Auto-expire incomplete spans after this duration (default: 300000)
 */

import { randomBytes } from 'crypto';
import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Immutable trace context that is propagated across boundaries.
 */
export interface TraceContext {
  /** 32-char hex trace identifier (shared across all spans in a trace). */
  readonly traceId: string;
  /** 16-char hex span identifier (unique per operation). */
  readonly spanId: string;
  /** Parent span ID, if this span was created as a child. */
  readonly parentSpanId?: string;
  /** Free-form key-value pairs propagated with the trace. */
  readonly baggage: ReadonlyMap<string, string>;
}

/**
 * A recorded span representing a single operation within a trace.
 */
export interface Span {
  /** Trace context for this span. */
  context: TraceContext;
  /** Human-readable operation name (e.g., "session.execute", "tool.drift_detection"). */
  name: string;
  /** When the span started. */
  startTime: number;
  /** When the span ended (undefined while in-flight). */
  endTime?: number;
  /** Duration in milliseconds (set when span ends). */
  duration?: number;
  /** Span status. */
  status: SpanStatus;
  /** Structured attributes attached to this span. */
  attributes: Record<string, string | number | boolean>;
  /** Ordered list of timestamped events within the span. */
  events: SpanEvent[];
}

export type SpanStatus = 'ok' | 'error' | 'in_progress';

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Options for creating a new span.
 */
export interface SpanOptions {
  /** Override the automatically generated span ID. */
  spanId?: string;
  /** Initial attributes. */
  attributes?: Record<string, string | number | boolean>;
  /** Baggage to merge into the trace context. */
  baggage?: Record<string, string>;
}

/**
 * Tracing configuration.
 */
export interface TracingConfig {
  /** Enable or disable tracing. */
  enabled?: boolean;
  /** Sampling rate: 0.0 = drop everything, 1.0 = keep everything. */
  sampleRate?: number;
  /** Maximum number of completed spans to retain per trace. */
  maxSpansPerTrace?: number;
  /** Auto-expire in-progress spans after this many milliseconds. */
  spanTtlMs?: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

interface TracerEvents {
  'span:start': (span: Span) => void;
  'span:end': (span: Span) => void;
  'span:error': (span: Span, error: Error) => void;
}

// ---------------------------------------------------------------------------
// ID Generation (W3C Trace Context compatible)
// ---------------------------------------------------------------------------

/** Generate a 32-character hex trace ID. */
export function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/** Generate a 16-character hex span ID. */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

// ---------------------------------------------------------------------------
// Tracer
// ---------------------------------------------------------------------------

/**
 * Lightweight distributed tracer.
 *
 * @example
 * ```ts
 * const tracer = new Tracer();
 *
 * // Start a root span
 * const rootSpan = tracer.startSpan('session.execute', undefined, {
 *   attributes: { sessionId: 'sess_123' },
 * });
 *
 * // Start a child span
 * const childSpan = tracer.startSpan('llm.chat', rootSpan.context, {
 *   attributes: { model: 'gpt-4o', provider: 'openai' },
 * });
 *
 * // End spans
 * tracer.endSpan(childSpan.context.spanId, 'ok');
 * tracer.endSpan(rootSpan.context.spanId, 'ok');
 *
 * // Convenience: wrap an async function in a span
 * const result = await tracer.withSpan(
 *   'tool.execute',
 *   rootSpan.context,
 *   async (span) => {
 *     span.attributes['toolName'] = 'drift_detection';
 *     return await executeTool();
 *   },
 * );
 * ```
 */
export class Tracer extends EventEmitter<TracerEvents> {
  private readonly config: Required<TracingConfig>;

  /** All active (in-progress) spans indexed by span ID. */
  private readonly activeSpans: Map<string, Span> = new Map();

  /** Completed spans indexed by trace ID, then by span ID. */
  private readonly completedSpans: Map<string, Map<string, Span>> = new Map();

  /** Cleanup timer for expired spans. */
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: TracingConfig) {
    super();

    this.config = {
      enabled: config?.enabled ?? (process.env['TRACING_ENABLED'] !== 'false'),
      sampleRate: config?.sampleRate ?? parseFloat(process.env['TRACING_SAMPLE_RATE'] ?? '1.0'),
      maxSpansPerTrace: config?.maxSpansPerTrace ?? parseInt(process.env['TRACING_MAX_SPANS'] ?? '1000', 10),
      spanTtlMs: config?.spanTtlMs ?? parseInt(process.env['TRACING_SPAN_TTL_MS'] ?? '300000', 10),
    };

    // Start periodic cleanup of expired spans
    if (this.config.enabled) {
      this.cleanupTimer = setInterval(() => this.cleanupExpiredSpans(), this.config.spanTtlMs);
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Span Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start a new span. If no parent context is provided, a new root trace
   * is created. Returns the span object with its context.
   */
  startSpan(
    name: string,
    parentContext?: TraceContext,
    options?: SpanOptions,
  ): Span {
    if (!this.config.enabled) {
      return this.createNoopSpan(name);
    }

    // Sampling decision (per-trace for root spans, inherited for child spans)
    if (!parentContext && Math.random() > this.config.sampleRate) {
      return this.createNoopSpan(name);
    }

    const traceId = parentContext?.traceId ?? generateTraceId();
    const spanId = options?.spanId ?? generateSpanId();
    const parentSpanId = parentContext?.spanId;

    // Merge baggage
    const baggage = new Map<string, string>(parentContext?.baggage ?? []);
    if (options?.baggage) {
      for (const [k, v] of Object.entries(options.baggage)) {
        baggage.set(k, v);
      }
    }

    const context: TraceContext = Object.freeze({
      traceId,
      spanId,
      parentSpanId,
      baggage,
    });

    const span: Span = {
      context,
      name,
      startTime: Date.now(),
      status: 'in_progress',
      attributes: { ...(options?.attributes ?? {}) },
      events: [],
    };

    this.activeSpans.set(spanId, span);
    this.emit('span:start', span);

    return span;
  }

  /**
   * End an active span by its span ID.
   */
  endSpan(spanId: string, status: SpanStatus = 'ok'): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) return undefined;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    this.activeSpans.delete(spanId);

    // Store in completed spans, respecting per-trace limit
    const traceId = span.context.traceId;
    let traceSpans = this.completedSpans.get(traceId);
    if (!traceSpans) {
      traceSpans = new Map();
      this.completedSpans.set(traceId, traceSpans);
    }

    if (traceSpans.size >= this.config.maxSpansPerTrace) {
      // Evict oldest span
      const oldestKey = traceSpans.keys().next().value;
      if (oldestKey !== undefined) {
        traceSpans.delete(oldestKey);
      }
    }

    traceSpans.set(spanId, span);

    this.emit('span:end', span);
    return span;
  }

  /**
   * Record an error on a span and end it with error status.
   */
  failSpan(spanId: string, error: Error): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) return undefined;

    span.attributes['error.message'] = error.message;
    span.attributes['error.type'] = error.constructor.name;
    if (error.stack) {
      span.attributes['error.stack'] = error.stack.slice(0, 1000);
    }

    span.events.push({
      name: 'exception',
      timestamp: Date.now(),
      attributes: {
        'exception.message': error.message,
        'exception.type': error.constructor.name,
      },
    });

    this.emit('span:error', span, error);
    return this.endSpan(spanId, 'error');
  }

  /**
   * Add an event to an active span.
   */
  addEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Set attributes on an active span.
   */
  setAttributes(
    spanId: string,
    attributes: Record<string, string | number | boolean>,
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    Object.assign(span.attributes, attributes);
  }

  // -----------------------------------------------------------------------
  // High-level helpers
  // -----------------------------------------------------------------------

  /**
   * Wrap an async function in a span. The span is automatically ended when
   * the function completes (with status=ok) or throws (with status=error).
   */
  async withSpan<T>(
    name: string,
    parentContext: TraceContext | undefined,
    fn: (span: Span) => Promise<T>,
    options?: SpanOptions,
  ): Promise<T> {
    const span = this.startSpan(name, parentContext, options);

    try {
      const result = await fn(span);
      this.endSpan(span.context.spanId, 'ok');
      return result;
    } catch (error) {
      this.failSpan(
        span.context.spanId,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Wrap a synchronous function in a span.
   */
  withSpanSync<T>(
    name: string,
    parentContext: TraceContext | undefined,
    fn: (span: Span) => T,
    options?: SpanOptions,
  ): T {
    const span = this.startSpan(name, parentContext, options);

    try {
      const result = fn(span);
      this.endSpan(span.context.spanId, 'ok');
      return result;
    } catch (error) {
      this.failSpan(
        span.context.spanId,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // Context Propagation
  // -----------------------------------------------------------------------

  /**
   * Serialize a trace context to a W3C traceparent header value.
   *
   * Format: `00-{traceId}-{spanId}-{flags}`
   */
  static toTraceparent(context: TraceContext): string {
    const flags = '01'; // sampled
    return `00-${context.traceId}-${context.spanId}-${flags}`;
  }

  /**
   * Parse a W3C traceparent header value into a TraceContext.
   * Returns undefined if the header is malformed.
   */
  static fromTraceparent(header: string): TraceContext | undefined {
    const parts = header.split('-');
    if (parts.length < 4) return undefined;

    const [_version, traceId, spanId, _flags] = parts;
    if (!traceId || traceId.length !== 32) return undefined;
    if (!spanId || spanId.length !== 16) return undefined;

    return Object.freeze({
      traceId,
      spanId,
      baggage: new Map(),
    });
  }

  /**
   * Extract trace context from a WebSocket message payload.
   * Looks for `traceId` / `x-trace-id` fields in the payload.
   */
  static extractFromPayload(
    payload: Record<string, unknown>,
  ): TraceContext | undefined {
    const traceId =
      (payload['traceId'] as string) ??
      (payload['x-trace-id'] as string) ??
      (payload['trace_id'] as string);

    if (!traceId || typeof traceId !== 'string') return undefined;

    const spanId =
      (payload['spanId'] as string) ??
      (payload['x-span-id'] as string) ??
      (payload['span_id'] as string);

    return Object.freeze({
      traceId,
      spanId: typeof spanId === 'string' && spanId.length === 16 ? spanId : generateSpanId(),
      baggage: new Map(),
    });
  }

  /**
   * Inject trace context into a payload object for propagation over
   * WebSocket messages or federation requests.
   */
  static injectIntoPayload(
    context: TraceContext,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...payload,
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
    };
  }

  // -----------------------------------------------------------------------
  // Query
  // -----------------------------------------------------------------------

  /** Get an active span by its span ID. */
  getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  /** Get all completed spans for a given trace ID. */
  getTraceSpans(traceId: string): Span[] {
    const traceMap = this.completedSpans.get(traceId);
    if (!traceMap) return [];
    return Array.from(traceMap.values());
  }

  /** Get the count of active (in-progress) spans. */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /** Get the count of completed traces. */
  getCompletedTraceCount(): number {
    return this.completedSpans.size;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Expire spans that have been in-progress for longer than the TTL.
   */
  private cleanupExpiredSpans(): void {
    const now = Date.now();

    for (const [spanId, span] of this.activeSpans) {
      if (now - span.startTime > this.config.spanTtlMs) {
        span.attributes['expired'] = true;
        span.events.push({
          name: 'span_expired',
          timestamp: now,
          attributes: { ttlMs: this.config.spanTtlMs },
        });
        this.endSpan(spanId, 'error');
      }
    }
  }

  /**
   * Clear all completed traces older than the given age in milliseconds.
   * Useful for memory management in long-running processes.
   */
  clearCompletedTraces(olderThanMs?: number): number {
    if (!olderThanMs) {
      const count = this.completedSpans.size;
      this.completedSpans.clear();
      return count;
    }

    const cutoff = Date.now() - olderThanMs;
    let cleared = 0;

    for (const [traceId, traceSpans] of this.completedSpans) {
      // Check if all spans in the trace are older than the cutoff
      let allOld = true;
      for (const span of traceSpans.values()) {
        if ((span.endTime ?? span.startTime) > cutoff) {
          allOld = false;
          break;
        }
      }

      if (allOld) {
        this.completedSpans.delete(traceId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Stop the cleanup timer and release resources.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.activeSpans.clear();
    this.completedSpans.clear();
    this.removeAllListeners();
  }

  // -----------------------------------------------------------------------
  // Noop span (when tracing is disabled or not sampled)
  // -----------------------------------------------------------------------

  private createNoopSpan(name: string): Span {
    const context: TraceContext = Object.freeze({
      traceId: '0'.repeat(32),
      spanId: '0'.repeat(16),
      baggage: new Map(),
    });

    return {
      context,
      name,
      startTime: Date.now(),
      status: 'ok',
      attributes: {},
      events: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let defaultTracer: Tracer | null = null;

/**
 * Get or create the default tracer singleton.
 */
export function getTracer(config?: TracingConfig): Tracer {
  if (!defaultTracer) {
    defaultTracer = new Tracer(config);
  }
  return defaultTracer;
}

/**
 * Reset the default tracer (for testing).
 */
export function resetTracer(): void {
  if (defaultTracer) {
    defaultTracer.destroy();
    defaultTracer = null;
  }
}

/**
 * Create a new tracer instance (for isolated usage / testing).
 */
export function createTracer(config?: TracingConfig): Tracer {
  return new Tracer(config);
}
