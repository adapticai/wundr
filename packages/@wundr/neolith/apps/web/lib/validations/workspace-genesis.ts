/**
 * Workspace Genesis Validation Schemas
 * @module lib/validations/workspace-genesis
 */

import { z } from 'zod';

export const WORKSPACE_GENESIS_ERROR_CODES = {
  INVALID_CONFIGURATION: 'GENESIS_INVALID_CONFIG',
  INITIALIZATION_FAILED: 'GENESIS_INIT_FAILED',
  TEMPLATE_NOT_FOUND: 'GENESIS_TEMPLATE_NOT_FOUND',
  INVALID_TEMPLATE: 'GENESIS_INVALID_TEMPLATE',
  RESOURCE_CREATION_FAILED: 'GENESIS_RESOURCE_FAILED',
} as const;

/**
 * Genesis-related error codes for generate-org endpoint
 */
export const GENESIS_ERROR_CODES = {
  UNAUTHORIZED: 'GENESIS_UNAUTHORIZED',
  VALIDATION_ERROR: 'GENESIS_VALIDATION_ERROR',
  ORG_NOT_FOUND: 'GENESIS_ORG_NOT_FOUND',
  FORBIDDEN: 'GENESIS_FORBIDDEN',
  WORKSPACE_SLUG_EXISTS: 'GENESIS_WORKSPACE_SLUG_EXISTS',
  GENERATION_FAILED: 'GENESIS_GENERATION_FAILED',
  MIGRATION_FAILED: 'GENESIS_MIGRATION_FAILED',
  INTERNAL_ERROR: 'GENESIS_INTERNAL_ERROR',
} as const;

export type GenesisErrorCode =
  (typeof GENESIS_ERROR_CODES)[keyof typeof GENESIS_ERROR_CODES];

/**
 * Create a standardized genesis error response object
 */
export function createGenesisErrorResponse(
  message: string,
  code: GenesisErrorCode,
  extraData?: Record<string, unknown>
): { error: GenesisErrorCode; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

export type WorkspaceGenesisErrorCode =
  (typeof WORKSPACE_GENESIS_ERROR_CODES)[keyof typeof WORKSPACE_GENESIS_ERROR_CODES];

export const workspaceTemplateSchema = z.enum([
  'blank',
  'software_development',
  'data_science',
  'content_creation',
  'research',
  'custom',
]);

export const genesisConfigSchema = z.object({
  template: workspaceTemplateSchema,
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  ownerId: z.string(),
  settings: z.object({
    visibility: z.enum(['private', 'team', 'public']),
    features: z.array(z.string()).optional(),
    integrations: z.array(z.string()).optional(),
  }),
  initialResources: z
    .object({
      createDefaultChannels: z.boolean().optional(),
      createDefaultRoles: z.boolean().optional(),
      importData: z.boolean().optional(),
    })
    .optional(),
  customization: z.record(z.unknown()).optional(),
});

export const genesisProgressSchema = z.object({
  phase: z.enum([
    'validating',
    'creating_workspace',
    'setting_up_roles',
    'creating_channels',
    'configuring_integrations',
    'importing_data',
    'finalizing',
    'completed',
  ]),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export const genesisResultSchema = z.object({
  workspaceId: z.string(),
  status: z.enum(['success', 'partial', 'failed']),
  resources: z.object({
    workspace: z.boolean(),
    roles: z.number().nonnegative(),
    channels: z.number().nonnegative(),
    integrations: z.number().nonnegative(),
  }),
  errors: z
    .array(
      z.object({
        phase: z.string(),
        message: z.string(),
        recoverable: z.boolean(),
      })
    )
    .optional(),
  completedAt: z.string().datetime(),
});

export const workspaceImportSchema = z.object({
  source: z.enum(['file', 'url', 'integration']),
  format: z.enum(['json', 'yaml', 'csv', 'custom']),
  data: z.unknown(),
  mapping: z.record(z.string()).optional(),
  options: z
    .object({
      skipErrors: z.boolean().optional(),
      dryRun: z.boolean().optional(),
    })
    .optional(),
});

// =============================================================================
// GENERATE ORG SCHEMA
// =============================================================================

/**
 * Generate organization input schema for POST /api/workspaces/generate-org
 */
export const generateOrgSchema = z.object({
  organizationName: z.string().min(1, 'Organization name is required'),
  organizationId: z.string().uuid('Invalid organization ID'),
  workspaceName: z.string().min(1, 'Workspace name is required'),
  workspaceSlug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase letters, numbers, and hyphens only'
    ),
  workspaceDescription: z.string().optional(),
  workspaceIconUrl: z.string().url().optional(),
  organizationType: z.enum([
    'technology',
    'finance',
    'healthcare',
    'education',
    'retail',
    'manufacturing',
    'services',
    'other',
  ]),
  description: z.string().min(1, 'Description is required'),
  strategy: z.string().min(1, 'Strategy is required'),
  targetAssets: z
    .array(z.string())
    .min(1, 'At least one target asset is required'),
  riskTolerance: z.enum(['low', 'moderate', 'high']),
  teamSize: z.enum(['small', 'medium', 'large', 'enterprise']),
  verbose: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export type GenerateOrgInput = z.infer<typeof generateOrgSchema>;
