/**
 * Config Merger: Deep Merge, $include Resolution, and Env Var Substitution
 *
 * Ported from OpenClaw's includes.ts + env-substitution.ts + merge-config.ts.
 * Provides composable configuration from multiple files with environment
 * variable interpolation.
 *
 * @module @wundr/orchestrator-daemon/config/config-merger
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Constants
// =============================================================================

export const INCLUDE_KEY = '$include';
export const MAX_INCLUDE_DEPTH = 10;

/** Pattern for valid uppercase env var names */
const ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

// =============================================================================
// Types
// =============================================================================

export interface IncludeResolver {
  readFile: (filePath: string) => string;
  parseJson: (raw: string) => unknown;
}

// =============================================================================
// Errors
// =============================================================================

export class ConfigIncludeError extends Error {
  constructor(
    message: string,
    public readonly includePath: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ConfigIncludeError';
  }
}

export class CircularIncludeError extends ConfigIncludeError {
  constructor(public readonly chain: string[]) {
    super(
      `Circular include detected: ${chain.join(' -> ')}`,
      chain[chain.length - 1],
    );
    this.name = 'CircularIncludeError';
  }
}

export class MissingEnvVarError extends Error {
  constructor(
    public readonly varName: string,
    public readonly configPath: string,
  ) {
    super(`Missing env var "${varName}" referenced at config path: ${configPath}`);
    this.name = 'MissingEnvVarError';
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Array merge strategies for deep merge operations.
 *
 * - 'concat':  Concatenate arrays (default)
 * - 'replace': Source array replaces target entirely
 * - 'union':   Deduplicate elements (primitives only; uses strict equality)
 * - 'prepend': Source elements are prepended to target
 * - 'byKey':   Merge array-of-objects by a key field (e.g. merge by "id")
 */
export type ArrayMergeStrategy =
  | 'concat'
  | 'replace'
  | 'union'
  | 'prepend'
  | 'byKey';

export interface DeepMergeOptions {
  /**
   * Default array merge strategy.
   * @default 'concat'
   */
  arrayStrategy?: ArrayMergeStrategy;

  /**
   * Per-path array merge overrides.
   * Keys are dot-separated config paths; values are the strategy to use.
   *
   * Example:
   *   { 'agents.list': 'byKey', 'security.cors.origins': 'union' }
   */
  arrayStrategyByPath?: Record<string, ArrayMergeStrategy>;

  /**
   * Key field name for 'byKey' array strategy.
   * @default 'id'
   */
  arrayMergeKey?: string;
}

// =============================================================================
// Utilities
// =============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

// =============================================================================
// Array Merge Strategies
// =============================================================================

function mergeArrayConcat(target: unknown[], source: unknown[]): unknown[] {
  return [...target, ...source];
}

function mergeArrayReplace(_target: unknown[], source: unknown[]): unknown[] {
  return [...source];
}

function mergeArrayUnion(target: unknown[], source: unknown[]): unknown[] {
  const result = [...target];
  for (const item of source) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

function mergeArrayPrepend(target: unknown[], source: unknown[]): unknown[] {
  return [...source, ...target];
}

function mergeArrayByKey(
  target: unknown[],
  source: unknown[],
  mergeKey: string,
): unknown[] {
  const result = [...target];
  const indexMap = new Map<unknown, number>();

  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    if (isPlainObject(item) && mergeKey in item) {
      indexMap.set(item[mergeKey], i);
    }
  }

  for (const sourceItem of source) {
    if (!isPlainObject(sourceItem) || !(mergeKey in sourceItem)) {
      result.push(sourceItem);
      continue;
    }

    const key = sourceItem[mergeKey];
    const existingIdx = indexMap.get(key);

    if (existingIdx !== undefined) {
      // Merge with existing item
      result[existingIdx] = deepMergeInternal(
        result[existingIdx],
        sourceItem,
        'concat',
        {},
        'id',
        '',
      );
    } else {
      result.push(sourceItem);
      indexMap.set(key, result.length - 1);
    }
  }

  return result;
}

function applyArrayStrategy(
  target: unknown[],
  source: unknown[],
  strategy: ArrayMergeStrategy,
  mergeKey: string,
): unknown[] {
  switch (strategy) {
    case 'concat':
      return mergeArrayConcat(target, source);
    case 'replace':
      return mergeArrayReplace(target, source);
    case 'union':
      return mergeArrayUnion(target, source);
    case 'prepend':
      return mergeArrayPrepend(target, source);
    case 'byKey':
      return mergeArrayByKey(target, source, mergeKey);
    default:
      return mergeArrayConcat(target, source);
  }
}

// =============================================================================
// Internal Deep Merge
// =============================================================================

function resolveArrayStrategy(
  currentPath: string,
  defaultStrategy: ArrayMergeStrategy,
  byPath: Record<string, ArrayMergeStrategy>,
): ArrayMergeStrategy {
  if (currentPath && currentPath in byPath) {
    return byPath[currentPath];
  }
  return defaultStrategy;
}

function deepMergeInternal(
  target: unknown,
  source: unknown,
  arrayStrategy: ArrayMergeStrategy,
  arrayStrategyByPath: Record<string, ArrayMergeStrategy>,
  arrayMergeKey: string,
  currentPath: string,
): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    const strategy = resolveArrayStrategy(
      currentPath,
      arrayStrategy,
      arrayStrategyByPath,
    );
    return applyArrayStrategy(target, source, strategy, arrayMergeKey);
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      result[key] = key in result
        ? deepMergeInternal(
            result[key],
            source[key],
            arrayStrategy,
            arrayStrategyByPath,
            arrayMergeKey,
            childPath,
          )
        : source[key];
    }
    return result;
  }
  return source;
}

// =============================================================================
// Public Deep Merge
// =============================================================================

/**
 * Deep merge two values.
 *
 * - Arrays: strategy-dependent (default: concatenate)
 * - Objects: merge recursively (source wins for conflicts)
 * - Primitives: source wins
 *
 * @param target - Base value
 * @param source - Override value
 * @param options - Merge options (array strategies, per-path overrides)
 */
export function deepMerge(
  target: unknown,
  source: unknown,
  options?: DeepMergeOptions,
): unknown {
  const arrayStrategy = options?.arrayStrategy ?? 'concat';
  const arrayStrategyByPath = options?.arrayStrategyByPath ?? {};
  const arrayMergeKey = options?.arrayMergeKey ?? 'id';

  return deepMergeInternal(
    target,
    source,
    arrayStrategy,
    arrayStrategyByPath,
    arrayMergeKey,
    '',
  );
}

/**
 * Merge a config section with a partial patch.
 * Keys with undefined values in the patch are skipped unless listed in unsetOnUndefined.
 */
export function mergeConfigSection<T extends Record<string, unknown>>(
  base: T | undefined,
  patch: Partial<T>,
  options: { unsetOnUndefined?: Array<keyof T> } = {},
): T {
  const next: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
    if (value === undefined) {
      if (options.unsetOnUndefined?.includes(key)) {
        delete next[key as string];
      }
      continue;
    }
    next[key as string] = value as unknown;
  }
  return next as T;
}

// =============================================================================
// Include Processor
// =============================================================================

class IncludeProcessor {
  private visited = new Set<string>();
  private depth = 0;

  constructor(
    private basePath: string,
    private resolver: IncludeResolver,
  ) {
    this.visited.add(path.normalize(basePath));
  }

  process(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.process(item));
    }

    if (!isPlainObject(obj)) {
      return obj;
    }

    if (!(INCLUDE_KEY in obj)) {
      return this.processObject(obj);
    }

    return this.processInclude(obj);
  }

  private processObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.process(value);
    }
    return result;
  }

  private processInclude(obj: Record<string, unknown>): unknown {
    const includeValue = obj[INCLUDE_KEY];
    const otherKeys = Object.keys(obj).filter((k) => k !== INCLUDE_KEY);
    const included = this.resolveInclude(includeValue);

    if (otherKeys.length === 0) {
      return included;
    }

    if (!isPlainObject(included)) {
      throw new ConfigIncludeError(
        'Sibling keys require included content to be an object',
        typeof includeValue === 'string' ? includeValue : INCLUDE_KEY,
      );
    }

    const rest: Record<string, unknown> = {};
    for (const key of otherKeys) {
      rest[key] = this.process(obj[key]);
    }
    return deepMerge(included, rest);
  }

  private resolveInclude(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.loadFile(value);
    }

    if (Array.isArray(value)) {
      return value.reduce<unknown>((merged, item) => {
        if (typeof item !== 'string') {
          throw new ConfigIncludeError(
            `Invalid $include array item: expected string, got ${typeof item}`,
            String(item),
          );
        }
        return deepMerge(merged, this.loadFile(item));
      }, {});
    }

    throw new ConfigIncludeError(
      `Invalid $include value: expected string or array of strings, got ${typeof value}`,
      String(value),
    );
  }

  private loadFile(includePath: string): unknown {
    const resolvedPath = this.resolvePath(includePath);

    this.checkCircular(resolvedPath);
    this.checkDepth(includePath);

    const raw = this.readFile(includePath, resolvedPath);
    const parsed = this.parseFile(includePath, resolvedPath, raw);

    return this.processNested(resolvedPath, parsed);
  }

  private resolvePath(includePath: string): string {
    const resolved = path.isAbsolute(includePath)
      ? includePath
      : path.resolve(path.dirname(this.basePath), includePath);
    return path.normalize(resolved);
  }

  private checkCircular(resolvedPath: string): void {
    if (this.visited.has(resolvedPath)) {
      throw new CircularIncludeError([...this.visited, resolvedPath]);
    }
  }

  private checkDepth(includePath: string): void {
    if (this.depth >= MAX_INCLUDE_DEPTH) {
      throw new ConfigIncludeError(
        `Maximum include depth (${MAX_INCLUDE_DEPTH}) exceeded at: ${includePath}`,
        includePath,
      );
    }
  }

  private readFile(includePath: string, resolvedPath: string): string {
    try {
      return this.resolver.readFile(resolvedPath);
    } catch (err) {
      throw new ConfigIncludeError(
        `Failed to read include file: ${includePath} (resolved: ${resolvedPath})`,
        includePath,
        err instanceof Error ? err : undefined,
      );
    }
  }

  private parseFile(includePath: string, resolvedPath: string, raw: string): unknown {
    try {
      return this.resolver.parseJson(raw);
    } catch (err) {
      throw new ConfigIncludeError(
        `Failed to parse include file: ${includePath} (resolved: ${resolvedPath})`,
        includePath,
        err instanceof Error ? err : undefined,
      );
    }
  }

  private processNested(resolvedPath: string, parsed: unknown): unknown {
    const nested = new IncludeProcessor(resolvedPath, this.resolver);
    nested.visited = new Set([...this.visited, resolvedPath]);
    nested.depth = this.depth + 1;
    return nested.process(parsed);
  }
}

// =============================================================================
// Include Resolution API
// =============================================================================

const defaultResolver: IncludeResolver = {
  readFile: (p) => fs.readFileSync(p, 'utf-8'),
  parseJson: (raw) => JSON.parse(raw),
};

/**
 * Resolve all $include directives in a parsed config object.
 *
 * Supports single file includes and arrays of includes. Detects circular
 * references and enforces a maximum include depth.
 */
export function resolveConfigIncludes(
  obj: unknown,
  configPath: string,
  resolver: IncludeResolver = defaultResolver,
): unknown {
  return new IncludeProcessor(configPath, resolver).process(obj);
}

// =============================================================================
// Environment Variable Substitution
// =============================================================================

function substituteString(
  value: string,
  env: NodeJS.ProcessEnv,
  configPath: string,
): string {
  if (!value.includes('$')) {
    return value;
  }

  const chunks: string[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char !== '$') {
      chunks.push(char);
      continue;
    }

    const next = value[i + 1];
    const afterNext = value[i + 2];

    // Escaped: $${VAR} -> ${VAR}
    if (next === '$' && afterNext === '{') {
      const start = i + 3;
      const end = value.indexOf('}', start);
      if (end !== -1) {
        const name = value.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          chunks.push(`\${${name}}`);
          i = end;
          continue;
        }
      }
    }

    // Substitution: ${VAR} -> value
    if (next === '{') {
      const start = i + 2;
      const end = value.indexOf('}', start);
      if (end !== -1) {
        const name = value.slice(start, end);
        if (ENV_VAR_NAME_PATTERN.test(name)) {
          const envValue = env[name];
          if (envValue === undefined || envValue === '') {
            throw new MissingEnvVarError(name, configPath);
          }
          chunks.push(envValue);
          i = end;
          continue;
        }
      }
    }

    // Leave untouched if not a recognized pattern
    chunks.push(char);
  }

  return chunks.join('');
}

function substituteAny(
  value: unknown,
  env: NodeJS.ProcessEnv,
  configPath: string,
): unknown {
  if (typeof value === 'string') {
    return substituteString(value, env, configPath);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      substituteAny(item, env, `${configPath}[${index}]`),
    );
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const childPath = configPath ? `${configPath}.${key}` : key;
      result[key] = substituteAny(val, env, childPath);
    }
    return result;
  }

  return value;
}

/**
 * Resolve ${VAR_NAME} environment variable references in config values.
 *
 * Only uppercase env var names are matched: [A-Z_][A-Z0-9_]*
 * Escape with $${} to output literal ${}.
 * Missing env vars throw MissingEnvVarError.
 */
export function resolveEnvVars(
  obj: unknown,
  env: NodeJS.ProcessEnv = process.env,
): unknown {
  return substituteAny(obj, env, '');
}

// =============================================================================
// Runtime Override System
// =============================================================================

type OverrideTree = Record<string, unknown>;

let overrides: OverrideTree = {};

function mergeOverrides(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override;
  }
  const next: OverrideTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    next[key] = mergeOverrides((base as OverrideTree)[key], value);
  }
  return next;
}

/**
 * Get the current runtime override tree.
 */
export function getOverrides(): OverrideTree {
  return overrides;
}

/**
 * Reset all runtime overrides.
 */
export function resetOverrides(): void {
  overrides = {};
}

/**
 * Set a runtime override at a dot-separated path.
 */
export function setOverride(
  dotPath: string,
  value: unknown,
): { ok: boolean; error?: string } {
  const parts = dotPath.split('.').filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, error: 'Invalid path.' };
  }

  let current: Record<string, unknown> = overrides;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlainObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return { ok: true };
}

/**
 * Remove a runtime override at a dot-separated path.
 */
export function unsetOverride(dotPath: string): { ok: boolean; removed: boolean } {
  const parts = dotPath.split('.').filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, removed: false };
  }

  let current: Record<string, unknown> = overrides;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlainObject(current[key])) {
      return { ok: true, removed: false };
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1];
  const existed = lastKey in current;
  delete current[lastKey];
  return { ok: true, removed: existed };
}

/**
 * Apply runtime overrides to a config object.
 */
export function applyOverrides<T>(config: T): T {
  if (!overrides || Object.keys(overrides).length === 0) {
    return config;
  }
  return mergeOverrides(config, overrides) as T;
}

// =============================================================================
// Config Diff
// =============================================================================

/**
 * Compute the list of dot-path keys that differ between two config objects.
 * Used by the reload system to determine which sections changed.
 */
export function diffConfigPaths(
  prev: unknown,
  next: unknown,
  prefix = '',
): string[] {
  if (prev === next) {
    return [];
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    const paths: string[] = [];
    for (const key of keys) {
      const prevValue = prev[key];
      const nextValue = next[key];
      if (prevValue === undefined && nextValue === undefined) {
        continue;
      }
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      const childPaths = diffConfigPaths(prevValue, nextValue, childPrefix);
      if (childPaths.length > 0) {
        paths.push(...childPaths);
      }
    }
    return paths;
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (
      prev.length === next.length &&
      prev.every((val, idx) => val === next[idx])
    ) {
      return [];
    }
  }
  return [prefix || '<root>'];
}
