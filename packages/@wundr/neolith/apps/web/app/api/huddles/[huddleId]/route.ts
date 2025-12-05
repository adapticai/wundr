/**
 * Huddle Detail API Routes
 *
 * Handles single huddle operations including getting details and ending huddles.
 *
 * Routes:
 * - GET /api/huddles/:huddleId - Get huddle details
 * - DELETE /api/huddles/:huddleId - End huddle
 *
 * @module app/api/huddles/[huddleId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  huddleIdParamSchema,
  CALL_ERROR_CODES,
  type HuddleResponse,
} from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Huddle data stored in workspace settings JSON field.
 * Uses ISO string for dates since JSON doesn't support Date objects.
 */
interface StoredHuddleData {
  id: string;
  workspaceSlug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  roomName: string;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt: string | null;
  createdBy: {
    id: string;
    name: string | null;
  };
  participantCount: number;
}

/**
 * Workspace settings structure containing huddles
 */
interface WorkspaceSettingsWithHuddles {
  huddles?: StoredHuddleData[];
  [key: string]: unknown;
}

// Type assertion helper for JSON values
function toJsonValue<T>(data: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

/**
 * Route context with huddle ID parameter
 */
interface RouteContext {
  params: Promise<{ huddleId: string }>;
}

/**
 * Helper to get huddle with access check
 */
async function getHuddleWithAccess(huddleId: string, userId: string) {
  // Try to get huddle from dedicated table first
  try {
    const huddles = await prisma.$queryRaw<
      Array<{
        id: string;
        workspace_id: string;
        name: string;
        description: string | null;
        is_public: boolean;
        room_name: string;
        status: string;
        created_at: Date;
        ended_at: Date | null;
        created_by_id: string;
      }>
    >`
      SELECT * FROM huddles WHERE id = ${huddleId} LIMIT 1
    `;

    if (huddles.length > 0) {
      const huddle = huddles[0];

      // Check workspace access
      const workspace = await prisma.workspace.findUnique({
        where: { id: huddle.workspace_id },
      });

      if (!workspace) {
        return null;
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
        return null;
      }

      return {
        huddle: {
          id: huddle.id,
          workspaceId: huddle.workspace_id,
          name: huddle.name,
          description: huddle.description,
          isPublic: huddle.is_public,
          roomName: huddle.room_name,
          status: huddle.status as 'active' | 'ended',
          createdAt: huddle.created_at,
          endedAt: huddle.ended_at,
          createdById: huddle.created_by_id,
        },
        workspace,
        orgMembership,
      };
    }
  } catch {
    // Table doesn't exist, try workspace settings
  }

  // Fall back to workspace settings
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, settings: true, organizationId: true },
  });

  for (const workspace of workspaces) {
    const settings = workspace.settings as {
      huddles?: HuddleResponse[];
    } | null;
    const huddle = settings?.huddles?.find(h => h.id === huddleId);

    if (huddle) {
      // Check access
      const orgMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: workspace.organizationId,
            userId,
          },
        },
      });

      if (!orgMembership) {
        return null;
      }

      const fullWorkspace = await prisma.workspace.findUnique({
        where: { id: workspace.id },
      });

      return {
        huddle: {
          ...huddle,
          createdById: huddle.createdBy?.id ?? '',
        },
        workspace: fullWorkspace!,
        orgMembership,
        fromSettings: true,
      };
    }
  }

  return null;
}

/**
 * GET /api/huddles/:huddleId
 *
 * Get details of a specific huddle.
 *
 * @param request - Next.js request object
 * @param context - Route context containing huddle ID
 * @returns Huddle details including participants
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
          CALL_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate huddle ID parameter
    const params = await context.params;
    const paramResult = huddleIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid huddle ID format',
          CALL_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get huddle with access check
    const result = await getHuddleWithAccess(params.huddleId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Huddle not found or access denied',
          CALL_ERROR_CODES.HUDDLE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if huddle is private and user is not a participant
    if (!result.huddle.isPublic) {
      // Check if user is in the huddle
      let isParticipant = false;

      try {
        const participants = await prisma.$queryRaw<Array<{ user_id: string }>>`
          SELECT user_id FROM huddle_participants
          WHERE huddle_id = ${params.huddleId} AND user_id = ${session.user.id} AND left_at IS NULL
          LIMIT 1
        `;
        isParticipant = participants.length > 0;
      } catch {
        // Table doesn't exist
      }

      if (!isParticipant && result.huddle.createdById !== session.user.id) {
        return NextResponse.json(
          createErrorResponse(
            'Access denied to private huddle',
            CALL_ERROR_CODES.HUDDLE_PRIVATE,
          ),
          { status: 403 },
        );
      }
    }

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: result.huddle.createdById },
      select: { id: true, name: true, displayName: true },
    });

    // Get participants
    let participants: Array<{
      id: string;
      huddleId: string;
      userId: string;
      displayName: string | null;
      joinedAt: Date;
      leftAt: Date | null;
      isAudioEnabled: boolean;
      isVideoEnabled: boolean;
      user: { id: string; name: string | null; avatarUrl: string | null };
    }> = [];

    try {
      const participantResults = await prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          display_name: string | null;
          joined_at: Date;
          left_at: Date | null;
          is_audio_enabled: boolean;
          is_video_enabled: boolean;
          user_name: string | null;
          user_avatar: string | null;
        }>
      >`
        SELECT
          hp.id,
          hp.user_id,
          hp.display_name,
          hp.joined_at,
          hp.left_at,
          hp.is_audio_enabled,
          hp.is_video_enabled,
          u.name as user_name,
          u.avatar_url as user_avatar
        FROM huddle_participants hp
        LEFT JOIN users u ON hp.user_id = u.id
        WHERE hp.huddle_id = ${params.huddleId}
        ORDER BY hp.joined_at ASC
      `;

      participants = participantResults.map(p => ({
        id: p.id,
        huddleId: params.huddleId,
        userId: p.user_id,
        displayName: p.display_name,
        joinedAt: p.joined_at,
        leftAt: p.left_at,
        isAudioEnabled: p.is_audio_enabled,
        isVideoEnabled: p.is_video_enabled,
        user: {
          id: p.user_id,
          name: p.user_name,
          avatarUrl: p.user_avatar,
        },
      }));
    } catch {
      // Participants table doesn't exist
    }

    const response: HuddleResponse = {
      id: result.huddle.id,
      workspaceId: result.huddle.workspaceId,
      name: result.huddle.name,
      description: result.huddle.description,
      isPublic: result.huddle.isPublic,
      roomName: result.huddle.roomName,
      status: result.huddle.status,
      createdAt: result.huddle.createdAt,
      endedAt: result.huddle.endedAt,
      createdBy: {
        id: creator?.id ?? result.huddle.createdById,
        name: creator?.displayName ?? creator?.name ?? null,
      },
      participantCount: participants.filter(p => !p.leftAt).length,
      participants: participants.map(p => ({
        ...p,
        callId: result.huddle.id,
      })),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[GET /api/huddles/:huddleId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/huddles/:huddleId
 *
 * End a huddle. Only the huddle creator or workspace admin can end a huddle.
 *
 * @param request - Next.js request object
 * @param context - Route context containing huddle ID
 * @returns Success message
 */
export async function DELETE(
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
          CALL_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate huddle ID parameter
    const params = await context.params;
    const paramResult = huddleIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid huddle ID format',
          CALL_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get huddle with access check
    const result = await getHuddleWithAccess(params.huddleId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Huddle not found or access denied',
          CALL_ERROR_CODES.HUDDLE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if huddle is already ended
    if (result.huddle.status === 'ended') {
      return NextResponse.json(
        createErrorResponse(
          'Huddle has already ended',
          CALL_ERROR_CODES.HUDDLE_ALREADY_ENDED,
        ),
        { status: 400 },
      );
    }

    // Check permissions (creator or org admin)
    const isCreator = result.huddle.createdById === session.user.id;
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(result.orgMembership.role);

    // Check workspace admin
    let isWorkspaceAdmin = false;
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: result.workspace.id,
          userId: session.user.id,
        },
      },
    });
    if (
      workspaceMembership &&
      ['OWNER', 'ADMIN'].includes(workspaceMembership.role)
    ) {
      isWorkspaceAdmin = true;
    }

    if (!isCreator && !isOrgAdmin && !isWorkspaceAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only the huddle creator or an admin can end this huddle',
          CALL_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const now = new Date();

    // End the huddle
    if ('fromSettings' in result && result.fromSettings) {
      // Update workspace settings
      const workspace = await prisma.workspace.findUnique({
        where: { id: result.workspace.id },
        select: { settings: true },
      });

      const settings =
        workspace?.settings as WorkspaceSettingsWithHuddles | null;
      const updatedHuddles: StoredHuddleData[] =
        settings?.huddles?.map(h =>
          h.id === params.huddleId
            ? { ...h, status: 'ended' as const, endedAt: now.toISOString() }
            : h,
        ) ?? [];

      const updatedSettings: Prisma.InputJsonValue = toJsonValue({
        ...settings,
        huddles: updatedHuddles,
      });

      await prisma.workspace.update({
        where: { id: result.workspace.id },
        data: {
          settings: updatedSettings,
        },
      });
    } else {
      // Update huddles table
      await prisma.$executeRaw`
        UPDATE huddles
        SET status = 'ended', ended_at = ${now}, updated_at = ${now}
        WHERE id = ${params.huddleId}
      `.catch(() => {});

      // Update all participants' left_at
      await prisma.$executeRaw`
        UPDATE huddle_participants
        SET left_at = ${now}
        WHERE huddle_id = ${params.huddleId} AND left_at IS NULL
      `.catch(() => {});
    }

    // TODO: Notify LiveKit to close the room

    return NextResponse.json({
      message: 'Huddle ended successfully',
      data: {
        id: params.huddleId,
        status: 'ended',
        endedAt: now,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/huddles/:huddleId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
