/**
 * Orchestrator Config Validation Schemas
 * @module lib/validations/orchestrator-config
 */

import { z } from 'zod';

export const ORCHESTRATOR_CONFIG_ERROR_CODES = {
  INVALID_CONFIG: 'CONFIG_INVALID',
  MISSING_REQUIRED: 'CONFIG_MISSING_REQUIRED',
  VALIDATION_FAILED: 'CONFIG_VALIDATION_FAILED',
  INCOMPATIBLE_VERSION: 'CONFIG_INCOMPATIBLE_VERSION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIG_LOCKED: 'CONFIG_LOCKED',
} as const;

export type OrchestratorConfigErrorCode =
  (typeof ORCHESTRATOR_CONFIG_ERROR_CODES)[keyof typeof ORCHESTRATOR_CONFIG_ERROR_CODES];

export const orchestratorConfigSchema = z.object({
  version: z.string(),
  maxConcurrentAgents: z.number().positive(),
  maxConcurrentTasks: z.number().positive(),
  taskTimeout: z.number().positive(),
  retryPolicy: z.object({
    maxRetries: z.number().nonnegative(),
    backoffMultiplier: z.number().positive(),
    initialDelay: z.number().positive(),
  }),
  resourceLimits: z.object({
    maxTokensPerTask: z.number().positive(),
    maxMemoryMB: z.number().positive(),
    maxCPUPercent: z.number().min(0).max(100),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    enableMetrics: z.boolean(),
    enableTracing: z.boolean(),
  }),
});

export const updateOrchestratorConfigSchema = orchestratorConfigSchema
  .partial()
  .extend({
    isLocked: z.boolean().optional(),
    adminOverrides: z.record(z.unknown()).optional(),
  });

export type UpdateOrchestratorConfigInput = z.infer<
  typeof updateOrchestratorConfigSchema
>;

export const agentConfigSchema = z.object({
  type: z.string(),
  maxInstances: z.number().positive(),
  defaultTimeout: z.number().positive(),
  capabilities: z.array(z.string()),
  parameters: z.record(z.unknown()).optional(),
});

export const capabilityConfigSchema = z.object({
  type: z.string(),
  enabled: z.boolean().optional(),
  permissionLevel: z.enum(['read', 'write', 'admin']).optional(),
  rateLimit: z
    .object({
      maxPerHour: z.number().optional(),
      maxPerDay: z.number().optional(),
    })
    .optional(),
});

export type CapabilityConfig = z.infer<typeof capabilityConfigSchema>;

export const responseTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  trigger: z.string().optional(),
  active: z.boolean().optional(),
});

export type ResponseTemplate = z.infer<typeof responseTemplateSchema>;

export const topologyConfigSchema = z.object({
  type: z.enum(['hierarchical', 'mesh', 'star', 'pipeline']),
  coordinatorId: z.string().optional(),
  agents: z.array(agentConfigSchema),
  connections: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        type: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * Create default orchestrator configuration
 */
export function createDefaultOrchestratorConfig(): z.infer<
  typeof orchestratorConfigSchema
> {
  return {
    version: '1.0.0',
    maxConcurrentAgents: 10,
    maxConcurrentTasks: 50,
    taskTimeout: 300000, // 5 minutes
    retryPolicy: {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
    },
    resourceLimits: {
      maxTokensPerTask: 100000,
      maxMemoryMB: 512,
      maxCPUPercent: 80,
    },
    logging: {
      level: 'info',
      enableMetrics: true,
      enableTracing: false,
    },
  };
}

/**
 * Update capabilities schema
 */
export const updateCapabilitiesSchema = z.object({
  capabilities: z.array(capabilityConfigSchema),
  replaceAll: z.boolean().optional().default(false),
});

export type UpdateCapabilitiesInput = z.infer<typeof updateCapabilitiesSchema>;
