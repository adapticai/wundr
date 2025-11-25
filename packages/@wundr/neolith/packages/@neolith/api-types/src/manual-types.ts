/**
 * @genesis/api-types - Manual TypeScript Types
 *
 * This file contains TypeScript types that are not generated from the GraphQL schema.
 * These include utility types, API client types, and other application-specific types.
 */

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Make all properties in T optional except for K
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> &
  Pick<T, K>;

/**
 * Make specific properties K in T required
 */
export type RequireFields<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

/**
 * Extract the element type from an array type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Make a type deeply partial
 */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Make a type deeply readonly
 */
export type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

/**
 * Extract non-nullable type
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Create a union type from object values
 */
export type ValueOf<T> = T[keyof T];

// =============================================================================
// API CLIENT TYPES
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  errors: ApiError[];
  meta: ApiResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  duration: number;
}

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * Sorting parameters
 */
export interface SortParams<T extends string = string> {
  field: T;
  direction: 'ASC' | 'DESC';
}

/**
 * Generic list query parameters
 */
export interface ListQueryParams<
  TFilter = Record<string, unknown>,
  TSortField extends string = string,
> {
  pagination?: PaginationParams;
  filter?: TFilter;
  sort?: SortParams<TSortField>[];
}

// =============================================================================
// AUTHENTICATION TYPES
// =============================================================================

/**
 * JWT token payload structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * Authentication tokens response
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: 'Bearer';
}

/**
 * Current user session
 */
export interface UserSession {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  workspaces: string[];
  isAuthenticated: boolean;
}

// =============================================================================
// SUBSCRIPTION TYPES
// =============================================================================

/**
 * WebSocket connection state
 */
export type WebSocketConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/**
 * Subscription event base type
 */
export interface SubscriptionEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: string;
}

// =============================================================================
// FORM TYPES
// =============================================================================

/**
 * Form field validation result
 */
export interface FieldValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Form state type
 */
export interface FormState<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string[]>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

// =============================================================================
// OPERATION RESULT TYPES
// =============================================================================

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async operation status
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Async data wrapper
 */
export interface AsyncData<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

// =============================================================================
// ENVIRONMENT & CONFIGURATION TYPES
// =============================================================================

/**
 * Application environment
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * API configuration
 */
export interface ApiConfig {
  baseUrl: string;
  graphqlEndpoint: string;
  wsEndpoint: string;
  timeout: number;
  retryAttempts: number;
}

/**
 * Feature flags type
 */
export interface FeatureFlags {
  [key: string]: boolean | string | number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if an API response has errors
 */
export function hasErrors<T>(response: ApiResponse<T>): boolean {
  return response.errors.length > 0;
}

/**
 * Type guard to check if a result is successful
 */
export function isSuccess<T, E>(
  result: Result<T, E>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if a result is an error
 */
export function isError<T, E>(
  result: Result<T, E>
): result is { success: false; error: E } {
  return result.success === false;
}
