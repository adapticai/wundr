/**
 * Discipline Validation Schemas
 *
 * Zod schemas and error codes for discipline-related API endpoints.
 *
 * @module lib/validations/discipline
 */

import { z } from 'zod';

// =============================================================================
// ERROR CODES
// =============================================================================

export const DISCIPLINE_ERROR_CODES = {
  UNAUTHORIZED: 'DISCIPLINE_UNAUTHORIZED',
  FORBIDDEN: 'DISCIPLINE_FORBIDDEN',
  NOT_FOUND: 'DISCIPLINE_NOT_FOUND',
  VALIDATION_ERROR: 'DISCIPLINE_VALIDATION_ERROR',
  NAME_EXISTS: 'DISCIPLINE_NAME_EXISTS',
  HAS_ACTIVE_ORCHESTRATORS: 'DISCIPLINE_HAS_ACTIVE_ORCHESTRATORS',
  ORCHESTRATOR_NOT_FOUND: 'DISCIPLINE_ORCHESTRATOR_NOT_FOUND',
  ORCHESTRATOR_ALREADY_ASSIGNED: 'DISCIPLINE_ORCHESTRATOR_ALREADY_ASSIGNED',
  INTERNAL_ERROR: 'DISCIPLINE_INTERNAL_ERROR',
} as const;

export type DisciplineErrorCode =
  (typeof DISCIPLINE_ERROR_CODES)[keyof typeof DISCIPLINE_ERROR_CODES];

/**
 * Create a standardized discipline error response
 */
export function createErrorResponse(
  message: string,
  code: DisciplineErrorCode | string,
  extraData?: Record<string, unknown>
): { error: string; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

// =============================================================================
// CATEGORY ENUM
// =============================================================================

export const DISCIPLINE_CATEGORY_VALUES = [
  'engineering',
  'legal',
  'hr',
  'marketing',
  'finance',
  'operations',
  'design',
  'research',
  'sales',
  'support',
  'custom',
] as const;

export const disciplineCategoryEnum = z.enum(DISCIPLINE_CATEGORY_VALUES);

export type DisciplineCategory = z.infer<typeof disciplineCategoryEnum>;

// =============================================================================
// MCP SERVER CONFIG SCHEMA
// =============================================================================

export const mcpServerConfigSchema = z.object({
  name: z.string().min(1, 'MCP server name is required'),
  command: z.string().min(1, 'MCP server command is required'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  description: z.string().min(1, 'MCP server description is required'),
});

export type MCPServerConfigInput = z.infer<typeof mcpServerConfigSchema>;

// =============================================================================
// HOOK CONFIG SCHEMA
// =============================================================================

export const hookConfigSchema = z.object({
  event: z.enum(['PreToolUse', 'PostToolUse', 'PreCommit', 'PostCommit']),
  command: z.string().min(1, 'Hook command is required'),
  description: z.string().min(1, 'Hook description is required'),
  blocking: z.boolean().optional().default(false),
});

export type HookConfigInput = z.infer<typeof hookConfigSchema>;

// =============================================================================
// CLAUDE MD CONFIG SCHEMA
// =============================================================================

export const claudeMdConfigSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  context: z.string().min(1, 'Context is required'),
  rules: z.array(z.string()),
  objectives: z.array(z.string()),
  constraints: z.array(z.string()),
});

export const partialClaudeMdConfigSchema = claudeMdConfigSchema.partial();

export type ClaudeMdConfigInput = z.infer<typeof claudeMdConfigSchema>;
export type PartialClaudeMdConfigInput = z.infer<
  typeof partialClaudeMdConfigSchema
>;

// =============================================================================
// DISCIPLINE CRUD SCHEMAS
// =============================================================================

/**
 * Schema for creating a discipline
 */
export const createDisciplineSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(60, 'Slug must be less than 60 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase letters, numbers, and hyphens only'
    )
    .optional(),
  category: disciplineCategoryEnum,
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  config: z
    .object({
      claudeMd: partialClaudeMdConfigSchema.optional(),
      mcpServers: z.array(mcpServerConfigSchema).optional(),
      hooks: z.array(hookConfigSchema).optional(),
    })
    .optional(),
});

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;

/**
 * Schema for updating a discipline
 */
export const updateDisciplineSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  category: disciplineCategoryEnum.optional(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  config: z
    .object({
      claudeMd: partialClaudeMdConfigSchema.optional(),
      mcpServers: z.array(mcpServerConfigSchema).optional(),
      hooks: z.array(hookConfigSchema).optional(),
    })
    .optional(),
});

export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;

/**
 * Schema for updating discipline configuration only
 */
export const updateDisciplineConfigSchema = z.object({
  claudeMd: partialClaudeMdConfigSchema.optional(),
  mcpServers: z.array(mcpServerConfigSchema).optional(),
  hooks: z.array(hookConfigSchema).optional(),
});

export type UpdateDisciplineConfigInput = z.infer<
  typeof updateDisciplineConfigSchema
>;

// =============================================================================
// QUERY / FILTER SCHEMAS
// =============================================================================

export const disciplineFiltersSchema = z.object({
  category: disciplineCategoryEnum.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type DisciplineFiltersInput = z.infer<typeof disciplineFiltersSchema>;

// =============================================================================
// ASSIGN ORCHESTRATOR SCHEMA
// =============================================================================

export const assignOrchestratorSchema = z.object({
  orchestratorId: z.string().min(1, 'Orchestrator ID is required'),
});

export type AssignOrchestratorInput = z.infer<typeof assignOrchestratorSchema>;
