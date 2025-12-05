/**
 * Workflow Validation Schemas
 * @module lib/validations/workflow
 */

import { z } from 'zod';

export const WORKFLOW_ERROR_CODES = {
  INVALID_WORKFLOW: 'WORKFLOW_INVALID',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  INVALID_STATE: 'WORKFLOW_INVALID_STATE',
  TRANSITION_FAILED: 'WORKFLOW_TRANSITION_FAILED',
  VALIDATION_FAILED: 'WORKFLOW_VALIDATION_FAILED',
  CIRCULAR_DEPENDENCY: 'WORKFLOW_CIRCULAR_DEPENDENCY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  WORKFLOW_INACTIVE: 'WORKFLOW_INACTIVE',
  WORKFLOW_ALREADY_EXISTS: 'WORKFLOW_ALREADY_EXISTS',
  EXECUTION_NOT_FOUND: 'WORKFLOW_EXECUTION_NOT_FOUND',
  EXECUTION_FAILED: 'WORKFLOW_EXECUTION_FAILED',
} as const;

export type WorkflowErrorCode =
  (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];

export const workflowStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
  'ARCHIVED',
]);

/**
 * Workflow action schema
 */
export const workflowActionSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  config: z.record(z.unknown()).optional(),
  conditions: z.array(z.unknown()).optional(),
  timeout: z.number().positive().optional(),
  onError: z.enum(['stop', 'continue', 'retry']).optional(),
});

export type WorkflowAction = z.infer<typeof workflowActionSchema>;

/**
 * Workflow step result schema
 */
export const workflowStepResultSchema = z.object({
  stepId: z.string().optional(),
  actionId: z.string(),
  actionType: z.string(),
  status: z.enum([
    'pending',
    'running',
    'success',
    'completed',
    'failed',
    'skipped',
  ]),
  output: z.unknown().optional(),
  error: z.string().optional(),
  duration: z.number().optional(),
  durationMs: z.number().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

export type WorkflowStepResult = z.infer<typeof workflowStepResultSchema>;

export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['task', 'decision', 'parallel', 'loop', 'wait']),
  config: z.record(z.unknown()),
  dependencies: z.array(z.string()).optional(),
  conditions: z.array(z.record(z.unknown())).optional(),
  timeout: z.number().positive().optional(),
});

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  version: z.string().optional(),
  status: z.string(),
  steps: z.array(workflowStepSchema).optional(),
  triggers: z
    .array(
      z.object({
        type: z.enum(['manual', 'scheduled', 'event', 'webhook']),
        config: z.record(z.unknown()),
      }),
    )
    .optional(),
  trigger: z.record(z.unknown()).optional(),
  actions: z.array(workflowActionSchema).optional(),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().default('DRAFT'),
  trigger: z.record(z.unknown()),
  actions: z.array(workflowActionSchema),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export const workflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workspaceId: z.string().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  currentStep: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.union([z.string().datetime(), z.date()]),
  completedAt: z.union([z.string().datetime(), z.date()]).optional(),
  triggeredBy: z.string().optional(),
  triggerType: z.string().optional(),
  triggerData: z.record(z.unknown()).optional(),
  steps: z.array(workflowStepResultSchema).optional(),
  durationMs: z.number().optional(),
  isSimulation: z.boolean().optional(),
});

export const workflowTransitionSchema = z.object({
  executionId: z.string(),
  fromStep: z.string(),
  toStep: z.string(),
  condition: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

// =============================================================================
// WORKFLOW TRIGGER SCHEMAS
// =============================================================================

/**
 * Workflow trigger condition schema
 */
export const workflowTriggerConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'exists',
    'not_exists',
    'in',
    'not_in',
  ]),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});

/**
 * Workflow trigger schema
 */
export const workflowTriggerSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'event', 'webhook']),
  event: z.string().optional(),
  eventType: z.string().optional(),
  conditions: z.array(workflowTriggerConditionSchema).optional(),
  config: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
});

export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;

/**
 * Trigger workflows input schema
 */
export const triggerWorkflowsSchema = z.object({
  event: z.string().min(1, 'Event is required'),
  eventType: z.string().min(1, 'Event type is required'),
  eventData: z.record(z.unknown()),
  data: z.record(z.unknown()).optional(), // Alias for eventData
  source: z.string().optional(),
});

export type TriggerWorkflowsInput = z.infer<typeof triggerWorkflowsSchema>;

/**
 * Create a standardized workflow error response object
 */
export function createErrorResponse(
  message: string,
  code: WorkflowErrorCode,
  extraData?: Record<string, unknown>,
): { error: WorkflowErrorCode; message: string } & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

// =============================================================================
// ADDITIONAL WORKFLOW SCHEMAS
// =============================================================================

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

/**
 * Update workflow schema
 */
export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: workflowStatusSchema.optional(),
  steps: z.array(workflowStepSchema).optional(),
  triggers: z
    .array(
      z.object({
        type: z.enum(['manual', 'scheduled', 'event', 'webhook']),
        config: z.record(z.unknown()),
      }),
    )
    .optional(),
  trigger: z.record(z.unknown()).optional(),
  actions: z.array(workflowActionSchema).optional(),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

/**
 * Execute workflow schema
 */
export const executeWorkflowSchema = z.object({
  variables: z.record(z.unknown()).optional(),
  triggerData: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional(),
});

export type ExecuteWorkflowInput = z.infer<typeof executeWorkflowSchema>;

/**
 * Workflow execution type
 */
export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;

/**
 * Workflow filters schema
 */
export const workflowFiltersSchema = z.object({
  status: z.string().optional(),
  trigger: z.string().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type WorkflowFiltersInput = z.infer<typeof workflowFiltersSchema>;

/**
 * Execution filters schema
 */
export const executionFiltersSchema = z.object({
  status: z
    .enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['startedAt', 'completedAt', 'status']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ExecutionFiltersInput = z.infer<typeof executionFiltersSchema>;

/**
 * Workflow action type enum
 */
export const workflowActionTypeEnum = z.enum([
  'send_message',
  'send_notification',
  'update_record',
  'create_task',
  'call_api',
  'wait',
  'condition',
  'loop',
]);

export type WorkflowActionType = z.infer<typeof workflowActionTypeEnum>;

/**
 * Workflow condition schema for steps
 */
export const workflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'is_empty',
    'is_not_empty',
  ]),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});

export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;

/**
 * Test workflow schema
 */
export const testWorkflowSchema = z.object({
  testData: z.record(z.unknown()).optional(),
  sampleData: z.record(z.unknown()).optional(),
  steps: z.array(z.string()).optional(),
});

export type TestWorkflowInput = z.infer<typeof testWorkflowSchema>;

/**
 * Template filters schema
 */
export const templateFiltersSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type TemplateFiltersInput = z.infer<typeof templateFiltersSchema>;

/**
 * Workflow template type
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: {
    type: string;
    config: Record<string, unknown>;
    conditions: Array<{
      field: string;
      operator: string;
      value?: string | number | boolean | string[];
    }>;
    filters?: Record<string, unknown>;
  };
  actions: Array<{
    type: string;
    name?: string;
    config: Record<string, unknown>;
    conditions?: Array<{
      field: string;
      operator: string;
      value?: string | number | boolean | string[];
    }>;
    onError?: 'continue' | 'stop' | 'retry';
    retryConfig?: {
      maxRetries: number;
      delayMs: number;
    };
  }>;
  tags?: string[];
  isBuiltIn?: boolean;
  variables?: Record<string, unknown>;
}

/**
 * Create from template schema
 */
export const createFromTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
});

export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
