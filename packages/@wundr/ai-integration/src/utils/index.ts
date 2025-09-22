/**
 * Utility functions for AI Integration system
 */

import { OperationError } from '../types';

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        resolve(result);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          reject(error);
          return;
        }
        await sleep(delay * attempt);
      }
    }
  });
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export function calculateHash(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function createOperationError(
  code: string,
  message: string,
  recoverable: boolean = true,
  details?: Record<string, unknown>
): OperationError {
  return {
    code,
    message,
    recoverable,
    details,
  };
}

export function convertErrorToOperationError(error: Error | unknown, code: string = 'UNKNOWN_ERROR'): OperationError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return createOperationError(code, errorMessage, true, {
    originalError: error instanceof Error ? error.stack : undefined,
  });
}

export class Logger {
  static info(message: string, data?: any): void {
    console.info(
      `[INFO] ${new Date().toISOString()} ${message}`,
      data ? data : ''
    );
  }

  static error(message: string, error?: any): void {
    console.error(
      `[ERROR] ${new Date().toISOString()} ${message}`,
      error ? error : ''
    );
  }

  static warn(message: string, data?: any): void {
    console.warn(
      `[WARN] ${new Date().toISOString()} ${message}`,
      data ? data : ''
    );
  }

  static debug(message: string, data?: any): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(
        `[DEBUG] ${new Date().toISOString()} ${message}`,
        data ? data : ''
      );
    }
  }
}
