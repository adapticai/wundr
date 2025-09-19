/**
 * Core type definitions for the Wundr platform
 */

export interface WundrError {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly timestamp: Date;
  readonly stack?: string;
  readonly context: Record<string, unknown> | undefined;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string | Error, meta?: Record<string, unknown>): void;
  child(defaultMeta: Record<string, unknown>): Logger;
  setLevel(level: string): void;
}

export interface EventBusEvent<TPayload = Record<string, unknown>> {
  readonly id: string;
  readonly type: string;
  readonly timestamp: Date;
  readonly payload: TPayload;
  readonly source?: string;
}

export interface EventHandler<TPayload = Record<string, unknown>> {
  (event: EventBusEvent<TPayload>): void | Promise<void>;
}

export interface EventBus {
  emit<TPayload = Record<string, unknown>>(
    type: string,
    payload: TPayload,
    source?: string
  ): void;
  on<TPayload = Record<string, unknown>>(
    type: string,
    handler: EventHandler<TPayload>
  ): () => void;
  off<TPayload = Record<string, unknown>>(
    type: string,
    handler: EventHandler<TPayload>
  ): void;
  once<TPayload = Record<string, unknown>>(
    type: string,
    handler: EventHandler<TPayload>
  ): void;
  removeAllListeners(type?: string): void;
}

export interface ValidationResult<TData = Record<string, unknown>> {
  success: boolean;
  data?: TData;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export interface UtilityFunction<
  TArgs extends readonly unknown[] = readonly unknown[],
  TReturn = unknown,
> {
  (...args: TArgs): TReturn;
}

export interface AsyncUtilityFunction<
  TArgs extends readonly unknown[] = readonly unknown[],
  TReturn = unknown,
> {
  (...args: TArgs): Promise<TReturn>;
}

// Generic result type for operations that can fail
export type Result<T, E = WundrError> =
  | { success: true; data: T }
  | { success: false; error: E };

// Common configuration interface
export interface BaseConfig {
  readonly version: string;
  readonly environment: 'development' | 'production' | 'test';
  readonly debug?: boolean;
}

// Event types for the event bus
export const CORE_EVENTS = {
  ERROR_OCCURRED: 'core:error:occurred',
  CONFIG_CHANGED: 'core:config:changed',
  LOG_MESSAGE: 'core:log:message',
  VALIDATION_FAILED: 'core:validation:failed',
} as const;

export type CoreEventType = (typeof CORE_EVENTS)[keyof typeof CORE_EVENTS];

// Enhanced type system for enterprise patterns
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export interface JsonArray extends ReadonlyArray<JsonValue> {}

// Metadata types for extensible objects
export interface MetadataContainer {
  readonly metadata: JsonObject;
}

// Configuration interfaces
export interface ComponentConfiguration {
  readonly enabled: boolean;
  readonly options: JsonObject;
  readonly version?: string;
}

// Service base interfaces
export interface Service {
  readonly name: string;
  readonly version: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<ServiceHealthStatus>;
}

export interface ServiceHealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: Date;
  readonly details: JsonObject;
  readonly dependencies: readonly DependencyHealth[];
}

export interface DependencyHealth {
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly responseTime?: number;
  readonly lastCheck: Date;
  readonly error?: string;
}

// Enterprise audit types
export interface AuditableOperation {
  readonly operationId: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly timestamp: Date;
  readonly operation: string;
  readonly resource: string;
  readonly changes?: readonly AuditChange[];
  readonly metadata: JsonObject;
}

export interface AuditChange {
  readonly field: string;
  readonly oldValue: JsonValue;
  readonly newValue: JsonValue;
  readonly changeType: 'create' | 'update' | 'delete';
}

// Security and access control
export interface SecurityContext {
  readonly principal: Principal;
  readonly permissions: readonly Permission[];
  readonly sessionId: string;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
}

export interface Principal {
  readonly id: string;
  readonly type: 'user' | 'service' | 'system';
  readonly name: string;
  readonly roles: readonly string[];
  readonly attributes: JsonObject;
}

export interface Permission {
  readonly resource: string;
  readonly actions: readonly string[];
  readonly conditions?: JsonObject;
}

// Data processing types
export interface ProcessingResult<TData = JsonValue> {
  readonly success: boolean;
  readonly data?: TData;
  readonly errors: readonly ProcessingError[];
  readonly warnings: readonly ProcessingWarning[];
  readonly metadata: JsonObject;
  readonly processingTime: number;
}

export interface ProcessingError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly value?: JsonValue;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProcessingWarning {
  readonly code: string;
  readonly message: string;
  readonly suggestion?: string;
}

// Typed configuration management
export interface TypedConfiguration<TSchema = JsonObject> {
  readonly schema: TSchema;
  readonly version: string;
  readonly environment: string;
  readonly sources: readonly ConfigurationSource[];
  readonly validatedAt: Date;
}

export interface ConfigurationSource {
  readonly name: string;
  readonly type: 'file' | 'environment' | 'remote' | 'database';
  readonly priority: number;
  readonly lastLoaded: Date;
}

// Re-export specific utility types to avoid conflicts
export type {
  SafeAny,
  SafeFunction,
  SafeAsyncFunction,
  DeepReadonly,
  DeepPartial,
  DeepRequired,
  OptionalFields,
  RequiredFields,
  Result as UtilityResult,
  AsyncResult,
  Maybe,
  Some,
  Brand,
  TypeGuard,
  TypeAssertion,
  UserId,
  EmailAddress,
  Timestamp,
  UUID,
} from './utility-types.js';

// Re-export web client types
export type {
  ChartDataPoint,
  ChartDataset,
  ChartConfiguration,
  DashboardMetrics as WebDashboardMetrics,
  FileItem,
  ProjectInfo,
  AnalysisReport as WebAnalysisReport,
  AnalysisResults as WebAnalysisResults,
  TableColumn,
  TableProps,
  FormField,
  FormProps,
  NavigationItem,
  ThemeConfig,
  NotificationConfig,
} from './web-client-types.js';
