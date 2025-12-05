/**
 * Comprehensive Workflow Step Types Library
 *
 * Defines all available step types for the workflow builder with their:
 * - Icons (lucide-react)
 * - Name and description
 * - Input/output ports definition
 * - Configuration schema (zod)
 */

import {
  Zap,
  Clock,
  Calendar,
  MessageSquare,
  Webhook,
  Mail,
  Send,
  Globe,
  GitBranch,
  Repeat,
  Database,
  Code,
  Filter,
  Shuffle,
  Settings,
  AlertCircle,
  UserPlus,
  Users,
  Hash,
  Tag,
  AtSign,
  SmilePlus,
  ShieldCheck,
  Plus,
  Slack,
  Github,
  Twitter,
} from 'lucide-react';
import { z } from 'zod';

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Port Definitions
// ============================================================================

export type PortType = 'trigger' | 'action' | 'flow' | 'data';
export type PortDirection = 'input' | 'output';

export interface Port {
  id: string;
  label: string;
  type: PortType;
  direction: PortDirection;
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  required?: boolean;
  multiple?: boolean; // Can connect to multiple nodes
}

// ============================================================================
// Step Category Definitions
// ============================================================================

export type StepCategory =
  | 'triggers'
  | 'actions'
  | 'conditions'
  | 'loops'
  | 'integrations'
  | 'data'
  | 'utilities';

export interface StepCategoryInfo {
  id: StepCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const STEP_CATEGORIES: Record<StepCategory, StepCategoryInfo> = {
  triggers: {
    id: 'triggers',
    label: 'Triggers',
    description: 'Events that start a workflow',
    icon: Zap,
    color: 'text-yellow-500',
  },
  actions: {
    id: 'actions',
    label: 'Actions',
    description: 'Operations to perform',
    icon: Send,
    color: 'text-blue-500',
  },
  conditions: {
    id: 'conditions',
    label: 'Conditions',
    description: 'Logic and branching',
    icon: GitBranch,
    color: 'text-purple-500',
  },
  loops: {
    id: 'loops',
    label: 'Loops',
    description: 'Iteration and repetition',
    icon: Repeat,
    color: 'text-orange-500',
  },
  integrations: {
    id: 'integrations',
    label: 'Integrations',
    description: 'External service connections',
    icon: Globe,
    color: 'text-green-500',
  },
  data: {
    id: 'data',
    label: 'Data',
    description: 'Data transformation and storage',
    icon: Database,
    color: 'text-indigo-500',
  },
  utilities: {
    id: 'utilities',
    label: 'Utilities',
    description: 'Helper functions',
    icon: Settings,
    color: 'text-gray-500',
  },
};

// ============================================================================
// Base Step Type Definition
// ============================================================================

export interface StepType<TConfig = any> {
  id: string;
  name: string;
  description: string;
  category: StepCategory;
  icon: LucideIcon;
  color: string;
  inputs: Port[];
  outputs: Port[];
  configSchema: z.ZodSchema;
  defaultConfig: TConfig;
  tags?: string[];
  deprecated?: boolean;
}

// ============================================================================
// TRIGGER STEPS
// ============================================================================

// Webhook Trigger
const webhookTriggerSchema = z.object({
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('POST'),
  headers: z.record(z.string()).optional(),
  authentication: z
    .object({
      type: z.enum(['none', 'basic', 'bearer', 'api-key']),
      credentials: z.record(z.string()).optional(),
    })
    .optional(),
});

export const WEBHOOK_TRIGGER: StepType<z.infer<typeof webhookTriggerSchema>> = {
  id: 'trigger.webhook',
  name: 'Webhook',
  description: 'Triggered when a webhook receives a request',
  category: 'triggers',
  icon: Webhook,
  color: 'text-yellow-500',
  inputs: [],
  outputs: [
    {
      id: 'body',
      label: 'Body',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'headers',
      label: 'Headers',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'query',
      label: 'Query',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'flow',
      label: 'On Success',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: webhookTriggerSchema,
  defaultConfig: {
    method: 'POST',
    authentication: { type: 'none' },
  },
  tags: ['webhook', 'http', 'api'],
};

// Schedule Trigger
const scheduleTriggerSchema = z.object({
  type: z.enum(['cron', 'interval']),
  cron: z.string().optional(),
  interval: z
    .object({
      value: z.number().min(1),
      unit: z.enum(['minutes', 'hours', 'days', 'weeks']),
    })
    .optional(),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
});

export const SCHEDULE_TRIGGER: StepType<z.infer<typeof scheduleTriggerSchema>> =
  {
    id: 'trigger.schedule',
    name: 'Schedule',
    description: 'Triggered on a recurring schedule',
    category: 'triggers',
    icon: Calendar,
    color: 'text-yellow-500',
    inputs: [],
    outputs: [
      {
        id: 'timestamp',
        label: 'Timestamp',
        type: 'data',
        direction: 'output',
        dataType: 'string',
      },
      {
        id: 'flow',
        label: 'Execute',
        type: 'flow',
        direction: 'output',
      },
    ],
    configSchema: scheduleTriggerSchema,
    defaultConfig: {
      type: 'interval',
      interval: { value: 1, unit: 'hours' },
      timezone: 'UTC',
      enabled: true,
    },
    tags: ['schedule', 'cron', 'time'],
  };

// Message Received Trigger
const messageReceivedTriggerSchema = z.object({
  channels: z.array(z.string()).optional(),
  users: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  matchType: z.enum(['exact', 'contains', 'regex']).default('contains'),
});

export const MESSAGE_RECEIVED_TRIGGER: StepType<
  z.infer<typeof messageReceivedTriggerSchema>
> = {
  id: 'trigger.message_received',
  name: 'Message Received',
  description: 'Triggered when a message is received',
  category: 'triggers',
  icon: MessageSquare,
  color: 'text-yellow-500',
  inputs: [],
  outputs: [
    {
      id: 'message',
      label: 'Message',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'author',
      label: 'Author',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'channel',
      label: 'Channel',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'flow',
      label: 'On Message',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: messageReceivedTriggerSchema,
  defaultConfig: {
    matchType: 'contains',
  },
  tags: ['message', 'chat', 'communication'],
};

// User Join Trigger
const userJoinTriggerSchema = z.object({
  workspaceIds: z.array(z.string()).optional(),
  sendWelcomeMessage: z.boolean().default(true),
});

export const USER_JOIN_TRIGGER: StepType<
  z.infer<typeof userJoinTriggerSchema>
> = {
  id: 'trigger.user_join',
  name: 'User Join',
  description: 'Triggered when a user joins the workspace',
  category: 'triggers',
  icon: UserPlus,
  color: 'text-yellow-500',
  inputs: [],
  outputs: [
    {
      id: 'user',
      label: 'User',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'workspace',
      label: 'Workspace',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'flow',
      label: 'On Join',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: userJoinTriggerSchema,
  defaultConfig: {
    sendWelcomeMessage: true,
  },
  tags: ['user', 'onboarding', 'join'],
};

// ============================================================================
// ACTION STEPS
// ============================================================================

// Send Message Action
const sendMessageActionSchema = z.object({
  channelId: z.string().min(1, 'Channel is required'),
  message: z.string().min(1, 'Message is required'),
  mentions: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
  threadId: z.string().optional(),
});

export const SEND_MESSAGE_ACTION: StepType<
  z.infer<typeof sendMessageActionSchema>
> = {
  id: 'action.send_message',
  name: 'Send Message',
  description: 'Send a message to a channel',
  category: 'actions',
  icon: Send,
  color: 'text-blue-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'message',
      label: 'Message',
      type: 'data',
      direction: 'input',
      dataType: 'string',
    },
    {
      id: 'channelId',
      label: 'Channel ID',
      type: 'data',
      direction: 'input',
      dataType: 'string',
    },
  ],
  outputs: [
    {
      id: 'messageId',
      label: 'Message ID',
      type: 'data',
      direction: 'output',
      dataType: 'string',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: sendMessageActionSchema,
  defaultConfig: {
    channelId: '',
    message: 'Hello! This is an automated message.',
  },
  tags: ['message', 'send', 'chat'],
};

// Send Email Action
const sendEmailActionSchema = z.object({
  to: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  html: z.boolean().default(false),
  attachments: z.array(z.string()).optional(),
});

export const SEND_EMAIL_ACTION: StepType<
  z.infer<typeof sendEmailActionSchema>
> = {
  id: 'action.send_email',
  name: 'Send Email',
  description: 'Send an email',
  category: 'actions',
  icon: Mail,
  color: 'text-blue-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'to',
      label: 'To',
      type: 'data',
      direction: 'input',
      dataType: 'array',
      required: true,
    },
    {
      id: 'subject',
      label: 'Subject',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
    {
      id: 'body',
      label: 'Body',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'messageId',
      label: 'Message ID',
      type: 'data',
      direction: 'output',
      dataType: 'string',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: sendEmailActionSchema,
  defaultConfig: {
    to: [],
    subject: '',
    body: '',
    html: false,
  },
  tags: ['email', 'notification', 'send'],
};

// HTTP Request Action
const httpRequestActionSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  timeout: z.number().min(0).max(300000).default(30000),
  retries: z.number().min(0).max(5).default(0),
  authentication: z
    .object({
      type: z.enum(['none', 'basic', 'bearer', 'api-key']),
      credentials: z.record(z.string()).optional(),
    })
    .optional(),
});

export const HTTP_REQUEST_ACTION: StepType<
  z.infer<typeof httpRequestActionSchema>
> = {
  id: 'action.http_request',
  name: 'HTTP Request',
  description: 'Make an HTTP request to an external API',
  category: 'actions',
  icon: Globe,
  color: 'text-blue-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'url',
      label: 'URL',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
    {
      id: 'body',
      label: 'Body',
      type: 'data',
      direction: 'input',
      dataType: 'object',
    },
  ],
  outputs: [
    {
      id: 'response',
      label: 'Response',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'status',
      label: 'Status Code',
      type: 'data',
      direction: 'output',
      dataType: 'number',
    },
    {
      id: 'headers',
      label: 'Headers',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: httpRequestActionSchema,
  defaultConfig: {
    url: '',
    method: 'GET',
    timeout: 30000,
    retries: 0,
    authentication: { type: 'none' },
  },
  tags: ['http', 'api', 'request', 'external'],
};

// Assign Task Action
const assignTaskActionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assigneeId: z.string().min(1, 'Assignee is required'),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  tags: z.array(z.string()).optional(),
});

export const ASSIGN_TASK_ACTION: StepType<
  z.infer<typeof assignTaskActionSchema>
> = {
  id: 'action.assign_task',
  name: 'Assign Task',
  description: 'Create and assign a task to a user',
  category: 'actions',
  icon: Plus,
  color: 'text-blue-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'title',
      label: 'Title',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
    {
      id: 'assigneeId',
      label: 'Assignee',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'taskId',
      label: 'Task ID',
      type: 'data',
      direction: 'output',
      dataType: 'string',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: assignTaskActionSchema,
  defaultConfig: {
    title: '',
    assigneeId: '',
    priority: 'medium',
  },
  tags: ['task', 'assign', 'project'],
};

// Update Status Action
const updateStatusActionSchema = z.object({
  entityType: z.enum(['task', 'project', 'user', 'channel']),
  entityId: z.string().min(1, 'Entity ID is required'),
  status: z.string().min(1, 'Status is required'),
  reason: z.string().optional(),
});

export const UPDATE_STATUS_ACTION: StepType<
  z.infer<typeof updateStatusActionSchema>
> = {
  id: 'action.update_status',
  name: 'Update Status',
  description: 'Update the status of an entity',
  category: 'actions',
  icon: ShieldCheck,
  color: 'text-blue-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'entityId',
      label: 'Entity ID',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
    {
      id: 'status',
      label: 'Status',
      type: 'data',
      direction: 'input',
      dataType: 'string',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'updated',
      label: 'Updated',
      type: 'data',
      direction: 'output',
      dataType: 'boolean',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: updateStatusActionSchema,
  defaultConfig: {
    entityType: 'task',
    entityId: '',
    status: '',
  },
  tags: ['update', 'status', 'state'],
};

// ============================================================================
// CONDITION STEPS
// ============================================================================

// If/Else Condition
const ifElseConditionSchema = z.object({
  conditions: z.array(
    z.object({
      field: z.string().min(1, 'Field is required'),
      operator: z.enum([
        'equals',
        'not_equals',
        'contains',
        'not_contains',
        'greater_than',
        'less_than',
        'exists',
        'not_exists',
      ]),
      value: z.any(),
    })
  ),
  logic: z.enum(['and', 'or']).default('and'),
});

export const IF_ELSE_CONDITION: StepType<
  z.infer<typeof ifElseConditionSchema>
> = {
  id: 'condition.if_else',
  name: 'If/Else',
  description: 'Branch based on a condition',
  category: 'conditions',
  icon: GitBranch,
  color: 'text-purple-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'data',
      label: 'Data',
      type: 'data',
      direction: 'input',
      dataType: 'any',
    },
  ],
  outputs: [
    {
      id: 'then',
      label: 'Then',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'else',
      label: 'Else',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: ifElseConditionSchema,
  defaultConfig: {
    conditions: [
      {
        field: '',
        operator: 'equals',
        value: '',
      },
    ],
    logic: 'and',
  },
  tags: ['condition', 'if', 'branch'],
};

// Switch/Case Condition
const switchCaseConditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  cases: z.array(
    z.object({
      value: z.any(),
      label: z.string().optional(),
    })
  ),
  defaultCase: z.boolean().default(true),
});

export const SWITCH_CASE_CONDITION: StepType<
  z.infer<typeof switchCaseConditionSchema>
> = {
  id: 'condition.switch',
  name: 'Switch',
  description: 'Branch based on multiple cases',
  category: 'conditions',
  icon: Shuffle,
  color: 'text-purple-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'value',
      label: 'Value',
      type: 'data',
      direction: 'input',
      dataType: 'any',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'case_0',
      label: 'Case 1',
      type: 'flow',
      direction: 'output',
      multiple: false,
    },
    {
      id: 'default',
      label: 'Default',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: switchCaseConditionSchema,
  defaultConfig: {
    field: '',
    cases: [{ value: '', label: 'Case 1' }],
    defaultCase: true,
  },
  tags: ['condition', 'switch', 'case', 'branch'],
};

// ============================================================================
// LOOP STEPS
// ============================================================================

// For Each Loop
const forEachLoopSchema = z.object({
  array: z.string().min(1, 'Array is required'),
  itemVariable: z.string().default('item'),
  indexVariable: z.string().default('index'),
  maxIterations: z.number().min(1).max(10000).optional(),
});

export const FOR_EACH_LOOP: StepType<z.infer<typeof forEachLoopSchema>> = {
  id: 'loop.for_each',
  name: 'For Each',
  description: 'Iterate over each item in an array',
  category: 'loops',
  icon: Repeat,
  color: 'text-orange-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'array',
      label: 'Array',
      type: 'data',
      direction: 'input',
      dataType: 'array',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'item',
      label: 'Item',
      type: 'data',
      direction: 'output',
      dataType: 'any',
    },
    {
      id: 'index',
      label: 'Index',
      type: 'data',
      direction: 'output',
      dataType: 'number',
    },
    {
      id: 'loop',
      label: 'Loop Body',
      type: 'flow',
      direction: 'output',
      multiple: false,
    },
    {
      id: 'complete',
      label: 'Complete',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: forEachLoopSchema,
  defaultConfig: {
    array: '',
    itemVariable: 'item',
    indexVariable: 'index',
  },
  tags: ['loop', 'iterate', 'for-each', 'array'],
};

// While Loop
const whileLoopSchema = z.object({
  condition: z.object({
    field: z.string().min(1, 'Field is required'),
    operator: z.enum([
      'equals',
      'not_equals',
      'greater_than',
      'less_than',
      'exists',
    ]),
    value: z.any(),
  }),
  maxIterations: z.number().min(1).max(10000).default(100),
});

export const WHILE_LOOP: StepType<z.infer<typeof whileLoopSchema>> = {
  id: 'loop.while',
  name: 'While',
  description: 'Loop while a condition is true',
  category: 'loops',
  icon: Repeat,
  color: 'text-orange-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'data',
      label: 'Data',
      type: 'data',
      direction: 'input',
      dataType: 'any',
    },
  ],
  outputs: [
    {
      id: 'loop',
      label: 'Loop Body',
      type: 'flow',
      direction: 'output',
      multiple: false,
    },
    {
      id: 'complete',
      label: 'Complete',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: whileLoopSchema,
  defaultConfig: {
    condition: {
      field: '',
      operator: 'equals',
      value: '',
    },
    maxIterations: 100,
  },
  tags: ['loop', 'while', 'condition'],
};

// ============================================================================
// INTEGRATION STEPS
// ============================================================================

// Slack Integration
const slackIntegrationSchema = z.object({
  action: z.enum(['send_message', 'create_channel', 'invite_user']),
  channelId: z.string().optional(),
  message: z.string().optional(),
  userId: z.string().optional(),
});

export const SLACK_INTEGRATION: StepType<
  z.infer<typeof slackIntegrationSchema>
> = {
  id: 'integration.slack',
  name: 'Slack',
  description: 'Interact with Slack',
  category: 'integrations',
  icon: Slack,
  color: 'text-green-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'data',
      label: 'Data',
      type: 'data',
      direction: 'input',
      dataType: 'object',
    },
  ],
  outputs: [
    {
      id: 'response',
      label: 'Response',
      type: 'data',
      direction: 'output',
      dataType: 'object',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: slackIntegrationSchema,
  defaultConfig: {
    action: 'send_message',
  },
  tags: ['slack', 'integration', 'messaging'],
};

// ============================================================================
// DATA STEPS
// ============================================================================

// Transform Data
const transformDataSchema = z.object({
  transformations: z.array(
    z.object({
      field: z.string().min(1, 'Field is required'),
      operation: z.enum([
        'map',
        'filter',
        'reduce',
        'merge',
        'extract',
        'format',
      ]),
      config: z.record(z.any()),
    })
  ),
});

export const TRANSFORM_DATA: StepType<z.infer<typeof transformDataSchema>> = {
  id: 'data.transform',
  name: 'Transform Data',
  description: 'Transform and manipulate data',
  category: 'data',
  icon: Code,
  color: 'text-indigo-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'data',
      label: 'Input Data',
      type: 'data',
      direction: 'input',
      dataType: 'any',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'output',
      label: 'Output Data',
      type: 'data',
      direction: 'output',
      dataType: 'any',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'error',
      label: 'On Error',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: transformDataSchema,
  defaultConfig: {
    transformations: [],
  },
  tags: ['data', 'transform', 'map', 'filter'],
};

// Filter Data
const filterDataSchema = z.object({
  filters: z.array(
    z.object({
      field: z.string().min(1, 'Field is required'),
      operator: z.enum([
        'equals',
        'not_equals',
        'contains',
        'greater_than',
        'less_than',
      ]),
      value: z.any(),
    })
  ),
  logic: z.enum(['and', 'or']).default('and'),
});

export const FILTER_DATA: StepType<z.infer<typeof filterDataSchema>> = {
  id: 'data.filter',
  name: 'Filter Data',
  description: 'Filter data based on conditions',
  category: 'data',
  icon: Filter,
  color: 'text-indigo-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'data',
      label: 'Input Data',
      type: 'data',
      direction: 'input',
      dataType: 'array',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'output',
      label: 'Filtered Data',
      type: 'data',
      direction: 'output',
      dataType: 'array',
    },
    {
      id: 'count',
      label: 'Count',
      type: 'data',
      direction: 'output',
      dataType: 'number',
    },
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: filterDataSchema,
  defaultConfig: {
    filters: [],
    logic: 'and',
  },
  tags: ['data', 'filter', 'query'],
};

// ============================================================================
// UTILITY STEPS
// ============================================================================

// Wait/Delay
const waitDelaySchema = z.object({
  duration: z.number().min(1, 'Duration must be at least 1'),
  unit: z.enum(['seconds', 'minutes', 'hours', 'days']).default('seconds'),
});

export const WAIT_DELAY: StepType<z.infer<typeof waitDelaySchema>> = {
  id: 'utility.wait',
  name: 'Wait',
  description: 'Wait for a specified duration',
  category: 'utilities',
  icon: Clock,
  color: 'text-gray-500',
  inputs: [
    {
      id: 'flow',
      label: 'Execute',
      type: 'flow',
      direction: 'input',
    },
  ],
  outputs: [
    {
      id: 'flow',
      label: 'Next',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: waitDelaySchema,
  defaultConfig: {
    duration: 1,
    unit: 'seconds',
  },
  tags: ['wait', 'delay', 'pause'],
};

// Error Handler
const errorHandlerSchema = z.object({
  action: z.enum(['retry', 'continue', 'stop', 'notify']),
  retryCount: z.number().min(1).max(10).optional(),
  retryDelay: z.number().min(0).optional(),
  notifyUsers: z.array(z.string()).optional(),
});

export const ERROR_HANDLER: StepType<z.infer<typeof errorHandlerSchema>> = {
  id: 'utility.error_handler',
  name: 'Error Handler',
  description: 'Handle errors in the workflow',
  category: 'utilities',
  icon: AlertCircle,
  color: 'text-gray-500',
  inputs: [
    {
      id: 'error',
      label: 'Error',
      type: 'flow',
      direction: 'input',
    },
    {
      id: 'errorData',
      label: 'Error Data',
      type: 'data',
      direction: 'input',
      dataType: 'object',
    },
  ],
  outputs: [
    {
      id: 'retry',
      label: 'Retry',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'continue',
      label: 'Continue',
      type: 'flow',
      direction: 'output',
    },
    {
      id: 'stop',
      label: 'Stop',
      type: 'flow',
      direction: 'output',
    },
  ],
  configSchema: errorHandlerSchema,
  defaultConfig: {
    action: 'stop',
  },
  tags: ['error', 'handler', 'retry'],
};

// ============================================================================
// Registry of all step types
// ============================================================================

export const ALL_STEP_TYPES: StepType<unknown>[] = [
  // Triggers
  WEBHOOK_TRIGGER,
  SCHEDULE_TRIGGER,
  MESSAGE_RECEIVED_TRIGGER,
  USER_JOIN_TRIGGER,

  // Actions
  SEND_MESSAGE_ACTION,
  SEND_EMAIL_ACTION,
  HTTP_REQUEST_ACTION,
  ASSIGN_TASK_ACTION,
  UPDATE_STATUS_ACTION,

  // Conditions
  IF_ELSE_CONDITION,
  SWITCH_CASE_CONDITION,

  // Loops
  FOR_EACH_LOOP,
  WHILE_LOOP,

  // Integrations
  SLACK_INTEGRATION,

  // Data
  TRANSFORM_DATA,
  FILTER_DATA,

  // Utilities
  WAIT_DELAY,
  ERROR_HANDLER,
];

// Helper function to get steps by category
export function getStepsByCategory(
  category: StepCategory
): StepType<unknown>[] {
  return ALL_STEP_TYPES.filter(step => step.category === category);
}

// Helper function to get a step by ID
export function getStepById(id: string): StepType<unknown> | undefined {
  return ALL_STEP_TYPES.find(step => step.id === id);
}

// Helper function to search steps
export function searchSteps(query: string): StepType<unknown>[] {
  const lowerQuery = query.toLowerCase();
  return ALL_STEP_TYPES.filter(
    step =>
      step.name.toLowerCase().includes(lowerQuery) ||
      step.description.toLowerCase().includes(lowerQuery) ||
      step.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
