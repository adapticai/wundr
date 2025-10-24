/**
 * Basic type guards for core utilities
 * Minimal version without external dependencies
 */

// Basic type guards
export const isString = (value: unknown): value is string =>
  typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !isNaN(value) && isFinite(value);

export const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = <T>(value: unknown): value is readonly T[] =>
  Array.isArray(value);

export const isFunction = (
  value: unknown,
): value is (...args: unknown[]) => unknown => typeof value === 'function';

export const isDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime());

export const isNull = (value: unknown): value is null => value === null;

export const isUndefined = (value: unknown): value is undefined =>
  value === undefined;

// Object property helpers
export const hasOwnProperty = <T extends object, K extends PropertyKey>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
