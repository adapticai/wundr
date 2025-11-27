/**
 * @genesis/core - Workflow Automation Type Definitions
 *
 * Type definitions for the workflow automation service layer including
 * triggers, actions, conditions, templates, and execution records.
 *
 * @packageDocumentation
 */

// =============================================================================
// Core Workflow Status Types
// =============================================================================

/**
 * Workflow status.
 */
export type WorkflowStatus = 'active' | 'inactive' | 'draft' | 'error';

/**
 * Workflow trigger types.
 */
export type TriggerType =
  | 'message_received'
  | 'message_keyword'
  | 'channel_joined'
  | 'channel_left'
  | 'member_added'
  | 'member_removed'
  | 'file_uploaded'
  | 'reaction_added'
  | 'scheduled'
  | 'webhook_received'
  | 'vp_response'
  | 'manual';

/**
 * Workflow action types.
 */
export type ActionType =
  | 'send_message'
  | 'send_dm'
  | 'create_channel'
  | 'add_to_channel'
  | 'remove_from_channel'
  | 'assign_role'
  | 'send_email'
  | 'call_webhook'
  | 'invoke_vp'
  | 'delay'
  | 'condition'
  | 'set_variable'
  | 'loop';

// =============================================================================
// Trigger Configuration Types
// =============================================================================

/**
 * Trigger filter for conditional triggering.
 */
export interface TriggerFilter {
  /** Field to filter on */
  field: string;
  /** Comparison operator */
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'regex'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte';
  /** Value to compare against */
  value: string | number | boolean;
}

/**
 * Message trigger configuration.
 */
export interface MessageTriggerConfig {
  type: 'message_received';
  /** Specific channel IDs to watch (empty = all channels) */
  channelIds?: string[];
  /** Specific user IDs to watch (empty = all users) */
  fromUserIds?: string[];
  /** Exclude bot messages */
  excludeBots?: boolean;
}

/**
 * Keyword trigger configuration.
 */
export interface KeywordTriggerConfig {
  type: 'message_keyword';
  /** Keywords to match */
  keywords: string[];
  /** Match type */
  matchType: 'exact' | 'contains' | 'regex';
  /** Case sensitive matching */
  caseSensitive?: boolean;
}

/**
 * Scheduled trigger configuration.
 */
export interface ScheduledTriggerConfig {
  type: 'scheduled';
  /** Cron expression for scheduling */
  schedule: string;
  /** Timezone for the schedule */
  timezone?: string;
}

/**
 * Webhook trigger configuration.
 */
export interface WebhookTriggerConfig {
  type: 'webhook_received';
  /** Webhook ID to listen to */
  webhookId: string;
  /** Optional event filter */
  eventFilter?: string;
}

/**
 * Channel trigger configuration.
 */
export interface ChannelTriggerConfig {
  type: 'channel_joined' | 'channel_left';
  /** Specific channel IDs to watch */
  channelIds?: string[];
}

/**
 * Member trigger configuration.
 */
export interface MemberTriggerConfig {
  type: 'member_added' | 'member_removed';
  /** Specific channel IDs to watch */
  channelIds?: string[];
}

/**
 * File upload trigger configuration.
 */
export interface FileUploadTriggerConfig {
  type: 'file_uploaded';
  /** Specific channel IDs to watch */
  channelIds?: string[];
  /** File type filters (e.g., 'image/*', 'application/pdf') */
  mimeTypes?: string[];
}

/**
 * Reaction trigger configuration.
 */
export interface ReactionTriggerConfig {
  type: 'reaction_added';
  /** Specific emoji to watch for */
  emojis?: string[];
  /** Specific channel IDs to watch */
  channelIds?: string[];
}

/**
 * Orchestrator response trigger configuration.
 */
export interface VPResponseTriggerConfig {
  type: 'vp_response';
  /** OrchestratorID to watch */
  vpId?: string;
  /** Response type filter */
  responseType?: string;
}

/**
 * Manual trigger configuration.
 */
export interface ManualTriggerConfig {
  type: 'manual';
  /** Button label for triggering */
  buttonLabel?: string;
  /** Require confirmation before running */
  confirmationRequired?: boolean;
}

/**
 * Union type for all trigger configurations.
 */
export type TriggerConfig =
  | MessageTriggerConfig
  | KeywordTriggerConfig
  | ScheduledTriggerConfig
  | WebhookTriggerConfig
  | ChannelTriggerConfig
  | MemberTriggerConfig
  | FileUploadTriggerConfig
  | ReactionTriggerConfig
  | VPResponseTriggerConfig
  | ManualTriggerConfig;

/**
 * Workflow trigger definition.
 */
export interface WorkflowTrigger {
  /** Unique trigger ID */
  id: string;
  /** Trigger type */
  type: TriggerType;
  /** Trigger-specific configuration */
  config: TriggerConfig;
  /** Optional filters to apply */
  filters?: TriggerFilter[];
}

// =============================================================================
// Action Configuration Types
// =============================================================================

/**
 * Workflow attachment for messages.
 */
export interface WorkflowAttachment {
  /** Attachment type */
  type: 'file' | 'link' | 'button';
  /** URL for file or link */
  url?: string;
  /** Display label */
  label?: string;
  /** Action ID for button clicks */
  actionId?: string;
}

/**
 * Send message action configuration.
 */
export interface SendMessageConfig {
  type: 'send_message';
  /** Target channel ID (supports {{variable}} templating) */
  channelId: string;
  /** Message content (supports {{variable}} templating) */
  message: string;
  /** User IDs to mention */
  mentionUsers?: string[];
  /** Attachments to include */
  attachments?: WorkflowAttachment[];
}

/**
 * Send DM action configuration.
 */
export interface SendDMConfig {
  type: 'send_dm';
  /** Target user ID (supports {{trigger.userId}} templating) */
  userId: string;
  /** Message content (supports {{variable}} templating) */
  message: string;
}

/**
 * Create channel action configuration.
 */
export interface CreateChannelConfig {
  type: 'create_channel';
  /** Channel name (supports {{variable}} templating) */
  name: string;
  /** Channel description */
  description?: string;
  /** Make channel private */
  isPrivate?: boolean;
  /** User IDs to add as members */
  addMembers?: string[];
}

/**
 * Channel member action configuration.
 */
export interface ChannelMemberConfig {
  type: 'add_to_channel' | 'remove_from_channel';
  /** Target channel ID */
  channelId: string;
  /** User ID to add/remove */
  userId: string;
}

/**
 * Assign role action configuration.
 */
export interface AssignRoleConfig {
  type: 'assign_role';
  /** User ID to assign role to */
  userId: string;
  /** Role to assign */
  role: string;
  /** Scope (workspace, channel, etc.) */
  scope: string;
  /** Scope ID */
  scopeId: string;
}

/**
 * Send email action configuration.
 */
export interface SendEmailConfig {
  type: 'send_email';
  /** Email recipient */
  to: string;
  /** Email subject */
  subject: string;
  /** Email body */
  body: string;
  /** HTML body */
  html?: string;
}

/**
 * Webhook call action configuration.
 */
export interface WebhookActionConfig {
  type: 'call_webhook';
  /** Webhook URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string | Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Orchestrator invocation action configuration.
 */
export interface InvokeVPConfig {
  type: 'invoke_vp';
  /** OrchestratorID to invoke */
  vpId: string;
  /** Prompt for the Orchestrator */
  prompt: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Wait for Orchestrator response before continuing */
  waitForResponse?: boolean;
}

/**
 * Delay action configuration.
 */
export interface DelayConfig {
  type: 'delay';
  /** Duration amount */
  duration: number;
  /** Duration unit */
  unit?: 'ms' | 's' | 'm' | 'h' | 'd';
}

/**
 * Workflow condition for branching.
 */
export interface WorkflowCondition {
  /** Field to evaluate */
  field: string;
  /** Comparison operator */
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'is_empty'
    | 'is_not_empty';
  /** Value to compare against */
  value?: string | number | boolean;
  /** Logical operator for combining conditions */
  logicalOperator?: 'AND' | 'OR';
}

/**
 * Condition action configuration.
 */
export interface ConditionConfig {
  type: 'condition';
  /** Conditions to evaluate */
  conditions: WorkflowCondition[];
  /** Action IDs to execute if conditions are true */
  thenActions: string[];
  /** Action IDs to execute if conditions are false */
  elseActions?: string[];
}

/**
 * Set variable action configuration.
 */
export interface SetVariableConfig {
  type: 'set_variable';
  /** Variable name */
  name: string;
  /** Variable value */
  value: string | number | boolean;
  /** Optional expression to evaluate */
  expression?: string;
}

/**
 * Loop action configuration.
 */
export interface LoopConfig {
  type: 'loop';
  /** Collection variable name or expression */
  collection: string;
  /** Variable name for current item */
  itemVariable: string;
  /** Action IDs to execute for each item */
  actions: string[];
  /** Maximum iterations (safety limit) */
  maxIterations?: number;
}

/**
 * Union type for all action configurations.
 */
export type ActionConfig =
  | SendMessageConfig
  | SendDMConfig
  | CreateChannelConfig
  | ChannelMemberConfig
  | AssignRoleConfig
  | SendEmailConfig
  | WebhookActionConfig
  | InvokeVPConfig
  | DelayConfig
  | ConditionConfig
  | SetVariableConfig
  | LoopConfig;

/**
 * Workflow action definition.
 */
export interface WorkflowAction {
  /** Unique action ID */
  id: string;
  /** Action type */
  type: ActionType;
  /** Optional display name */
  name?: string;
  /** Action-specific configuration */
  config: ActionConfig;
  /** Error handling strategy */
  onError?: 'stop' | 'continue' | 'retry';
  /** Number of retry attempts */
  retryCount?: number;
}

// =============================================================================
// Workflow Variable Types
// =============================================================================

/**
 * Valid workflow variable value types.
 */
export type WorkflowVariableValue =
  | string
  | number
  | boolean
  | WorkflowVariableValue[]
  | { [key: string]: WorkflowVariableValue };

/**
 * Workflow variable definition.
 */
export interface WorkflowVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Default value */
  defaultValue?: WorkflowVariableValue;
}

// =============================================================================
// Main Workflow Types
// =============================================================================

/**
 * Main workflow definition.
 */
export interface Workflow {
  /** Unique workflow ID */
  id: string;
  /** Workspace this workflow belongs to */
  workspaceId: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Current status */
  status: WorkflowStatus;
  /** Trigger configuration */
  trigger: WorkflowTrigger;
  /** Actions to execute */
  actions: WorkflowAction[];
  /** Workflow variables */
  variables?: WorkflowVariable[];
  /** User who created the workflow */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last execution timestamp */
  lastRunAt?: Date;
  /** Total run count */
  runCount: number;
  /** Error count */
  errorCount: number;
}

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Execution status.
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Action result status.
 */
export type ActionResultStatus = 'success' | 'failed' | 'skipped';

/**
 * Action output data with typed values.
 * Different action types produce different output structures.
 */
export type ActionOutputData =
  | string
  | number
  | boolean
  | { [key: string]: string | number | boolean | string[] | null }
  | BuiltInActionResult;

/**
 * Single action execution result.
 */
export interface ActionResult {
  /** ID of the executed action */
  actionId: string;
  /** Result status */
  status: ActionResultStatus;
  /** Output data from the action */
  output?: ActionOutputData;
  /** Error message if failed */
  error?: string;
  /** When the action started */
  startedAt: Date;
  /** When the action completed */
  completedAt: Date;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Workflow execution record.
 */
export interface WorkflowExecution {
  /** Unique execution ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Execution status */
  status: ExecutionStatus;
  /** Data that triggered the workflow */
  triggerData: Record<string, unknown>;
  /** Current variable values */
  variables: Record<string, unknown>;
  /** Results from each action */
  actionResults: ActionResult[];
  /** When the execution started */
  startedAt: Date;
  /** When the execution completed */
  completedAt?: Date;
  /** Error message if failed */
  error?: string;
  /** Total duration in milliseconds */
  durationMs?: number;
}

// =============================================================================
// Template Types
// =============================================================================

/**
 * Template category.
 */
export type TemplateCategory =
  | 'onboarding'
  | 'notifications'
  | 'moderation'
  | 'productivity'
  | 'integration'
  | 'custom';

/**
 * Workflow template for quick creation.
 */
export interface WorkflowTemplate {
  /** Unique template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: TemplateCategory;
  /** Trigger configuration (without ID) */
  trigger: Omit<WorkflowTrigger, 'id'>;
  /** Actions (without IDs) */
  actions: Omit<WorkflowAction, 'id'>[];
  /** Variables */
  variables?: WorkflowVariable[];
  /** Searchable tags */
  tags: string[];
  /** Usage count */
  usageCount: number;
  /** Whether this is a built-in template */
  isBuiltIn: boolean;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Input for creating a new workflow.
 */
export interface CreateWorkflowInput {
  /** Workspace ID */
  workspaceId: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Trigger configuration */
  trigger: Omit<WorkflowTrigger, 'id'>;
  /** Actions */
  actions: Omit<WorkflowAction, 'id'>[];
  /** Variables */
  variables?: WorkflowVariable[];
  /** Initial status */
  status?: WorkflowStatus;
}

/**
 * Input for updating a workflow.
 */
export interface UpdateWorkflowInput {
  /** Updated name */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated trigger */
  trigger?: Omit<WorkflowTrigger, 'id'>;
  /** Updated actions */
  actions?: Omit<WorkflowAction, 'id'>[];
  /** Updated variables */
  variables?: WorkflowVariable[];
  /** Updated status */
  status?: WorkflowStatus;
}

/**
 * Options for listing workflows.
 */
export interface ListWorkflowsOptions {
  /** Filter by status */
  status?: WorkflowStatus;
  /** Filter by trigger type */
  triggerType?: TriggerType;
  /** Skip for pagination */
  skip?: number;
  /** Take for pagination */
  take?: number;
  /** Include inactive workflows */
  includeInactive?: boolean;
}

/**
 * Paginated workflow result.
 */
export interface PaginatedWorkflowResult {
  /** Workflow data */
  data: Workflow[];
  /** Total count */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Next cursor for pagination */
  nextCursor?: string;
}

/**
 * Options for listing executions.
 */
export interface ListExecutionsOptions {
  /** Filter by status */
  status?: ExecutionStatus;
  /** Filter by start date (after) */
  after?: Date;
  /** Filter by start date (before) */
  before?: Date;
  /** Skip for pagination */
  skip?: number;
  /** Take for pagination */
  take?: number;
}

/**
 * Paginated execution result.
 */
export interface PaginatedExecutionResult {
  /** Execution data */
  data: WorkflowExecution[];
  /** Total count */
  total: number;
  /** Whether there are more results */
  hasMore: boolean;
  /** Next cursor for pagination */
  nextCursor?: string;
}

// =============================================================================
// Execution Context Types
// =============================================================================

/**
 * Context passed to action execution.
 */
export interface ExecutionContext {
  /** Current workflow execution */
  execution: WorkflowExecution;
  /** Workflow definition */
  workflow: Workflow;
  /** Current variable values */
  variables: Record<string, unknown>;
  /** Trigger data */
  triggerData: Record<string, unknown>;
  /** Action results so far */
  actionResults: ActionResult[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for WorkflowStatus.
 */
export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return (
    value === 'active' ||
    value === 'inactive' ||
    value === 'draft' ||
    value === 'error'
  );
}

/**
 * Type guard for TriggerType.
 */
export function isTriggerType(value: unknown): value is TriggerType {
  const validTypes: TriggerType[] = [
    'message_received',
    'message_keyword',
    'channel_joined',
    'channel_left',
    'member_added',
    'member_removed',
    'file_uploaded',
    'reaction_added',
    'scheduled',
    'webhook_received',
    'vp_response',
    'manual',
  ];
  return typeof value === 'string' && validTypes.includes(value as TriggerType);
}

/**
 * Type guard for ActionType.
 */
export function isActionType(value: unknown): value is ActionType {
  const validTypes: ActionType[] = [
    'send_message',
    'send_dm',
    'create_channel',
    'add_to_channel',
    'remove_from_channel',
    'assign_role',
    'send_email',
    'call_webhook',
    'invoke_vp',
    'delay',
    'condition',
    'set_variable',
    'loop',
  ];
  return typeof value === 'string' && validTypes.includes(value as ActionType);
}

/**
 * Type guard for ExecutionStatus.
 */
export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

/**
 * Type guard for TemplateCategory.
 */
export function isTemplateCategory(value: unknown): value is TemplateCategory {
  const validCategories: TemplateCategory[] = [
    'onboarding',
    'notifications',
    'moderation',
    'productivity',
    'integration',
    'custom',
  ];
  return (
    typeof value === 'string' &&
    validCategories.includes(value as TemplateCategory)
  );
}

/**
 * Type guard for Workflow.
 */
export function isWorkflow(value: unknown): value is Workflow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const wf = value as Record<string, unknown>;

  return (
    typeof wf.id === 'string' &&
    typeof wf.workspaceId === 'string' &&
    typeof wf.name === 'string' &&
    isWorkflowStatus(wf.status) &&
    typeof wf.trigger === 'object' &&
    Array.isArray(wf.actions)
  );
}

/**
 * Type guard for WorkflowExecution.
 */
export function isWorkflowExecution(value: unknown): value is WorkflowExecution {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const exec = value as Record<string, unknown>;

  return (
    typeof exec.id === 'string' &&
    typeof exec.workflowId === 'string' &&
    isExecutionStatus(exec.status) &&
    typeof exec.triggerData === 'object' &&
    Array.isArray(exec.actionResults)
  );
}

/**
 * Type guard for CreateWorkflowInput.
 */
export function isValidCreateWorkflowInput(
  value: unknown,
): value is CreateWorkflowInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.workspaceId === 'string' &&
    input.workspaceId.length > 0 &&
    typeof input.name === 'string' &&
    input.name.length > 0 &&
    typeof input.trigger === 'object' &&
    Array.isArray(input.actions)
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default list options.
 */
export const DEFAULT_WORKFLOW_LIST_OPTIONS: Required<
  Pick<ListWorkflowsOptions, 'skip' | 'take' | 'includeInactive'>
> = {
  skip: 0,
  take: 20,
  includeInactive: false,
};

/**
 * Default execution list options.
 */
export const DEFAULT_EXECUTION_LIST_OPTIONS: Required<
  Pick<ListExecutionsOptions, 'skip' | 'take'>
> = {
  skip: 0,
  take: 50,
};

/**
 * Maximum workflow name length.
 */
export const MAX_WORKFLOW_NAME_LENGTH = 100;

/**
 * Maximum workflow description length.
 */
export const MAX_WORKFLOW_DESCRIPTION_LENGTH = 500;

/**
 * Maximum actions per workflow.
 */
export const MAX_ACTIONS_PER_WORKFLOW = 50;

/**
 * Maximum loop iterations.
 */
export const DEFAULT_MAX_LOOP_ITERATIONS = 100;

/**
 * Default delay duration in milliseconds.
 */
export const DEFAULT_DELAY_DURATION_MS = 1000;

/**
 * Maximum webhook timeout.
 */
export const MAX_WEBHOOK_TIMEOUT_MS = 30000;

/**
 * Valid trigger types.
 */
export const TRIGGER_TYPES: TriggerType[] = [
  'message_received',
  'message_keyword',
  'channel_joined',
  'channel_left',
  'member_added',
  'member_removed',
  'file_uploaded',
  'reaction_added',
  'scheduled',
  'webhook_received',
  'vp_response',
  'manual',
];

/**
 * Valid action types.
 */
export const ACTION_TYPES: ActionType[] = [
  'send_message',
  'send_dm',
  'create_channel',
  'add_to_channel',
  'remove_from_channel',
  'assign_role',
  'send_email',
  'call_webhook',
  'invoke_vp',
  'delay',
  'condition',
  'set_variable',
  'loop',
];

/**
 * Valid template categories.
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'onboarding',
  'notifications',
  'moderation',
  'productivity',
  'integration',
  'custom',
];

// =============================================================================
// Built-in Action Result Types
// =============================================================================

/**
 * Result of a delay action.
 */
export interface DelayActionResult {
  /** Duration delayed in milliseconds */
  delayed: number;
}

/**
 * Result of a condition action.
 */
export interface ConditionActionResult {
  /** Whether the condition matched */
  matched: boolean;
  /** Which branch was executed */
  branch: string;
}

/**
 * Result of a set variable action.
 */
export interface SetVariableActionResult {
  /** Variable name that was set */
  name: string;
  /** Value that was set - matches WorkflowVariableValue type */
  value: WorkflowVariableValue;
}

/**
 * Result of a loop action.
 */
export interface LoopActionResult {
  /** Number of iterations completed */
  iterations: number;
  /** Results from each iteration */
  results: ActionResult[][];
}

/**
 * Result of a send message action.
 */
export interface SendMessageActionResult {
  /** Channel ID message was sent to */
  channelId: string;
  /** Message content */
  message: string;
}

/**
 * Result of a send DM action.
 */
export interface SendDMActionResult {
  /** User ID DM was sent to */
  userId: string;
  /** Message content */
  message: string;
}

/**
 * Result of a webhook action.
 */
export interface WebhookActionResult {
  /** HTTP status code */
  status: number;
  /** Response body */
  body: string;
  /** Request URL */
  url: string;
  /** Request timeout */
  timeout: number;
  /** Request body if sent */
  requestBody?: string;
}

/**
 * Result of an invoke Orchestrator action.
 */
export interface InvokeVPActionResult {
  /** OrchestratorID that was invoked */
  vpId: string;
  /** Prompt sent to Orchestrator */
  prompt: string;
  /** Response from Orchestrator if waited for */
  response?: string;
}

/**
 * Result of a generic action without a specific handler.
 */
export interface GenericActionResult {
  /** Whether action was executed */
  executed: boolean;
  /** Action type */
  type: string;
}

/**
 * Union type of all built-in action results.
 */
export type BuiltInActionResult =
  | DelayActionResult
  | ConditionActionResult
  | SetVariableActionResult
  | LoopActionResult
  | SendMessageActionResult
  | SendDMActionResult
  | WebhookActionResult
  | InvokeVPActionResult
  | GenericActionResult;
