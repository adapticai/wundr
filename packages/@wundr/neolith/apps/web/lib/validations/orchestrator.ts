/**
 * Orchestrator Validation Schemas
 * @module lib/validations/orchestrator
 */

import { z } from 'zod';

import { ORCHESTRATOR_STATUS_VALUES } from '@/types/orchestrator';

export const ORCHESTRATOR_ERROR_CODES = {
  INVALID_REQUEST: 'ORCHESTRATOR_INVALID_REQUEST',
  AGENT_NOT_FOUND: 'ORCHESTRATOR_AGENT_NOT_FOUND',
  TASK_FAILED: 'ORCHESTRATOR_TASK_FAILED',
  TIMEOUT: 'ORCHESTRATOR_TIMEOUT',
  RESOURCE_EXHAUSTED: 'ORCHESTRATOR_RESOURCE_EXHAUSTED',
  INVALID_STATE: 'ORCHESTRATOR_INVALID_STATE',
  UNAUTHORIZED: 'ORCHESTRATOR_UNAUTHORIZED',
  VALIDATION_ERROR: 'ORCHESTRATOR_VALIDATION_ERROR',
  NOT_FOUND: 'ORCHESTRATOR_NOT_FOUND',
  FORBIDDEN: 'ORCHESTRATOR_FORBIDDEN',
  TASK_NOT_FOUND: 'ORCHESTRATOR_TASK_NOT_FOUND',
  CHANNEL_NOT_FOUND: 'ORCHESTRATOR_CHANNEL_NOT_FOUND',
  USER_NOT_FOUND: 'ORCHESTRATOR_USER_NOT_FOUND',
  DUPLICATE_EMAIL: 'ORCHESTRATOR_DUPLICATE_EMAIL',
  INTERNAL_ERROR: 'ORCHESTRATOR_INTERNAL_ERROR',
  INVALID_API_KEY: 'ORCHESTRATOR_INVALID_API_KEY',
  API_KEY_EXPIRED: 'ORCHESTRATOR_API_KEY_EXPIRED',
  BULK_OPERATION_PARTIAL: 'ORCHESTRATOR_BULK_OPERATION_PARTIAL',
} as const;

export type OrchestratorErrorCode =
  (typeof ORCHESTRATOR_ERROR_CODES)[keyof typeof ORCHESTRATOR_ERROR_CODES];

/**
 * Create a standardized orchestrator error response
 * Accepts both strict OrchestratorErrorCode and generic strings for flexibility
 */
export function createErrorResponse(
  message: string,
  code: OrchestratorErrorCode | string,
  extraData?: Record<string, unknown>
): { error: string; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

/**
 * Orchestrator status Zod enum schema
 *
 * Use this for validating orchestrator status in API routes and forms.
 * Values are imported from @/types/orchestrator to ensure consistency.
 */
export const orchestratorStatusEnum = z.enum(ORCHESTRATOR_STATUS_VALUES);

/**
 * @deprecated Use orchestratorStatusEnum directly
 */
export const orchestratorStatusSchema = orchestratorStatusEnum;

/**
 * TypeScript type inferred from the orchestrator status enum
 *
 * This should match the OrchestratorStatus type in types/orchestrator.ts
 */
export type OrchestratorStatusType = z.infer<typeof orchestratorStatusEnum>;

export const orchestratorRequestSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume', 'restart']),
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const orchestratorMetricsSchema = z.object({
  activeAgents: z.number().nonnegative(),
  queuedTasks: z.number().nonnegative(),
  completedTasks: z.number().nonnegative(),
  failedTasks: z.number().nonnegative(),
  averageTaskDuration: z.number().nonnegative(),
  resourceUsage: z.object({
    cpu: z.number().min(0).max(100),
    memory: z.number().min(0).max(100),
    tokens: z.number().nonnegative(),
  }),
  timestamp: z.string().datetime(),
});

export const orchestratorStateSchema = z.object({
  status: orchestratorStatusSchema,
  currentTask: z.string().optional(),
  metrics: orchestratorMetricsSchema,
  agents: z.array(z.string()),
  lastUpdated: z.string().datetime(),
});

/**
 * Create orchestrator user schema
 */
export const createOrchestratorUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

/**
 * Create orchestrator schema
 */
export const createOrchestratorSchema = z.object({
  discipline: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  organizationId: z.string().uuid(),
  capabilities: z.record(z.unknown()).optional(),
  daemonEndpoint: z.string().url().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']).default('OFFLINE'),
  user: createOrchestratorUserSchema.optional(),
});

export type CreateOrchestratorInput = z.infer<typeof createOrchestratorSchema>;

/**
 * Update orchestrator user profile schema
 */
export const updateOrchestratorUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

/**
 * Update orchestrator schema
 */
export const updateOrchestratorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: z.record(z.unknown()).optional(),
  autoStart: z.boolean().optional(),
  user: updateOrchestratorUserSchema.optional(),
  discipline: z.string().optional(),
  role: z.string().optional(),
  capabilities: z.record(z.unknown()).optional(),
  daemonEndpoint: z.string().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']).optional(),
});

export type UpdateOrchestratorInput = z.infer<typeof updateOrchestratorSchema>;

/**
 * Orchestrator ID param schema
 */
export const orchestratorIdParamSchema = z.object({
  orchestratorId: z.string().uuid(),
});

export type OrchestratorIdParam = z.infer<typeof orchestratorIdParamSchema>;

/**
 * Orchestrator status update schema
 */
export const orchestratorStatusUpdateSchema = z.object({
  status: orchestratorStatusEnum,
  reason: z.string().max(500).optional(),
  channelId: z.string().optional(),
  statusType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  message: z.string().optional(),
});

export type OrchestratorStatusUpdate = z.infer<
  typeof orchestratorStatusUpdateSchema
>;

/**
 * Orchestrator filters schema
 */
export const orchestratorFiltersSchema = z.object({
  organizationId: z.string().uuid().optional(),
  discipline: z.string().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type OrchestratorFilters = z.infer<typeof orchestratorFiltersSchema>;
export type OrchestratorFiltersInput = OrchestratorFilters;

/**
 * Orchestrator action schema
 */
export const orchestratorActionSchema = z.object({
  action: z.enum([
    'activate',
    'deactivate',
    'start',
    'stop',
    'pause',
    'resume',
    'restart',
  ]),
  parameters: z.record(z.unknown()).optional(),
  reason: z.string().max(500).optional(),
});

export type OrchestratorAction = z.infer<typeof orchestratorActionSchema>;

/**
 * Orchestrator bulk action schema
 */
export const orchestratorBulkActionSchema = z
  .object({
    orchestratorIds: z.array(z.string().uuid()).min(1).max(50).optional(),
    ids: z.array(z.string().uuid()).min(1).max(50).optional(),
    action: z.enum([
      'activate',
      'deactivate',
      'start',
      'stop',
      'pause',
      'resume',
      'restart',
      'delete',
    ]),
    parameters: z.record(z.unknown()).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(data => data.orchestratorIds || data.ids, {
    message: "Either 'orchestratorIds' or 'ids' must be provided",
    path: ['ids'],
  });

export type OrchestratorBulkAction = z.infer<
  typeof orchestratorBulkActionSchema
>;

/**
 * Escalate task schema
 */
export const escalateTaskSchema = z.object({
  taskId: z.string().uuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reason: z.string().min(1).max(500),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  context: z.record(z.unknown()).optional(),
  channelId: z.string().uuid().optional(),
  assignTo: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type EscalateTaskInput = z.infer<typeof escalateTaskSchema>;

/**
 * Initiate conversation schema
 */
export const initiateConversationSchema = z.object({
  orchestratorId: z.string().uuid(),
  message: z.string().min(1).max(5000).optional(),
  content: z.string().min(1).max(5000),
  targetType: z.enum(['channel', 'user']).optional(),
  targetId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  context: z.record(z.unknown()).optional(),
  metadata: z
    .object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type InitiateConversationInput = z.infer<
  typeof initiateConversationSchema
>;

/**
 * Generate API key schema
 */
export const generateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  orchestratorId: z.string().uuid().optional(),
  expiresInDays: z.number().int().positive().optional(),
  scopes: z
    .array(z.enum(['read', 'write', 'execute', 'admin']))
    .min(1)
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type GenerateApiKeyInput = z.infer<typeof generateApiKeySchema>;

/**
 * Validate API key schema
 */
export const validateApiKeySchema = z.object({
  apiKey: z.string().min(32),
  orchestratorId: z.string().optional(),
  requiredPermissions: z
    .array(z.enum(['read', 'write', 'execute', 'admin']))
    .optional(),
});

export type ValidateApiKeyInput = z.infer<typeof validateApiKeySchema>;

/**
 * Type aliases for Input types (for backward compatibility)
 */
export type OrchestratorStatusUpdateInput = OrchestratorStatusUpdate;
export type OrchestratorBulkActionInput = OrchestratorBulkAction;
export type OrchestratorActionInput = OrchestratorAction;
