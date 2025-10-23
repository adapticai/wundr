/**
 * Logging utilities for the Wundr platform
 */

/* eslint-disable import/no-named-as-default, import/no-named-as-default-member */
// Winston is used as a default import and members are accessed via the default object
import chalk from 'chalk';
import winston from 'winston';

import type { Logger } from '../types/index.js';

// Re-export the Logger type for convenience
export { type Logger };

export interface LoggerConfig {
  level?: string;
  format?: 'json' | 'simple' | 'detailed';
  colorize?: boolean;
  timestamp?: boolean;
  file?: string;
  console?: boolean;
}

class WundrLogger implements Logger {
  private winston: winston.Logger;

  constructor(config: LoggerConfig = {}) {
    const {
      level = 'info',
      format = 'detailed',
      colorize = true,
      timestamp = true,
      file,
      console = true,
    } = config;

    const formats = [];

    if (timestamp) {
      formats.push(winston.format.timestamp());
    }

    if (format === 'json') {
      formats.push(winston.format.json());
    } else {
      formats.push(
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const ts = timestamp ? `[${timestamp}]` : '';
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : '';

          if (format === 'simple') {
            return `${ts} ${level}: ${message}${metaStr}`;
          }

          // detailed format
          const levelStr = colorize
            ? this.colorizeLevel(level)
            : level.toUpperCase();
          const messageStr = colorize ? chalk.white(message) : message;
          const tsStr = colorize && timestamp ? chalk.gray(ts) : ts;

          return `${tsStr} ${levelStr} ${messageStr}${metaStr}`;
        })
      );
    }

    const transports: winston.transport[] = [];

    if (console) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(...formats),
        })
      );
    }

    if (file) {
      transports.push(
        new winston.transports.File({
          filename: file,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.winston = winston.createLogger({
      level,
      transports,
    });
  }

  private colorizeLevel(level: string): string {
    switch (level) {
      case 'error':
        return chalk.red(level.toUpperCase());
      case 'warn':
        return chalk.yellow(level.toUpperCase());
      case 'info':
        return chalk.blue(level.toUpperCase());
      case 'debug':
        return chalk.green(level.toUpperCase());
      default:
        return level.toUpperCase();
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.winston.debug(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.winston.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.winston.warn(message, meta);
  }

  error(message: string | Error, meta?: Record<string, unknown>): void {
    if (message instanceof Error) {
      this.winston.error(message.message, {
        stack: message.stack,
        name: message.name,
        ...meta,
      });
    } else {
      this.winston.error(message, meta);
    }
  }

  child(defaultMeta: Record<string, unknown>): Logger {
    const childWinston = this.winston.child(defaultMeta);
    const childLogger = Object.create(WundrLogger.prototype);
    childLogger.winston = childWinston;
    return childLogger;
  }

  setLevel(level: string): void {
    this.winston.level = level;
  }
}

// Default logger instance
let defaultLogger: Logger;

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new WundrLogger();
  }
  return defaultLogger;
}

/**
 * Create a new logger instance with custom configuration
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  return new WundrLogger(config);
}

/**
 * Set the default logger instance
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Quick access to default logger methods
 */
export const log = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    getLogger().debug(message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    getLogger().info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    getLogger().warn(message, meta),
  error: (message: string | Error, meta?: Record<string, unknown>) =>
    getLogger().error(message, meta),
};
