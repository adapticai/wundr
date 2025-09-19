/**
 * Type-safe object manipulation utilities
 * Provides safe alternatives to common object operations without 'any' usage
 */

import {
  isObject,
  isArray,
  isDate,
  isString,
  isNumber,
  hasOwnProperty,
  deepEqual,
  getNestedProperty,
  mergeObjects
} from '../types/type-guards';

/**
 * Type-safe deep cloning utility
 */
export const safeDeepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (isDate(obj)) {
    return new Date(obj.getTime()) as T;
  }

  if (isArray(obj)) {
    return obj.map(item => safeDeepClone(item)) as T;
  }

  if (isObject(obj)) {
    const cloned = {} as T;

    for (const key in obj) {
      if (hasOwnProperty(obj, key)) {
        (cloned as Record<string, unknown>)[key] = safeDeepClone(obj[key]);
      }
    }

    return cloned;
  }

  return obj;
};

/**
 * Type-safe deep merge utility
 */
export const safeDeepMerge = <T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T => {
  if (sources.length === 0) return safeDeepClone(target);

  const result = safeDeepClone(target);

  for (const source of sources) {
    if (!isObject(source)) continue;

    for (const key in source) {
      if (!hasOwnProperty(source, key)) continue;

      const sourceValue = source[key];
      const targetValue = result[key];

      if (isObject(sourceValue) && isObject(targetValue) && !isArray(sourceValue) && !isArray(targetValue)) {
        (result as Record<string, unknown>)[key] = safeDeepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = safeDeepClone(sourceValue);
      }
    }
  }

  return result;
};

/**
 * Safe nested property getter with type inference
 */
export const safeGet = <T = unknown>(
  obj: unknown,
  path: string | string[],
  defaultValue?: T,
  separator = '.'
): T | undefined => {
  if (!isObject(obj)) return defaultValue;

  const keys = isArray(path) ? path : path.split(separator);
  let current: unknown = obj;

  for (const key of keys) {
    if (!isObject(current) || !hasOwnProperty(current, key)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current as T;
};

/**
 * Safe nested property setter with validation
 */
export const safeSet = <T extends Record<string, unknown>>(
  obj: T,
  path: string | string[],
  value: unknown,
  separator = '.'
): T => {
  const result = safeDeepClone(obj);
  const keys = isArray(path) ? path : path.split(separator);

  if (keys.length === 0) return result;

  const lastKey = keys.pop()!;
  let current: Record<string, unknown> = result;

  for (const key of keys) {
    if (!isObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[lastKey] = value;
  return result;
};

/**
 * Safe property deletion
 */
export const safeDelete = <T extends Record<string, unknown>>(
  obj: T,
  path: string | string[],
  separator = '.'
): T => {
  const result = safeDeepClone(obj);
  const keys = isArray(path) ? path : path.split(separator);

  if (keys.length === 0) return result;

  const lastKey = keys.pop()!;
  let current: Record<string, unknown> = result;

  for (const key of keys) {
    if (!isObject(current[key])) {
      return result; // Path doesn't exist
    }
    current = current[key] as Record<string, unknown>;
  }

  delete current[lastKey];
  return result;
};

/**
 * Type-safe object filtering
 */
export const safeFilter = <T extends Record<string, unknown>>(
  obj: T,
  predicate: (key: string, value: unknown) => boolean
): Partial<T> => {
  const result: Partial<T> = {};

  for (const key in obj) {
    if (hasOwnProperty(obj, key) && predicate(key, obj[key])) {
      result[key] = obj[key];
    }
  }

  return result;
};

/**
 * Safe object mapping with type preservation
 */
export const safeMap = <T extends Record<string, unknown>, U>(
  obj: T,
  mapper: (key: string, value: T[keyof T]) => U
): Record<keyof T, U> => {
  const result = {} as Record<keyof T, U>;

  for (const key in obj) {
    if (hasOwnProperty(obj, key)) {
      result[key] = mapper(key, obj[key]);
    }
  }

  return result;
};

/**
 * Safe object key transformation
 */
export const safeMapKeys = <T extends Record<string, unknown>>(
  obj: T,
  mapper: (key: string) => string
): Record<string, T[keyof T]> => {
  const result: Record<string, T[keyof T]> = {};

  for (const key in obj) {
    if (hasOwnProperty(obj, key)) {
      const newKey = mapper(key);
      result[newKey] = obj[key];
    }
  }

  return result;
};

/**
 * Safe object flattening
 */
export const safeFlatten = (
  obj: Record<string, unknown>,
  prefix = '',
  separator = '.',
  maxDepth = 10
): Record<string, unknown> => {
  if (maxDepth <= 0) return obj;

  const flattened: Record<string, unknown> = {};

  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) continue;

    const value = obj[key];
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (isObject(value) && !isArray(value) && !isDate(value)) {
      Object.assign(
        flattened,
        safeFlatten(value as Record<string, unknown>, newKey, separator, maxDepth - 1)
      );
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
};

/**
 * Safe object unflattening
 */
export const safeUnflatten = (
  obj: Record<string, unknown>,
  separator = '.'
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) continue;

    const value = obj[key];
    const keys = key.split(separator);

    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const subKey = keys[i];
      if (!isObject(current[subKey])) {
        current[subKey] = {};
      }
      current = current[subKey] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  return result;
};

/**
 * Safe property picking with type safety
 */
export const safePick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (hasOwnProperty(obj, key)) {
      result[key] = obj[key];
    }
  }

  return result;
};

/**
 * Safe property omitting with type safety
 */
export const safeOmit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> => {
  const result = { ...obj } as T;
  const keysSet = new Set(keys);

  for (const key in result) {
    if (keysSet.has(key as K)) {
      delete result[key];
    }
  }

  return result as Omit<T, K>;
};

/**
 * Safe empty value removal
 */
export const safeRemoveEmpty = <T extends Record<string, unknown>>(
  obj: T,
  options: {
    removeNull?: boolean;
    removeUndefined?: boolean;
    removeEmptyStrings?: boolean;
    removeEmptyArrays?: boolean;
    removeEmptyObjects?: boolean;
    recursive?: boolean;
  } = {}
): Partial<T> => {
  const {
    removeNull = true,
    removeUndefined = true,
    removeEmptyStrings = true,
    removeEmptyArrays = true,
    removeEmptyObjects = true,
    recursive = false,
  } = options;

  const result: Partial<T> = {};

  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) continue;

    const value = obj[key];
    let shouldRemove = false;

    if (value === null && removeNull) {
      shouldRemove = true;
    } else if (value === undefined && removeUndefined) {
      shouldRemove = true;
    } else if (value === '' && removeEmptyStrings) {
      shouldRemove = true;
    } else if (isArray(value) && value.length === 0 && removeEmptyArrays) {
      shouldRemove = true;
    } else if (isObject(value) && !isArray(value) && Object.keys(value).length === 0 && removeEmptyObjects) {
      shouldRemove = true;
    }

    if (!shouldRemove) {
      if (recursive && isObject(value) && !isArray(value) && !isDate(value)) {
        const cleaned = safeRemoveEmpty(value as Record<string, unknown>, options);
        if (Object.keys(cleaned).length > 0 || !removeEmptyObjects) {
          result[key] = cleaned as T[typeof key];
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
};

/**
 * Safe object comparison with custom depth
 */
export const safeDeepEqual = (
  a: unknown,
  b: unknown,
  maxDepth = 10
): boolean => {
  if (maxDepth <= 0) return a === b;
  return deepEqual(a, b);
};

/**
 * Safe object validation against schema
 */
export const safeValidateObject = <T>(
  obj: unknown,
  schema: Record<keyof T, (value: unknown) => boolean>,
  strict = false
): obj is T => {
  if (!isObject(obj)) return false;

  // Check required properties
  for (const key in schema) {
    if (!hasOwnProperty(obj, key)) return false;
    if (!schema[key](obj[key])) return false;
  }

  // In strict mode, ensure no extra properties
  if (strict) {
    const schemaKeys = new Set(Object.keys(schema));
    for (const key in obj) {
      if (!schemaKeys.has(key)) return false;
    }
  }

  return true;
};

/**
 * Safe object transformation with error handling
 */
export const safeTransform = <T extends Record<string, unknown>, U>(
  obj: T,
  transformer: (obj: T) => U,
  fallback: U
): U => {
  try {
    return transformer(obj);
  } catch {
    return fallback;
  }
};

/**
 * Type-safe object freezing
 */
export const safeFreeze = <T>(obj: T): Readonly<T> => {
  if (isObject(obj) || isArray(obj)) {
    return Object.freeze(obj);
  }
  return obj;
};

/**
 * Safe deep freezing
 */
export const safeDeepFreeze = <T>(obj: T): T => {
  if (isObject(obj)) {
    Object.freeze(obj);
    for (const key in obj) {
      if (hasOwnProperty(obj, key)) {
        safeDeepFreeze(obj[key]);
      }
    }
  } else if (isArray(obj)) {
    Object.freeze(obj);
    obj.forEach(item => safeDeepFreeze(item));
  }

  return obj;
};

/**
 * Safe JSON operations
 */
export const safeJsonParse = <T = unknown>(
  json: string,
  validator?: (parsed: unknown) => parsed is T
): { success: true; data: T } | { success: false; error: string } => {
  try {
    const parsed = JSON.parse(json);

    if (validator && !validator(parsed)) {
      return { success: false, error: 'Parsed data failed validation' };
    }

    return { success: true, data: parsed as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON parsing failed'
    };
  }
};

export const safeJsonStringify = (
  value: unknown,
  replacer?: (key: string, value: unknown) => unknown,
  space?: string | number
): { success: true; data: string } | { success: false; error: string } => {
  try {
    const data = JSON.stringify(value, replacer as (string | number)[], space);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON stringify failed'
    };
  }
};

/**
 * Utility type for safe object operations
 */
export type SafeObjectOperation<T, U> = (obj: T) => U | { error: string };

/**
 * Safe operation wrapper
 */
export const wrapSafeOperation = <T, U>(
  operation: (obj: T) => U
): SafeObjectOperation<T, U> => {
  return (obj: T) => {
    try {
      return operation(obj);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    }
  };
};