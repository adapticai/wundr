/**
 * Logger Utility
 * Provides enterprise-grade logging with colors, timestamps, and configurable levels
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamps?: boolean;
}

export class Logger {
  private readonly name: string;
  private readonly level: LogLevel;
  private readonly enableColors: boolean;
  private readonly enableTimestamps: boolean;
  private static readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.name = options.name || 'app';
    this.level = options.level || this.getLogLevelFromEnv();
    this.enableColors = options.enableColors ?? true;
    this.enableTimestamps = options.enableTimestamps ?? true;
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLevel && Object.prototype.hasOwnProperty.call(Logger.levels, envLevel)) {
      return envLevel;
    }
    
    // Check for DEBUG environment variable for backward compatibility
    if (process.env.DEBUG === 'true' || process.env.DEBUG === '1') {
      return 'debug';
    }
    
    return 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return Logger.levels[level] >= Logger.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = this.enableTimestamps ? new Date().toISOString() : '';
    const levelStr = level.toUpperCase().padEnd(5);
    const nameStr = this.name.padEnd(20);
    
    let prefix = '';
    if (this.enableTimestamps) {
      prefix += `${timestamp} `;
    }
    prefix += `[${levelStr}] ${nameStr}`;

    if (this.enableColors) {
      switch (level) {
        case 'debug':
          prefix = chalk.gray(prefix);
          break;
        case 'info':
          prefix = chalk.blue(prefix);
          break;
        case 'warn':
          prefix = chalk.yellow(prefix);
          break;
        case 'error':
          prefix = chalk.red(prefix);
          break;
      }
    }

    const fullMessage = args.length > 0 ? `${message} ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
    ).join(' ')}` : message;

    return `${prefix} ${fullMessage}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  // Child logger for creating namespaced loggers
  child(name: string): Logger {
    return new Logger({
      name: `${this.name}:${name}`,
      level: this.level,
      enableColors: this.enableColors,
      enableTimestamps: this.enableTimestamps,
    });
  }
}

// Factory function for creating loggers
export function getLogger(name: string): Logger {
  return new Logger({ name });
}

// Default logger instance
export const logger = new Logger();

// Export for backward compatibility
export default getLogger;