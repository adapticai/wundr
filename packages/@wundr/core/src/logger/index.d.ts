/**
 * Logging utilities for the Wundr platform
 */
import { Logger } from '../types/index.js';
export interface LoggerConfig {
    level?: string;
    format?: 'json' | 'simple' | 'detailed';
    colorize?: boolean;
    timestamp?: boolean;
    file?: string;
    console?: boolean;
}
/**
 * Get the default logger instance
 */
export declare function getLogger(): Logger;
/**
 * Create a new logger instance with custom configuration
 */
export declare function createLogger(config?: LoggerConfig): Logger;
/**
 * Set the default logger instance
 */
export declare function setDefaultLogger(logger: Logger): void;
/**
 * Quick access to default logger methods
 */
export declare const log: {
    debug: (message: string, meta?: Record<string, unknown>) => void;
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string | Error, meta?: Record<string, unknown>) => void;
};
//# sourceMappingURL=index.d.ts.map