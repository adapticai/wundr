/**
 * @genesis/core - Workflow Service
 *
 * Service layer for workflow automation including workflow CRUD,
 * execution management, action processing, and built-in templates.
 *
 * @packageDocumentation
 */

import { GenesisError } from '../errors';
import type {
  ActionResult,
  BuiltInActionResult,
  ConditionConfig,
  CreateWorkflowInput,
  DelayConfig,
  ExecutionContext,
  ExecutionStatus,
  InvokeVPConfig,
  ListExecutionsOptions,
  ListWorkflowsOptions,
  LoopActionResult,
  LoopConfig,
  PaginatedExecutionResult,
  PaginatedWorkflowResult,
  SendDMConfig,
  SendMessageConfig,
  SetVariableActionResult,
  SetVariableConfig,
  TemplateCategory,
  UpdateWorkflowInput,
  WebhookActionConfig,
  Workflow,
  WorkflowAction,
  WorkflowCondition,
  WorkflowExecution,
  WorkflowTemplate,
  WorkflowTrigger,
  WorkflowVariable,
  WorkflowVariableValue,
} from '../types/workflow';
import {
  DEFAULT_EXECUTION_LIST_OPTIONS,
  DEFAULT_MAX_LOOP_ITERATIONS,
  DEFAULT_WORKFLOW_LIST_OPTIONS,
  MAX_ACTIONS_PER_WORKFLOW,
  MAX_WEBHOOK_TIMEOUT_MS,
  MAX_WORKFLOW_NAME_LENGTH,
} from '../types/workflow';
import { generateCUID } from '../utils';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Base error for workflow operations.
 */
export class WorkflowError extends GenesisError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>,
  ) {
    super(message, code, statusCode, metadata);
    this.name = 'WorkflowError';
  }
}

/**
 * Error thrown when a workflow is not found.
 */
export class WorkflowNotFoundError extends GenesisError {
  constructor(id: string) {
    super(`Workflow not found: ${id}`, 'WORKFLOW_NOT_FOUND', 404, { id });
    this.name = 'WorkflowNotFoundError';
  }
}

/**
 * Error thrown when workflow validation fails.
 */
export class WorkflowValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'WORKFLOW_VALIDATION_ERROR', 400, { errors });
    this.name = 'WorkflowValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when workflow execution fails.
 */
export class WorkflowExecutionError extends GenesisError {
  constructor(workflowId: string, reason: string) {
    super(
      `Workflow execution failed for ${workflowId}: ${reason}`,
      'WORKFLOW_EXECUTION_ERROR',
      500,
      { workflowId, reason },
    );
    this.name = 'WorkflowExecutionError';
  }
}

/**
 * Error thrown when an execution is not found.
 */
export class ExecutionNotFoundError extends GenesisError {
  constructor(id: string) {
    super(`Execution not found: ${id}`, 'EXECUTION_NOT_FOUND', 404, { id });
    this.name = 'ExecutionNotFoundError';
  }
}

/**
 * Error thrown when action execution fails.
 */
export class ActionExecutionError extends GenesisError {
  constructor(actionId: string, reason: string) {
    super(
      `Action execution failed for ${actionId}: ${reason}`,
      'ACTION_EXECUTION_ERROR',
      500,
      { actionId, reason },
    );
    this.name = 'ActionExecutionError';
  }
}

/**
 * Error thrown when a template is not found.
 */
export class TemplateNotFoundError extends GenesisError {
  constructor(id: string) {
    super(`Template not found: ${id}`, 'TEMPLATE_NOT_FOUND', 404, { id });
    this.name = 'TemplateNotFoundError';
  }
}

// =============================================================================
// Storage Interface
// =============================================================================

/**
 * Interface for workflow storage operations.
 */
export interface WorkflowStorage {
  // Workflow operations
  getWorkflow(id: string): Promise<Workflow | null>;
  listWorkflows(
    workspaceId: string,
    options?: ListWorkflowsOptions
  ): Promise<PaginatedWorkflowResult>;
  createWorkflow(workflow: Workflow): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;

  // Execution operations
  getExecution(id: string): Promise<WorkflowExecution | null>;
  listExecutions(
    workflowId: string,
    options?: ListExecutionsOptions
  ): Promise<PaginatedExecutionResult>;
  createExecution(execution: WorkflowExecution): Promise<WorkflowExecution>;
  updateExecution(
    id: string,
    updates: Partial<WorkflowExecution>
  ): Promise<WorkflowExecution>;
}

/**
 * Interface for action handlers.
 */
export interface ActionHandler {
  execute(
    action: WorkflowAction,
    context: ExecutionContext
  ): Promise<ActionResult>;
}

// =============================================================================
// In-Memory Storage Implementation
// =============================================================================

/**
 * In-memory implementation of WorkflowStorage for testing.
 */
export class InMemoryWorkflowStorage implements WorkflowStorage {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();

  async getWorkflow(id: string): Promise<Workflow | null> {
    return this.workflows.get(id) ?? null;
  }

  async listWorkflows(
    workspaceId: string,
    options: ListWorkflowsOptions = {},
  ): Promise<PaginatedWorkflowResult> {
    let results = Array.from(this.workflows.values()).filter(
      (w) => w.workspaceId === workspaceId,
    );

    if (options.status) {
      results = results.filter((w) => w.status === options.status);
    }

    if (options.triggerType) {
      results = results.filter((w) => w.trigger.type === options.triggerType);
    }

    if (!options.includeInactive) {
      results = results.filter((w) => w.status !== 'inactive');
    }

    const total = results.length;
    const skip = options.skip ?? DEFAULT_WORKFLOW_LIST_OPTIONS.skip;
    const take = options.take ?? DEFAULT_WORKFLOW_LIST_OPTIONS.take;

    results = results.slice(skip, skip + take);

    return {
      data: results,
      total,
      hasMore: skip + results.length < total,
      nextCursor:
        results.length > 0 ? results[results.length - 1]?.id : undefined,
    };
  }

  async createWorkflow(workflow: Workflow): Promise<Workflow> {
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  async updateWorkflow(
    id: string,
    updates: Partial<Workflow>,
  ): Promise<Workflow> {
    const existing = this.workflows.get(id);
    if (!existing) {
      throw new WorkflowNotFoundError(id);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.workflows.set(id, updated);
    return updated;
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.workflows.delete(id);
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    return this.executions.get(id) ?? null;
  }

  async listExecutions(
    workflowId: string,
    options: ListExecutionsOptions = {},
  ): Promise<PaginatedExecutionResult> {
    let results = Array.from(this.executions.values()).filter(
      (e) => e.workflowId === workflowId,
    );

    if (options.status) {
      results = results.filter((e) => e.status === options.status);
    }

    if (options.after) {
      results = results.filter((e) => e.startedAt >= options.after!);
    }

    if (options.before) {
      results = results.filter((e) => e.startedAt <= options.before!);
    }

    const total = results.length;
    const skip = options.skip ?? DEFAULT_EXECUTION_LIST_OPTIONS.skip;
    const take = options.take ?? DEFAULT_EXECUTION_LIST_OPTIONS.take;

    // Sort by startedAt descending
    results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    results = results.slice(skip, skip + take);

    return {
      data: results,
      total,
      hasMore: skip + results.length < total,
      nextCursor:
        results.length > 0 ? results[results.length - 1]?.id : undefined,
    };
  }

  async createExecution(
    execution: WorkflowExecution,
  ): Promise<WorkflowExecution> {
    this.executions.set(execution.id, execution);
    return execution;
  }

  async updateExecution(
    id: string,
    updates: Partial<WorkflowExecution>,
  ): Promise<WorkflowExecution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw new ExecutionNotFoundError(id);
    }

    const updated = { ...existing, ...updates };
    this.executions.set(id, updated);
    return updated;
  }

  // Helper methods for testing
  clear(): void {
    this.workflows.clear();
    this.executions.clear();
  }
}

// =============================================================================
// Built-in Templates
// =============================================================================

/**
 * Built-in workflow templates.
 */
export const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'template_welcome_message',
    name: 'Welcome New Members',
    description:
      'Automatically send a welcome message when someone joins a channel',
    category: 'onboarding',
    trigger: {
      type: 'channel_joined',
      config: {
        type: 'channel_joined',
        channelIds: [],
      },
    },
    actions: [
      {
        type: 'send_dm',
        name: 'Send Welcome DM',
        config: {
          type: 'send_dm',
          userId: '{{trigger.userId}}',
          message:
            'Welcome to the team! Feel free to introduce yourself and ask questions.',
        } as SendDMConfig,
        onError: 'continue',
      },
    ],
    variables: [],
    tags: ['onboarding', 'welcome', 'new member'],
    usageCount: 0,
    isBuiltIn: true,
  },
  {
    id: 'template_keyword_alert',
    name: 'Keyword Alert',
    description: 'Send a notification when specific keywords are mentioned',
    category: 'notifications',
    trigger: {
      type: 'message_keyword',
      config: {
        type: 'message_keyword',
        keywords: ['urgent', 'help', 'emergency'],
        matchType: 'contains',
        caseSensitive: false,
      },
    },
    actions: [
      {
        type: 'send_message',
        name: 'Alert Channel',
        config: {
          type: 'send_message',
          channelId: '{{config.alertChannelId}}',
          message:
            'Keyword alert triggered by {{trigger.user.name}} in {{trigger.channel.name}}: {{trigger.message.content}}',
        } as SendMessageConfig,
        onError: 'continue',
      },
    ],
    variables: [
      {
        name: 'alertChannelId',
        type: 'string',
        defaultValue: '',
      },
    ],
    tags: ['notifications', 'alerts', 'keywords'],
    usageCount: 0,
    isBuiltIn: true,
  },
  {
    id: 'template_scheduled_reminder',
    name: 'Scheduled Reminder',
    description: 'Send recurring reminders to a channel',
    category: 'productivity',
    trigger: {
      type: 'scheduled',
      config: {
        type: 'scheduled',
        schedule: '0 9 * * 1', // Every Monday at 9 AM
        timezone: 'UTC',
      },
    },
    actions: [
      {
        type: 'send_message',
        name: 'Send Reminder',
        config: {
          type: 'send_message',
          channelId: '{{config.channelId}}',
          message: '{{config.reminderMessage}}',
        } as SendMessageConfig,
        onError: 'stop',
      },
    ],
    variables: [
      {
        name: 'channelId',
        type: 'string',
        defaultValue: '',
      },
      {
        name: 'reminderMessage',
        type: 'string',
        defaultValue: 'Weekly reminder: Please update your status!',
      },
    ],
    tags: ['productivity', 'reminder', 'scheduled'],
    usageCount: 0,
    isBuiltIn: true,
  },
  {
    id: 'template_vp_assistance',
    name: 'VP Assistance Request',
    description: 'Route messages to a Orchestrator for automated assistance',
    category: 'integration',
    trigger: {
      type: 'message_keyword',
      config: {
        type: 'message_keyword',
        keywords: ['@assistant', '/ask'],
        matchType: 'contains',
        caseSensitive: false,
      },
    },
    actions: [
      {
        type: 'invoke_vp',
        name: 'Ask VP',
        config: {
          type: 'invoke_vp',
          orchestratorId: '{{config.orchestratorId}}',
          prompt: '{{trigger.message.content}}',
          waitForResponse: true,
        } as InvokeVPConfig,
        onError: 'stop',
      },
      {
        type: 'send_message',
        name: 'Reply with OrchestratorResponse',
        config: {
          type: 'send_message',
          channelId: '{{trigger.channelId}}',
          message: '{{actions.ask_vp.response}}',
        } as SendMessageConfig,
        onError: 'continue',
      },
    ],
    variables: [
      {
        name: 'orchestratorId',
        type: 'string',
        defaultValue: '',
      },
    ],
    tags: ['integration', 'vp', 'assistance', 'ai'],
    usageCount: 0,
    isBuiltIn: true,
  },
  {
    id: 'template_reaction_feedback',
    name: 'Reaction Feedback Collection',
    description: 'Collect feedback when users react with specific emojis',
    category: 'productivity',
    trigger: {
      type: 'reaction_added',
      config: {
        type: 'reaction_added',
        emojis: ['+1', '-1', 'question'],
      },
    },
    actions: [
      {
        type: 'call_webhook',
        name: 'Log Feedback',
        config: {
          type: 'call_webhook',
          url: '{{config.webhookUrl}}',
          method: 'POST',
          body: {
            messageId: '{{trigger.messageId}}',
            reaction: '{{trigger.emoji}}',
            userId: '{{trigger.userId}}',
            timestamp: '{{trigger.timestamp}}',
          },
          timeout: 5000,
        } as WebhookActionConfig,
        onError: 'continue',
      },
    ],
    variables: [
      {
        name: 'webhookUrl',
        type: 'string',
        defaultValue: '',
      },
    ],
    tags: ['productivity', 'feedback', 'reactions'],
    usageCount: 0,
    isBuiltIn: true,
  },
];

// =============================================================================
// Workflow Service Interface
// =============================================================================

/**
 * Interface for workflow operations.
 */
export interface WorkflowService {
  // Workflow CRUD
  createWorkflow(
    input: CreateWorkflowInput,
    createdBy: string
  ): Promise<Workflow>;
  getWorkflow(id: string): Promise<Workflow | null>;
  listWorkflows(
    workspaceId: string,
    options?: ListWorkflowsOptions
  ): Promise<PaginatedWorkflowResult>;
  updateWorkflow(id: string, updates: UpdateWorkflowInput): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;

  // Status management
  activateWorkflow(id: string): Promise<Workflow>;
  deactivateWorkflow(id: string): Promise<Workflow>;

  // Execution
  executeWorkflow(
    workflowId: string,
    triggerData: Record<string, unknown>
  ): Promise<WorkflowExecution>;
  cancelExecution(executionId: string): Promise<WorkflowExecution>;
  getExecutionHistory(
    workflowId: string,
    options?: ListExecutionsOptions
  ): Promise<PaginatedExecutionResult>;

  // Templates
  getTemplates(category?: TemplateCategory): WorkflowTemplate[];
  createFromTemplate(
    templateId: string,
    workspaceId: string,
    createdBy: string,
    overrides?: Partial<CreateWorkflowInput>
  ): Promise<Workflow>;
}

// =============================================================================
// Workflow Service Configuration
// =============================================================================

/**
 * Configuration for the Workflow Service.
 */
export interface WorkflowServiceConfig {
  /** Storage backend */
  storage: WorkflowStorage;
  /** Custom action handlers */
  actionHandlers?: Map<string, ActionHandler>;
  /** Maximum execution time in ms */
  maxExecutionTimeMs?: number;
}

// =============================================================================
// Workflow Service Implementation
// =============================================================================

/**
 * Workflow Service implementation.
 */
export class WorkflowServiceImpl implements WorkflowService {
  private readonly storage: WorkflowStorage;
  private readonly actionHandlers: Map<string, ActionHandler>;
  private readonly maxExecutionTimeMs: number;
  private readonly activeExecutions: Map<string, boolean> = new Map();

  constructor(config: WorkflowServiceConfig) {
    this.storage = config.storage;
    this.actionHandlers = config.actionHandlers ?? new Map();
    this.maxExecutionTimeMs = config.maxExecutionTimeMs ?? 60000; // 1 minute default
  }

  // ===========================================================================
  // Workflow CRUD Operations
  // ===========================================================================

  async createWorkflow(
    input: CreateWorkflowInput,
    createdBy: string,
  ): Promise<Workflow> {
    this.validateCreateWorkflowInput(input);

    const now = new Date();
    const trigger: WorkflowTrigger = {
      id: generateCUID(),
      ...input.trigger,
    };

    const actions: WorkflowAction[] = input.actions.map((action) => ({
      id: generateCUID(),
      ...action,
    }));

    const workflow: Workflow = {
      id: generateCUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      status: input.status ?? 'draft',
      trigger,
      actions,
      variables: input.variables,
      createdBy,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      errorCount: 0,
    };

    return this.storage.createWorkflow(workflow);
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    return this.storage.getWorkflow(id);
  }

  async listWorkflows(
    workspaceId: string,
    options?: ListWorkflowsOptions,
  ): Promise<PaginatedWorkflowResult> {
    return this.storage.listWorkflows(workspaceId, options);
  }

  async updateWorkflow(
    id: string,
    updates: UpdateWorkflowInput,
  ): Promise<Workflow> {
    const existing = await this.storage.getWorkflow(id);
    if (!existing) {
      throw new WorkflowNotFoundError(id);
    }

    const updateData: Partial<Workflow> = {};

    if (updates.name !== undefined) {
      if (updates.name.length > MAX_WORKFLOW_NAME_LENGTH) {
        throw new WorkflowValidationError('Workflow name too long', {
          name: [`Name must be ${MAX_WORKFLOW_NAME_LENGTH} characters or less`],
        });
      }
      updateData.name = updates.name;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.trigger !== undefined) {
      updateData.trigger = {
        id: existing.trigger.id,
        ...updates.trigger,
      };
    }

    if (updates.actions !== undefined) {
      if (updates.actions.length > MAX_ACTIONS_PER_WORKFLOW) {
        throw new WorkflowValidationError('Too many actions', {
          actions: [`Maximum ${MAX_ACTIONS_PER_WORKFLOW} actions allowed`],
        });
      }
      updateData.actions = updates.actions.map((action) => ({
        id: generateCUID(),
        ...action,
      }));
    }

    if (updates.variables !== undefined) {
      updateData.variables = updates.variables;
    }

    return this.storage.updateWorkflow(id, updateData);
  }

  async deleteWorkflow(id: string): Promise<void> {
    const existing = await this.storage.getWorkflow(id);
    if (!existing) {
      throw new WorkflowNotFoundError(id);
    }

    await this.storage.deleteWorkflow(id);
  }

  // ===========================================================================
  // Status Management
  // ===========================================================================

  async activateWorkflow(id: string): Promise<Workflow> {
    const existing = await this.storage.getWorkflow(id);
    if (!existing) {
      throw new WorkflowNotFoundError(id);
    }

    if (existing.status === 'active') {
      return existing;
    }

    return this.storage.updateWorkflow(id, { status: 'active' });
  }

  async deactivateWorkflow(id: string): Promise<Workflow> {
    const existing = await this.storage.getWorkflow(id);
    if (!existing) {
      throw new WorkflowNotFoundError(id);
    }

    if (existing.status === 'inactive') {
      return existing;
    }

    return this.storage.updateWorkflow(id, { status: 'inactive' });
  }

  // ===========================================================================
  // Execution Operations
  // ===========================================================================

  async executeWorkflow(
    workflowId: string,
    triggerData: Record<string, unknown>,
  ): Promise<WorkflowExecution> {
    const workflow = await this.storage.getWorkflow(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    if (workflow.status !== 'active') {
      throw new WorkflowExecutionError(
        workflowId,
        `Workflow is ${workflow.status}, not active`,
      );
    }

    // Initialize execution
    const executionId = generateCUID();
    const variables = this.initializeVariables(workflow.variables ?? []);

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      triggerData,
      variables,
      actionResults: [],
      startedAt: new Date(),
    };

    await this.storage.createExecution(execution);
    this.activeExecutions.set(executionId, true);

    try {
      // Execute actions
      const context: ExecutionContext = {
        execution,
        workflow,
        variables,
        triggerData,
        actionResults: [],
      };

      const actionResults = await this.executeActions(workflow.actions, context);

      // Update execution with results
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - execution.startedAt.getTime();

      const hasErrors = actionResults.some((r) => r.status === 'failed');
      const finalStatus: ExecutionStatus = hasErrors ? 'failed' : 'completed';

      const updatedExecution = await this.storage.updateExecution(executionId, {
        status: finalStatus,
        actionResults,
        variables: context.variables,
        completedAt,
        durationMs,
      });

      // Update workflow stats
      await this.storage.updateWorkflow(workflowId, {
        lastRunAt: completedAt,
        runCount: workflow.runCount + 1,
        errorCount: hasErrors ? workflow.errorCount + 1 : workflow.errorCount,
      });

      return updatedExecution;
    } catch (error) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - execution.startedAt.getTime();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const failedExecution = await this.storage.updateExecution(executionId, {
        status: 'failed',
        error: errorMessage,
        completedAt,
        durationMs,
      });

      await this.storage.updateWorkflow(workflowId, {
        lastRunAt: completedAt,
        runCount: workflow.runCount + 1,
        errorCount: workflow.errorCount + 1,
      });

      return failedExecution;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.storage.getExecution(executionId);
    if (!execution) {
      throw new ExecutionNotFoundError(executionId);
    }

    if (execution.status !== 'running' && execution.status !== 'pending') {
      throw new WorkflowExecutionError(
        execution.workflowId,
        `Cannot cancel execution in status: ${execution.status}`,
      );
    }

    // Mark as cancelled
    this.activeExecutions.set(executionId, false);

    return this.storage.updateExecution(executionId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  }

  async getExecutionHistory(
    workflowId: string,
    options?: ListExecutionsOptions,
  ): Promise<PaginatedExecutionResult> {
    const workflow = await this.storage.getWorkflow(workflowId);
    if (!workflow) {
      throw new WorkflowNotFoundError(workflowId);
    }

    return this.storage.listExecutions(workflowId, options);
  }

  // ===========================================================================
  // Template Operations
  // ===========================================================================

  getTemplates(category?: TemplateCategory): WorkflowTemplate[] {
    if (category) {
      return BUILT_IN_TEMPLATES.filter((t) => t.category === category);
    }
    return [...BUILT_IN_TEMPLATES];
  }

  async createFromTemplate(
    templateId: string,
    workspaceId: string,
    createdBy: string,
    overrides?: Partial<CreateWorkflowInput>,
  ): Promise<Workflow> {
    const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    // Increment usage count (in real implementation, this would persist)
    template.usageCount += 1;

    const input: CreateWorkflowInput = {
      workspaceId,
      name: overrides?.name ?? template.name,
      description: overrides?.description ?? template.description,
      trigger: overrides?.trigger ?? template.trigger,
      actions: overrides?.actions ?? template.actions,
      variables: overrides?.variables ?? template.variables,
      status: overrides?.status ?? 'draft',
    };

    return this.createWorkflow(input, createdBy);
  }

  // ===========================================================================
  // Action Execution
  // ===========================================================================

  /**
   * Execute a single action.
   */
  async executeAction(
    action: WorkflowAction,
    context: ExecutionContext,
  ): Promise<ActionResult> {
    const startedAt = new Date();

    try {
      // Check for cancellation
      if (!this.activeExecutions.get(context.execution.id)) {
        return {
          actionId: action.id,
          status: 'skipped',
          startedAt,
          completedAt: new Date(),
          durationMs: 0,
        };
      }

      // Check for custom handler
      const handler = this.actionHandlers.get(action.type);
      if (handler) {
        return await handler.execute(action, context);
      }

      // Execute built-in action
      const output = await this.executeBuiltInAction(action, context);

      const completedAt = new Date();
      return {
        actionId: action.id,
        status: 'success',
        output,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        actionId: action.id,
        status: 'failed',
        error: errorMessage,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      };
    }
  }

  /**
   * Evaluate a workflow condition.
   */
  evaluateCondition(
    condition: WorkflowCondition,
    context: ExecutionContext,
  ): boolean {
    const fieldValue = this.resolveVariable(condition.field, context);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string' &&
          fieldValue.includes(condition.value)
        );
      case 'gt':
        return (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number' &&
          fieldValue > condition.value
        );
      case 'lt':
        return (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number' &&
          fieldValue < condition.value
        );
      case 'gte':
        return (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number' &&
          fieldValue >= condition.value
        );
      case 'lte':
        return (
          typeof fieldValue === 'number' &&
          typeof condition.value === 'number' &&
          fieldValue <= condition.value
        );
      case 'is_empty':
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'is_not_empty':
        return (
          fieldValue !== null &&
          fieldValue !== undefined &&
          fieldValue !== '' &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      default:
        return false;
    }
  }

  /**
   * Interpolate template string with variables.
   */
  interpolateTemplate(
    template: string,
    context: ExecutionContext,
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const value = this.resolveVariable(path.trim(), context);
      return value !== undefined ? String(value) : '';
    });
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private validateCreateWorkflowInput(input: CreateWorkflowInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.workspaceId || input.workspaceId.trim().length === 0) {
      errors.workspaceId = ['Workspace ID is required'];
    }

    if (!input.name || input.name.trim().length === 0) {
      errors.name = ['Name is required'];
    } else if (input.name.length > MAX_WORKFLOW_NAME_LENGTH) {
      errors.name = [
        `Name must be ${MAX_WORKFLOW_NAME_LENGTH} characters or less`,
      ];
    }

    if (!input.trigger) {
      errors.trigger = ['Trigger is required'];
    }

    if (!input.actions || input.actions.length === 0) {
      errors.actions = ['At least one action is required'];
    } else if (input.actions.length > MAX_ACTIONS_PER_WORKFLOW) {
      errors.actions = [`Maximum ${MAX_ACTIONS_PER_WORKFLOW} actions allowed`];
    }

    if (Object.keys(errors).length > 0) {
      throw new WorkflowValidationError('Workflow validation failed', errors);
    }
  }

  private initializeVariables(
    variables: WorkflowVariable[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const variable of variables) {
      result[variable.name] = variable.defaultValue;
    }
    return result;
  }

  private async executeActions(
    actions: WorkflowAction[],
    context: ExecutionContext,
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      // Check for cancellation
      if (!this.activeExecutions.get(context.execution.id)) {
        break;
      }

      const result = await this.executeAction(action, context);
      results.push(result);
      context.actionResults = results;

      // Handle error strategy
      if (result.status === 'failed') {
        if (action.onError === 'stop') {
          break;
        } else if (action.onError === 'retry' && action.retryCount) {
          // Retry logic
          for (let i = 0; i < action.retryCount; i++) {
            await this.sleep(1000 * (i + 1)); // Exponential backoff
            const retryResult = await this.executeAction(action, context);
            if (retryResult.status === 'success') {
              results[results.length - 1] = retryResult;
              break;
            }
          }
        }
        // 'continue' - just continue to next action
      }
    }

    return results;
  }

  /**
   * Executes a built-in workflow action.
   *
   * @param action - The workflow action to execute
   * @param context - The execution context with workflow state
   * @returns The typed action result based on the action type
   */
  private async executeBuiltInAction(
    action: WorkflowAction,
    context: ExecutionContext,
  ): Promise<BuiltInActionResult> {
    const config = action.config;

    switch (config.type) {
      case 'delay':
        return this.executeDelayAction(config, context);
      case 'condition':
        return this.executeConditionAction(config, context);
      case 'set_variable':
        return this.executeSetVariableAction(config, context);
      case 'loop':
        return this.executeLoopAction(config, action, context);
      case 'send_message':
        return this.executeSendMessageAction(config, context);
      case 'send_dm':
        return this.executeSendDMAction(config, context);
      case 'call_webhook':
        return this.executeWebhookAction(config, context);
      case 'invoke_vp':
        return this.executeInvokeVPAction(config, context);
      default:
        // For actions without built-in handlers, return a placeholder
        return { executed: true, type: config.type };
    }
  }

  private async executeDelayAction(
    config: DelayConfig,
    _context: ExecutionContext,
  ): Promise<{ delayed: number }> {
    let durationMs = config.duration;

    // Convert to milliseconds based on unit
    switch (config.unit) {
      case 's':
        durationMs *= 1000;
        break;
      case 'm':
        durationMs *= 60000;
        break;
      case 'h':
        durationMs *= 3600000;
        break;
      case 'd':
        durationMs *= 86400000;
        break;
      default:
        // 'ms' or undefined - use as-is
        break;
    }

    // Cap at max execution time
    durationMs = Math.min(durationMs, this.maxExecutionTimeMs);

    await this.sleep(durationMs);
    return { delayed: durationMs };
  }

  private async executeConditionAction(
    config: ConditionConfig,
    context: ExecutionContext,
  ): Promise<{ matched: boolean; branch: string }> {
    const allMatch = this.evaluateConditions(config.conditions, context);

    if (allMatch) {
      // Execute then actions
      const thenActionIds = new Set(config.thenActions);
      const thenActions = context.workflow.actions.filter((a) =>
        thenActionIds.has(a.id),
      );
      await this.executeActions(thenActions, context);
      return { matched: true, branch: 'then' };
    } else if (config.elseActions) {
      // Execute else actions
      const elseActionIds = new Set(config.elseActions);
      const elseActions = context.workflow.actions.filter((a) =>
        elseActionIds.has(a.id),
      );
      await this.executeActions(elseActions, context);
      return { matched: false, branch: 'else' };
    }

    return { matched: false, branch: 'none' };
  }

  private executeSetVariableAction(
    config: SetVariableConfig,
    context: ExecutionContext,
  ): SetVariableActionResult {
    let value: WorkflowVariableValue = config.value as WorkflowVariableValue;

    if (config.expression) {
      // Simple expression evaluation (in real impl, use a safe evaluator)
      const interpolated = this.interpolateTemplate(config.expression, context);
      // Convert interpolated string to appropriate type
      value = typeof interpolated === 'string' ? interpolated : String(interpolated);
    }

    context.variables[config.name] = value;
    return { name: config.name, value };
  }

  /**
   * Executes a loop action over a collection.
   *
   * @param config - Loop configuration with collection path and actions
   * @param action - The workflow action being executed
   * @param context - Execution context with workflow state
   * @returns Loop result with iteration count and action results
   */
  private async executeLoopAction(
    config: LoopConfig,
    action: WorkflowAction,
    context: ExecutionContext,
  ): Promise<LoopActionResult> {
    const collection = this.resolveVariable(config.collection, context);

    if (!Array.isArray(collection)) {
      throw new ActionExecutionError(
        action.id,
        `Loop collection is not an array: ${config.collection}`,
      );
    }

    const maxIterations = config.maxIterations ?? DEFAULT_MAX_LOOP_ITERATIONS;
    const results: ActionResult[][] = [];
    let iterations = 0;

    for (const item of collection) {
      if (iterations >= maxIterations) {
        break;
      }

      // Check for cancellation
      if (!this.activeExecutions.get(context.execution.id)) {
        break;
      }

      // Set item variable
      context.variables[config.itemVariable] = item;

      // Execute loop actions
      const actionIds = new Set(config.actions);
      const loopActions = context.workflow.actions.filter((a) =>
        actionIds.has(a.id),
      );

      const loopResults = await this.executeActions(loopActions, context);
      results.push(loopResults);
      iterations++;
    }

    return { iterations, results };
  }

  private executeSendMessageAction(
    config: SendMessageConfig,
    context: ExecutionContext,
  ): { channelId: string; message: string } {
    const channelId = this.interpolateTemplate(config.channelId, context);
    const message = this.interpolateTemplate(config.message, context);

    // In real implementation, this would call the message service
    return { channelId, message };
  }

  private executeSendDMAction(
    config: SendDMConfig,
    context: ExecutionContext,
  ): { userId: string; message: string } {
    const userId = this.interpolateTemplate(config.userId, context);
    const message = this.interpolateTemplate(config.message, context);

    // In real implementation, this would call the message service
    return { userId, message };
  }

  private async executeWebhookAction(
    config: WebhookActionConfig,
    context: ExecutionContext,
  ): Promise<{ status: number; body: string; url: string; timeout: number; requestBody?: string }> {
    const url = this.interpolateTemplate(config.url, context);
    const timeout = Math.min(
      config.timeout ?? MAX_WEBHOOK_TIMEOUT_MS,
      MAX_WEBHOOK_TIMEOUT_MS,
    );

    let requestBody: string | undefined;
    if (config.body) {
      if (typeof config.body === 'string') {
        requestBody = this.interpolateTemplate(config.body, context);
      } else {
        requestBody = JSON.stringify(config.body);
      }
    }

    // In real implementation, this would make the actual HTTP request
    // For now, return a mock response with the prepared values
    return {
      status: 200,
      body: JSON.stringify({ success: true }),
      url,
      timeout,
      requestBody,
    };
  }

  private async executeInvokeVPAction(
    config: InvokeVPConfig,
    context: ExecutionContext,
  ): Promise<{ orchestratorId: string; prompt: string; response?: string }> {
    const orchestratorId = this.interpolateTemplate(config.orchestratorId, context);
    const prompt = this.interpolateTemplate(config.prompt, context);

    // In real implementation, this would call the Orchestrator service
    // For now, return a mock response
    return {
      orchestratorId,
      prompt,
      response: config.waitForResponse ? 'Mock Orchestrator response' : undefined,
    };
  }

  private evaluateConditions(
    conditions: WorkflowCondition[],
    context: ExecutionContext,
  ): boolean {
    if (conditions.length === 0) {
      return true;
    }

    let result = this.evaluateCondition(conditions[0]!, context);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i]!;
      const conditionResult = this.evaluateCondition(condition, context);

      if (condition.logicalOperator === 'OR') {
        result = result || conditionResult;
      } else {
        // Default to AND
        result = result && conditionResult;
      }
    }

    return result;
  }

  private resolveVariable(path: string, context: ExecutionContext): unknown {
    const parts = path.split('.');
    let current: unknown;

    // Determine root context
    const root = parts[0] ?? '';
    switch (root) {
      case 'trigger':
        current = context.triggerData;
        break;
      case 'variables':
        current = context.variables;
        break;
      case 'actions':
        current = this.buildActionResultsMap(context.actionResults);
        break;
      case 'config':
        current = context.workflow.variables?.reduce(
          (acc, v) => {
            acc[v.name] = context.variables[v.name] ?? v.defaultValue;
            return acc;
          },
          {} as Record<string, unknown>,
        );
        break;
      default:
        // Try variables first, then trigger data
        if (root) {
          current =
            context.variables[root] ??
            (context.triggerData as Record<string, unknown>)[root];
        }
        return current;
    }

    // Navigate the path
    for (let i = 1; i < parts.length && current !== undefined; i++) {
      const part = parts[i]!;
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private buildActionResultsMap(
    results: ActionResult[],
  ): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    for (const result of results) {
      map[result.actionId] = result.output;
    }
    return map;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new Workflow Service with in-memory storage.
 */
export function createWorkflowService(
  config?: Partial<WorkflowServiceConfig>,
): WorkflowServiceImpl {
  const storage = config?.storage ?? new InMemoryWorkflowStorage();
  return new WorkflowServiceImpl({
    storage,
    actionHandlers: config?.actionHandlers,
    maxExecutionTimeMs: config?.maxExecutionTimeMs,
  });
}

/**
 * Default workflow service instance.
 */
export const workflowService = createWorkflowService();
