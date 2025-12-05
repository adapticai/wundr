/**
 * Creation Validation Schemas
 * Zod schemas for conversational creation flow
 *
 * @module lib/validations/creation
 */

import { z } from 'zod';

// =============================================================================
// CONVERSATION SCHEMAS
// =============================================================================

/**
 * Chat message schema
 */
export const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'Message content cannot be empty'),
});

/**
 * Conversation request schema
 */
export const conversationRequestSchema = z.object({
  entityType: z.enum([
    'workspace',
    'orchestrator',
    'session-manager',
    'subagent',
    'workflow',
    'channel',
  ]),
  messages: z
    .array(conversationMessageSchema)
    .min(1, 'At least one message is required'),
  workspaceId: z.string().optional(),
  workspaceContext: z
    .object({
      workspaceId: z.string().optional(),
      existingOrchestrators: z.array(z.string()).optional(),
      existingChannels: z.array(z.string()).optional(),
      existingWorkflows: z.array(z.string()).optional(),
      sessionManagers: z.array(z.string()).optional(),
      subagents: z.array(z.string()).optional(),
    })
    .optional(),
});

// =============================================================================
// ORCHESTRATOR SPEC SCHEMA
// =============================================================================

/**
 * Escalation rules schema for orchestrators
 */
export const escalationRulesSchema = z.object({
  timeoutMinutes: z.number().min(1).max(1440).default(30),
  complexityThreshold: z.number().min(0).max(10).default(7),
  autoEscalateKeywords: z.array(z.string()).optional(),
  escalationChannelId: z.string().optional(),
});

/**
 * Session manager spec for orchestrators
 */
export const sessionManagerSpecSchema = z.object({
  name: z.string().min(1, 'Session manager name is required'),
  purpose: z.string().min(10, 'Purpose must be at least 10 characters'),
  channelId: z.string().optional(),
  context: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
});

/**
 * Subagent spec for orchestrators
 */
export const subagentSpecSchema = z.object({
  name: z.string().min(1, 'Subagent name is required'),
  capability: z
    .string()
    .min(10, 'Capability description must be at least 10 characters'),
  taskType: z.string().optional(),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
});

/**
 * Full orchestrator specification schema
 */
export const orchestratorSpecSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  role: z
    .string()
    .min(1, 'Role is required')
    .max(100, 'Role must be less than 100 characters'),
  charter: z
    .string()
    .min(10, 'Charter must be at least 10 characters')
    .max(2000, 'Charter must be less than 2000 characters'),
  communicationStyle: z
    .enum(['formal', 'friendly', 'technical'])
    .default('friendly'),
  discipline: z.string().optional(),
  channels: z.array(z.string()).default([]),
  escalationRules: escalationRulesSchema.optional(),
  sessionManagers: z.array(sessionManagerSpecSchema).optional(),
  subagents: z.array(subagentSpecSchema).optional(),
  responsePatterns: z
    .object({
      greeting: z.string().optional(),
      acknowledgment: z.string().optional(),
      escalation: z.string().optional(),
    })
    .optional(),
});

// =============================================================================
// WORKFLOW SPEC SCHEMA
// =============================================================================

/**
 * Workflow trigger schema
 */
export const workflowTriggerSchema = z.object({
  type: z.enum(['event', 'schedule', 'manual', 'webhook']),
  eventType: z.string().optional(),
  schedule: z.string().optional(), // cron expression
  webhookUrl: z.string().url().optional(),
  conditions: z.array(z.string()).optional(),
});

/**
 * Workflow step schema
 */
export const workflowStepSchema = z.object({
  name: z.string().min(1, 'Step name is required'),
  type: z.enum(['task', 'decision', 'notification', 'api-call', 'wait']),
  description: z.string().optional(),
  agentId: z.string().optional(),
  action: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  onSuccess: z.string().optional(),
  onFailure: z.string().optional(),
});

/**
 * Full workflow specification schema
 */
export const workflowSpecSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(100),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema).min(1, 'At least one step is required'),
  successOutcome: z.string().optional(),
  failureOutcome: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

// =============================================================================
// CHANNEL SPEC SCHEMA
// =============================================================================

/**
 * Channel specification schema
 */
export const channelSpecSchema = z.object({
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(80, 'Channel name must be less than 80 characters')
    .regex(
      /^[a-z0-9-_]+$/,
      'Channel name must contain only lowercase letters, numbers, hyphens, and underscores'
    ),
  displayName: z.string().optional(),
  type: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  purpose: z
    .string()
    .max(200, 'Purpose must be less than 200 characters')
    .optional(),
  initialMembers: z.array(z.string()).default([]),
  orchestratorIds: z.array(z.string()).default([]),
  rules: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// =============================================================================
// WORKSPACE SPEC SCHEMA
// =============================================================================

/**
 * Workspace specification schema
 */
export const workspaceSpecSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  description: z.string().optional(),
  industry: z.string().optional(),
  teamSize: z.number().int().positive().optional(),
  departments: z.array(z.string()).optional(),
  initialOrchestrators: z.array(orchestratorSpecSchema).optional(),
  initialChannels: z.array(channelSpecSchema).optional(),
  initialWorkflows: z.array(workflowSpecSchema).optional(),
});

// =============================================================================
// SESSION MANAGER SPEC SCHEMA
// =============================================================================

/**
 * Session manager specification schema
 */
export const sessionManagerFullSpecSchema = z.object({
  name: z.string().min(1, 'Session manager name is required').max(100),
  orchestratorId: z.string().min(1, 'Parent orchestrator is required'),
  purpose: z
    .string()
    .min(10, 'Purpose must be at least 10 characters')
    .max(1000),
  channelId: z.string().optional(),
  context: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  escalationCriteria: z.array(z.string()).optional(),
  subagents: z.array(subagentSpecSchema).optional(),
});

// =============================================================================
// FULL SUBAGENT SPEC SCHEMA
// =============================================================================

/**
 * Full subagent specification schema
 */
export const subagentFullSpecSchema = z.object({
  name: z.string().min(1, 'Subagent name is required').max(100),
  parentId: z
    .string()
    .min(1, 'Parent (Session Manager or Orchestrator) is required'),
  parentType: z.enum(['orchestrator', 'session-manager']),
  capability: z
    .string()
    .min(10, 'Capability description must be at least 10 characters')
    .max(1000),
  taskType: z.string(),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  errorHandling: z.string().optional(),
  examples: z.array(z.string()).optional(),
});

// =============================================================================
// PARSE SPEC REQUEST SCHEMA
// =============================================================================

/**
 * Parse spec request schema
 */
export const parseSpecRequestSchema = z.object({
  entityType: z.enum([
    'workspace',
    'orchestrator',
    'session-manager',
    'subagent',
    'workflow',
    'channel',
  ]),
  spec: z.any(), // Will be validated against specific schema based on entityType
});

// =============================================================================
// GENERATE REQUEST SCHEMA
// =============================================================================

/**
 * Generate entity request schema
 */
export const generateRequestSchema = z.object({
  entityType: z.enum([
    'workspace',
    'orchestrator',
    'session-manager',
    'subagent',
    'workflow',
    'channel',
  ]),
  spec: z.any(), // Pre-validated spec
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
});

// =============================================================================
// ERROR CODES
// =============================================================================

export const CREATION_ERROR_CODES = {
  UNAUTHORIZED: 'CREATION_UNAUTHORIZED',
  VALIDATION_ERROR: 'CREATION_VALIDATION_ERROR',
  SPEC_PARSE_ERROR: 'CREATION_SPEC_PARSE_ERROR',
  ENTITY_EXISTS: 'CREATION_ENTITY_EXISTS',
  WORKSPACE_NOT_FOUND: 'CREATION_WORKSPACE_NOT_FOUND',
  PARENT_NOT_FOUND: 'CREATION_PARENT_NOT_FOUND',
  INTERNAL_ERROR: 'CREATION_INTERNAL_ERROR',
  LLM_ERROR: 'CREATION_LLM_ERROR',
} as const;

/**
 * Create standardized error response
 */
export function createCreationErrorResponse(
  message: string,
  code: (typeof CREATION_ERROR_CODES)[keyof typeof CREATION_ERROR_CODES],
  details?: Record<string, unknown>
) {
  return {
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export type OrchestratorSpec = z.infer<typeof orchestratorSpecSchema>;
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>;
export type ChannelSpec = z.infer<typeof channelSpecSchema>;
export type WorkspaceSpec = z.infer<typeof workspaceSpecSchema>;
export type SessionManagerSpec = z.infer<typeof sessionManagerFullSpecSchema>;
export type SubagentSpec = z.infer<typeof subagentFullSpecSchema>;
export type ParseSpecRequest = z.infer<typeof parseSpecRequestSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
