/**
 * Enterprise-grade TypeScript type guards and assertion functions
 * Provides runtime type safety for all major types in the system
 */

import {
  WorkflowValue,
  WorkflowError,
  TypedStepExecutionResult,
  TypedWorkflowContext,
  TypedWorkflow
} from './workflow-types';

import {
  ApiValue,
  ApiResponse,
  AnalysisApiData,
  AuthenticatedUser,
  Permission,
  UserRole
} from './api-types';

import {
  TestValue,
  TestResponse,
  TestContext,
  ValidationResult
} from './test-types';

import {
  TypedBaseError,
  ErrorCategory,
  ErrorContext
} from './error-types';

// Base type guards
export const isString = (value: unknown): value is string =>
  typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !isNaN(value) && isFinite(value);

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export const isNull = (value: unknown): value is null =>
  value === null;

export const isUndefined = (value: unknown): value is undefined =>
  value === undefined;

export const isNullish = (value: unknown): value is null | undefined =>
  value == null;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = <T>(value: unknown): value is readonly T[] =>
  Array.isArray(value);

export const isFunction = (value: unknown): value is Function =>
  typeof value === 'function';

export const isDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime());

export const isRegExp = (value: unknown): value is RegExp =>
  value instanceof RegExp;

export const isError = (value: unknown): value is Error =>
  value instanceof Error;

export const isPromise = <T = unknown>(value: unknown): value is Promise<T> =>
  typeof value === 'object' && value !== null && 'then' in value && isFunction((value as any).then);

// Primitive value guards
export const isStringArray = (value: unknown): value is readonly string[] =>
  isArray(value) && value.every(isString);

export const isNumberArray = (value: unknown): value is readonly number[] =>
  isArray(value) && value.every(isNumber);

export const isBooleanArray = (value: unknown): value is readonly boolean[] =>
  isArray(value) && value.every(isBoolean);

export const isStringRecord = (value: unknown): value is Record<string, string> =>
  isObject(value) && Object.values(value).every(isString);

export const isNumberRecord = (value: unknown): value is Record<string, number> =>
  isObject(value) && Object.values(value).every(isNumber);

// Workflow type guards
export const isWorkflowValue = (value: unknown): value is WorkflowValue => {
  if (isNull(value) || isString(value) || isNumber(value) || isBoolean(value)) {
    return true;
  }
  if (isArray(value)) {
    return value.every(isWorkflowValue);
  }
  if (isObject(value)) {
    return Object.values(value).every(isWorkflowValue);
  }
  return false;
};

export const isWorkflowError = (value: unknown): value is WorkflowError => {
  return (
    isObject(value) &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value &&
    'retryable' in value &&
    'category' in value &&
    isString(value.code) &&
    isString(value.message) &&
    isNumber(value.timestamp) &&
    isBoolean(value.retryable) &&
    isString(value.category)
  );
};

export const isTypedStepExecutionResult = (value: unknown): value is TypedStepExecutionResult => {
  return (
    isObject(value) &&
    'stepId' in value &&
    'success' in value &&
    'executionTime' in value &&
    'retryCount' in value &&
    'timestamp' in value &&
    isString(value.stepId) &&
    isBoolean(value.success) &&
    isNumber(value.executionTime) &&
    isNumber(value.retryCount) &&
    isNumber(value.timestamp)
  );
};

export const isTypedWorkflowContext = (value: unknown): value is TypedWorkflowContext => {
  return (
    isObject(value) &&
    'executionId' in value &&
    'variables' in value &&
    'stepResults' in value &&
    'metadata' in value &&
    isString(value.executionId) &&
    isObject(value.variables) &&
    isObject(value.stepResults) &&
    isObject(value.metadata)
  );
};

export const isTypedWorkflow = (value: unknown): value is TypedWorkflow => {
  return (
    isObject(value) &&
    'id' in value &&
    'name' in value &&
    'description' in value &&
    'steps' in value &&
    'metadata' in value &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.description) &&
    isArray(value.steps) &&
    isObject(value.metadata)
  );
};

// API type guards
export const isApiValue = (value: unknown): value is ApiValue => {
  if (isNull(value) || isString(value) || isNumber(value) || isBoolean(value)) {
    return true;
  }
  if (isArray(value)) {
    return value.every(isApiValue);
  }
  if (isObject(value)) {
    return Object.values(value).every(isApiValue);
  }
  return false;
};

export const isApiResponse = <T = ApiValue>(value: unknown): value is ApiResponse<T> => {
  return (
    isObject(value) &&
    'success' in value &&
    isBoolean(value.success)
  );
};

export const isAnalysisApiData = (value: unknown): value is AnalysisApiData => {
  return (
    isObject(value) &&
    'id' in value &&
    'projectId' in value &&
    'summary' in value &&
    'entities' in value &&
    'issues' in value &&
    'duplicates' in value &&
    'recommendations' in value &&
    'dependencyGraph' in value &&
    'metrics' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    isString(value.id) &&
    isString(value.projectId) &&
    isObject(value.summary) &&
    isArray(value.entities) &&
    isArray(value.issues) &&
    isArray(value.duplicates) &&
    isArray(value.recommendations) &&
    isObject(value.dependencyGraph) &&
    isObject(value.metrics) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
};

export const isAuthenticatedUser = (value: unknown): value is AuthenticatedUser => {
  return (
    isObject(value) &&
    'id' in value &&
    'email' in value &&
    'role' in value &&
    'permissions' in value &&
    'sessionId' in value &&
    'lastActivity' in value &&
    isString(value.id) &&
    isString(value.email) &&
    isString(value.role) &&
    isArray(value.permissions) &&
    isString(value.sessionId) &&
    isString(value.lastActivity)
  );
};

export const isUserRole = (value: unknown): value is UserRole => {
  return isString(value) && Object.values(UserRole).includes(value as UserRole);
};

export const isPermission = (value: unknown): value is Permission => {
  return isString(value) && Object.values(Permission).includes(value as Permission);
};

// Test type guards
export const isTestValue = (value: unknown): value is TestValue => {
  if (isNull(value) || isString(value) || isNumber(value) || isBoolean(value)) {
    return true;
  }
  if (isArray(value)) {
    return value.every(isTestValue);
  }
  if (isObject(value)) {
    return Object.values(value).every(isTestValue);
  }
  return false;
};

export const isTestResponse = (value: unknown): value is TestResponse => {
  return (
    isObject(value) &&
    'status' in value &&
    'headers' in value &&
    'data' in value &&
    'duration' in value &&
    'size' in value &&
    isNumber(value.status) &&
    isObject(value.headers) &&
    isTestValue(value.data) &&
    isNumber(value.duration) &&
    isNumber(value.size)
  );
};

export const isTestContext = (value: unknown): value is TestContext => {
  return (
    isObject(value) &&
    'database' in value &&
    'server' in value &&
    'mocks' in value &&
    'environment' in value &&
    'cleanup' in value &&
    isObject(value.database) &&
    isObject(value.server) &&
    isObject(value.mocks) &&
    isObject(value.environment) &&
    isObject(value.cleanup)
  );
};

export const isValidationResult = (value: unknown): value is ValidationResult => {
  return (
    isObject(value) &&
    'valid' in value &&
    'errors' in value &&
    isBoolean(value.valid) &&
    isArray(value.errors)
  );
};

// Error type guards
export const isTypedBaseError = (value: unknown): value is TypedBaseError => {
  return value instanceof TypedBaseError;
};

export const isErrorCategory = (value: unknown): value is ErrorCategory => {
  return isString(value) && Object.values(ErrorCategory).includes(value as ErrorCategory);
};

export const isErrorContext = (value: unknown): value is ErrorContext => {
  return isObject(value) && Object.values(value).every(val => {
    if (isNull(val) || isString(val) || isNumber(val) || isBoolean(val)) {
      return true;
    }
    if (isArray(val)) {
      return val.every(isErrorContext);
    }
    if (isObject(val)) {
      return isErrorContext(val);
    }
    return false;
  });
};

// HTTP status code guards
export const isSuccessStatusCode = (code: number): boolean =>
  code >= 200 && code < 300;

export const isClientErrorStatusCode = (code: number): boolean =>
  code >= 400 && code < 500;

export const isServerErrorStatusCode = (code: number): boolean =>
  code >= 500 && code < 600;

export const isRedirectStatusCode = (code: number): boolean =>
  code >= 300 && code < 400;

// URL and email validation guards
export const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const isValidEmail = (value: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};

export const isValidUuid = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// JSON validation guards
export const isValidJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

export const parseJsonSafeSimple = <T = unknown>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

// Environment guards
export const isDevelopment = (): boolean =>
  process.env.NODE_ENV === 'development';

export const isProduction = (): boolean =>
  process.env.NODE_ENV === 'production';

export const isTest = (): boolean =>
  process.env.NODE_ENV === 'test';

// Assertion functions
export const assertString = (value: unknown, name = 'value'): asserts value is string => {
  if (!isString(value)) {
    throw new TypeError(`Expected ${name} to be a string, got ${typeof value}`);
  }
};

export const assertNumber = (value: unknown, name = 'value'): asserts value is number => {
  if (!isNumber(value)) {
    throw new TypeError(`Expected ${name} to be a number, got ${typeof value}`);
  }
};

export const assertBoolean = (value: unknown, name = 'value'): asserts value is boolean => {
  if (!isBoolean(value)) {
    throw new TypeError(`Expected ${name} to be a boolean, got ${typeof value}`);
  }
};

export const assertObject = (value: unknown, name = 'value'): asserts value is Record<string, unknown> => {
  if (!isObject(value)) {
    throw new TypeError(`Expected ${name} to be an object, got ${typeof value}`);
  }
};

export const assertArray = <T>(value: unknown, name = 'value'): asserts value is readonly T[] => {
  if (!isArray(value)) {
    throw new TypeError(`Expected ${name} to be an array, got ${typeof value}`);
  }
};

export const assertNotNull = <T>(value: T | null, name = 'value'): asserts value is T => {
  if (value === null) {
    throw new Error(`Expected ${name} to not be null`);
  }
};

export const assertNotUndefined = <T>(value: T | undefined, name = 'value'): asserts value is T => {
  if (value === undefined) {
    throw new Error(`Expected ${name} to not be undefined`);
  }
};

export const assertNotNullish = <T>(value: T | null | undefined, name = 'value'): asserts value is T => {
  if (value == null) {
    throw new Error(`Expected ${name} to not be null or undefined`);
  }
};

export const assertWorkflowValue = (value: unknown, name = 'value'): asserts value is WorkflowValue => {
  if (!isWorkflowValue(value)) {
    throw new TypeError(`Expected ${name} to be a valid workflow value`);
  }
};

export const assertApiValue = (value: unknown, name = 'value'): asserts value is ApiValue => {
  if (!isApiValue(value)) {
    throw new TypeError(`Expected ${name} to be a valid API value`);
  }
};

export const assertTestValue = (value: unknown, name = 'value'): asserts value is TestValue => {
  if (!isTestValue(value)) {
    throw new TypeError(`Expected ${name} to be a valid test value`);
  }
};

export const assertValidUrl = (value: string, name = 'URL'): asserts value is string => {
  if (!isValidUrl(value)) {
    throw new Error(`Expected ${name} to be a valid URL: ${value}`);
  }
};

export const assertValidEmail = (value: string, name = 'email'): asserts value is string => {
  if (!isValidEmail(value)) {
    throw new Error(`Expected ${name} to be a valid email: ${value}`);
  }
};

export const assertValidUuid = (value: string, name = 'UUID'): asserts value is string => {
  if (!isValidUuid(value)) {
    throw new Error(`Expected ${name} to be a valid UUID: ${value}`);
  }
};

export const assertPositiveNumber: (value: number, name?: string) => asserts value is number = (value: number, name = 'value') => {
  assertNumber(value, name);
  if (value <= 0) {
    throw new Error(`Expected ${name} to be positive, got ${value}`);
  }
};

export const assertNonNegativeNumber: (value: number, name?: string) => asserts value is number = (value: number, name = 'value') => {
  assertNumber(value, name);
  if (value < 0) {
    throw new Error(`Expected ${name} to be non-negative, got ${value}`);
  }
};

export const assertInRange: (value: number, min: number, max: number, name?: string) => asserts value is number = (
  value: number,
  min: number,
  max: number,
  name = 'value'
) => {
  assertNumber(value, name);
  if (value < min || value > max) {
    throw new Error(`Expected ${name} to be between ${min} and ${max}, got ${value}`);
  }
};

export const assertMinLength = (
  value: string | readonly unknown[],
  minLength: number,
  name = 'value'
): void => {
  if (value.length < minLength) {
    throw new Error(`Expected ${name} to have at least ${minLength} characters/items, got ${value.length}`);
  }
};

export const assertMaxLength = (
  value: string | readonly unknown[],
  maxLength: number,
  name = 'value'
): void => {
  if (value.length > maxLength) {
    throw new Error(`Expected ${name} to have at most ${maxLength} characters/items, got ${value.length}`);
  }
};

export const assertOneOf = <T>(
  value: T,
  allowedValues: readonly T[],
  name = 'value'
): asserts value is T => {
  if (!allowedValues.includes(value)) {
    throw new Error(`Expected ${name} to be one of [${allowedValues.join(', ')}], got ${value}`);
  }
};

export const assertInstanceOf = <T>(
  value: unknown,
  constructor: new (...args: readonly unknown[]) => T,
  name = 'value'
): asserts value is T => {
  if (!(value instanceof constructor)) {
    throw new TypeError(`Expected ${name} to be an instance of ${constructor.name}`);
  }
};

// Safe parsing utilities with enhanced error handling
export const safeParseInt = (value: string | number | unknown, defaultValue = 0): number => {
  if (isNumber(value)) return Math.floor(value);
  if (!isString(value)) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const safeParseFloat = (value: string | number | unknown, defaultValue = 0): number => {
  if (isNumber(value)) return value;
  if (!isString(value)) return defaultValue;

  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const safeParseBoolean = (value: string | boolean | unknown, defaultValue = false): boolean => {
  if (isBoolean(value)) return value;
  if (!isString(value)) return defaultValue;

  const lowercased = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(lowercased)) {
    return true;
  }
  if (['false', '0', 'no', 'off', 'disabled'].includes(lowercased)) {
    return false;
  }
  return defaultValue;
};

export const safeParseJson = <T>(
  value: string | unknown,
  defaultValue: T,
  validator?: (parsed: unknown) => parsed is T
): T => {
  if (!isString(value)) return defaultValue;

  try {
    const parsed = JSON.parse(value);
    if (validator && !validator(parsed)) {
      return defaultValue;
    }
    return parsed as T;
  } catch {
    return defaultValue;
  }
};

// Enhanced JSON utilities with type safety
export const parseJsonSafe = <T = unknown>(value: string): { success: true; data: T } | { success: false; error: string } => {
  if (!isString(value)) {
    return { success: false, error: 'Input is not a string' };
  }

  try {
    const data = JSON.parse(value) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown JSON parsing error'
    };
  }
};

export const stringifyJsonSafe = (value: unknown): { success: true; data: string } | { success: false; error: string } => {
  try {
    const data = JSON.stringify(value);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown JSON stringify error'
    };
  }
};

// Validation utilities
export const validateRequired = <T>(value: T | null | undefined, name: string): T => {
  if (value == null) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const validateStringLength: (value: string, minLength: number, maxLength?: number, name?: string) => string = (
  value: string,
  minLength: number,
  maxLength?: number,
  name = 'value'
) => {
  assertString(value, name);
  assertMinLength(value, minLength, name);
  if (maxLength !== undefined) {
    assertMaxLength(value, maxLength, name);
  }
  return value;
};

export const validateNumberRange: (value: number, min?: number, max?: number, name?: string) => number = (
  value: number,
  min?: number,
  max?: number,
  name = 'value'
) => {
  assertNumber(value, name);
  if (min !== undefined && value < min) {
    throw new Error(`${name} must be at least ${min}, got ${value}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${name} must be at most ${max}, got ${value}`);
  }
  return value;
};

export const validateArrayLength = <T>(
  value: readonly T[],
  minLength: number,
  maxLength?: number,
  name = 'array'
): readonly T[] => {
  assertArray(value, name);
  assertMinLength(value, minLength, name);
  if (maxLength !== undefined) {
    assertMaxLength(value, maxLength, name);
  }
  return value;
};

// Type narrowing utilities
export const narrowToString = (value: unknown): string | null =>
  isString(value) ? value : null;

export const narrowToNumber = (value: unknown): number | null =>
  isNumber(value) ? value : null;

export const narrowToBoolean = (value: unknown): boolean | null =>
  isBoolean(value) ? value : null;

export const narrowToObject = (value: unknown): Record<string, unknown> | null =>
  isObject(value) ? value : null;

export const narrowToArray = <T>(value: unknown): readonly T[] | null =>
  isArray<T>(value) ? value : null;

// Conditional type guards
export const createTypeGuard = <T>(
  predicate: (value: unknown) => boolean
): ((value: unknown) => value is T) => {
  return (value: unknown): value is T => predicate(value);
};

export const createAssertion = <T>(
  typeGuard: (value: unknown) => value is T,
  errorMessage: string
) => {
  return (value: unknown): asserts value is T => {
    if (!typeGuard(value)) {
      throw new TypeError(errorMessage);
    }
  };
};

// Complex validation combinations
export const isNonEmptyString = (value: unknown): value is string =>
  isString(value) && value.length > 0;

export const isNonEmptyArrayTyped = <T>(value: unknown): value is readonly [T, ...T[]] =>
  isArray<T>(value) && value.length > 0;

export const isPositiveNumber = (value: unknown): value is number =>
  isNumber(value) && value > 0;

export const isNonNegativeNumber = (value: unknown): value is number =>
  isNumber(value) && value >= 0;

export const isIntegerNumber = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value);

export const isFiniteNumber = (value: unknown): value is number =>
  isNumber(value) && Number.isFinite(value);

export const isValidPort = (value: unknown): value is number =>
  isIntegerNumber(value) && value >= 1 && value <= 65535;

export const isValidPercentage = (value: unknown): value is number =>
  isNumber(value) && value >= 0 && value <= 100;

// Advanced object type guards
export const hasOwnProperty = <T extends object, K extends PropertyKey>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};

export const hasProperties = <T extends object, K extends PropertyKey>(
  obj: T,
  keys: readonly K[]
): obj is T & Record<K, unknown> => {
  return keys.every(key => hasOwnProperty(obj, key));
};

export const isObjectWithKeys = <K extends PropertyKey>(
  value: unknown,
  keys: readonly K[]
): value is Record<K, unknown> => {
  return isObject(value) && hasProperties(value, keys);
};

// Safe object property access
export const getProperty = <T extends object, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined => {
  if (hasOwnProperty(obj, key)) {
    return obj[key];
  }
  return defaultValue;
};

export const getNestedProperty = (
  obj: unknown,
  path: string,
  separator = '.'
): unknown => {
  if (!isObject(obj)) return undefined;

  const keys = path.split(separator);
  let current: unknown = obj;

  for (const key of keys) {
    if (!isObject(current) || !hasOwnProperty(current, key)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
};

// Type-safe object merging
export const mergeObjects = <T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T => {
  const result = { ...target };

  for (const source of sources) {
    if (isObject(source)) {
      Object.assign(result, source);
    }
  }

  return result;
};

// Deep object comparison
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) return false;

  if (isDate(a) && isDate(b)) {
    return a.getTime() === b.getTime();
  }

  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key =>
      hasOwnProperty(b, key) && deepEqual(a[key], b[key])
    );
  }

  return false;
};

// Schema-based validation guards
export const createSchemaGuard = <T>(
  schema: Record<keyof T, (value: unknown) => boolean>
) => {
  return (value: unknown): value is T => {
    if (!isObject(value)) return false;

    return Object.entries(schema).every(([key, validator]) => {
      if (!hasOwnProperty(value, key)) return false;
      return validator(value[key]);
    });
  };
};

// Environment-specific guards
export const isNodeEnvironment = (): boolean => {
  return typeof process !== 'undefined' &&
         process.versions != null &&
         process.versions.node != null;
};

export const isBrowserEnvironment = (): boolean => {
  return typeof window !== 'undefined' &&
         typeof document !== 'undefined';
};

export const isWebWorkerEnvironment = (): boolean => {
  return typeof importScripts === 'function' &&
         typeof globalThis !== 'undefined' &&
         'WorkerGlobalScope' in globalThis;
};

// Type-safe casting utilities
export const safeCast = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage?: string
): T => {
  if (guard(value)) {
    return value;
  }
  throw new TypeError(errorMessage || `Failed to cast value to expected type`);
};

export const tryCast = <T>(
  value: unknown,
  guard: (value: unknown) => value is T
): T | null => {
  return guard(value) ? value : null;
};

export const castWithDefault = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  defaultValue: T
): T => {
  return guard(value) ? value : defaultValue;
};

// Collection type guards
export const isReadonlyArray = <T>(value: unknown): value is readonly T[] => {
  return Array.isArray(value);
};

export const isNonEmptyArray = <T>(value: unknown): value is [T, ...T[]] => {
  return isArray(value) && value.length > 0;
};

export const isArrayOf = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] => {
  return isArray(value) && value.every(itemGuard);
};

export const isRecordOf = <T>(
  value: unknown,
  valueGuard: (item: unknown) => item is T
): value is Record<string, T> => {
  return isObject(value) && Object.values(value).every(valueGuard);
};

// Promise and async utilities
export const isSettledPromise = <T>(
  value: unknown
): value is PromiseSettledResult<T> => {
  return isObject(value) &&
         hasOwnProperty(value, 'status') &&
         (value.status === 'fulfilled' || value.status === 'rejected');
};

export const isFulfilledPromise = <T>(
  value: unknown
): value is PromiseFulfilledResult<T> => {
  return isSettledPromise(value) && value.status === 'fulfilled';
};

export const isRejectedPromise = (
  value: unknown
): value is PromiseRejectedResult => {
  return isSettledPromise(value) && value.status === 'rejected';
};

// File system guards
export const isAbsolutePath = (path: string): boolean => {
  if (!isString(path)) return false;

  // Unix/Linux/Mac absolute path
  if (path.startsWith('/')) return true;

  // Windows absolute path
  if (/^[A-Za-z]:[\\\/]/.test(path)) return true;

  // UNC path
  if (path.startsWith('\\\\')) return true;

  return false;
};

export const isRelativePath = (path: string): boolean => {
  return isString(path) && !isAbsolutePath(path);
};

// Network and URL guards
export const isHttpUrl = (value: string): boolean => {
  if (!isValidUrl(value)) return false;
  const url = new URL(value);
  return url.protocol === 'http:' || url.protocol === 'https:';
};

export const isSecureUrl = (value: string): boolean => {
  if (!isValidUrl(value)) return false;
  const url = new URL(value);
  return url.protocol === 'https:';
};

export const isLocalhost = (value: string): boolean => {
  if (!isValidUrl(value)) return false;
  const url = new URL(value);
  return url.hostname === 'localhost' ||
         url.hostname === '127.0.0.1' ||
         url.hostname === '::1';
};

// Error handling guards
export const isErrorLike = (value: unknown): value is { message: string; name?: string; stack?: string } => {
  return isObject(value) &&
         hasOwnProperty(value, 'message') &&
         isString(value.message);
};

export const isHttpError = (value: unknown): value is { status: number; message: string } => {
  return isObject(value) &&
         hasOwnProperty(value, 'status') &&
         hasOwnProperty(value, 'message') &&
         isNumber(value.status) &&
         isString(value.message);
};

// Database and API guards
export const isGenericApiResponse = <T>(
  value: unknown,
  dataGuard?: (data: unknown) => data is T
): value is { success: boolean; data?: T; error?: string } => {
  if (!isObject(value) || !hasOwnProperty(value, 'success') || !isBoolean(value.success)) {
    return false;
  }

  if (dataGuard && hasOwnProperty(value, 'data')) {
    return dataGuard(value.data);
  }

  return true;
};

export const isPaginatedResponse = <T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T
): value is { data: T[]; total: number; page: number; limit: number } => {
  if (!isObject(value)) return false;

  const requiredProps = ['data', 'total', 'page', 'limit'] as const;
  if (!hasProperties(value, requiredProps)) return false;

  if (!isArray(value.data) || !isNumber(value.total) ||
      !isNumber(value.page) || !isNumber(value.limit)) {
    return false;
  }

  if (itemGuard) {
    return value.data.every(itemGuard);
  }

  return true;
};

// Configuration and environment guards
export const isConfigValue = (value: unknown): value is string | number | boolean | null => {
  return isString(value) || isNumber(value) || isBoolean(value) || isNull(value);
};

export const isEnvironmentVariables = (value: unknown): value is Record<string, string> => {
  return isObject(value) && Object.values(value).every(isString);
};

// Utility types for better type inference
export type TypeGuardResult<T> = T extends (value: unknown) => value is infer U ? U : never;

export type AssertionFunction<T> = (value: unknown, name?: string) => asserts value is T;

export type SafeParser<T> = (value: unknown, defaultValue: T) => T;

export type TypeValidator<T> = {
  guard: (value: unknown) => value is T;
  assert: AssertionFunction<T>;
  parse: SafeParser<T>;
  cast: (value: unknown) => T | null;
};