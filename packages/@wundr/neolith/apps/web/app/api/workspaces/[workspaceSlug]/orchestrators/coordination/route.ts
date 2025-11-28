/**
 * Workspace OrchestratorCoordination API Routes
 *
 * Manages workspace-level Orchestrator coordination activities including multi-Orchestrator tasks
 * and coordination history tracking.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/coordination - Get all coordination activities
 * - POST /api/workspaces/:workspaceId/orchestrators/coordination - Create multi-Orchestrator task
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/coordination/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { OrchestratorCoordinationMetadata } from '@/lib/services/orchestrator-coordination-service';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Schema for creating multi-Orchestrator task
 */
const createMultiOrchestratorTaskSchema = z.object({
  /** Primary OrchestratorID for the task */
  primaryOrchestratorId: z.string().cuid('Invalid primary OrchestratorID'),

  /** Additional OrchestratorIDs required for consensus */
  requiredOrchestratorIds: z
    .array(z.string().cuid('Invalid OrchestratorID'))
    .min(1, 'At least one additional Orchestrator required'),

  /** Task details */
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),

  /** Task priority */
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),

  /** Optional due date */
  dueDate: z.string().datetime('Invalid datetime format').optional(),

  /** Consensus threshold (percentage of Orchestrators that must agree) */
  consensusThreshold: z.number().min(50).max(100).default(100),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Helper function to verify workspace access
 */
async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<{ success: boolean; organizationId?: string; error?: string }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return { success: false, error: 'Workspace not found' };
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) {
    return { success: false, error: 'Access denied to workspace' };
  }

  return { success: true, organizationId: workspace.organizationId };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/coordination
 *
 * Get all Orchestrator coordination activities in the workspace.
 * Returns delegations, collaborations, handoffs, and multi-Orchestrator tasks.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns Coordination activities summary
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Authentication required',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const activityType = searchParams.get('type'); // 'delegations', 'collaborations', 'handoffs', 'all'
    const orchestratorId = searchParams.get('orchestratorId'); // Optional filter by specific Orchestrator

    // Fetch all tasks with coordination metadata in this workspace
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        metadata: {
          not: { equals: {} },
        },
      },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            discipline: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Process tasks to extract coordination activities
    const delegations: Array<{
      taskId: string;
      taskTitle: string;
      fromOrchestratorId: string;
      toOrchestratorId: string;
      delegatedAt: string;
      note?: string;
    }> = [];

    const collaborations: Array<{
      taskId: string;
      taskTitle: string;
      primaryOrchestratorId: string;
      collaborators: Array<{ orchestratorId: string; role: string; addedAt: string }>;
    }> = [];

    const handoffs: Array<{
      taskId: string;
      taskTitle: string;
      fromOrchestratorId: string;
      toOrchestratorId: string;
      handoffAt: string;
      context: Record<string, unknown>;
    }> = [];

    tasks.forEach((task) => {
      const metadata = task.metadata as OrchestratorCoordinationMetadata;

      // Extract delegations
      if (metadata.delegations) {
        metadata.delegations.forEach((delegation) => {
          if (!orchestratorId || delegation.fromOrchestratorId === orchestratorId || delegation.toOrchestratorId === orchestratorId) {
            delegations.push({
              taskId: task.id,
              taskTitle: task.title,
              fromOrchestratorId: delegation.fromOrchestratorId,
              toOrchestratorId: delegation.toOrchestratorId,
              delegatedAt: delegation.delegatedAt,
              note: delegation.note,
            });
          }
        });
      }

      // Extract collaborations
      if (metadata.collaborators && metadata.collaborators.length > 0) {
        if (!orchestratorId || metadata.collaborators.some((c) => c.orchestratorId === orchestratorId) || task.orchestratorId === orchestratorId) {
          collaborations.push({
            taskId: task.id,
            taskTitle: task.title,
            primaryOrchestratorId: task.orchestratorId,
            collaborators: metadata.collaborators,
          });
        }
      }

      // Extract handoffs
      if (metadata.handoffs) {
        metadata.handoffs.forEach((handoff) => {
          if (!orchestratorId || handoff.fromOrchestratorId === orchestratorId || handoff.toOrchestratorId === orchestratorId) {
            handoffs.push({
              taskId: task.id,
              taskTitle: task.title,
              fromOrchestratorId: handoff.fromOrchestratorId,
              toOrchestratorId: handoff.toOrchestratorId,
              handoffAt: handoff.handoffAt,
              context: handoff.context,
            });
          }
        });
      }
    });

    // Filter by activity type if specified
    let responseData: unknown;
    if (activityType === 'delegations') {
      responseData = { delegations, count: delegations.length };
    } else if (activityType === 'collaborations') {
      responseData = { collaborations, count: collaborations.length };
    } else if (activityType === 'handoffs') {
      responseData = { handoffs, count: handoffs.length };
    } else {
      responseData = {
        delegations,
        collaborations,
        handoffs,
        summary: {
          totalDelegations: delegations.length,
          totalCollaborations: collaborations.length,
          totalHandoffs: handoffs.length,
          totalCoordinationActivities: delegations.length + collaborations.length + handoffs.length,
        },
      };
    }

    return NextResponse.json({ data: responseData });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/coordination] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/coordination
 *
 * Create a multi-Orchestrator task that requires consensus or coordination.
 *
 * @param request - Next.js request with multi-Orchestrator task data
 * @param context - Route context containing workspace ID
 * @returns Created task with coordination setup
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
        createCoordinationErrorResponse(
          'Authentication required',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.FORBIDDEN,
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
        createCoordinationErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createMultiOrchestratorTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Validation failed',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const {
      primaryOrchestratorId,
      requiredOrchestratorIds,
      title,
      description,
      priority,
      dueDate,
      consensusThreshold,
      metadata: additionalMetadata,
    } = parseResult.data;

    // Verify all Orchestrators exist and belong to workspace organization
    const allOrchestratorIds = [primaryOrchestratorId, ...requiredOrchestratorIds];
    const orchestrators = await prisma.orchestrator.findMany({
      where: {
        id: { in: allOrchestratorIds },
        organizationId: accessCheck.organizationId,
      },
      select: {
        id: true,
        role: true,
        discipline: true,
        status: true,
        userId: true,
      },
    });

    if (orchestrators.length !== allOrchestratorIds.length) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Some Orchestrators not found or not in workspace organization',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Create multi-Orchestrator task with coordination metadata
    const coordinationMetadata: OrchestratorCoordinationMetadata = {
      collaborators: requiredOrchestratorIds.map((orchestratorId) => ({
        orchestratorId,
        role: 'collaborator',
        addedAt: new Date().toISOString(),
      })),
    };

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        priority,
        status: 'TODO',
        workspaceId,
        orchestratorId: primaryOrchestratorId,
        createdById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        metadata: {
          ...coordinationMetadata,
          ...additionalMetadata,
          consensusRequired: true,
          consensusThreshold,
          consensusStatus: 'PENDING',
        } as never,
      },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            discipline: true,
          },
        },
      },
    });

    // Create notifications for all required Orchestrators
    const primaryOrchestrator = orchestrators.find((orchestrator) => orchestrator.id === primaryOrchestratorId);
    await Promise.all(
      requiredOrchestratorIds.map((orchestratorId) => {
        const orchestrator = orchestrators.find((v) => v.id === orchestratorId);
        if (!orchestrator) {
return Promise.resolve();
}

        return prisma.notification.create({
          data: {
            userId: orchestrator.userId,
            type: 'SYSTEM',
            title: 'New Multi-Orchestrator Task',
            body: `${primaryOrchestrator?.role || 'An Orchestrator'} has created a multi-Orchestrator task requiring your participation: ${title}`,
            priority: 'HIGH',
            resourceId: task.id,
            resourceType: 'task',
            metadata: {
              taskId: task.id,
              primaryOrchestratorId,
              consensusThreshold,
              createdAt: new Date().toISOString(),
              notificationType: 'MULTI_ORCHESTRATOR_TASK',
            },
            read: false,
          },
        });
      }),
    );

    return NextResponse.json({
      data: {
        task,
        coordination: {
          primaryOrchestrator: orchestrators.find((orchestrator) => orchestrator.id === primaryOrchestratorId),
          requiredOrchestrators: orchestrators.filter((orchestrator) => requiredOrchestratorIds.includes(orchestrator.id)),
          consensusThreshold,
          status: 'PENDING',
        },
      },
      message: 'Multi-Orchestrator task created successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/orchestrators/coordination] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
