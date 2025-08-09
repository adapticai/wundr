"use strict";
/**
 * Validation utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonSchemas = void 0;
exports.validateWithSchema = validateWithSchema;
exports.isValidEmail = isValidEmail;
exports.isValidUrl = isValidUrl;
exports.isValidUuid = isValidUuid;
exports.isValidSemver = isValidSemver;
exports.isValidFilePath = isValidFilePath;
exports.isValidPort = isValidPort;
exports.isValidIPv4 = isValidIPv4;
exports.isValidIPv6 = isValidIPv6;
exports.isEmpty = isEmpty;
exports.isPlainObject = isPlainObject;
exports.isString = isString;
exports.isNumber = isNumber;
exports.isBoolean = isBoolean;
exports.isFunction = isFunction;
exports.isArray = isArray;
exports.isDate = isDate;
exports.isPromise = isPromise;
const zod_1 = require("zod");
/**
 * Validates data against a Zod schema and returns a ValidationResult
 */
function validateWithSchema(data, schema) {
    try {
        const validatedData = schema.parse(data);
        return {
            success: true,
            data: validatedData,
        };
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return {
                success: false,
                errors: error.errors.map(err => ({
                    path: err.path.map(String),
                    message: err.message,
                    code: err.code,
                })),
            };
        }
        return {
            success: false,
            errors: [{
                    path: [],
                    message: error instanceof Error ? error.message : 'Unknown validation error',
                    code: 'UNKNOWN_ERROR',
                }],
        };
    }
}
/**
 * Email validation
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * URL validation
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * UUID validation (v4)
 */
function isValidUuid(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
/**
 * Semantic version validation
 */
function isValidSemver(version) {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
}
/**
 * File path validation
 */
function isValidFilePath(path) {
    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
        return false;
    }
    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.[^.]*)?$/i;
    const pathParts = path.split(/[\\/]/);
    return !pathParts.some(part => reservedNames.test(part));
}
/**
 * Port number validation
 */
function isValidPort(port) {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
    return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
}
/**
 * IP address validation (IPv4)
 */
function isValidIPv4(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
}
/**
 * IP address validation (IPv6)
 */
function isValidIPv6(ip) {
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv6Regex.test(ip);
}
/**
 * Checks if a value is empty (null, undefined, empty string, empty array, empty object)
 */
function isEmpty(value) {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'string') {
        return value.trim() === '';
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value).length === 0;
    }
    return false;
}
/**
 * Checks if a value is a plain object
 */
function isPlainObject(value) {
    return (value !== null &&
        typeof value === 'object' &&
        value.constructor === Object);
}
/**
 * Type guard for checking if a value is a string
 */
function isString(value) {
    return typeof value === 'string';
}
/**
 * Type guard for checking if a value is a number
 */
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}
/**
 * Type guard for checking if a value is a boolean
 */
function isBoolean(value) {
    return typeof value === 'boolean';
}
/**
 * Type guard for checking if a value is a function
 */
function isFunction(value) {
    return typeof value === 'function';
}
/**
 * Type guard for checking if a value is an array
 */
function isArray(value) {
    return Array.isArray(value);
}
/**
 * Type guard for checking if a value is a Date
 */
function isDate(value) {
    return value instanceof Date && !isNaN(value.getTime());
}
/**
 * Type guard for checking if a value is a Promise
 */
function isPromise(value) {
    return (value !== null &&
        typeof value === 'object' &&
        'then' in value &&
        typeof value.then === 'function');
}
/**
 * Common Zod schemas for reuse
 */
exports.CommonSchemas = {
    email: zod_1.z.string().email(),
    url: zod_1.z.string().url(),
    uuid: zod_1.z.string().uuid(),
    semver: zod_1.z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/),
    port: zod_1.z.number().int().min(1).max(65535),
    ipv4: zod_1.z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/),
    nonEmptyString: zod_1.z.string().min(1),
    positiveNumber: zod_1.z.number().positive(),
    nonNegativeNumber: zod_1.z.number().nonnegative(),
};
//# sourceMappingURL=validation.js.map