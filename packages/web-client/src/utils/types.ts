/**
 * @fileoverview Shared type definitions for utilities
 */

export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
    input: string;
    ring: string;
    destructive: string;
    warning: string;
    success: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeat?: {
    interval: number;
    message: string;
  };
}

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: number;
  id?: string;
}

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormState<T = any> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}