/**
 * Workspace VP Coordination API Routes
 *
 * Manages workspace-level VP coordination activities including multi-VP tasks
 * and coordination history tracking.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/coordination - Get all coordination activities
 * - POST /api/workspaces/:workspaceId/vps/coordination - Create multi-VP task
 *
 * @module app/api/workspaces/[workspaceId]/vps/coordination/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { VPCoordinationMetadata } from '@/lib/services/vp-coordination-service';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Schema for creating multi-VP task
 */
const createMultiVpTaskSchema = z.object({
  /** Primary VP ID for the task */
  primaryVpId: z.string().cuid('Invalid primary VP ID'),

  /** Additional VP IDs required for consensus */
  requiredVpIds: z
    .array(z.string().cuid('Invalid VP ID'))
    .min(1, 'At least one additional VP required'),

  /** Task details */
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),

  /** Task priority */
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),

  /** Optional due date */
  dueDate: z.string().datetime('Invalid datetime format').optional(),

  /** Consensus threshold (percentage of VPs that must agree) */
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
 * GET /api/workspaces/:workspaceId/vps/coordination
 *
 * Get all VP coordination activities in the workspace.
 * Returns delegations, collaborations, handoffs, and multi-VP tasks.
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
          VP_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          VP_COORDINATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const activityType = searchParams.get('type'); // 'delegations', 'collaborations', 'handoffs', 'all'
    const vpId = searchParams.get('vpId'); // Optional filter by specific VP

    // Fetch all tasks with coordination metadata in this workspace
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        metadata: {
          not: { equals: {} },
        },
      },
      include: {
        vp: {
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
      fromVpId: string;
      toVpId: string;
      delegatedAt: string;
      note?: string;
    }> = [];

    const collaborations: Array<{
      taskId: string;
      taskTitle: string;
      primaryVpId: string;
      collaborators: Array<{ vpId: string; role: string; addedAt: string }>;
    }> = [];

    const handoffs: Array<{
      taskId: string;
      taskTitle: string;
      fromVpId: string;
      toVpId: string;
      handoffAt: string;
      context: Record<string, unknown>;
    }> = [];

    tasks.forEach((task) => {
      const metadata = task.metadata as VPCoordinationMetadata;

      // Extract delegations
      if (metadata.delegations) {
        metadata.delegations.forEach((delegation) => {
          if (!vpId || delegation.fromVpId === vpId || delegation.toVpId === vpId) {
            delegations.push({
              taskId: task.id,
              taskTitle: task.title,
              fromVpId: delegation.fromVpId,
              toVpId: delegation.toVpId,
              delegatedAt: delegation.delegatedAt,
              note: delegation.note,
            });
          }
        });
      }

      // Extract collaborations
      if (metadata.collaborators && metadata.collaborators.length > 0) {
        if (!vpId || metadata.collaborators.some((c) => c.vpId === vpId) || task.vpId === vpId) {
          collaborations.push({
            taskId: task.id,
            taskTitle: task.title,
            primaryVpId: task.vpId,
            collaborators: metadata.collaborators,
          });
        }
      }

      // Extract handoffs
      if (metadata.handoffs) {
        metadata.handoffs.forEach((handoff) => {
          if (!vpId || handoff.fromVpId === vpId || handoff.toVpId === vpId) {
            handoffs.push({
              taskId: task.id,
              taskTitle: task.title,
              fromVpId: handoff.fromVpId,
              toVpId: handoff.toVpId,
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
    console.error('[GET /api/workspaces/:workspaceId/vps/coordination] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps/coordination
 *
 * Create a multi-VP task that requires consensus or coordination.
 *
 * @param request - Next.js request with multi-VP task data
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
          VP_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          VP_COORDINATION_ERROR_CODES.FORBIDDEN,
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
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createMultiVpTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Validation failed',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const {
      primaryVpId,
      requiredVpIds,
      title,
      description,
      priority,
      dueDate,
      consensusThreshold,
      metadata: additionalMetadata,
    } = parseResult.data;

    // Verify all VPs exist and belong to workspace organization
    const allVpIds = [primaryVpId, ...requiredVpIds];
    const vps = await prisma.vP.findMany({
      where: {
        id: { in: allVpIds },
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

    if (vps.length !== allVpIds.length) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Some VPs not found or not in workspace organization',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Create multi-VP task with coordination metadata
    const coordinationMetadata: VPCoordinationMetadata = {
      collaborators: requiredVpIds.map((vpId) => ({
        vpId,
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
        vpId: primaryVpId,
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
        vp: {
          select: {
            id: true,
            role: true,
            discipline: true,
          },
        },
      },
    });

    // Create notifications for all required VPs
    const primaryVp = vps.find((vp) => vp.id === primaryVpId);
    await Promise.all(
      requiredVpIds.map((vpId) => {
        const vp = vps.find((v) => v.id === vpId);
        if (!vp) {
return Promise.resolve();
}

        return prisma.notification.create({
          data: {
            userId: vp.userId,
            type: 'SYSTEM',
            title: 'New Multi-VP Task',
            body: `${primaryVp?.role || 'A VP'} has created a multi-VP task requiring your participation: ${title}`,
            priority: 'HIGH',
            resourceId: task.id,
            resourceType: 'task',
            metadata: {
              taskId: task.id,
              primaryVpId,
              consensusThreshold,
              createdAt: new Date().toISOString(),
              notificationType: 'MULTI_VP_TASK',
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
          primaryVp: vps.find((vp) => vp.id === primaryVpId),
          requiredVps: vps.filter((vp) => requiredVpIds.includes(vp.id)),
          consensusThreshold,
          status: 'PENDING',
        },
      },
      message: 'Multi-VP task created successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/coordination] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
