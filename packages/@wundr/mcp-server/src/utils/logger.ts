/**
 * Logger Implementation for MCP Server
 *
 * Provides a configurable logging system that writes to stderr
 * (to avoid polluting stdout which is used for MCP protocol messages).
 */

import { LogLevel as MCPLogLevel, Logger as MCPLogger } from '../types';

/**
 * Log level enum for backward compatibility
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Logger interface for backward compatibility
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a logger instance with the specified log level
 */
export function createLogger(level: LogLevel = LogLevel.INFO): Logger {
  const shouldLog = (messageLevel: LogLevel): boolean => messageLevel >= level;

  const formatMessage = (levelName: string, message: string, args: unknown[]): string => {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${levelName}] [wundr-mcp] ${message}${formattedArgs}`;
  };

  return {
    debug: (message: string, ...args: unknown[]): void => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.error(formatMessage('DEBUG', message, args));
      }
    },

    info: (message: string, ...args: unknown[]): void => {
      if (shouldLog(LogLevel.INFO)) {
        console.error(formatMessage('INFO', message, args));
      }
    },

    warn: (message: string, ...args: unknown[]): void => {
      if (shouldLog(LogLevel.WARN)) {
        console.error(formatMessage('WARN', message, args));
      }
    },

    error: (message: string, ...args: unknown[]): void => {
      if (shouldLog(LogLevel.ERROR)) {
        console.error(formatMessage('ERROR', message, args));
      }
    },
  };
}

// =============================================================================
// MCP Protocol Compatible Logger
// =============================================================================

/**
 * Log level priority (higher = more severe)
 */
const LOG_LEVEL_PRIORITY: Record<MCPLogLevel, number> = {
  debug: 0,
  info: 1,
  notice: 2,
  warning: 3,
  error: 4,
  critical: 5,
  alert: 6,
  emergency: 7,
};

/**
 * Console Logger Implementation for MCP Protocol
 *
 * Logs messages to stderr with timestamp and level formatting.
 * Respects the configured minimum log level.
 * Implements the MCPLogger interface for protocol compliance.
 */
export class ConsoleLogger implements MCPLogger {
  private readonly minLevel: MCPLogLevel;
  private readonly minPriority: number;
  private readonly prefix: string;

  constructor(minLevel: MCPLogLevel = 'info', prefix = 'MCP') {
    this.minLevel = minLevel;
    this.minPriority = LOG_LEVEL_PRIORITY[minLevel];
    this.prefix = prefix;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: MCPLogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.minPriority;
  }

  /**
   * Format a log message
   */
  private formatMessage(level: MCPLogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase().padEnd(9);
    const prefix = this.prefix ? `[${this.prefix}]` : '';

    let formatted = `${timestamp} ${levelUpper} ${prefix} ${message}`;

    if (data !== undefined) {
      if (data instanceof Error) {
        formatted += `\n  Error: ${data.message}`;
        if (data.stack) {
          formatted += `\n  Stack: ${data.stack}`;
        }
      } else if (typeof data === 'object') {
        try {
          formatted += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        } catch {
          formatted += `\n  Data: [Circular or non-serializable object]`;
        }
      } else {
        formatted += ` ${String(data)}`;
      }
    }

    return formatted;
  }

  /**
   * Write a log message to stderr
   */
  private writeLog(level: MCPLogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, data);
    process.stderr.write(formatted + '\n');
  }

  // MCPLogger interface implementation

  public debug(message: string, data?: unknown): void {
    this.writeLog('debug', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.writeLog('info', message, data);
  }

  public notice(message: string, data?: unknown): void {
    this.writeLog('notice', message, data);
  }

  public warning(message: string, data?: unknown): void {
    this.writeLog('warning', message, data);
  }

  public error(message: string, data?: unknown): void {
    this.writeLog('error', message, data);
  }

  public critical(message: string, data?: unknown): void {
    this.writeLog('critical', message, data);
  }

  public alert(message: string, data?: unknown): void {
    this.writeLog('alert', message, data);
  }

  public emergency(message: string, data?: unknown): void {
    this.writeLog('emergency', message, data);
  }
}

/**
 * JSON Logger Implementation
 *
 * Outputs structured JSON logs to stderr, suitable for log aggregation systems.
 */
export class JsonLogger implements MCPLogger {
  private readonly minLevel: MCPLogLevel;
  private readonly minPriority: number;
  private readonly metadata: Record<string, unknown>;

  constructor(minLevel: MCPLogLevel = 'info', metadata: Record<string, unknown> = {}) {
    this.minLevel = minLevel;
    this.minPriority = LOG_LEVEL_PRIORITY[minLevel];
    this.metadata = metadata;
  }

  private shouldLog(level: MCPLogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.minPriority;
  }

  private writeLog(level: MCPLogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.metadata,
      ...(data !== undefined
        ? { data: data instanceof Error ? { error: data.message, stack: data.stack } : data }
        : {}),
    };

    process.stderr.write(JSON.stringify(logEntry) + '\n');
  }

  public debug(message: string, data?: unknown): void {
    this.writeLog('debug', message, data);
  }

  public info(message: string, data?: unknown): void {
    this.writeLog('info', message, data);
  }

  public notice(message: string, data?: unknown): void {
    this.writeLog('notice', message, data);
  }

  public warning(message: string, data?: unknown): void {
    this.writeLog('warning', message, data);
  }

  public error(message: string, data?: unknown): void {
    this.writeLog('error', message, data);
  }

  public critical(message: string, data?: unknown): void {
    this.writeLog('critical', message, data);
  }

  public alert(message: string, data?: unknown): void {
    this.writeLog('alert', message, data);
  }

  public emergency(message: string, data?: unknown): void {
    this.writeLog('emergency', message, data);
  }
}

/**
 * Silent Logger Implementation
 *
 * No-op logger that discards all messages. Useful for testing.
 */
export class SilentLogger implements MCPLogger {
  public debug(): void {
    // No-op
  }

  public info(): void {
    // No-op
  }

  public notice(): void {
    // No-op
  }

  public warning(): void {
    // No-op
  }

  public error(): void {
    // No-op
  }

  public critical(): void {
    // No-op
  }

  public alert(): void {
    // No-op
  }

  public emergency(): void {
    // No-op
  }
}

/**
 * Create an MCP-compatible logger based on configuration
 */
export function createMCPLogger(
  level: MCPLogLevel = 'info',
  format: 'text' | 'json' = 'text',
  metadata?: Record<string, unknown>
): MCPLogger {
  if (format === 'json') {
    return new JsonLogger(level, metadata);
  }
  return new ConsoleLogger(level);
}
