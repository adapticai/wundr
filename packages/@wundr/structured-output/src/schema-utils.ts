/**
 * @wundr.io/structured-output - Schema Utilities
 *
 * Utilities for Zod schema manipulation, introspection, and JSON Schema conversion.
 */

import {
  z,
  ZodSchema,
  ZodObject,
  ZodArray,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodEffects,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodEnum,
} from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type {
  SchemaMetadata,
  ZodSchemaType,
  SchemaIntrospectionOptions,
  JsonSchemaOptions,
} from './types';

// ============================================================================
// Schema Type Detection
// ============================================================================

/**
 * Get the Zod schema type name
 */
export function getSchemaType(schema: ZodSchema): ZodSchemaType {
  // Access the internal type name from the schema definition
  const def = schema._def as { typeName?: string };
  const typeName = def.typeName ?? 'unknown';

  const typeMap: Record<string, ZodSchemaType> = {
    ZodString: 'string',
    ZodNumber: 'number',
    ZodBoolean: 'boolean',
    ZodObject: 'object',
    ZodArray: 'array',
    ZodEnum: 'enum',
    ZodUnion: 'union',
    ZodLiteral: 'literal',
    ZodDate: 'date',
    ZodNull: 'null',
    ZodUndefined: 'undefined',
    ZodUnknown: 'unknown',
    ZodAny: 'any',
    ZodTuple: 'tuple',
    ZodRecord: 'record',
    ZodMap: 'map',
    ZodSet: 'set',
    ZodFunction: 'function',
    ZodPromise: 'promise',
    ZodLazy: 'lazy',
    ZodEffects: 'effects',
    ZodIntersection: 'intersection',
    ZodDiscriminatedUnion: 'discriminatedUnion',
    ZodNativeEnum: 'nativeEnum',
    ZodOptional: 'unknown', // Will be handled specially
    ZodNullable: 'unknown', // Will be handled specially
    ZodDefault: 'unknown', // Will be handled specially
  };

  return typeMap[typeName] ?? 'unknown';
}

/**
 * Unwrap optional, nullable, and default wrappers to get the inner schema
 */
export function unwrapSchema(schema: ZodSchema): {
  schema: ZodSchema;
  isOptional: boolean;
  isNullable: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
} {
  let current = schema;
  let isOptional = false;
  let isNullable = false;
  let hasDefault = false;
  let defaultValue: unknown;
  let shouldContinue = true;

  while (shouldContinue) {
    if (current instanceof ZodOptional) {
      isOptional = true;
      current = current.unwrap();
    } else if (current instanceof ZodNullable) {
      isNullable = true;
      current = current.unwrap();
    } else if (current instanceof ZodDefault) {
      hasDefault = true;
      defaultValue = current._def.defaultValue();
      current = current.removeDefault();
    } else if (current instanceof ZodEffects) {
      current = current.innerType();
    } else {
      shouldContinue = false;
    }
  }

  return { schema: current, isOptional, isNullable, hasDefault, defaultValue };
}

// ============================================================================
// Schema Introspection
// ============================================================================

/**
 * Default introspection options
 */
const DEFAULT_INTROSPECTION_OPTIONS: SchemaIntrospectionOptions = {
  maxDepth: 10,
  includeDefaults: true,
  includeDescriptions: true,
};

/**
 * Extract metadata from a Zod schema
 */
export function introspectSchema(
  schema: ZodSchema,
  options: Partial<SchemaIntrospectionOptions> = {},
  depth = 0
): SchemaMetadata {
  const opts = { ...DEFAULT_INTROSPECTION_OPTIONS, ...options };

  if (depth > opts.maxDepth) {
    return {
      type: 'unknown',
      optional: false,
      nullable: false,
      description: '[max depth reached]',
    };
  }

  const {
    schema: unwrapped,
    isOptional,
    isNullable,
    hasDefault,
    defaultValue,
  } = unwrapSchema(schema);

  const type = getSchemaType(unwrapped);
  const description = opts.includeDescriptions
    ? getSchemaDescription(schema)
    : undefined;

  const metadata: SchemaMetadata = {
    type,
    optional: isOptional,
    nullable: isNullable,
    description,
    defaultValue: opts.includeDefaults && hasDefault ? defaultValue : undefined,
  };

  // Handle object schemas
  if (unwrapped instanceof ZodObject) {
    const shape = unwrapped.shape as Record<string, ZodSchema>;
    const fields: Record<string, SchemaMetadata> = {};

    for (const [key, value] of Object.entries(shape)) {
      fields[key] = introspectSchema(value, opts, depth + 1);
    }

    return { ...metadata, fields };
  }

  // Handle array schemas
  if (unwrapped instanceof ZodArray) {
    const element = introspectSchema(unwrapped.element, opts, depth + 1);
    return { ...metadata, element };
  }

  return metadata;
}

/**
 * Get the description from a Zod schema
 */
export function getSchemaDescription(schema: ZodSchema): string | undefined {
  return schema.description;
}

// ============================================================================
// JSON Schema Conversion
// ============================================================================

/**
 * Internal type-safe wrapper that calls zodToJsonSchema
 * This wrapper breaks the deep type recursion by using an explicit unknown intermediate
 */
function callZodToJsonSchema(
  schema: ZodSchema,
  options: {
    name?: string;
    $refStrategy?: 'none' | 'root' | 'relative' | 'seen';
    target?: 'jsonSchema7' | 'jsonSchema2019-09' | 'openApi3';
  }
): Record<string, unknown> {
  // Break the type recursion by going through unknown
  // The zodToJsonSchema library returns a valid JSON Schema object
  const fn: unknown = zodToJsonSchema;
  const typedFn = fn as (
    s: ZodSchema,
    o: typeof options
  ) => Record<string, unknown>;
  return typedFn(schema, options);
}

/**
 * Convert a Zod schema to JSON Schema
 */
export function toJsonSchema(
  schema: ZodSchema,
  options: JsonSchemaOptions = {}
): Record<string, unknown> {
  const jsonSchema = callZodToJsonSchema(schema, {
    name: options.name,
    $refStrategy: 'none',
    target: options.target ?? 'jsonSchema7',
  });

  if (options.description) {
    jsonSchema['description'] = options.description;
  }

  return jsonSchema;
}

/**
 * Generate a prompt-friendly schema description
 */
export function generateSchemaPrompt(schema: ZodSchema, name?: string): string {
  const jsonSchema = toJsonSchema(schema, { name });
  return formatSchemaForPrompt(jsonSchema);
}

/**
 * Format JSON Schema for LLM prompts
 */
function formatSchemaForPrompt(
  schema: Record<string, unknown>,
  indent = 0
): string {
  const spaces = '  '.repeat(indent);
  const lines: string[] = [];

  if (schema['title']) {
    lines.push(`${spaces}Schema: ${schema['title']}`);
  }

  if (schema['description']) {
    lines.push(`${spaces}Description: ${schema['description']}`);
  }

  if (schema['type']) {
    lines.push(`${spaces}Type: ${schema['type']}`);
  }

  if (schema['properties'] && typeof schema['properties'] === 'object') {
    lines.push(`${spaces}Fields:`);
    const properties = schema['properties'] as Record<
      string,
      Record<string, unknown>
    >;
    const required = (schema['required'] as string[]) ?? [];

    for (const [key, value] of Object.entries(properties)) {
      const isRequired = required.includes(key);
      const type = value['type'] ?? 'unknown';
      const desc = value['description'] ?? '';
      const reqMark = isRequired ? ' (required)' : ' (optional)';

      lines.push(
        `${spaces}  - ${key}: ${type}${reqMark}${desc ? ` - ${desc}` : ''}`
      );

      // Handle nested objects
      if (value['properties']) {
        lines.push(formatSchemaForPrompt(value, indent + 2));
      }

      // Handle arrays
      if (value['items'] && typeof value['items'] === 'object') {
        const items = value['items'] as Record<string, unknown>;
        lines.push(`${spaces}    Array items: ${items['type'] ?? 'unknown'}`);
        if (items['properties']) {
          lines.push(formatSchemaForPrompt(items, indent + 3));
        }
      }

      // Handle enums
      if (value['enum'] && Array.isArray(value['enum'])) {
        lines.push(`${spaces}    Allowed values: ${value['enum'].join(', ')}`);
      }
    }
  }

  if (schema['enum'] && Array.isArray(schema['enum'])) {
    lines.push(`${spaces}Allowed values: ${schema['enum'].join(', ')}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Schema Building Utilities
// ============================================================================

/**
 * Create an object schema from field definitions
 */
export function createObjectSchema<T extends Record<string, ZodSchema>>(
  fields: T,
  options?: { description?: string }
): ZodObject<T> {
  const schema = z.object(fields);
  return options?.description ? schema.describe(options.description) : schema;
}

/**
 * Make all fields in an object schema optional
 */
export function makePartial<T extends ZodObject<Record<string, ZodSchema>>>(
  schema: T
) {
  return schema.partial();
}

/**
 * Make all fields in an object schema required
 */
export function makeRequired<T extends ZodObject<Record<string, ZodSchema>>>(
  schema: T
) {
  return schema.required();
}

/**
 * Pick specific fields from an object schema
 */
export function pickFields<
  T extends ZodObject<Record<string, ZodSchema>>,
  K extends keyof T['shape'],
>(schema: T, keys: K[]) {
  const pickObj = keys.reduce(
    (acc, key) => {
      acc[key as string] = true;
      return acc;
    },
    {} as Record<string, true>
  );
  return schema.pick(pickObj);
}

/**
 * Omit specific fields from an object schema
 */
export function omitFields<
  T extends ZodObject<Record<string, ZodSchema>>,
  K extends keyof T['shape'],
>(schema: T, keys: K[]) {
  const omitObj = keys.reduce(
    (acc, key) => {
      acc[key as string] = true;
      return acc;
    },
    {} as Record<string, true>
  );
  return schema.omit(omitObj);
}

/**
 * Extend an object schema with additional fields
 */
export function extendSchema<
  T extends ZodObject<Record<string, ZodSchema>>,
  E extends Record<string, ZodSchema>,
>(base: T, extension: E) {
  return base.extend(extension);
}

/**
 * Merge two object schemas
 */
export function mergeSchemas<
  T extends ZodObject<Record<string, ZodSchema>>,
  U extends ZodObject<Record<string, ZodSchema>>,
>(first: T, second: U) {
  return first.merge(second);
}

// ============================================================================
// Schema Validation Utilities
// ============================================================================

/**
 * Safe parse with detailed error information
 */
export function safeParse<T>(
  schema: ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; errors: Array<{ path: string; message: string }> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return { success: false, errors };
}

/**
 * Validate and coerce data to match schema
 */
export function parseWithCoercion<T>(schema: ZodSchema<T>, data: unknown): T {
  // First try direct parsing
  const directResult = schema.safeParse(data);
  if (directResult.success) {
    return directResult.data;
  }

  // If data is a string, try parsing as JSON
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return schema.parse(parsed);
    } catch {
      // JSON parse failed, continue with original error
    }
  }

  // Throw the original error
  return schema.parse(data);
}

/**
 * Extract JSON from a string that may contain additional text
 */
export function extractJson(text: string): unknown {
  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // Continue to array check
    }
  }

  // Try to find JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // Continue
    }
  }

  // Try parsing the whole string
  return JSON.parse(text);
}

/**
 * Parse JSON with schema validation, extracting JSON from text if needed
 */
export function parseJsonWithSchema<T>(schema: ZodSchema<T>, text: string): T {
  const json = extractJson(text);
  return schema.parse(json);
}

// ============================================================================
// Schema Comparison Utilities
// ============================================================================

/**
 * Check if two schemas are structurally equivalent (shallow comparison)
 */
export function schemasMatch(a: ZodSchema, b: ZodSchema): boolean {
  const typeA = getSchemaType(a);
  const typeB = getSchemaType(b);

  if (typeA !== typeB) {
    return false;
  }

  // For objects, compare shapes
  if (a instanceof ZodObject && b instanceof ZodObject) {
    const shapeA = a.shape as Record<string, ZodSchema>;
    const shapeB = b.shape as Record<string, ZodSchema>;
    const keysA = Object.keys(shapeA);
    const keysB = Object.keys(shapeB);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every(key => keysB.includes(key));
  }

  return true;
}

/**
 * Get a list of required field names from an object schema
 */
export function getRequiredFields(schema: ZodSchema): string[] {
  const { schema: unwrapped } = unwrapSchema(schema);

  if (!(unwrapped instanceof ZodObject)) {
    return [];
  }

  const required: string[] = [];
  const shape = unwrapped.shape as Record<string, ZodSchema>;

  for (const [key, value] of Object.entries(shape)) {
    const { isOptional } = unwrapSchema(value);

    if (!isOptional) {
      required.push(key);
    }
  }

  return required;
}

/**
 * Get a list of optional field names from an object schema
 */
export function getOptionalFields(schema: ZodSchema): string[] {
  const { schema: unwrapped } = unwrapSchema(schema);

  if (!(unwrapped instanceof ZodObject)) {
    return [];
  }

  const optional: string[] = [];
  const shape = unwrapped.shape as Record<string, ZodSchema>;

  for (const [key, value] of Object.entries(shape)) {
    const { isOptional } = unwrapSchema(value);

    if (isOptional) {
      optional.push(key);
    }
  }

  return optional;
}

// ============================================================================
// Exports
// ============================================================================

export {
  z,
  ZodSchema,
  ZodObject,
  ZodArray,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodEnum,
};
