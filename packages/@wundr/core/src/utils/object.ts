/**
 * Object manipulation utility functions
 */

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * Deep merges multiple objects
 */
export function deepMerge<T extends Record<string, any>>(...objects: T[]): T {
  if (objects.length === 0) {
    return {} as T;
  }

  if (objects.length === 1) {
    return deepClone(objects[0]);
  }

  const target = {} as T;

  for (const obj of objects) {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            target[key] = deepMerge(target[key] || {} as any, value);
          } else {
            target[key] = deepClone(value);
          }
        }
      }
    }
  }

  return target;
}

/**
 * Gets a nested property value using dot notation
 */
export function getNestedValue<T = any>(
  obj: Record<string, any>,
  path: string,
  defaultValue?: T
): T | undefined {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}

/**
 * Sets a nested property value using dot notation
 */
export function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: any
): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

/**
 * Removes empty values from an object
 */
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
    } else if (Array.isArray(value) && value.length === 0 && removeEmptyArrays) {
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
        const cleaned = removeEmpty(value, options);
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
export function omit<T, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj } as Omit<T, K>;
  
  for (const key of keys) {
    delete (result as any)[key];
  }
  
  return result;
}

/**
 * Flattens a nested object into a flat object with dot notation keys
 */
export function flatten(
  obj: Record<string, any>,
  prefix = '',
  separator = '.'
): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flattened, flatten(value as Record<string, any>, newKey, separator));
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
  obj: Record<string, any>,
  separator = '.'
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    setNestedValue(result, key.split(separator).join('.'), value);
  }

  return result;
}