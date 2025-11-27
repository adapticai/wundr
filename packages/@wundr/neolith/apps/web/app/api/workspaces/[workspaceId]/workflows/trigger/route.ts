/**
 * Workflow Trigger API Route
 *
 * Handles triggering workflows by event (internal API for other services).
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/workflows/trigger - Trigger workflows by event
 *
 * @module app/api/workspaces/[workspaceId]/workflows/trigger/route
 */

import { prisma } from '@neolith/database';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { TriggerWorkflowsInput, WorkflowAction, WorkflowStepResult, WorkflowTrigger } from '@/lib/validations/workflow';
import {
  createErrorResponse,
  triggerWorkflowsSchema,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

/**
 * Route context with workspaceId parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Check if trigger conditions are met
 */
function checkTriggerConditions(
  trigger: WorkflowTrigger,
  eventData: Record<string, unknown>,
): boolean {
  if (!trigger.conditions || trigger.conditions.length === 0) {
    return true;
  }

  for (const condition of trigger.conditions) {
    const fieldValue = getNestedValue(eventData, condition.field);

    switch (condition.operator) {
      case 'equals':
        if (fieldValue !== condition.value) {
return false;
}
        break;
      case 'not_equals':
        if (fieldValue === condition.value) {
return false;
}
        break;
      case 'contains':
        if (typeof fieldValue !== 'string' || !fieldValue.includes(String(condition.value))) {
return false;
}
        break;
      case 'not_contains':
        if (typeof fieldValue === 'string' && fieldValue.includes(String(condition.value))) {
return false;
}
        break;
      case 'greater_than':
        if (typeof fieldValue !== 'number' || fieldValue <= Number(condition.value)) {
return false;
}
        break;
      case 'less_than':
        if (typeof fieldValue !== 'number' || fieldValue >= Number(condition.value)) {
return false;
}
        break;
      case 'exists':
        if (fieldValue === undefined || fieldValue === null) {
return false;
}
        break;
      case 'not_exists':
        if (fieldValue !== undefined && fieldValue !== null) {
return false;
}
        break;
      case 'in':
        if (!Array.isArray(condition.value) || !condition.value.includes(fieldValue as string)) {
return false;
}
        break;
      case 'not_in':
        if (Array.isArray(condition.value) && condition.value.includes(fieldValue as string)) {
return false;
}
        break;
      default:
        break;
    }
  }

  return true;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Check if event matches trigger filters
 */
function checkTriggerFilters(
  trigger: WorkflowTrigger,
  eventData: Record<string, unknown>,
): boolean {
  if (!trigger.filters) {
    return true;
  }

  const { channelIds, userIds, orchestratorIds } = trigger.filters;

  // Check channel filter
  if (channelIds && channelIds.length > 0) {
    const eventChannelId = eventData.channelId as string | undefined;
    if (!eventChannelId || !channelIds.includes(eventChannelId)) {
      return false;
    }
  }

  // Check user filter
  if (userIds && userIds.length > 0) {
    const eventUserId = eventData.userId as string | undefined;
    if (!eventUserId || !userIds.includes(eventUserId)) {
      return false;
    }
  }

  // Check Orchestrator filter
  if (orchestratorIds && orchestratorIds.length > 0) {
    const eventOrchestratorId = eventData.orchestratorId as string | undefined;
    if (!eventOrchestratorId || !orchestratorIds.includes(eventOrchestratorId)) {
      return false;
    }
  }

  return true;
}

/**
 * Execute a single workflow
 */
async function executeWorkflow(
  workflowId: string,
  workspaceId: string,
  triggerType: string,
  triggerData: Record<string, unknown>,
  triggeredBy: string,
): Promise<{ executionId: string; success: boolean }> {
  const startedAt = new Date();

  // Get workflow
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const actions = workflow.actions as unknown as WorkflowAction[];

  // Execute actions (simplified)
  const steps: WorkflowStepResult[] = [];
  let success = true;
  let error: string | undefined;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionStartedAt = new Date();

    try {
      // Simulate action execution
      // In a real implementation, this would call the actual action handlers
      steps.push({
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: 'success',
        output: { executed: true },
        startedAt: actionStartedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - actionStartedAt.getTime(),
      });
    } catch (err) {
      const stepError = err instanceof Error ? err.message : 'Unknown error';
      steps.push({
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: 'failed',
        error: stepError,
        startedAt: actionStartedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - actionStartedAt.getTime(),
      });

      if (action.onError === 'stop') {
        success = false;
        error = stepError;
        break;
      }
    }
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      workspaceId,
      status: success ? 'COMPLETED' : 'FAILED',
      triggeredBy,
      triggerType,
      triggerData: triggerData as Prisma.InputJsonValue,
      steps: steps as unknown as Prisma.InputJsonValue,
      error,
      startedAt,
      completedAt,
      durationMs,
      isSimulation: false,
    },
  });

  // Update workflow stats
  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      lastExecutedAt: startedAt,
      executionCount: { increment: 1 },
      ...(success ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
    },
  });

  return { executionId: execution.id, success };
}

/**
 * POST /api/workspaces/:workspaceId/workflows/trigger
 *
 * Trigger workflows by event. This is an internal API called by other services
 * when events occur (e.g., message created, member joined, etc.).
 *
 * @param request - Next.js request object with event type and data
 * @param context - Route context with workspaceId
 * @returns List of triggered workflow executions
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (internal services should also authenticate)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', WORKFLOW_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = triggerWorkflowsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: TriggerWorkflowsInput = parseResult.data;

    // Find active workflows that match the trigger type
    const workflows = await prisma.workflow.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        trigger: {
          path: ['type'],
          equals: input.event,
        },
      },
    });

    // Filter workflows based on conditions and filters
    const matchingWorkflows = workflows.filter((workflow) => {
      const trigger = workflow.trigger as unknown as WorkflowTrigger;
      return checkTriggerConditions(trigger, input.data) && checkTriggerFilters(trigger, input.data);
    });

    // Execute matching workflows
    const executions: string[] = [];
    const executionPromises = matchingWorkflows.map(async (workflow) => {
      try {
        const result = await executeWorkflow(
          workflow.id,
          workspaceId,
          input.event,
          input.data,
          session.user.id,
        );
        executions.push(result.executionId);
      } catch {
        // Silently continue on workflow execution errors to allow partial success
      }
    });

    await Promise.all(executionPromises);

    return NextResponse.json({
      triggered: executions.length,
      executions,
      message: `Triggered ${executions.length} workflow(s)`,
    });
  } catch (_error) {
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
