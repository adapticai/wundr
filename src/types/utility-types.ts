/**
 * Enterprise-grade TypeScript utility types - replaces all 'any' with proper typing
 */

// Generic constraint types
export type NonNullable<T> = T extends null | undefined ? never : T;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// Object utility types with proper constraints
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type PickByType<T, U> = Pick<T, {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T]>;

export type OmitByType<T, U> = Omit<T, {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T]>;

// Function utility types with proper constraints
export type AsyncFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown> =
  (...args: TArgs) => Promise<TReturn>;

export type SyncFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown> =
  (...args: TArgs) => TReturn;

export type AnyFunction<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown> =
  SyncFunction<TArgs, TReturn> | AsyncFunction<TArgs, TReturn>;

export type ExtractFunctionArgs<T> = T extends (...args: infer A) => unknown ? A : never;
export type ExtractFunctionReturn<T> = T extends (...args: readonly unknown[]) => infer R ? R : never;

// Array utility types
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never;
export type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;

export type NonEmptyArray<T> = readonly [T, ...T[]];
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

// String utility types
export type StringLiteral<T> = T extends string ? string extends T ? never : T : never;
export type Split<S extends string, D extends string> =
  S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

export type Join<T extends readonly string[], D extends string> =
  T extends readonly [infer F, ...infer R]
    ? F extends string
      ? R extends readonly string[]
        ? R['length'] extends 0
          ? F
          : `${F}${D}${Join<R, D>}`
        : never
      : never
    : '';

export type Capitalize<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S;

export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<CamelCase<`${P2}${P3}`>>}`
  : S;

export type KebabCase<S extends string> = S extends `${infer C}${infer T}`
  ? `${C extends Capitalize<C> ? '-' : ''}${Lowercase<C>}${KebabCase<T>}`
  : S;

// Branded types for type safety
export type Brand<T, B> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type AnalysisId = Brand<string, 'AnalysisId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type RequestId = Brand<string, 'RequestId'>;

export type PositiveNumber = Brand<number, 'PositiveNumber'>;
export type NonNegativeNumber = Brand<number, 'NonNegativeNumber'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Timestamp = Brand<number, 'Timestamp'>;

// Type guard utilities
export type TypeGuard<T> = (value: unknown) => value is T;
export type AssertionFunction<T> = (value: unknown) => asserts value is T;

// Configuration types
export interface TypedConfiguration<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly [K in keyof T]: T[K];
}

export type ConfigurationSchema<T> = {
  readonly [K in keyof T]: {
    readonly type: TypeName<T[K]>;
    readonly required: boolean;
    readonly default?: T[K];
    readonly validation?: ValidationRule<T[K]>;
  };
};

export type TypeName<T> =
  T extends string ? 'string' :
  T extends number ? 'number' :
  T extends boolean ? 'boolean' :
  T extends readonly unknown[] ? 'array' :
  T extends object ? 'object' :
  'unknown';

export interface ValidationRule<T> {
  readonly validator: (value: T) => boolean;
  readonly message: string;
}

// Event system types
export interface TypedEventEmitter<TEvents extends Record<string, readonly unknown[]>> {
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  once<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): this;
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): boolean;
  removeAllListeners<K extends keyof TEvents>(event?: K): this;
  listenerCount<K extends keyof TEvents>(event: K): number;
  listeners<K extends keyof TEvents>(event: K): Array<(...args: TEvents[K]) => void>;
}

export type EventMap = Record<string, readonly unknown[]>;

// Cache types with proper constraints
export interface TypedCache<TKey extends string | number, TValue> {
  get(key: TKey): TValue | undefined;
  set(key: TKey, value: TValue, ttl?: number): void;
  has(key: TKey): boolean;
  delete(key: TKey): boolean;
  clear(): void;
  size(): number;
  keys(): readonly TKey[];
  values(): readonly TValue[];
  entries(): readonly [TKey, TValue][];
}

export interface CacheOptions {
  readonly maxSize?: number;
  readonly defaultTtl?: number;
  readonly onEviction?: <K, V>(key: K, value: V) => void;
}

// Registry pattern with type safety
export interface TypedRegistry<TKey extends string, TValue> {
  register(key: TKey, value: TValue): void;
  unregister(key: TKey): boolean;
  get(key: TKey): TValue | undefined;
  has(key: TKey): boolean;
  keys(): readonly TKey[];
  values(): readonly TValue[];
  entries(): readonly [TKey, TValue][];
  clear(): void;
  size(): number;
}

// Factory pattern types
export type Factory<T, TArgs extends readonly unknown[] = readonly []> = (...args: TArgs) => T;
export type AsyncFactory<T, TArgs extends readonly unknown[] = readonly []> = (...args: TArgs) => Promise<T>;

export interface FactoryRegistry<T> {
  register<TArgs extends readonly unknown[]>(
    key: string,
    factory: Factory<T, TArgs>
  ): void;
  create<TArgs extends readonly unknown[]>(
    key: string,
    ...args: TArgs
  ): T;
  has(key: string): boolean;
  unregister(key: string): boolean;
}

// Plugin system types with proper constraints
export interface TypedPlugin<TConfig = Record<string, unknown>, TApi = Record<string, unknown>> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly string[];

  configure(config: TConfig): void | Promise<void>;
  initialize(): void | Promise<void>;
  activate(): void | Promise<void>;
  deactivate(): void | Promise<void>;
  getApi(): TApi;
}

export interface PluginManager<TPlugin extends TypedPlugin> {
  register(plugin: TPlugin): void;
  unregister(id: string): boolean;
  get(id: string): TPlugin | undefined;
  getApi<T = Record<string, unknown>>(id: string): T | undefined;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
  list(): readonly TPlugin[];
  isActive(id: string): boolean;
}

// Serialization types
export type Serializable =
  | string
  | number
  | boolean
  | null
  | readonly Serializable[]
  | { readonly [key: string]: Serializable };

export interface Serializer<T, S extends Serializable = Serializable> {
  serialize(value: T): S;
  deserialize(serialized: S): T;
}

// State management types
export type StateReducer<TState, TAction> = (state: TState, action: TAction) => TState;

export interface TypedStore<TState, TAction> {
  getState(): TState;
  dispatch(action: TAction): void;
  subscribe(listener: (state: TState) => void): () => void;
}

export interface StoreEnhancer<TState, TAction> {
  (store: TypedStore<TState, TAction>): TypedStore<TState, TAction>;
}

// Middleware types
export type Middleware<TContext, TNext = () => void | Promise<void>> =
  (context: TContext, next: TNext) => void | Promise<void>;

export interface MiddlewareStack<TContext> {
  use(middleware: Middleware<TContext>): this;
  execute(context: TContext): Promise<void>;
}

// Validation types with proper constraints
export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors: readonly ValidationError[];
}

export interface ValidationError {
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly code: string;
}

export interface Validator<T> {
  validate(value: unknown): ValidationResult<T>;
  validateAsync(value: unknown): Promise<ValidationResult<T>>;
}

// Schema types
export type Schema<T> = {
  readonly [K in keyof T]: FieldSchema<T[K]>;
};

export interface FieldSchema<T> {
  readonly type: TypeName<T>;
  readonly required?: boolean;
  readonly default?: T;
  readonly validators?: readonly Validator<T>[];
}

// Service types with dependency injection
export interface ServiceDefinition<T = unknown> {
  readonly id: string;
  readonly factory: Factory<T>;
  readonly dependencies?: readonly string[];
  readonly singleton?: boolean;
}

export interface ServiceContainer {
  register<T>(definition: ServiceDefinition<T>): void;
  resolve<T>(id: string): T;
  has(id: string): boolean;
  unregister(id: string): boolean;
}

// Repository pattern types
export interface TypedRepository<TEntity, TId extends string | number> {
  findById(id: TId): Promise<TEntity | null>;
  findAll(): Promise<readonly TEntity[]>;
  save(entity: TEntity): Promise<TEntity>;
  update(id: TId, updates: Partial<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<boolean>;
  exists(id: TId): Promise<boolean>;
  count(): Promise<number>;
}

export interface QueryBuilder<TEntity> {
  where(field: keyof TEntity, operator: ComparisonOperator, value: unknown): this;
  orderBy(field: keyof TEntity, direction?: 'asc' | 'desc'): this;
  limit(count: number): this;
  offset(count: number): this;
  execute(): Promise<readonly TEntity[]>;
}

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in' | 'like' | 'not_like';

// Command/Query pattern types
export interface Command<TResult = void> {
  readonly type: string;
  execute(): Promise<TResult>;
}

export interface Query<TResult> {
  readonly type: string;
  execute(): Promise<TResult>;
}

export interface CommandHandler<TCommand extends Command, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
}

export interface QueryHandler<TQuery extends Query<TResult>, TResult> {
  handle(query: TQuery): Promise<TResult>;
}

// Observer pattern types
export interface Observer<T> {
  update(data: T): void | Promise<void>;
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): () => void;
  unsubscribe(observer: Observer<T>): void;
  notify(data: T): Promise<void>;
}

// Strategy pattern types
export interface Strategy<TInput, TOutput> {
  execute(input: TInput): TOutput | Promise<TOutput>;
}

export interface StrategyRegistry<TInput, TOutput> {
  register(key: string, strategy: Strategy<TInput, TOutput>): void;
  execute(key: string, input: TInput): Promise<TOutput>;
  has(key: string): boolean;
  unregister(key: string): boolean;
}

// Utility functions for type checking
export const isString = (value: unknown): value is string => typeof value === 'string';
export const isNumber = (value: unknown): value is number => typeof value === 'number' && !isNaN(value);
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isArray = <T>(value: unknown): value is readonly T[] => Array.isArray(value);
export const isNull = (value: unknown): value is null => value === null;
export const isUndefined = (value: unknown): value is undefined => value === undefined;
export const isNullish = (value: unknown): value is null | undefined => value == null;
export const isFunction = (value: unknown): value is AnyFunction => typeof value === 'function';

// Branded type utilities
export const createBrand = <T, B>(value: T): Brand<T, B> => value as Brand<T, B>;
export const unwrapBrand = <T, B>(branded: Brand<T, B>): T => branded as T;

// Type assertion utilities
export const assertString = (value: unknown): asserts value is string => {
  if (!isString(value)) {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
};

export const assertNumber = (value: unknown): asserts value is number => {
  if (!isNumber(value)) {
    throw new TypeError(`Expected number, got ${typeof value}`);
  }
};

export const assertObject = (value: unknown): asserts value is Record<string, unknown> => {
  if (!isObject(value)) {
    throw new TypeError(`Expected object, got ${typeof value}`);
  }
};

export const assertArray = <T>(value: unknown): asserts value is readonly T[] => {
  if (!isArray(value)) {
    throw new TypeError(`Expected array, got ${typeof value}`);
  }
};

// Configuration validation utilities
export const validateConfiguration = <T extends Record<string, unknown>>(
  config: unknown,
  schema: ConfigurationSchema<T>
): ValidationResult<T> => {
  const errors: ValidationError[] = [];

  if (!isObject(config)) {
    return {
      success: false,
      errors: [{ path: [], message: 'Configuration must be an object', code: 'INVALID_TYPE' }]
    };
  }

  const result = {} as T;

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const value = config[key];

    if (fieldSchema.required && (value === undefined || value === null)) {
      errors.push({
        path: [key],
        message: `Field '${key}' is required`,
        code: 'REQUIRED_FIELD'
      });
      continue;
    }

    if (value !== undefined && value !== null) {
      // Type validation would go here
      (result as Record<string, unknown>)[key] = value;
    } else if (fieldSchema.default !== undefined) {
      (result as Record<string, unknown>)[key] = fieldSchema.default;
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? result : undefined,
    errors
  };
};

// Deep clone utility with proper typing
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
};