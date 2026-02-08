/**
 * Structured Logger for Orchestrator Daemon
 *
 * Provides JSON-formatted structured logging with correlation IDs,
 * trace context propagation, and child logger support. Designed as
 * a drop-in replacement for the existing Logger class.
 *
 * Output modes:
 *   - "json": One JSON object per line (production / log aggregation)
 *   - "text": Human-readable format for development / TTY
 *
 * Environment variables:
 *   - LOG_FORMAT: "json" | "text" (default: "json")
 *   - LOG_LEVEL: "debug" | "info" | "warn" | "error" (default: "info")
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type LogFormat = 'json' | 'text';

/**
 * Structured log entry written to the output stream.
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string;
  orchestratorId?: string;
  correlationId?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Contextual fields that are automatically attached to every log entry
 * produced by a logger instance (and its children).
 */
export interface LogContext {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sessionId?: string;
  orchestratorId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Configuration for the structured logger.
 */
export interface StructuredLoggerConfig {
  /** Minimum log level to emit. */
  level?: LogLevel;
  /** Output format. */
  format?: LogFormat;
  /** Custom output writer (defaults to process.stdout / process.stderr). */
  writer?: LogWriter;
}

/**
 * Abstraction over the output destination so we can redirect in tests.
 */
export interface LogWriter {
  write(entry: LogEntry, raw: string): void;
}

// ---------------------------------------------------------------------------
// Default writer (stdout / stderr)
// ---------------------------------------------------------------------------

class ConsoleLogWriter implements LogWriter {
  write(entry: LogEntry, raw: string): void {
    if (entry.level === 'error' || entry.level === 'warn') {
      process.stderr.write(raw + '\n');
    } else {
      process.stdout.write(raw + '\n');
    }
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatText(entry: LogEntry): string {
  const parts: string[] = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.component}]`,
  ];

  if (entry.traceId) {
    parts.push(`[trace=${entry.traceId.slice(0, 8)}]`);
  }
  if (entry.sessionId) {
    parts.push(`[session=${entry.sessionId}]`);
  }

  parts.push(entry.message);

  if (entry.duration !== undefined) {
    parts.push(`(${entry.duration}ms)`);
  }

  if (entry.error) {
    parts.push(`error=${entry.error.message}`);
    if (entry.error.stack) {
      parts.push(`\n${entry.error.stack}`);
    }
  }

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    parts.push(JSON.stringify(entry.metadata));
  }

  return parts.join(' ');
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// ---------------------------------------------------------------------------
// Error serialization
// ---------------------------------------------------------------------------

function serializeError(err: unknown): LogEntry['error'] | undefined {
  if (!err) return undefined;

  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      code: (err as NodeJS.ErrnoException).code,
    };
  }

  if (typeof err === 'string') {
    return { message: err };
  }

  return { message: String(err) };
}

// ---------------------------------------------------------------------------
// StructuredLogger
// ---------------------------------------------------------------------------

/**
 * Production-grade structured logger with correlation ID propagation.
 *
 * @example
 * ```ts
 * const logger = new StructuredLogger('SessionExecutor');
 *
 * // Basic usage (same API as existing Logger)
 * logger.info('Session started');
 *
 * // Create a child logger with persistent context
 * const child = logger.child({
 *   sessionId: 'sess_123',
 *   traceId: 'abc123def456...',
 * });
 * child.info('Processing task');
 * // => {"timestamp":"...","level":"info","component":"SessionExecutor",
 * //     "sessionId":"sess_123","traceId":"abc123def456...","message":"Processing task"}
 *
 * // Log with inline metadata
 * child.info('Tool invoked', { toolName: 'drift_detection', duration: 142 });
 *
 * // Log errors
 * child.error('Tool failed', error, { toolName: 'drift_detection' });
 * ```
 */
export class StructuredLogger {
  private readonly component: string;
  private readonly level: number;
  private readonly format: LogFormat;
  private readonly context: Readonly<LogContext>;
  private readonly writer: LogWriter;

  constructor(
    component: string,
    config?: StructuredLoggerConfig,
    context?: LogContext,
  ) {
    this.component = component;
    this.context = Object.freeze({ ...(context || {}) });

    const resolvedLevel = config?.level
      ?? (process.env['LOG_LEVEL'] as LogLevel | undefined)
      ?? 'info';
    this.level = LOG_LEVEL_VALUES[resolvedLevel] ?? LOG_LEVEL_VALUES.info;

    this.format = config?.format
      ?? (process.env['LOG_FORMAT'] as LogFormat | undefined)
      ?? 'json';

    this.writer = config?.writer ?? new ConsoleLogWriter();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Create a child logger that inherits this logger's context and appends
   * additional fields. The child shares the same writer, level, and format.
   */
  child(additionalContext: LogContext): StructuredLogger {
    const merged: LogContext = { ...this.context, ...additionalContext };
    return new StructuredLogger(
      this.component,
      { level: this.resolvedLevel(), format: this.format, writer: this.writer },
      merged,
    );
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, args);
  }

  /**
   * Set a new minimum log level. Returns a new logger instance (immutable pattern).
   */
  withLevel(level: LogLevel): StructuredLogger {
    return new StructuredLogger(
      this.component,
      { level, format: this.format, writer: this.writer },
      { ...this.context },
    );
  }

  /**
   * Start a timer and return a function that logs the elapsed duration.
   *
   * @example
   * ```ts
   * const end = logger.startTimer('LLM call');
   * const result = await llmClient.chat(params);
   * end({ model: 'gpt-4o' }); // logs: "LLM call" with duration
   * ```
   */
  startTimer(
    message: string,
    level: LogLevel = 'info',
  ): (metadata?: Record<string, unknown>) => number {
    const start = performance.now();
    return (metadata?: Record<string, unknown>) => {
      const duration = Math.round(performance.now() - start);
      this.log(level, message, [{ ...metadata, duration }]);
      return duration;
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private resolvedLevel(): LogLevel {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels[this.level] ?? 'info';
  }

  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (LOG_LEVEL_VALUES[level] < this.level) return;

    // Separate error objects from metadata objects in the args list.
    let errorObj: LogEntry['error'] | undefined;
    let metadata: Record<string, unknown> | undefined;
    let duration: number | undefined;

    for (const arg of args) {
      if (arg instanceof Error) {
        errorObj = serializeError(arg);
      } else if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
        const obj = arg as Record<string, unknown>;
        if ('duration' in obj && typeof obj['duration'] === 'number') {
          duration = obj['duration'] as number;
          // Copy remaining keys to metadata
          const { duration: _d, ...rest } = obj;
          metadata = metadata ? { ...metadata, ...rest } : (Object.keys(rest).length > 0 ? rest : undefined);
        } else {
          metadata = metadata ? { ...metadata, ...obj } : obj;
        }
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.component,
    };

    // Attach context fields
    if (this.context.traceId) entry.traceId = this.context.traceId;
    if (this.context.spanId) entry.spanId = this.context.spanId;
    if (this.context.parentSpanId) entry.parentSpanId = this.context.parentSpanId;
    if (this.context.sessionId) entry.sessionId = this.context.sessionId as string;
    if (this.context.orchestratorId) entry.orchestratorId = this.context.orchestratorId as string;
    if (this.context.correlationId) entry.correlationId = this.context.correlationId as string;

    if (duration !== undefined) entry.duration = duration;
    if (errorObj) entry.error = errorObj;
    if (metadata && Object.keys(metadata).length > 0) entry.metadata = metadata;

    const raw = this.format === 'json' ? formatJson(entry) : formatText(entry);
    this.writer.write(entry, raw);
  }
}

// ---------------------------------------------------------------------------
// In-memory log writer (useful for testing)
// ---------------------------------------------------------------------------

/**
 * Captures log entries in memory for assertions in tests.
 */
export class InMemoryLogWriter implements LogWriter {
  public readonly entries: LogEntry[] = [];
  public readonly raw: string[] = [];

  write(entry: LogEntry, rawStr: string): void {
    this.entries.push(entry);
    this.raw.push(rawStr);
  }

  clear(): void {
    this.entries.length = 0;
    this.raw.length = 0;
  }

  findByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  findByComponent(component: string): LogEntry[] {
    return this.entries.filter((e) => e.component === component);
  }

  findByMessage(pattern: string | RegExp): LogEntry[] {
    return this.entries.filter((e) =>
      typeof pattern === 'string'
        ? e.message.includes(pattern)
        : pattern.test(e.message),
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a structured logger with the given component name.
 */
export function createLogger(
  component: string,
  config?: StructuredLoggerConfig,
  context?: LogContext,
): StructuredLogger {
  return new StructuredLogger(component, config, context);
}

/**
 * Create a child logger from an existing logger with additional context.
 * Convenience function for the common pattern in request handlers.
 */
export function createChildLogger(
  parent: StructuredLogger,
  context: LogContext,
): StructuredLogger {
  return parent.child(context);
}
