/**
 * VP Consensus API Routes
 *
 * Manages VP consensus voting for multi-VP decisions and tasks.
 * Tracks votes and determines when consensus is reached.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/consensus - Initiate consensus vote
 * - GET /api/workspaces/:workspaceId/vps/consensus - Get active consensus votes
 * - PATCH /api/workspaces/:workspaceId/vps/consensus - Cast vote on consensus item
 *
 * @module app/api/workspaces/[workspaceId]/vps/consensus/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Schema for initiating consensus vote
 */
const initiateConsensusSchema = z.object({
  /** Type of consensus item */
  type: z.enum(['task_approval', 'decision', 'resource_allocation', 'priority_change', 'other']),

  /** Title/subject of consensus */
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),

  /** Description/details */
  description: z.string().max(2000, 'Description too long').optional(),

  /** VP IDs required to vote */
  requiredVpIds: z
    .array(z.string().cuid('Invalid VP ID'))
    .min(2, 'At least two VPs required for consensus'),

  /** Threshold percentage for consensus (50-100) */
  threshold: z.number().min(50).max(100).default(75),

  /** Optional task ID if consensus is task-related */
  taskId: z.string().cuid('Invalid task ID').optional(),

  /** Optional voting deadline */
  deadline: z.string().datetime('Invalid datetime format').optional(),

  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for casting a vote
 */
const castVoteSchema = z.object({
  /** Consensus ID */
  consensusId: z.string().cuid('Invalid consensus ID'),

  /** VP ID casting the vote */
  vpId: z.string().cuid('Invalid VP ID'),

  /** Vote decision */
  vote: z.enum(['APPROVE', 'REJECT', 'ABSTAIN']),

  /** Optional vote comment/reason */
  comment: z.string().max(1000, 'Comment too long').optional(),
});

/**
 * Consensus metadata structure
 */
interface ConsensusMetadata {
  id: string;
  type: string;
  title: string;
  description?: string;
  requiredVpIds: string[];
  threshold: number;
  taskId?: string;
  deadline?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  votes: Array<{
    vpId: string;
    vote: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    comment?: string;
    votedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

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
 * Helper function to calculate consensus result
 */
function calculateConsensusResult(
  votes: Array<{ vote: string }>,
  threshold: number,
  requiredVpIds: string[],
): { status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason: string } {
  const totalRequired = requiredVpIds.length;
  const approveVotes = votes.filter((v) => v.vote === 'APPROVE').length;
  const totalVotes = votes.length;

  // Check if all votes are in
  if (totalVotes < totalRequired) {
    return { status: 'PENDING', reason: 'Awaiting votes from all required VPs' };
  }

  // Calculate approval percentage
  const approvalPercentage = (approveVotes / totalRequired) * 100;

  if (approvalPercentage >= threshold) {
    return {
      status: 'APPROVED',
      reason: `Consensus reached: ${approvalPercentage.toFixed(1)}% approval (threshold: ${threshold}%)`,
    };
  }

  return {
    status: 'REJECTED',
    reason: `Consensus not reached: ${approvalPercentage.toFixed(1)}% approval (threshold: ${threshold}%)`,
  };
}

/**
 * POST /api/workspaces/:workspaceId/vps/consensus
 *
 * Initiate a new consensus vote among VPs.
 *
 * @param request - Next.js request with consensus data
 * @param context - Route context containing workspace ID
 * @returns Created consensus record
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
    const parseResult = initiateConsensusSchema.safeParse(body);
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

    const { type, title, description, requiredVpIds, threshold, taskId, deadline, metadata } =
      parseResult.data;

    // Verify all required VPs exist and belong to workspace organization
    const vps = await prisma.vP.findMany({
      where: {
        id: { in: requiredVpIds },
        organizationId: accessCheck.organizationId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (vps.length !== requiredVpIds.length) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Some VPs not found or not in workspace organization',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // If task-related, verify task exists
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          workspaceId,
        },
      });

      if (!task) {
        return NextResponse.json(
          createCoordinationErrorResponse(
            'Task not found in workspace',
            VP_COORDINATION_ERROR_CODES.TASK_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    // Generate consensus ID
    const consensusId = `cons_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create consensus metadata
    const consensusMetadata: ConsensusMetadata = {
      id: consensusId,
      type,
      title,
      description,
      requiredVpIds,
      threshold,
      taskId,
      deadline,
      status: 'PENDING',
      votes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store consensus in workspace settings JSON field
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const currentSettings = (workspace?.settings as Record<string, unknown>) || {};
    const consensuses = (currentSettings.consensuses as Record<string, ConsensusMetadata>) || {};
    consensuses[consensusId] = consensusMetadata;

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...currentSettings,
          consensuses,
          ...(metadata || {}),
        } as never,
      },
    });

    // Create notifications for all required VPs
    await Promise.all(
      vps.map((vp) =>
        prisma.notification.create({
          data: {
            userId: vp.userId,
            type: 'SYSTEM',
            title: 'Consensus Vote Required',
            body: `Please vote on: ${title}`,
            priority: 'HIGH',
            resourceId: taskId || consensusId,
            resourceType: taskId ? 'task' : 'consensus',
            metadata: {
              consensusId,
              type,
              threshold,
              deadline,
              taskId,
              notificationType: 'CONSENSUS_VOTE_REQUEST',
            },
            read: false,
          },
        }),
      ),
    );

    return NextResponse.json({
      data: {
        consensusId,
        ...consensusMetadata,
        requiredVps: vps.map((vp) => ({
          id: vp.id,
          role: vp.role,
        })),
      },
      message: 'Consensus vote initiated successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/consensus] Error:', error);
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
 * GET /api/workspaces/:workspaceId/vps/consensus
 *
 * Get all active consensus votes in the workspace.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns List of active consensus votes
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'
    const vpId = searchParams.get('vpId'); // Filter by VP ID

    // Fetch workspace settings with consensuses
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const currentSettings = (workspace?.settings as Record<string, unknown>) || {};
    const consensuses = (currentSettings.consensuses as Record<string, ConsensusMetadata>) || {};

    // Convert to array and filter
    let consensusArray = Object.values(consensuses);

    // Filter by status if specified
    if (status) {
      consensusArray = consensusArray.filter((c) => c.status === status);
    }

    // Filter by VP if specified
    if (vpId) {
      consensusArray = consensusArray.filter((c) => c.requiredVpIds.includes(vpId));
    }

    // Sort by most recent first
    consensusArray.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      data: consensusArray,
      count: consensusArray.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/vps/consensus] Error:', error);
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
 * PATCH /api/workspaces/:workspaceId/vps/consensus
 *
 * Cast a vote on a consensus item.
 *
 * @param request - Next.js request with vote data
 * @param context - Route context containing workspace ID
 * @returns Updated consensus with vote recorded
 */
export async function PATCH(
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
    const parseResult = castVoteSchema.safeParse(body);
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

    const { consensusId, vpId, vote, comment } = parseResult.data;

    // Verify VP exists and belongs to organization
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        organizationId: accessCheck.organizationId,
      },
      select: { id: true, role: true, userId: true },
    });

    if (!vp) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'VP not found',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const currentSettings = (workspace?.settings as Record<string, unknown>) || {};
    const consensuses = (currentSettings.consensuses as Record<string, ConsensusMetadata>) || {};

    const consensus = consensuses[consensusId];

    if (!consensus) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Consensus not found',
          VP_COORDINATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify VP is required to vote
    if (!consensus.requiredVpIds.includes(vpId)) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'VP is not required to vote on this consensus',
          VP_COORDINATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if VP already voted
    const existingVoteIndex = consensus.votes.findIndex((v) => v.vpId === vpId);
    if (existingVoteIndex !== -1) {
      // Update existing vote
      consensus.votes[existingVoteIndex] = {
        vpId,
        vote,
        comment,
        votedAt: new Date().toISOString(),
      };
    } else {
      // Add new vote
      consensus.votes.push({
        vpId,
        vote,
        comment,
        votedAt: new Date().toISOString(),
      });
    }

    // Calculate consensus result
    const result = calculateConsensusResult(consensus.votes, consensus.threshold, consensus.requiredVpIds);
    consensus.status = result.status;
    consensus.updatedAt = new Date().toISOString();

    // Update workspace settings
    consensuses[consensusId] = consensus;
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...currentSettings,
          consensuses,
        } as never,
      },
    });

    // If consensus reached, notify all participants
    if (result.status !== 'PENDING') {
      const allVps = await prisma.vP.findMany({
        where: { id: { in: consensus.requiredVpIds } },
        select: { userId: true },
      });

      await Promise.all(
        allVps.map((participant) =>
          prisma.notification.create({
            data: {
              userId: participant.userId,
              type: 'SYSTEM',
              title: `Consensus ${result.status}`,
              body: `Consensus on "${consensus.title}" has been ${result.status.toLowerCase()}: ${result.reason}`,
              priority: result.status === 'APPROVED' ? 'NORMAL' : 'HIGH',
              resourceId: consensus.taskId || consensusId,
              resourceType: consensus.taskId ? 'task' : 'consensus',
              metadata: {
                consensusId,
                status: result.status,
                reason: result.reason,
                notificationType: 'CONSENSUS_RESULT',
              },
              read: false,
            },
          }),
        ),
      );
    }

    return NextResponse.json({
      data: {
        consensus,
        result,
      },
      message: `Vote recorded successfully. ${result.reason}`,
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/vps/consensus] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
