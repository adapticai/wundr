/**
 * Logging utilities
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

class WundrLogger implements Logger {
  private logFile: string;
  private component: string;

  constructor(component: string) {
    this.component = component;
    const logDir = join(homedir(), '.wundr', 'logs');
    
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    this.logFile = join(logDir, `environment-${new Date().toISOString().split('T')[0]}.log`);
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, args);
  }

  private log(level: LogLevel, message: string, args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    const logEntry = `[${timestamp}] ${level.toUpperCase()} [${this.component}] ${message}${formattedArgs}\\n`;
    
    // Console output with colors
    const color = this.getColor(level);
    console.log(`${color}[${this.component}]${this.resetColor()} ${message}`, ...args);
    
    // File output
    try {
      writeFileSync(this.logFile, logEntry, { flag: 'a' });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\\033[36m'; // Cyan
      case 'info': return '\\033[32m';  // Green
      case 'warn': return '\\033[33m';  // Yellow
      case 'error': return '\\033[31m'; // Red
      default: return '';
    }
  }

  private resetColor(): string {
    return '\\033[0m';
  }
}

export function createLogger(component: string): Logger {
  return new WundrLogger(component);
}