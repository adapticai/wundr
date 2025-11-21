import chalk from 'chalk';

import type { Logger } from '../types';

/**
 * Enhanced logger with multiple levels and colored output
 */
class WundrLogger implements Logger {
  private level: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private silent = false;

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.level = level;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  private shouldLog(level: string): boolean {
    if (this.silent) {
return false;
}

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level as keyof typeof levels] >= levels[this.level];
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const fullMessage =
      args.length > 0 ? `${message} ${args.join(' ')}` : message;
    return `${prefix} ${fullMessage}`;
  }

  debug(message: string, ...args: any[]): void {
    if (!this.shouldLog('debug')) {
return;
}
    console.log(chalk.gray(this.formatMessage('debug', message, ...args)));
  }

  info(message: string, ...args: any[]): void {
    if (!this.shouldLog('info')) {
return;
}
    console.log(chalk.blue(this.formatMessage('info', message, ...args)));
  }

  warn(message: string, ...args: any[]): void {
    if (!this.shouldLog('warn')) {
return;
}
    console.warn(chalk.yellow(this.formatMessage('warn', message, ...args)));
  }

  error(message: string, ...args: any[]): void {
    if (!this.shouldLog('error')) {
return;
}
    console.error(chalk.red(this.formatMessage('error', message, ...args)));
  }

  success(message: string, ...args: any[]): void {
    if (!this.shouldLog('info')) {
return;
}
    console.log(chalk.green(this.formatMessage('success', message, ...args)));
  }

  // Utility methods for structured logging
  table(data: any[]): void {
    if (this.silent) {
return;
}
    console.table(data);
  }

  json(data: any): void {
    if (this.silent) {
return;
}
    console.log(JSON.stringify(data, null, 2));
  }

  group(label: string): void {
    if (this.silent) {
return;
}
    console.group(chalk.cyan(label));
  }

  groupEnd(): void {
    if (this.silent) {
return;
}
    console.groupEnd();
  }

  // Progress logging
  progress(current: number, total: number, message?: string): void {
    if (this.silent) {
return;
}
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.round(percentage / 2));
    const empty = '░'.repeat(50 - Math.round(percentage / 2));
    const progress = `[${bar}${empty}] ${percentage}%`;

    const output = message
      ? `${chalk.cyan(progress)} ${message}`
      : chalk.cyan(progress);

    process.stdout.write(`\r${output}`);

    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

export const logger = new WundrLogger();
