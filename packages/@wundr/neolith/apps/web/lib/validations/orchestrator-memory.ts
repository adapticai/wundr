/**
 * Orchestrator Memory Validation Schemas
 * @module lib/validations/orchestrator-memory
 */

import { z } from 'zod';

export const ORCHESTRATOR_MEMORY_ERROR_CODES = {
  INVALID_KEY: 'MEMORY_INVALID_KEY',
  NOT_FOUND: 'MEMORY_NOT_FOUND',
  ORCHESTRATOR_NOT_FOUND: 'MEMORY_ORCHESTRATOR_NOT_FOUND',
  STORAGE_FULL: 'MEMORY_STORAGE_FULL',
  INVALID_SCOPE: 'MEMORY_INVALID_SCOPE',
  SERIALIZATION_FAILED: 'MEMORY_SERIALIZATION_FAILED',
  UNAUTHORIZED: 'MEMORY_UNAUTHORIZED',
  VALIDATION_ERROR: 'MEMORY_VALIDATION_ERROR',
  INTERNAL_ERROR: 'MEMORY_INTERNAL_ERROR',
} as const;

export type OrchestratorMemoryErrorCode =
  (typeof ORCHESTRATOR_MEMORY_ERROR_CODES)[keyof typeof ORCHESTRATOR_MEMORY_ERROR_CODES];

// Export as MEMORY_ERROR_CODES for compatibility
export const MEMORY_ERROR_CODES = ORCHESTRATOR_MEMORY_ERROR_CODES;

/**
 * Create a standardized memory error response
 */
export function createErrorResponse(
  message: string,
  code: OrchestratorMemoryErrorCode,
  extraData?: Record<string, unknown>,
): { error: OrchestratorMemoryErrorCode; message: string } & Record<
  string,
  unknown
> {
  return { error: code, message, ...extraData };
}

export const memoryScopeSchema = z.enum([
  'global',
  'workspace',
  'task',
  'agent',
  'conversation',
]);

export const memoryEntrySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  scope: memoryScopeSchema,
  scopeId: z.string().optional(),
  ttl: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export const createMemoryEntrySchema = memoryEntrySchema.omit({
  createdAt: true,
  expiresAt: true,
});

export const memoryQuerySchema = z.object({
  scope: memoryScopeSchema,
  scopeId: z.string().optional(),
  keyPattern: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().positive().optional(),
  offset: z.coerce.number().nonnegative().optional(),
});

export const memoryStatsSchema = z.object({
  totalEntries: z.number().nonnegative(),
  totalSize: z.number().nonnegative(),
  scopeCounts: z.record(memoryScopeSchema, z.number().nonnegative()),
  oldestEntry: z.string().datetime().optional(),
  newestEntry: z.string().datetime().optional(),
});

export const memorySnapshotSchema = z.object({
  id: z.string(),
  scope: memoryScopeSchema,
  scopeId: z.string().optional(),
  entries: z.array(memoryEntrySchema),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Create memory schema (alias for createMemoryEntrySchema)
 */
export const createMemorySchema = createMemoryEntrySchema;

/**
 * Create memory input type
 */
export type CreateMemoryInput = z.infer<typeof createMemoryEntrySchema>;

/**
 * Memory ID param schema
 */
export const memoryIdParamSchema = z.object({
  memoryId: z.string(),
});

export type MemoryIdParam = z.infer<typeof memoryIdParamSchema>;

/**
 * Update memory schema
 */
export const updateMemorySchema = z.object({
  value: z.unknown().optional(),
  content: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  importance: z.number().min(0).max(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  ttl: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;

/**
 * Memory filters schema
 */
export const memoryFiltersSchema = z.object({
  scope: memoryScopeSchema.optional(),
  scopeId: z.string().optional(),
  keyPattern: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  sortBy: z.enum(['createdAt', 'key', 'scope']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  memoryType: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  minImportance: z.coerce.number().min(0).max(1).optional(),
  includeExpired: z.boolean().default(false),
});

export type MemoryFilters = z.infer<typeof memoryFiltersSchema>;

/**
 * Memory filters input type alias (for API compatibility)
 */
export type MemoryFiltersInput = MemoryFilters;

/**
 * Memory search schema
 */
export const memorySearchSchema = z.object({
  query: z.string().min(1).max(500),
  scope: memoryScopeSchema.optional(),
  scopeId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  includeExpired: z.boolean().default(false),
  memoryType: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  minImportance: z.coerce.number().min(0).max(1).optional(),
});

export type MemorySearch = z.infer<typeof memorySearchSchema>;

/**
 * Memory search input type alias (for API compatibility)
 */
export type MemorySearchInput = MemorySearch;
