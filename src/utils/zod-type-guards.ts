/**
 * Zod-based type guards and validation utilities
 * Integrates Zod schemas with type guard patterns for comprehensive validation
 */

import { z, ZodSchema, ZodError, ZodType } from 'zod';
import {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  parseJsonSafe,
  stringifyJsonSafe
} from '../types/type-guards';

/**
 * Enhanced validation result with detailed error information
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
  expected?: string;
  received?: string;
}

export interface ValidationWarning {
  path: string[];
  message: string;
  suggestion?: string;
}

/**
 * Create a type guard from a Zod schema
 */
export const createZodGuard = <T>(schema: ZodSchema<T>) => {
  return (value: unknown): value is T => {
    const result = schema.safeParse(value);
    return result.success;
  };
};

/**
 * Create an assertion function from a Zod schema
 */
export const createZodAssertion = <T>(
  schema: ZodSchema<T>,
  errorMessage?: string
) => {
  return (value: unknown, name = 'value'): asserts value is T => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');

      throw new TypeError(
        errorMessage || `${name} validation failed: ${errors}`
      );
    }
  };
};

/**
 * Safe parsing with detailed validation results
 */
export const validateWithZod = <T>(
  value: unknown,
  schema: ZodSchema<T>
): ValidationResult<T> => {
  const result = schema.safeParse(value);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: []
    };
  }

  const errors: ValidationError[] = result.error.errors.map(err => ({
    path: err.path.map(String),
    message: err.message,
    code: err.code,
    expected: 'expected' in err ? String(err.expected) : undefined,
    received: 'received' in err ? String(err.received) : undefined
  }));

  return {
    success: false,
    errors
  };
};

/**
 * Safe coercion with fallback values
 */
export const coerceWithZod = <T>(
  value: unknown,
  schema: ZodSchema<T>,
  fallback: T
): T => {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
};

/**
 * Partial validation for updating existing objects
 */
export const validatePartialWithZod = <T>(
  value: unknown,
  schema: ZodSchema<T>
): ValidationResult<Partial<T>> => {
  const partialSchema = schema.partial() as ZodSchema<Partial<T>>;
  return validateWithZod(value, partialSchema);
};

/**
 * Common Zod schemas for reuse
 */
export const ZodSchemas = {
  // Primitives
  nonEmptyString: z.string().min(1, 'String cannot be empty'),
  positiveNumber: z.number().positive('Number must be positive'),
  nonNegativeNumber: z.number().nonnegative('Number must be non-negative'),

  // Formats
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  uuid: z.string().uuid('Invalid UUID format'),

  // Network
  ipv4: z.string().ip({ version: 'v4' }),
  ipv6: z.string().ip({ version: 'v6' }),
  port: z.number().int().min(1).max(65535),

  // File system
  absolutePath: z.string().regex(/^\/|^[A-Za-z]:[\\\/]|^\\\\/, 'Must be absolute path'),
  relativePath: z.string().refine(path => !path.match(/^\/|^[A-Za-z]:[\\\/]|^\\\\/), 'Must be relative path'),

  // Dates
  isoDate: z.string().datetime('Invalid ISO date format'),
  timestamp: z.number().int().positive('Invalid timestamp'),

  // Common objects
  apiResponse: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    timestamp: z.string()
  }),

  paginatedResponse: z.object({
    data: z.array(z.unknown()),
    total: z.number().nonnegative(),
    page: z.number().positive(),
    limit: z.number().positive()
  }),

  configValue: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ])
};

/**
 * Schema builders for common patterns
 */
export const SchemaBuilders = {
  /**
   * Create a schema for an object with required and optional keys
   */
  objectWithKeys: <R extends string, O extends string>(
    required: Record<R, ZodType>,
    optional?: Record<O, ZodType>
  ) => {
    const schema = z.object(required);
    return optional ? schema.extend(optional).partial(optional as any) : schema;
  },

  /**
   * Create a schema for an array with item validation
   */
  arrayOf: <T>(itemSchema: ZodSchema<T>, options?: {
    minLength?: number;
    maxLength?: number;
    nonEmpty?: boolean;
  }) => {
    let schema = z.array(itemSchema);

    if (options?.minLength !== undefined) {
      schema = schema.min(options.minLength);
    }

    if (options?.maxLength !== undefined) {
      schema = schema.max(options.maxLength);
    }

    if (options?.nonEmpty) {
      schema = schema.nonempty();
    }

    return schema;
  },

  /**
   * Create a schema for a record with value validation
   */
  recordOf: <T>(valueSchema: ZodSchema<T>) => {
    return z.record(z.string(), valueSchema);
  },

  /**
   * Create a union schema with type discrimination
   */
  discriminatedUnion: <T extends string, U>(
    discriminator: T,
    options: Record<string, ZodSchema<U>>
  ) => {
    return z.discriminatedUnion(discriminator, Object.values(options) as any);
  }
};

/**
 * Runtime schema validation for configuration objects
 */
export const createConfigValidator = <T>(schema: ZodSchema<T>) => {
  return {
    validate: (config: unknown): ValidationResult<T> => validateWithZod(config, schema),

    validateEnv: (env: Record<string, string | undefined>): ValidationResult<T> => {
      // Convert environment variables to appropriate types
      const processed: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) continue;

        // Try to parse as JSON first
        const jsonResult = parseJsonSafe(value);
        if (jsonResult.success) {
          processed[key] = jsonResult.data;
        } else {
          // Try to parse as number
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            processed[key] = numValue;
          } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
            processed[key] = value.toLowerCase() === 'true';
          } else {
            processed[key] = value;
          }
        }
      }

      return validateWithZod(processed, schema);
    },

    coerce: (value: unknown, fallback: T): T => coerceWithZod(value, schema, fallback),

    guard: createZodGuard(schema),

    assert: createZodAssertion(schema)
  };
};

/**
 * API response validator factory
 */
export const createApiValidator = <T>(dataSchema: ZodSchema<T>) => {
  const responseSchema = z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    timestamp: z.string()
  });

  return {
    validateResponse: (response: unknown): ValidationResult<{ success: boolean; data?: T; error?: string; timestamp: string }> =>
      validateWithZod(response, responseSchema),

    validateData: (data: unknown): ValidationResult<T> =>
      validateWithZod(data, dataSchema),

    guard: createZodGuard(responseSchema),

    dataGuard: createZodGuard(dataSchema)
  };
};

/**
 * File content validators
 */
export const FileValidators = {
  json: <T>(schema: ZodSchema<T>) => ({
    validate: (content: string): ValidationResult<T> => {
      const parseResult = parseJsonSafe(content);
      if (!parseResult.success) {
        return {
          success: false,
          errors: [{
            path: [],
            message: parseResult.error,
            code: 'invalid_json'
          }]
        };
      }

      return validateWithZod(parseResult.data, schema);
    },

    guard: (content: string): content is string => {
      const parseResult = parseJsonSafe(content);
      if (!parseResult.success) return false;

      return createZodGuard(schema)(parseResult.data);
    }
  }),

  packageJson: (() => {
    const packageSchema = z.object({
      name: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+/, 'Invalid semver'),
      description: z.string().optional(),
      main: z.string().optional(),
      scripts: z.record(z.string()).optional(),
      dependencies: z.record(z.string()).optional(),
      devDependencies: z.record(z.string()).optional(),
      peerDependencies: z.record(z.string()).optional()
    });

    return FileValidators.json(packageSchema);
  })(),

  tsconfig: (() => {
    const tsconfigSchema = z.object({
      compilerOptions: z.object({
        target: z.string().optional(),
        module: z.string().optional(),
        lib: z.array(z.string()).optional(),
        outDir: z.string().optional(),
        rootDir: z.string().optional(),
        strict: z.boolean().optional(),
        esModuleInterop: z.boolean().optional(),
        skipLibCheck: z.boolean().optional(),
        forceConsistentCasingInFileNames: z.boolean().optional()
      }).optional(),
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
      extends: z.string().optional()
    });

    return FileValidators.json(tsconfigSchema);
  })()
};

/**
 * Database model validators
 */
export const createModelValidator = <T>(schema: ZodSchema<T>) => {
  return {
    create: (data: unknown): ValidationResult<T> =>
      validateWithZod(data, schema),

    update: (data: unknown): ValidationResult<Partial<T>> =>
      validatePartialWithZod(data, schema),

    query: (params: unknown): ValidationResult<Partial<T>> => {
      const querySchema = schema.partial();
      return validateWithZod(params, querySchema);
    },

    guard: createZodGuard(schema),

    assert: createZodAssertion(schema)
  };
};

/**
 * Form validation utilities
 */
export const FormValidators = {
  /**
   * Validate form data with field-level error reporting
   */
  validateForm: <T>(
    formData: unknown,
    schema: ZodSchema<T>
  ): ValidationResult<T> & { fieldErrors: Record<string, string[]> } => {
    const result = validateWithZod(formData, schema);

    const fieldErrors: Record<string, string[]> = {};

    for (const error of result.errors) {
      const field = error.path.join('.');
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(error.message);
    }

    return { ...result, fieldErrors };
  },

  /**
   * Create field validator for individual form fields
   */
  createFieldValidator: <T>(schema: ZodSchema<T>) => ({
    validate: (value: unknown): { valid: boolean; error?: string } => {
      const result = schema.safeParse(value);
      return result.success
        ? { valid: true }
        : { valid: false, error: result.error.errors[0]?.message };
    },

    guard: createZodGuard(schema)
  })
};

/**
 * Export utility types for better TypeScript integration
 */
export type ZodGuard<T> = (value: unknown) => value is T;
export type ZodAssertion<T> = (value: unknown, name?: string) => asserts value is T;
export type ZodValidator<T> = ReturnType<typeof createConfigValidator<T>>;
export type ApiValidator<T> = ReturnType<typeof createApiValidator<T>>;
export type ModelValidator<T> = ReturnType<typeof createModelValidator<T>>;