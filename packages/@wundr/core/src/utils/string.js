"use strict";
/**
 * String manipulation utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCamelCase = toCamelCase;
exports.toPascalCase = toPascalCase;
exports.toKebabCase = toKebabCase;
exports.toSnakeCase = toSnakeCase;
exports.capitalize = capitalize;
exports.truncate = truncate;
exports.escapeHtml = escapeHtml;
exports.unescapeHtml = unescapeHtml;
exports.pad = pad;
exports.trim = trim;
exports.escapeRegExp = escapeRegExp;
exports.randomString = randomString;
exports.wordCount = wordCount;
exports.pluralize = pluralize;
exports.template = template;
/**
 * Converts a string to camelCase
 */
function toCamelCase(str) {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
        .replace(/\s+/g, '');
}
/**
 * Converts a string to PascalCase
 */
function toPascalCase(str) {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase())
        .replace(/\s+/g, '');
}
/**
 * Converts a string to kebab-case
 */
function toKebabCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}
/**
 * Converts a string to snake_case
 */
function toSnakeCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}
/**
 * Capitalizes the first letter of a string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
/**
 * Truncates a string to a specified length
 */
function truncate(str, length, suffix = '...') {
    if (str.length <= length) {
        return str;
    }
    return str.slice(0, length - suffix.length) + suffix;
}
/**
 * Escapes HTML characters in a string
 */
function escapeHtml(str) {
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return str.replace(/[&<>"']/g, match => htmlEscapes[match]);
}
/**
 * Unescapes HTML characters in a string
 */
function unescapeHtml(str) {
    const htmlUnescapes = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
    };
    return str.replace(/&(?:amp|lt|gt|quot|#39);/g, match => htmlUnescapes[match]);
}
/**
 * Pads a string to a specified length
 */
function pad(str, length, char = ' ', direction = 'left') {
    if (str.length >= length) {
        return str;
    }
    const padLength = length - str.length;
    switch (direction) {
        case 'left':
            return char.repeat(padLength) + str;
        case 'right':
            return str + char.repeat(padLength);
        case 'both': {
            const leftPad = Math.floor(padLength / 2);
            const rightPad = padLength - leftPad;
            return char.repeat(leftPad) + str + char.repeat(rightPad);
        }
        default:
            return str;
    }
}
/**
 * Removes whitespace from both ends of a string
 */
function trim(str, chars) {
    if (!chars) {
        return str.trim();
    }
    const pattern = new RegExp(`^[${escapeRegExp(chars)}]+|[${escapeRegExp(chars)}]+$`, 'g');
    return str.replace(pattern, '');
}
/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Generates a random string of specified length
 */
function randomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    const charsetLength = charset.length;
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charsetLength));
    }
    return result;
}
/**
 * Counts the number of words in a string
 */
function wordCount(str) {
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}
/**
 * Pluralizes a word based on count
 */
function pluralize(word, count, pluralForm) {
    if (count === 1) {
        return word;
    }
    if (pluralForm) {
        return pluralForm;
    }
    // Simple pluralization rules
    if (word.endsWith('y') && !isVowel(word[word.length - 2])) {
        return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') ||
        word.endsWith('x') || word.endsWith('z')) {
        return word + 'es';
    }
    return word + 's';
}
/**
 * Checks if a character is a vowel
 */
function isVowel(char) {
    return 'aeiouAEIOU'.includes(char);
}
/**
 * Template string interpolation
 */
function template(str, data, options = {}) {
    const { prefix = '{{', suffix = '}}', transform } = options;
    const regex = new RegExp(`${escapeRegExp(prefix)}\\s*([^${escapeRegExp(suffix)}]+)\\s*${escapeRegExp(suffix)}`, 'g');
    return str.replace(regex, (match, key) => {
        const value = data[key.trim()];
        if (value === undefined || value === null) {
            return match; // Keep original if no replacement found
        }
        return transform ? transform(key, value) : String(value);
    });
}
//# sourceMappingURL=string.js.map