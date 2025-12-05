/**
 * Workflow Execute API Route
 *
 * Handles manually executing a workflow and retrieving execution status.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/workflows/:workflowId/execute - Execute workflow
 * - GET /api/workspaces/:workspaceId/workflows/:workflowId/execute - Get latest execution status
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/execute/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  executeWorkflowActions,
  createExecutionRecord,
  completeExecution,
} from '@/lib/services/workflow-execution-service';
import {
  executeWorkflowSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type {
  ExecuteWorkflowInput,
  WorkflowExecution,
  WorkflowAction,
  WorkflowTrigger,
  WorkflowStepResult,
} from '@/lib/validations/workflow';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; workflowId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/workflows/:workflowId/execute
 *
 * Get the latest execution status for a workflow.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and workflowId
 * @returns Latest workflow execution status
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
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
        createErrorResponse(
          'Workspace not found or access denied',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
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
        createErrorResponse(
          'Workflow not found',
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get the latest execution
    const latestExecution = await prisma.workflowExecution.findFirst({
      where: {
        workflowId,
        workspaceId,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!latestExecution) {
      return NextResponse.json({
        execution: null,
        message: 'No executions found for this workflow',
      });
    }

    // Format response with execution details
    const execution: WorkflowExecution = {
      id: latestExecution.id,
      workflowId: latestExecution.workflowId,
      workspaceId: latestExecution.workspaceId,
      status: latestExecution.status as WorkflowExecution['status'],
      triggeredBy: latestExecution.triggeredBy,
      triggerType:
        latestExecution.triggerType as WorkflowExecution['triggerType'],
      triggerData: latestExecution.triggerData as Record<string, unknown>,
      steps: latestExecution.steps as unknown as WorkflowStepResult[],
      error: latestExecution.error ?? undefined,
      startedAt: latestExecution.startedAt,
      completedAt: latestExecution.completedAt ?? undefined,
      durationMs: latestExecution.durationMs ?? undefined,
      isSimulation: latestExecution.isSimulation,
    };

    // Calculate progress metrics
    const steps = execution.steps || [];
    const totalSteps = steps.length;
    const completedSteps = steps.filter(
      s => s.status === 'success' || s.status === 'failed',
    ).length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;

    return NextResponse.json({
      execution,
      progress: {
        totalSteps,
        completedSteps,
        failedSteps,
        percentage:
          totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/workflows/:workflowId/execute] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
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
        createErrorResponse(
          'Authentication required',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
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
        createErrorResponse(
          'Workspace not found or access denied',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
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
        createErrorResponse(
          'You must be a workspace member to execute workflows',
          WORKFLOW_ERROR_CODES.FORBIDDEN,
        ),
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
        createErrorResponse(
          'Workflow not found',
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if workflow is active
    if (workflow.status !== 'ACTIVE') {
      return NextResponse.json(
        createErrorResponse(
          'Only active workflows can be executed',
          WORKFLOW_ERROR_CODES.WORKFLOW_INACTIVE,
        ),
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

    // Get workflow data
    const trigger = workflow.trigger as unknown as WorkflowTrigger;
    const actions = workflow.actions as unknown as WorkflowAction[];

    // Create execution record
    const executionId = await createExecutionRecord({
      workflowId,
      workspaceId,
      triggeredBy: session.user.id,
      triggerType: trigger.type,
      triggerData,
      isSimulation: false,
    });

    // Execute workflow actions with progress tracking
    const { steps, success, error } = await executeWorkflowActions(
      actions,
      {
        workspaceId,
        workflowId,
        executionId,
        triggerData,
        userId: session.user.id,
      },
      async step => {
        // Progress callback - could be used for real-time updates
        console.log(
          `[Workflow ${workflowId}] Step completed:`,
          step.actionType,
          step.status,
        );
      },
    );

    // Complete execution
    await completeExecution({
      executionId,
      success,
      steps,
      error,
    });

    // Fetch the completed execution record
    const executionRecord = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!executionRecord) {
      throw new Error('Execution record not found');
    }

    // Format response
    const execution: WorkflowExecution = {
      id: executionRecord.id,
      workflowId: executionRecord.workflowId,
      workspaceId: executionRecord.workspaceId,
      status: executionRecord.status as WorkflowExecution['status'],
      triggeredBy: executionRecord.triggeredBy,
      triggerType:
        executionRecord.triggerType as WorkflowExecution['triggerType'],
      triggerData: executionRecord.triggerData as Record<string, unknown>,
      steps: executionRecord.steps as unknown as WorkflowExecution['steps'],
      error: executionRecord.error ?? undefined,
      startedAt: executionRecord.startedAt,
      completedAt: executionRecord.completedAt ?? undefined,
      durationMs: executionRecord.durationMs ?? undefined,
      isSimulation: executionRecord.isSimulation,
    };

    return NextResponse.json({ execution });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/workflows/:workflowId/execute] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
