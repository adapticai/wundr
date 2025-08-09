/**
 * Object manipulation utility functions
 */
/**
 * Deep clones an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Deep merges multiple objects
 */
export declare function deepMerge<T extends Record<string, any>>(...objects: T[]): T;
/**
 * Gets a nested property value using dot notation
 */
export declare function getNestedValue<T = any>(obj: Record<string, any>, path: string, defaultValue?: T): T | undefined;
/**
 * Sets a nested property value using dot notation
 */
export declare function setNestedValue(obj: Record<string, any>, path: string, value: any): void;
/**
 * Removes empty values from an object
 */
export declare function removeEmpty<T extends Record<string, any>>(obj: T, options?: {
    removeNull?: boolean;
    removeUndefined?: boolean;
    removeEmptyStrings?: boolean;
    removeEmptyArrays?: boolean;
    removeEmptyObjects?: boolean;
}): Partial<T>;
/**
 * Picks specific properties from an object
 */
export declare function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Omits specific properties from an object
 */
export declare function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Flattens a nested object into a flat object with dot notation keys
 */
export declare function flatten(obj: Record<string, any>, prefix?: string, separator?: string): Record<string, any>;
/**
 * Unflattens a flat object with dot notation keys into a nested object
 */
export declare function unflatten(obj: Record<string, any>, separator?: string): Record<string, any>;
//# sourceMappingURL=object.d.ts.map