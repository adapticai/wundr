/**
 * Huddle Leave API Route
 *
 * Handles leaving a huddle.
 *
 * Routes:
 * - POST /api/huddles/:huddleId/leave - Leave huddle
 *
 * @module app/api/huddles/[huddleId]/leave/route
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

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

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
 * POST /api/huddles/:huddleId/leave
 *
 * Leave a huddle. Updates the participant record with leave time.
 * If the leaving user is the last participant, the huddle may be ended.
 *
 * @param request - Next.js request object
 * @param context - Route context containing huddle ID
 * @returns Success message
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate huddle ID parameter
    const params = await context.params;
    const paramResult = huddleIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid huddle ID format', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get huddle info
    let huddle: {
      id: string;
      workspaceId: string;
      status: string;
      roomName: string;
    } | null = null;

    // Try huddles table first
    try {
      const huddles = await prisma.$queryRaw<Array<{
        id: string;
        workspace_id: string;
        status: string;
        room_name: string;
      }>>`
        SELECT id, workspace_id, status, room_name
        FROM huddles
        WHERE id = ${params.huddleId}
        LIMIT 1
      `;

      if (huddles.length > 0) {
        huddle = {
          id: huddles[0].id,
          workspaceId: huddles[0].workspace_id,
          status: huddles[0].status,
          roomName: huddles[0].room_name,
        };
      }
    } catch {
      // Try workspace settings
      const workspaces = await prisma.workspaces.findMany({
        select: { id: true, settings: true },
      });

      for (const workspace of workspaces) {
        const settings = workspace.settings as { huddles?: HuddleResponse[] } | null;
        const foundHuddle = settings?.huddles?.find((h) => h.id === params.huddleId);

        if (foundHuddle) {
          huddle = {
            id: foundHuddle.id,
            workspaceId: workspace.id,
            status: foundHuddle.status,
            roomName: foundHuddle.roomName,
          };
          break;
        }
      }
    }

    if (!huddle) {
      return NextResponse.json(
        createErrorResponse('Huddle not found', CALL_ERROR_CODES.HUDDLE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if huddle is still active
    if (huddle.status === 'ended') {
      return NextResponse.json(
        createErrorResponse('Huddle has already ended', CALL_ERROR_CODES.HUDDLE_ALREADY_ENDED),
        { status: 400 },
      );
    }

    const now = new Date();

    // Update participant record
    let wasParticipant = false;
    try {
      const result = await prisma.$executeRaw`
        UPDATE huddle_participants
        SET left_at = ${now}
        WHERE huddle_id = ${params.huddleId}
        AND user_id = ${session.user.id}
        AND left_at IS NULL
      `;
      wasParticipant = result > 0;
    } catch {
      // Table may not exist
      wasParticipant = true; // Assume they were in for settings-based huddles
    }

    if (!wasParticipant) {
      return NextResponse.json(
        createErrorResponse('You are not in this huddle', CALL_ERROR_CODES.NOT_IN_HUDDLE),
        { status: 400 },
      );
    }

    // Check if this was the last participant
    let remainingParticipants = 0;
    try {
      const count = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM huddle_participants
        WHERE huddle_id = ${params.huddleId} AND left_at IS NULL
      `;
      remainingParticipants = Number(count[0]?.count ?? 0);
    } catch {
      // Table doesn't exist
    }

    // Optionally auto-end huddle if empty
    let huddleEnded = false;
    if (remainingParticipants === 0) {
      try {
        await prisma.$executeRaw`
          UPDATE huddles
          SET status = 'ended', ended_at = ${now}, updated_at = ${now}
          WHERE id = ${params.huddleId} AND status = 'active'
        `;
        huddleEnded = true;
      } catch {
        // Try workspace settings
        const workspace = await prisma.workspaces.findUnique({
          where: { id: huddle.workspaceId },
          select: { settings: true },
        });

        const settings = workspace?.settings as { huddles?: HuddleResponse[] } | null;
        if (settings?.huddles) {
          const updatedHuddles = settings.huddles.map((h) =>
            h.id === params.huddleId
              ? { ...h, status: 'ended' as const, endedAt: now.toISOString() }
              : h,
          );

          await prisma.workspaces.update({
            where: { id: huddle.workspaceId },
            data: {
              settings: toJsonValue({
                ...settings,
                huddles: updatedHuddles,
              }),
            },
          });
          huddleEnded = true;
        }
      }
    }

    return NextResponse.json({
      message: huddleEnded
        ? 'Left huddle. Huddle ended as you were the last participant.'
        : 'Left huddle successfully',
      data: {
        huddleId: params.huddleId,
        leftAt: now,
        huddleEnded,
        remainingParticipants,
      },
    });
  } catch (error) {
    console.error('[POST /api/huddles/:huddleId/leave] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
