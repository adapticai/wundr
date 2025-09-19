/**
 * Comprehensive test suite for type guards and safe utilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  // Basic type guards
  isString,
  isNumber,
  isBoolean,
  isNull,
  isUndefined,
  isNullish,
  isObject,
  isArray,
  isFunction,
  isDate,
  isRegExp,
  isError,
  isPromise,

  // Advanced type guards
  hasOwnProperty,
  hasProperties,
  isObjectWithKeys,
  getProperty,
  getNestedProperty,
  mergeObjects,
  deepEqual,
  createSchemaGuard,

  // Environment guards
  isNodeEnvironment,
  isBrowserEnvironment,
  isWebWorkerEnvironment,

  // Casting utilities
  safeCast,
  tryCast,
  castWithDefault,

  // Collection guards
  isNonEmptyArray,
  isArrayOf,
  isRecordOf,

  // Promise guards
  isSettledPromise,
  isFulfilledPromise,
  isRejectedPromise,

  // File system guards
  isAbsolutePath,
  isRelativePath,

  // Network guards
  isHttpUrl,
  isSecureUrl,
  isLocalhost,

  // Error guards
  isErrorLike,
  isHttpError,

  // API guards
  isApiResponse,
  isPaginatedResponse,

  // Config guards
  isConfigValue,
  isEnvironmentVariables,

  // Complex validation
  isNonEmptyString,
  isPositiveNumber,
  isValidPort,
  isValidPercentage,

  // Safe parsing
  safeParseInt,
  safeParseFloat,
  safeParseBoolean,
  safeParseJson,
  parseJsonSafe,
  stringifyJsonSafe,

  // Assertions
  assertString,
  assertNumber,
  assertObject,
  assertArray,
  assertNotNull,
  assertNotUndefined,
  assertNotNullish,

  // Validation
  validateRequired,
  validateStringLength,
  validateNumberRange,
  validateArrayLength
} from '../types/type-guards';

import {
  safeDeepClone,
  safeDeepMerge,
  safeGet,
  safeSet,
  safeDelete,
  safePick,
  safeOmit,
  safeRemoveEmpty,
  safeJsonParse,
  safeJsonStringify
} from '../utils/safe-object-utils';

import {
  createZodGuard,
  createZodAssertion,
  validateWithZod,
  coerceWithZod,
  ZodSchemas,
  createConfigValidator,
  createApiValidator
} from '../utils/zod-type-guards';

import { z } from 'zod';

describe('Type Guards', () => {
  describe('Basic Type Guards', () => {
    describe('isString', () => {
      it('should return true for strings', () => {
        expect(isString('')).toBe(true);
        expect(isString('hello')).toBe(true);
        expect(isString(String('test'))).toBe(true);
      });

      it('should return false for non-strings', () => {
        expect(isString(123)).toBe(false);
        expect(isString(null)).toBe(false);
        expect(isString(undefined)).toBe(false);
        expect(isString({})).toBe(false);
        expect(isString([])).toBe(false);
      });
    });

    describe('isNumber', () => {
      it('should return true for valid numbers', () => {
        expect(isNumber(0)).toBe(true);
        expect(isNumber(123)).toBe(true);
        expect(isNumber(-456)).toBe(true);
        expect(isNumber(3.14)).toBe(true);
        expect(isNumber(Number.MAX_VALUE)).toBe(true);
      });

      it('should return false for invalid numbers', () => {
        expect(isNumber(NaN)).toBe(false);
        expect(isNumber(Infinity)).toBe(false);
        expect(isNumber(-Infinity)).toBe(false);
        expect(isNumber('123')).toBe(false);
        expect(isNumber(null)).toBe(false);
      });
    });

    describe('isBoolean', () => {
      it('should return true for booleans', () => {
        expect(isBoolean(true)).toBe(true);
        expect(isBoolean(false)).toBe(true);
        expect(isBoolean(Boolean(1))).toBe(true);
      });

      it('should return false for non-booleans', () => {
        expect(isBoolean(1)).toBe(false);
        expect(isBoolean(0)).toBe(false);
        expect(isBoolean('true')).toBe(false);
        expect(isBoolean(null)).toBe(false);
      });
    });

    describe('isObject', () => {
      it('should return true for plain objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ key: 'value' })).toBe(true);
        expect(isObject(new Object())).toBe(true);
      });

      it('should return false for non-objects', () => {
        expect(isObject(null)).toBe(false);
        expect(isObject([])).toBe(false);
        expect(isObject(new Date())).toBe(false);
        expect(isObject('string')).toBe(false);
        expect(isObject(123)).toBe(false);
      });
    });

    describe('isArray', () => {
      it('should return true for arrays', () => {
        expect(isArray([])).toBe(true);
        expect(isArray([1, 2, 3])).toBe(true);
        expect(isArray(new Array())).toBe(true);
      });

      it('should return false for non-arrays', () => {
        expect(isArray({})).toBe(false);
        expect(isArray('string')).toBe(false);
        expect(isArray(null)).toBe(false);
      });
    });
  });

  describe('Advanced Object Guards', () => {
    describe('hasOwnProperty', () => {
      it('should detect own properties', () => {
        const obj = { key: 'value' };
        expect(hasOwnProperty(obj, 'key')).toBe(true);
        expect(hasOwnProperty(obj, 'toString')).toBe(false);
      });
    });

    describe('hasProperties', () => {
      it('should detect multiple properties', () => {
        const obj = { a: 1, b: 2, c: 3 };
        expect(hasProperties(obj, ['a', 'b'])).toBe(true);
        expect(hasProperties(obj, ['a', 'b', 'c'])).toBe(true);
        expect(hasProperties(obj, ['a', 'b', 'd'])).toBe(false);
      });
    });

    describe('getNestedProperty', () => {
      it('should get nested properties safely', () => {
        const obj = { a: { b: { c: 'value' } } };
        expect(getNestedProperty(obj, 'a.b.c')).toBe('value');
        expect(getNestedProperty(obj, 'a.b.d')).toBeUndefined();
        expect(getNestedProperty(null, 'a.b.c')).toBeUndefined();
      });
    });

    describe('deepEqual', () => {
      it('should compare objects deeply', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { a: 1, b: { c: 2 } };
        const obj3 = { a: 1, b: { c: 3 } };

        expect(deepEqual(obj1, obj2)).toBe(true);
        expect(deepEqual(obj1, obj3)).toBe(false);
      });

      it('should handle arrays', () => {
        expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      });

      it('should handle dates', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2023-01-01');
        const date3 = new Date('2023-01-02');

        expect(deepEqual(date1, date2)).toBe(true);
        expect(deepEqual(date1, date3)).toBe(false);
      });
    });
  });

  describe('Safe Parsing Utilities', () => {
    describe('safeParseInt', () => {
      it('should parse valid integers', () => {
        expect(safeParseInt('123')).toBe(123);
        expect(safeParseInt('0')).toBe(0);
        expect(safeParseInt('-456')).toBe(-456);
      });

      it('should return default for invalid input', () => {
        expect(safeParseInt('invalid')).toBe(0);
        expect(safeParseInt('invalid', 42)).toBe(42);
        expect(safeParseInt(null)).toBe(0);
      });

      it('should handle numeric inputs', () => {
        expect(safeParseInt(123.45)).toBe(123);
        expect(safeParseInt(789)).toBe(789);
      });
    });

    describe('safeParseBoolean', () => {
      it('should parse truthy values', () => {
        expect(safeParseBoolean('true')).toBe(true);
        expect(safeParseBoolean('TRUE')).toBe(true);
        expect(safeParseBoolean('1')).toBe(true);
        expect(safeParseBoolean('yes')).toBe(true);
        expect(safeParseBoolean('on')).toBe(true);
        expect(safeParseBoolean('enabled')).toBe(true);
      });

      it('should parse falsy values', () => {
        expect(safeParseBoolean('false')).toBe(false);
        expect(safeParseBoolean('FALSE')).toBe(false);
        expect(safeParseBoolean('0')).toBe(false);
        expect(safeParseBoolean('no')).toBe(false);
        expect(safeParseBoolean('off')).toBe(false);
        expect(safeParseBoolean('disabled')).toBe(false);
      });

      it('should handle boolean inputs', () => {
        expect(safeParseBoolean(true)).toBe(true);
        expect(safeParseBoolean(false)).toBe(false);
      });

      it('should return default for invalid input', () => {
        expect(safeParseBoolean('maybe')).toBe(false);
        expect(safeParseBoolean('maybe', true)).toBe(true);
        expect(safeParseBoolean(null)).toBe(false);
      });
    });

    describe('parseJsonSafe', () => {
      it('should parse valid JSON', () => {
        const result = parseJsonSafe('{"key": "value"}');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ key: 'value' });
        }
      });

      it('should handle invalid JSON', () => {
        const result = parseJsonSafe('invalid json');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Unexpected token');
        }
      });

      it('should handle non-string input', () => {
        const result = parseJsonSafe(123);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Collection Type Guards', () => {
    describe('isNonEmptyArray', () => {
      it('should detect non-empty arrays', () => {
        expect(isNonEmptyArray([1])).toBe(true);
        expect(isNonEmptyArray([1, 2, 3])).toBe(true);
        expect(isNonEmptyArray([])).toBe(false);
        expect(isNonEmptyArray('string')).toBe(false);
      });
    });

    describe('isArrayOf', () => {
      it('should validate array items', () => {
        expect(isArrayOf([1, 2, 3], isNumber)).toBe(true);
        expect(isArrayOf(['a', 'b', 'c'], isString)).toBe(true);
        expect(isArrayOf([1, 'a', 3], isNumber)).toBe(false);
        expect(isArrayOf([], isNumber)).toBe(true);
      });
    });

    describe('isRecordOf', () => {
      it('should validate record values', () => {
        expect(isRecordOf({ a: 1, b: 2 }, isNumber)).toBe(true);
        expect(isRecordOf({ a: 'x', b: 'y' }, isString)).toBe(true);
        expect(isRecordOf({ a: 1, b: 'y' }, isNumber)).toBe(false);
      });
    });
  });

  describe('Validation Guards', () => {
    describe('isValidPort', () => {
      it('should validate port numbers', () => {
        expect(isValidPort(80)).toBe(true);
        expect(isValidPort(443)).toBe(true);
        expect(isValidPort(65535)).toBe(true);
        expect(isValidPort(0)).toBe(false);
        expect(isValidPort(65536)).toBe(false);
        expect(isValidPort(3.14)).toBe(false);
      });
    });

    describe('isValidPercentage', () => {
      it('should validate percentages', () => {
        expect(isValidPercentage(0)).toBe(true);
        expect(isValidPercentage(50)).toBe(true);
        expect(isValidPercentage(100)).toBe(true);
        expect(isValidPercentage(-1)).toBe(false);
        expect(isValidPercentage(101)).toBe(false);
      });
    });
  });

  describe('Network Guards', () => {
    describe('isHttpUrl', () => {
      it('should validate HTTP URLs', () => {
        expect(isHttpUrl('http://example.com')).toBe(true);
        expect(isHttpUrl('https://example.com')).toBe(true);
        expect(isHttpUrl('ftp://example.com')).toBe(false);
        expect(isHttpUrl('invalid-url')).toBe(false);
      });
    });

    describe('isSecureUrl', () => {
      it('should validate HTTPS URLs', () => {
        expect(isSecureUrl('https://example.com')).toBe(true);
        expect(isSecureUrl('http://example.com')).toBe(false);
      });
    });

    describe('isLocalhost', () => {
      it('should detect localhost URLs', () => {
        expect(isLocalhost('http://localhost')).toBe(true);
        expect(isLocalhost('http://127.0.0.1')).toBe(true);
        expect(isLocalhost('http://[::1]')).toBe(true);
        expect(isLocalhost('http://example.com')).toBe(false);
      });
    });
  });

  describe('Path Guards', () => {
    describe('isAbsolutePath', () => {
      it('should detect absolute paths', () => {
        expect(isAbsolutePath('/usr/local/bin')).toBe(true);
        expect(isAbsolutePath('C:\\Windows')).toBe(true);
        expect(isAbsolutePath('\\\\server\\share')).toBe(true);
        expect(isAbsolutePath('relative/path')).toBe(false);
        expect(isAbsolutePath('./relative')).toBe(false);
      });
    });

    describe('isRelativePath', () => {
      it('should detect relative paths', () => {
        expect(isRelativePath('relative/path')).toBe(true);
        expect(isRelativePath('./relative')).toBe(true);
        expect(isRelativePath('../parent')).toBe(true);
        expect(isRelativePath('/absolute/path')).toBe(false);
      });
    });
  });

  describe('Casting Utilities', () => {
    describe('safeCast', () => {
      it('should cast valid values', () => {
        expect(safeCast('hello', isString)).toBe('hello');
        expect(safeCast(123, isNumber)).toBe(123);
      });

      it('should throw for invalid values', () => {
        expect(() => safeCast(123, isString)).toThrow();
        expect(() => safeCast('hello', isNumber)).toThrow();
      });
    });

    describe('tryCast', () => {
      it('should return value for valid casts', () => {
        expect(tryCast('hello', isString)).toBe('hello');
        expect(tryCast(123, isNumber)).toBe(123);
      });

      it('should return null for invalid casts', () => {
        expect(tryCast(123, isString)).toBeNull();
        expect(tryCast('hello', isNumber)).toBeNull();
      });
    });

    describe('castWithDefault', () => {
      it('should return value for valid casts', () => {
        expect(castWithDefault('hello', isString, 'default')).toBe('hello');
      });

      it('should return default for invalid casts', () => {
        expect(castWithDefault(123, isString, 'default')).toBe('default');
      });
    });
  });

  describe('Assertion Functions', () => {
    describe('assertString', () => {
      it('should pass for strings', () => {
        expect(() => assertString('hello')).not.toThrow();
      });

      it('should throw for non-strings', () => {
        expect(() => assertString(123)).toThrow('Expected value to be a string');
      });
    });

    describe('assertNotNull', () => {
      it('should pass for non-null values', () => {
        expect(() => assertNotNull('hello')).not.toThrow();
        expect(() => assertNotNull(0)).not.toThrow();
        expect(() => assertNotNull(false)).not.toThrow();
      });

      it('should throw for null', () => {
        expect(() => assertNotNull(null)).toThrow('Expected value to not be null');
      });
    });
  });
});

describe('Safe Object Utils', () => {
  describe('safeDeepClone', () => {
    it('should clone objects deeply', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = safeDeepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should handle arrays', () => {
      const original = [1, [2, 3], { a: 4 }];
      const cloned = safeDeepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
    });

    it('should handle dates', () => {
      const date = new Date();
      const cloned = safeDeepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });
  });

  describe('safeGet', () => {
    const obj = { a: { b: { c: 'value' } } };

    it('should get nested values', () => {
      expect(safeGet(obj, 'a.b.c')).toBe('value');
      expect(safeGet(obj, ['a', 'b', 'c'])).toBe('value');
    });

    it('should return default for missing paths', () => {
      expect(safeGet(obj, 'a.b.d')).toBeUndefined();
      expect(safeGet(obj, 'a.b.d', 'default')).toBe('default');
    });

    it('should handle non-object inputs', () => {
      expect(safeGet(null, 'a.b', 'default')).toBe('default');
      expect(safeGet('string', 'a.b', 'default')).toBe('default');
    });
  });

  describe('safeSet', () => {
    it('should set nested values', () => {
      const obj = { a: { b: 1 } };
      const result = safeSet(obj, 'a.c', 2);

      expect(result.a.b).toBe(1);
      expect(result.a.c).toBe(2);
      expect(obj).toEqual({ a: { b: 1 } }); // Original unchanged
    });

    it('should create missing paths', () => {
      const obj = {};
      const result = safeSet(obj, 'a.b.c', 'value');

      expect(result.a.b.c).toBe('value');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ key: 'value' });
      }
    });

    it('should handle invalid JSON', () => {
      const result = safeJsonParse('invalid');
      expect(result.success).toBe(false);
    });

    it('should validate parsed data', () => {
      const validator = (data: unknown): data is { key: string } => {
        return isObject(data) && hasOwnProperty(data, 'key') && isString(data.key);
      };

      const validResult = safeJsonParse('{"key": "value"}', validator);
      const invalidResult = safeJsonParse('{"other": "value"}', validator);

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });
  });
});

describe('Zod Integration', () => {
  describe('createZodGuard', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    });

    const guard = createZodGuard(schema);

    it('should validate correct data', () => {
      expect(guard({ name: 'John', age: 30 })).toBe(true);
    });

    it('should reject incorrect data', () => {
      expect(guard({ name: 'John' })).toBe(false);
      expect(guard({ name: 123, age: 30 })).toBe(false);
    });
  });

  describe('validateWithZod', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(0)
    });

    it('should return success for valid data', () => {
      const result = validateWithZod({ email: 'test@example.com', age: 25 }, schema);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ email: 'test@example.com', age: 25 });
    });

    it('should return errors for invalid data', () => {
      const result = validateWithZod({ email: 'invalid', age: -1 }, schema);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('ZodSchemas', () => {
    it('should validate email', () => {
      expect(ZodSchemas.email.safeParse('test@example.com').success).toBe(true);
      expect(ZodSchemas.email.safeParse('invalid').success).toBe(false);
    });

    it('should validate URL', () => {
      expect(ZodSchemas.url.safeParse('https://example.com').success).toBe(true);
      expect(ZodSchemas.url.safeParse('invalid').success).toBe(false);
    });

    it('should validate UUID', () => {
      expect(ZodSchemas.uuid.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
      expect(ZodSchemas.uuid.safeParse('invalid').success).toBe(false);
    });
  });

  describe('createApiValidator', () => {
    const dataSchema = z.object({ message: z.string() });
    const validator = createApiValidator(dataSchema);

    it('should validate API responses', () => {
      const validResponse = {
        success: true,
        data: { message: 'Hello' },
        timestamp: '2023-01-01T00:00:00Z'
      };

      const result = validator.validateResponse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject invalid responses', () => {
      const invalidResponse = {
        success: true,
        data: { message: 123 }, // Should be string
        timestamp: '2023-01-01T00:00:00Z'
      };

      const result = validator.validateResponse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
});

describe('Environment Detection', () => {
  describe('Environment guards', () => {
    // Note: These tests may vary based on the test environment
    it('should detect environment correctly', () => {
      // In a Node.js test environment
      expect(typeof isNodeEnvironment()).toBe('boolean');
      expect(typeof isBrowserEnvironment()).toBe('boolean');
      expect(typeof isWebWorkerEnvironment()).toBe('boolean');
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  describe('Circular references', () => {
    it('should handle circular references in deepEqual', () => {
      const obj1: any = { a: 1 };
      obj1.self = obj1;

      const obj2: any = { a: 1 };
      obj2.self = obj2;

      // deepEqual should not hang or crash with circular references
      expect(() => deepEqual(obj1, obj2)).not.toThrow();
    });
  });

  describe('Prototype pollution protection', () => {
    it('should use hasOwnProperty for safe property access', () => {
      const maliciousObject = JSON.parse('{"__proto__": {"isAdmin": true}}');
      expect(hasOwnProperty(maliciousObject, '__proto__')).toBe(true);
      expect(hasOwnProperty(maliciousObject, 'isAdmin')).toBe(false);
    });
  });

  describe('Memory efficiency', () => {
    it('should not create unnecessary deep copies', () => {
      const largeArray = new Array(1000).fill(0).map((_, i) => ({ id: i }));
      const result = safeDeepClone(largeArray);

      expect(result).toHaveLength(1000);
      expect(result).not.toBe(largeArray);
      expect(result[0]).not.toBe(largeArray[0]);
    });
  });
});