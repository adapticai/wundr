/**
 * Huddles API Routes
 *
 * Provides real-time huddle management functionality including:
 * - List all active huddles in a workspace
 * - Create a new huddle
 * - Join/leave huddles
 * - Update participant status (mute, speaking)
 *
 * @module app/api/workspaces/[workspaceSlug]/huddles/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createHuddle,
  getWorkspaceHuddles,
  getHuddle,
  joinHuddle,
  leaveHuddle,
  endHuddle,
  toggleMute,
  updateSpeaking,
} from '@/lib/huddles/store';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/huddles
 *
 * Get all active huddles in a workspace.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;

    // Lookup workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', ORG_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    const huddles = getWorkspaceHuddles(workspace.id);

    return NextResponse.json({
      data: huddles,
      count: huddles.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/huddles] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORG_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/huddles
 *
 * Create a new huddle or perform huddle actions.
 *
 * Body:
 * - action: 'create' | 'join' | 'leave' | 'end' | 'mute' | 'speaking'
 * - name: string (for create)
 * - channelId: string (optional, for create)
 * - huddleId: string (for join, leave, end, mute, speaking)
 * - isSpeaking: boolean (for speaking action)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;

    // Lookup workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', ORG_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get user details for participant info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ORG_ERROR_CODES.INTERNAL_ERROR),
        { status: 500 },
      );
    }

    const body = await request.json();
    const { action, name, channelId, huddleId, isSpeaking } = body;

    switch (action) {
      case 'create': {
        if (!name || typeof name !== 'string') {
          return NextResponse.json(
            createErrorResponse('Huddle name is required', ORG_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        const huddle = createHuddle(
          workspace.id,
          name,
          {
            id: user.id,
            name: user.displayName || user.name || user.email,
            email: user.email,
            image: user.avatarUrl,
          },
          channelId,
        );

        return NextResponse.json({ data: huddle }, { status: 201 });
      }

      case 'join': {
        if (!huddleId) {
          return NextResponse.json(
            createErrorResponse('Huddle ID is required', ORG_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        const huddle = getHuddle(huddleId);
        if (!huddle) {
          return NextResponse.json(
            createErrorResponse('Huddle not found', ORG_ERROR_CODES.WORKSPACE_NOT_FOUND),
            { status: 404 },
          );
        }

        if (huddle.workspaceId !== workspace.id) {
          return NextResponse.json(
            createErrorResponse('Huddle not in this workspace', ORG_ERROR_CODES.FORBIDDEN),
            { status: 403 },
          );
        }

        const participant = joinHuddle(huddleId, {
          id: user.id,
          name: user.displayName || user.name || user.email,
          email: user.email,
          image: user.avatarUrl,
        });

        if (!participant) {
          return NextResponse.json(
            createErrorResponse('Failed to join huddle', ORG_ERROR_CODES.INTERNAL_ERROR),
            { status: 500 },
          );
        }

        return NextResponse.json({ data: { huddle: getHuddle(huddleId), participant } });
      }

      case 'leave': {
        if (!huddleId) {
          return NextResponse.json(
            createErrorResponse('Huddle ID is required', ORG_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        const success = leaveHuddle(huddleId, session.user.id);
        if (!success) {
          return NextResponse.json(
            createErrorResponse('Failed to leave huddle', ORG_ERROR_CODES.INTERNAL_ERROR),
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true });
      }

      case 'end': {
        if (!huddleId) {
          return NextResponse.json(
            createErrorResponse('Huddle ID is required', ORG_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        const huddle = getHuddle(huddleId);
        if (!huddle) {
          return NextResponse.json(
            createErrorResponse('Huddle not found', ORG_ERROR_CODES.WORKSPACE_NOT_FOUND),
            { status: 404 },
          );
        }

        // Only allow ending by participants
        const isParticipant = huddle.participants.some((p) => p.user.id === session.user.id);
        if (!isParticipant) {
          return NextResponse.json(
            createErrorResponse('Only participants can end a huddle', ORG_ERROR_CODES.FORBIDDEN),
            { status: 403 },
          );
        }

        const success = endHuddle(huddleId);
        if (!success) {
          return NextResponse.json(
            createErrorResponse('Failed to end huddle', ORG_ERROR_CODES.INTERNAL_ERROR),
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true });
      }

      case 'mute': {
        if (!huddleId) {
          return NextResponse.json(
            createErrorResponse('Huddle ID is required', ORG_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        const success = toggleMute(huddleId, session.user.id);
        if (!success) {
          return NextResponse.json(
            createErrorResponse('Failed to toggle mute', ORG_ERROR_CODES.INTERNAL_ERROR),
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true, huddle: getHuddle(huddleId) });
      }

      case 'speaking': {
        if (!huddleId) {
          return NextResponse.json(
            createErrorResponse('Huddle ID is required', ORG_ERROR_CODES.VALIDATION_ERROR),
            { status: 400 },
          );
        }

        const success = updateSpeaking(huddleId, session.user.id, !!isSpeaking);
        if (!success) {
          return NextResponse.json(
            createErrorResponse('Failed to update speaking status', ORG_ERROR_CODES.INTERNAL_ERROR),
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          createErrorResponse(
            'Invalid action. Must be: create, join, leave, end, mute, or speaking',
            ORG_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceSlug/huddles] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORG_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
