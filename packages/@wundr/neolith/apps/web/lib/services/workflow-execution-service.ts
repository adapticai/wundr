/**
 * Workflow Execution Service
 *
 * Provides comprehensive workflow execution capabilities including:
 * - Action execution with proper handlers
 * - Step-by-step logging
 * - Execution streaming
 * - Error handling and retry logic
 * - Timeout management
 * - Execution cancellation
 *
 * @module lib/services/workflow-execution-service
 */

import { prisma } from '@neolith/database';

import type {
  WorkflowAction,
  WorkflowStepResult,
} from '@/lib/validations/workflow';
import type { Prisma } from '@neolith/database';

/**
 * Execution context passed to action handlers
 */
export interface ExecutionContext {
  workspaceId: string;
  workflowId: string;
  executionId: string;
  triggerData: Record<string, unknown>;
  previousStepResults: WorkflowStepResult[];
  userId: string;
}

/**
 * Action handler function type
 */
export type ActionHandler = (
  action: WorkflowAction,
  context: ExecutionContext,
) => Promise<{
  success: boolean;
  output?: unknown;
  error?: string;
}>;

/**
 * Execution progress callback
 */
export type ProgressCallback = (step: WorkflowStepResult) => void | Promise<void>;

/**
 * Cancellation signal
 */
export interface CancellationSignal {
  isCancelled: boolean;
}

/**
 * Action handlers registry
 */
const actionHandlers = new Map<string, ActionHandler>();

/**
 * Register an action handler
 */
export function registerActionHandler(
  actionType: string,
  handler: ActionHandler,
): void {
  actionHandlers.set(actionType, handler);
}

/**
 * Get action handler for a type
 */
function getActionHandler(actionType: string): ActionHandler {
  const handler = actionHandlers.get(actionType);
  if (handler) {
    return handler;
  }

  // Return default handler if no specific handler is registered
  return defaultActionHandler;
}

/**
 * Default action handler (simulation)
 */
async function defaultActionHandler(
  action: WorkflowAction,
  context: ExecutionContext,
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  // Simulate action execution
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    success: true,
    output: {
      executed: true,
      actionType: action.type,
      config: action.config,
      context: {
        workflowId: context.workflowId,
        executionId: context.executionId,
        stepNumber: context.previousStepResults.length + 1,
      },
    },
  };
}

/**
 * Execute a single action with timeout and retry logic
 */
async function executeAction(
  action: WorkflowAction,
  context: ExecutionContext,
  cancellationSignal: CancellationSignal,
): Promise<WorkflowStepResult> {
  const actionId = action.id ?? `action-${context.previousStepResults.length}`;
  const startedAt = new Date();

  // Check for cancellation
  if (cancellationSignal.isCancelled) {
    return {
      actionId,
      actionType: action.type,
      status: 'skipped',
      error: 'Execution cancelled',
      startedAt,
      completedAt: new Date(),
      durationMs: 0,
    };
  }

  const handler = getActionHandler(action.type);
  const timeout = action.timeout ?? 30000; // Default 30s timeout
  const maxRetries = action.onError === 'retry' ? 3 : 0;

  let lastError: string | undefined;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      // Execute with timeout
      const result = await Promise.race([
        handler(action, context),
        new Promise<{ success: false; error: string }>((_, reject) =>
          setTimeout(
            () => reject(new Error('Action execution timeout')),
            timeout,
          ),
        ),
      ]);

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      if (result.success) {
        return {
          actionId,
          actionType: action.type,
          status: 'success',
          output: result.output,
          startedAt,
          completedAt,
          durationMs,
        };
      } else {
        lastError = result.error ?? 'Unknown error';
        if (action.onError !== 'retry' || retryCount >= maxRetries) {
          throw new Error(lastError);
        }
        retryCount++;
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000),
        );
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : 'Unknown error occurred';

      if (retryCount >= maxRetries) {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        return {
          actionId,
          actionType: action.type,
          status: 'failed',
          error: lastError,
          startedAt,
          completedAt,
          durationMs,
        };
      }

      retryCount++;
      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000),
      );
    }
  }

  // This should never be reached, but TypeScript needs it
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  return {
    actionId,
    actionType: action.type,
    status: 'failed',
    error: lastError ?? 'Max retries exceeded',
    startedAt,
    completedAt,
    durationMs,
  };
}

/**
 * Execute workflow actions with progress tracking
 */
export async function executeWorkflowActions(
  actions: WorkflowAction[],
  context: Omit<ExecutionContext, 'previousStepResults'>,
  onProgress?: ProgressCallback,
  cancellationSignal?: CancellationSignal,
): Promise<{
  steps: WorkflowStepResult[];
  success: boolean;
  error?: string;
}> {
  const steps: WorkflowStepResult[] = [];
  const signal = cancellationSignal ?? { isCancelled: false };
  let success = true;
  let error: string | undefined;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const executionContext: ExecutionContext = {
      ...context,
      previousStepResults: steps,
    };

    // Execute action
    const stepResult = await executeAction(action, executionContext, signal);
    steps.push(stepResult);

    // Call progress callback
    if (onProgress) {
      await onProgress(stepResult);
    }

    // Update execution in database with current progress
    await prisma.workflowExecution.update({
      where: { id: context.executionId },
      data: {
        steps: steps as unknown as Prisma.InputJsonValue,
        status: signal.isCancelled ? 'CANCELLED' : 'RUNNING',
      },
    });

    // Handle execution errors
    if (stepResult.status === 'failed') {
      if (action.onError === 'stop') {
        success = false;
        error = stepResult.error ?? 'Step execution failed';
        break;
      }
      // If onError is 'continue', we keep going
    }

    // Check for cancellation
    if (signal.isCancelled) {
      success = false;
      error = 'Execution cancelled by user';
      break;
    }
  }

  return { steps, success, error };
}

/**
 * Create a new workflow execution record
 */
export async function createExecutionRecord(params: {
  workflowId: string;
  workspaceId: string;
  triggeredBy: string;
  triggerType: string;
  triggerData: Record<string, unknown>;
  isSimulation?: boolean;
}): Promise<string> {
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: params.workflowId,
      workspaceId: params.workspaceId,
      status: 'RUNNING',
      triggeredBy: params.triggeredBy,
      triggerType: params.triggerType,
      triggerData: params.triggerData as Prisma.InputJsonValue,
      steps: [] as unknown as Prisma.InputJsonValue,
      startedAt: new Date(),
      isSimulation: params.isSimulation ?? false,
    },
  });

  return execution.id;
}

/**
 * Complete a workflow execution
 */
export async function completeExecution(params: {
  executionId: string;
  success: boolean;
  steps: WorkflowStepResult[];
  error?: string;
}): Promise<void> {
  const completedAt = new Date();

  const execution = await prisma.workflowExecution.findUnique({
    where: { id: params.executionId },
  });

  if (!execution) {
    throw new Error('Execution not found');
  }

  const durationMs = completedAt.getTime() - execution.startedAt.getTime();

  await prisma.workflowExecution.update({
    where: { id: params.executionId },
    data: {
      status: params.success ? 'COMPLETED' : 'FAILED',
      steps: params.steps as unknown as Prisma.InputJsonValue,
      error: params.error,
      completedAt,
      durationMs,
    },
  });

  // Update workflow statistics
  if (execution.workflowId) {
    await prisma.workflow.update({
      where: { id: execution.workflowId },
      data: {
        lastExecutedAt: execution.startedAt,
        executionCount: { increment: 1 },
        ...(params.success
          ? { successCount: { increment: 1 } }
          : { failureCount: { increment: 1 } }),
      },
    });
  }
}

/**
 * Cancel a running execution
 */
export async function cancelExecution(executionId: string): Promise<void> {
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
      error: 'Cancelled by user',
    },
  });
}

// =============================================================================
// BUILT-IN ACTION HANDLERS
// =============================================================================

/**
 * Send notification action handler
 */
registerActionHandler(
  'send_notification',
  async (action: WorkflowAction, context: ExecutionContext) => {
    const { config } = action;

    // Validate required config
    if (!config?.message) {
      return { success: false, error: 'Message is required' };
    }

    // Here you would integrate with your notification service
    // For now, we'll simulate it
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      output: {
        notificationSent: true,
        message: config.message,
        recipient: config.recipient ?? context.userId,
        timestamp: new Date().toISOString(),
      },
    };
  },
);

/**
 * Call API action handler
 */
registerActionHandler(
  'call_api',
  async (action: WorkflowAction, _context: ExecutionContext) => {
    const { config } = action;

    // Validate required config
    if (!config?.url) {
      return { success: false, error: 'URL is required' };
    }

    try {
      const method = (config.method as string) ?? 'GET';
      const headers = (config.headers as Record<string, string>) ?? {};
      const body = config.body;

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };
      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }
      const response = await fetch(config.url as string, fetchOptions);

      const data = await response.json();

      return {
        success: response.ok,
        output: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
        error: response.ok ? undefined : `API call failed: ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'API call failed',
      };
    }
  },
);

/**
 * Wait action handler
 */
registerActionHandler(
  'wait',
  async (action: WorkflowAction, _context: ExecutionContext) => {
    const { config } = action;
    const durationMs = (config?.durationMs as number) ?? 1000;

    await new Promise(resolve => setTimeout(resolve, durationMs));

    return {
      success: true,
      output: {
        waited: true,
        durationMs,
      },
    };
  },
);

/**
 * Create task action handler
 */
registerActionHandler(
  'create_task',
  async (action: WorkflowAction, context: ExecutionContext) => {
    const { config } = action;

    // Validate required config
    if (!config?.title) {
      return { success: false, error: 'Task title is required' };
    }

    try {
      // Get default orchestrator for the workspace (for workflow-created tasks)
      const orchestrator = await prisma.orchestrator.findFirst({
        where: { workspaceId: context.workspaceId },
        select: { id: true },
      });

      if (!orchestrator) {
        return { success: false, error: 'No orchestrator available in workspace to create task' };
      }

      // Create task in database
      const task = await prisma.task.create({
        data: {
          title: config.title as string,
          description: (config.description as string) ?? '',
          status: 'TODO',
          priority: (config.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') ?? 'MEDIUM',
          workspaceId: context.workspaceId,
          orchestratorId: (config.orchestratorId as string) ?? orchestrator.id,
          assignedToId: (config.assignedTo as string) ?? context.userId,
          createdById: context.userId,
        },
      });

      return {
        success: true,
        output: {
          taskId: task.id,
          title: task.title,
          status: task.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create task',
      };
    }
  },
);

/**
 * Condition action handler
 */
registerActionHandler(
  'condition',
  async (action: WorkflowAction, context: ExecutionContext) => {
    const { config } = action;

    // Evaluate condition
    const field = config?.field as string;
    const operator = config?.operator as string;
    const value = config?.value;

    if (!field || !operator) {
      return { success: false, error: 'Field and operator are required' };
    }

    // Get field value from trigger data or previous steps
    let fieldValue: unknown;
    if (field.startsWith('trigger.')) {
      const fieldPath = field.substring(8);
      fieldValue = context.triggerData[fieldPath];
    } else if (field.startsWith('step.')) {
      const [, stepIndex, stepField] = field.split('.');
      const stepResult = context.previousStepResults[parseInt(stepIndex)];
      fieldValue = stepResult?.output
        ? (stepResult.output as Record<string, unknown>)[stepField]
        : undefined;
    }

    // Evaluate condition
    let conditionMet = false;
    switch (operator) {
      case 'equals':
        conditionMet = fieldValue === value;
        break;
      case 'not_equals':
        conditionMet = fieldValue !== value;
        break;
      case 'greater_than':
        conditionMet =
          typeof fieldValue === 'number' &&
          typeof value === 'number' &&
          fieldValue > value;
        break;
      case 'less_than':
        conditionMet =
          typeof fieldValue === 'number' &&
          typeof value === 'number' &&
          fieldValue < value;
        break;
      case 'contains':
        conditionMet =
          typeof fieldValue === 'string' &&
          typeof value === 'string' &&
          fieldValue.includes(value);
        break;
      case 'exists':
        conditionMet = fieldValue !== undefined && fieldValue !== null;
        break;
      default:
        return { success: false, error: `Unknown operator: ${operator}` };
    }

    return {
      success: true,
      output: {
        conditionMet,
        field,
        operator,
        value,
        actualValue: fieldValue,
      },
    };
  },
);
