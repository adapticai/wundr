/**
 * Enterprise-grade TypeScript utility types to replace any usage
 * Provides type-safe alternatives to common patterns
 */

// Base utility types that replace any
export type SafeAny = Record<string, unknown>;
export type SafeFunction = (...args: readonly unknown[]) => unknown;
export type SafeAsyncFunction = (...args: readonly unknown[]) => Promise<unknown>;

// Object utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object | undefined ? DeepRequired<Required<T[P]>> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Type-safe object operations
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

// Function utility types
export type Parameters<T extends SafeFunction> = T extends (...args: infer P) => unknown ? P : never;
export type ReturnType<T extends SafeFunction> = T extends (...args: readonly unknown[]) => infer R ? R : unknown;

export type AsyncReturnType<T extends SafeAsyncFunction> = T extends (...args: readonly unknown[]) => Promise<infer R> ? R : unknown;

// Array utility types
export type NonEmptyArray<T> = [T, ...T[]];
export type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer E)[] ? E : never;
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];

// String utility types
export type StringLiteral<T> = T extends string ? string extends T ? never : T : never;
export type NonEmptyString<T extends string> = T extends '' ? never : T;

// Conditional type utilities
export type NonNullable<T> = T extends null | undefined ? never : T;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Union/intersection utilities
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

export type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

export type UnionToTuple<T> = UnionToIntersection<T extends unknown ? () => T : never> extends () => infer W ? [...UnionToTuple<Exclude<T, W>>, W] : [];

// Error handling types
export type Result<TData, TError = Error> =
  | { success: true; data: TData; error?: never }
  | { success: false; data?: never; error: TError };

export type AsyncResult<TData, TError = Error> = Promise<Result<TData, TError>>;

export type Maybe<T> = T | null | undefined;
export type Some<T> = NonNullable<T>;

// Type assertion helpers
export interface TypeGuard<T> {
  (value: unknown): value is T;
}

export interface TypeAssertion<T> {
  (value: unknown): asserts value is T;
}

// Branded types for type safety
export type Brand<T, TBrand> = T & { readonly __brand: TBrand };

export type UserId = Brand<string, 'UserId'>;
export type EmailAddress = Brand<string, 'EmailAddress'>;
export type Timestamp = Brand<number, 'Timestamp'>;
export type UUID = Brand<string, 'UUID'>;

// Factory functions for branded types
export const UserId = (value: string): UserId => value as UserId;
export const EmailAddress = (value: string): EmailAddress => value as EmailAddress;
export const Timestamp = (value: number): Timestamp => value as Timestamp;
export const UUID = (value: string): UUID => value as UUID;

// Configuration types
export interface ConfigurationValue {
  readonly value: unknown;
  readonly source: string;
  readonly isDefault: boolean;
  readonly lastUpdated: Date;
}

export type TypedConfig<T extends SafeAny> = {
  readonly [K in keyof T]: ConfigurationValue;
};

// Validation types
export interface ValidationRule<T> {
  readonly name: string;
  readonly validate: (value: T) => boolean;
  readonly message: string;
}

export type ValidationSchema<T extends SafeAny> = {
  readonly [K in keyof T]: ValidationRule<T[K]>[];
};

export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors: ValidationError[];
}

export interface ValidationError {
  readonly field: string;
  readonly value: unknown;
  readonly message: string;
  readonly rule: string;
}

// Event system types
export interface TypedEvent<TType extends string, TPayload extends SafeAny> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly timestamp: Date;
  readonly id: string;
  readonly source?: string;
}

export interface EventHandler<TEvent extends TypedEvent<string, SafeAny>> {
  (event: TEvent): void | Promise<void>;
}

export interface EventEmitter<TEventMap extends Record<string, TypedEvent<string, SafeAny>>> {
  on<TEventType extends keyof TEventMap>(type: TEventType, handler: EventHandler<TEventMap[TEventType]>): void;
  off<TEventType extends keyof TEventMap>(type: TEventType, handler: EventHandler<TEventMap[TEventType]>): void;
  emit<TEventType extends keyof TEventMap>(type: TEventType, payload: TEventMap[TEventType]['payload']): void;
}

// API types
export interface ApiEndpoint<TRequest extends SafeAny, TResponse> {
  readonly request: TRequest;
  readonly response: TResponse;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: SafeAny;
  readonly statusCode?: number;
}

export interface ApiResponse<TData> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: ApiError;
  readonly metadata?: SafeAny;
}

// Database/ORM types
export interface EntityBase {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreateInput<T extends EntityBase> = Omit<T, keyof EntityBase>;
export type UpdateInput<T extends EntityBase> = Partial<Omit<T, keyof EntityBase>>;

export interface Repository<TEntity extends EntityBase, TId = string> {
  findById(id: TId): Promise<TEntity | null>;
  findMany(query?: QueryOptions<TEntity>): Promise<TEntity[]>;
  create(data: CreateInput<TEntity>): Promise<TEntity>;
  update(id: TId, data: UpdateInput<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}

export interface QueryOptions<T> {
  readonly where?: Partial<T>;
  readonly orderBy?: { [K in keyof T]?: 'asc' | 'desc' };
  readonly skip?: number;
  readonly take?: number;
}

// Service layer types
export interface ServiceContext {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly requestId: string;
  readonly metadata: SafeAny;
}

export interface ServiceOperation<TInput, TOutput> {
  (input: TInput, context: ServiceContext): Promise<TOutput>;
}

// Logging types
export interface LogEntry {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly timestamp: Date;
  readonly data?: SafeAny;
  readonly context?: SafeAny;
}

export interface Logger {
  debug(message: string, data?: SafeAny): void;
  info(message: string, data?: SafeAny): void;
  warn(message: string, data?: SafeAny): void;
  error(message: string, data?: SafeAny): void;
  child(context: SafeAny): Logger;
}

// Memory and performance types
export interface MemoryMetrics {
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly external: number;
  readonly arrayBuffers: number;
}

export interface PerformanceMetrics {
  readonly duration: number;
  readonly memory: MemoryMetrics;
  readonly timestamp: Date;
  readonly operation: string;
}

// Cache types
export interface CacheEntry<T> {
  readonly value: T;
  readonly expireAt?: Date;
  readonly metadata?: SafeAny;
}

export interface CacheOptions {
  readonly ttl?: number;
  readonly tags?: string[];
  readonly priority?: number;
}

export interface Cache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// Testing types
export interface TestCase<TInput, TOutput> {
  readonly name: string;
  readonly input: TInput;
  readonly expectedOutput: TOutput;
  readonly setup?: () => Promise<void>;
  readonly teardown?: () => Promise<void>;
}

export interface MockFunction<TArgs extends readonly unknown[], TReturn> {
  (...args: TArgs): TReturn;
  mockReturnValue(value: TReturn): void;
  mockImplementation(fn: (...args: TArgs) => TReturn): void;
  calls: TArgs[];
  results: { type: 'return' | 'throw'; value: TReturn | Error }[];
}

// Type predicates and guards
export const isString = (value: unknown): value is string => typeof value === 'string';
export const isNumber = (value: unknown): value is number => typeof value === 'number' && !isNaN(value);
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const isObject = (value: unknown): value is SafeAny => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);
export const isFunction = (value: unknown): value is SafeFunction => typeof value === 'function';
export const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise;
export const isDate = (value: unknown): value is Date => value instanceof Date;
export const isError = (value: unknown): value is Error => value instanceof Error;

// Assertion functions
export const assertIsString = (value: unknown): asserts value is string => {
  if (!isString(value)) throw new TypeError('Expected string');
};

export const assertIsNumber = (value: unknown): asserts value is number => {
  if (!isNumber(value)) throw new TypeError('Expected number');
};

export const assertIsObject = (value: unknown): asserts value is SafeAny => {
  if (!isObject(value)) throw new TypeError('Expected object');
};

export const assertIsArray = (value: unknown): asserts value is readonly unknown[] => {
  if (!isArray(value)) throw new TypeError('Expected array');
};

export const assertIsFunction = (value: unknown): asserts value is SafeFunction => {
  if (!isFunction(value)) throw new TypeError('Expected function');
};

// Helper types for complex scenarios
export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

export type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in keyof T]: T[K] extends string
        ? [K]
        : T[K] extends object
        ? [K, ...PathsToStringProps<T[K]>]
        : never;
    }[keyof T];

export type Join<T extends readonly string[], D extends string> = T extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : '';

// Type-safe environment variable handling
export interface EnvironmentConfig {
  readonly [key: string]: string | undefined;
}

export type TypedEnvironmentConfig<T extends Record<string, unknown>> = {
  readonly [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : string;
};

// Export utility for easy imports
export type {
  SafeAny,
  SafeFunction,
  SafeAsyncFunction,
  DeepReadonly,
  DeepPartial,
  DeepRequired,
  Result,
  AsyncResult,
  Maybe,
  Some,
  Brand,
  TypeGuard,
  TypeAssertion,
  ValidationResult,
  ValidationError,
  ApiResponse,
  ApiError,
  EntityBase,
  Repository,
  ServiceContext,
  Logger,
  PerformanceMetrics,
  Cache,
  TestCase,
  MockFunction
};