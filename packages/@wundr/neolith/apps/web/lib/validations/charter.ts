/**
 * Charter Validation Schemas
 * @module lib/validations/charter
 */

import { z } from 'zod';

export const CHARTER_ERROR_CODES = {
  INVALID_CHARTER: 'CHARTER_INVALID',
  MISSING_REQUIRED_FIELD: 'CHARTER_MISSING_FIELD',
  INVALID_FORMAT: 'CHARTER_INVALID_FORMAT',
  CHARTER_NOT_FOUND: 'CHARTER_NOT_FOUND',
  UNAUTHORIZED: 'CHARTER_UNAUTHORIZED',
  VALIDATION_FAILED: 'CHARTER_VALIDATION_FAILED',
  VALIDATION_ERROR: 'CHARTER_VALIDATION_ERROR',
  VERSION_NOT_FOUND: 'CHARTER_VERSION_NOT_FOUND',
  FORBIDDEN: 'CHARTER_FORBIDDEN',
  DUPLICATE_VERSION: 'CHARTER_DUPLICATE_VERSION',
  INTERNAL_ERROR: 'CHARTER_INTERNAL_ERROR',
  ORCHESTRATOR_NOT_FOUND: 'CHARTER_ORCHESTRATOR_NOT_FOUND',
  NO_ACTIVE_VERSION: 'CHARTER_NO_ACTIVE_VERSION',
} as const;

export type CharterErrorCode =
  (typeof CHARTER_ERROR_CODES)[keyof typeof CHARTER_ERROR_CODES];

export const charterSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string(),
  version: z.string(),
  objectives: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  status: z.enum(['draft', 'active', 'archived']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const createCharterSchema = charterSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    version: z.number().optional(),
    charterData: z.record(z.unknown()).optional(),
    changeLog: z.string().optional(),
  });

export const updateCharterSchema = charterSchema
  .partial()
  .required({ id: true })
  .extend({
    version: z.number().optional(),
    charterData: z.record(z.unknown()).optional(),
    changeLog: z.string().optional(),
  });

export const charterObjectiveSchema = z.object({
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  metrics: z.array(z.string()).optional(),
});

// Charter filters schema for querying
export const charterFiltersSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'version']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Charter ID parameter schema
export const charterIdParamSchema = z.object({
  id: z.string().min(1),
});

// Version parameter schema
export const versionParamSchema = z.object({
  version: z.string().min(1),
});

// Complete charter version schema (full entity)
export const charterVersionSchema = z.object({
  id: z.string(),
  charterId: z.string(),
  orchestratorId: z.string(),
  version: z.number().int().positive(),
  charterData: charterSchema,
  changeLog: z.string().nullable(),
  isActive: z.boolean(),
  createdBy: z.string(),
  createdAt: z.union([z.date(), z.string().datetime()]),
  updatedAt: z.union([z.date(), z.string().datetime()]),
  creator: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    })
    .optional(),
  orchestrator: z
    .object({
      id: z.string(),
      organizationId: z.string(),
      role: z.string().nullable(),
      discipline: z.string().nullable(),
    })
    .optional(),
});

// Charter version create schema
export const charterVersionCreateSchema = z.object({
  charterId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string(),
  objectives: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  version: z.number().optional(),
  charterData: z.record(z.unknown()).optional(),
  changeLog: z.string().optional(),
});

// Alias for consistency
export const createCharterVersionSchema = charterVersionCreateSchema;

// Update charter version schema
export const updateCharterVersionSchema = z.object({
  charterId: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  changeLog: z.string().optional(),
});

// Rollback charter schema
export const rollbackCharterSchema = z.object({
  charterId: z.string().min(1),
  targetVersion: z.string().min(1),
  reason: z.string().optional(),
  changeLog: z.string().optional(),
});

// Diff query schema for comparing versions
export const diffQuerySchema = z.object({
  charterId: z.string().min(1),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
  format: z.enum(['json', 'unified', 'split']).optional().default('json'),
});

// Type exports
export type Charter = z.infer<typeof charterSchema>;
export type CharterVersion = z.infer<typeof charterVersionSchema>;
export type CreateCharterInput = z.infer<typeof createCharterSchema>;
export type UpdateCharterInput = z.infer<typeof updateCharterSchema>;
export type CharterFiltersInput = z.infer<typeof charterFiltersSchema>;
export type DiffQueryInput = z.infer<typeof diffQuerySchema>;
export type RollbackCharterInput = z.infer<typeof rollbackCharterSchema>;
export type UpdateCharterVersionInput = z.infer<
  typeof updateCharterVersionSchema
>;
export type CreateCharterVersionInput = z.infer<
  typeof createCharterVersionSchema
>;
export type CharterVersionCreateInput = z.infer<
  typeof charterVersionCreateSchema
>;

// Error response helper
export const createErrorResponse = (
  code: CharterErrorCode,
  message: string,
  details?: Record<string, unknown>,
) => ({
  error: {
    code,
    message,
    details,
  },
});
