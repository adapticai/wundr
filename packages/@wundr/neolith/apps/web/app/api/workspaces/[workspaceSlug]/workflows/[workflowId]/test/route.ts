/**
 * Workflow Test API Route
 *
 * Handles testing a workflow with sample data (dry run).
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/workflows/:workflowId/test - Test workflow
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/test/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  testWorkflowSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type {
  TestWorkflowInput,
  WorkflowExecution,
  WorkflowStepResult,
  WorkflowAction,
  WorkflowTrigger,
} from '@/lib/validations/workflow';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; workflowId: string }>;
}

/**
 * Simulate workflow actions (dry run - no actual execution)
 */
function simulateWorkflowActions(
  actions: WorkflowAction[],
  sampleData: Record<string, unknown>
): { steps: WorkflowStepResult[]; success: boolean; error?: string } {
  const steps: WorkflowStepResult[] = [];
  let success = true;
  let error: string | undefined;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const startedAt = new Date();

    try {
      // Simulate action execution without actually performing it
      // Check conditions if any
      let conditionsMet = true;
      if (action.conditions && action.conditions.length > 0) {
        for (const condition of action.conditions) {
          const fieldValue = sampleData[condition.field];
          switch (condition.operator) {
            case 'equals':
              conditionsMet = conditionsMet && fieldValue === condition.value;
              break;
            case 'not_equals':
              conditionsMet = conditionsMet && fieldValue !== condition.value;
              break;
            case 'exists':
              conditionsMet = conditionsMet && fieldValue !== undefined;
              break;
            case 'not_exists':
              conditionsMet = conditionsMet && fieldValue === undefined;
              break;
            // Add more operators as needed
            default:
              break;
          }
        }
      }

      const stepResult: WorkflowStepResult = {
        actionId: action.id ?? `action-${i}`,
        actionType: action.type,
        status: conditionsMet ? 'success' : 'skipped',
        output: {
          simulated: true,
          wouldExecute: conditionsMet,
          config: action.config,
          sampleData,
          conditionsMet,
        },
        startedAt,
        completedAt: new Date(),
        durationMs: 0, // Simulation is instant
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
        durationMs: 0,
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
 * POST /api/workspaces/:workspaceId/workflows/:workflowId/test
 *
 * Test a workflow with sample data (dry run).
 * This simulates execution without performing actual actions.
 *
 * @param request - Next.js request object with sample data
 * @param context - Route context with workspaceId and workflowId
 * @returns Simulated workflow execution result
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          WORKFLOW_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
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
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
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
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
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
          'You must be a workspace member to test workflows',
          WORKFLOW_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
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
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = testWorkflowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: TestWorkflowInput = parseResult.data;

    // Start simulation timing
    const startedAt = new Date();

    // Get workflow configuration
    const trigger = workflow.trigger as unknown as WorkflowTrigger;
    const actions = workflow.actions as unknown as WorkflowAction[];

    // Simulate workflow actions
    const { steps, success, error } = simulateWorkflowActions(
      actions,
      input.sampleData
    );

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Create simulation record in database (marked as simulation)
    const executionRecord = await prisma.workflowExecution.create({
      data: {
        workflowId,
        workspaceId,
        status: success ? 'COMPLETED' : 'FAILED',
        triggeredBy: session.user.id,
        triggerType: trigger.type,
        triggerData: input.sampleData as Prisma.InputJsonValue,
        steps: steps as unknown as Prisma.InputJsonValue,
        error,
        startedAt,
        completedAt,
        durationMs,
        isSimulation: true,
      },
    });

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
      steps: executionRecord.steps as unknown as WorkflowStepResult[],
      error: executionRecord.error ?? undefined,
      startedAt: executionRecord.startedAt,
      completedAt: executionRecord.completedAt ?? undefined,
      durationMs: executionRecord.durationMs ?? undefined,
      isSimulation: true,
    };

    return NextResponse.json({ execution, isSimulation: true });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/workflows/:workflowId/test] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
