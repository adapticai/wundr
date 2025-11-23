/**
 * @wundr.io/hydra-config - Variable interpolation resolver
 *
 * This module handles ${...} style variable interpolation in configuration
 * values, supporting nested references, environment variables, and custom
 * resolvers.
 */

import { HydraConfigError, HydraErrorCode } from './types';

import type { InterpolationResolver as InterpolationResolverFn } from './types';

/**
 * Pattern for matching interpolation expressions.
 * Matches ${...} patterns with support for nested braces.
 */
const INTERPOLATION_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Pattern for matching environment variable references.
 * Matches ${env:VAR_NAME} or ${env:VAR_NAME:default}
 */
const ENV_VAR_PATTERN = /^env:([A-Z_][A-Z0-9_]*)(?::(.*))?$/i;

/**
 * Pattern for matching resolver references.
 * Matches ${resolver:key} patterns
 */
const RESOLVER_PATTERN = /^([a-z_][a-z0-9_]*):(.+)$/i;

/**
 * Options for interpolation resolution.
 */
export interface InterpolationOptions {
  /** Whether to throw on unresolved references */
  strict?: boolean;
  /** Maximum recursion depth for nested references */
  maxDepth?: number;
  /** Custom resolvers for specific prefixes */
  resolvers?: Record<string, InterpolationResolverFn>;
  /** Environment variables to use (defaults to process.env) */
  env?: Record<string, string | undefined>;
}

/**
 * Result of interpolation resolution.
 */
export interface InterpolationResult {
  /** The resolved value */
  value: unknown;
  /** References that were resolved */
  resolved: Map<string, unknown>;
  /** References that could not be resolved */
  unresolved: string[];
  /** Whether all references were successfully resolved */
  complete: boolean;
}

/**
 * Interpolation resolver class.
 * Handles ${...} style variable substitution in configuration values.
 */
export class InterpolationResolver {
  private readonly options: Required<InterpolationOptions>;
  private readonly resolved: Map<string, unknown> = new Map();
  private readonly unresolved: string[] = [];
  private currentDepth = 0;

  constructor(options: InterpolationOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      maxDepth: options.maxDepth ?? 10,
      resolvers: options.resolvers ?? {},
      env: options.env ?? (process.env as Record<string, string | undefined>),
    };
  }

  /**
   * Resolves all interpolations in a configuration object.
   * @param config - Configuration object with potential interpolations
   * @param context - Context object for resolving references
   * @returns Interpolation result with resolved values
   */
  resolve<T extends Record<string, unknown>>(
    config: T,
    context: Record<string, unknown> = {}
  ): InterpolationResult {
    this.resolved.clear();
    this.unresolved.length = 0;
    this.currentDepth = 0;

    const mergedContext = { ...config, ...context };
    const value = this.resolveValue(config, mergedContext);

    return {
      value,
      resolved: new Map(this.resolved),
      unresolved: [...this.unresolved],
      complete: this.unresolved.length === 0,
    };
  }

  /**
   * Resolves a single value, handling all types.
   * @param value - Value to resolve
   * @param context - Context for reference resolution
   * @returns Resolved value
   */
  private resolveValue(
    value: unknown,
    context: Record<string, unknown>
  ): unknown {
    if (typeof value === 'string') {
      return this.resolveString(value, context);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.resolveValue(item, context));
    }

    if (this.isPlainObject(value)) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.resolveValue(val, context);
      }
      return result;
    }

    return value;
  }

  /**
   * Resolves interpolations in a string value.
   * @param str - String with potential interpolations
   * @param context - Context for reference resolution
   * @returns Resolved string or value
   */
  private resolveString(
    str: string,
    context: Record<string, unknown>
  ): unknown {
    // Check if the entire string is a single interpolation
    const fullMatch = str.match(/^\$\{([^}]+)\}$/);
    if (fullMatch !== null) {
      const result = this.resolveReference(fullMatch[1] as string, context);
      // Return the actual type if entire string is interpolation
      return result;
    }

    // Replace all interpolations in the string
    return str.replace(INTERPOLATION_PATTERN, (_, ref: string) => {
      const result = this.resolveReference(ref, context);
      return String(result ?? `\${${ref}}`);
    });
  }

  /**
   * Resolves a single reference expression.
   * @param ref - Reference expression (without ${})
   * @param context - Context for resolution
   * @returns Resolved value
   */
  private resolveReference(
    ref: string,
    context: Record<string, unknown>
  ): unknown {
    // Check recursion depth
    if (this.currentDepth >= this.options.maxDepth) {
      throw new HydraConfigError(
        `Maximum interpolation depth (${this.options.maxDepth}) exceeded`,
        HydraErrorCode.CIRCULAR_REFERENCE,
        { reference: ref }
      );
    }

    this.currentDepth++;

    try {
      // Check for environment variable reference
      const envMatch = ref.match(ENV_VAR_PATTERN);
      if (envMatch !== null) {
        return this.resolveEnvVar(
          envMatch[1] as string,
          envMatch[2] as string | undefined
        );
      }

      // Check for custom resolver reference
      const resolverMatch = ref.match(RESOLVER_PATTERN);
      if (resolverMatch !== null) {
        const resolverName = resolverMatch[1] as string;
        const resolverKey = resolverMatch[2] as string;
        return this.resolveCustom(resolverName, resolverKey, context);
      }

      // Resolve from context (dot notation supported)
      return this.resolveFromContext(ref, context);
    } finally {
      this.currentDepth--;
    }
  }

  /**
   * Resolves an environment variable reference.
   * @param name - Environment variable name
   * @param defaultValue - Optional default value
   * @returns Environment variable value or default
   */
  private resolveEnvVar(
    name: string,
    defaultValue: string | undefined
  ): string | undefined {
    const value = this.options.env[name];

    if (value !== undefined) {
      this.resolved.set(`env:${name}`, value);
      return value;
    }

    if (defaultValue !== undefined) {
      this.resolved.set(`env:${name}`, defaultValue);
      return defaultValue;
    }

    if (this.options.strict) {
      throw new HydraConfigError(
        `Environment variable '${name}' is not defined`,
        HydraErrorCode.INTERPOLATION_ERROR,
        { variable: name }
      );
    }

    this.unresolved.push(`env:${name}`);
    return undefined;
  }

  /**
   * Resolves a custom resolver reference.
   * @param resolverName - Name of the resolver
   * @param key - Key to resolve
   * @param context - Resolution context
   * @returns Resolved value
   */
  private resolveCustom(
    resolverName: string,
    key: string,
    context: Record<string, unknown>
  ): unknown {
    const resolver = this.options.resolvers[resolverName];

    if (resolver === undefined) {
      if (this.options.strict) {
        throw new HydraConfigError(
          `Unknown resolver '${resolverName}'`,
          HydraErrorCode.INTERPOLATION_ERROR,
          { resolver: resolverName, key }
        );
      }

      this.unresolved.push(`${resolverName}:${key}`);
      return undefined;
    }

    const value = resolver(key, context);
    this.resolved.set(`${resolverName}:${key}`, value);
    return value;
  }

  /**
   * Resolves a reference from the context using dot notation.
   * @param path - Dot-notation path (e.g., 'a.b.c')
   * @param context - Context object
   * @returns Value at path or undefined
   */
  private resolveFromContext(
    path: string,
    context: Record<string, unknown>
  ): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        if (this.options.strict) {
          throw new HydraConfigError(
            `Cannot resolve '${path}': intermediate value is not an object`,
            HydraErrorCode.INTERPOLATION_ERROR,
            { path, failedAt: part }
          );
        }
        this.unresolved.push(path);
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) {
      if (this.options.strict) {
        throw new HydraConfigError(
          `Reference '${path}' could not be resolved`,
          HydraErrorCode.INTERPOLATION_ERROR,
          { path }
        );
      }
      this.unresolved.push(path);
      return undefined;
    }

    // Recursively resolve if the result contains interpolations
    if (typeof current === 'string' && INTERPOLATION_PATTERN.test(current)) {
      current = this.resolveString(current, context);
    }

    this.resolved.set(path, current);
    return current;
  }

  /**
   * Checks if a value is a plain object.
   * @param value - Value to check
   * @returns True if plain object
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }
}

/**
 * Default interpolation resolver instance.
 */
export const interpolationResolver = new InterpolationResolver();

/**
 * Convenience function to resolve interpolations in a config object.
 * @param config - Configuration with interpolations
 * @param context - Additional context for resolution
 * @param options - Interpolation options
 * @returns Resolved configuration
 */
export function resolveInterpolations<T extends Record<string, unknown>>(
  config: T,
  context: Record<string, unknown> = {},
  options: InterpolationOptions = {}
): T {
  const resolver = new InterpolationResolver(options);
  const result = resolver.resolve(config, context);

  if (options.strict && !result.complete) {
    throw new HydraConfigError(
      `Unresolved interpolations: ${result.unresolved.join(', ')}`,
      HydraErrorCode.INTERPOLATION_ERROR,
      { unresolved: result.unresolved }
    );
  }

  return result.value as T;
}

/**
 * Checks if a string contains interpolation expressions.
 * @param str - String to check
 * @returns True if string contains ${...} patterns
 */
export function hasInterpolations(str: string): boolean {
  return INTERPOLATION_PATTERN.test(str);
}

/**
 * Extracts all interpolation references from a string.
 * @param str - String to extract from
 * @returns Array of reference expressions
 */
export function extractInterpolations(str: string): string[] {
  const matches: string[] = [];
  let match;

  const pattern = new RegExp(INTERPOLATION_PATTERN);
  while ((match = pattern.exec(str)) !== null) {
    matches.push(match[1] as string);
  }

  return matches;
}
