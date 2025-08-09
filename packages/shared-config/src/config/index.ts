// Shared configuration
export const DEFAULT_CONFIG = {
  timeout: 30000,
  retryCount: 3,
  logLevel: 'info' as const,
};

export interface SharedConfig {
  timeout: number;
  retryCount: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}