/**
 * @wundr.io/typechat-output - Schema Loader
 *
 * Utilities for loading and parsing TypeScript schemas for TypeChat validation.
 * Provides tools to convert TypeScript type definitions into runtime validators.
 */

import {
  z,
  ZodSchema,
  ZodObject,
  ZodArray,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodEnum,
  ZodOptional,
  ZodNullable,
  ZodLiteral,
  ZodUnion,
  ZodRecord,
  ZodTuple,
  ZodDate,
} from 'zod';

import type {
  TypeScriptSchema,
  SchemaLoadOptions,
  SchemaLoadResult,
  SchemaLoadDiagnostic,
} from './types';

// ============================================================================
// Default Options
// ============================================================================

/**
 * Default schema loading options
 */
export const DEFAULT_SCHEMA_LOAD_OPTIONS: SchemaLoadOptions = {
  resolveReferences: true,
  includeComments: true,
  typeMappings: {},
};

// ============================================================================
// Type Definition Parsing
// ============================================================================

/**
 * Token types for TypeScript parsing
 * @internal Used for future tokenizer implementation
 */
type _TokenType =
  | 'identifier'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'punctuation'
  | 'keyword'
  | 'operator';

/**
 * Parsed token from TypeScript source
 * @internal Reserved for future tokenizer implementation
 */
interface _Token {
  type: _TokenType;
  value: string;
  position: number;
}

// Suppress unused warning - these are reserved for future tokenizer implementation
void (undefined as unknown as _Token);

/**
 * Parsed property from interface/type
 */
interface ParsedProperty {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

/**
 * Parsed type definition
 */
interface ParsedTypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  properties?: ParsedProperty[];
  enumValues?: string[];
  baseTypes?: string[];
  description?: string;
}

// ============================================================================
// Schema Loader Class
// ============================================================================

/**
 * TypeScript schema loader for converting type definitions to Zod schemas
 *
 * @example
 * ```typescript
 * const loader = new SchemaLoader();
 *
 * const result = loader.loadFromSource(`
 *   interface User {
 *     name: string;
 *     age: number;
 *     email?: string;
 *   }
 * `, 'User');
 *
 * if (result.success && result.schema) {
 *   const validated = result.schema.zodSchema.parse({ name: 'John', age: 30 });
 * }
 * ```
 */
export class SchemaLoader {
  private readonly options: SchemaLoadOptions;
  private readonly typeCache: Map<string, ZodSchema>;
  private readonly diagnostics: SchemaLoadDiagnostic[];

  constructor(options: Partial<SchemaLoadOptions> = {}) {
    this.options = { ...DEFAULT_SCHEMA_LOAD_OPTIONS, ...options };
    this.typeCache = new Map(Object.entries(this.options.typeMappings ?? {}));
    this.diagnostics = [];

    // Pre-populate with built-in type mappings
    this.initializeBuiltInTypes();
  }

  /**
   * Initialize built-in TypeScript to Zod type mappings
   */
  private initializeBuiltInTypes(): void {
    this.typeCache.set('string', z.string());
    this.typeCache.set('number', z.number());
    this.typeCache.set('boolean', z.boolean());
    this.typeCache.set('null', z.null());
    this.typeCache.set('undefined', z.undefined());
    this.typeCache.set('any', z.any());
    this.typeCache.set('unknown', z.unknown());
    this.typeCache.set('Date', z.date());
    this.typeCache.set('object', z.record(z.unknown()));
  }

  /**
   * Load a TypeScript schema from source code
   *
   * @param source - TypeScript source code containing type definitions
   * @param typeName - Name of the type to extract
   * @returns Schema load result with Zod schema
   */
  loadFromSource(source: string, typeName: string): SchemaLoadResult {
    this.diagnostics.length = 0;

    try {
      // Parse the TypeScript source
      const parsedTypes = this.parseTypeDefinitions(source);

      // Find the target type
      const targetType = parsedTypes.find(t => t.name === typeName);

      if (!targetType) {
        return {
          success: false,
          error: `Type '${typeName}' not found in source`,
          diagnostics: this.diagnostics,
        };
      }

      // Register all parsed types first (for reference resolution)
      for (const parsedType of parsedTypes) {
        if (parsedType.name !== typeName) {
          const schema = this.convertToZodSchema(parsedType, parsedTypes);
          this.typeCache.set(parsedType.name, schema);
        }
      }

      // Convert to Zod schema
      const zodSchema = this.convertToZodSchema(targetType, parsedTypes);

      const schema: TypeScriptSchema = {
        name: typeName,
        source,
        zodSchema,
        description: targetType.description,
      };

      return {
        success: true,
        schema,
        diagnostics: this.diagnostics,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addDiagnostic('error', `Failed to load schema: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        diagnostics: this.diagnostics,
      };
    }
  }

  /**
   * Create a TypeScript schema from a Zod schema with generated source
   *
   * @param zodSchema - Zod schema to wrap
   * @param name - Name for the schema
   * @param description - Optional description
   * @returns TypeScript schema object
   */
  createFromZod(
    zodSchema: ZodSchema,
    name: string,
    description?: string
  ): TypeScriptSchema {
    const source = this.generateTypeScriptSource(zodSchema, name);

    return {
      name,
      source,
      zodSchema,
      description,
    };
  }

  /**
   * Generate TypeScript source code from a Zod schema
   *
   * @param schema - Zod schema to convert
   * @param name - Name for the generated type
   * @returns TypeScript source code
   */
  generateTypeScriptSource(schema: ZodSchema, name: string): string {
    const typeDefinition = this.zodToTypeScript(schema);
    return `interface ${name} ${typeDefinition}`;
  }

  /**
   * Get a cached type by name
   *
   * @param name - Type name
   * @returns Zod schema if found
   */
  getCachedType(name: string): ZodSchema | undefined {
    return this.typeCache.get(name);
  }

  /**
   * Register a custom type mapping
   *
   * @param name - Type name
   * @param schema - Zod schema for the type
   */
  registerType(name: string, schema: ZodSchema): void {
    this.typeCache.set(name, schema);
  }

  /**
   * Get all diagnostics from the last operation
   */
  getDiagnostics(): SchemaLoadDiagnostic[] {
    return [...this.diagnostics];
  }

  // ==========================================================================
  // Private Methods - Parsing
  // ==========================================================================

  /**
   * Parse TypeScript source into type definitions
   */
  private parseTypeDefinitions(source: string): ParsedTypeDefinition[] {
    const definitions: ParsedTypeDefinition[] = [];

    // Parse interfaces
    const interfacePattern =
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?\s*\{([^}]*)\}/g;
    let match: RegExpExecArray | null;

    while ((match = interfacePattern.exec(source)) !== null) {
      const [fullMatch, name, baseTypes, body] = match;
      const description = this.extractJSDocDescription(fullMatch);
      const properties = this.parseInterfaceBody(body ?? '');
      const bases = baseTypes
        ?.split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (name) {
        definitions.push({
          name,
          kind: 'interface',
          properties,
          baseTypes: bases,
          description,
        });
      }
    }

    // Parse type aliases
    const typePattern =
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:export\s+)?type\s+(\w+)\s*=\s*([^;]+);/g;

    while ((match = typePattern.exec(source)) !== null) {
      const [fullMatch, name, typeBody] = match;
      const description = this.extractJSDocDescription(fullMatch);

      if (name && typeBody) {
        // Check if it's an object type literal
        if (typeBody.trim().startsWith('{')) {
          const properties = this.parseInterfaceBody(
            typeBody.trim().slice(1, -1)
          );
          definitions.push({
            name,
            kind: 'type',
            properties,
            description,
          });
        } else {
          // Handle as type alias (union, etc.)
          definitions.push({
            name,
            kind: 'type',
            description,
          });
        }
      }
    }

    // Parse enums
    const enumPattern =
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g;

    while ((match = enumPattern.exec(source)) !== null) {
      const [fullMatch, name, body] = match;
      const description = this.extractJSDocDescription(fullMatch);
      const enumValues = this.parseEnumBody(body ?? '');

      if (name) {
        definitions.push({
          name,
          kind: 'enum',
          enumValues,
          description,
        });
      }
    }

    return definitions;
  }

  /**
   * Parse interface body into properties
   */
  private parseInterfaceBody(body: string): ParsedProperty[] {
    const properties: ParsedProperty[] = [];
    const propertyPattern =
      /(?:\/\*\*[\s\S]*?\*\/\s*)?(?:readonly\s+)?(\w+)(\?)?:\s*([^;,\n]+)/g;
    let match: RegExpExecArray | null;

    while ((match = propertyPattern.exec(body)) !== null) {
      const [fullMatch, name, optionalMark, type] = match;
      const description = this.extractJSDocDescription(fullMatch);

      if (name && type) {
        properties.push({
          name,
          type: type.trim(),
          optional: !!optionalMark,
          description,
        });
      }
    }

    return properties;
  }

  /**
   * Parse enum body into values
   */
  private parseEnumBody(body: string): string[] {
    const values: string[] = [];
    const valuePattern = /(\w+)\s*(?:=\s*(['"])([^'"]*)\2)?/g;
    let match: RegExpExecArray | null;

    while ((match = valuePattern.exec(body)) !== null) {
      const [, name, , stringValue] = match;
      if (name) {
        values.push(stringValue ?? name);
      }
    }

    return values;
  }

  /**
   * Extract JSDoc description from a comment
   */
  private extractJSDocDescription(source: string): string | undefined {
    if (!this.options.includeComments) {
      return undefined;
    }

    const jsdocMatch = source.match(/\/\*\*\s*([\s\S]*?)\s*\*\//);
    if (!jsdocMatch?.[1]) {
      return undefined;
    }

    // Clean up the JSDoc content
    const description = jsdocMatch[1]
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/, ''))
      .filter(line => !line.startsWith('@'))
      .join(' ')
      .trim();

    return description || undefined;
  }

  // ==========================================================================
  // Private Methods - Zod Conversion
  // ==========================================================================

  /**
   * Convert a parsed type definition to a Zod schema
   */
  private convertToZodSchema(
    definition: ParsedTypeDefinition,
    allDefinitions: ParsedTypeDefinition[]
  ): ZodSchema {
    if (definition.kind === 'enum' && definition.enumValues) {
      // Create enum schema
      if (definition.enumValues.length === 0) {
        return z.never();
      }
      return z.enum(definition.enumValues as [string, ...string[]]);
    }

    if (!definition.properties || definition.properties.length === 0) {
      // Empty object or unknown type
      return z.object({});
    }

    // Build object schema
    const shape: Record<string, ZodSchema> = {};

    for (const prop of definition.properties) {
      let propSchema = this.typeStringToZod(prop.type, allDefinitions);

      if (prop.optional) {
        propSchema = propSchema.optional();
      }

      if (prop.description) {
        propSchema = propSchema.describe(prop.description);
      }

      shape[prop.name] = propSchema;
    }

    // Handle base types (inheritance)
    if (definition.baseTypes && definition.baseTypes.length > 0) {
      const baseSchemas = definition.baseTypes
        .map(baseName => {
          const baseDef = allDefinitions.find(d => d.name === baseName);
          if (baseDef) {
            return this.convertToZodSchema(baseDef, allDefinitions);
          }
          return this.typeCache.get(baseName);
        })
        .filter((s): s is ZodSchema => s !== undefined);

      // Merge base schemas with current
      if (baseSchemas.length > 0) {
        let merged = z.object(shape);
        for (const base of baseSchemas) {
          if (base instanceof ZodObject) {
            merged = merged.merge(base);
          }
        }
        return merged;
      }
    }

    return z.object(shape);
  }

  /**
   * Convert a TypeScript type string to a Zod schema
   */
  private typeStringToZod(
    typeStr: string,
    allDefinitions: ParsedTypeDefinition[]
  ): ZodSchema {
    const normalized = typeStr.trim();

    // Check cache first
    const cached = this.typeCache.get(normalized);
    if (cached) {
      return cached;
    }

    // Handle primitives
    if (normalized === 'string') {
      return z.string();
    }
    if (normalized === 'number') {
      return z.number();
    }
    if (normalized === 'boolean') {
      return z.boolean();
    }
    if (normalized === 'null') {
      return z.null();
    }
    if (normalized === 'undefined') {
      return z.undefined();
    }
    if (normalized === 'any') {
      return z.any();
    }
    if (normalized === 'unknown') {
      return z.unknown();
    }
    if (normalized === 'Date') {
      return z.date();
    }

    // Handle string literals
    if (normalized.startsWith("'") || normalized.startsWith('"')) {
      const literalValue = normalized.slice(1, -1);
      return z.literal(literalValue);
    }

    // Handle number literals
    if (/^\d+$/.test(normalized)) {
      return z.literal(parseInt(normalized, 10));
    }

    // Handle arrays
    const arrayMatch = normalized.match(/^(.+)\[\]$/);
    if (arrayMatch?.[1]) {
      const elementType = this.typeStringToZod(arrayMatch[1], allDefinitions);
      return z.array(elementType);
    }

    // Handle Array<T> syntax
    const genericArrayMatch = normalized.match(/^Array<(.+)>$/);
    if (genericArrayMatch?.[1]) {
      const elementType = this.typeStringToZod(
        genericArrayMatch[1],
        allDefinitions
      );
      return z.array(elementType);
    }

    // Handle union types
    if (normalized.includes(' | ')) {
      const unionParts = this.splitUnionTypes(normalized);
      const unionSchemas = unionParts.map(part =>
        this.typeStringToZod(part, allDefinitions)
      );
      if (unionSchemas.length >= 2) {
        return z.union(unionSchemas as [ZodSchema, ZodSchema, ...ZodSchema[]]);
      }
      return unionSchemas[0] ?? z.unknown();
    }

    // Handle Record<K, V>
    const recordMatch = normalized.match(/^Record<(.+),\s*(.+)>$/);
    if (recordMatch?.[2]) {
      const valueType = this.typeStringToZod(recordMatch[2], allDefinitions);
      return z.record(valueType);
    }

    // Handle nullable (T | null)
    if (normalized.endsWith(' | null') || normalized.startsWith('null | ')) {
      const baseType = normalized.replace(/ \| null|null \| /g, '').trim();
      return this.typeStringToZod(baseType, allDefinitions).nullable();
    }

    // Check if it's a defined type
    const definition = allDefinitions.find(d => d.name === normalized);
    if (definition) {
      return this.convertToZodSchema(definition, allDefinitions);
    }

    // Unknown type - log warning and return unknown
    this.addDiagnostic(
      'warning',
      `Unknown type '${normalized}', using z.unknown()`
    );
    return z.unknown();
  }

  /**
   * Split union type string respecting nested generics
   */
  private splitUnionTypes(typeStr: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of typeStr) {
      if (char === '<' || char === '(' || char === '{' || char === '[') {
        depth++;
        current += char;
      } else if (char === '>' || char === ')' || char === '}' || char === ']') {
        depth--;
        current += char;
      } else if (char === '|' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  // ==========================================================================
  // Private Methods - TypeScript Generation
  // ==========================================================================

  /**
   * Convert a Zod schema to TypeScript source
   */
  private zodToTypeScript(schema: ZodSchema, depth = 0): string {
    const indent = '  '.repeat(depth);
    const innerIndent = '  '.repeat(depth + 1);

    if (schema instanceof ZodObject) {
      const shape = schema.shape as Record<string, ZodSchema>;
      const entries = Object.entries(shape);

      if (entries.length === 0) {
        return '{}';
      }

      const properties = entries.map(([key, value]) => {
        const optional = value instanceof ZodOptional;
        const actualSchema = optional
          ? (value as ZodOptional<ZodSchema>).unwrap()
          : value;
        const typeStr = this.zodToTypeScript(actualSchema, depth + 1);
        const optionalMark = optional ? '?' : '';
        return `${innerIndent}${key}${optionalMark}: ${typeStr};`;
      });

      return `{\n${properties.join('\n')}\n${indent}}`;
    }

    if (schema instanceof ZodArray) {
      const elementType = this.zodToTypeScript(schema.element, depth);
      return `${elementType}[]`;
    }

    if (schema instanceof ZodString) {
      return 'string';
    }
    if (schema instanceof ZodNumber) {
      return 'number';
    }
    if (schema instanceof ZodBoolean) {
      return 'boolean';
    }
    if (schema instanceof ZodDate) {
      return 'Date';
    }

    if (schema instanceof ZodLiteral) {
      const value = schema.value;
      if (typeof value === 'string') {
        return `'${value}'`;
      }
      return String(value);
    }

    if (schema instanceof ZodEnum) {
      const values = schema.options as string[];
      return values.map(v => `'${v}'`).join(' | ');
    }

    if (schema instanceof ZodUnion) {
      const options = schema.options as ZodSchema[];
      return options.map(opt => this.zodToTypeScript(opt, depth)).join(' | ');
    }

    if (schema instanceof ZodNullable) {
      const inner = this.zodToTypeScript(schema.unwrap(), depth);
      return `${inner} | null`;
    }

    if (schema instanceof ZodOptional) {
      return this.zodToTypeScript(schema.unwrap(), depth);
    }

    if (schema instanceof ZodRecord) {
      const valueType = this.zodToTypeScript(schema.valueSchema, depth);
      return `Record<string, ${valueType}>`;
    }

    if (schema instanceof ZodTuple) {
      const items = schema.items as ZodSchema[];
      const types = items.map(item => this.zodToTypeScript(item, depth));
      return `[${types.join(', ')}]`;
    }

    return 'unknown';
  }

  /**
   * Add a diagnostic message
   */
  private addDiagnostic(
    severity: SchemaLoadDiagnostic['severity'],
    message: string,
    location?: { line: number; column: number }
  ): void {
    this.diagnostics.push({ severity, message, location });
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a schema loader with default options
 *
 * @returns Configured SchemaLoader instance
 */
export function createSchemaLoader(
  options?: Partial<SchemaLoadOptions>
): SchemaLoader {
  return new SchemaLoader(options);
}

/**
 * Load a TypeScript schema from source code
 *
 * @param source - TypeScript source code
 * @param typeName - Name of the type to extract
 * @param options - Loading options
 * @returns Schema load result
 */
export function loadSchema(
  source: string,
  typeName: string,
  options?: Partial<SchemaLoadOptions>
): SchemaLoadResult {
  const loader = new SchemaLoader(options);
  return loader.loadFromSource(source, typeName);
}

/**
 * Generate TypeScript source from a Zod schema
 *
 * @param schema - Zod schema
 * @param name - Type name
 * @returns TypeScript source code
 */
export function generateTypeScriptFromZod(
  schema: ZodSchema,
  name: string
): string {
  const loader = new SchemaLoader();
  return loader.generateTypeScriptSource(schema, name);
}

// Re-export Zod for convenience
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
