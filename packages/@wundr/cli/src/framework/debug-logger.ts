/**
 * Debug Logger - Verbose/debug mode with detailed logging and TTY detection.
 *
 * Provides:
 * - Verbosity levels (silent, error, warn, info, debug, trace)
 * - Pipe-friendly output (auto-detects TTY vs piped output)
 * - Structured log entries with timestamps and context
 * - Color-coded output with chalk (disabled for non-TTY)
 * - Performance timing helpers
 * - Log filtering by tag/component
 *
 * @module framework/debug-logger
 */

import chalk from 'chalk';

import type { ContextLogger, GlobalOptions } from './command-interface';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Log verbosity levels ordered by severity.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Structured log entry for programmatic consumption.
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  tag?: string;
  data?: unknown;
  durationMs?: number;
}

/**
 * Configuration for the debug logger.
 */
export interface DebugLoggerOptions {
  /** Minimum log level to display. Defaults to 'info'. */
  level?: LogLevel;

  /** Whether stdout is a TTY. Auto-detected if not set. */
  isTTY?: boolean;

  /** Whether to disable color output. */
  noColor?: boolean;

  /** Whether to include timestamps in output. Defaults to true in debug/trace. */
  timestamps?: boolean;

  /** Tags to include. If set, only matching tags are displayed. */
  includeTags?: string[];

  /** Tags to exclude from display. */
  excludeTags?: string[];

  /** Custom write function. Defaults to process.stderr.write. */
  write?: (message: string) => void;

  /** Custom error write function. Defaults to process.stderr.write. */
  writeError?: (message: string) => void;

  /** Collect log entries for later inspection (testing). */
  collectEntries?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  silent: '',
  error: 'ERR',
  warn: 'WRN',
  info: 'INF',
  debug: 'DBG',
  trace: 'TRC',
};

// ---------------------------------------------------------------------------
// Debug Logger
// ---------------------------------------------------------------------------

export class DebugLogger implements ContextLogger {
  private level: LogLevel;
  private isTTY: boolean;
  private noColor: boolean;
  private showTimestamps: boolean;
  private includeTags: Set<string> | null;
  private excludeTags: Set<string>;
  private write: (message: string) => void;
  private writeError: (message: string) => void;
  private timers: Map<string, number> = new Map();
  private entries: LogEntry[] = [];
  private collectEntries: boolean;

  constructor(options: DebugLoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.isTTY = options.isTTY ?? process.stdout.isTTY === true;
    this.noColor =
      options.noColor ?? (process.env['NO_COLOR'] === '1' || !this.isTTY);
    this.showTimestamps =
      options.timestamps ?? (this.level === 'debug' || this.level === 'trace');
    this.includeTags = options.includeTags
      ? new Set(options.includeTags)
      : null;
    this.excludeTags = new Set(options.excludeTags ?? []);
    this.write = options.write ?? ((msg: string) => process.stderr.write(msg));
    this.writeError =
      options.writeError ?? ((msg: string) => process.stderr.write(msg));
    this.collectEntries = options.collectEntries ?? false;

    // Disable chalk color if not TTY or noColor
    if (this.noColor) {
      chalk.level = 0;
    }
  }

  /**
   * Create a logger from global CLI options.
   */
  static fromGlobalOptions(options: GlobalOptions): DebugLogger {
    let level: LogLevel = 'info';
    if (options.quiet) level = 'error';
    if (options.verbose) level = 'debug';

    return new DebugLogger({
      level,
      noColor: options.noColor,
    });
  }

  // -------------------------------------------------------------------------
  // Core log methods implementing ContextLogger
  // -------------------------------------------------------------------------

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, undefined, args.length > 0 ? args : undefined);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, undefined, args.length > 0 ? args : undefined);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, undefined, args.length > 0 ? args : undefined);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, undefined, args.length > 0 ? args : undefined);
  }

  success(message: string, ...args: unknown[]): void {
    this.log(
      'info',
      message,
      undefined,
      args.length > 0 ? args : undefined,
      true
    );
  }

  trace(message: string, ...args: unknown[]): void {
    this.log('trace', message, undefined, args.length > 0 ? args : undefined);
  }

  // -------------------------------------------------------------------------
  // Tagged logging
  // -------------------------------------------------------------------------

  /**
   * Create a tagged sub-logger that prefixes all messages with a component tag.
   */
  tagged(tag: string): TaggedLogger {
    return new TaggedLogger(this, tag);
  }

  /**
   * Log a message with a specific tag.
   */
  logTagged(
    level: LogLevel,
    tag: string,
    message: string,
    data?: unknown
  ): void {
    this.log(level, message, tag, data);
  }

  // -------------------------------------------------------------------------
  // Performance timing
  // -------------------------------------------------------------------------

  /**
   * Start a performance timer.
   *
   * @param label - Timer label
   */
  time(label: string): void {
    this.timers.set(label, performance.now());
    this.log('debug', `Timer started: ${label}`);
  }

  /**
   * End a performance timer and log the duration.
   *
   * @param label - Timer label
   * @returns Duration in milliseconds, or -1 if timer not found
   */
  timeEnd(label: string): number {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.log('warn', `Timer not found: ${label}`);
      return -1;
    }

    const duration = performance.now() - start;
    this.timers.delete(label);

    const entry: LogEntry = {
      timestamp: new Date(),
      level: 'debug',
      message: `Timer ${label}: ${duration.toFixed(2)}ms`,
      tag: 'perf',
      durationMs: duration,
    };

    if (this.collectEntries) {
      this.entries.push(entry);
    }

    this.log('debug', `${label}: ${this.formatDuration(duration)}`);
    return duration;
  }

  // -------------------------------------------------------------------------
  // Pipe-friendly output
  // -------------------------------------------------------------------------

  /**
   * Write data to stdout suitable for piping.
   * Uses plain text without colors when output is piped.
   *
   * @param data - Data to output
   */
  stdout(data: string): void {
    process.stdout.write(data);
    if (!data.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }

  /**
   * Check if output is being piped (non-TTY).
   */
  isPiped(): boolean {
    return !this.isTTY;
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Update the log level at runtime.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
    this.showTimestamps = level === 'debug' || level === 'trace';
  }

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Get all collected log entries (when collectEntries is enabled).
   */
  getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  /**
   * Clear collected entries.
   */
  clearEntries(): void {
    this.entries = [];
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  /**
   * Core log implementation.
   */
  private log(
    level: LogLevel,
    message: string,
    tag?: string,
    data?: unknown,
    isSuccess?: boolean
  ): void {
    // Check level threshold
    if (LEVEL_ORDER[level] > LEVEL_ORDER[this.level]) {
      return;
    }

    // Check tag filters
    if (tag) {
      if (this.excludeTags.has(tag)) return;
      if (this.includeTags && !this.includeTags.has(tag)) return;
    }

    // Collect entry
    if (this.collectEntries) {
      this.entries.push({
        timestamp: new Date(),
        level,
        message,
        tag,
        data,
      });
    }

    // Format and write
    const formatted = this.formatMessage(level, message, tag, isSuccess);
    const writeFn = level === 'error' ? this.writeError : this.write;
    writeFn(formatted + '\n');

    // Write data details in debug/trace mode
    if (data !== undefined && LEVEL_ORDER[this.level] >= LEVEL_ORDER['debug']) {
      const dataStr =
        typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const indented = dataStr
        .split('\n')
        .map(line => '  ' + line)
        .join('\n');
      writeFn(this.colorize('gray', indented) + '\n');
    }
  }

  /**
   * Format a log message for display.
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    tag?: string,
    isSuccess?: boolean
  ): string {
    const parts: string[] = [];

    // Timestamp
    if (this.showTimestamps) {
      const ts = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
      parts.push(this.colorize('gray', ts));
    }

    // Level badge
    const label = LEVEL_LABELS[level];
    if (label) {
      parts.push(this.colorizeLevel(level, label));
    }

    // Tag
    if (tag) {
      parts.push(this.colorize('cyan', `[${tag}]`));
    }

    // Message
    if (isSuccess) {
      parts.push(this.colorize('green', message));
    } else {
      parts.push(this.colorizeLevelMessage(level, message));
    }

    return parts.join(' ');
  }

  /**
   * Colorize a level badge.
   */
  private colorizeLevel(level: LogLevel, text: string): string {
    if (this.noColor) return `[${text}]`;

    switch (level) {
      case 'error':
        return chalk.red.bold(`[${text}]`);
      case 'warn':
        return chalk.yellow(`[${text}]`);
      case 'info':
        return chalk.blue(`[${text}]`);
      case 'debug':
        return chalk.gray(`[${text}]`);
      case 'trace':
        return chalk.dim(`[${text}]`);
      default:
        return `[${text}]`;
    }
  }

  /**
   * Colorize a message based on its level.
   */
  private colorizeLevelMessage(level: LogLevel, text: string): string {
    if (this.noColor) return text;

    switch (level) {
      case 'error':
        return chalk.red(text);
      case 'warn':
        return chalk.yellow(text);
      case 'trace':
        return chalk.dim(text);
      default:
        return text;
    }
  }

  /**
   * Apply a color name to text.
   */
  private colorize(color: string, text: string): string {
    if (this.noColor) return text;

    const colorFn = (chalk as unknown as Record<string, (s: string) => string>)[
      color
    ];
    return colorFn ? colorFn(text) : text;
  }

  /**
   * Format a duration in milliseconds to a human-readable string.
   */
  private formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}

// ---------------------------------------------------------------------------
// Tagged Logger
// ---------------------------------------------------------------------------

/**
 * A logger that prepends a tag to all messages.
 * Created via `DebugLogger.tagged('component')`.
 */
export class TaggedLogger implements ContextLogger {
  constructor(
    private parent: DebugLogger,
    private tag: string
  ) {}

  debug(message: string, ...args: unknown[]): void {
    this.parent.logTagged(
      'debug',
      this.tag,
      message,
      args.length > 0 ? args : undefined
    );
  }

  info(message: string, ...args: unknown[]): void {
    this.parent.logTagged(
      'info',
      this.tag,
      message,
      args.length > 0 ? args : undefined
    );
  }

  warn(message: string, ...args: unknown[]): void {
    this.parent.logTagged(
      'warn',
      this.tag,
      message,
      args.length > 0 ? args : undefined
    );
  }

  error(message: string, ...args: unknown[]): void {
    this.parent.logTagged(
      'error',
      this.tag,
      message,
      args.length > 0 ? args : undefined
    );
  }

  success(message: string, ...args: unknown[]): void {
    this.parent.logTagged(
      'info',
      this.tag,
      message,
      args.length > 0 ? args : undefined
    );
  }
}
