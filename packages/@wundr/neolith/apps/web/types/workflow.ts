/**
 * Workflow types for Genesis-App
 *
 * This module provides comprehensive TypeScript types for the workflow automation system,
 * including workflow definitions, execution tracking, and configuration.
 */

/**
 * Branded type for workflow IDs to prevent mixing with other string IDs
 */
export type WorkflowId = string & { readonly __brand: 'WorkflowId' };

/**
 * Branded type for action IDs to prevent mixing with other string IDs
 */
export type ActionId = string & { readonly __brand: 'ActionId' };

/**
 * Branded type for execution IDs to prevent mixing with other string IDs
 */
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };

/**
 * Possible states a workflow can be in
 */
export type WorkflowStatus = 'active' | 'inactive' | 'draft' | 'archived';

/**
 * Available trigger types that can initiate a workflow
 */
export type TriggerType =
  | 'schedule'
  | 'message'
  | 'keyword'
  | 'channel_join'
  | 'channel_leave'
  | 'user_join'
  | 'reaction'
  | 'mention'
  | 'webhook';

/**
 * Available action types that can be performed in a workflow
 */
export type ActionType =
  | 'send_message'
  | 'send_dm'
  | 'create_channel'
  | 'invite_to_channel'
  | 'assign_role'
  | 'add_reaction'
  | 'http_request'
  | 'wait'
  | 'condition'
  | 'notify_orchestrator';

/**
 * HTTP methods supported for webhook actions
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Channel visibility types
 */
export type ChannelType = 'public' | 'private';

/**
 * Time units for wait actions
 */
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/**
 * Comparison operators for conditional logic
 */
export type ComparisonOperator =
  | 'equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'exists';

/**
 * Keyword match strategies
 */
export type MatchType = 'exact' | 'contains' | 'regex';

/**
 * Error handling strategies
 */
export type ErrorHandlingStrategy = 'stop' | 'continue' | 'retry';

/**
 * Schedule trigger configuration
 */
export interface ScheduleTrigger {
  readonly type: 'schedule';
  readonly schedule: {
    readonly cron: string;
    readonly timezone?: string;
  };
}

/**
 * Message trigger configuration
 */
export interface MessageTrigger {
  readonly type: 'message';
  readonly message: {
    readonly channelIds?: readonly string[];
    readonly userIds?: readonly string[];
    readonly pattern?: string;
  };
}

/**
 * Keyword trigger configuration
 */
export interface KeywordTrigger {
  readonly type: 'keyword';
  readonly keyword: {
    readonly keywords: readonly string[];
    readonly matchType: MatchType;
  };
}

/**
 * Channel join trigger configuration
 */
export interface ChannelJoinTrigger {
  readonly type: 'channel_join';
  readonly channel: {
    readonly channelIds?: readonly string[];
  };
}

/**
 * Channel leave trigger configuration
 */
export interface ChannelLeaveTrigger {
  readonly type: 'channel_leave';
  readonly channel: {
    readonly channelIds?: readonly string[];
  };
}

/**
 * User join trigger configuration
 */
export interface UserJoinTrigger {
  readonly type: 'user_join';
}

/**
 * Reaction trigger configuration
 */
export interface ReactionTrigger {
  readonly type: 'reaction';
  readonly reaction: {
    readonly emoji?: string;
    readonly channelIds?: readonly string[];
  };
}

/**
 * Mention trigger configuration
 */
export interface MentionTrigger {
  readonly type: 'mention';
  readonly mention: {
    readonly userIds?: readonly string[];
    readonly orchestratorIds?: readonly string[];
  };
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTrigger {
  readonly type: 'webhook';
  readonly webhook: {
    readonly secret?: string;
  };
}

/**
 * Discriminated union of all trigger configurations
 */
export type TriggerConfig =
  | ScheduleTrigger
  | MessageTrigger
  | KeywordTrigger
  | ChannelJoinTrigger
  | ChannelLeaveTrigger
  | UserJoinTrigger
  | ReactionTrigger
  | MentionTrigger
  | WebhookTrigger;

/**
 * Error handling configuration for actions
 */
export interface ErrorHandlingConfig {
  readonly onError: ErrorHandlingStrategy;
  readonly retryCount?: number;
  readonly retryDelay?: number;
}

/**
 * Conditional logic configuration
 */
export interface ConditionConfig {
  readonly field: string;
  readonly operator: ComparisonOperator;
  readonly value: string;
}

/**
 * Send message action configuration
 */
export interface SendMessageAction {
  readonly id: ActionId;
  readonly type: 'send_message';
  readonly order: number;
  readonly config: {
    readonly channelId: string;
    readonly message: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Send DM action configuration
 */
export interface SendDmAction {
  readonly id: ActionId;
  readonly type: 'send_dm';
  readonly order: number;
  readonly config: {
    readonly userId: string;
    readonly message: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Create channel action configuration
 */
export interface CreateChannelAction {
  readonly id: ActionId;
  readonly type: 'create_channel';
  readonly order: number;
  readonly config: {
    readonly channelName: string;
    readonly channelType: ChannelType;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Invite to channel action configuration
 */
export interface InviteToChannelAction {
  readonly id: ActionId;
  readonly type: 'invite_to_channel';
  readonly order: number;
  readonly config: {
    readonly channelId: string;
    readonly userId: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Assign role action configuration
 */
export interface AssignRoleAction {
  readonly id: ActionId;
  readonly type: 'assign_role';
  readonly order: number;
  readonly config: {
    readonly roleId: string;
    readonly userId: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Add reaction action configuration
 */
export interface AddReactionAction {
  readonly id: ActionId;
  readonly type: 'add_reaction';
  readonly order: number;
  readonly config: {
    readonly emoji: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * HTTP request action configuration
 */
export interface HttpRequestAction {
  readonly id: ActionId;
  readonly type: 'http_request';
  readonly order: number;
  readonly config: {
    readonly url: string;
    readonly method: HttpMethod;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Wait action configuration
 */
export interface WaitAction {
  readonly id: ActionId;
  readonly type: 'wait';
  readonly order: number;
  readonly config: {
    readonly duration: number;
    readonly unit: TimeUnit;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Condition action configuration
 */
export interface ConditionAction {
  readonly id: ActionId;
  readonly type: 'condition';
  readonly order: number;
  readonly config: {
    readonly condition: ConditionConfig;
    readonly thenActions?: readonly ActionId[];
    readonly elseActions?: readonly ActionId[];
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Notify orchestrator action configuration
 */
export interface NotifyOrchestratorAction {
  readonly id: ActionId;
  readonly type: 'notify_orchestrator';
  readonly order: number;
  readonly config: {
    readonly orchestratorId: string;
    readonly message: string;
  };
  readonly errorHandling?: ErrorHandlingConfig;
}

/**
 * Discriminated union of all action configurations
 */
export type ActionConfig =
  | SendMessageAction
  | SendDmAction
  | CreateChannelAction
  | InviteToChannelAction
  | AssignRoleAction
  | AddReactionAction
  | HttpRequestAction
  | WaitAction
  | ConditionAction
  | NotifyOrchestratorAction;

/**
 * Variable types supported in workflows
 */
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Variable sources
 */
export type VariableSource = 'trigger' | 'action' | 'custom';

/**
 * Workflow variable definition with type-safe default values
 */
export interface WorkflowVariable {
  readonly name: string;
  readonly type: VariableType;
  readonly description?: string;
  readonly defaultValue?:
    | string
    | number
    | boolean
    | readonly unknown[]
    | Readonly<Record<string, unknown>>;
  readonly source: VariableSource;
}

/**
 * Complete workflow definition
 */
export interface Workflow {
  readonly id: WorkflowId;
  readonly name: string;
  readonly description?: string;
  readonly status: WorkflowStatus;
  readonly workspaceId: string;
  readonly trigger: TriggerConfig;
  readonly actions: readonly ActionConfig[];
  readonly variables?: readonly WorkflowVariable[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly lastRunAt?: string;
  readonly runCount: number;
  readonly errorCount: number;
}

/**
 * Execution status for workflows and actions
 */
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Action result status
 */
export type ActionResultStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Result of a single action execution
 */
export interface ActionResult {
  readonly actionId: ActionId;
  readonly actionType: ActionType;
  readonly status: ActionResultStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly duration?: number;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

/**
 * Complete workflow execution record
 */
export interface WorkflowExecution {
  readonly id: ExecutionId;
  readonly workflowId: WorkflowId;
  readonly status: ExecutionStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly duration?: number;
  readonly triggeredBy: string;
  readonly triggerData?: Readonly<Record<string, unknown>>;
  readonly actionResults: readonly ActionResult[];
  readonly error?: string;
}

/**
 * Categories for workflow templates
 */
export type WorkflowTemplateCategory =
  | 'onboarding'
  | 'notifications'
  | 'automation'
  | 'integration'
  | 'moderation'
  | 'scheduling'
  | 'custom';

/**
 * Workflow template for quick workflow creation
 */
export interface WorkflowTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: WorkflowTemplateCategory;
  readonly trigger: TriggerConfig;
  readonly actions: readonly Omit<ActionConfig, 'id'>[];
  readonly variables?: readonly Omit<WorkflowVariable, 'source'>[];
  readonly usageCount: number;
  readonly tags: readonly string[];
}

/**
 * UI configuration for workflow status display
 */
export const WORKFLOW_STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
  },
  draft: {
    label: 'Draft',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-600 dark:text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30',
  },
} as const satisfies Record<
  WorkflowStatus,
  { label: string; color: string; bgColor: string }
>;

/**
 * UI configuration for trigger type display
 */
export const TRIGGER_TYPE_CONFIG = {
  schedule: {
    label: 'Schedule',
    description: 'Run on a recurring schedule',
    icon: 'clock',
  },
  message: {
    label: 'New Message',
    description: 'Triggered when a message is posted',
    icon: 'message',
  },
  keyword: {
    label: 'Keyword',
    description: 'Triggered when specific keywords are detected',
    icon: 'tag',
  },
  channel_join: {
    label: 'Channel Join',
    description: 'Triggered when someone joins a channel',
    icon: 'user-plus',
  },
  channel_leave: {
    label: 'Channel Leave',
    description: 'Triggered when someone leaves a channel',
    icon: 'user-minus',
  },
  user_join: {
    label: 'User Join',
    description: 'Triggered when a new user joins the workspace',
    icon: 'user-check',
  },
  reaction: {
    label: 'Reaction',
    description: 'Triggered when a reaction is added',
    icon: 'smile',
  },
  mention: {
    label: 'Mention',
    description: 'Triggered when someone is mentioned',
    icon: 'at-sign',
  },
  webhook: {
    label: 'Webhook',
    description: 'Triggered by external webhook',
    icon: 'link',
  },
} as const satisfies Record<
  TriggerType,
  { label: string; description: string; icon: string }
>;

/**
 * UI configuration for action type display
 */
export const ACTION_TYPE_CONFIG = {
  send_message: {
    label: 'Send Message',
    description: 'Send a message to a channel',
    icon: 'message-circle',
  },
  send_dm: {
    label: 'Send DM',
    description: 'Send a direct message to a user',
    icon: 'mail',
  },
  create_channel: {
    label: 'Create Channel',
    description: 'Create a new channel',
    icon: 'plus-square',
  },
  invite_to_channel: {
    label: 'Invite to Channel',
    description: 'Invite a user to a channel',
    icon: 'user-plus',
  },
  assign_role: {
    label: 'Assign Role',
    description: 'Assign a role to a user',
    icon: 'shield',
  },
  add_reaction: {
    label: 'Add Reaction',
    description: 'Add a reaction to a message',
    icon: 'smile-plus',
  },
  http_request: {
    label: 'HTTP Request',
    description: 'Make an HTTP request to an external service',
    icon: 'globe',
  },
  wait: {
    label: 'Wait',
    description: 'Wait for a specified duration',
    icon: 'clock',
  },
  condition: {
    label: 'Condition',
    description: 'Branch based on a condition',
    icon: 'git-branch',
  },
  notify_orchestrator: {
    label: 'Notify Orchestrator',
    description: 'Trigger an Orchestrator agent to respond',
    icon: 'bot',
  },
} as const satisfies Record<
  ActionType,
  { label: string; description: string; icon: string }
>;

/**
 * UI configuration for template categories
 */
export const TEMPLATE_CATEGORY_CONFIG = {
  onboarding: {
    label: 'Onboarding',
    description: 'Welcome and onboard new users',
    icon: 'user-plus',
  },
  notifications: {
    label: 'Notifications',
    description: 'Send alerts and notifications',
    icon: 'bell',
  },
  automation: {
    label: 'Automation',
    description: 'Automate repetitive tasks and processes',
    icon: 'zap',
  },
  integration: {
    label: 'Integration',
    description: 'Connect with external services',
    icon: 'plug',
  },
  moderation: {
    label: 'Moderation',
    description: 'Moderate content and users',
    icon: 'shield',
  },
  scheduling: {
    label: 'Scheduling',
    description: 'Time-based and scheduled workflows',
    icon: 'clock',
  },
  custom: {
    label: 'Custom',
    description: 'Custom workflow templates',
    icon: 'settings',
  },
} as const satisfies Record<
  WorkflowTemplateCategory,
  { label: string; description: string; icon: string }
>;

/**
 * Default action configurations for each action type
 * Used for initializing new actions in the workflow builder
 */
export const DEFAULT_ACTION_CONFIGS = {
  send_message: {
    channelId: '',
    message: 'Hello! This is an automated message.',
  },
  send_dm: {
    userId: '',
    message: 'Hello! This is a direct message.',
  },
  create_channel: {
    channelName: 'new-channel',
    channelType: 'public',
  },
  invite_to_channel: {
    channelId: '',
    userId: '',
  },
  assign_role: {
    roleId: '',
    userId: '',
  },
  add_reaction: {
    emoji: '👍',
  },
  http_request: {
    url: 'https://api.example.com/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{"data": "{{trigger.message.content}}"}',
  },
  wait: {
    duration: 5,
    unit: 'minutes',
  },
  condition: {
    condition: {
      field: 'trigger.message.content',
      operator: 'contains',
      value: '',
    },
  },
  notify_orchestrator: {
    orchestratorId: '',
    message: 'Action required for: {{trigger.message.content}}',
  },
} as const;

/**
 * UI configuration for execution status display
 */
export const EXECUTION_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  running: {
    label: 'Running',
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
  },
} as const satisfies Record<
  ExecutionStatus,
  { label: string; color: string; bgColor: string }
>;

/**
 * Input type for creating a new workflow
 */
export interface CreateWorkflowInput {
  readonly name: string;
  readonly description?: string;
  readonly trigger: TriggerConfig;
  readonly actions: readonly Omit<ActionConfig, 'id'>[];
  readonly variables?: readonly Omit<WorkflowVariable, 'source'>[];
}

/**
 * Input type for updating an existing workflow
 */
export interface UpdateWorkflowInput {
  readonly name?: string;
  readonly description?: string;
  readonly status?: WorkflowStatus;
  readonly trigger?: TriggerConfig;
  readonly actions?: readonly Omit<ActionConfig, 'id'>[];
  readonly variables?: readonly Omit<WorkflowVariable, 'source'>[];
}

/**
 * Filter options for querying workflows
 */
export interface WorkflowFilters {
  readonly status?: WorkflowStatus;
  readonly triggerType?: TriggerType;
  readonly search?: string;
}

/**
 * Filter options for querying workflow executions
 */
export interface ExecutionFilters {
  readonly status?: ExecutionStatus;
  readonly startDate?: string;
  readonly endDate?: string;
}

/**
 * Type guard to check if a value is a valid WorkflowId
 */
export function isWorkflowId(value: unknown): value is WorkflowId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a valid ActionId
 */
export function isActionId(value: unknown): value is ActionId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a valid ExecutionId
 */
export function isExecutionId(value: unknown): value is ExecutionId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a trigger config is a schedule trigger
 */
export function isScheduleTrigger(
  trigger: TriggerConfig,
): trigger is ScheduleTrigger {
  return trigger.type === 'schedule';
}

/**
 * Type guard to check if an action is a send message action
 */
export function isSendMessageAction(
  action: ActionConfig,
): action is SendMessageAction {
  return action.type === 'send_message';
}

/**
 * Type guard to check if an action is a condition action
 */
export function isConditionAction(
  action: ActionConfig,
): action is ConditionAction {
  return action.type === 'condition';
}
