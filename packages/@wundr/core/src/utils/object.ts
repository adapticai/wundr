/**
 * Object manipulation utility functions
 * Updated to use type-safe patterns
 */

import { isObject, isArray, isDate, hasOwnProperty } from './type-guards.js';

/**
 * Deep clones an object with type safety
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (isDate(obj)) {
    return new Date((obj as Date).getTime()) as T;
  }

  if (isArray(obj)) {
    return (obj as unknown[]).map(item => deepClone(item)) as T;
  }

  if (isObject(obj)) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (hasOwnProperty(obj, key)) {
        (clonedObj as Record<string, unknown>)[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * Deep merges multiple objects with type safety
 */
export function deepMerge<T extends Record<string, unknown>>(
  ...objects: T[]
): T {
  if (objects.length === 0) {
    return {} as T;
  }

  if (objects.length === 1) {
    return deepClone(objects[0]);
  }

  const target = {} as T;

  for (const obj of objects) {
    if (isObject(obj)) {
      for (const key in obj) {
        if (hasOwnProperty(obj, key)) {
          const value = obj[key];
          const targetValue = (target as Record<string, unknown>)[key];

          if (
            isObject(value) &&
            !isArray(value) &&
            isObject(targetValue) &&
            !isArray(targetValue)
          ) {
            (target as Record<string, unknown>)[key] = deepMerge(
              targetValue as Record<string, unknown>,
              value as Record<string, unknown>
            );
          } else {
            (target as Record<string, unknown>)[key] = deepClone(value);
          }
        }
      }
    }
  }

  return target;
}

/**
 * Gets a nested property value using dot notation with type safety
 */
export function getNestedValue<T = unknown>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue?: T
): T | undefined {
  if (!isObject(obj)) {
    return defaultValue;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (isObject(current) && hasOwnProperty(current, key)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}

/**
 * Sets a nested property value using dot notation with type safety
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  if (!isObject(obj)) {
    return;
  }

  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) {
    return;
  }

  let current: Record<string, unknown> = obj;

  for (const key of keys) {
    if (!isObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[lastKey] = value;
}

/**
 * Removes empty values from an object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeEmpty<T extends Record<string, any>>(
  obj: T,
  options: {
    removeNull?: boolean;
    removeUndefined?: boolean;
    removeEmptyStrings?: boolean;
    removeEmptyArrays?: boolean;
    removeEmptyObjects?: boolean;
  } = {}
): Partial<T> {
  const {
    removeNull = true,
    removeUndefined = true,
    removeEmptyStrings = true,
    removeEmptyArrays = true,
    removeEmptyObjects = true,
  } = options;

  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    let shouldRemove = false;

    if (value === null && removeNull) {
      shouldRemove = true;
    } else if (value === undefined && removeUndefined) {
      shouldRemove = true;
    } else if (value === '' && removeEmptyStrings) {
      shouldRemove = true;
    } else if (
      Array.isArray(value) &&
      value.length === 0 &&
      removeEmptyArrays
    ) {
      shouldRemove = true;
    } else if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0 &&
      removeEmptyObjects
    ) {
      shouldRemove = true;
    }

    if (!shouldRemove) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleaned = removeEmpty(value as Record<string, any>, options);
        if (Object.keys(cleaned).length > 0 || !removeEmptyObjects) {
          result[key as keyof T] = cleaned as T[keyof T];
        }
      } else {
        result[key as keyof T] = value;
      }
    }
  }

  return result;
}

/**
 * Picks specific properties from an object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Omits specific properties from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> {
  const result = { ...obj };
  const keysSet = new Set(keys);

  for (const key in result) {
    if (keysSet.has(key as unknown as K)) {
      delete result[key];
    }
  }

  return result as Omit<T, K>;
}

/**
 * Flattens a nested object into a flat object with dot notation keys
 */
export function flatten(
  obj: Record<string, unknown>,
  prefix = '',
  separator = '.'
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) {
      continue;
    }

    const value = obj[key];
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (isObject(value) && !isArray(value)) {
      Object.assign(
        flattened,
        flatten(value as Record<string, unknown>, newKey, separator)
      );
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

/**
 * Unflattens a flat object with dot notation keys into a nested object
 */
export function unflatten(
  obj: Record<string, unknown>,
  separator = '.'
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key in obj) {
    if (!hasOwnProperty(obj, key)) {
      continue;
    }

    const value = obj[key];
    setNestedValue(result, key.split(separator).join('.'), value);
  }

  return result;
}
