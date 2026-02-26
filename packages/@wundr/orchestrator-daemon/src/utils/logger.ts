/**
 * Simple logger utility for Orchestrator Daemon
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private name: string;

  constructor(name: string, level: LogLevel = LogLevel.INFO) {
    this.name = name;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(
        `[${this.timestamp()}] [DEBUG] [${this.name}]`,
        message,
        ...args
      );
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(
        `[${this.timestamp()}] [INFO] [${this.name}]`,
        message,
        ...args
      );
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(
        `[${this.timestamp()}] [WARN] [${this.name}]`,
        message,
        ...args
      );
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(
        `[${this.timestamp()}] [ERROR] [${this.name}]`,
        message,
        ...args
      );
    }
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}
