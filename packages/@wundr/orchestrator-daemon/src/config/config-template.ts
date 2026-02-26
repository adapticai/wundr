/**
 * Config Templating: Variable Substitution and Template Rendering
 *
 * Provides a templating layer on top of environment variable substitution.
 * Supports user-defined variables, conditional defaults, and nested references.
 *
 * Template syntax:
 *   {{VAR_NAME}}                 - Required variable
 *   {{VAR_NAME:-default_value}}  - Variable with default
 *   {{VAR_NAME:?error message}}  - Required with custom error
 *   {{$env.ENV_VAR}}             - Explicit env var reference
 *   {{$config.path.to.value}}    - Cross-reference another config value
 *
 * @module @wundr/orchestrator-daemon/config/config-template
 */

// =============================================================================
// Types
// =============================================================================

export interface TemplateContext {
  /** User-defined template variables */
  vars: Record<string, string>;
  /** Environment variables (defaults to process.env) */
  env: NodeJS.ProcessEnv;
  /** Resolved config object for cross-references (optional, used in second pass) */
  config?: unknown;
}

export interface TemplateError {
  /** Path in config where the error occurred */
  path: string;
  /** The template expression that failed */
  expression: string;
  /** Human-readable error message */
  message: string;
}

export interface TemplateResult {
  /** The resolved value */
  value: unknown;
  /** Errors encountered during resolution */
  errors: TemplateError[];
  /** Variables that were referenced */
  referencedVars: Set<string>;
  /** Environment variables that were referenced */
  referencedEnvVars: Set<string>;
}

// =============================================================================
// Constants
// =============================================================================

/** Pattern matching {{...}} template expressions */
const TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;

/** Maximum cross-reference resolution depth */
const MAX_CROSS_REF_DEPTH = 10;

// =============================================================================
// Errors
// =============================================================================

export class TemplateResolutionError extends Error {
  constructor(public readonly errors: TemplateError[]) {
    const messages = errors.map(e => `  ${e.path}: ${e.message}`).join('\n');
    super(`Template resolution failed:\n${messages}`);
    this.name = 'TemplateResolutionError';
  }
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

function getNestedValue(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// =============================================================================
// Expression Parser
// =============================================================================

interface ParsedExpression {
  /** Type of the expression */
  type: 'var' | 'env' | 'config';
  /** Variable/path name */
  name: string;
  /** Default value (when using :- syntax) */
  defaultValue?: string;
  /** Required error message (when using :? syntax) */
  requiredMessage?: string;
}

function parseExpression(expr: string): ParsedExpression {
  const trimmed = expr.trim();

  // Check for $env. prefix
  if (trimmed.startsWith('$env.')) {
    const rest = trimmed.slice('$env.'.length);
    return parseModifiers(rest, 'env');
  }

  // Check for $config. prefix
  if (trimmed.startsWith('$config.')) {
    const rest = trimmed.slice('$config.'.length);
    return parseModifiers(rest, 'config');
  }

  // Plain variable
  return parseModifiers(trimmed, 'var');
}

function parseModifiers(
  raw: string,
  type: ParsedExpression['type']
): ParsedExpression {
  // Check for :- (default value)
  const defaultIdx = raw.indexOf(':-');
  if (defaultIdx !== -1) {
    return {
      type,
      name: raw.slice(0, defaultIdx).trim(),
      defaultValue: raw.slice(defaultIdx + 2).trim(),
    };
  }

  // Check for :? (required with message)
  const requiredIdx = raw.indexOf(':?');
  if (requiredIdx !== -1) {
    return {
      type,
      name: raw.slice(0, requiredIdx).trim(),
      requiredMessage: raw.slice(requiredIdx + 2).trim(),
    };
  }

  return { type, name: raw.trim() };
}

// =============================================================================
// Resolution
// =============================================================================

function resolveExpression(
  parsed: ParsedExpression,
  ctx: TemplateContext,
  configPath: string,
  referencedVars: Set<string>,
  referencedEnvVars: Set<string>
): { value: string | undefined; error?: TemplateError } {
  let rawValue: string | undefined;

  switch (parsed.type) {
    case 'var': {
      referencedVars.add(parsed.name);
      rawValue = ctx.vars[parsed.name];
      break;
    }
    case 'env': {
      referencedEnvVars.add(parsed.name);
      rawValue = ctx.env[parsed.name] ?? undefined;
      if (rawValue === '') {
        rawValue = undefined;
      }
      break;
    }
    case 'config': {
      if (!ctx.config) {
        return {
          value: undefined,
          error: {
            path: configPath,
            expression: `$config.${parsed.name}`,
            message: `Config cross-reference "$config.${parsed.name}" cannot be resolved (config not available in this pass)`,
          },
        };
      }
      const configVal = getNestedValue(ctx.config, parsed.name);
      rawValue =
        configVal !== null && configVal !== undefined
          ? String(configVal)
          : undefined;
      break;
    }
  }

  // Apply default
  if (rawValue === undefined && parsed.defaultValue !== undefined) {
    rawValue = parsed.defaultValue;
  }

  // Check required
  if (rawValue === undefined && parsed.requiredMessage) {
    return {
      value: undefined,
      error: {
        path: configPath,
        expression: `{{${parsed.name}}}`,
        message: parsed.requiredMessage,
      },
    };
  }

  if (rawValue === undefined) {
    return {
      value: undefined,
      error: {
        path: configPath,
        expression: `{{${parsed.name}}}`,
        message: `Unresolved template variable "${parsed.name}"`,
      },
    };
  }

  return { value: rawValue };
}

// =============================================================================
// Template Substitution
// =============================================================================

function substituteString(
  value: string,
  ctx: TemplateContext,
  configPath: string,
  errors: TemplateError[],
  referencedVars: Set<string>,
  referencedEnvVars: Set<string>
): string {
  if (!value.includes('{{')) {
    return value;
  }

  return value.replace(TEMPLATE_PATTERN, (match, expr: string) => {
    const parsed = parseExpression(expr);
    const result = resolveExpression(
      parsed,
      ctx,
      configPath,
      referencedVars,
      referencedEnvVars
    );

    if (result.error) {
      errors.push(result.error);
      return match; // Leave unresolved
    }

    return result.value ?? match;
  });
}

function substituteAny(
  value: unknown,
  ctx: TemplateContext,
  configPath: string,
  errors: TemplateError[],
  referencedVars: Set<string>,
  referencedEnvVars: Set<string>
): unknown {
  if (typeof value === 'string') {
    return substituteString(
      value,
      ctx,
      configPath,
      errors,
      referencedVars,
      referencedEnvVars
    );
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      substituteAny(
        item,
        ctx,
        `${configPath}[${index}]`,
        errors,
        referencedVars,
        referencedEnvVars
      )
    );
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const childPath = configPath ? `${configPath}.${key}` : key;
      result[key] = substituteAny(
        val,
        ctx,
        childPath,
        errors,
        referencedVars,
        referencedEnvVars
      );
    }
    return result;
  }

  return value;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Apply template substitution to a config object.
 *
 * Resolves all {{...}} template expressions using the provided context.
 * Returns the resolved config along with any errors and metadata about
 * which variables were referenced.
 *
 * @param obj - The config object (or subtree) to process
 * @param context - Template resolution context (vars, env, optional config)
 * @returns Template resolution result
 */
export function resolveTemplates(
  obj: unknown,
  context: Partial<TemplateContext> = {}
): TemplateResult {
  const ctx: TemplateContext = {
    vars: context.vars ?? {},
    env: context.env ?? process.env,
    config: context.config,
  };

  const errors: TemplateError[] = [];
  const referencedVars = new Set<string>();
  const referencedEnvVars = new Set<string>();

  const value = substituteAny(
    obj,
    ctx,
    '',
    errors,
    referencedVars,
    referencedEnvVars
  );

  return { value, errors, referencedVars, referencedEnvVars };
}

/**
 * Resolve templates with cross-reference support (two-pass).
 *
 * First pass resolves vars and env references. Second pass resolves
 * $config references using the first-pass result. Detects circular
 * references by limiting depth.
 */
export function resolveTemplatesWithCrossRefs(
  obj: unknown,
  context: Partial<TemplateContext> = {},
  maxDepth: number = MAX_CROSS_REF_DEPTH
): TemplateResult {
  let current = obj;
  const allErrors: TemplateError[] = [];
  const allReferencedVars = new Set<string>();
  const allReferencedEnvVars = new Set<string>();

  for (let depth = 0; depth < maxDepth; depth++) {
    const ctx: TemplateContext = {
      vars: context.vars ?? {},
      env: context.env ?? process.env,
      config: current,
    };

    const errors: TemplateError[] = [];
    const referencedVars = new Set<string>();
    const referencedEnvVars = new Set<string>();

    const next = substituteAny(
      current,
      ctx,
      '',
      errors,
      referencedVars,
      referencedEnvVars
    );

    for (const v of referencedVars) {
      allReferencedVars.add(v);
    }
    for (const v of referencedEnvVars) {
      allReferencedEnvVars.add(v);
    }

    // Check if anything changed
    if (JSON.stringify(next) === JSON.stringify(current)) {
      // Stable; collect any remaining errors
      for (const e of errors) {
        allErrors.push(e);
      }
      current = next;
      break;
    }

    current = next;

    // Only propagate errors from the final pass
    if (depth === maxDepth - 1) {
      for (const e of errors) {
        allErrors.push(e);
      }
    }
  }

  return {
    value: current,
    errors: allErrors,
    referencedVars: allReferencedVars,
    referencedEnvVars: allReferencedEnvVars,
  };
}

/**
 * Extract all template variable names from a config object.
 * Useful for documentation and validation.
 */
export function extractTemplateVars(obj: unknown): {
  vars: Set<string>;
  envVars: Set<string>;
  configRefs: Set<string>;
} {
  const vars = new Set<string>();
  const envVars = new Set<string>();
  const configRefs = new Set<string>();

  function walk(value: unknown): void {
    if (typeof value === 'string') {
      const matches = value.matchAll(TEMPLATE_PATTERN);
      for (const match of matches) {
        const parsed = parseExpression(match[1]);
        switch (parsed.type) {
          case 'var':
            vars.add(parsed.name);
            break;
          case 'env':
            envVars.add(parsed.name);
            break;
          case 'config':
            configRefs.add(parsed.name);
            break;
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }

    if (isPlainObject(value)) {
      for (const val of Object.values(value)) {
        walk(val);
      }
    }
  }

  walk(obj);
  return { vars, envVars, configRefs };
}
