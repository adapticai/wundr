/**
 * Logger Utility - Centralized logging with levels and formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
};

export type LoggerConfig = {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  includeTimestamp: boolean;
  includeContext: boolean;
};

class Logger {
  private config: LoggerConfig = {
    level: 'info',
    enableConsole: true,
    enableRemote: false,
    includeTimestamp: true,
    includeContext: true,
  };

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[Logger] Configuration updated:', this.config);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level];
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const parts: string[] = [];

    if (this.config.includeTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    if (this.config.includeContext && context) {
      parts.push(JSON.stringify(context));
    }

    return parts.join(' ');
  }

  private writeLog(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, context);
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    };

    // Console output
    if (this.config.enableConsole) {
      const consoleMethod = level === 'debug' ? 'log' : level;
      console[consoleMethod](formattedMessage);
    }

    // Remote logging
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.sendToRemote(entry);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('[Logger] Failed to send log to remote:', error);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.writeLog('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.writeLog('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.writeLog('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.writeLog('error', message, context);
  }

  /**
   * Log with specific level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    this.writeLog(level, message, context);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.configure(this.config);
    const originalWriteLog = childLogger.writeLog.bind(childLogger);
    childLogger.writeLog = (
      level: LogLevel,
      message: string,
      additionalContext?: LogContext
    ) => {
      originalWriteLog(level, message, { ...context, ...additionalContext });
    };
    return childLogger;
  }

  /**
   * Time a function execution
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.debug(`[${label}] Started`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`[${label}] Completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`[${label}] Failed after ${duration}ms`, { error });
      throw error;
    }
  }
}

// Singleton instance
const logger = new Logger();

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  logger.configure(config);
}

/**
 * Log debug message
 */
export function debug(message: string, context?: LogContext): void {
  logger.debug(message, context);
}

/**
 * Log info message
 */
export function info(message: string, context?: LogContext): void {
  logger.info(message, context);
}

/**
 * Log warning message
 */
export function warn(message: string, context?: LogContext): void {
  logger.warn(message, context);
}

/**
 * Log error message
 */
export function error(message: string, context?: LogContext): void {
  logger.error(message, context);
}

/**
 * Log with specific level
 */
export function log(
  level: LogLevel,
  message: string,
  context?: LogContext
): void {
  logger.log(level, message, context);
}

/**
 * Create a child logger with additional context
 */
export function createLogger(context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Time a function execution
 */
export function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return logger.time(label, fn);
}

// Export the logger instance as named export and default
export { logger };
export default logger;
