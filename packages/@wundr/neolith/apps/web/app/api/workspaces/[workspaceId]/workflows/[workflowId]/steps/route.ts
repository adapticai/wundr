/**
 * Workflow Steps API Routes
 *
 * Handles workflow step operations: listing, adding, and reordering steps.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/:workflowId/steps - List workflow steps
 * - POST /api/workspaces/:workspaceId/workflows/:workflowId/steps - Add a new step
 * - PUT /api/workspaces/:workspaceId/workflows/:workflowId/steps - Reorder steps
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/steps/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  workflowActionTypeEnum,
  workflowConditionSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; workflowId: string }>;
}

/**
 * Step type enumeration for workflow actions
 */
const stepTypeEnum = z.enum(['ACTION', 'CONDITION', 'WAIT', 'NOTIFY']);

/**
 * Schema for creating a new workflow step
 */
const createStepSchema = z.object({
  /** Step type */
  type: stepTypeEnum,

  /** Step name */
  name: z.string().max(100).optional(),

  /** Action type for the step */
  actionType: workflowActionTypeEnum,

  /** Step configuration */
  config: z.record(z.unknown()).default({}),

  /** Position in the workflow (0-indexed) */
  position: z.number().int().min(0),

  /** Optional conditions for the step */
  conditions: z.array(workflowConditionSchema).optional().default([]),

  /** Error handling strategy */
  onError: z.enum(['stop', 'continue', 'retry']).optional().default('stop'),

  /** Retry configuration */
  retryConfig: z
    .object({
      maxRetries: z.number().int().min(0).max(5).default(3),
      delayMs: z.number().int().min(1000).max(60000).default(5000),
    })
    .optional(),
});

type CreateStepInput = z.infer<typeof createStepSchema>;

/**
 * Schema for reordering steps
 */
const reorderStepsSchema = z.object({
  /** Array of step IDs with their new positions */
  steps: z.array(
    z.object({
      /** Unique identifier for the step */
      id: z.string().min(1),
      /** New position (0-indexed) */
      position: z.number().int().min(0),
    }),
  ),
});

type ReorderStepsInput = z.infer<typeof reorderStepsSchema>;

/**
 * Workflow step interface (represents an action with ordering)
 */
interface WorkflowStep {
  id: string;
  type: 'ACTION' | 'CONDITION' | 'WAIT' | 'NOTIFY';
  name?: string;
  actionType: string;
  config: Record<string, unknown>;
  conditions?: Array<{
    field: string;
    operator: string;
    value: string | number | boolean | string[];
  }>;
  onError?: 'stop' | 'continue' | 'retry';
  retryConfig?: {
    maxRetries: number;
    delayMs: number;
  };
  order: number;
}

/**
 * Helper to check workspace access and get workflow
 */
async function getWorkflowWithAccess(
  workspaceId: string,
  workflowId: string,
  userId: string,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return { error: 'workspace_not_found' };
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return { error: 'workspace_not_found' };
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  const workflow = await prisma.workflow.findUnique({
    where: {
      id: workflowId,
      workspaceId,
    },
  });

  if (!workflow) {
    return { error: 'workflow_not_found' };
  }

  return {
    workspace,
    orgMembership,
    workspaceMembership,
    workflow,
  };
}

/**
 * GET /api/workspaces/:workspaceId/workflows/:workflowId/steps
 *
 * List all steps in a workflow, ordered by position.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and workflowId
 * @returns Array of workflow steps ordered by position
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
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, workflowId } = params;

    // Get workflow with access check
    const result = await getWorkflowWithAccess(workspaceId, workflowId, session.user.id);

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 },
        );
      }
    }

    // Parse actions from workflow
    const actions = (result.workflow?.actions as unknown as WorkflowStep[]) || [];

    // Sort by order
    const sortedSteps = actions.sort((a, b) => a.order - b.order);

    return NextResponse.json({
      steps: sortedSteps,
      total: sortedSteps.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/workflows/:workflowId/steps] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/workflows/:workflowId/steps
 *
 * Add a new step to a workflow.
 *
 * @param request - Next.js request with step data
 * @param context - Route context with workspaceId and workflowId
 * @returns Created workflow step
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

    // Get workflow with access check
    const result = await getWorkflowWithAccess(workspaceId, workflowId, session.user.id);

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 },
        );
      }
    }

    // Must be workspace member to add steps
    if (!result.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to add workflow steps',
          WORKFLOW_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
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
    const parseResult = createStepSchema.safeParse(body);
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

    const input: CreateStepInput = parseResult.data;

    // Get current actions
    const currentActions = (result.workflow.actions as unknown as WorkflowStep[]) || [];

    // Generate unique ID for the new step
    const newStepId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create new step
    const newStep: WorkflowStep = {
      id: newStepId,
      type: input.type,
      name: input.name,
      actionType: input.actionType,
      config: input.config,
      conditions: input.conditions,
      onError: input.onError,
      retryConfig: input.retryConfig,
      order: input.position,
    };

    // Insert step at the specified position and adjust other steps
    const updatedActions = [...currentActions];

    // Shift existing steps at or after the new position
    updatedActions.forEach((step) => {
      if (step.order >= input.position) {
        step.order += 1;
      }
    });

    // Add the new step
    updatedActions.push(newStep);

    // Sort by order
    updatedActions.sort((a, b) => a.order - b.order);

    // Update workflow with new actions
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        actions: updatedActions as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      {
        step: newStep,
        message: 'Workflow step added successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/workflows/:workflowId/steps] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceId/workflows/:workflowId/steps
 *
 * Reorder workflow steps by providing new positions.
 *
 * @param request - Next.js request with reordering data
 * @param context - Route context with workspaceId and workflowId
 * @returns Updated workflow steps
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
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

    // Get workflow with access check
    const result = await getWorkflowWithAccess(workspaceId, workflowId, session.user.id);

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse(
            'Workspace not found or access denied',
            WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 },
        );
      }
    }

    // Must be workspace member to reorder steps
    if (!result.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to reorder workflow steps',
          WORKFLOW_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
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
    const parseResult = reorderStepsSchema.safeParse(body);
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

    const input: ReorderStepsInput = parseResult.data;

    // Get current actions
    const currentActions = (result.workflow.actions as unknown as WorkflowStep[]) || [];

    // Create a map of step IDs to new positions
    const positionMap = new Map(input.steps.map((s) => [s.id, s.position]));

    // Validate that all step IDs exist
    const invalidIds = input.steps.filter((s) => !currentActions.some((a) => a.id === s.id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid step IDs provided',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { invalidIds: invalidIds.map((s) => s.id) },
        ),
        { status: 400 },
      );
    }

    // Validate positions are unique and sequential
    const newPositions = input.steps.map((s) => s.position).sort((a, b) => a - b);
    const expectedPositions = Array.from({ length: currentActions.length }, (_, i) => i);

    // Check if we're reordering a subset or all steps
    if (input.steps.length === currentActions.length) {
      // Reordering all steps - positions should be 0 to n-1
      const isValid = newPositions.every((pos, idx) => pos === idx);
      if (!isValid) {
        return NextResponse.json(
          createErrorResponse(
            'Positions must be sequential starting from 0',
            WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
            {
              received: newPositions,
              expected: expectedPositions,
            },
          ),
          { status: 400 },
        );
      }
    }

    // Update positions for specified steps
    const updatedActions = currentActions.map((step) => {
      const newPosition = positionMap.get(step.id);
      if (newPosition !== undefined) {
        return { ...step, order: newPosition };
      }
      return step;
    });

    // Sort by new order
    updatedActions.sort((a, b) => a.order - b.order);

    // Update workflow with reordered actions
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        actions: updatedActions as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      steps: updatedActions,
      message: 'Workflow steps reordered successfully',
    });
  } catch (error) {
    console.error('[PUT /api/workspaces/:workspaceId/workflows/:workflowId/steps] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
