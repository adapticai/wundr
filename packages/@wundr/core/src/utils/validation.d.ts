/**
 * Validation utility functions
 */
import { z, ZodSchema } from 'zod';
import { ValidationResult } from '../types/index.js';
/**
 * Validates data against a Zod schema and returns a ValidationResult
 */
export declare function validateWithSchema<T>(data: unknown, schema: ZodSchema<T>): ValidationResult<T>;
/**
 * Email validation
 */
export declare function isValidEmail(email: string): boolean;
/**
 * URL validation
 */
export declare function isValidUrl(url: string): boolean;
/**
 * UUID validation (v4)
 */
export declare function isValidUuid(uuid: string): boolean;
/**
 * Semantic version validation
 */
export declare function isValidSemver(version: string): boolean;
/**
 * File path validation
 */
export declare function isValidFilePath(path: string): boolean;
/**
 * Port number validation
 */
export declare function isValidPort(port: number | string): boolean;
/**
 * IP address validation (IPv4)
 */
export declare function isValidIPv4(ip: string): boolean;
/**
 * IP address validation (IPv6)
 */
export declare function isValidIPv6(ip: string): boolean;
/**
 * Checks if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export declare function isEmpty(value: unknown): boolean;
/**
 * Checks if a value is a plain object
 */
export declare function isPlainObject(value: unknown): value is Record<string, any>;
/**
 * Type guard for checking if a value is a string
 */
export declare function isString(value: unknown): value is string;
/**
 * Type guard for checking if a value is a number
 */
export declare function isNumber(value: unknown): value is number;
/**
 * Type guard for checking if a value is a boolean
 */
export declare function isBoolean(value: unknown): value is boolean;
/**
 * Type guard for checking if a value is a function
 */
export declare function isFunction(value: unknown): value is Function;
/**
 * Type guard for checking if a value is an array
 */
export declare function isArray(value: unknown): value is unknown[];
/**
 * Type guard for checking if a value is a Date
 */
export declare function isDate(value: unknown): value is Date;
/**
 * Type guard for checking if a value is a Promise
 */
export declare function isPromise(value: unknown): value is Promise<unknown>;
/**
 * Common Zod schemas for reuse
 */
export declare const CommonSchemas: {
    email: z.ZodString;
    url: z.ZodString;
    uuid: z.ZodString;
    semver: z.ZodString;
    port: z.ZodNumber;
    ipv4: z.ZodString;
    nonEmptyString: z.ZodString;
    positiveNumber: z.ZodNumber;
    nonNegativeNumber: z.ZodNumber;
};
//# sourceMappingURL=validation.d.ts.map