/**
 * Shared type definitions for the integration system
 */

// React types for plugin development (basic definitions)
export namespace React {
  export type ComponentType<P = {}> = (props: P) => Element | null;
  export interface Element {
    type: any;
    props: any;
    key: string | number | null;
  }
  export function createElement(
    type: any,
    props?: any,
    ...children: any[]
  ): Element {
    return {
      type,
      props: { ...props, children },
      key: props?.key || null
    };
  }
}

// Logger interface
export interface Logger {
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Common utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type SafetyLevel = 'safe' | 'moderate' | 'unsafe';

export type AnalysisFormat = 'json' | 'table' | 'markdown';

export type HookType = 'sync' | 'async' | 'waterfall' | 'parallel';

export type PluginType = 'page' | 'component' | 'service' | 'middleware' | 'analysis';

// Error types
export class WundrError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WundrError';
  }
}

export class ConfigurationError extends WundrError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class SecurityError extends WundrError {
  constructor(message: string, details?: any) {
    super(message, 'SECURITY_ERROR', details);
    this.name = 'SecurityError';
  }
}

export class PluginError extends WundrError {
  constructor(message: string, details?: any) {
    super(message, 'PLUGIN_ERROR', details);
    this.name = 'PluginError';
  }
}