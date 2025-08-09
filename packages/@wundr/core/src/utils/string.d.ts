/**
 * String manipulation utility functions
 */
/**
 * Converts a string to camelCase
 */
export declare function toCamelCase(str: string): string;
/**
 * Converts a string to PascalCase
 */
export declare function toPascalCase(str: string): string;
/**
 * Converts a string to kebab-case
 */
export declare function toKebabCase(str: string): string;
/**
 * Converts a string to snake_case
 */
export declare function toSnakeCase(str: string): string;
/**
 * Capitalizes the first letter of a string
 */
export declare function capitalize(str: string): string;
/**
 * Truncates a string to a specified length
 */
export declare function truncate(str: string, length: number, suffix?: string): string;
/**
 * Escapes HTML characters in a string
 */
export declare function escapeHtml(str: string): string;
/**
 * Unescapes HTML characters in a string
 */
export declare function unescapeHtml(str: string): string;
/**
 * Pads a string to a specified length
 */
export declare function pad(str: string, length: number, char?: string, direction?: 'left' | 'right' | 'both'): string;
/**
 * Removes whitespace from both ends of a string
 */
export declare function trim(str: string, chars?: string): string;
/**
 * Escapes special regex characters in a string
 */
export declare function escapeRegExp(str: string): string;
/**
 * Generates a random string of specified length
 */
export declare function randomString(length: number, charset?: string): string;
/**
 * Counts the number of words in a string
 */
export declare function wordCount(str: string): number;
/**
 * Pluralizes a word based on count
 */
export declare function pluralize(word: string, count: number, pluralForm?: string): string;
/**
 * Template string interpolation
 */
export declare function template(str: string, data: Record<string, any>, options?: {
    prefix?: string;
    suffix?: string;
    transform?: (key: string, value: any) => string;
}): string;
//# sourceMappingURL=string.d.ts.map