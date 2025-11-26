// Workflow types for Genesis-App

export type WorkflowStatus = 'active' | 'inactive' | 'draft' | 'error';

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
  | 'notify_vp';

export interface TriggerConfig {
  type: TriggerType;
  schedule?: {
    cron: string;
    timezone?: string;
  };
  message?: {
    channelIds?: string[];
    userIds?: string[];
    pattern?: string;
  };
  keyword?: {
    keywords: string[];
    matchType: 'exact' | 'contains' | 'regex';
  };
  channel?: {
    channelIds?: string[];
  };
  reaction?: {
    emoji?: string;
    channelIds?: string[];
  };
  mention?: {
    userIds?: string[];
    vpIds?: string[];
  };
  webhook?: {
    secret?: string;
  };
}

export interface ActionConfig {
  id: string;
  type: ActionType;
  order: number;
  config: {
    // send_message / send_dm
    message?: string;
    channelId?: string;
    userId?: string;
    // create_channel
    channelName?: string;
    channelType?: 'public' | 'private';
    // assign_role
    roleId?: string;
    // add_reaction
    emoji?: string;
    // http_request
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    // wait
    duration?: number;
    unit?: 'seconds' | 'minutes' | 'hours' | 'days';
    // condition
    condition?: {
      field: string;
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
      value: string;
    };
    thenActions?: string[];
    elseActions?: string[];
    // notify_vp
    vpId?: string;
  };
  errorHandling?: {
    onError: 'stop' | 'continue' | 'retry';
    retryCount?: number;
    retryDelay?: number;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  workspaceId: string;
  trigger: TriggerConfig;
  actions: ActionConfig[];
  variables?: WorkflowVariable[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastRunAt?: string;
  runCount: number;
  errorCount: number;
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  defaultValue?: unknown;
  source: 'trigger' | 'action' | 'custom';
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  triggeredBy: string;
  triggerData?: Record<string, unknown>;
  actionResults: ActionResult[];
  error?: string;
}

export interface ActionResult {
  actionId: string;
  actionType: ActionType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  output?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: WorkflowTemplateCategory;
  trigger: TriggerConfig;
  actions: Omit<ActionConfig, 'id'>[];
  variables?: Omit<WorkflowVariable, 'source'>[];
  usageCount: number;
  tags: string[];
}

export type WorkflowTemplateCategory =
  | 'onboarding'
  | 'notifications'
  | 'automation'
  | 'integration'
  | 'moderation'
  | 'scheduling'
  | 'custom';

// Status configuration for UI
export const WORKFLOW_STATUS_CONFIG: Record<
  WorkflowStatus,
  { label: string; color: string; bgColor: string }
> = {
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
  error: {
    label: 'Error',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

// Trigger type configuration for UI
export const TRIGGER_TYPE_CONFIG: Record<
  TriggerType,
  { label: string; description: string; icon: string }
> = {
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
};

// Action type configuration for UI
export const ACTION_TYPE_CONFIG: Record<
  ActionType,
  { label: string; description: string; icon: string }
> = {
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
  notify_vp: {
    label: 'Notify VP',
    description: 'Trigger a VP agent to respond',
    icon: 'bot',
  },
};

// Template categories for UI
export const TEMPLATE_CATEGORY_CONFIG: Record<
  WorkflowTemplateCategory,
  { label: string; description: string; icon: string }
> = {
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
};

// Execution status type
export type ExecutionStatus = WorkflowExecution['status'];

// Execution status configuration for UI
export const EXECUTION_STATUS_CONFIG: Record<
  ExecutionStatus,
  { label: string; color: string; bgColor: string }
> = {
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
};

// Input types for API operations
export interface CreateWorkflowInput {
  name: string;
  description?: string;
  trigger: TriggerConfig;
  actions: Omit<ActionConfig, 'id'>[];
  variables?: Omit<WorkflowVariable, 'source'>[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  trigger?: TriggerConfig;
  actions?: Omit<ActionConfig, 'id'>[];
  variables?: Omit<WorkflowVariable, 'source'>[];
}

export interface WorkflowFilters {
  status?: WorkflowStatus;
  triggerType?: TriggerType;
  search?: string;
}

export interface ExecutionFilters {
  status?: ExecutionStatus;
  startDate?: string;
  endDate?: string;
}
