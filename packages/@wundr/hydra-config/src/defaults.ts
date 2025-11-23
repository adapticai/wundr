/**
 * @wundr.io/hydra-config - Default configuration handling
 *
 * This module provides utilities for managing default configuration values,
 * including deep merging, priority resolution, and schema-based defaults.
 */

import { z } from 'zod';

import type { ConfigDefaults, ConfigGroup, HydraConfig } from './types';

/**
 * Options for default configuration handling.
 */
export interface DefaultsOptions {
  /** Whether to perform deep merge (true) or shallow merge (false) */
  deepMerge?: boolean;
  /** Whether to preserve undefined values during merge */
  preserveUndefined?: boolean;
  /** Custom merge strategy for specific keys */
  mergeStrategies?: Record<string, MergeStrategy>;
}

/**
 * Merge strategy types for configuration values.
 */
export type MergeStrategy = 'replace' | 'merge' | 'append' | 'prepend';

/**
 * Default configuration manager.
 * Handles loading, merging, and resolving default configuration values.
 */
export class DefaultsManager {
  private readonly options: Required<DefaultsOptions>;

  constructor(options: DefaultsOptions = {}) {
    this.options = {
      deepMerge: options.deepMerge ?? true,
      preserveUndefined: options.preserveUndefined ?? false,
      mergeStrategies: options.mergeStrategies ?? {},
    };
  }

  /**
   * Creates an empty defaults list.
   * @returns An empty array of ConfigDefaults
   */
  createEmptyDefaults(): ConfigDefaults[] {
    return [];
  }

  /**
   * Creates a default configuration entry from a file path.
   * @param path - Path to the configuration file
   * @param optional - Whether this default is optional
   * @returns A ConfigDefaults object
   */
  createFromPath(path: string, optional = false): ConfigDefaults {
    return { path, optional };
  }

  /**
   * Creates a default configuration entry from a group reference.
   * @param group - Group name
   * @param variant - Optional variant within the group
   * @param optional - Whether this default is optional
   * @returns A ConfigDefaults object
   */
  createFromGroup(
    group: string,
    variant?: string,
    optional = false
  ): ConfigDefaults {
    const result: ConfigDefaults = { group, optional };
    if (variant !== undefined) {
      result.variant = variant;
    }
    return result;
  }

  /**
   * Merges multiple configuration objects with proper precedence.
   * Later configs override earlier ones.
   * @param configs - Array of configuration objects to merge
   * @returns Merged configuration object
   */
  mergeConfigs<T extends Record<string, unknown>>(configs: T[]): T {
    if (configs.length === 0) {
      return {} as T;
    }

    return configs.reduce((merged, current) => {
      return this.deepMerge(merged, current) as T;
    });
  }

  /**
   * Performs a deep merge of two objects.
   * @param target - Target object to merge into
   * @param source - Source object to merge from
   * @returns Merged object
   */
  deepMerge<T extends Record<string, unknown>>(
    target: T,
    source: Record<string, unknown>
  ): T {
    if (!this.options.deepMerge) {
      return { ...target, ...source } as T;
    }

    const result = { ...target } as Record<string, unknown>;

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      // Check for custom merge strategy
      const strategy = this.options.mergeStrategies[key];
      if (strategy !== undefined) {
        result[key] = this.applyMergeStrategy(
          strategy,
          targetValue,
          sourceValue
        );
        continue;
      }

      // Handle undefined values
      if (sourceValue === undefined) {
        if (!this.options.preserveUndefined) {
          continue;
        }
        result[key] = undefined;
        continue;
      }

      // Deep merge objects
      if (this.isPlainObject(sourceValue) && this.isPlainObject(targetValue)) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        result[key] = sourceValue;
      }
    }

    return result as T;
  }

  /**
   * Applies a specific merge strategy to two values.
   * @param strategy - The merge strategy to apply
   * @param target - Target value
   * @param source - Source value
   * @returns Merged value
   */
  private applyMergeStrategy(
    strategy: MergeStrategy,
    target: unknown,
    source: unknown
  ): unknown {
    switch (strategy) {
      case 'replace':
        return source;

      case 'merge':
        if (this.isPlainObject(target) && this.isPlainObject(source)) {
          return this.deepMerge(
            target as Record<string, unknown>,
            source as Record<string, unknown>
          );
        }
        return source;

      case 'append':
        if (Array.isArray(target) && Array.isArray(source)) {
          return [...target, ...source];
        }
        return source;

      case 'prepend':
        if (Array.isArray(target) && Array.isArray(source)) {
          return [...source, ...target];
        }
        return source;

      default:
        return source;
    }
  }

  /**
   * Checks if a value is a plain object (not an array or null).
   * @param value - Value to check
   * @returns True if value is a plain object
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  /**
   * Resolves defaults order from a HydraConfig.
   * Returns an ordered list of paths to load.
   * @param config - Hydra configuration
   * @returns Ordered array of paths to load
   */
  resolveDefaultsOrder(
    config: HydraConfig
  ): Array<{ path: string; optional: boolean }> {
    const result: Array<{ path: string; optional: boolean }> = [];

    for (const defaultEntry of config.defaults) {
      if (defaultEntry.path !== undefined) {
        result.push({
          path: defaultEntry.path,
          optional: defaultEntry.optional ?? false,
        });
      } else if (defaultEntry.group !== undefined) {
        const group = config.groups[defaultEntry.group];
        if (group !== undefined) {
          result.push({
            path: group.path,
            optional: defaultEntry.optional ?? group.optional ?? false,
          });
        }
      }
    }

    return result;
  }

  /**
   * Creates default values from a Zod schema.
   * Extracts default values defined in the schema.
   * @param schema - Zod schema with default values
   * @returns Object with default values
   */
  createFromSchema<T>(schema: z.ZodType<T>): Partial<T> {
    // For ZodObject schemas, extract defaults from shape
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, z.ZodType<unknown>>;
      const defaults: Record<string, unknown> = {};

      for (const [key, fieldSchema] of Object.entries(shape)) {
        const defaultValue = this.extractDefault(fieldSchema);
        if (defaultValue !== undefined) {
          defaults[key] = defaultValue;
        }
      }

      return defaults as Partial<T>;
    }

    return {} as Partial<T>;
  }

  /**
   * Extracts the default value from a Zod schema if present.
   * @param schema - Zod schema
   * @returns Default value or undefined
   */
  private extractDefault(schema: z.ZodType<unknown>): unknown {
    // Handle ZodDefault
    if (schema instanceof z.ZodDefault) {
      return schema._def.defaultValue();
    }

    // Handle ZodOptional with inner default
    if (schema instanceof z.ZodOptional) {
      return this.extractDefault(schema.unwrap());
    }

    return undefined;
  }

  /**
   * Validates that required fields have values.
   * @param config - Configuration to validate
   * @param requiredFields - List of required field paths (dot notation)
   * @returns Array of missing field paths
   */
  validateRequired(
    config: Record<string, unknown>,
    requiredFields: string[]
  ): string[] {
    const missing: string[] = [];

    for (const field of requiredFields) {
      const value = this.getNestedValue(config, field);
      if (value === undefined || value === null) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * Gets a nested value from an object using dot notation.
   * @param obj - Object to get value from
   * @param path - Dot-notation path (e.g., 'a.b.c')
   * @returns Value at path or undefined
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Creates a ConfigGroup with default values.
   * @param name - Group name
   * @param path - Path to configuration file
   * @param values - Default values for the group
   * @param description - Optional description
   * @returns ConfigGroup object
   */
  createGroup(
    name: string,
    path: string,
    values: Record<string, unknown> = {},
    description?: string
  ): ConfigGroup {
    const result: ConfigGroup = {
      name,
      path,
      optional: false,
      values,
    };
    if (description !== undefined) {
      result.description = description;
    }
    return result;
  }
}

/**
 * Default instance of DefaultsManager with standard options.
 */
export const defaultsManager = new DefaultsManager();

/**
 * Convenience function to merge multiple configs.
 * @param configs - Configuration objects to merge
 * @returns Merged configuration
 */
export function mergeDefaults<T extends Record<string, unknown>>(
  ...configs: T[]
): T {
  return defaultsManager.mergeConfigs(configs);
}
