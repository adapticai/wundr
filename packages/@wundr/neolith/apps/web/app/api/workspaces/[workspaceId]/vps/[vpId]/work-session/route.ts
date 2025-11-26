/**
 * VP Work Session Status API Route
 *
 * Monitors current work session progress for a VP.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/work-session - Get current work session status
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/work-session/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  WORK_SESSION_ERROR_CODES,
} from '@/lib/validations/work-session';

import type { NextRequest } from 'next/server';

/**
 * Route context with path parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    vpId: string;
  }>;
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/work-session
 *
 * Get the current work session status for a VP.
 * Returns information about the active task being worked on.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspace and VP IDs
 * @returns Current work session status
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
        createErrorResponse('Authentication required', WORK_SESSION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Verify workspace exists and user has access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        workspaceMembers: {
          some: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          WORK_SESSION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify VP exists
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      select: {
        id: true,
        status: true,
        role: true,
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', WORK_SESSION_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Find the active task for this VP
    const activeTask = await prisma.task.findFirst({
      where: {
        vpId,
        workspaceId,
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        title: true,
        status: true,
        metadata: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Extract progress information from metadata
    let progress = 0;
    let lastUpdate: string | null = null;
    let currentAction: string | null = null;
    let startedAt: string | null = null;

    if (activeTask) {
      const metadata = activeTask.metadata as any;
      progress = metadata?.progress || 0;
      lastUpdate = metadata?.lastProgressUpdate || activeTask.updatedAt.toISOString();
      currentAction = metadata?.lastMessage || null;
      startedAt = metadata?.executionStartedAt || activeTask.updatedAt.toISOString();
    }

    // Determine work session status
    let workSessionStatus: 'idle' | 'active' | 'paused' | 'completed' | 'error' = 'idle';
    if (activeTask) {
      if (vp.status === 'BUSY') {
        workSessionStatus = 'active';
      } else if (vp.status === 'AWAY') {
        workSessionStatus = 'paused';
      } else {
        workSessionStatus = 'active';
      }
    }

    return NextResponse.json({
      data: {
        taskId: activeTask?.id || null,
        status: workSessionStatus,
        startedAt,
        progress,
        lastUpdate,
        currentAction,
        metadata: {
          vpStatus: vp.status,
          vpRole: vp.role,
          taskTitle: activeTask?.title,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching work session:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORK_SESSION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
