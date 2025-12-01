/**
 * Workflow Automation GraphQL Resolvers
 *
 * Comprehensive resolvers for workflow automation operations including queries, mutations,
 * subscriptions, and field resolvers. Implements workflow management, execution tracking,
 * template management, and real-time status updates.
 *
 * @module @genesis/api-types/resolvers/workflow-resolvers
 */

import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Workflow status enum
 */
export const WorkflowStatus = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Draft: 'DRAFT',
  Error: 'ERROR',
} as const;

export type WorkflowStatusValue =
  (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

/**
 * Trigger type enum
 */
export const TriggerType = {
  MessageReceived: 'MESSAGE_RECEIVED',
  MessageKeyword: 'MESSAGE_KEYWORD',
  ChannelJoined: 'CHANNEL_JOINED',
  ChannelLeft: 'CHANNEL_LEFT',
  MemberAdded: 'MEMBER_ADDED',
  MemberRemoved: 'MEMBER_REMOVED',
  FileUploaded: 'FILE_UPLOADED',
  ReactionAdded: 'REACTION_ADDED',
  Scheduled: 'SCHEDULED',
  WebhookReceived: 'WEBHOOK_RECEIVED',
  VPResponse: 'VP_RESPONSE',
  Manual: 'MANUAL',
} as const;

export type TriggerTypeValue = (typeof TriggerType)[keyof typeof TriggerType];

/**
 * Action type enum
 */
export const ActionType = {
  SendMessage: 'SEND_MESSAGE',
  SendDM: 'SEND_DM',
  CreateChannel: 'CREATE_CHANNEL',
  AddToChannel: 'ADD_TO_CHANNEL',
  RemoveFromChannel: 'REMOVE_FROM_CHANNEL',
  AssignRole: 'ASSIGN_ROLE',
  SendEmail: 'SEND_EMAIL',
  CallWebhook: 'CALL_WEBHOOK',
  InvokeVP: 'INVOKE_VP',
  Delay: 'DELAY',
  Condition: 'CONDITION',
  SetVariable: 'SET_VARIABLE',
  Loop: 'LOOP',
} as const;

export type ActionTypeValue = (typeof ActionType)[keyof typeof ActionType];

/**
 * Execution status enum
 */
export const ExecutionStatus = {
  Pending: 'PENDING',
  Running: 'RUNNING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  Cancelled: 'CANCELLED',
} as const;

export type ExecutionStatusValue =
  (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

/**
 * Action result status enum
 */
export const ActionResultStatus = {
  Pending: 'PENDING',
  Success: 'SUCCESS',
  Failed: 'FAILED',
  Skipped: 'SKIPPED',
} as const;

export type ActionResultStatusValue =
  (typeof ActionResultStatus)[keyof typeof ActionResultStatus];

/**
 * Error behavior enum
 */
export const ErrorBehavior = {
  Stop: 'STOP',
  Continue: 'CONTINUE',
  Retry: 'RETRY',
} as const;

export type ErrorBehaviorValue =
  (typeof ErrorBehavior)[keyof typeof ErrorBehavior];

/**
 * Template category enum
 */
export const TemplateCategory = {
  Onboarding: 'ONBOARDING',
  Notifications: 'NOTIFICATIONS',
  Moderation: 'MODERATION',
  Productivity: 'PRODUCTIVITY',
  Integration: 'INTEGRATION',
  Custom: 'CUSTOM',
} as const;

export type TemplateCategoryValue =
  (typeof TemplateCategory)[keyof typeof TemplateCategory];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * DataLoader interface for N+1 prevention
 */
interface DataLoader<K, V> {
  load(key: K): Promise<V>;
  loadMany(keys: K[]): Promise<(V | Error)[]>;
  clear(key: K): DataLoader<K, V>;
  clearAll(): DataLoader<K, V>;
}

/**
 * Generic Prisma model interface for workflow-related operations
 */
interface PrismaModel {
  findUnique: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
  count: (args: unknown) => Promise<number>;
  upsert: (args: unknown) => Promise<unknown>;
}

/**
 * Prisma client interface with workflow models
 */
interface PrismaClientWithWorkflows {
  workflow: PrismaModel;
  workflowExecution: PrismaModel;
  workflowTemplate: PrismaModel;
  workflowActionResult: PrismaModel;
  workspace: PrismaModel;
  user: PrismaModel;
}

/**
 * Workflow Service interface for business logic operations
 */
export interface WorkflowService {
  /** Execute a workflow */
  executeWorkflow(
    workflowId: string,
    triggerData?: unknown
  ): Promise<WorkflowExecution>;
  /** Test a workflow with sample data */
  testWorkflow(
    workflowId: string,
    sampleData: unknown
  ): Promise<WorkflowExecution>;
  /** Cancel a running execution */
  cancelExecution(executionId: string): Promise<boolean>;
  /** Get workflow engine status */
  getEngineStatus(): Promise<{ healthy: boolean; queueLength: number }>;
  /** Validate workflow configuration */
  validateWorkflow(workflow: Workflow): Promise<ValidationResult>;
}

/**
 * Validation result type
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClientWithWorkflows;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Optional workflow service for business logic */
  workflowService?: WorkflowService;
  /** DataLoaders for N+1 prevention */
  dataloaders?: {
    workspace?: DataLoader<string, Workspace>;
    user?: DataLoader<string, User>;
    workflow?: DataLoader<string, Workflow>;
  };
  /** Unique request identifier */
  requestId: string;
}

// =============================================================================
// ENTITY TYPES
// =============================================================================

/**
 * Workspace entity type
 */
interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User entity type
 */
interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Trigger filter type
 */
interface TriggerFilter {
  field: string;
  operator: string;
  value: unknown;
}

/**
 * Workflow trigger type
 */
interface WorkflowTrigger {
  id: string;
  type: TriggerTypeValue;
  config: unknown;
  filters: TriggerFilter[] | null;
}

/**
 * Workflow action type
 */
interface WorkflowAction {
  id: string;
  type: ActionTypeValue;
  name: string | null;
  config: unknown;
  onError: ErrorBehaviorValue | null;
  retryCount: number | null;
}

/**
 * Workflow variable type
 */
interface WorkflowVariable {
  name: string;
  type: string;
  defaultValue: unknown | null;
  description: string | null;
}

/**
 * Workflow entity type
 */
interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: WorkflowStatusValue;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  variables: WorkflowVariable[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  runCount: number;
  errorCount: number;
}

/**
 * Action result type
 */
interface ActionResult {
  actionId: string;
  status: ActionResultStatusValue;
  output: unknown | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

/**
 * Workflow execution entity type
 */
interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatusValue;
  triggerData: unknown;
  variables: unknown;
  actionResults: ActionResult[];
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  durationMs: number | null;
}

/**
 * Workflow template entity type
 */
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategoryValue;
  trigger: unknown;
  actions: unknown;
  variables: unknown | null;
  tags: string[];
  usageCount: number;
  isBuiltIn: boolean;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for workflow trigger
 */
interface WorkflowTriggerInput {
  type: TriggerTypeValue;
  config: Record<string, unknown>;
  filters?: TriggerFilter[] | null;
}

/**
 * Input for workflow action
 */
interface WorkflowActionInput {
  id?: string | null;
  type: ActionTypeValue;
  name?: string | null;
  config: Record<string, unknown>;
  onError?: ErrorBehaviorValue | null;
  retryCount?: number | null;
}

/**
 * Input for workflow variable
 */
interface WorkflowVariableInput {
  name: string;
  type: string;
  defaultValue?: unknown | null;
  description?: string | null;
}

/**
 * Input for creating a workflow
 */
interface CreateWorkflowInput {
  name: string;
  description?: string | null;
  trigger: WorkflowTriggerInput;
  actions: WorkflowActionInput[];
  variables?: WorkflowVariableInput[] | null;
  status?: WorkflowStatusValue | null;
}

/**
 * Input for updating a workflow
 */
interface UpdateWorkflowInput {
  name?: string | null;
  description?: string | null;
  trigger?: WorkflowTriggerInput | null;
  actions?: WorkflowActionInput[] | null;
  variables?: WorkflowVariableInput[] | null;
  status?: WorkflowStatusValue | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface WorkflowQueryArgs {
  id: string;
}

interface WorkflowsQueryArgs {
  workspaceId: string;
  status?: WorkflowStatusValue | null;
  triggerType?: TriggerTypeValue | null;
}

interface WorkflowExecutionQueryArgs {
  id: string;
}

interface WorkflowExecutionsQueryArgs {
  workflowId: string;
  status?: ExecutionStatusValue | null;
  limit?: number | null;
}

interface WorkflowTemplatesQueryArgs {
  category?: TemplateCategoryValue | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateWorkflowArgs {
  workspaceId: string;
  input: CreateWorkflowInput;
}

interface UpdateWorkflowArgs {
  id: string;
  input: UpdateWorkflowInput;
}

interface DeleteWorkflowArgs {
  id: string;
}

interface ActivateWorkflowArgs {
  id: string;
}

interface DeactivateWorkflowArgs {
  id: string;
}

interface ExecuteWorkflowArgs {
  id: string;
  triggerData?: unknown | null;
}

interface TestWorkflowArgs {
  id: string;
  sampleData: unknown;
}

interface CancelExecutionArgs {
  id: string;
}

interface CreateFromTemplateArgs {
  workspaceId: string;
  templateId: string;
  name?: string | null;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface WorkflowExecutionUpdatedArgs {
  workspaceId: string;
}

interface WorkflowStatusChangedArgs {
  workspaceId: string;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for workflow execution updates */
export const WORKFLOW_EXECUTION_UPDATED = 'WORKFLOW_EXECUTION_UPDATED';

/** Event name for workflow status changes */
export const WORKFLOW_STATUS_CHANGED = 'WORKFLOW_STATUS_CHANGED';

// =============================================================================
// TYPE DEFINITIONS (GraphQL SDL)
// =============================================================================

/**
 * GraphQL type definitions for workflows
 */
export const workflowTypeDefs = `#graphql
  type Workflow {
    id: ID!
    workspaceId: ID!
    name: String!
    description: String
    status: WorkflowStatus!
    trigger: WorkflowTrigger!
    actions: [WorkflowAction!]!
    variables: [WorkflowVariable!]!
    createdBy: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    lastRunAt: DateTime
    runCount: Int!
    errorCount: Int!
    workspace: Workspace!
    creator: User!
    recentExecutions: [WorkflowExecution!]!
    successRate: Float!
  }

  type WorkflowTrigger {
    id: ID!
    type: TriggerType!
    config: JSON!
    filters: [TriggerFilter!]
  }

  type TriggerFilter {
    field: String!
    operator: String!
    value: JSON!
  }

  type WorkflowAction {
    id: ID!
    type: ActionType!
    name: String
    config: JSON!
    onError: ErrorBehavior
    retryCount: Int
  }

  type WorkflowVariable {
    name: String!
    type: String!
    defaultValue: JSON
    description: String
  }

  type WorkflowExecution {
    id: ID!
    workflowId: ID!
    status: ExecutionStatus!
    triggerData: JSON!
    variables: JSON!
    actionResults: [ActionResult!]!
    startedAt: DateTime!
    completedAt: DateTime
    error: String
    durationMs: Int
    workflow: Workflow!
  }

  type ActionResult {
    actionId: ID!
    status: ActionResultStatus!
    output: JSON
    error: String
    startedAt: DateTime!
    completedAt: DateTime!
    durationMs: Int!
  }

  type WorkflowTemplate {
    id: ID!
    name: String!
    description: String!
    category: TemplateCategory!
    trigger: JSON!
    actions: JSON!
    variables: JSON
    tags: [String!]!
    usageCount: Int!
    isBuiltIn: Boolean!
  }

  enum WorkflowStatus {
    ACTIVE
    INACTIVE
    DRAFT
    ERROR
  }

  enum TriggerType {
    MESSAGE_RECEIVED
    MESSAGE_KEYWORD
    CHANNEL_JOINED
    CHANNEL_LEFT
    MEMBER_ADDED
    MEMBER_REMOVED
    FILE_UPLOADED
    REACTION_ADDED
    SCHEDULED
    WEBHOOK_RECEIVED
    VP_RESPONSE
    MANUAL
  }

  enum ActionType {
    SEND_MESSAGE
    SEND_DM
    CREATE_CHANNEL
    ADD_TO_CHANNEL
    REMOVE_FROM_CHANNEL
    ASSIGN_ROLE
    SEND_EMAIL
    CALL_WEBHOOK
    INVOKE_VP
    DELAY
    CONDITION
    SET_VARIABLE
    LOOP
  }

  enum ExecutionStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  enum ActionResultStatus {
    PENDING
    SUCCESS
    FAILED
    SKIPPED
  }

  enum ErrorBehavior {
    STOP
    CONTINUE
    RETRY
  }

  enum TemplateCategory {
    ONBOARDING
    NOTIFICATIONS
    MODERATION
    PRODUCTIVITY
    INTEGRATION
    CUSTOM
  }

  input WorkflowTriggerInput {
    type: TriggerType!
    config: JSON!
    filters: [TriggerFilterInput!]
  }

  input TriggerFilterInput {
    field: String!
    operator: String!
    value: JSON!
  }

  input WorkflowActionInput {
    id: ID
    type: ActionType!
    name: String
    config: JSON!
    onError: ErrorBehavior
    retryCount: Int
  }

  input WorkflowVariableInput {
    name: String!
    type: String!
    defaultValue: JSON
    description: String
  }

  input CreateWorkflowInput {
    name: String!
    description: String
    trigger: WorkflowTriggerInput!
    actions: [WorkflowActionInput!]!
    variables: [WorkflowVariableInput!]
    status: WorkflowStatus
  }

  input UpdateWorkflowInput {
    name: String
    description: String
    trigger: WorkflowTriggerInput
    actions: [WorkflowActionInput!]
    variables: [WorkflowVariableInput!]
    status: WorkflowStatus
  }

  extend type Query {
    workflow(id: ID!): Workflow
    workflows(workspaceId: ID!, status: WorkflowStatus, triggerType: TriggerType): [Workflow!]!
    workflowExecution(id: ID!): WorkflowExecution
    workflowExecutions(workflowId: ID!, status: ExecutionStatus, limit: Int): [WorkflowExecution!]!
    workflowTemplates(category: TemplateCategory): [WorkflowTemplate!]!
  }

  extend type Mutation {
    createWorkflow(workspaceId: ID!, input: CreateWorkflowInput!): Workflow!
    updateWorkflow(id: ID!, input: UpdateWorkflowInput!): Workflow!
    deleteWorkflow(id: ID!): Boolean!
    activateWorkflow(id: ID!): Workflow!
    deactivateWorkflow(id: ID!): Workflow!
    executeWorkflow(id: ID!, triggerData: JSON): WorkflowExecution!
    testWorkflow(id: ID!, sampleData: JSON!): WorkflowExecution!
    cancelExecution(id: ID!): Boolean!
    createWorkflowFromTemplate(workspaceId: ID!, templateId: ID!, name: String): Workflow!
  }

  extend type Subscription {
    workflowExecutionUpdated(workspaceId: ID!): WorkflowExecution!
    workflowStatusChanged(workspaceId: ID!): Workflow!
  }
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Generate a unique ID for workflow actions
 */
function generateActionId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a unique ID for workflow triggers
 */
function generateTriggerId(): string {
  return `trg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate trigger type
 */
function isValidTriggerType(type: string): type is TriggerTypeValue {
  return Object.values(TriggerType).includes(type as TriggerTypeValue);
}

/**
 * Validate action type
 */
function isValidActionType(type: string): type is ActionTypeValue {
  return Object.values(ActionType).includes(type as ActionTypeValue);
}

/**
 * Validate workflow name
 */
function isValidWorkflowName(name: string): boolean {
  return name.length >= 1 && name.length <= 100;
}

/**
 * Validate workflow actions
 */
function validateActions(actions: WorkflowActionInput[]): {
  valid: boolean;
  error?: string;
} {
  if (actions.length === 0) {
    return { valid: false, error: 'At least one action is required' };
  }

  if (actions.length > 50) {
    return { valid: false, error: 'Maximum 50 actions allowed' };
  }

  for (const action of actions) {
    if (!isValidActionType(action.type)) {
      return { valid: false, error: `Invalid action type: ${action.type}` };
    }
  }

  return { valid: true };
}

/**
 * Calculate success rate from recent executions
 */
function calculateSuccessRate(executions: WorkflowExecution[]): number {
  if (executions.length === 0) {
    return 100;
  }
  const successful = executions.filter(e => e.status === 'COMPLETED').length;
  return Math.round((successful / executions.length) * 10000) / 100;
}

/**
 * Get built-in workflow templates
 */
function getBuiltInTemplates(): WorkflowTemplate[] {
  return [
    {
      id: 'template_onboarding_welcome',
      name: 'Welcome New Members',
      description:
        'Automatically send a welcome message when a new member joins a channel',
      category: 'ONBOARDING',
      trigger: { type: 'MEMBER_ADDED', config: {} },
      actions: [
        {
          id: 'act_1',
          type: 'SEND_MESSAGE',
          name: 'Send Welcome',
          config: { template: 'welcome' },
        },
      ],
      variables: null,
      tags: ['onboarding', 'welcome', 'new-member'],
      usageCount: 1250,
      isBuiltIn: true,
    },
    {
      id: 'template_notification_mention',
      name: 'Mention Notifications',
      description: 'Send push notification when user is mentioned',
      category: 'NOTIFICATIONS',
      trigger: { type: 'MESSAGE_RECEIVED', config: { hasMention: true } },
      actions: [
        {
          id: 'act_1',
          type: 'SEND_MESSAGE',
          name: 'Notify',
          config: { notificationType: 'push' },
        },
      ],
      variables: null,
      tags: ['notification', 'mention', 'alert'],
      usageCount: 3420,
      isBuiltIn: true,
    },
    {
      id: 'template_moderation_keyword',
      name: 'Keyword Alert',
      description: 'Alert moderators when specific keywords are detected',
      category: 'MODERATION',
      trigger: { type: 'MESSAGE_KEYWORD', config: { keywords: [] } },
      actions: [
        {
          id: 'act_1',
          type: 'SEND_DM',
          name: 'Alert Mods',
          config: { role: 'moderator' },
        },
      ],
      variables: [
        {
          name: 'keywords',
          type: 'string[]',
          defaultValue: [],
          description: 'Keywords to monitor',
        },
      ],
      tags: ['moderation', 'keyword', 'alert'],
      usageCount: 890,
      isBuiltIn: true,
    },
    {
      id: 'template_productivity_daily',
      name: 'Daily Standup Reminder',
      description: 'Send daily standup reminder at scheduled time',
      category: 'PRODUCTIVITY',
      trigger: { type: 'SCHEDULED', config: { cron: '0 9 * * 1-5' } },
      actions: [
        {
          id: 'act_1',
          type: 'SEND_MESSAGE',
          name: 'Standup Reminder',
          config: { template: 'standup' },
        },
      ],
      variables: [
        {
          name: 'channel',
          type: 'string',
          defaultValue: null,
          description: 'Target channel',
        },
      ],
      tags: ['productivity', 'standup', 'daily', 'reminder'],
      usageCount: 2150,
      isBuiltIn: true,
    },
    {
      id: 'template_integration_webhook',
      name: 'External Webhook Handler',
      description: 'Process incoming webhooks from external services',
      category: 'INTEGRATION',
      trigger: { type: 'WEBHOOK_RECEIVED', config: {} },
      actions: [
        {
          id: 'act_1',
          type: 'CONDITION',
          name: 'Check Event',
          config: { field: 'event_type' },
        },
        { id: 'act_2', type: 'SEND_MESSAGE', name: 'Post Update', config: {} },
      ],
      variables: [
        {
          name: 'webhookSecret',
          type: 'string',
          defaultValue: null,
          description: 'Webhook verification secret',
        },
      ],
      tags: ['integration', 'webhook', 'external'],
      usageCount: 1680,
      isBuiltIn: true,
    },
    {
      id: 'template_vp_autorespond',
      name: 'VP Auto-Response',
      description:
        'Automatically invoke Orchestrator when certain conditions are met',
      category: 'CUSTOM',
      trigger: {
        type: 'MESSAGE_KEYWORD',
        config: { keywords: ['@vp', 'help'] },
      },
      actions: [
        {
          id: 'act_1',
          type: 'INVOKE_VP',
          name: 'Ask VP',
          config: { vpId: '' },
        },
        {
          id: 'act_2',
          type: 'SEND_MESSAGE',
          name: 'Reply',
          config: { source: 'vp_response' },
        },
      ],
      variables: [
        {
          name: 'vpId',
          type: 'string',
          defaultValue: null,
          description: 'VP to invoke',
        },
      ],
      tags: ['vp', 'automation', 'response'],
      usageCount: 780,
      isBuiltIn: true,
    },
  ];
}

// =============================================================================
// WORKFLOW QUERY RESOLVERS
// =============================================================================

/**
 * Workflow Query resolvers
 */
export const workflowQueries = {
  /**
   * Get a single workflow by ID
   */
  workflow: async (
    _parent: unknown,
    args: WorkflowQueryArgs,
    context: GraphQLContext
  ): Promise<Workflow | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const workflow = (await context.prisma.workflow.findUnique({
      where: { id: args.id },
    })) as Workflow | null;

    return workflow;
  },

  /**
   * Get all workflows for a workspace
   */
  workflows: async (
    _parent: unknown,
    args: WorkflowsQueryArgs,
    context: GraphQLContext
  ): Promise<Workflow[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const where: Record<string, unknown> = {
      workspaceId: args.workspaceId,
    };

    if (args.status) {
      where.status = args.status;
    }

    if (args.triggerType) {
      where.trigger = {
        path: ['type'],
        equals: args.triggerType,
      };
    }

    const workflows = await context.prisma.workflow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return workflows as Workflow[];
  },

  /**
   * Get a single workflow execution by ID
   */
  workflowExecution: async (
    _parent: unknown,
    args: WorkflowExecutionQueryArgs,
    context: GraphQLContext
  ): Promise<WorkflowExecution | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const execution = (await context.prisma.workflowExecution.findUnique({
      where: { id: args.id },
    })) as WorkflowExecution | null;

    return execution;
  },

  /**
   * Get workflow executions
   */
  workflowExecutions: async (
    _parent: unknown,
    args: WorkflowExecutionsQueryArgs,
    context: GraphQLContext
  ): Promise<WorkflowExecution[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const where: Record<string, unknown> = {
      workflowId: args.workflowId,
    };

    if (args.status) {
      where.status = args.status;
    }

    const executions = await context.prisma.workflowExecution.findMany({
      where,
      take: limit,
      orderBy: { startedAt: 'desc' },
    });

    return executions as WorkflowExecution[];
  },

  /**
   * Get workflow templates
   */
  workflowTemplates: async (
    _parent: unknown,
    args: WorkflowTemplatesQueryArgs,
    context: GraphQLContext
  ): Promise<WorkflowTemplate[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // Get built-in templates
    let templates = getBuiltInTemplates();

    // Filter by category if specified
    if (args.category) {
      templates = templates.filter(t => t.category === args.category);
    }

    // Get custom templates from database
    const customTemplates = (await context.prisma.workflowTemplate.findMany({
      where: args.category
        ? { category: args.category, isBuiltIn: false }
        : { isBuiltIn: false },
      orderBy: { usageCount: 'desc' },
    })) as WorkflowTemplate[];

    return [...templates, ...customTemplates];
  },
};

// =============================================================================
// WORKFLOW MUTATION RESOLVERS
// =============================================================================

/**
 * Workflow Mutation resolvers
 */
export const workflowMutations = {
  /**
   * Create a new workflow
   */
  createWorkflow: async (
    _parent: unknown,
    args: CreateWorkflowArgs,
    context: GraphQLContext
  ): Promise<Workflow> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, input } = args;

    // Validate workflow name
    if (!isValidWorkflowName(input.name)) {
      throw new GraphQLError(
        'Invalid workflow name. Must be between 1 and 100 characters.',
        {
          extensions: { code: 'BAD_USER_INPUT' },
        }
      );
    }

    // Validate trigger type
    if (!isValidTriggerType(input.trigger.type)) {
      throw new GraphQLError(`Invalid trigger type: ${input.trigger.type}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate actions
    const actionsValidation = validateActions(input.actions);
    if (!actionsValidation.valid) {
      throw new GraphQLError(actionsValidation.error!, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate workspace exists
    const workspace = await context.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Prepare trigger with ID
    const trigger: WorkflowTrigger = {
      id: generateTriggerId(),
      type: input.trigger.type,
      config: input.trigger.config,
      filters: input.trigger.filters ?? null,
    };

    // Prepare actions with IDs
    const actions: WorkflowAction[] = input.actions.map(action => ({
      id: action.id ?? generateActionId(),
      type: action.type,
      name: action.name ?? null,
      config: action.config,
      onError: action.onError ?? null,
      retryCount: action.retryCount ?? null,
    }));

    // Prepare variables
    const variables: WorkflowVariable[] = (input.variables ?? []).map(v => ({
      name: v.name,
      type: v.type,
      defaultValue: v.defaultValue ?? null,
      description: v.description ?? null,
    }));

    // Create the workflow
    const workflow = (await context.prisma.workflow.create({
      data: {
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'DRAFT',
        trigger,
        actions,
        variables,
        createdBy: context.user.id,
        runCount: 0,
        errorCount: 0,
      },
    })) as Workflow;

    // Publish status change event
    await context.pubsub.publish(`${WORKFLOW_STATUS_CHANGED}_${workspaceId}`, {
      workflowStatusChanged: workflow,
    });

    return workflow;
  },

  /**
   * Update an existing workflow
   */
  updateWorkflow: async (
    _parent: unknown,
    args: UpdateWorkflowArgs,
    context: GraphQLContext
  ): Promise<Workflow> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { id, input } = args;

    // Verify workflow exists
    const existing = (await context.prisma.workflow.findUnique({
      where: { id },
    })) as Workflow | null;

    if (!existing) {
      throw new GraphQLError('Workflow not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Validate name if provided
    if (
      input.name !== undefined &&
      input.name !== null &&
      !isValidWorkflowName(input.name)
    ) {
      throw new GraphQLError(
        'Invalid workflow name. Must be between 1 and 100 characters.',
        {
          extensions: { code: 'BAD_USER_INPUT' },
        }
      );
    }

    // Validate trigger if provided
    if (input.trigger && !isValidTriggerType(input.trigger.type)) {
      throw new GraphQLError(`Invalid trigger type: ${input.trigger.type}`, {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Validate actions if provided
    if (input.actions) {
      const actionsValidation = validateActions(input.actions);
      if (!actionsValidation.valid) {
        throw new GraphQLError(actionsValidation.error!, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== null) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.status !== undefined && input.status !== null) {
      updateData.status = input.status;
      // Reset error count when status changes
      if (input.status === 'ACTIVE' && existing.status === 'ERROR') {
        updateData.errorCount = 0;
      }
    }
    if (input.trigger !== undefined && input.trigger !== null) {
      updateData.trigger = {
        id: (existing.trigger as WorkflowTrigger).id ?? generateTriggerId(),
        type: input.trigger.type,
        config: input.trigger.config,
        filters: input.trigger.filters ?? null,
      };
    }
    if (input.actions !== undefined && input.actions !== null) {
      updateData.actions = input.actions.map(action => ({
        id: action.id ?? generateActionId(),
        type: action.type,
        name: action.name ?? null,
        config: action.config,
        onError: action.onError ?? null,
        retryCount: action.retryCount ?? null,
      }));
    }
    if (input.variables !== undefined && input.variables !== null) {
      updateData.variables = input.variables.map(v => ({
        name: v.name,
        type: v.type,
        defaultValue: v.defaultValue ?? null,
        description: v.description ?? null,
      }));
    }

    const workflow = (await context.prisma.workflow.update({
      where: { id },
      data: updateData,
    })) as Workflow;

    // Publish status change event if status changed
    if (input.status && input.status !== existing.status) {
      await context.pubsub.publish(
        `${WORKFLOW_STATUS_CHANGED}_${existing.workspaceId}`,
        {
          workflowStatusChanged: workflow,
        }
      );
    }

    return workflow;
  },

  /**
   * Delete a workflow
   */
  deleteWorkflow: async (
    _parent: unknown,
    args: DeleteWorkflowArgs,
    context: GraphQLContext
  ): Promise<boolean> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = (await context.prisma.workflow.findUnique({
      where: { id: args.id },
    })) as Workflow | null;

    if (!existing) {
      throw new GraphQLError('Workflow not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Delete associated executions first
    await context.prisma.workflowExecution.deleteMany({
      where: { workflowId: args.id },
    });

    // Delete the workflow
    await context.prisma.workflow.delete({
      where: { id: args.id },
    });

    return true;
  },

  /**
   * Activate a workflow
   */
  activateWorkflow: async (
    _parent: unknown,
    args: ActivateWorkflowArgs,
    context: GraphQLContext
  ): Promise<Workflow> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = (await context.prisma.workflow.findUnique({
      where: { id: args.id },
    })) as Workflow | null;

    if (!existing) {
      throw new GraphQLError('Workflow not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existing.status === 'ACTIVE') {
      return existing;
    }

    // Validate workflow before activation
    if (context.workflowService) {
      const validation =
        await context.workflowService.validateWorkflow(existing);
      if (!validation.valid) {
        throw new GraphQLError(
          `Cannot activate workflow: ${validation.errors.join(', ')}`,
          {
            extensions: { code: 'BAD_USER_INPUT' },
          }
        );
      }
    }

    const workflow = (await context.prisma.workflow.update({
      where: { id: args.id },
      data: { status: 'ACTIVE' },
    })) as Workflow;

    // Publish status change event
    await context.pubsub.publish(
      `${WORKFLOW_STATUS_CHANGED}_${existing.workspaceId}`,
      {
        workflowStatusChanged: workflow,
      }
    );

    return workflow;
  },

  /**
   * Deactivate a workflow
   */
  deactivateWorkflow: async (
    _parent: unknown,
    args: DeactivateWorkflowArgs,
    context: GraphQLContext
  ): Promise<Workflow> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = (await context.prisma.workflow.findUnique({
      where: { id: args.id },
    })) as Workflow | null;

    if (!existing) {
      throw new GraphQLError('Workflow not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existing.status === 'INACTIVE') {
      return existing;
    }

    const workflow = (await context.prisma.workflow.update({
      where: { id: args.id },
      data: { status: 'INACTIVE' },
    })) as Workflow;

    // Publish status change event
    await context.pubsub.publish(
      `${WORKFLOW_STATUS_CHANGED}_${existing.workspaceId}`,
      {
        workflowStatusChanged: workflow,
      }
    );

    return workflow;
  },

  /**
   * Execute a workflow
   */
  executeWorkflow: async (
    _parent: unknown,
    args: ExecuteWorkflowArgs,
    context: GraphQLContext
  ): Promise<WorkflowExecution> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = (await context.prisma.workflow.findUnique({
      where: { id: args.id },
    })) as Workflow | null;

    if (!existing) {
      throw new GraphQLError('Workflow not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existing.status !== 'ACTIVE') {
      throw new GraphQLError('Workflow must be active to execute', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Use workflow service if available
    if (context.workflowService) {
      const execution = await context.workflowService.executeWorkflow(
        args.id,
        args.triggerData
      );

      // Publish execution update event
      await context.pubsub.publish(
        `${WORKFLOW_EXECUTION_UPDATED}_${existing.workspaceId}`,
        {
          workflowExecutionUpdated: execution,
        }
      );

      return execution;
    }

    // Default implementation - create pending execution
    const execution = (await context.prisma.workflowExecution.create({
      data: {
        workflowId: args.id,
        status: 'PENDING',
        triggerData: args.triggerData ?? {},
        variables: {},
        actionResults: [],
        startedAt: new Date(),
      },
    })) as WorkflowExecution;

    // Update workflow run count and last run time
    await context.prisma.workflow.update({
      where: { id: args.id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
      },
    });

    return execution;
  },

  /**
   * Test a workflow with sample data
   */
  testWorkflow: async (
    _parent: unknown,
    args: TestWorkflowArgs,
    context: GraphQLContext
  ): Promise<WorkflowExecution> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = (await context.prisma.workflow.findUnique({
      where: { id: args.id },
    })) as Workflow | null;

    if (!existing) {
      throw new GraphQLError('Workflow not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Use workflow service if available
    if (context.workflowService) {
      return context.workflowService.testWorkflow(args.id, args.sampleData);
    }

    // Default mock implementation
    const execution: WorkflowExecution = {
      id: `exec_test_${Date.now()}`,
      workflowId: args.id,
      status: 'COMPLETED',
      triggerData: args.sampleData,
      variables: {},
      actionResults: existing.actions.map(action => ({
        actionId: action.id,
        status: 'SUCCESS',
        output: { test: true },
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 50,
      })),
      startedAt: new Date(),
      completedAt: new Date(),
      error: null,
      durationMs: existing.actions.length * 50,
    };

    return execution;
  },

  /**
   * Cancel a running execution
   */
  cancelExecution: async (
    _parent: unknown,
    args: CancelExecutionArgs,
    context: GraphQLContext
  ): Promise<boolean> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const existing = (await context.prisma.workflowExecution.findUnique({
      where: { id: args.id },
    })) as WorkflowExecution | null;

    if (!existing) {
      throw new GraphQLError('Execution not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (existing.status !== 'PENDING' && existing.status !== 'RUNNING') {
      throw new GraphQLError('Can only cancel pending or running executions', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Use workflow service if available
    if (context.workflowService) {
      return context.workflowService.cancelExecution(args.id);
    }

    // Update execution status
    await context.prisma.workflowExecution.update({
      where: { id: args.id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    return true;
  },

  /**
   * Create a workflow from a template
   */
  createWorkflowFromTemplate: async (
    _parent: unknown,
    args: CreateFromTemplateArgs,
    context: GraphQLContext
  ): Promise<Workflow> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, templateId, name } = args;

    // Validate workspace exists
    const workspace = await context.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new GraphQLError('Workspace not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Find template (check built-in first, then database)
    let template: WorkflowTemplate | null =
      getBuiltInTemplates().find(t => t.id === templateId) ?? null;

    if (!template) {
      template = (await context.prisma.workflowTemplate.findUnique({
        where: { id: templateId },
      })) as WorkflowTemplate | null;
    }

    if (!template) {
      throw new GraphQLError('Template not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Parse template data
    const templateTrigger = template.trigger as Record<string, unknown>;
    const templateActions = template.actions as WorkflowActionInput[];
    const templateVariables = template.variables as
      | WorkflowVariableInput[]
      | null;

    // Create workflow from template
    const trigger: WorkflowTrigger = {
      id: generateTriggerId(),
      type: templateTrigger.type as TriggerTypeValue,
      config: (templateTrigger.config as Record<string, unknown>) ?? {},
      filters: null,
    };

    const actions: WorkflowAction[] = templateActions.map(action => ({
      id: generateActionId(),
      type: action.type,
      name: action.name ?? null,
      config: action.config,
      onError: action.onError ?? null,
      retryCount: action.retryCount ?? null,
    }));

    const variables: WorkflowVariable[] = (templateVariables ?? []).map(v => ({
      name: v.name,
      type: v.type,
      defaultValue: v.defaultValue ?? null,
      description: v.description ?? null,
    }));

    // Create the workflow
    const workflow = (await context.prisma.workflow.create({
      data: {
        workspaceId,
        name: name ?? `${template.name} (from template)`,
        description: template.description,
        status: 'DRAFT',
        trigger,
        actions,
        variables,
        createdBy: context.user.id,
        runCount: 0,
        errorCount: 0,
      },
    })) as Workflow;

    // Increment template usage count (for custom templates)
    if (!template.isBuiltIn) {
      await context.prisma.workflowTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });
    }

    return workflow;
  },
};

// =============================================================================
// WORKFLOW SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Workflow Subscription resolvers
 */
export const workflowSubscriptions = {
  /**
   * Subscribe to workflow execution updates
   */
  workflowExecutionUpdated: {
    subscribe: async (
      _parent: unknown,
      args: WorkflowExecutionUpdatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(
        `${WORKFLOW_EXECUTION_UPDATED}_${args.workspaceId}`
      );
    },
  },

  /**
   * Subscribe to workflow status changes
   */
  workflowStatusChanged: {
    subscribe: async (
      _parent: unknown,
      args: WorkflowStatusChangedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(
        `${WORKFLOW_STATUS_CHANGED}_${args.workspaceId}`
      );
    },
  },
};

// =============================================================================
// WORKFLOW FIELD RESOLVERS
// =============================================================================

/**
 * Workflow field resolvers for nested types
 */
export const WorkflowFieldResolvers = {
  /**
   * Resolve the workspace for a workflow
   */
  workspace: async (
    parent: Workflow,
    _args: unknown,
    context: GraphQLContext
  ): Promise<Workspace | null> => {
    // Use dataloader if available
    if (context.dataloaders?.workspace) {
      return context.dataloaders.workspace.load(parent.workspaceId);
    }

    const workspace = await context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });

    return workspace as Workspace | null;
  },

  /**
   * Resolve the creator for a workflow
   */
  creator: async (
    parent: Workflow,
    _args: unknown,
    context: GraphQLContext
  ): Promise<User | null> => {
    // Use dataloader if available
    if (context.dataloaders?.user) {
      return context.dataloaders.user.load(parent.createdBy);
    }

    const user = await context.prisma.user.findUnique({
      where: { id: parent.createdBy },
    });

    return user as User | null;
  },

  /**
   * Resolve recent executions for a workflow
   */
  recentExecutions: async (
    parent: Workflow,
    _args: unknown,
    context: GraphQLContext
  ): Promise<WorkflowExecution[]> => {
    const executions = await context.prisma.workflowExecution.findMany({
      where: { workflowId: parent.id },
      take: 10,
      orderBy: { startedAt: 'desc' },
    });

    return executions as WorkflowExecution[];
  },

  /**
   * Calculate success rate from recent executions
   */
  successRate: async (
    parent: Workflow,
    _args: unknown,
    context: GraphQLContext
  ): Promise<number> => {
    const executions = await context.prisma.workflowExecution.findMany({
      where: { workflowId: parent.id },
      take: 100,
      orderBy: { startedAt: 'desc' },
      select: { status: true },
    });

    return calculateSuccessRate(executions as unknown as WorkflowExecution[]);
  },

  /**
   * Parse trigger JSON
   */
  trigger: (parent: Workflow): WorkflowTrigger => {
    return parent.trigger as WorkflowTrigger;
  },

  /**
   * Parse actions JSON
   */
  actions: (parent: Workflow): WorkflowAction[] => {
    return parent.actions as WorkflowAction[];
  },

  /**
   * Parse variables JSON
   */
  variables: (parent: Workflow): WorkflowVariable[] => {
    return parent.variables as WorkflowVariable[];
  },
};

/**
 * WorkflowExecution field resolvers
 */
export const WorkflowExecutionFieldResolvers = {
  /**
   * Resolve the workflow for an execution
   */
  workflow: async (
    parent: WorkflowExecution,
    _args: unknown,
    context: GraphQLContext
  ): Promise<Workflow | null> => {
    // Use dataloader if available
    if (context.dataloaders?.workflow) {
      return context.dataloaders.workflow.load(parent.workflowId);
    }

    const workflow = await context.prisma.workflow.findUnique({
      where: { id: parent.workflowId },
    });

    return workflow as Workflow | null;
  },

  /**
   * Parse triggerData JSON
   */
  triggerData: (parent: WorkflowExecution): Record<string, unknown> => {
    if (!parent.triggerData) {
      return {};
    }
    return parent.triggerData as Record<string, unknown>;
  },

  /**
   * Parse variables JSON
   */
  variables: (parent: WorkflowExecution): Record<string, unknown> => {
    if (!parent.variables) {
      return {};
    }
    return parent.variables as Record<string, unknown>;
  },

  /**
   * Parse actionResults JSON
   */
  actionResults: (parent: WorkflowExecution): ActionResult[] => {
    if (!parent.actionResults) {
      return [];
    }
    return parent.actionResults as ActionResult[];
  },
};

/**
 * WorkflowTemplate field resolvers
 */
export const WorkflowTemplateFieldResolvers = {
  /**
   * Parse trigger JSON
   */
  trigger: (parent: WorkflowTemplate): Record<string, unknown> => {
    if (!parent.trigger) {
      return {};
    }
    return parent.trigger as Record<string, unknown>;
  },

  /**
   * Parse actions JSON
   */
  actions: (parent: WorkflowTemplate): Record<string, unknown>[] => {
    if (!parent.actions) {
      return [];
    }
    return parent.actions as Record<string, unknown>[];
  },

  /**
   * Parse variables JSON
   */
  variables: (parent: WorkflowTemplate): Record<string, unknown> | null => {
    if (!parent.variables) {
      return null;
    }
    return parent.variables as Record<string, unknown>;
  },
};

// =============================================================================
// COMBINED WORKFLOW RESOLVERS
// =============================================================================

/**
 * Combined workflow resolvers object for use with graphql-tools
 */
export const workflowResolvers = {
  Query: workflowQueries,
  Mutation: workflowMutations,
  Subscription: workflowSubscriptions,
  Workflow: WorkflowFieldResolvers,
  WorkflowExecution: WorkflowExecutionFieldResolvers,
  WorkflowTemplate: WorkflowTemplateFieldResolvers,
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create workflow resolvers with injected context
 *
 * @param baseContext - The base context with required services
 * @returns Configured workflow resolvers
 *
 * @example
 * ```typescript
 * const resolvers = createWorkflowResolvers({
 *   prisma: prismaClient,
 *   pubsub: pubsubInstance,
 *   workflowService: workflowServiceInstance,
 * });
 * ```
 */
export function createWorkflowResolvers(
  baseContext: Pick<
    GraphQLContext,
    'prisma' | 'pubsub' | 'workflowService' | 'dataloaders'
  >
) {
  const createContext = (user: ContextUser): GraphQLContext => ({
    ...baseContext,
    user,
    requestId: `req_${Date.now()}`,
  });

  return {
    Query: {
      workflow: (
        _: unknown,
        args: WorkflowQueryArgs,
        ctx: { user: ContextUser }
      ) => workflowQueries.workflow(_, args, createContext(ctx.user)),
      workflows: (
        _: unknown,
        args: WorkflowsQueryArgs,
        ctx: { user: ContextUser }
      ) => workflowQueries.workflows(_, args, createContext(ctx.user)),
      workflowExecution: (
        _: unknown,
        args: WorkflowExecutionQueryArgs,
        ctx: { user: ContextUser }
      ) => workflowQueries.workflowExecution(_, args, createContext(ctx.user)),
      workflowExecutions: (
        _: unknown,
        args: WorkflowExecutionsQueryArgs,
        ctx: { user: ContextUser }
      ) => workflowQueries.workflowExecutions(_, args, createContext(ctx.user)),
      workflowTemplates: (
        _: unknown,
        args: WorkflowTemplatesQueryArgs,
        ctx: { user: ContextUser }
      ) => workflowQueries.workflowTemplates(_, args, createContext(ctx.user)),
    },
    Mutation: {
      createWorkflow: (
        _: unknown,
        args: CreateWorkflowArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.createWorkflow(_, args, createContext(ctx.user)),
      updateWorkflow: (
        _: unknown,
        args: UpdateWorkflowArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.updateWorkflow(_, args, createContext(ctx.user)),
      deleteWorkflow: (
        _: unknown,
        args: DeleteWorkflowArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.deleteWorkflow(_, args, createContext(ctx.user)),
      activateWorkflow: (
        _: unknown,
        args: ActivateWorkflowArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.activateWorkflow(_, args, createContext(ctx.user)),
      deactivateWorkflow: (
        _: unknown,
        args: DeactivateWorkflowArgs,
        ctx: { user: ContextUser }
      ) =>
        workflowMutations.deactivateWorkflow(_, args, createContext(ctx.user)),
      executeWorkflow: (
        _: unknown,
        args: ExecuteWorkflowArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.executeWorkflow(_, args, createContext(ctx.user)),
      testWorkflow: (
        _: unknown,
        args: TestWorkflowArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.testWorkflow(_, args, createContext(ctx.user)),
      cancelExecution: (
        _: unknown,
        args: CancelExecutionArgs,
        ctx: { user: ContextUser }
      ) => workflowMutations.cancelExecution(_, args, createContext(ctx.user)),
      createWorkflowFromTemplate: (
        _: unknown,
        args: CreateFromTemplateArgs,
        ctx: { user: ContextUser }
      ) =>
        workflowMutations.createWorkflowFromTemplate(
          _,
          args,
          createContext(ctx.user)
        ),
    },
    Subscription: workflowSubscriptions,
    Workflow: WorkflowFieldResolvers,
    WorkflowExecution: WorkflowExecutionFieldResolvers,
    WorkflowTemplate: WorkflowTemplateFieldResolvers,
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default workflowResolvers;
