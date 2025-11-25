/**
 * Workflow Execute API Route
 *
 * Handles manually executing a workflow.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/workflows/:workflowId/execute - Execute workflow
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/execute/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  executeWorkflowSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { ExecuteWorkflowInput, WorkflowExecution, WorkflowStepResult, WorkflowAction, WorkflowTrigger } from '@/lib/validations/workflow';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; workflowId: string }>;
}

/**
 * Execute workflow actions (simplified simulation)
 */
async function executeWorkflowActions(
  actions: WorkflowAction[],
  triggerData: Record<string, unknown>,
  _workspaceId: string,
): Promise<{ steps: WorkflowStepResult[]; success: boolean; error?: string }> {
  const steps: WorkflowStepResult[] = [];
  let success = true;
  let error: string | undefined;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const startedAt = new Date();

    try {
      // Simulate action execution with context
      // In a real implementation, this would call the actual action handlers
      const stepResult: WorkflowStepResult = {
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: 'success',
        output: {
          executed: true,
          config: action.config,
          triggerData,
        },
        startedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - startedAt.getTime(),
      };

      steps.push(stepResult);
    } catch (err) {
      const stepError = err instanceof Error ? err.message : 'Unknown error';
      steps.push({
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: 'failed',
        error: stepError,
        startedAt,
        completedAt: new Date(),
        durationMs: new Date().getTime() - startedAt.getTime(),
      });

      if (action.onError === 'stop') {
        success = false;
        error = stepError;
        break;
      }
    }
  }

  return { steps, success, error };
}

/**
 * POST /api/workspaces/:workspaceId/workflows/:workflowId/execute
 *
 * Manually execute a workflow.
 *
 * @param request - Next.js request object with optional trigger data
 * @param context - Route context with workspaceId and workflowId
 * @returns Workflow execution result
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, workflowId } = params;

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

    // Check workspace membership
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse('You must be a workspace member to execute workflows', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get workflow
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: workflowId,
        workspaceId,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if workflow is active
    if (workflow.status !== 'ACTIVE') {
      return NextResponse.json(
        createErrorResponse('Only active workflows can be executed', WORKFLOW_ERROR_CODES.WORKFLOW_INACTIVE),
        { status: 400 },
      );
    }

    // Parse request body
    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is allowed
    }

    // Validate input
    const parseResult = executeWorkflowSchema.safeParse(body);
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

    const input: ExecuteWorkflowInput = parseResult.data;
    const triggerData = input.triggerData ?? {};

    // Start execution timing
    const startedAt = new Date();

    // Create execution record
    const trigger = workflow.trigger as unknown as WorkflowTrigger;
    const actions = workflow.actions as unknown as WorkflowAction[];

    // Execute workflow actions
    const { steps, success, error } = await executeWorkflowActions(
      actions,
      triggerData,
      workspaceId,
    );

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Create execution record in database
    const executionRecord = await prisma.workflowExecution.create({
      data: {
        workflowId,
        workspaceId,
        status: success ? 'COMPLETED' : 'FAILED',
        triggeredBy: session.user.id,
        triggerType: trigger.type,
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

    // Format response
    const execution: WorkflowExecution = {
      id: executionRecord.id,
      workflowId: executionRecord.workflowId,
      workspaceId: executionRecord.workspaceId,
      status: executionRecord.status as WorkflowExecution['status'],
      triggeredBy: executionRecord.triggeredBy,
      triggerType: executionRecord.triggerType as WorkflowExecution['triggerType'],
      triggerData: executionRecord.triggerData as Record<string, unknown>,
      steps: executionRecord.steps as unknown as WorkflowStepResult[],
      error: executionRecord.error ?? undefined,
      startedAt: executionRecord.startedAt,
      completedAt: executionRecord.completedAt ?? undefined,
      durationMs: executionRecord.durationMs ?? undefined,
      isSimulation: executionRecord.isSimulation,
    };

    return NextResponse.json({ execution });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/workflows/:workflowId/execute] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
