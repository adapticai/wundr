"use strict";
/**
 * Object manipulation utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepClone = deepClone;
exports.deepMerge = deepMerge;
exports.getNestedValue = getNestedValue;
exports.setNestedValue = setNestedValue;
exports.removeEmpty = removeEmpty;
exports.pick = pick;
exports.omit = omit;
exports.flatten = flatten;
exports.unflatten = unflatten;
/**
 * Deep clones an object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    if (typeof obj === 'object') {
        const clonedObj = {};
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
function deepMerge(...objects) {
    if (objects.length === 0) {
        return {};
    }
    if (objects.length === 1) {
        return deepClone(objects[0]);
    }
    const target = {};
    for (const obj of objects) {
        if (obj && typeof obj === 'object') {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const value = obj[key];
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        target[key] = deepMerge(target[key] || {}, value);
                    }
                    else {
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
function getNestedValue(obj, path, defaultValue) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        }
        else {
            return defaultValue;
        }
    }
    return current;
}
/**
 * Sets a nested property value using dot notation
 */
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
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
function removeEmpty(obj, options = {}) {
    const { removeNull = true, removeUndefined = true, removeEmptyStrings = true, removeEmptyArrays = true, removeEmptyObjects = true, } = options;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        let shouldRemove = false;
        if (value === null && removeNull) {
            shouldRemove = true;
        }
        else if (value === undefined && removeUndefined) {
            shouldRemove = true;
        }
        else if (value === '' && removeEmptyStrings) {
            shouldRemove = true;
        }
        else if (Array.isArray(value) && value.length === 0 && removeEmptyArrays) {
            shouldRemove = true;
        }
        else if (value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            Object.keys(value).length === 0 &&
            removeEmptyObjects) {
            shouldRemove = true;
        }
        if (!shouldRemove) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const cleaned = removeEmpty(value, options);
                if (Object.keys(cleaned).length > 0 || !removeEmptyObjects) {
                    result[key] = cleaned;
                }
            }
            else {
                result[key] = value;
            }
        }
    }
    return result;
}
/**
 * Picks specific properties from an object
 */
function pick(obj, keys) {
    const result = {};
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
function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}
/**
 * Flattens a nested object into a flat object with dot notation keys
 */
function flatten(obj, prefix = '', separator = '.') {
    const flattened = {};
    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}${separator}${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(flattened, flatten(value, newKey, separator));
        }
        else {
            flattened[newKey] = value;
        }
    }
    return flattened;
}
/**
 * Unflattens a flat object with dot notation keys into a nested object
 */
function unflatten(obj, separator = '.') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        setNestedValue(result, key.split(separator).join('.'), value);
    }
    return result;
}
//# sourceMappingURL=object.js.map